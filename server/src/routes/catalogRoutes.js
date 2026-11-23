import express from 'express';
const router = express.Router();
import { getCatalog } from '../controllers/catalogController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
router.get('/', requireAuth, getCatalog);
export default router;
