import { useEffect, useState, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminDashboard from "./pages/AdminDashboard";
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
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  // isAdmin is tri-state: null = unknown (still checking), true, false
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // logoutOrigin captures where logout was initiated so the post-logout redirect is deterministic
  // 'teacher' => redirect to /teacher-login, 'student' => redirect to /login
  const [logoutOrigin, setLogoutOrigin] = useState<"teacher" | "student" | null>(
    null
  );

  // used to defer auth state changes that come from other tabs while this tab is hidden
  const pendingAuthUpdate = useRef<{ event: string; sessionUser: any } | null>(
    null
  );

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

      if (error) {
        console.warn("Admin check error:", error);
        setIsAdmin(false);
        return false;
      }

      const adminStatus = data?.is_admin === true;
      setIsAdmin(adminStatus);
      return adminStatus;
    } catch (err) {
      console.warn("checkIfAdmin failed:", err);
      setIsAdmin(false);
      return false;
    }
  };

  // -------------------------
  // Initial session + listener (run once on mount)
  // - Debounce/apply auth updates only when tab is visible to avoid reacting to
  //   cross-tab events while user is in another tab.
  // -------------------------
  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          if (mounted) {
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        const sessionUser = data?.session?.user ?? null;

        if (sessionUser) {
          if (mounted) {
            setUser(sessionUser);
            // don't set isAdmin here; we'll check based on route in the other effect
          }
        } else {
          if (mounted) {
            setUser(null);
            setIsAdmin(false);
          }
        }
      } catch (err) {
        console.error("getSession failed:", err);
        if (mounted) {
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    getSession();

    // Visibility handler: apply pending auth update when tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingAuthUpdate.current) {
        const { event, sessionUser } = pendingAuthUpdate.current;
        pendingAuthUpdate.current = null;
        // Apply update now that user is back to the tab
        if (event === "SIGNED_OUT") {
          setUser(null);
          setIsAdmin(false);
        } else if (sessionUser) {
          setUser(sessionUser);
          // do not immediately run checkIfAdmin here; the other effect watching location/user will run it
        }
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);

    const { data: listenerData } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const sessionUser = session?.user ?? null;

        // If the tab is visible apply changes immediately, otherwise defer them
        if (document.visibilityState === "visible") {
          if (event === "SIGNED_OUT") {
            setUser(null);
            setIsAdmin(false);
          } else if (sessionUser) {
            setUser(sessionUser);
            // admin check moved to separate effect that watches location/user
          }
        } else {
          // Defer applying auth updates until the user returns to this tab.
          pendingAuthUpdate.current = { event, sessionUser };
        }
      }
    );

    return () => {
      mounted = false;
      window.removeEventListener("visibilitychange", onVisibilityChange);
      try {
        listenerData?.subscription?.unsubscribe?.();
      } catch (e) {
        // no-op
      }
    };
    // run only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // When location or user changes, ensure admin flag is set if on teacher/admin pages
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    const ensureAdmin = async () => {
      if (
        user &&
        (location.pathname.includes("teacher") || location.pathname.includes("admin"))
      ) {
        // mark unknown while checking so routes don't prematurely redirect
        setIsAdmin(null);
        await checkIfAdmin(user.id);
      } else {
        // If user is present but not on teacher/admin route, reset to false to be safe
        setIsAdmin(false);
      }
    };

    ensureAdmin();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, user]);

  // Separate effect to handle redirects after auth state is determined
  useEffect(() => {
    if (!loading) {
      // If no user and we're on a protected route, redirect to login
      if (!user) {
        // If logoutOrigin exists (set at logout click), prefer that route — this avoids race conditions
        if (logoutOrigin) {
          if (logoutOrigin === "student") {
            navigate("/login", { replace: true });
          } else {
            navigate("/teacher-login", { replace: true });
          }
          setLogoutOrigin(null);
        } else {
          // Only redirect when the current path is a protected dashboard path.
          // DO NOT perform an unconditional fallback redirect — this prevented public pages (/) from being accessible.
          if (location.pathname.startsWith("/student-dashboard")) {
            navigate("/login", { replace: true });
          } else if (
            location.pathname.startsWith("/teacher-dashboard") ||
            location.pathname.startsWith("/admin-dashboard")
          ) {
            navigate("/teacher-login", { replace: true });
          } // else: on public routes (/, /login, /teacher-login, forgot-password, etc.) do nothing
        }
      } else {
        // If user is logged-in and on a login page, redirect to the appropriate dashboard
        if (location.pathname === "/login") {
          navigate("/student-dashboard", { replace: true });
        } else if (location.pathname === "/teacher-login") {
          // wait for admin check to complete before deciding where to send teacher login requests
          if (isAdmin === null) {
            // don't redirect yet
            return;
          }
          if (isAdmin) {
            navigate("/admin-dashboard", { replace: true });
          } else {
            navigate("/teacher-dashboard", { replace: true });
          }
        }
      }
    }
  }, [loading, user, isAdmin, location.pathname, navigate, logoutOrigin]);

  // If we're on a teacher/admin route and admin state is still unknown, render a minimal loader
  // (No debug panel to avoid a flash of debug UI.)
  if (
    !loading &&
    user &&
    (location.pathname.includes("teacher") || location.pathname.includes("admin")) &&
    isAdmin === null
  ) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  // Global loading UI while we determine session (prevents flicker/white screen)
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  // -------------------------
  // Logout handler (used by Student and Teacher dashboards only)
  // -------------------------
  const handleLogout = async () => {
    try {
      // Capture the logout origin at the moment of the click to avoid races:
      // if started on a teacher/admin page, consider it a teacher logout.
      const path = location.pathname;
      const wasTeacherOrAdmin = path.startsWith("/teacher") || path.startsWith("/admin");
      setLogoutOrigin(wasTeacherOrAdmin ? "teacher" : "student");

      // Now sign out. The onAuthStateChange listener will also update user state; we optimistically clear here too.
      await supabase.auth.signOut();
      setUser(null);
      setIsAdmin(false);

      // We rely on the redirect effect (above) to navigate after sign-out so behavior is deterministic.
    } catch (err) {
      console.warn("Logout error:", err);
    }
  };

  // -------------------------
  // Route guards
  // -------------------------
  const StudentRoute = ({ children }: { children: JSX.Element }) => {
    if (!user) return <Navigate to="/login" replace />;
    return children;
  };

  const TeacherRoute = ({ children }: { children: JSX.Element }) => {
    if (!user) return <Navigate to="/teacher-login" replace />;
    // allow admin to view teacher dashboard as well
    return children;
  };

  const AdminRoute = ({ children }: { children: JSX.Element }) => {
    if (!user) return <Navigate to="/teacher-login" replace />;
    // if we haven't determined admin status yet, render nothing (or a loader)
    if (isAdmin === null) {
      return null;
    }
    if (!isAdmin) {
      // If not admin, send to teacher dashboard
      return <Navigate to="/teacher-dashboard" replace />;
    }
    return children;
  };

  // -------------------------
  // Routes
  // -------------------------
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Index />} />

      {/* Student auth */}
      <Route path="/login" element={<StudentAuth />} />
      <Route path="/forgot-password" element={<StudentForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Teacher auth */}
      <Route path="/teacher-login" element={<TeacherAuth />} />
      <Route path="/teacher-forgot-password" element={<TeacherForgotPassword />} />

      {/* Protected routes */}
      <Route
        path="/student-dashboard"
        element={
          <StudentRoute>
            <StudentDashboard handleLogout={handleLogout} />
          </StudentRoute>
        }
      />

      <Route
        path="/teacher-dashboard"
        element={
          <TeacherRoute>
            <TeacherDashboard handleLogout={handleLogout} />
          </TeacherRoute>
        }
      />

      <Route
        path="/admin-dashboard"
        element={
          <AdminRoute>
            {/* AdminDashboard contains its own logout handler (internal). Do NOT pass handleLogout here. */}
            <AdminDashboard />
          </AdminRoute>
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