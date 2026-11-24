import { useState } from "react";
import {
  CheckCircle2,
  Eye,
  MapPin,
  Send,
  Star,
  Sparkles,
  BookOpen,
  Compass,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import {
  getAvatarColor,
  getAvatarUrl,
  getUserInitials,
} from "../../lib/avatar";
import "../../pages/dashboard.css";

export type Match = {
  user: any;
  score: number;
  learnMatch: string[];
  teachMatch: string[];
  teachSkills?: string[];
  learnSkills?: string[];
  allUsers?: boolean;
  swap_status?: string | null;
  has_completed_swap?: boolean;
};

export default function UserMatchCard({
  match,
  isOnline: liveOnline,
  onSent,
}: {
  match: Match;
  isOnline?: boolean;
  onSent?: () => void;
}) {
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [imageError, setImageError] = useState(false);

  const swapStatus = match.swap_status || match.user?.swap_status;
  const hasCompleted = Boolean(
    match.has_completed_swap ||
      match.user?.has_completed_swap ||
      swapStatus === "COMPLETED",
  );
  const isPending = swapStatus === "PENDING";
  const isAccepted = swapStatus === "ACCEPTED";
  const isRequestSent = requestSent || isPending;

  const send = async () => {
    if (hasCompleted || isRequestSent || isAccepted || sending) return;
    setSending(true);
    try {
      await api.post("/swaps", {
        receiver_id: match.user.id,
        message: "I would like to exchange skills with you.",
      });
      toast.success("Swap request sent", {
        description: `Your request was sent to ${match.user.full_name}.`,
      });
      setRequestSent(true);
      onSent?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Unable to send request.", {
        description: "Please try again in a moment.",
      });
    } finally {
      setSending(false);
    }
  };

  const score = Math.min(99, 70 + match.score * 10);
  const rating = Number(match.user.average_rating || 0).toFixed(1);
  const reviewCount = Number(match.user.review_count || 0);
  const initials = getUserInitials(match.user.full_name);
  const avatarUrl = getAvatarUrl(match.user);
  const avatarColor = getAvatarColor(match.user.full_name);
  const showImage = Boolean(avatarUrl) && !imageError;
  const isOnline =
    typeof liveOnline === "boolean"
      ? liveOnline
      : match.user.is_online === true ||
      match.user.online === true ||
      match.user.status === "online";
  const candidateTeach: string[] = (
    match.teachSkills ||
    (match.user.skills || [])
      .filter((row: any) => row.skill_type === "TEACH")
      .map((row: any) => row.skill?.name)
      .filter((name: any): name is string => Boolean(name))
  ).slice(0, 2);
  const candidateLearn: string[] = (
    match.learnSkills ||
    (match.user.skills || [])
      .filter((row: any) => row.skill_type === "LEARN")
      .map((row: any) => row.skill?.name)
      .filter((name: any): name is string => Boolean(name))
  ).slice(0, 2);

  const teachLevel =
    (match.user?.skills || []).find((s: any) => s.skill_type === "TEACH")?.proficiency_level ||
    match.user?.proficiency_level ||
    null;

  const learnLevel =
    (match.user?.skills || []).find((s: any) => s.skill_type === "LEARN")?.proficiency_level ||
    null;

  return (
    <article className="dash-match-card">
      <div className="dash-mc-head">
        <div className="dash-mc-avatar">
          {showImage && avatarUrl ? (
            <img
              className="dash-mc-avatar-image"
              src={avatarUrl}
              alt={`${match.user.full_name} profile`}
              onError={() => setImageError(true)}
            />
          ) : (
            <span
              className="dash-mc-avatar-fallback"
              style={{ background: avatarColor }}
            >
              {initials}
            </span>
          )}
          <span
            className={`dash-mc-presence-dot ${isOnline ? "online" : "offline"}`}
            aria-label={isOnline ? "Online" : "Offline"}
            title={isOnline ? "Online" : "Offline"}
          />
        </div>
        <div className="dash-mc-person">
          <h3 title={match.user.full_name}>{match.user.full_name}</h3>
          <p title={match.user.location || "Location not set"}>
            <MapPin size={12} className="dash-mc-pin" />
            <span>{match.user.location || "Location not set"}</span>
          </p>
          <div className="dash-mc-rating">
            <Star size={12} fill="#f59e0b" color="#f59e0b" className="dash-mc-star" />
            <strong>{rating}</strong>
            <span>({reviewCount})</span>
          </div>
        </div>
        <span
          className={`dash-mc-score ${match.allUsers && match.score === 0 ? "is-discovery" : ""}`}
        >
          {match.allUsers && match.score === 0 ? (
            <>
              <Compass size={11} /> Explore
            </>
          ) : (
            <>
              <Sparkles size={11} /> {score}% Match
            </>
          )}
        </span>
      </div>

      <div className="dash-mc-skills">
        <div className="dash-mc-row">
          <div className="dash-mc-heading-row">
            <b className="dash-mc-label teaches-label">
              <BookOpen size={11} /> Teaches
            </b>
            {teachLevel && (
              <span className={`dash-mc-heading-level-badge level-${teachLevel.toLowerCase()}`}>
                {teachLevel}
              </span>
            )}
          </div>
          <div className="dash-mc-tags-wrap">
            {candidateTeach.length ? (
              candidateTeach.map((x: string) => (
                <span className="dash-mc-tag teaches" key={x}>
                  <CheckCircle2 size={11} /> {x}
                </span>
              ))
            ) : (
              <span className="dash-mc-tag-empty">Not specified</span>
            )}
          </div>
        </div>

        <div className="dash-mc-row">
          <div className="dash-mc-heading-row">
            <b className="dash-mc-label learns-label">
              <Compass size={11} /> Wants to learn
            </b>
            {learnLevel && (
              <span className={`dash-mc-heading-level-badge level-${learnLevel.toLowerCase()}`}>
                {learnLevel}
              </span>
            )}
          </div>
          <div className="dash-mc-tags-wrap">
            {candidateLearn.length ? (
              candidateLearn.map((x: string) => (
                <span className="dash-mc-tag learns" key={x}>
                  <CheckCircle2 size={11} /> {x}
                </span>
              ))
            ) : (
              <span className="dash-mc-tag-empty">Open to explore</span>
            )}
          </div>
        </div>
      </div>

      <div className="dash-mc-actions">
        <Link to={`/profile/${match.user.id}`} className="dash-mc-btn-outline">
          <Eye size={13} /> View Profile
        </Link>
        {hasCompleted ? (
          <button
            type="button"
            className="dash-mc-btn-solid is-completed"
            disabled
            title="You have already completed a skill swap with this user"
          >
            <CheckCircle2 size={13} /> Swap Completed
          </button>
        ) : isRequestSent ? (
          <button
            type="button"
            className="dash-mc-btn-solid is-sent"
            disabled
            title="Swap request is pending"
          >
            <CheckCircle2 size={13} /> Request Sent
          </button>
        ) : isAccepted ? (
          <button
            type="button"
            className="dash-mc-btn-solid is-in-progress"
            disabled
            title="Skill swap is currently in progress"
          >
            <Sparkles size={13} /> In Progress
          </button>
        ) : (
          <button
            type="button"
            className="dash-mc-btn-solid"
            onClick={send}
            disabled={sending}
          >
            <Send size={13} /> Send Request
          </button>
        )}
      </div>
    </article>
  );
}
