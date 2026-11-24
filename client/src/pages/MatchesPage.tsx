import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { createSocket, usePresence } from "../hooks/useSocket";
import UserMatchCard, { type Match } from "../components/cards/UserMatchCard";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  ChevronDown,
  X,
  Users,
  RotateCcw,
  Sparkles,
  Award,
  Check,
} from "lucide-react";

const SORT_OPTIONS = [
  "Best Match",
  "Highest Rated",
  "Most Reviews",
  "Name A-Z",
];

const EXPERTISE_OPTIONS = [
  { value: "", label: "All Expertise Levels" },
  { value: "Beginner", label: "Beginner Level" },
  { value: "Intermediate", label: "Intermediate Level" },
  { value: "Advanced", label: "Advanced Level" },
  { value: "Expert", label: "Expert Level" },
];

function parseQueryFromParams(params: URLSearchParams) {
  if (params.get("q")) return params.get("q") || "";
  const skills = [params.get("learn"), params.get("teach")].filter(Boolean);
  return skills.join(", ");
}

function parseLocationFromParams(params: URLSearchParams) {
  return params.get("location") || "";
}

function parseExpertiseFromParams(params: URLSearchParams) {
  const raw = (params.get("expertise") || params.get("level") || "").trim();
  if (!raw) return "";
  const match = EXPERTISE_OPTIONS.find((opt) => opt.value.toLowerCase() === raw.toLowerCase());
  return match ? match.value : raw;
}

