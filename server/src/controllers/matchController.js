import prisma from "../config/db.js";
import { publicUser } from "../utils.js";
import { isUserOnline } from "../config/presence.js";

function skillNames(user, type) {
  return new Set(
    (user.skills || [])
      .filter((row) => row.skill_type === type)
      .map((row) => row.skill.name),
  );
}

function skillList(user, type) {
  return [...skillNames(user, type)];
}

function score(current, candidate) {
  const currentTeach = skillNames(current, "TEACH");
  const currentLearn = skillNames(current, "LEARN");
  const candidateTeach = skillNames(candidate, "TEACH");
  const candidateLearn = skillNames(candidate, "LEARN");
  const learnMatch = [...currentLearn].filter((name) =>
    candidateTeach.has(name),
  );
  const teachMatch = [...currentTeach].filter((name) =>
    candidateLearn.has(name),
  );
  return {
    score: learnMatch.length + teachMatch.length,
    learnMatch,
    teachMatch,
    teachSkills: skillList(candidate, "TEACH"),
    learnSkills: skillList(candidate, "LEARN"),
  };
}

function extractQueryTerms(query) {
  if (!query) return [];
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  if (clean.includes(",")) {
    return clean
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  return [clean];
}

function candidateMatchesSearchTerm(candidateUser, term) {
  if (!term) return false;
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm) return false;

  const allSkills = (candidateUser.skills || []).map((row) =>
    (row.skill?.name || "").toLowerCase(),
  );

  const searchable = [
    candidateUser.full_name,
    candidateUser.bio,
    candidateUser.location,
    ...allSkills,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    allSkills.some(
      (s) => s && (s.includes(cleanTerm) || cleanTerm.includes(s)),
    )
  ) {
    return true;
  }

  if (searchable.includes(cleanTerm)) {
    return true;
  }

  const words = cleanTerm.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 1) {
    if (
      words.some(
        (w) =>
          allSkills.some((s) => s && (s.includes(w) || w.includes(s))) ||
          searchable.includes(w),
      )
    ) {
      return true;
    }
  }

  return false;
}

const includeSkills = {
  skills: { include: { skill: { include: { category: true } } } },
  reviews_received: { select: { rating: true } },
};

