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

// 모듈 레벨 refresh — context 밖(소켓 연결 등)에서도 사용 가능
let _refreshPromise: Promise<string | null> | null = null;
export const getValidToken = async (): Promise<string | null> => {
  const token = localStorage.getItem("token");
  if (token && !isTokenExpiredRaw(token)) return token;

  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        return null;
      }
      const data = await res.json();
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      return data.accessToken;
    } catch { return null; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
};

const decodeToken = (token: string): { exp?: number; id?: number; username?: string; email?: string } | null => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""),
    ));
  } catch { return null; }
};

const isTokenExpiredRaw = (token: string): boolean => {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPromise = useRef<Promise<string | null> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 항상 최신 함수를 참조하기 위한 ref (이벤트 리스너에서 stale closure 방지)
  const silentRefreshRef = useRef<() => Promise<string | null>>(async () => null);
  const scheduleRefreshRef = useRef<() => void>(() => {});

  const clearSession = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  // 세션 만료: 알림 + 로그인 페이지로 이동
  const expireSession = () => {
    clearSession();
    if (window.location.pathname !== "/login") {
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
      window.location.replace("/login");
    }
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

  // access token을 refresh token으로 갱신, 새 access token 반환 (실패 시 null)
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
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return data.accessToken;
      } catch { return null; }
      finally { refreshPromise.current = null; }
    })();

    return refreshPromise.current;
  };

  // 만료 1분 전에 선제적으로 refresh 스케줄링
  const scheduleRefresh = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const token = localStorage.getItem("token");
    if (!token) return;
    const payload = decodeToken(token);
    if (!payload?.exp) return;
    const msUntilRefresh = Math.max(0, payload.exp * 1000 - Date.now() - 60 * 1000); // 만료 1분 전

    timerRef.current = setTimeout(async () => {
      const newToken = await silentRefreshRef.current();
      if (newToken) {
        scheduleRefreshRef.current(); // 새 토큰으로 다시 스케줄
      } else {
        expireSession();
      }
    }, msUntilRefresh);
  };

  // 최신 함수 ref 업데이트
  useEffect(() => { silentRefreshRef.current = silentRefresh; });
  useEffect(() => { scheduleRefreshRef.current = scheduleRefresh; });

  // 앱 로드 시 저장된 세션 복원
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser && !isTokenExpiredRaw(token)) {
      try { setUser(JSON.parse(savedUser)); }
      catch { clearSession(); setIsLoading(false); }
      setIsLoading(false);
    } else if (localStorage.getItem("refreshToken")) {
      silentRefresh().then((newToken) => {
        if (newToken) {
          fetch(`${API_URL}/user/me`, { headers: { Authorization: `Bearer ${newToken}` } })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data) {
                const userData: User = {
                  id: data.id, username: data.username, email: data.email,
                  balance: data.wallets?.[0]?.balance || "0", createdAt: data.createdAt,
                };
                localStorage.setItem("user", JSON.stringify(userData));
                setUser(userData);
              }
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
        } else {
          clearSession();
          setIsLoading(false);
        }
      });
    } else {
      clearSession();
      setIsLoading(false);
    }
  }, []);

  // user가 설정되면 refresh 타이머 스케줄
  useEffect(() => {
    if (user) scheduleRefresh();
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [user?.id]);

  // 탭 포커스 복귀 시 토큰 유효성 체크
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || !user) return;
      const token = localStorage.getItem("token");
      if (!token && !localStorage.getItem("refreshToken")) {
        // 다른 탭에서 로그아웃됨
        clearSession();
        return;
      }
      if (!token || isTokenExpiredRaw(token)) {
        const newToken = await silentRefreshRef.current();
        if (newToken) scheduleRefreshRef.current();
        else expireSession();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  // 다른 탭과 토큰/세션 상태 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token") {
        if (e.newValue) {
          // 다른 탭이 토큰 갱신 -> 타이머 재설정
          scheduleRefreshRef.current();
        } else {
          // 다른 탭이 로그아웃
          setUser(null);
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          if (window.location.pathname !== "/login") window.location.replace("/login");
        }
      }
      if (e.key === "user" && e.newValue) {
        try { setUser(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 인증이 필요한 fetch — 401 시 자동 refresh 후 1회 재시도
  const authFetch = useCallback(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    let token = localStorage.getItem("token");

    if (!token || isTokenExpiredRaw(token)) {
      token = await silentRefresh();
      if (!token) return new Response(null, { status: 401 });
    }

    const makeHeaders = (t: string) => ({ ...(init?.headers ?? {}), Authorization: `Bearer ${t}` });
    const res = await fetch(input, { ...init, headers: makeHeaders(token) });

    if (res.status === 401) {
      token = await silentRefresh();
      if (!token) return res;
      return fetch(input, { ...init, headers: makeHeaders(token) });
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
        id: decoded.id!, username: decoded.username!, email: decoded.email!,
        balance: 0, createdAt: undefined,
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
      if (res.status === 401) { expireSession(); return; }
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
