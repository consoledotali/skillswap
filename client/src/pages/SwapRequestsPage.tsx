import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ArrowLeftRight,
  ChevronDown,
  SlidersHorizontal,
  MapPin,
  Star,
  CalendarDays,
  MoreVertical,
  Info,
  X,
  MessageSquare,
  Code2,
  Palette,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { createSocket, usePresence } from "../hooks/useSocket";
import { getAvatarColor, getAvatarUrl, getUserInitials } from "../lib/avatar";

const RATING_OPTIONS = [
  { value: "5", label: "Excellent", subtitle: "Outstanding experience", color: "#f59e0b" },
  { value: "4", label: "Great", subtitle: "Very good swap", color: "#f59e0b" },
  { value: "3", label: "Good", subtitle: "Satisfactory exchange", color: "#eab308" },
  { value: "2", label: "Needs improvement", subtitle: "Could have been better", color: "#f97316" },
  { value: "1", label: "Poor", subtitle: "Unsatisfactory experience", color: "#ef4444" },
];

interface SwapRequestItem {
  id: string;
  sender: {
    id?: string;
    full_name: string;
    location: string;
    proficiency_level?: string;
    avatarBg?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
  };
  receiver?: any;
  incoming?: boolean;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED";
  message?: string;
  teach: string;
  teachIcon?: any;
  teachColor?: string;
  wants: string;
  wantsIcon?: any;
  wantsColor?: string;
  rating: string;
  reviewCount: number;
  date: string;
  reviews?: any[];
}

