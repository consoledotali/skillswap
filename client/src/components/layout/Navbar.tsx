import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Clock,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings as SettingsIcon,
  Star,
  User as UserIcon,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getAvatarColor,
  getAvatarUrl,
  getUserInitials,
} from "../../lib/avatar";
import { useNotifications, type NotificationItem } from "../../hooks/useNotifications";
import { useMessageUnread } from "../../hooks/useMessageUnread";
import { createSocket, usePresence } from "../../hooks/useSocket";
import { api } from "../../lib/api";
import { buildMatchesSearchUrl } from "../../lib/searchParser";
import "./shell.css";

interface NavbarProps {
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export default function Navbar({ onToggleMobileMenu, isMobileMenuOpen }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [recentProfiles, setRecentProfiles] = useState<Array<{ viewed_at: string; user: any }>>([]);
  const [notifTab, setNotifTab] = useState<"all" | "unread">("all");
  const [searchValue, setSearchValue] = useState("");
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const onlineUserIds = usePresence();

  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications(Boolean(user));
  const messageUnreadCount = useMessageUnread(user?.id);
  const displayName = user?.full_name || "User";
  const userEmail = user?.email || "";
  const avatarUrl = getAvatarUrl(user);
  const avatarInitials = getUserInitials(displayName);
  const avatarColor = getAvatarColor(displayName);

  const formatRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getDropdownIcon = (type: string) => {
    const t = (type || "").toUpperCase();
    if (t.includes("MESSAGE")) return { icon: MessageSquare, color: "blue" };
    if (t.includes("SWAP")) return { icon: ArrowLeftRight, color: "purple" };
    if (t.includes("REVIEW")) return { icon: Star, color: "amber" };
    return { icon: Bell, color: "slate" };
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await markRead(item.id);
    }
    setNotificationsOpen(false);
    const t = (item.type || "").toUpperCase();
    if (t.includes("MESSAGE")) {
      navigate("/messages");
    } else if (t.includes("SWAP")) {
      navigate("/swaps");
    } else if (t.includes("REVIEW")) {
      navigate("/ratings");
    } else {
      navigate("/notifications");
    }
  };

