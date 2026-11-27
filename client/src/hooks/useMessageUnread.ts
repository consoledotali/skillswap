import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { createSocket } from "./useSocket";

export function useMessageUnread(userId?: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let disposed = false;
    const load = async () => {
      try {
        const response = await api.get("/swaps");
        if (!disposed)
          setUnreadCount(
            (response.data.requests || []).reduce(
              (total: number, request: any) =>
                total + Number(request.unread_count || 0),
              0,
            ),
          );
      } catch {
      }
    };
    void load();
    const socket = createSocket();
    const refresh = () => void load();
    socket.on("notification", refresh);
    socket.on("message_unread_updated", refresh);
    socket.on("unread_messages_cleared", refresh);
    socket.connect();
    return () => {
      disposed = true;
      socket.off("notification", refresh);
      socket.off("message_unread_updated", refresh);
      socket.off("unread_messages_cleared", refresh);
      socket.disconnect();
    };
  }, [userId]);

  return unreadCount;
}
