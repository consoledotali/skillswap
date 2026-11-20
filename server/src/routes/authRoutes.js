import express from "express";
const router = express.Router();
import * as controller from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/logout-all", requireAuth, controller.logoutAll);

router.get("/me", requireAuth, controller.me);
router.post("/change-password", requireAuth, controller.changePassword);

router.get("/oauth/:provider", controller.oauthStart);
router.get("/oauth/:provider/callback", controller.oauthCallback);
router.post("/oauth/exchange", controller.oauthExchange);

router.post("/verify-email", controller.verifyEmail);
router.post("/resend-verification", controller.resendVerification);

router.post("/forgot-password", controller.requestPasswordReset);
router.post("/reset-password", controller.resetPassword);

export default router;
