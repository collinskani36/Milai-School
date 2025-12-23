import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminPanel from "./pages/AdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import Index from "./pages/Index";
import StudentAuth from "./Components/StudentAuth";
import TeacherAuth from "./Components/TeacherAuth";
import StudentSignup from "./pages/StudentSignup";
// Remove StudentFeePage import since it will be a popup in StudentDashboard

const queryClient = new QueryClient();

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ Check current session
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        console.log("Initial session:", data, error);
        const sessionUser = data?.session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser) {
          checkIfAdmin(sessionUser.id).catch((err) =>
            console.warn("checkIfAdmin error:", err)
          );
        }
      } catch (err) {
        console.warn("getSession failed:", err);
      } finally {
        setLoading(false);
      }
    };
    getSession();

    const { data: listenerData } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log("Auth state changed:", event, session);
          const sessionUser = session?.user ?? null;
          setUser(sessionUser);
          if (sessionUser) {
            checkIfAdmin(sessionUser.id).catch((err) =>
              console.warn("checkIfAdmin error:", err)
            );
          } else {
            setIsAdmin(false);
          }
        } catch (err) {
          console.warn("onAuthStateChange handler error:", err);
        }
      }
    );

    return () => {
      try {
        if (
          listenerData &&
          (listenerData as any).subscription &&
          typeof (listenerData as any).subscription.unsubscribe === "function"
        ) {
          (listenerData as any).subscription.unsubscribe();
        }
      } catch (err) {
        console.warn("Error unsubscribing auth listener:", err);
      }
    };
  }, []);

  // ✅ Check if logged-in user is admin
  const checkIfAdmin = async (authId: string) => {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("is_admin")
        .eq("auth_id", authId)
        .single();
      setIsAdmin(
        !error &&
          (data?.is_admin === true ||
            data?.is_admin === "true" ||
            data?.is_admin === 1)
      );
    } catch (err) {
      console.warn("checkIfAdmin failed:", err);
      setIsAdmin(false);
    }
  };

  // ✅ Dev-only click debugger
  useEffect(() => {
    if (!(typeof import.meta !== "undefined" && (import.meta as any).env?.DEV))
      return;

    const onClick = (e: MouseEvent) => {
      try {
        console.debug("[DEBUG] click target:", e.target, {
          x: e.clientX,
          y: e.clientY,
        });
      } catch {}
    };
    window.addEventListener("click", onClick, true);

    const interval = setInterval(() => {
      try {
        const x = Math.round(window.innerWidth / 2);
        const y = Math.round(window.innerHeight / 2);
        const el = document.elementFromPoint(x, y);
        console.debug("[DEBUG] center element", { x, y, el });
        if (el instanceof Element) {
          const style = window.getComputedStyle(el);
          if (
            +style.zIndex > 0 ||
            style.pointerEvents === "auto" ||
            style.position === "fixed"
          ) {
            console.debug("[DEBUG] center element styles", {
              zIndex: style.zIndex,
              pointerEvents: style.pointerEvents,
              position: style.position,
            });
          }
        }
      } catch {}
    }, 3000);

    return () => {
      window.removeEventListener("click", onClick, true);
      clearInterval(interval);
    };
  }, []);

  if (loading) return <p>Loading...</p>;

  // ✅ Logout handler
  const handleLogout = async () => {
    const fallback = () => {
      try {
        setUser(null);
        setIsAdmin(false);
      } catch {}
      // Redirect to appropriate login page depending on current route
      try {
        const p = (window.location && window.location.pathname) || '';
        if (p.startsWith('/student')) {
          window.location.href = '/login';
          return;
        }
        if (p.startsWith('/teacher') || p.startsWith('/admin')) {
          window.location.href = '/teacher-login';
          return;
        }
      } catch (e) {
        // fall through
      }
      window.location.href = '/login';
    };

    try {
      const session = await supabase.auth.getSession();
      if (!session?.data?.session) {
        fallback();
        return;
      }

      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("signOut timeout")), 5000)
      );
      try {
        await Promise.race([signOutPromise, timeoutPromise]);
      } catch (err) {
        console.warn("signOut failed or timed out:", err);
      }

      fallback();
    } catch (err) {
      console.warn("logout error:", err);
      fallback();
    }
  };

  // ✅ Main routes (moved inside final return)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />

          {/* Student login */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/student-dashboard" replace />
              ) : (
                <StudentAuth />
              )
            }
          />

          {/* Student signup */}
          <Route path="/student-signup" element={<StudentSignup />} />

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

          {/* Protected student dashboard - NOW INCLUDES FEES AS POPUP */}
          <Route
            path="/student-dashboard"
            element={
              user ? (
                <StudentDashboard handleLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* REMOVED: Protected student fees page (now part of dashboard popup) */}

          {/* Protected teacher dashboard */}
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

          {/* Admin dashboard route */}
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;