import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
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
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_URL = import.meta.env.VITE_API_URL;

const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  // 앱 로드 시 토큰 유효성 확인 후 사용자 정보 복원
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      if (isTokenExpired(savedToken)) {
        logout();
      } else {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          logout();
        }
      }
    }
    setIsLoading(false);
  }, []);

  // 토큰 만료 자동 감지 타이머
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !user) return;

    const payload = decodeToken(token);
    if (!payload?.exp) return;

    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      logout();
    }, msUntilExpiry);

    return () => clearTimeout(timer);
  }, [user]);

  const handleResponse = async (response: Response) => {
    if (response.status === 401) {
      logout();
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
    }
    return response;
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
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
        id: data.id,
        username: data.username,
        email: data.email,
        balance: data.wallets?.[0]?.balance || 0,
        createdAt: data.createdAt,
      };

      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        throw new Error("자동 로그인 실패");
      }

      const loginData = await loginResponse.json();
      localStorage.setItem("token", loginData.accessToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      setTimeout(async () => {
        try {
          const userResponse = await fetch(`${API_URL}/user/me`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${loginData.accessToken}`,
            },
          });

          if (userResponse.ok) {
            const freshData = await userResponse.json();
            const freshUserData: User = {
              id: freshData.id,
              username: freshData.username,
              email: freshData.email,
              balance: freshData.wallets?.[0]?.balance || "0",
              createdAt: freshData.createdAt,
            };
            localStorage.setItem("user", JSON.stringify(freshUserData));
            setUser(freshUserData);
          }
        } catch (err) {
          console.error("Auto refresh after register failed:", err);
        }
      }, 500);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "회원가입 실패";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
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

      const decodedToken = decodeToken(data.accessToken);
      if (!decodedToken) {
        throw new Error("토큰 디코딩 실패");
      }

      const userData: User = {
        id: decodedToken.id,
        username: decodedToken.username,
        email: decodedToken.email,
        balance: decodedToken.balance || 0,
        createdAt: decodedToken.createdAt,
      };

      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      setTimeout(async () => {
        try {
          const userResponse = await fetch(`${API_URL}/user/me`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.accessToken}`,
            },
          });

          if (userResponse.ok) {
            const freshData = await userResponse.json();
            const freshUserData: User = {
              id: freshData.id,
              username: freshData.username,
              email: freshData.email,
              balance: freshData.wallets?.[0]?.balance || "0",
              createdAt: freshData.createdAt,
            };
            localStorage.setItem("user", JSON.stringify(freshUserData));
            setUser(freshUserData);
          }
        } catch (err) {
          console.error("Auto refresh after login failed:", err);
        }
      }, 500);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "로그인 실패";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const refreshUser = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem("token");
    if (!token || !user) return;

    if (isTokenExpired(token)) {
      logout();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      await handleResponse(response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      const userData: User = {
        id: data.id,
        username: data.username,
        email: data.email,
        balance: data.wallets?.[0]?.balance || "0",
        createdAt: data.createdAt,
      };

      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "사용자 정보 갱신 실패";
      setError(errorMessage);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    register,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
