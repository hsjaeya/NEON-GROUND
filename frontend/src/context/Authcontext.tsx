import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";

interface User {
  id: number;
  username: string;
  email: string;
  balance?: number | string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL;

const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""),
    ));
  } catch { return null; }
};

const isTokenExpired = (token: string): boolean => {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 동시 refresh 요청 방지용
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {}
    clearSession();
  };

  // 앱 로드 시 저장된 세션 복원
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser && !isTokenExpired(token)) {
      try { setUser(JSON.parse(savedUser)); } catch { clearSession(); }
    } else if (localStorage.getItem("refreshToken")) {
      // access token 만료됐지만 refresh token 있으면 조용히 갱신
      silentRefresh().finally(() => setIsLoading(false));
      return;
    } else {
      clearSession();
    }
    setIsLoading(false);
  }, []);

  // access token을 refresh token으로 갱신, 새 access token 반환
  const silentRefresh = async (): Promise<string | null> => {
    if (refreshPromise.current) return refreshPromise.current;

    refreshPromise.current = (async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return null;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) { clearSession(); return null; }
        const data = await res.json();
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return data.accessToken;
      } catch { clearSession(); return null; }
      finally { refreshPromise.current = null; }
    })();

    return refreshPromise.current;
  };

  // 인증이 필요한 모든 fetch에 사용 — 401 시 자동 refresh 후 재시도
  const authFetch = useCallback(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    let token = localStorage.getItem("token");

    if (!token || isTokenExpired(token)) {
      token = await silentRefresh();
      if (!token) return new Response(null, { status: 401 });
    }

    const headers = { ...(init?.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(input, { ...init, headers });

    if (res.status === 401) {
      token = await silentRefresh();
      if (!token) return res;
      const retryHeaders = { ...(init?.headers || {}), Authorization: `Bearer ${token}` };
      return fetch(input, { ...init, headers: retryHeaders });
    }

    return res;
  }, []);

  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "회원가입 실패");
      }
      const data = await response.json();
      const userData: User = {
        id: data.id, username: data.username, email: data.email,
        balance: data.wallets?.[0]?.balance || 0, createdAt: data.createdAt,
      };

      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginResponse.ok) throw new Error("자동 로그인 실패");
      const loginData = await loginResponse.json();

      localStorage.setItem("token", loginData.accessToken);
      localStorage.setItem("refreshToken", loginData.refreshToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "회원가입 실패";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "로그인 실패");
      }
      const data = await response.json();
      const decoded = decodeToken(data.accessToken);
      if (!decoded) throw new Error("토큰 디코딩 실패");

      const userData: User = {
        id: decoded.id, username: decoded.username, email: decoded.email,
        balance: decoded.balance || 0, createdAt: decoded.createdAt,
      };

      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      // 로그인 직후 최신 잔액 동기화
      setTimeout(async () => {
        try {
          const res = await authFetch(`${API_URL}/user/me`);
          if (res.ok) {
            const fresh = await res.json();
            const freshUser: User = {
              id: fresh.id, username: fresh.username, email: fresh.email,
              balance: fresh.wallets?.[0]?.balance || "0", createdAt: fresh.createdAt,
            };
            localStorage.setItem("user", JSON.stringify(freshUser));
            setUser(freshUser);
          }
        } catch {}
      }, 500);

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인 실패";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const res = await authFetch(`${API_URL}/user/me`);
      if (res.status === 401) { await logout(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const userData: User = {
        id: data.id, username: data.username, email: data.email,
        balance: data.wallets?.[0]?.balance || "0", createdAt: data.createdAt,
      };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 정보 갱신 실패");
    }
  }, [user, authFetch]);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, register, login, logout, refreshUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