  const displayedNotifications = notifTab === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentProfiles([]);
      return;
    }
    api
      .get("/profile/views/recent")
      .then((res) => setRecentProfiles(res.data?.recent_profiles || []))
      .catch(() => { });

    const socket = createSocket();
    const handleProfileViewed = (payload: { viewed_at: string; user: any }) => {
      if (!payload?.user?.id) return;
      setRecentProfiles((prev) => {
        const withoutCurrent = prev.filter(
          (entry) => String(entry.user?.id) !== String(payload.user.id)
        );
        return [{ viewed_at: payload.viewed_at, user: payload.user }, ...withoutCurrent].slice(0, 8);
      });
    };

    socket.on("profile_viewed", handleProfileViewed);
    socket.connect();

    return () => {
      socket.off("profile_viewed", handleProfileViewed);
      socket.disconnect();
    };
  }, [user, location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (recentRef.current && !recentRef.current.contains(target)) {
        setRecentOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setProfileOpen(false);
        setRecentOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 50);
    }
  }, [mobileSearchOpen]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/matches") {
      const params = new URLSearchParams(location.search);
      const urlQ = params.get("q") || params.get("learn") || params.get("teach") || "";
      const urlLoc = params.get("location") || "";
      const urlExp = params.get("expertise") || params.get("level") || "";
      const parts = [urlQ, urlExp, urlLoc ? `in ${urlLoc}` : ""].filter(Boolean);
      setSearchValue(parts.join(" ") || urlQ || urlLoc || urlExp);
    }
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchValue.trim();
    if (query) {
      navigate(buildMatchesSearchUrl(query));
    } else {
      navigate("/matches");
    }
  };

  const handleClearSearch = () => {
    setSearchValue("");
    if (location.pathname === "/matches") {
      navigate("/matches");
    }
  };

  return (
    <header className={`topbar reference-topbar modern-topbar ${mobileSearchOpen ? "mobile-search-active" : ""}`}>
      {mobileSearchOpen ? (
        <form
          className="mobile-full-search-bar"
          onSubmit={(e) => {
            handleSearchSubmit(e);
            setMobileSearchOpen(false);
          }}
        >
          <button
            type="button"
            className="mobile-search-back-btn"
            onClick={() => setMobileSearchOpen(false)}
            aria-label="Close search"
            title="Back"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="mobile-search-input-wrap">
            <Search size={16} className="mobile-search-inner-icon" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              aria-label="Search skills, users or swaps"
              placeholder="Search skills, topics, partners..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button
                type="button"
                className="mobile-search-clear-btn"
                onClick={handleClearSearch}
                aria-label="Clear search"
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="mobile-search-submit-btn"
            aria-label="Submit search"
          >
            Search
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className="mobile-menu-toggle-btn"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            <Menu size={20} strokeWidth={2.2} />
          </button>

      <Link className="brand reference-brand modern-brand" to="/">
        <span className="brand-logo modern-logo">
          <ArrowLeftRight size={19} strokeWidth={2.2} />
        </span>
        <div className="modern-brand-copy">
          <span className="modern-brand-name">
            Skill<span className="modern-brand-accent">Swap</span>
          </span>
          <small className="modern-brand-tagline">Skill Exchange Network</small>
        </div>
      </Link>

      <form
        className="top-search reference-search compact-search"
        onSubmit={handleSearchSubmit}
      >
        <button
          type="submit"
          className="top-search-submit-btn"
          aria-label="Search"
          title="Search SkillSwap"
        >
          <Search size={16} className="top-search-icon" />
        </button>
        <input
          ref={searchInputRef}
          aria-label="Search skills, users or swaps"
          placeholder="Search skills, topics, partners..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
        {searchValue ? (
          <button
            type="button"
            className="top-search-clear-btn"
            onClick={handleClearSearch}
            title="Clear search"
          >
            <X size={13} />
          </button>
        ) : (
          <div className="top-search-shortcut" title="Press Ctrl+K to search">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </div>
        )}
      </form>

      <div className="top-actions reference-actions">
        <button
          type="button"
          className={`header-icon-button mobile-search-trigger-btn ${mobileSearchOpen ? "is-active" : ""}`}
          onClick={() => {
            setMobileSearchOpen((prev) => !prev);
            setRecentOpen(false);
            setNotificationsOpen(false);
            setProfileOpen(false);
          }}
          aria-label="Search"
          title="Search"
        >
          <Search size={18} />
        </button>
        {user && (
          <div className="topbar-recent-wrap" ref={recentRef}>
            <button
              type="button"
              className={`topbar-recent-pill ${recentOpen ? "is-active" : ""}`}
              onClick={() => {
                setRecentOpen((open) => !open);
                setNotificationsOpen(false);
                setProfileOpen(false);
              }}
              aria-expanded={recentOpen}
              aria-label="Recent Profile Visitors"
              title="Recent Profile Visitors"
            >
              <Clock size={14} className="topbar-recent-icon" />
              <span className="topbar-recent-text">Recent</span>
              {recentProfiles.length > 0 && (
                <span className="topbar-recent-badge">{recentProfiles.length}</span>
              )}
              <ChevronDown size={12} className={`topbar-recent-chevron ${recentOpen ? "rotated" : ""}`} />
            </button>

            {recentOpen && (
              <div className="topbar-recent-popover" role="dialog" aria-label="Recent Profile Visitors">
                <div className="topbar-recent-head">
                  <div className="topbar-recent-head-title">
                    <Clock size={14} className="head-clock-icon" />
                    <span>Recent Visitors</span>
                    {recentProfiles.length > 0 && (
                      <span className="recent-count-tag">{recentProfiles.length}</span>
                    )}
                  </div>
                  <Link
                    to="/matches"
                    className="topbar-recent-explore-link"
                    onClick={() => setRecentOpen(false)}
                  >
                    Find Partners
                  </Link>
                </div>

                <div className="topbar-recent-list">
                  {recentProfiles.length > 0 ? (
                    recentProfiles.map((item) => {
                      const partner = item.user;
                      if (!partner?.id) return null;
                      const isOnline = onlineUserIds.has(String(partner.id)) || partner.is_online === true;
                      const initials = getUserInitials(partner.full_name);
                      const avatar = getAvatarUrl(partner);
                      const color = getAvatarColor(partner.full_name);
                      const rating = Number(partner.average_rating || 0).toFixed(1);
                      const level =
                        (partner.skills || []).find((s: any) => s.skill_type === "TEACH")?.proficiency_level ||
                        partner.proficiency_level ||
                        null;
                      const timeAgo = formatRelativeTime(item.viewed_at);

                      return (
                        <Link
                          key={partner.id}
                          to={`/profile/${partner.id}`}
                          className="topbar-recent-row"
                          onClick={() => setRecentOpen(false)}
                        >
                          <div className="topbar-recent-avatar-box">
                            {avatar ? (
                              <img src={avatar} alt={partner.full_name} className="topbar-recent-avatar-img" />
                            ) : (
                              <span className="topbar-recent-avatar-fallback" style={{ background: color }}>
                                {initials}
                              </span>
                            )}
                            <span className={`topbar-recent-dot ${isOnline ? "online" : "offline"}`} />
                          </div>

                          <div className="topbar-recent-row-content">
                            <div className="topbar-recent-row-top">
                              <span className="topbar-recent-row-name" title={partner.full_name}>
                                {partner.full_name}
                              </span>
                              {level && (
                                <span className={`dash-mc-heading-level-badge level-${level.toLowerCase()}`}>
                                  {level}
                                </span>
                              )}
                            </div>
                            <div className="topbar-recent-row-sub">
                              <span className="topbar-recent-loc">{partner.location || "Location not set"}</span>
                              <span className="topbar-recent-sep">·</span>
                              <span className="topbar-recent-rating">★ {rating}</span>
                              <span className="topbar-recent-sep">·</span>
                              <span className="topbar-recent-time">{timeAgo}</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="topbar-recent-empty">
                      <div className="topbar-recent-empty-icon">
                        <Clock size={22} />
                      </div>
                      <p className="topbar-recent-empty-title">No profile visitors yet</p>
                      <small className="topbar-recent-empty-desc">
                        When other members view your profile, they will appear here in real time.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="notification-wrap" ref={notificationRef}>
          <button
            type="button"
            className={`header-icon-button ${notificationsOpen ? "is-active" : ""}`}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);
            }}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="badge-red">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div
              className="notification-popover modern-notif-popover"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="notification-popover-head">
                <div className="notification-head-title">
                  <span className="notif-title-text">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="notification-unread-pill">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="notification-mark-all"
                    onClick={() => {
                      void markAllRead();
                    }}
                    title="Mark all notifications as read"
                  >
                    <Check size={13} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="notification-popover-tabs">
                <button
                  type="button"
                  className={`notif-popover-tab ${notifTab === "all" ? "active" : ""}`}
                  onClick={() => setNotifTab("all")}
                >
                  <span>All</span>
                  <span className="notif-popover-badge">{notifications.length}</span>
                </button>
                <button
                  type="button"
                  className={`notif-popover-tab ${notifTab === "unread" ? "active" : ""}`}
                  onClick={() => setNotifTab("unread")}
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="notif-popover-badge unread">{unreadCount}</span>
                  )}
                </button>
              </div>

              <div className="notification-list">
                {displayedNotifications.slice(0, 8).map((item) => {
                  const meta = getDropdownIcon(item.type);
                  const IconComp = meta.icon;

                  return (
                    <button
                      type="button"
                      className={`notification-item ${item.is_read ? "read" : "unread"}`}
                      key={item.id}
                      onClick={() => void handleNotificationClick(item)}
                    >
                      <div className={`notification-item-icon-box ${meta.color}`}>
                        <IconComp size={15} />
                      </div>
                      <div className="notification-item-body">
                        <div className="notif-item-title-row">
                          <strong className="notif-item-title">{item.title}</strong>
                          {!item.is_read && <span className="notif-item-pulse-dot" />}
                        </div>
                        <span className="notif-item-snippet">{item.message}</span>
                        <small className="notif-item-time">
                          {formatRelativeTime(item.created_at)}
                        </small>
                      </div>
                    </button>
                  );
                })}

                {!displayedNotifications.length && (
                  <div className="notification-empty">
                    <div className="notif-empty-bell">
                      <Bell size={24} />
                    </div>
                    <p className="notif-empty-title">
                      {notifTab === "unread" ? "No unread notifications" : "No notifications yet"}
                    </p>
                    <small className="notif-empty-desc">
                      {notifTab === "unread" ? "You've read all your notifications!" : "You're all caught up on activity!"}
                    </small>
                  </div>
                )}
              </div>

              <div className="notification-popover-footer">
                <Link
                  to="/notifications"
                  className="btn-view-all-notifs"
                  onClick={() => setNotificationsOpen(false)}
                >
                  <span>View All Notifications</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link
          className="header-icon-button message-header-button"
          to="/messages"
          aria-label="Messages"
          title="Direct Messages"
        >
          <MessageSquare size={18} />
          {messageUnreadCount > 0 && (
            <span className="badge-red">
              {messageUnreadCount > 99 ? "99+" : messageUnreadCount}
            </span>
          )}
        </Link>

        <div className="topbar-profile-wrap" ref={profileRef}>
          <button
            type="button"
            className={`topbar-profile-btn ${profileOpen ? "is-active" : ""}`}
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Open user profile menu"
          >
            <div className="topbar-avatar-wrap">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="topbar-avatar-img"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    event.currentTarget.nextElementSibling?.classList.remove(
                      "hidden",
                    );
                  }}
                />
              ) : null}
              <span
                className={`topbar-avatar-initials ${avatarUrl ? "hidden" : ""}`}
                style={{ background: avatarColor }}
              >
                {avatarInitials}
              </span>
              <span className="topbar-online-dot" />
            </div>
            <span className="topbar-user-name">{displayName}</span>
            <ChevronDown
              size={13}
              className={`topbar-profile-chevron ${profileOpen ? "rotated" : ""}`}
            />
          </button>

          {profileOpen && (
            <div className="topbar-profile-dropdown" role="menu">
              <div className="topbar-dropdown-header">
                <span className="topbar-dropdown-name">{displayName}</span>
                {userEmail && (
                  <span className="topbar-dropdown-email">{userEmail}</span>
                )}
              </div>
              <div className="topbar-dropdown-divider" />
              <Link
                to="/profile"
                className="topbar-dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <UserIcon size={14} />
                <span>My Profile</span>
              </Link>
              <Link
                to="/swaps"
                className="topbar-dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <ArrowLeftRight size={14} />
                <span>Swap Requests</span>
              </Link>
              <Link
                to="/settings"
                className="topbar-dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <SettingsIcon size={14} />
                <span>Settings</span>
              </Link>
              <div className="topbar-dropdown-divider" />
              <button
                type="button"
                className="topbar-dropdown-item logout"
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
      </>
    )}
  </header>
  );
}
