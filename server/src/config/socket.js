import jwt from "jsonwebtoken";
import prisma from "./db.js";
import { createNotification } from "../utils.js";

import { connectedUsers } from "./presence.js";

const senderSelect = { id: true, full_name: true, location: true };

function userIsInRoom(io, roomName, userId) {
  const room = io.sockets.adapter.rooms.get(roomName);
  if (!room) return false;
  return [...room].some(
    (socketId) =>
      String(io.sockets.sockets.get(socketId)?.user?.sub) === String(userId),
  );
}

async function markSwapMessagesRead(io, request, viewerId) {
  const senderId =
    String(request.sender_id) === String(viewerId)
      ? request.receiver_id
      : request.sender_id;

  const unread = await prisma.message.findMany({
    where: { swap_request_id: request.id, sender_id: senderId, is_read: false },
    select: { id: true },
  });

  if (!unread.length) return [];
  await prisma.message.updateMany({
    where: { swap_request_id: request.id, sender_id: senderId, is_read: false },
    data: { is_read: true },
  });

  io.to(`user:${senderId}`).emit("messages_read", {
    swap_request_id: request.id,
    message_ids: unread.map(({ id }) => String(id)),
  });
  io.to(`user:${viewerId}`).emit("unread_messages_cleared", {
    swap_request_id: String(request.id),
  });

  return unread.map(({ id }) => String(id));
}

