export type AvatarUser = {
  full_name?: string | null;
  avatar_url?: string | null;
};

const AVATAR_GRADIENTS = [
  ["#667eea", "#764ba2"],
  ["#0ea5e9", "#2563eb"],
  ["#14b8a6", "#0f766e"],
  ["#f97316", "#dc2626"],
  ["#ec4899", "#be185d"],
  ["#8b5cf6", "#4f46e5"],
  ["#22c55e", "#15803d"],
  ["#eab308", "#ca8a04"],
] as const;

export function getUserInitials(name?: string | null): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getAvatarUrl(user?: AvatarUser | null): string | null {
  const value = String(user?.avatar_url || "").trim();
  return value || null;
}

export function getAvatarColor(name?: string | null): string {
  const normalized = String(name || "user")
    .trim()
    .toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
