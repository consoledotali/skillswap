import prisma from '../config/db.js';
import { publicUser } from '../utils.js';
import { isUserOnline } from '../config/presence.js';

const includeUser = { skills: { include: { skill: { include: { category: true } } } }, reviews_received: { select: { rating: true } } };

function normalizeSkillNames(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((name) => String(name).trim()).filter(Boolean))];
}

function normalizeProfileText(value, field, maxLength) {  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    const error = new Error(`${field} must be text.`);
    error.status = 400;
    throw error;
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    const error = new Error(`${field} must be ${maxLength} characters or fewer.`);
    error.status = 400;
    throw error;
  }
  return normalized || null;
}

const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

function normalizeProficiency(value) {
  if (typeof value !== 'string') return 'Beginner';
  const clean = value.trim();
  return PROFICIENCY_LEVELS.includes(clean) ? clean : 'Beginner';
}

async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: includeUser });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
}

async function updateProfile(req, res, next) {
  try {
    const body = req.body || {};
    const { bio, location, full_name, skillsToTeach, skillsToLearn } = body;
    const proficiencyLevel = normalizeProficiency(body.proficiency_level);
    const teach = normalizeSkillNames(skillsToTeach);
    const learn = normalizeSkillNames(skillsToLearn);
    const skillNames = [...new Set([...teach, ...learn])];
    const bioValue = normalizeProfileText(bio, 'Bio', 500);
    const locationValue = normalizeProfileText(location, 'Location', 120);
    const fullNameValue = full_name !== undefined ? (typeof full_name === 'string' && full_name.trim() ? full_name.trim().slice(0, 80) : undefined) : undefined;
    const skills = skillNames.length ? await prisma.skill.findMany({ where: { name: { in: skillNames } } }) : [];
    const foundNames = new Set(skills.map((skill) => skill.name));
    const missing = skillNames.filter((name) => !foundNames.has(name));
    if (missing.length) return res.status(400).json({ message: 'One or more selected skills are not in the catalog.' });

    const result = await prisma.$transaction(async (tx) => {
      const profileData = { bio: bioValue, location: locationValue, proficiency_level: proficiencyLevel };
      if (fullNameValue) profileData.full_name = fullNameValue;
      if (Object.prototype.hasOwnProperty.call(body, 'avatar_url')) profileData.avatar_url = normalizeProfileText(body.avatar_url, 'Avatar URL', 2048);
      await tx.user.update({ where: { id: req.user.id }, data: profileData });
      await tx.userSkill.deleteMany({ where: { user_id: req.user.id } });
      const rows = [];
      for (const skill of skills) {
        if (teach.includes(skill.name)) rows.push({ user_id: req.user.id, skill_id: skill.id, skill_type: 'TEACH', proficiency_level: proficiencyLevel });
        if (learn.includes(skill.name)) rows.push({ user_id: req.user.id, skill_id: skill.id, skill_type: 'LEARN', proficiency_level: proficiencyLevel });
      }
      if (rows.length) await tx.userSkill.createMany({ data: rows });
      return tx.user.findUnique({ where: { id: req.user.id }, include: includeUser });
    });

    const serialized = publicUser(result);
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('admin:user_profile_updated', { user: serialized });
    }

    res.json({ user: serialized });
  } catch (error) { next(error); }
}

async function getPublicProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: includeUser });
    if (!user || !user.is_active || (!user.is_verified && req.user.id !== user.id)) {
      return res.status(404).json({ message: 'User not found or account is not active.' });
    }
    if (req.user.id !== user.id) {
      const viewRecord = await prisma.profileView.upsert({
        where: { viewer_id_viewed_user_id: { viewer_id: req.user.id, viewed_user_id: user.id } },
        update: { viewed_at: new Date() },
        create: { viewer_id: req.user.id, viewed_user_id: user.id },
        include: { viewer: { include: includeUser } },
      });

      const io = req.app.get('io');
      if (io && viewRecord?.viewer) {
        io.to(`user:${user.id}`).emit('profile_viewed', {
          viewed_at: viewRecord.viewed_at,
          user: publicUser(viewRecord.viewer),
        });
      }
    }
    const profileData = publicUser(user);
    if (profileData) {
      profileData.is_online = isUserOnline(user.id) || req.user.id === user.id;

      if (req.user && req.user.id !== user.id) {
        const userSwaps = await prisma.swapRequest.findMany({
          where: {
            OR: [
              { sender_id: req.user.id, receiver_id: user.id },
              { sender_id: user.id, receiver_id: req.user.id },
            ],
            status: { in: ['PENDING', 'ACCEPTED', 'COMPLETED'] },
          },
          select: { status: true },
        });

        const hasCompleted = userSwaps.some((s) => s.status === 'COMPLETED');
        const hasAccepted = userSwaps.some((s) => s.status === 'ACCEPTED');
        const hasPending = userSwaps.some((s) => s.status === 'PENDING');

        profileData.has_completed_swap = hasCompleted;
        profileData.swap_status = hasCompleted
          ? 'COMPLETED'
          : hasAccepted
            ? 'ACCEPTED'
            : hasPending
              ? 'PENDING'
              : null;
      }
    }
    res.json({ user: profileData });
  } catch (error) { next(error); }
}

async function deleteAccount(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'ADMIN') {
      return res.status(400).json({ message: 'Administrator accounts cannot be deleted directly from user settings.' });
    }

    await prisma.user.delete({ where: { id: user.id } });

    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('admin:user_deleted', { id: user.id });
      io.emit('user:status_changed', {
        userId: user.id,
        user_id: user.id,
        is_active: false,
        is_deleted: true,
      });
      io.emit('presence_update', { user_id: user.id, is_online: false });
      io.in(`user:${user.id}`).disconnectSockets(true);
    }

    res.json({ ok: true, message: 'Account deleted successfully.' });
  } catch (error) { next(error); }
}

async function getRecentViews(req, res, next) {
  try {
    const views = await prisma.profileView.findMany({
      where: {
        viewed_user_id: req.user.id,
        viewer: { is_active: true },
      },
      orderBy: { viewed_at: 'desc' },
      take: 8,
      include: { viewer: { include: includeUser } },
    });
    res.json({
      recent_profiles: views.map((view) => ({
        viewed_at: view.viewed_at,
        user: publicUser(view.viewer),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export { getProfile, updateProfile, getPublicProfile, deleteAccount, getRecentViews };
