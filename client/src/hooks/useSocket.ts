import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { refreshAccessToken } from "../lib/api";

const TOKEN_KEY = "skillswap_token";

function readToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function createSocket(): Socket {
  const socket = io(
    import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
    {
      autoConnect: false,
      auth: { token: readToken() },
    },
  );
  socket.on("connect_error", async (error) => {
    const auth = socket.auth as { refreshing?: boolean };
    if (
      !/invalid|expired|authentication/i.test(error.message) ||
      auth.refreshing
    )
      return;
    auth.refreshing = true;
    const token = await refreshAccessToken();
    auth.refreshing = false;
    if (token) {
      socket.auth = { token };
      socket.connect();
    }
  });
  return socket;
}

export function usePresence(): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = readToken();
    if (!token) return undefined;

    const socket = createSocket();
    const handleSnapshot = ({ user_ids }: { user_ids?: string[] }) => {
      setOnlineUserIds(new Set((user_ids || []).map(String)));
    };
    const handleUpdate = ({
      user_id,
      is_online,
    }: {
      user_id?: string;
      is_online?: boolean;
    }) => {
      if (!user_id) return;
      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (is_online) next.add(String(user_id));
        else next.delete(String(user_id));
        return next;
      });
    };

    socket.on("presence_snapshot", handleSnapshot);
    socket.on("presence_update", handleUpdate);
    socket.connect();

    return () => {
      socket.off("presence_snapshot", handleSnapshot);
      socket.off("presence_update", handleUpdate);
      socket.disconnect();
      setOnlineUserIds(new Set());
    };
  }, []);

  return onlineUserIds;
}