export default function SwapRequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requestsList, setRequestsList] = useState<SwapRequestItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("All Requests");
  const [selectedSort, setSelectedSort] = useState("Most Recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<
    "all" | "incoming" | "sent"
  >("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const selectedRatingOption = RATING_OPTIONS.find((opt) => opt.value === reviewRating) || RATING_OPTIONS[0];
  const [isRatingDropdownOpen, setIsRatingDropdownOpen] = useState(false);
  const [ratingDropdownDirection, setRatingDropdownDirection] = useState<"down" | "up">("down");
  const ratingDropdownRef = useRef<HTMLDivElement>(null);
  const sortControlRef = useRef<HTMLDivElement>(null);
  const filterControlRef = useRef<HTMLDivElement>(null);
  const onlineUserIds = usePresence();

  const toggleRatingDropdown = () => {
    setIsRatingDropdownOpen((prev) => {
      const next = !prev;
      if (next && ratingDropdownRef.current) {
        const rect = ratingDropdownRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setRatingDropdownDirection(spaceBelow < 220 ? "up" : "down");
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isRatingDropdownOpen) return undefined;
    const handleClickOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (ratingDropdownRef.current && !ratingDropdownRef.current.contains(e.target as Node)) {
        setIsRatingDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside as any);
    return () => document.removeEventListener("pointerdown", handleClickOutside as any);
  }, [isRatingDropdownOpen]);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".swap-more-menu-wrap")) setMenuOpenId(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpenId]);

  useEffect(() => {
    const socket = createSocket();
    const handleStatusUpdate = ({
      request_id,
      status,
      actor_id,
    }: {
      request_id?: string;
      status?: SwapRequestItem["status"];
      actor_id?: string;
    }) => {
      if (!request_id || !status) return;
      if (status === "CANCELLED") {
        setRequestsList((current) =>
          current.filter((item) => item.id !== String(request_id)),
        );
        if (String(actor_id) !== String(user?.id)) {
          toast.info("Swap request cancelled", {
            description: "A pending skill exchange request was cancelled.",
          });
        }
        return;
      }
      setRequestsList((current) =>
        current.map((item) =>
          item.id === String(request_id) ? { ...item, status } : item,
        ),
      );
      if (String(actor_id) !== String(user?.id)) {
        const labels: Record<string, string> = {
          ACCEPTED: "Request accepted",
          REJECTED: "Request rejected",
          COMPLETED: "Swap completed",
        };
        toast.info(labels[status] || "Swap request updated", {
          description: "Your request list was updated in real time.",
        });
      }
    };
    socket.on("swap_status_updated", handleStatusUpdate);
    socket.connect();
    return () => {
      socket.off("swap_status_updated", handleStatusUpdate);
      socket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!sortOpen && !filterOpen) return undefined;
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!sortControlRef.current?.contains(target)) setSortOpen(false);
      if (!filterControlRef.current?.contains(target)) setFilterOpen(false);
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, [sortOpen, filterOpen]);

  const loadServerRequests = async () => {
    try {
      const res = await api.get("/swaps");
      const serverData = Array.isArray(res.data?.requests)
        ? res.data.requests
        : [];
      const validRequests = serverData.filter(
        (item: any) => item.status !== "CANCELLED",
      );
      const mapped: SwapRequestItem[] = validRequests.map((item: any) => {
        const incoming = String(item.receiver_id) === String(user?.id);
        const partner = incoming ? item.sender : item.receiver;
        const partnerTeach =
          partner?.skills?.find((skill: any) => skill.skill_type === "TEACH")
            ?.skill?.name || "";
        const partnerLearn =
          partner?.skills?.find((skill: any) => skill.skill_type === "LEARN")
            ?.skill?.name || "";
        const partnerProficiency =
          partner?.proficiency_level ||
          partner?.skills?.find((skill: any) => skill.skill_type === "TEACH")
            ?.proficiency_level ||
          "";
        const createdAt = item.created_at ? new Date(item.created_at) : null;
        return {
          id: String(item.id),
          incoming,
          sender: {
            id: partner?.id,
            full_name: partner?.full_name || "",
            location: partner?.location || "",
            proficiency_level: partnerProficiency,
            avatarBg: getAvatarColor(partner?.full_name),
            avatarUrl: getAvatarUrl(partner),
            isOnline: false,
          },
          status: item.status || "PENDING",
          message: item.message || "",
          teach: partnerTeach,
          teachIcon: Code2,
          teachColor: "blue",
          wants: partnerLearn,
          wantsIcon: Palette,
          wantsColor: "green",
          rating: Number(partner?.average_rating || 0).toFixed(1),
          reviewCount: Number(partner?.review_count || 0),
          date:
            createdAt && !Number.isNaN(createdAt.getTime())
              ? createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "",
          receiver: item.receiver,
          reviews: Array.isArray(item.reviews) ? item.reviews : [],
        };
      });
      setRequestsList(mapped);
    } catch (error: any) {
      setRequestsList([]);
      toast.error(
        error.response?.data?.message || "Unable to load swap requests.",
        { description: "Please try again in a moment." },
      );
    }
  };

  useEffect(() => {
    loadServerRequests();
  }, [user?.id]);

  const handleOpenMessages = (reqId: string) => {
    const request = requestsList.find((item) => item.id === reqId);
    if (!request || !["ACCEPTED", "COMPLETED"].includes(request.status)) {
      toast.info("Messages will unlock once this swap request is accepted.");
      return;
    }
    navigate(`/messages/${reqId}`);
  };

  const handleStatusUpdate = async (
    id: string,
    newStatus: "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED",
  ) => {
    if (newStatus === "CANCELLED") {
      const previousList = requestsList;
      setRequestsList((prev) => prev.filter((item) => item.id !== id));
      try {
        await api.patch(`/swaps/${id}`, { status: "CANCELLED" });
        toast.success("Request cancelled", {
          description: "The swap request has been cancelled and removed.",
        });
      } catch (err: any) {
        setRequestsList(previousList);
        toast.error(err.response?.data?.message || "Unable to cancel request.", {
          description: "Please try again in a moment.",
        });
      }
      return;
    }

    const previousStatus = requestsList.find((item) => item.id === id)?.status;
    setRequestsList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item,
      ),
    );
    try {
      const response = await api.patch(`/swaps/${id}`, { status: newStatus });
      const savedStatus = response.data?.request?.status || newStatus;
      setRequestsList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: savedStatus } : item,
        ),
      );
      const labels: Record<string, string> = {
        ACCEPTED: "Request accepted",
        REJECTED: "Request rejected",
        COMPLETED: "Swap marked complete",
      };
      toast.success(labels[newStatus], {
        description: "The change has been saved.",
      });
      if (newStatus === "COMPLETED") {
        setReviewRequestId(id);
      }
    } catch (err: any) {
      if (previousStatus)
        setRequestsList((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: previousStatus } : item,
          ),
        );
      toast.error(err.response?.data?.message || "Unable to update request.", {
        description: "Please try again in a moment.",
      });
    }
  };

  const handleReview = async () => {
    const rating = Number(reviewRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      toast.error("Rating must be a whole number from 1 to 5.");
      return;
    }
    if (!reviewRequestId) return;
    try {
      await api.post("/reviews", {
        swap_request_id: reviewRequestId,
        rating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewRequestId(null);
      setReviewRating("5");
      setReviewComment("");
      toast.success("Review submitted", {
        description: "Your partner trust score has been updated.",
      });
      await loadServerRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to submit review.");
    }
  };

  const filteredRows = requestsList
    .filter((row) => {
      if (row.status === "CANCELLED") return false;
      if (activeTab === "All Requests") return true;
      if (activeTab === "Pending") return row.status === "PENDING";
      if (activeTab === "Accepted") return row.status === "ACCEPTED";
      if (activeTab === "Rejected") return row.status === "REJECTED";
      if (activeTab === "Completed") return row.status === "COMPLETED";
      return true;
    })
    .filter(
      (row) =>
        directionFilter === "all" ||
        (directionFilter === "incoming" ? row.incoming : !row.incoming),
    );

  const sortedRows = [...filteredRows].sort((first, second) => {
    if (selectedSort === "Name A-Z")
      return first.sender.full_name.localeCompare(second.sender.full_name);
    const firstDate = Date.parse(first.date) || 0;
    const secondDate = Date.parse(second.date) || 0;
    return selectedSort === "Oldest First"
      ? firstDate - secondDate
      : secondDate - firstDate;
  });

  const pendingCount = requestsList.filter(
    (r) => r.status === "PENDING",
  ).length;
  const acceptedCount = requestsList.filter(
    (r) => r.status === "ACCEPTED",
  ).length;
  const completedCount = requestsList.filter(
    (r) => r.status === "COMPLETED",
  ).length;
  const rejectedCount = requestsList.filter(
    (r) => r.status === "REJECTED",
  ).length;

  const tabCounts: Record<string, number> = {
    "All Requests": requestsList.filter((r) => r.status !== "CANCELLED").length,
    Pending: pendingCount,
    Accepted: acceptedCount,
    Rejected: rejectedCount,
    Completed: completedCount,
  };

  return (
    <div className="swap-view-container">
      <section className="page-hero-card">
        <div className="page-hero-rainbow" />
        <div className="page-hero-content">
          <div className="page-hero-left">
            <div className="page-hero-icon-box">
              <ArrowLeftRight size={24} />
            </div>
            <div className="page-hero-titles">
              <h1>
                <span>Swap Requests & Activity</span>
              </h1>
              <p>Manage, track, and collaborate on your incoming and outgoing skill exchange proposals.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="swap-split-layout chat-closed">
        <div className="swap-requests-pane">

          <div className="swap-filter-toolbar">
            <div className="swap-nav-tabs">
              {[
                "All Requests",
                "Pending",
                "Accepted",
                "Rejected",
                "Completed",
              ].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`swap-nav-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <span>
                    {tab === "All Requests" ? (
                      <>
                        <span className="swap-tab-label-full">All Requests</span>
                        <span className="swap-tab-label-short">All</span>
                      </>
                    ) : (
                      tab
                    )}
                  </span>
                  <span className={`swap-tab-pill ${activeTab === tab ? "active" : ""}`}>
                    {tabCounts[tab] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="swap-toolbar-right">
              <div className="swap-sort-wrap" ref={sortControlRef}>
                <button
                  type="button"
                  className="swap-sort-dropdown"
                  aria-expanded={sortOpen}
                  onClick={() => {
                    setSortOpen((open) => !open);
                    setFilterOpen(false);
                  }}
                >
                  <span>{selectedSort}</span>
                  <ChevronDown size={14} />
                </button>
                {sortOpen && (
                  <div className="swap-control-menu" role="menu">
                    {["Most Recent", "Oldest First", "Name A-Z"].map(
                      (option) => (
                        <button
                          type="button"
                          key={option}
                          className={selectedSort === option ? "selected" : ""}
                          onClick={() => {
                            setSelectedSort(option);
                            setSortOpen(false);
                          }}
                        >
                          {option}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
              <div className="swap-filter-wrap" ref={filterControlRef}>
                <button
                  type="button"
                  className="swap-filter-btn"
                  aria-label="Filters"
                  aria-expanded={filterOpen}
                  onClick={() => {
                    setFilterOpen((open) => !open);
                    setSortOpen(false);
                  }}
                >
                  <SlidersHorizontal size={15} />
                </button>
                {filterOpen && (
                  <div
                    className="swap-control-menu swap-filter-menu"
                    role="menu"
                  >
                    {[
                      ["all", "All requests"],
                      ["incoming", "Incoming"],
                      ["sent", "Sent by me"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className={directionFilter === value ? "selected" : ""}
                        onClick={() => {
                          setDirectionFilter(
                            value as "all" | "incoming" | "sent",
                          );
                          setFilterOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="swap-cards-stack">
            {filteredRows.length === 0 ? (
              <div className="swap-empty-box">
                <p>No {activeTab.toLowerCase()} found.</p>
              </div>
            ) : (
              sortedRows.map((req) => {
                const isPending = req.status === "PENDING";
                const isAccepted = req.status === "ACCEPTED";
                const isRejected = req.status === "REJECTED";
                const isCancelled = req.status === "CANCELLED";
                const isCompleted = req.status === "COMPLETED";

                const TeachIcon = req.teachIcon || Code2;
                const WantsIcon = req.wantsIcon || Palette;

                const renderStatusPill = () => (
                  <>
                    {isPending && (
                      <span className="swap-status-pill status-pending">
                        <span className="status-glow-dot blue" /> Pending
                      </span>
                    )}
                    {isAccepted && (
                      <span className="swap-status-pill status-accepted">
                        <CheckCircle2 size={12} /> Accepted
                      </span>
                    )}
                    {isRejected && (
                      <span className="swap-status-pill status-rejected">
                        <X size={12} /> Rejected
                      </span>
                    )}
                    {isCancelled && (
                      <span className="swap-status-pill status-rejected">
                        <X size={12} /> Cancelled
                      </span>
                    )}
                    {isCompleted && (
                      <span className="swap-status-pill status-completed">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    )}
                  </>
                );

                return (
                  <article
                    key={req.id}
                    className="swap-card-modern"
                  >
                    <div className="swap-card-top">
                      <div className="swap-card-user-info">
                        <div className="swap-avatar-wrap">
                          <div
                            className="swap-avatar-circle"
                            style={{ background: req.sender.avatarBg }}
                          >
                            {req.sender.avatarUrl ? (
                              <img
                                src={req.sender.avatarUrl}
                                alt={`${req.sender.full_name} profile`}
                                className="swap-avatar-image"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                  event.currentTarget.nextElementSibling?.classList.remove(
                                    "hidden",
                                  );
                                }}
                              />
                            ) : null}
                            <span
                              className={req.sender.avatarUrl ? "hidden" : ""}
                            >
                              {getUserInitials(req.sender.full_name)}
                            </span>
                          </div>
                          <span className={`swap-avatar-online-dot ${req.sender.id && onlineUserIds.has(String(req.sender.id)) ? "online" : "offline"}`} />
                        </div>

                        <div className="swap-user-meta">
                          <h3 className="swap-user-fullname">
                            {req.sender.full_name}
                          </h3>
                          <div className="swap-user-subline">
                            <span className="swap-location-tag">
                              <MapPin size={11} className="swap-pin-icon" />
                              {req.sender.location}
                            </span>
                            <span className="swap-rating-tag">
                              <Star
                                size={11}
                                className="swap-star-icon"
                                fill="#f59e0b"
                                color="#f59e0b"
                              />
                              <strong>{req.rating}</strong>
                              <small>({req.reviewCount})</small>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="swap-skills-exchange">
                        <div className="swap-skill-item">
                          <span className="swap-skill-type-label">Teaches</span>
                          <div
                            className={`swap-skill-badge tag-${req.teachColor || "blue"}`}
                          >
                            <TeachIcon size={13} className="swap-skill-icon" />
                            <span>{req.teach}</span>
                          </div>
                        </div>

                        <div
                          className="swap-exchange-arrow"
                          title="Skill Exchange"
                        >
                          <ArrowLeftRight size={13} />
                        </div>

                        <div className="swap-skill-item">
                          <span className="swap-skill-type-label">Wants</span>
                          <div
                            className={`swap-skill-badge tag-${req.wantsColor || "green"}`}
                          >
                            <WantsIcon size={13} className="swap-skill-icon" />
                            <span>{req.wants}</span>
                          </div>
                        </div>
                      </div>

                      <div className="swap-card-status-area">
                        <span className="swap-status-pill-desktop">
                          {renderStatusPill()}
                        </span>

                        <div className="swap-more-menu-wrap">
                          <button
                            type="button"
                            className="btn-swap-more"
                            aria-label="More options"
                            onClick={() =>
                              setMenuOpenId(
                                menuOpenId === req.id ? null : req.id,
                              )
                            }
                          >
                            <MoreVertical size={16} />
                          </button>
                          {menuOpenId === req.id && (
                            <div className="swap-popover-dropdown">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  if (req.sender.id)
                                    navigate(`/profile/${req.sender.id}`);
                                }}
                              >
                                <Info size={13} />
                                <span>View Profile</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="swap-card-bottom">
                      <div className="swap-card-footer-meta">
                        <div className="swap-date-badge">
                          <CalendarDays size={13} className="swap-date-icon" />
                          <span>{req.date}</span>
                        </div>

                        <div className="swap-status-pill-mobile">
                          {renderStatusPill()}
                        </div>
                      </div>

                      <div className="swap-bottom-actions">
                        {isPending && req.incoming !== false && (
                          <>
                            <button
                              type="button"
                              className="btn-swap-pill btn-swap-accept"
                              onClick={() =>
                                handleStatusUpdate(req.id, "ACCEPTED")
                              }
                            >
                              <CheckCircle2 size={13} />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              className="btn-swap-pill btn-swap-reject"
                              onClick={() =>
                                handleStatusUpdate(req.id, "REJECTED")
                              }
                            >
                              <X size={13} />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {isPending && req.incoming === false && (
                          <button
                            type="button"
                            className="btn-swap-pill btn-swap-reject"
                            onClick={() =>
                              handleStatusUpdate(req.id, "CANCELLED")
                            }
                          >
                            <X size={13} />
                            <span>Cancel</span>
                          </button>
                        )}
                        {isAccepted && (
                          <button
                            type="button"
                            className="btn-swap-pill btn-swap-accept"
                            onClick={() =>
                              handleStatusUpdate(req.id, "COMPLETED")
                            }
                          >
                            <CheckCircle2 size={13} />
                            <span>Complete</span>
                          </button>
                        )}

                        {isCompleted && (
                          !req.reviews?.some((r: any) => String(r.reviewer_id) === String(user?.id)) ? (
                            <button
                              type="button"
                              className="btn-swap-pill btn-swap-accept"
                              onClick={() => setReviewRequestId(req.id)}
                            >
                              <Star size={13} />
                              <span>Rate & Review</span>
                            </button>
                          ) : null
                        )}

                        <button
                          type="button"
                          className="btn-swap-pill btn-swap-chat"
                          onClick={() => handleOpenMessages(req.id)}
                        >
                          <MessageSquare size={13} />
                          <span>View Messages</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

      </div>
      {reviewRequestId && (
        <div
          className="app-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReviewRequestId(null);
          }}
        >
          <section
            className="app-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
          >
            <button
              type="button"
              className="app-dialog-close"
              aria-label="Close review dialog"
              onClick={() => setReviewRequestId(null)}
            >
              <X size={17} />
            </button>
            <span className="app-dialog-icon review">
              <Star size={19} />
            </span>
            <h2 id="review-dialog-title">
              Rate {requestsList.find((r) => r.id === reviewRequestId)?.sender?.full_name || "partner"}
            </h2>
            <p>
              Your feedback for <strong>{requestsList.find((r) => r.id === reviewRequestId)?.sender?.full_name || "your partner"}</strong> helps build trust in the SkillSwap community.
            </p>
            <label className="app-dialog-label" id="review-rating-label">
              Rating
            </label>

            <div className="custom-rating-dropdown-wrap" ref={ratingDropdownRef}>
              <button
                type="button"
                className={`custom-rating-trigger ${isRatingDropdownOpen ? "open" : ""}`}
                onClick={toggleRatingDropdown}
                aria-expanded={isRatingDropdownOpen}
              >
                <div className="rating-trigger-left">
                  <span className="rating-trigger-badge">
                    <Star size={13} fill="#f59e0b" color="#f59e0b" />
                    <strong>{selectedRatingOption?.value}</strong>
                  </span>
                  <span className="rating-trigger-label">
                    {selectedRatingOption?.label}
                  </span>
                </div>
                <ChevronDown
                  size={15}
                  className={`rating-trigger-chevron ${isRatingDropdownOpen ? "rotated" : ""}`}
                />
              </button>

              {isRatingDropdownOpen && (
                <div className={`custom-rating-menu direction-${ratingDropdownDirection}`}>
                  {RATING_OPTIONS.map((opt) => {
                    const isSelected = opt.value === reviewRating;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`custom-rating-option ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setReviewRating(opt.value);
                          setIsRatingDropdownOpen(false);
                        }}
                      >
                        <div className="rating-option-left">
                          <span
                            className="rating-option-stars"
                            style={{ color: opt.color }}
                          >
                            <Star size={12} fill={opt.color} color={opt.color} />
                            <span>{opt.value}</span>
                          </span>
                          <div className="rating-option-text">
                            <span className="rating-option-title">{opt.label}</span>
                            <span className="rating-option-sub">{opt.subtitle}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={14} className="rating-option-check" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <label className="app-dialog-label" htmlFor="review-comment">
              Feedback <span>(optional)</span>
            </label>
            <textarea
              id="review-comment"
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Share a few words..."
              rows={4}
            />
            <div className="app-dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setReviewRequestId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void handleReview()}
              >
                Submit review
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
