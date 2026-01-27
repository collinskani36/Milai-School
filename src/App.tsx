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
import TeacherDashboard from "./pages/TeacherDashboard";
import Index from "./pages/Index";
import StudentAuth from "./Components/StudentAuth";
import TeacherAuth from "./Components/TeacherAuth";

import StudentForgotPassword from "./pages/StudentForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TeacherForgotPassword from "./pages/TeacherForgotPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [logoutOrigin, setLogoutOrigin] = useState<"teacher" | "student" | null>(null);

  const lastCheckedId = useRef<string | null>(null);
  const isCheckingAdmin = useRef(false);

  // 1. Stable Admin Check
  const checkIfAdmin = useCallback(async (authId: string) => {
    if (isCheckingAdmin.current) return;
    isCheckingAdmin.current = true;
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("is_admin")
        .eq("auth_id", authId)
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(data.is_admin === true);
      } else {
        setIsAdmin(false);
      }
      lastCheckedId.current = authId;
    } catch (err) {
      setIsAdmin(false);
    } finally {
      isCheckingAdmin.current = false;
    }
  }, []);

  // 2. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const current = session?.user ?? null;
      setUser((prev: any) => (prev?.id === current?.id ? prev : current));

      if (event === "SIGNED_OUT") {
        setIsAdmin(false);
        lastCheckedId.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Admin Verification Trigger
  useEffect(() => {
    const isTeacherRelated = location.pathname.includes("teacher") || location.pathname.includes("admin");
    if (user && (isTeacherRelated || location.pathname === "/teacher-login")) {
      if (lastCheckedId.current !== user.id) {
        checkIfAdmin(user.id);
      }
    }
  }, [location.pathname, user, checkIfAdmin]);

  // 4. DETERMINISTIC REDIRECTS (FIXED FOR ADMIN REDIRECT)
  useEffect(() => {
    if (loading) return;

    const isAuthPage = 
      location.pathname === "/login" || 
      location.pathname === "/teacher-login" ||
      location.pathname === "/" ||
      location.pathname.includes("forgot-password");

    if (!user) {
      if (logoutOrigin) {
        navigate(logoutOrigin === "student" ? "/login" : "/teacher-login", { replace: true });
        setLogoutOrigin(null);
      } else if (!isAuthPage) {
          // If not logged in and trying to access protected route
          if (location.pathname.startsWith("/student-dashboard")) navigate("/login", { replace: true });
          if (location.pathname.startsWith("/teacher-dashboard") || location.pathname.startsWith("/admin-dashboard")) {
              navigate("/teacher-login", { replace: true });
          }
      }
    } else {
      // Logic for Logged-In Users
      if (location.pathname === "/login") {
        navigate("/student-dashboard", { replace: true });
      } 
      
      // Specifically handle the teacher-login to dashboard jump
      if (location.pathname === "/teacher-login") {
        if (isAdmin === true) {
          navigate("/admin-dashboard", { replace: true });
        } else if (isAdmin === false) {
          navigate("/teacher-dashboard", { replace: true });
        }
        // If isAdmin is null, we wait for the useEffect above to finish the fetch
      }

      // Backup guard: If an admin is on the teacher dashboard, move them to admin
      if (location.pathname === "/teacher-dashboard" && isAdmin === true) {
          navigate("/admin-dashboard", { replace: true });
      }
    }
  }, [loading, user, isAdmin, location.pathname, navigate, logoutOrigin]);

  const handleLogout = async () => {
    const wasTeacher = location.pathname.includes("teacher") || location.pathname.includes("admin");
    setLogoutOrigin(wasTeacher ? "teacher" : "student");
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    lastCheckedId.current = null;
  };

  if (loading && !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#020617" }}>
        <div style={{ color: "#3b82f6", fontWeight: "600" }} className="animate-pulse">Loading Portal...</div>
      </div>
    );
  }

  const StudentRoute = ({ children }: { children: JSX.Element }) => 
    user ? children : <Navigate to="/login" replace />;

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