export default function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);

  const initialQ = parseQueryFromParams(searchParams);
  const initialLocation = parseLocationFromParams(searchParams);
  const initialExpertise = parseExpertiseFromParams(searchParams);

  const [q, setQ] = useState(initialQ);
  const [location, setLocation] = useState(initialLocation);
  const [expertise, setExpertise] = useState(initialExpertise);
  const [selectedSort, setSelectedSort] = useState("Best Match");
  const [sortOpen, setSortOpen] = useState(false);
  const [expertiseOpen, setExpertiseOpen] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const sortRef = useRef<HTMLDivElement>(null);
  const expertiseRef = useRef<HTMLDivElement>(null);
  const onlineUserIds = usePresence();

  useEffect(() => {
    const urlQ = parseQueryFromParams(searchParams);
    const urlLoc = parseLocationFromParams(searchParams);
    const urlExp = parseExpertiseFromParams(searchParams);
    setQ(urlQ);
    setLocation(urlLoc);
    setExpertise(urlExp);
    void load(false, urlQ, urlLoc, urlExp);
  }, [searchParams.toString()]);

  useEffect(() => {
    const socket = createSocket();
    const handleStatusChanged = (data: {
      userId?: string;
      user_id?: string;
      is_active?: boolean;
    }) => {
      const targetId = data?.userId || data?.user_id;
      if (!targetId) return;

      if (!data.is_active) {
        setMatches((prev) =>
          prev.filter(
            (m) => m.user?.id !== targetId && (m as any).id !== targetId,
          ),
        );
      } else {
        void load(false);
      }
    };

    const handleSwapUpdate = () => {
      void load(false);
    };

    socket.on("user:status_changed", handleStatusChanged);
    socket.on("swap_status_updated", handleSwapUpdate);
    socket.on("swap_request_created", handleSwapUpdate);
    socket.connect();

    return () => {
      socket.off("user:status_changed", handleStatusChanged);
      socket.off("swap_status_updated", handleSwapUpdate);
      socket.off("swap_request_created", handleSwapUpdate);
      socket.disconnect();
    };
  }, [q, location, expertise, searchParams.toString()]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (expertiseRef.current && !expertiseRef.current.contains(e.target as Node)) {
        setExpertiseOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const load = async (
    notify = false,
    searchQuery = q,
    searchLocation = location,
    searchExpertise = expertise,
  ) => {
    setLoading(true);
    try {
      const response = await api.get("/matches", {
        params: {
          all: "1",
          q: searchQuery || undefined,
          location: searchLocation || undefined,
          expertise: searchExpertise || undefined,
        },
      });
      const nextMatches = response.data.matches || [];
      setMatches(nextMatches);
      if (notify) {
        toast.success("Skill partners updated", {
          description: `${nextMatches.length} partner${nextMatches.length === 1 ? "" : "s"} found.`,
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to load matches.", {
        description: "Please try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextParams = new URLSearchParams();
    if (q.trim()) nextParams.set("q", q.trim());
    if (location.trim()) nextParams.set("location", location.trim());
    if (expertise.trim()) nextParams.set("expertise", expertise.trim());
    setSearchParams(nextParams);
    void load(true, q.trim(), location.trim(), expertise.trim());
  };

  const handleExpertiseChange = (newLevel: string) => {
    setExpertise(newLevel);
    const nextParams = new URLSearchParams(searchParams);
    if (newLevel) {
      nextParams.set("expertise", newLevel);
    } else {
      nextParams.delete("expertise");
      nextParams.delete("level");
    }
    setSearchParams(nextParams);
    void load(true, q, location, newLevel);
  };

  const handleResetFilters = () => {
    setQ("");
    setLocation("");
    setExpertise("");
    setSelectedSort("Best Match");
    setOnlineOnly(false);
    setSearchParams({});
    void load(false, "", "", "");
  };

  const filteredMatches = matches.filter((match) => {
    if (onlineOnly && !onlineUserIds.has(String(match.user.id))) {
      return false;
    }
    return true;
  });

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    if (selectedSort === "Highest Rated") {
      return Number(b.user.average_rating || 0) - Number(a.user.average_rating || 0);
    }
    if (selectedSort === "Most Reviews") {
      return Number(b.user.review_count || 0) - Number(a.user.review_count || 0);
    }
    if (selectedSort === "Name A-Z") {
      return (a.user.full_name || "").localeCompare(b.user.full_name || "");
    }
    return (b.score || 0) - (a.score || 0);
  });

  const totalOnlineCount = matches.filter((m) =>
    onlineUserIds.has(String(m.user.id)),
  ).length;

  const selectedExpertiseLabel =
    EXPERTISE_OPTIONS.find((opt) => opt.value === expertise)?.label || "All Expertise Levels";

  return (
    <div className="matches-page-container">
      <section className="page-hero-card">
        <div className="page-hero-rainbow" />
        <div className="page-hero-content">
          <div className="page-hero-left">
            <div className="page-hero-icon-box">
              <Sparkles size={24} />
            </div>
            <div className="page-hero-titles">
              <h1>
                <span>Explore Matches</span>
              </h1>
              <p>Connect with SkillSwap community members to exchange knowledge, skills, and expertise.</p>
            </div>
          </div>
        </div>
      </section>

      <form className="matches-modern-toolbar" onSubmit={handleSearchSubmit}>
        <div className="matches-toolbar-inputs">
          <div className="matches-search-field">
            <Search size={18} className="matches-field-icon" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search skills, names, or interests..."
              aria-label="Search skills or people"
            />
            {q && (
              <button
                type="button"
                className="matches-clear-btn"
                onClick={() => {
                  setQ("");
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete("q");
                  nextParams.delete("learn");
                  nextParams.delete("teach");
                  setSearchParams(nextParams);
                  void load(false, "", location, expertise);
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="matches-expertise-field" ref={expertiseRef}>
            <button
              type="button"
              className={`matches-expertise-trigger ${expertiseOpen ? "open" : ""} ${expertise ? "has-value" : ""}`}
              onClick={() => setExpertiseOpen((prev) => !prev)}
              aria-expanded={expertiseOpen}
              aria-label="Filter by expertise level"
            >
              <Award size={18} className="matches-field-icon" />
              <span className="matches-expertise-label">{selectedExpertiseLabel}</span>
              {expertise ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="matches-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpertiseChange("");
                    setExpertiseOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      handleExpertiseChange("");
                      setExpertiseOpen(false);
                    }
                  }}
                  aria-label="Clear expertise filter"
                >
                  <X size={14} />
                </span>
              ) : (
                <ChevronDown size={14} className={`matches-chevron-icon ${expertiseOpen ? "rotate" : ""}`} />
              )}
            </button>

            {expertiseOpen && (
              <div className="matches-expertise-dropdown" role="listbox">
                {EXPERTISE_OPTIONS.map((opt) => {
                  const isSelected = expertise === opt.value;
                  return (
                    <button
                      key={opt.value || "all"}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`matches-expertise-option ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        handleExpertiseChange(opt.value);
                        setExpertiseOpen(false);
                      }}
                    >
                      <span className="matches-expertise-opt-text">{opt.label}</span>
                      {isSelected && <Check size={14} className="matches-check-icon" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="matches-location-field">
            <MapPin size={18} className="matches-field-icon" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (city or country)..."
              aria-label="Filter by location"
            />
            {location && (
              <button
                type="button"
                className="matches-clear-btn"
                onClick={() => {
                  setLocation("");
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete("location");
                  setSearchParams(nextParams);
                  void load(false, q, "", expertise);
                }}
                aria-label="Clear location"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="matches-toolbar-actions">
          <button type="submit" className="btn-matches-search">
            <Search size={16} />
            <span>Search</span>
          </button>
        </div>
      </form>

      <div className="matches-meta-header">
        <div className="matches-results-summary">
          <Users size={16} className="summary-icon" />
          <span>
            Showing <strong>{sortedMatches.length}</strong> available skill partner
            {sortedMatches.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="matches-sort-and-presence">
          <button
            type="button"
            className={`btn-online-filter ${onlineOnly ? "active" : ""}`}
            onClick={() => setOnlineOnly(!onlineOnly)}
            title="Toggle online only"
          >
            <span className="online-indicator-dot" />
            <span>Online now</span>
            {totalOnlineCount > 0 && (
              <span className="online-count-badge">{totalOnlineCount}</span>
            )}
          </button>

          <div className="matches-sort-wrap" ref={sortRef}>
            <button
              type="button"
              className="matches-sort-btn"
              onClick={() => setSortOpen(!sortOpen)}
              aria-expanded={sortOpen}
            >
              <span className="sort-label">Sort:</span>
              <strong className="sort-value">{selectedSort}</strong>
              <ChevronDown size={14} className="sort-arrow" />
            </button>

            {sortOpen && (
              <div className="matches-dropdown-menu" role="menu">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`matches-dropdown-item ${selectedSort === opt ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedSort(opt);
                      setSortOpen(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(q || location || expertise || onlineOnly) && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={handleResetFilters}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="matches-cards-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="match-card-skeleton animate-pulse">
              <div className="skeleton-head">
                <div className="skeleton-avatar" />
                <div className="skeleton-lines">
                  <div className="skeleton-line-title" />
                  <div className="skeleton-line-sub" />
                </div>
                <div className="skeleton-score" />
              </div>
              <div className="skeleton-body">
                <div className="skeleton-skill-row" />
                <div className="skeleton-skill-row" />
              </div>
              <div className="skeleton-foot" />
            </div>
          ))}
        </div>
      ) : sortedMatches.length === 0 ? (
        <div className="matches-empty-container">
          <div className="empty-icon-wrap">
            <Users size={36} />
          </div>
          <h3>No matching skill partners found</h3>
          <p>
            We couldn't find anyone matching your current filters. Try searching
            for different keywords or clearing your location filter.
          </p>
          <button
            type="button"
            className="btn-matches-reset"
            onClick={handleResetFilters}
          >
            <RotateCcw size={15} />
            <span>Clear all filters</span>
          </button>
        </div>
      ) : (
        <div className="matches-cards-grid">
          {sortedMatches.map((match) => (
            <UserMatchCard
              key={match.user.id}
              match={match}
              isOnline={onlineUserIds.has(String(match.user.id))}
              onSent={() => void load(false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
