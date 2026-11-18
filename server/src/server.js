import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import configureSocket from "./config/socket.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import swapRoutes from "./routes/swapRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH"],
  },
});
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.set("io", io);
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "skillswap-api" }),
);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/swaps", swapRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
configureSocket(io);
app.use(errorMiddleware);

const port = process.env.PORT || 5000;
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  httpServer.listen(port, () => {
    console.log(`SkillSwap API listening on port ${port}`);
  });
export { app, httpServer, io };