function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev-secret-change-me",
      );
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, is_active: true },
      });
      if (!user || !user.is_active)
        return next(new Error("User session is invalid or inactive."));
      socket.user = payload;
      next();
    } catch (_error) {
      next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.user.sub);

    const activeConnections = connectedUsers.get(userId) || 0;

    connectedUsers.set(userId, activeConnections + 1);

    socket.join(`user:${userId}`);

    if (socket.user?.role === "ADMIN") {
      socket.join("admin");
    }

    socket.on("admin:join", async () => {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (u?.role === "ADMIN") {
          socket.join("admin");
          socket.emit("admin:joined", { ok: true, timestamp: Date.now() });
        }
      } catch (_e) {}
    });

    socket.on("admin:ping", (callback) => {
      if (typeof callback === "function") callback({ pong: true, serverTime: Date.now() });
    });

    prisma.message
      .findMany({
        where: {
          sender_id: { not: userId },
          is_read: false,
          swap_request: {
            status: { in: ["ACCEPTED", "COMPLETED"] },
            OR: [{ sender_id: userId }, { receiver_id: userId }],
          },
        },
        select: { id: true, swap_request_id: true, sender_id: true },
      })
      .then((pendingMessages) => {
        pendingMessages.forEach((message) => {
          io.to(`user:${message.sender_id}`).emit("message_delivered", {
            swap_request_id: String(message.swap_request_id),
            message_id: String(message.id),
            is_delivered: true,
          });
        });
      })
      .catch(() => undefined);

    socket.emit("presence_snapshot", { user_ids: [...connectedUsers.keys()] });

    if (activeConnections === 0) {
      io.emit("presence_update", { user_id: userId, is_online: true });
      prisma.user
        .findUnique({
          where: { id: userId },
          select: { id: true, full_name: true, role: true, email: true },
        })
        .then((u) => {
          if (u) {
            io.to("admin").emit("admin:user_online", {
              user: u,
              timestamp: Date.now(),
            });
          }
        })
        .catch(() => {});
    }

    socket.on("disconnect", () => {
      const remainingConnections = (connectedUsers.get(userId) || 1) - 1;
      if (remainingConnections > 0) {
        connectedUsers.set(userId, remainingConnections);
      } else {
        connectedUsers.delete(userId);
        io.emit("presence_update", { user_id: userId, is_online: false });
        prisma.user
          .findUnique({
            where: { id: userId },
            select: { id: true, full_name: true, role: true },
          })
          .then((u) => {
            if (u) {
              io.to("admin").emit("admin:user_offline", {
                user: u,
                timestamp: Date.now(),
              });
            }
          })
          .catch(() => {});
      }
    });

    socket.on("join_room", async ({ swapRequestId }) => {
      try {
        const request = await prisma.swapRequest.findFirst({
          where: {
            id: swapRequestId,
            status: { in: ["ACCEPTED", "COMPLETED"] },
            OR: [{ sender_id: userId }, { receiver_id: userId }],
          },
        });
        if (!request) return;
        socket.join(`swap:${swapRequestId}`);
        await markSwapMessagesRead(io, request, userId);
      } catch (_error) {
        socket.emit("chat_error", { message: "Unable to join this chat." });
      }
    });

    socket.on("typing_start", ({ swapRequestId }) => {
      if (!swapRequestId) return;
      const room = `swap:${swapRequestId}`;
      if (socket.rooms.has(room)) {
        socket.to(room).emit("user_typing", {
          swap_request_id: String(swapRequestId),
          user_id: userId,
          is_typing: true,
        });
      }
    });

    socket.on("typing_stop", ({ swapRequestId }) => {
      if (!swapRequestId) return;
      const room = `swap:${swapRequestId}`;
      if (socket.rooms.has(room)) {
        socket.to(room).emit("user_typing", {
          swap_request_id: String(swapRequestId),
          user_id: userId,
          is_typing: false,
        });
      }
    });

    socket.on("send_message", async ({ swapRequestId, content }, callback) => {
      try {
        const clean = String(content || "").trim();
        if (!clean || clean.length > 2000)
          throw new Error("Message must be between 1 and 2000 characters.");
        const request = await prisma.swapRequest.findFirst({
          where: {
            id: swapRequestId,
            status: { in: ["ACCEPTED", "COMPLETED"] },
            OR: [{ sender_id: userId }, { receiver_id: userId }],
          },
          include: {
            sender: { select: { id: true, full_name: true } },
            receiver: { select: { id: true, full_name: true } },
          },
        });
        if (!request) throw new Error("Accepted swap access required.");
        const message = await prisma.message.create({
          data: {
            swap_request_id: swapRequestId,
            sender_id: userId,
            content: clean,
          },
          include: { sender: { select: senderSelect } },
        });
        const recipientId =
          request.sender_id === userId
            ? request.receiver_id
            : request.sender_id;
        const recipientOnline = connectedUsers.has(String(recipientId));
        const recipientInChat = userIsInRoom(
          io,
          `swap:${swapRequestId}`,
          recipientId,
        );
        if (recipientInChat) {
          await prisma.message.update({
            where: { id: message.id },
            data: { is_read: true },
          });
        }
        const messageForClients = {
          ...message,
          is_delivered: recipientOnline,
          is_read: recipientInChat,
        };
        io.to(`swap:${swapRequestId}`).emit("new_message", messageForClients);
        socket.to(`swap:${swapRequestId}`).emit("user_typing", {
          swap_request_id: String(swapRequestId),
          user_id: userId,
          is_typing: false,
        });
        io.to(`user:${userId}`).emit("message_delivered", {
          swap_request_id: swapRequestId,
          message_id: String(message.id),
          is_delivered: recipientOnline,
        });
        io.to(`user:${recipientId}`).emit("new_chat_message", { message: messageForClients });

        const senderName = message.sender?.full_name || "Member";
        const receiverName =
          String(request.sender_id) === String(userId)
            ? request.receiver?.full_name || "Member"
            : request.sender?.full_name || "Member";

        io.to("admin").emit("admin:message_sent", {
          message: {
            id: message.id,
            swap_request_id: swapRequestId,
            sender: { id: userId, full_name: senderName },
            receiver: { id: recipientId, full_name: receiverName },
            content_snippet: clean.length > 60 ? clean.slice(0, 60) + "..." : clean,
            sent_at: message.sent_at ? new Date(message.sent_at).getTime() : Date.now(),
          },
        });
        if (recipientInChat) {
          io.to(`user:${userId}`).emit("messages_read", {
            swap_request_id: swapRequestId,
            message_ids: [String(message.id)],
          });
        }
        if (!recipientInChat) {
          await createNotification(prisma, io, {
            userId: recipientId,
            type: "MESSAGE_RECEIVED",
            title: "New message",
            message: `${message.sender.full_name} sent you a message.`,
            referenceType: "swap",
            referenceId: swapRequestId,
          });
          const unreadCount = await prisma.message.count({
            where: {
              swap_request_id: swapRequestId,
              sender_id: { not: recipientId },
              is_read: false,
            },
          });
          io.to(`user:${recipientId}`).emit("message_unread_updated", {
            swap_request_id: String(swapRequestId),
            unread_count: unreadCount,
          });
        }

        if (callback) callback({ ok: true, message: messageForClients });
      } catch (error) {
        if (callback) callback({ ok: false, message: error.message });
      }
    });
  });
}

export default configureSocket;
