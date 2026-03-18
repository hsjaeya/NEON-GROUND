import React, { createContext, useState, useContext, useEffect } from "react";
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

// JWT 토큰 디코딩 함수
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
  } catch (error) {
    console.error("Token decode error:", error);
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 앱 로드 시 로컬스토리지에서 사용자 정보 복원
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
    setIsLoading(false);
  }, []);

  const register = async (
    username: string,
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "회원가입 실패");
      }

      const data = await response.json();

      // 회원가입 응답에서 user 정보 추출
      const userData: User = {
        id: data.id,
        username: data.username,
        email: data.email,
        balance: data.wallets?.[0]?.balance || 0,
        createdAt: data.createdAt,
      };

      // 로그인 API 호출해서 토큰 받기
      const loginResponse = await fetch("http://localhost:3000/auth/login", {
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

      // 회원가입 후 최신 정보 자동 갱신
      setTimeout(async () => {
        try {
          const userResponse = await fetch("http://localhost:3000/user/me", {
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
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "로그인 실패");
      }

      const data = await response.json();

      // JWT 토큰에서 user 정보 추출
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

      // 로그인 후 최신 정보 자동 갱신
      setTimeout(async () => {
        try {
          const userResponse = await fetch("http://localhost:3000/user/me", {
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

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  const refreshUser = async (): Promise<void> => {
    const token = localStorage.getItem("token");
    if (!token || !user) {
      setError("No token or user found");
      return;
    }

    try {
      console.log("Refreshing user info...");
      const response = await fetch("http://localhost:3000/user/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("User data received:", data);

      const userData: User = {
        id: data.id,
        username: data.username,
        email: data.email,
        balance: data.wallets?.[0]?.balance || "0",
        createdAt: data.createdAt,
      };

      console.log("Updated user:", userData);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "사용자 정보 갱신 실패";
      console.error("Refresh error:", errorMessage);
      setError(errorMessage);
    }
  };

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
