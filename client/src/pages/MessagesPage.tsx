import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { createSocket, usePresence } from "../hooks/useSocket";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrl, getUserInitials } from "../lib/avatar";
import {
  Info,
  Send,
  Search,
  MessageSquare,
  ArrowLeft,
  Check,
  CheckCheck,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

export default function MessagesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newMessagesWhileScrolled, setNewMessagesWhileScrolled] = useState(0);
  const isAtBottomRef = useRef(true);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const onlineUserIds = usePresence();
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    let disposed = false;
    if (!conversations.length) {
      setInboxLoading(true);
    }
    if (id) {
      setChatLoading(true);
    }
    if (!id) {
      const inboxSocket = createSocket();
      const onNotification = (notification: any) => {
        if (
          notification?.type !== "MESSAGE_RECEIVED" ||
          !notification.reference_id
        )
          return;
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === notification.reference_id
              ? {
                ...conversation,
                unread_count: Number(conversation.unread_count || 0) + 1,
              }
              : conversation,
          ),
        );
      };
      const onUnreadCleared = ({
        swap_request_id,
      }: {
        swap_request_id?: string;
      }) => {
        if (!swap_request_id) return;
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === String(swap_request_id)
              ? { ...conversation, unread_count: 0 }
              : conversation,
          ),
        );
      };
      const onUnreadUpdated = ({
        swap_request_id,
        unread_count,
      }: {
        swap_request_id?: string;
        unread_count?: number;
      }) => {
        if (!swap_request_id) return;
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === String(swap_request_id)
              ? { ...conversation, unread_count: Number(unread_count || 0) }
              : conversation,
          ),
        );
      };
      inboxSocket.on("notification", onNotification);
      inboxSocket.on("message_unread_updated", onUnreadUpdated);
      inboxSocket.on("unread_messages_cleared", onUnreadCleared);
      inboxSocket.connect();
      api
        .get("/swaps")
        .then((response) => {
          const active = (response.data.requests || []).filter(
            (item: any) =>
              item.status === "ACCEPTED" || item.status === "COMPLETED",
          );
          if (disposed) return;
          setConversations(active);
          setMessages([]);
          setPartnerName("");
          setPartnerId(null);
          setPartnerAvatarUrl(null);
          setError("");
          setInboxLoading(false);
          setChatLoading(false);
        })
        .catch((requestError: any) => {
          if (!disposed) {
            setError(
              requestError.response?.data?.message ||
              "Unable to load conversations.",
            );
            setInboxLoading(false);
            setChatLoading(false);
          }
        });
      return () => {
        disposed = true;
        inboxSocket.off("notification", onNotification);
        inboxSocket.off("message_unread_updated", onUnreadUpdated);
        inboxSocket.off("unread_messages_cleared", onUnreadCleared);
        inboxSocket.disconnect();
      };
    }

    setIsPartnerTyping(false);
    isTypingRef.current = false;

    const socket = createSocket();
    socketRef.current = socket;
    const onMessage = (message: any) => {
      if (String(message.sender_id) !== String(user?.id)) {
        setIsPartnerTyping(false);
        if (partnerTypingTimeoutRef.current) {
          clearTimeout(partnerTypingTimeoutRef.current);
          partnerTypingTimeoutRef.current = null;
        }
      }
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev, message],
      );
    };
    const onUserTyping = ({
      swap_request_id,
      user_id,
      is_typing,
    }: {
      swap_request_id?: string;
      user_id?: string;
      is_typing?: boolean;
    }) => {
      if (String(swap_request_id) !== String(id)) return;
      if (String(user_id) === String(user?.id)) return;

      if (is_typing) {
        setIsPartnerTyping(true);
        if (partnerTypingTimeoutRef.current) {
          clearTimeout(partnerTypingTimeoutRef.current);
        }
        partnerTypingTimeoutRef.current = setTimeout(() => {
          setIsPartnerTyping(false);
        }, 5000);
      } else {
        if (partnerTypingTimeoutRef.current) {
          clearTimeout(partnerTypingTimeoutRef.current);
          partnerTypingTimeoutRef.current = null;
        }
        setIsPartnerTyping(false);
      }
    };
    const onNotification = (notification: any) => {
      if (
        notification?.type !== "MESSAGE_RECEIVED" ||
        !notification.reference_id
      )
        return;
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === notification.reference_id
            ? {
              ...conversation,
              unread_count: Number(conversation.unread_count || 0) + 1,
            }
            : conversation,
        ),
      );
    };
    const onUnreadUpdated = ({
      swap_request_id,
      unread_count,
    }: {
      swap_request_id?: string;
      unread_count?: number;
    }) => {
      if (!swap_request_id) return;
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === String(swap_request_id)
            ? { ...conversation, unread_count: Number(unread_count || 0) }
            : conversation,
        ),
      );
    };
    const onDelivered = ({
      swap_request_id,
      message_id,
      is_delivered,
    }: {
      swap_request_id?: string;
      message_id?: string;
      is_delivered?: boolean;
    }) => {
      if (String(swap_request_id) !== String(id) || !message_id) return;
      setMessages((current) =>
        current.map((message) =>
          String(message.id) === String(message_id)
            ? { ...message, is_delivered: Boolean(is_delivered) }
            : message,
        ),
      );
    };
    const onRead = ({
      swap_request_id,
      message_ids,
    }: {
      swap_request_id?: string;
      message_ids?: string[];
    }) => {
      if (String(swap_request_id) !== String(id) || !message_ids?.length)
        return;
      const readIds = new Set(message_ids.map(String));
      setMessages((current) =>
        current.map((message) =>
          readIds.has(String(message.id))
            ? { ...message, is_delivered: true, is_read: true }
            : message,
        ),
      );
    };
    socket.on("new_message", onMessage);
    socket.on("user_typing", onUserTyping);
    socket.on("notification", onNotification);
    socket.on("message_unread_updated", onUnreadUpdated);
    socket.on("message_delivered", onDelivered);
    socket.on("messages_read", onRead);
    socket.connect();
    socket.emit("join_room", { swapRequestId: id });
    Promise.all([api.get(`/swaps/${id}/messages`), api.get("/swaps")])
      .then(([messageResponse, swapsResponse]) => {
        if (disposed) return;
        setMessages(messageResponse.data.messages || []);
        const activeConversations = (swapsResponse.data.requests || []).filter(
          (item: any) =>
            item.status === "ACCEPTED" || item.status === "COMPLETED",
        );
        setConversations(activeConversations);
        const current = activeConversations.find(
          (item: any) => String(item.id) === String(id),
        );
        if (!current) {
          setError("Swap request not found.");
          setInboxLoading(false);
          setChatLoading(false);
          return;
        }
        const partner =
          current.sender_id === user?.id ? current.receiver : current.sender;
        setPartnerName(partner?.full_name || "");
        setPartnerId(partner?.id ? String(partner.id) : null);
        setPartnerAvatarUrl(getAvatarUrl(partner));
        setConversations((currentList) =>
          currentList.map((conversation) =>
            String(conversation.id) === String(id)
              ? { ...conversation, unread_count: 0 }
              : conversation,
          ),
        );
        setInboxLoading(false);
        setChatLoading(false);
      })
      .catch((requestError: any) => {
        if (!disposed) {
          const message =
            requestError.response?.data?.message || "Unable to load chat.";
          setError(message);
          setInboxLoading(false);
          setChatLoading(false);
          toast.error(message, {
            description: "Please refresh and try again.",
          });
        }
      });
    return () => {
      disposed = true;
      if (isTypingRef.current && socket.connected) {
        socket.emit("typing_stop", { swapRequestId: id });
        isTypingRef.current = false;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (partnerTypingTimeoutRef.current) {
        clearTimeout(partnerTypingTimeoutRef.current);
        partnerTypingTimeoutRef.current = null;
      }
      socket.off("new_message", onMessage);
      socket.off("user_typing", onUserTyping);
      socket.off("notification", onNotification);
      socket.off("message_unread_updated", onUnreadUpdated);
      socket.off("message_delivered", onDelivered);
      socket.off("messages_read", onRead);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [id, navigate, user?.id]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distFromBottom <= 80;
    isAtBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
    if (isNearBottom) {
      setNewMessagesWhileScrolled(0);
    }
  };

  const scrollToBottom = (smooth = true) => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      bottom.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
    isAtBottomRef.current = true;
    setShowScrollBottom(false);
    setNewMessagesWhileScrolled(0);
  };

  useEffect(() => {
    setShowScrollBottom(false);
    setNewMessagesWhileScrolled(0);
    isAtBottomRef.current = true;
  }, [id]);

  useEffect(() => {
    if (!messages.length) return;

    const lastMsg = messages[messages.length - 1];
    const isMine =
      lastMsg?.sender_id === user?.id || lastMsg?.sender_id === "me";

    if (isAtBottomRef.current || isMine) {
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 40);
      return () => clearTimeout(timer);
    } else {
      setNewMessagesWhileScrolled((prev) => prev + 1);
      setShowScrollBottom(true);
    }
  }, [messages, user?.id]);

  useEffect(() => {
    if (isPartnerTyping && isAtBottomRef.current) {
      bottom.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isPartnerTyping]);

  const handleInputChange = (value: string) => {
    setText(value);
    if (!id || !socketRef.current?.connected) return;

    const now = Date.now();

    if (value.length > 0) {
      if (!isTypingRef.current || now - lastTypingSentRef.current > 1800) {
        isTypingRef.current = true;
        lastTypingSentRef.current = now;
        socketRef.current.emit("typing_start", { swapRequestId: id });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          socketRef.current?.emit("typing_stop", { swapRequestId: id });
        }
      }, 3000);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          socketRef.current?.emit("typing_stop", { swapRequestId: id });
        }
      }, 1200);
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !id) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit("typing_stop", { swapRequestId: id });
    }
    if (!socketRef.current?.connected) {
      toast.error("Chat is not connected.");
      return;
    }
    socketRef.current.emit(
      "send_message",
      { swapRequestId: id, content },
      (result: any) => {
        if (!result?.ok)
          toast.error(result?.message || "Unable to send message.");
        else {
          setText("");
          scrollToBottom(true);
        }
      },
    );
  };

  const partnerInitials = getUserInitials(partnerName);
  const partnerIsOnline = Boolean(partnerId && onlineUserIds.has(partnerId));
  const filteredConversations = conversations.filter((item: any) => {
    const partner = item.sender_id === user?.id ? item.receiver : item.sender;
    return (
      !conversationSearch.trim() ||
      partner?.full_name
        ?.toLowerCase()
        .includes(conversationSearch.trim().toLowerCase())
    );
  });
  const formatConversationDate = (value: string) =>
    value
      ? new Date(value).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })
      : "";
  const getMessageDayKey = (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };
  const getMessageDayLabel = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (getMessageDayKey(value) === getMessageDayKey(today.toISOString()))
      return "Today";
    if (getMessageDayKey(value) === getMessageDayKey(yesterday.toISOString()))
      return "Yesterday";
    return date.toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="page-content chat-page modern-messages-page">
      <div className={`messages-workspace ${id ? "has-active-thread" : ""}`}>
        <aside className={`messages-inbox ${id ? "has-thread" : ""}`}>
          <div className="messages-search">
            <Search size={16} />
            <input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
            />
          </div>
          <div className="conversation-list">
            {inboxLoading && !conversations.length && (
              <div className="conversation-state">Loading conversations...</div>
            )}
            {!inboxLoading && !filteredConversations.length && (
              <div className="conversation-state">
                <MessageSquare size={22} />
                <strong>
                  {conversations.length
                    ? "No matches found"
                    : "No conversations yet"}
                </strong>
                <span>
                  {conversations.length
                    ? "Try another name."
                    : "Accepted swaps will appear here."}
                </span>
              </div>
            )}
            {filteredConversations.map((conversation: any) => {
              const partner =
                conversation.sender_id === user?.id
                  ? conversation.receiver
                  : conversation.sender;
              const name = partner?.full_name || "Skill partner";
              const avatar = getAvatarUrl(partner);
              const isConvPartnerOnline = Boolean(partner?.id && onlineUserIds.has(String(partner.id)));
              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={`conversation-item ${String(conversation.id) === String(id) ? "active" : ""}`}
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                >
                  <span className="conversation-avatar">
                    {avatar ? (
                      <img src={avatar} alt="" />
                    ) : (
                      <span>{getUserInitials(name)}</span>
                    )}
                    <i className={isConvPartnerOnline ? "online" : "offline"} />
                  </span>
                  <span className="conversation-copy">
                    <strong>{name}</strong>
                    <small className={`conversation-status ${isConvPartnerOnline ? "online" : "offline"}`}>
                      {isConvPartnerOnline ? "Online" : "Offline"}
                    </small>
                  </span>
                  <small className="conversation-date">
                    {formatConversationDate(
                      conversation.updated_at || conversation.created_at,
                    )}
                  </small>
                  {Number(conversation.unread_count || 0) > 0 && (
                    <span className="conversation-unread-count">
                      {conversation.unread_count > 99
                        ? "99+"
                        : conversation.unread_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <main className={`chat-window modern-chat-window ${!id ? "no-active-thread" : ""}`}>
          {!id && !inboxLoading ? (
            <div className="messages-empty-thread">
              <MessageSquare size={34} />
              <h2>Select a conversation</h2>
              <p>
                Choose a skill partner from your inbox to continue the exchange.
              </p>
            </div>
          ) : (
            <>
              <div className="chat-head modern-chat-head">
                <button
                  type="button"
                  className="messages-mobile-back"
                  onClick={() => navigate("/messages")}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="modern-chat-profile">
                  <div className="modern-chat-avatar">
                    {partnerAvatarUrl ? (
                      <img
                        src={partnerAvatarUrl}
                        alt={`${partnerName} profile`}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          event.currentTarget.nextElementSibling?.classList.remove(
                            "hidden",
                          );
                        }}
                      />
                    ) : null}
                    <span className={partnerAvatarUrl ? "hidden" : ""}>
                      {partnerInitials}
                    </span>
                    <i
                      className={`chat-presence-dot ${partnerIsOnline ? "online" : "offline"}`}
                      aria-label={partnerIsOnline ? "Online" : "Offline"}
                    />
                  </div>
                  <div className="modern-chat-info">
                    <strong>{partnerName || "Conversation"}</strong>
                    {isPartnerTyping ? (
                      <span className="typing-status-pill">
                        typing
                        <span className="typing-status-dots">
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </span>
                      </span>
                    ) : (
                      <span className={`chat-presence-status ${partnerIsOnline ? "online" : "offline"}`}>
                        {partnerIsOnline ? "Online" : "Offline"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="modern-chat-actions">
                  <button
                    type="button"
                    onClick={() =>
                      partnerId
                        ? navigate(`/profile/${partnerId}`)
                        : toast.error("Profile is unavailable.")
                    }
                    aria-label="View profile"
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>
              <div className="modern-chat-messages-container">
                <div
                  className="chat-messages modern-chat-messages"
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                >
                  {chatLoading ? (
                    <div
                      className="messages-empty-thread compact"
                      style={{
                        minHeight: "220px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                      }}
                    >
                      <RefreshCw
                        size={26}
                        className="animate-spin"
                        style={{ color: "#1267dd" }}
                      />
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Loading messages...
                      </span>
                    </div>
                  ) : (
                    <>
                      {error && !messages.length && (
                        <div className="messages-inline-error">{error}</div>
                      )}
                      {!error && !messages.length && (
                        <div className="messages-empty-thread compact">
                          <MessageSquare size={28} />
                          <strong>Start the conversation</strong>
                          <p>Say hello and begin exchanging skills.</p>
                        </div>
                      )}
                      {messages.map((message, index) => {
                        const isMine =
                          message.sender_id === user?.id ||
                          message.sender_id === "me";
                        const isNewDay =
                          index === 0 ||
                          getMessageDayKey(message.sent_at) !==
                          getMessageDayKey(messages[index - 1].sent_at);
                        return (
                          <Fragment key={message.id}>
                            {isNewDay && (
                              <div className="message-day-divider">
                                <span>{getMessageDayLabel(message.sent_at)}</span>
                              </div>
                            )}
                            <div className={`bubble-row ${isMine ? "mine" : ""}`}>
                              <div className="bubble">
                                {message.content}
                                <small className="message-meta">
                                  {new Date(message.sent_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {isMine &&
                                    (message.is_read ? (
                                      <CheckCheck
                                        className="message-read-receipt read"
                                        size={14}
                                        aria-label="Seen"
                                      />
                                    ) : message.is_delivered ? (
                                      <CheckCheck
                                        className="message-read-receipt delivered"
                                        size={14}
                                        aria-label="Delivered"
                                      />
                                    ) : (
                                      <Check
                                        className="message-read-receipt sent"
                                        size={14}
                                        aria-label="Sent"
                                      />
                                    ))}
                                </small>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                    </>
                  )}
                  {isPartnerTyping && (
                    <div className="bubble-row partner-typing-row" aria-live="polite">
                      <div className="bubble typing-bubble">
                        <span className="typing-author-text">
                          <strong>{partnerName || "Partner"}</strong> is typing
                        </span>
                        <div className="typing-dots-wave">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottom} />
                </div>

                {showScrollBottom && (
                  <button
                    type="button"
                    className="chat-scroll-bottom-btn"
                    onClick={() => scrollToBottom(true)}
                    aria-label="Scroll to bottom"
                    title="Scroll to bottom"
                  >
                    <ChevronDown size={20} strokeWidth={2.4} />
                    {newMessagesWhileScrolled > 0 && (
                      <span className="scroll-bottom-badge">
                        {newMessagesWhileScrolled > 99
                          ? "99+"
                          : newMessagesWhileScrolled}
                      </span>
                    )}
                  </button>
                )}
              </div>
              <form className="chat-input modern-chat-input" onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Write a message..."
                  maxLength={2000}
                  aria-label="Message"
                />
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!text.trim()}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
