import prisma from "../config/db.js";
import { publicUser } from "../utils.js";
import { createNotification } from "../utils.js";

const userInclude = {
  skills: { include: { skill: { include: { category: true } } } },
  reviews_received: { select: { rating: true } },
};
const requestInclude = {
  sender: { include: userInclude },
  receiver: { include: userInclude },
  reviews: true,
};
const messageSenderSelect = { id: true, full_name: true };

function serializeRequest(request) {
  return {
    ...request,
    sender: publicUser(request.sender),
    receiver: publicUser(request.receiver),
  };
}

async function listSwaps(req, res, next) {
  try {
    const requests = await prisma.swapRequest.findMany({
      where: {
        OR: [{ sender_id: req.user.id }, { receiver_id: req.user.id }],
        status: { not: "CANCELLED" },
      },
      include: requestInclude,
      orderBy: { created_at: "desc" },
    });

    const completedPartnerIds = new Set(
      requests
        .filter((r) => r.status === "COMPLETED")
        .map((r) => (r.sender_id === req.user.id ? r.receiver_id : r.sender_id)),
    );

    const validRequests = requests.filter((r) => {
      if (r.status === "PENDING") {
        const partnerId =
          r.sender_id === req.user.id ? r.receiver_id : r.sender_id;
        return !completedPartnerIds.has(partnerId);
      }
      return true;
    });
    const unreadRows = validRequests.length
      ? await prisma.message.groupBy({
          by: ["swap_request_id"],
          where: {
            swap_request_id: { in: validRequests.map((request) => request.id) },
            sender_id: { not: req.user.id },
            is_read: false,
          },
          _count: { _all: true },
        })
      : [];
    const unreadByRequest = new Map(
      unreadRows.map((row) => [row.swap_request_id, row._count._all]),
    );
    res.json({
      requests: validRequests.map((request) => ({
        ...serializeRequest(request),
        unread_count: unreadByRequest.get(request.id) || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function createSwap(req, res, next) {
  try {
    const { receiver_id, message } = req.body;
    if (!receiver_id || receiver_id === req.user.id)
      return res
        .status(400)
        .json({ message: "A different receiver is required." });
    const receiver = await prisma.user.findUnique({
      where: { id: receiver_id },
    });
    if (!receiver || !receiver.is_active || !receiver.is_verified)
      return res.status(404).json({ message: "Receiver not found or account is not active." });
    const completed = await prisma.swapRequest.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id },
          { sender_id: receiver_id, receiver_id: req.user.id },
        ],
        status: "COMPLETED",
      },
    });
    if (completed)
      return res.status(409).json({
        message: "You have already completed a skill swap with this user.",
      });

    const existing = await prisma.swapRequest.findFirst({
      where: {
        OR: [
          { sender_id: req.user.id, receiver_id },
          { sender_id: receiver_id, receiver_id: req.user.id },
        ],
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    });
    if (existing)
      return res.status(409).json({
        message: "An active request already exists between these users.",
      });
    const request = await prisma.swapRequest.create({
      data: {
        sender_id: req.user.id,
        receiver_id,
        message: message ? String(message).trim().slice(0, 500) : null,
      },
      include: requestInclude,
    });
    await createNotification(prisma, req.app.get("io"), {
      userId: receiver_id,
      type: "SWAP_REQUEST",
      title: "New swap request",
      message: `${req.user.full_name} sent you a skill exchange request.`,
      referenceType: "swap",
      referenceId: request.id,
    });
    const io = req.app.get("io");
    if (io) {
      const serialized = serializeRequest(request);
      io.to(`user:${receiver_id}`).emit("swap_request_created", { request: serialized });
      io.to(`user:${req.user.id}`).emit("swap_request_created", { request: serialized });
      io.to("admin").emit("admin:swap_created", { request: serialized });
    }
    res.status(201).json({ request: serializeRequest(request) });
  } catch (error) {
    next(error);
  }
}

async function updateSwap(req, res, next) {
  try {
    const status = String(req.body.status || "").toUpperCase();
    if (!["ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"].includes(status))
      return res.status(400).json({
        message: "Status must be ACCEPTED, REJECTED, CANCELLED, or COMPLETED.",
      });
    const existing = await prisma.swapRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!existing)
      return res.status(404).json({ message: "Swap request not found." });
    const isSender = existing.sender_id === req.user.id;
    const isReceiver = existing.receiver_id === req.user.id;
    if (!isSender && !isReceiver)
      return res
        .status(403)
        .json({ message: "Only swap participants can update this request." });
    if (status === "CANCELLED" && (!isSender || existing.status !== "PENDING"))
      return res
        .status(403)
        .json({ message: "Only the sender can cancel a pending request." });
    if (
      ["ACCEPTED", "REJECTED"].includes(status) &&
      (!isReceiver || existing.status !== "PENDING")
    )
      return res.status(403).json({
        message: "Only the receiver can accept or reject a pending request.",
      });
    if (status === "COMPLETED" && existing.status !== "ACCEPTED")
      return res
        .status(403)
        .json({ message: "Only an accepted swap can be marked completed." });
    if (status === "CANCELLED") {
      await prisma.notification.deleteMany({
        where: {
          reference_id: existing.id,
          type: "SWAP_REQUEST",
        },
      });
    }
    if (status === "COMPLETED") {
      const otherSwaps = await prisma.swapRequest.findMany({
        where: {
          id: { not: existing.id },
          OR: [
            { sender_id: existing.sender_id, receiver_id: existing.receiver_id },
            { sender_id: existing.receiver_id, receiver_id: existing.sender_id },
          ],
          status: { in: ["PENDING", "ACCEPTED"] },
        },
      });

      for (const other of otherSwaps) {
        await prisma.notification.deleteMany({
          where: { reference_id: other.id },
        });
        await prisma.swapRequest.delete({
          where: { id: other.id },
        });
      }
    }
    const request = await prisma.swapRequest.update({
      where: { id: existing.id },
      data: {
        status,
        completed_at:
          status === "COMPLETED" ? new Date() : existing.completed_at,
      },
      include: requestInclude,
    });
    const targetUserId = isSender ? existing.receiver_id : existing.sender_id;
    const eventCopy = {
      ACCEPTED: [
        "SWAP_ACCEPTED",
        "Swap request accepted",
        `${req.user.full_name} accepted your skill exchange request.`,
      ],
      REJECTED: [
        "SWAP_REJECTED",
        "Swap request rejected",
        `${req.user.full_name} rejected your skill exchange request.`,
      ],
      CANCELLED: [
        "SWAP_CANCELLED",
        "Swap request cancelled",
        `${req.user.full_name} cancelled the skill exchange request.`,
      ],
      COMPLETED: [
        "SWAP_COMPLETED",
        "Swap marked complete",
        `${req.user.full_name} marked the skill exchange complete.`,
      ],
    }[status];
    if (status !== "CANCELLED") {
      await createNotification(prisma, req.app.get("io"), {
        userId: targetUserId,
        type: eventCopy[0],
        title: eventCopy[1],
        message: eventCopy[2],
        referenceType: "swap",
        referenceId: request.id,
      });
    }
    const io = req.app.get("io");
    const statusEvent = {
      request_id: String(request.id),
      status,
      actor_id: String(req.user.id),
      request: serializeRequest(request),
    };
    if (io) {
      io.to(`user:${existing.sender_id}`).emit(
        "swap_status_updated",
        statusEvent,
      );
      io.to(`user:${existing.receiver_id}`).emit(
        "swap_status_updated",
        statusEvent,
      );
    }
    io.to("admin").emit("admin:swap_updated", {
      request: serializeRequest(request),
      status,
      actor_id: String(req.user.id),
    });
    res.json({ request: serializeRequest(request) });
  } catch (error) {
    next(error);
  }
}

async function getMessages(req, res, next) {
  try {
    const request = await prisma.swapRequest.findFirst({
      where: {
        id: req.params.id,
        OR: [{ sender_id: req.user.id }, { receiver_id: req.user.id }],
        status: { in: ["ACCEPTED", "COMPLETED"] },
      },
    });
    if (!request)
      return res
        .status(403)
        .json({ message: "Accepted swap access required." });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    const messages = await prisma.message.findMany({
      where: {
        swap_request_id: request.id,
        ...(before && !Number.isNaN(before.getTime())
          ? { sent_at: { lt: before } }
          : {}),
      },
      include: { sender: { select: messageSenderSelect } },
      orderBy: { sent_at: before ? "desc" : "asc" },
      take: limit,
    });
    const pageIds = messages.map((m) => m.id);
    const unreadMessages = await prisma.message.findMany({
      where: {
        id: { in: pageIds },
        sender_id: { not: req.user.id },
        is_read: false,
      },
      select: { id: true },
    });
    await prisma.message.updateMany({
      where: {
        id: { in: pageIds },
        sender_id: { not: req.user.id },
        is_read: false,
      },
      data: { is_read: true },
    });
    if (unreadMessages.length) {
      const messageSenderId =
        request.sender_id === req.user.id
          ? request.receiver_id
          : request.sender_id;
      req.app
        .get("io")
        ?.to(`user:${messageSenderId}`)
        .emit("messages_read", {
          swap_request_id: request.id,
          message_ids: unreadMessages.map(({ id }) => String(id)),
        });
    }
    res.json({ messages: before ? messages.reverse() : messages });
  } catch (error) {
    next(error);
  }
}

export { listSwaps, createSwap, updateSwap, getMessages };
