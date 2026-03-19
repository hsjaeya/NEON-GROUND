import "./App.css";
import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/Authcontext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Resister";
import MakeMoney from "./pages/Makemoney";
import Roulette from "./pages/Roulette";

// import other game pages...

// Protected Route Component
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

// Public Route Component - redirect to home if already logged in
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
          {/* Home - shows Landing if not logged in, Home if logged in */}
          <Route path="/" element={<Home />} />

          {/* Auth Routes */}
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

          {/* Protected Game Routes - uncomment as you add games */}
          {/* 
          <Route
            path="/blackJack"
            element={
              <ProtectedRoute>
                <BlackJack />
              </ProtectedRoute>
            }
          />

          <Route
            path="/slotMachine"
            element={
              <ProtectedRoute>
                <SlotMachine />
              </ProtectedRoute>
            }
          />
          */}
          <Route
            path="/makeMoney"
            element={
              <ProtectedRoute>
                <MakeMoney />
              </ProtectedRoute>
            }
          />
          {/* 
          <Route
            path="/donate"
            element={
              <ProtectedRoute>
                <Donate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setting"
            element={
              <ProtectedRoute>
                <Setting />
              </ProtectedRoute>
            }
          />
          */}

          {/* 404 Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
