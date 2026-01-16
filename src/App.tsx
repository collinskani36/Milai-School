import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminPanel from "./pages/AdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import Index from "./pages/Index";
import StudentAuth from "./Components/StudentAuth";
import TeacherAuth from "./Components/TeacherAuth";

import StudentForgotPassword from "./pages/StudentForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TeacherForgotPassword from "./pages/TeacherForgotPassword";

const queryClient = new QueryClient();

function AppRoutes() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // -------------------------
  // Check if logged-in teacher is admin
  // -------------------------
  const checkIfAdmin = async (authId: string) => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("is_admin")
        .eq("auth_id", authId)
        .maybeSingle();

      setIsAdmin(!error && data?.is_admin === true);
    } catch (err) {
      console.warn("checkIfAdmin failed:", err);
      setIsAdmin(false);
    }
  };

  // -------------------------
  // Initial session + listener
  // -------------------------
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          await checkIfAdmin(sessionUser.id);
        }
      } catch (err) {
        console.warn("getSession failed:", err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: listenerData } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          await checkIfAdmin(sessionUser.id);
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => {
      listenerData.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <p>Loading...</p>;

  // -------------------------
  // Logout handler (FIXED)
  // -------------------------
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setUser(null);
      setIsAdmin(false);

      const path = window.location.pathname;

      if (path.startsWith("/teacher") || path.startsWith("/admin")) {
        navigate("/teacher-login", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    }
  };

  // -------------------------
  // Routes
  // -------------------------
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Index />} />

      {/* Student login */}
      <Route
        path="/login"
        element={
          user ? (
            isAdmin ? (
              <Navigate to="/admin-dashboard" replace />
            ) : (
              <Navigate to="/student-dashboard" replace />
            )
          ) : (
            <StudentAuth />
          )
        }
      />

      {/* Student forgot password */}
      <Route path="/forgot-password" element={<StudentForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      

      {/* Teacher login */}
      <Route
        path="/teacher-login"
        element={
          user ? (
            isAdmin ? (
              <Navigate to="/admin-dashboard" replace />
            ) : (
              <Navigate to="/teacher-dashboard" replace />
            )
          ) : (
            <TeacherAuth />
          )
        }
      />

      {/* Teacher forgot password */}
      <Route
        path="/teacher-forgot-password"
        element={<TeacherForgotPassword />}
      />

      {/* Student dashboard */}
      <Route
        path="/student-dashboard"
        element={
          user ? (
            isAdmin ? (
              <Navigate to="/admin-dashboard" replace />
            ) : (
              <StudentDashboard handleLogout={handleLogout} />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Teacher dashboard */}
      <Route
        path="/teacher-dashboard"
        element={
          user ? (
            isAdmin ? (
              <Navigate to="/admin-dashboard" replace />
            ) : (
              <TeacherDashboard handleLogout={handleLogout} />
            )
          ) : (
            <Navigate to="/teacher-login" replace />
          )
        }
      />

      {/* Admin dashboard */}
      <Route
        path="/admin-dashboard"
        element={
          user && isAdmin ? (
            <AdminPanel handleLogout={handleLogout} />
          ) : (
            <Navigate to="/teacher-login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}