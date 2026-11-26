import express from 'express';
const router = express.Router();
import * as controller from '../controllers/swapController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
router.get('/', requireAuth, controller.listSwaps);
router.post('/', requireAuth, controller.createSwap);
router.patch('/:id', requireAuth, controller.updateSwap);
router.get('/:id/messages', requireAuth, controller.getMessages);
export default router;
