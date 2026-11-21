import axios from "axios";

const TOKEN_KEY = "skillswap_token";
const REFRESH_KEY = "skillswap_refresh_token";
const EXPIRY_KEY = "skillswap_token_expiry";
const REFRESH_BEFORE_EXPIRY_MS = 60_000;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

export function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function readRefreshToken(): string | null {
  return (
    localStorage.getItem(REFRESH_KEY) ||
    sessionStorage.getItem(REFRESH_KEY)
  );
}

export function readTokenExpiry(): number {
  const raw =
    sessionStorage.getItem(EXPIRY_KEY) || localStorage.getItem(EXPIRY_KEY);
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const token = readToken();
  if (token) {
    const payload = parseJwtPayload(token);
    if (payload?.exp) return payload.exp * 1000;
  }
  return 0;
}

export function isTokenExpired(bufferMs = REFRESH_BEFORE_EXPIRY_MS): boolean {
  const expiry = readTokenExpiry();
  if (!expiry) {
    const token = readToken();
    return !token;
  }
  return Date.now() >= expiry - bufferMs;
}

export function storeTokens(
  token: string,
  refreshToken: string | undefined,
  rememberMe: boolean,
) {
  clearTokens();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  if (refreshToken) storage.setItem(REFRESH_KEY, refreshToken);

  const payload = parseJwtPayload(token);
  if (payload?.exp) {
    storage.setItem(EXPIRY_KEY, String(payload.exp * 1000));
  }

  if (rememberMe) {
    localStorage.setItem("skillswap_remember_me", "1");
  } else {
    localStorage.removeItem("skillswap_remember_me");
  }
}

export function clearTokens() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(REFRESH_KEY);
    s.removeItem(EXPIRY_KEY);
    s.removeItem("skillswap_remember_me");
  });
}

let _refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  const refreshToken = readRefreshToken();
  const rememberMe = localStorage.getItem("skillswap_remember_me") === "1";

  _refreshPromise = refreshClient
    .post("/auth/refresh", {
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      remember_me: rememberMe,
    })
    .then(({ data }) => {
      const isRemembered =
        rememberMe || localStorage.getItem("skillswap_remember_me") === "1";
      storeTokens(data.token, data.refresh_token, isRemembered);
      return data.token as string;
    })
    .catch((err) => {
      const code = err?.response?.data?.code;
      if (code === "REFRESH_REUSE") {
        window.dispatchEvent(
          new CustomEvent("skillswap:session-expired", {
            detail: {
              message:
                "Your session was terminated for security reasons. Please sign in again.",
            },
          }),
        );
      } else {
        window.dispatchEvent(new Event("skillswap:session-expired"));
      }
      clearTokens();
      return null;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

api.interceptors.request.use(async (config) => {
  if (config.url?.includes("/auth/refresh")) return config;

  const refreshToken = readRefreshToken();
  const isRemembered = localStorage.getItem("skillswap_remember_me") === "1";

  if (isTokenExpired() && (refreshToken || isRemembered)) {
    await refreshAccessToken();
  }

  const token = readToken();
  if (token) {
    if (config.headers?.set) {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      original.url?.includes("/auth/refresh") ||
      original.url?.includes("/auth/login")
    ) {
      return Promise.reject(error);
    }

    const refreshToken = readRefreshToken();
    const isRemembered = localStorage.getItem("skillswap_remember_me") === "1";

    if (!refreshToken && !isRemembered) {
      return Promise.reject(error);
    }

    original._retry = true;
    const newToken = await refreshAccessToken();
    if (!newToken) return Promise.reject(error);

    if (original.headers?.set) {
      original.headers.set("Authorization", `Bearer ${newToken}`);
    } else {
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
    }
    return api(original);
  },
);
