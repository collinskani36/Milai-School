import { useEffect, useState, useRef, useCallback } from "react";
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
import TeacherDashboard from "./Components/teacher-dashboard/TeacherDashboard";

import Index from "./pages/Index";
import StudentAuth from "./Components/StudentAuth";
import TeacherAuth from "./Components/TeacherAuth";

import StudentForgotPassword from "./pages/StudentForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TeacherForgotPassword from "./pages/TeacherForgotPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

// Helper to detect recovery flow from URL
export const isRecoveryFlow = () => window.location.hash.includes("type=recovery");

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [logoutOrigin, setLogoutOrigin] = useState<"teacher" | "student" | null>(null);
  
  // Ref to track if the current session is strictly for password recovery
  const recoverySession = useRef(false); 

  const lastCheckedId = useRef<string | null>(null);
  const isCheckingAdmin = useRef(false);

  const checkIfAdmin = useCallback(async (authId: string) => {
    if (isCheckingAdmin.current) return;
    isCheckingAdmin.current = true;
    try {
      const { data } = await supabase
        .from("teachers")
        .select("is_admin")
        .eq("auth_id", authId)
        .maybeSingle();
      setIsAdmin(data?.is_admin === true || false);
      lastCheckedId.current = authId;
    } catch {
      setIsAdmin(false);
    } finally {
      isCheckingAdmin.current = false;
    }
  }, []);

  // Auth listener + Session initialization
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (isRecoveryFlow()) {
          recoverySession.current = true;
          // Note: We DO NOT set User state here if it's recovery
        } else {
          setUser(session.user);
        }
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setIsAdmin(false);
        lastCheckedId.current = null;
        recoverySession.current = false;
        return;
      }

      if (session?.user) {
        if (isRecoveryFlow()) {
          recoverySession.current = true;
        } else {
          setUser((prev: any) => (prev?.id === session.user.id ? prev : session.user));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Admin check logic
  useEffect(() => {
    const isTeacherRelated =
      location.pathname.includes("teacher") ||
      location.pathname.includes("admin");
    if (user && (isTeacherRelated || location.pathname === "/teacher-login")) {
      if (lastCheckedId.current !== user.id) checkIfAdmin(user.id);
    }
  }, [location.pathname, user, checkIfAdmin]);

  // Deterministic redirects (The Traffic Controller)
  useEffect(() => {
    if (loading) return;

    // GUARD: If user is on the reset page or the URL contains recovery data,
    // we stop all automatic redirects to let ResetPassword.tsx do its job.
    if (location.pathname === "/reset-password" || isRecoveryFlow()) {
      return; 
    }

    const isAuthPage =
      location.pathname === "/login" ||
      location.pathname === "/teacher-login" ||
      location.pathname === "/" ||
      location.pathname.includes("forgot-password");

    // Logic for Logged-Out users or Recovery sessions
    if (!user || recoverySession.current) {
      if (logoutOrigin) {
        navigate(logoutOrigin === "student" ? "/login" : "/teacher-login", { replace: true });
        setLogoutOrigin(null);
      } else if (!isAuthPage) {
        // Redirect to login if trying to access dashboard without a real session
        if (location.pathname.startsWith("/student-dashboard")) navigate("/login", { replace: true });
        if (location.pathname.startsWith("/teacher-dashboard") || location.pathname.startsWith("/admin-dashboard")) {
          navigate("/teacher-login", { replace: true });
        }
      }
    } 
    // Logic for Logged-In users
    else {
      if (location.pathname === "/login" || location.pathname === "/") {
        navigate("/student-dashboard", { replace: true });
      }
      if (location.pathname === "/teacher-login") {
        if (isAdmin === true) navigate("/admin-dashboard", { replace: true });
        else if (isAdmin === false) navigate("/teacher-dashboard", { replace: true });
      }
      if (location.pathname === "/teacher-dashboard" && isAdmin === true) {
        navigate("/admin-dashboard", { replace: true });
      }
    }
  }, [loading, user, isAdmin, location.pathname, navigate, logoutOrigin]);

  const handleLogout = async () => {
    const wasTeacher = location.pathname.includes("teacher") || location.pathname.includes("admin");
    setLogoutOrigin(wasTeacher ? "teacher" : "student");
    await supabase.auth.signOut();
  };

  // Loading state
  if (loading && !user && !isRecoveryFlow()) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#020617" }}>
        <div style={{ color: "#3b82f6", fontWeight: "600" }} className="animate-pulse">Loading Portal...</div>
      </div>
    );
  }

  // Route Guarding Components
  const StudentRoute = ({ children }: { children: JSX.Element }) =>
    user && !recoverySession.current ? children : <Navigate to="/login" replace />;

  const TeacherRoute = ({ children }: { children: JSX.Element }) =>
    user ? children : <Navigate to="/teacher-login" replace />;

  const AdminRoute = ({ children }: { children: JSX.Element }) => {
    if (!user) return <Navigate to="/teacher-login" replace />;
    if (isAdmin === null) return <div className="min-h-screen bg-[#020617]" />;
    if (isAdmin === false) return <Navigate to="/teacher-dashboard" replace />;
    return children;
  };

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<StudentAuth />} />
      <Route path="/teacher-login" element={<TeacherAuth />} />
      <Route path="/forgot-password" element={<StudentForgotPassword />} />
      <Route path="/teacher-forgot-password" element={<TeacherForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/student-dashboard" element={<StudentRoute><StudentDashboard handleLogout={handleLogout} /></StudentRoute>} />
      <Route path="/teacher-dashboard" element={<TeacherRoute><TeacherDashboard handleLogout={handleLogout} /></TeacherRoute>} />
      <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
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
 