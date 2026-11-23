export interface ParsedSearch {
  q?: string;
  location?: string;
  expertise?: string;
}

const EXPERTISE_MAP: Record<string, string> = {
  beginner: "Beginner",
  beginners: "Beginner",
  basic: "Beginner",
  novice: "Beginner",
  intermediate: "Intermediate",
  mid: "Intermediate",
  medium: "Intermediate",
  advanced: "Advanced",
  advance: "Advanced",
  expert: "Expert",
  experts: "Expert",
  pro: "Expert",
  master: "Expert",
};

const KNOWN_LOCATIONS = new Set([
  "lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "multan",
  "peshawar", "quetta", "sialkot", "gujranwala", "hyderabad", "abbottabad",
  "bahawalpur", "sargodha", "sukkur", "larkana", "sheikhupura", "jhang",
  "gujrat", "mardan", "kasur", "rahim yar khan", "sahiwal", "okara",
  "wah cantt", "dera ghazi khan", "mirpur", "muzaffarabad", "gilgit",
  "skardu", "gwadar", "attock", "chakwal", "taxila", "swat", "mingora",
  "mansehra", "kohat", "bannu", "chaman", "remote", "online", "pakistan",
  "punjab", "sindh", "kpk", "balochistan", "kashmir", "ajk"
]);

function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function parseSmartSearch(rawInput: string): ParsedSearch {
  const trimmed = rawInput.trim();
  if (!trimmed) return {};

  let text = trimmed;
  const parsed: ParsedSearch = {};

  const locPrefixMatch = text.match(/(?:location|city|loc):\s*([^,;]+)/i);
  if (locPrefixMatch) {
    parsed.location = toTitleCase(locPrefixMatch[1].trim());
    text = text.replace(locPrefixMatch[0], "").trim();
  }

  const expPrefixMatch = text.match(/(?:expertise|level|proficiency):\s*([a-zA-Z]+)/i);
  if (expPrefixMatch) {
    const matched = EXPERTISE_MAP[expPrefixMatch[1].toLowerCase()];
    if (matched) {
      parsed.expertise = matched;
      text = text.replace(expPrefixMatch[0], "").trim();
    }
  }

  const namePrefixMatch = text.match(/(?:name|user|skill|q):\s*([^,;]+)/i);
  if (namePrefixMatch) {
    parsed.q = namePrefixMatch[1].trim();
    text = text.replace(namePrefixMatch[0], "").trim();
  }

  if (parsed.location || parsed.expertise || parsed.q) {
    if (text && !parsed.q) {
      parsed.q = text;
    }
    return parsed;
  }

  const lower = text.toLowerCase().trim();

  const cleanExp = lower.replace(/\s+level$/, "").trim();
  if (EXPERTISE_MAP[cleanExp]) {
    return { expertise: EXPERTISE_MAP[cleanExp] };
  }

  const cleanLoc = lower.replace(/^(?:in|from|at|near)\s+/, "").trim();
  const cleanLocBase = cleanLoc.replace(/,\s*(?:pakistan|pk)$/i, "").trim();
  if (KNOWN_LOCATIONS.has(cleanLoc) || KNOWN_LOCATIONS.has(cleanLocBase)) {
    return { location: toTitleCase(cleanLocBase || cleanLoc) };
  }

  const inLocMatch = text.match(/^(.*?)\s+(?:in|from|at|near)\s+([a-zA-Z\s,]+)$/i);
  if (inLocMatch) {
    const candidateQ = inLocMatch[1].trim();
    const candidateLoc = inLocMatch[2].trim().toLowerCase();
    const candidateLocBase = candidateLoc.replace(/,\s*(?:pakistan|pk)$/i, "").trim();

    if (KNOWN_LOCATIONS.has(candidateLoc) || KNOWN_LOCATIONS.has(candidateLocBase)) {
      const words = candidateQ.split(/\s+/);
      const lastWord = words[words.length - 1]?.toLowerCase();
      if (words.length > 1 && EXPERTISE_MAP[lastWord]) {
        return {
          q: words.slice(0, -1).join(" "),
          expertise: EXPERTISE_MAP[lastWord],
          location: toTitleCase(candidateLocBase || candidateLoc),
        };
      }
      return {
        q: candidateQ,
        location: toTitleCase(candidateLocBase || candidateLoc),
      };
    }
  }

  const words = text.split(/\s+/);
  if (words.length > 1) {
    const lastWord = words[words.length - 1].toLowerCase();
    if (EXPERTISE_MAP[lastWord]) {
      return {
        q: words.slice(0, -1).join(" "),
        expertise: EXPERTISE_MAP[lastWord],
      };
    }
  }

  return { q: text };
}

export function buildMatchesSearchUrl(rawInput: string): string {
  const parsed = parseSmartSearch(rawInput);
  const params = new URLSearchParams();

  if (parsed.q) params.set("q", parsed.q);
  if (parsed.location) params.set("location", parsed.location);
  if (parsed.expertise) params.set("expertise", parsed.expertise);

  const queryString = params.toString();
  return queryString ? `/matches?${queryString}` : "/matches";
}
