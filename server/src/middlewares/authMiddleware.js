import prisma from '../config/db.js';
import { verifyToken } from '../utils.js';

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.is_active || !user.is_verified) return res.status(401).json({ message: 'User session is invalid, inactive, or unverified.' });
    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export { requireAuth };
