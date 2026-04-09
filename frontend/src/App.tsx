import "./App.css";
import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider, useAuth } from "./context/Authcontext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Resister";
import Roulette from "./pages/Roulette";
import Blackjack from "./pages/Blackjack";
import PokerLobby from "./pages/PokerLobby";
import Ranking from "./pages/Ranking";
import Profile from "./pages/Profile";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#050a0f",
          color: "#00ffc8",
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "14px",
          letterSpacing: "2px",
        }}
      >
        INITIALIZING...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

interface PublicRouteProps {
  children: ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App(): React.ReactElement {
  return (
    <AuthProvider>
      <div className="App">
        <Routes>
            <Route path="/" element={<Home />} />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          <Route
            path="/roulette"
            element={
              <ProtectedRoute>
                <Roulette />
              </ProtectedRoute>
            }
          />

          <Route
            path="/blackJack"
            element={
              <ProtectedRoute>
                <Blackjack />
              </ProtectedRoute>
            }
          />

          <Route
            path="/poker"
            element={
              <ProtectedRoute>
                <PokerLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ranking"
            element={
              <ProtectedRoute>
                <Ranking />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SpeedInsights />
      </div>
    </AuthProvider>
  );
}

export default App;
