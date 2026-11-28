import express from "express";
import * as controller from "../controllers/notificationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
const router = express.Router();
router.get("/", requireAuth, controller.listNotifications);
router.patch("/:id/read", requireAuth, controller.markRead);
router.patch("/read-all", requireAuth, controller.markAllRead);
export default router;
