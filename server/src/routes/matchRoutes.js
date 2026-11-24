import express from 'express';
const router = express.Router();
import { getMatches } from '../controllers/matchController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
router.get('/', requireAuth, getMatches);
export default router;