async function getMatches(req, res, next) {
  try {
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: includeSkills,
    });
    if (!current)
      return res.status(401).json({ message: "User profile not found." });

    const currentTeach = [...skillNames(current, "TEACH")];
    const currentLearn = [...skillNames(current, "LEARN")];
    const allUsers = String(req.query.all || "") === "1";
    const complementary = [];
    if (currentLearn.length)
      complementary.push({
        skills: {
          some: { skill_type: "TEACH", skill: { name: { in: currentLearn } } },
        },
      });
    if (currentTeach.length)
      complementary.push({
        skills: {
          some: { skill_type: "LEARN", skill: { name: { in: currentTeach } } },
        },
      });

    const query = String(req.query.q || "")
      .trim()
      .toLowerCase();
    const requestedSkill = String(req.query.skill || "")
      .trim()
      .toLowerCase();
    const learn = String(req.query.learn || "")
      .trim()
      .toLowerCase();
    const teach = String(req.query.teach || "")
      .trim()
      .toLowerCase();
    const location = String(req.query.location || "")
      .trim()
      .toLowerCase();
    const expertise = String(req.query.expertise || req.query.level || "")
      .trim()
      .toLowerCase();

    const hasSearch = Boolean(
      query || requestedSkill || learn || teach || expertise,
    );
    if (!complementary.length && !allUsers && !hasSearch) {
      return res.json({ matches: [] });
    }

    const isNationwide =
      !location ||
      location === "all pakistan" ||
      location === "remote / online" ||
      location === "remote";

    const candidates = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        is_active: true,
        is_verified: true,
        role: { not: "ADMIN" },
        ...(allUsers || hasSearch ? {} : { OR: complementary }),
        ...(!isNationwide
          ? { location: { contains: location, mode: "insensitive" } }
          : {}),
        ...(expertise
          ? {
              OR: [
                {
                  proficiency_level: { equals: expertise, mode: "insensitive" },
                },
                {
                  skills: {
                    some: {
                      proficiency_level: { equals: expertise, mode: "insensitive" },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: includeSkills,
    });

    const userSwaps = await prisma.swapRequest.findMany({
      where: {
        OR: [{ sender_id: req.user.id }, { receiver_id: req.user.id }],
        status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] },
      },
      select: {
        sender_id: true,
        receiver_id: true,
        status: true,
      },
    });

    const partnerSwapMap = new Map();
    for (const s of userSwaps) {
      const partnerId = s.sender_id === req.user.id ? s.receiver_id : s.sender_id;
      const current = partnerSwapMap.get(partnerId);
      if (!current || s.status === "COMPLETED") {
        partnerSwapMap.set(partnerId, s.status);
      } else if (s.status === "ACCEPTED" && current !== "COMPLETED") {
        partnerSwapMap.set(partnerId, s.status);
      } else if (!partnerSwapMap.has(partnerId)) {
        partnerSwapMap.set(partnerId, s.status);
      }
    }

    const queryTerms = extractQueryTerms(query);

    const matches = candidates
      .map((candidate) => {
        const swapStatus = partnerSwapMap.get(candidate.id) || null;
        const hasCompletedSwap = swapStatus === "COMPLETED";

        const userObj = {
          ...publicUser(candidate),
          is_online: isUserOnline(candidate.id),
          swap_status: swapStatus,
          has_completed_swap: hasCompletedSwap,
        };
        const baseScoreObj = score(current, candidate);

        const candidateTeach = (userObj.skills || [])
          .filter((row) => row.skill_type === "TEACH")
          .map((row) => (row.skill?.name || "").toLowerCase());
        const candidateLearn = (userObj.skills || [])
          .filter((row) => row.skill_type === "LEARN")
          .map((row) => (row.skill?.name || "").toLowerCase());

        const learnMatched = Boolean(
          learn &&
            candidateTeach.some((s) => s.includes(learn) || learn.includes(s)),
        );
        const teachMatched = Boolean(
          teach &&
            candidateLearn.some((s) => s.includes(teach) || teach.includes(s)),
        );

        let matchedTermsCount = 0;
        if (queryTerms.length > 0) {
          for (const term of queryTerms) {
            if (candidateMatchesSearchTerm(userObj, term)) {
              matchedTermsCount++;
            }
          }
        }

        const qMatches = queryTerms.length === 0 || matchedTermsCount > 0;
        const skillMatches =
          !requestedSkill || candidateMatchesSearchTerm(userObj, requestedSkill);

        const filterMatches =
          !learn && !teach
            ? true
            : learn && teach
              ? learnMatched || teachMatched
              : learnMatched || teachMatched;

        const expertiseMatches =
          !expertise ||
          (userObj.skills || []).some(
            (s) =>
              (s.proficiency_level || "").toLowerCase() === expertise,
          ) ||
          ((userObj.proficiency_level || "").toLowerCase() === expertise);

        let totalScore = baseScoreObj.score || 0;
        if (matchedTermsCount > 0) totalScore += matchedTermsCount * 5;
        if (learnMatched) totalScore += 10;
        if (teachMatched) totalScore += 10;

        return {
          user: userObj,
          swap_status: swapStatus,
          has_completed_swap: hasCompletedSwap,
          allUsers,
          ...baseScoreObj,
          score: totalScore,
          _isMatch:
            qMatches &&
            skillMatches &&
            filterMatches &&
            expertiseMatches &&
            (allUsers || hasSearch || baseScoreObj.score > 0),
        };
      })
      .filter((item) => item._isMatch)
      .sort(
        (a, b) =>
          b.score - a.score || a.user.full_name.localeCompare(b.user.full_name),
      )
      .map(({ _isMatch, ...item }) => item);

    res.json({ matches });
  } catch (error) {
    next(error);
  }
}

export { getMatches };
