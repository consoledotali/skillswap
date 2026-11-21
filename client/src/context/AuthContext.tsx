import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  storeTokens,
  clearTokens,
  refreshAccessToken,
  isTokenExpired,
  readToken,
  readRefreshToken,
} from "../lib/api";
import { createSocket } from "../hooks/useSocket";

export type SkillRow = {
  id: string;
  skill_type: "TEACH" | "LEARN";
  proficiency_level?: string;
  skill: { id: string; name: string; category: { id: string; name: string } };
};
export type User = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  location?: string | null;
  bio?: string | null;
  role?: "USER" | "ADMIN";
  is_verified: boolean;
  is_active: boolean;
  proficiency_level?: string;
  created_at?: string;
  skills?: SkillRow[];
  average_rating?: number;
  review_count?: number;
};
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  register: (
    full_name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  completeOAuth: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshUser = async () => {
    const token = readToken();
    const hasRefresh = readRefreshToken();
    const isRemembered = localStorage.getItem("skillswap_remember_me") === "1";

    if (!token && !hasRefresh && !isRemembered) {
      setLoading(false);
      return;
    }

    if (!token || isTokenExpired()) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        setLoading(false);
        return;
      }
    }

    try {
      const response = await api.get("/auth/me");
      setUser(response.data.user);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const expire = (e: Event) => {
      clearTokens();
      setUser(null);
      const detail = (e as CustomEvent)?.detail;
      setError(
        detail?.message || "Your session expired. Please sign in again.",
      );
    };
    window.addEventListener("skillswap:session-expired", expire);
    void refreshUser();
    return () =>
      window.removeEventListener("skillswap:session-expired", expire);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const socket = createSocket();
    socket.on("account_suspended", (data: { message?: string }) => {
      clearTokens();
      setUser(null);
      setError(data?.message || "Your account has been suspended by an administrator.");
    });
    socket.connect();
    return () => {
      socket.off("account_suspended");
      socket.disconnect();
    };
  }, [user?.id]);

  const login = async (email: string, password: string, rememberMe = false) => {
    setError("");
    try {
      const response = await api.post("/auth/login", {
        email,
        password,
        remember_me: rememberMe,
      });
      storeTokens(response.data.token, response.data.refresh_token, rememberMe);
      setUser(response.data.user);
    } catch (e: any) {
      setError(e.response?.data?.message || "Unable to log in.");
      throw e;
    }
  };

  const register = async (
    full_name: string,
    email: string,
    password: string,
  ) => {
    setError("");
    try {
      const response = await api.post("/auth/register", {
        full_name,
        email,
        password,
      });
      if (response.data.verification_required) {
        clearTokens();
        setUser(null);
        return;
      }
      storeTokens(response.data.token, response.data.refresh_token, false);
      setUser(response.data.user);
    } catch (e: any) {
      setError(e.response?.data?.message || "Unable to register.");
      throw e;
    }
  };

  const completeOAuth = async (code: string) => {
    setError("");
    try {
      const response = await api.post("/auth/oauth/exchange", { code });
      storeTokens(response.data.token, response.data.refresh_token, true);
      const meResponse = await api.get("/auth/me");
      setUser(meResponse.data.user);
    } catch (e: any) {
      clearTokens();
      setUser(null);
      setError(
        e.response?.data?.message || "Unable to complete social sign in.",
      );
      throw e;
    }
  };

  const logout = async () => {
    const refreshToken = readRefreshToken();
    try {
      await api.post("/auth/logout", { refresh_token: refreshToken });
    } catch {
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await api.post("/auth/logout-all");
    } catch {
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/profile/me");
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      register,
      completeOAuth,
      logout,
      logoutAll,
      deleteAccount,
      refreshUser,
      clearError: () => setError(""),
    }),
    [user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
