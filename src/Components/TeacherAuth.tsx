import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

type TeacherAuthProps = {
  onLogin?: (profile: any) => void;
};

export default function TeacherAuth({ onLogin }: TeacherAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const scrollIntoView = (ref: React.RefObject<HTMLInputElement>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error || !data?.user) {
        setError(error?.message || "Invalid email or password");
        return;
      }

      const { data: teacherRecord, error: teacherError } = await supabase
        .from("teachers")
        .select("id, first_name, last_name, is_admin, auth_id")
        .eq("auth_id", data.user.id)
        .single();

      if (teacherError || !teacherRecord) {
        setError("Teacher record not found. Please contact administration.");
        return;
      }

      if (onLogin) onLogin(teacherRecord);

      if (
        teacherRecord.is_admin === true ||
        teacherRecord.is_admin === "true" ||
        teacherRecord.is_admin === 1
      ) {
        navigate("/admin-dashboard", { replace: true });
      } else {
        navigate("/teacher-dashboard", { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center min-h-screen p-4 bg-[#020617] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] overflow-auto"
    >
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-6 w-full max-w-sm relative overflow-visible">

        {/* Background glow */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-[#3b82f6]/20 blur-3xl rounded-full" />

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="p-2 bg-[#3b82f6]/20 rounded-2xl border border-[#3b82f6]/40">
            <img src="/logo.png" alt="School Logo" className="w-16 h-16 object-contain" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-extrabold text-center text-white mb-2 tracking-tight">
          Teacher Login
        </h2>
        <p className="text-slate-400 text-center text-sm mb-6 font-light">
          Access your classroom management dashboard
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            ref={emailRef}
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => scrollIntoView(emailRef)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-[#3b82f6]/30 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6] transition-all"
            required
          />
          <input
            ref={passwordRef}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => scrollIntoView(passwordRef)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-[#3b82f6]/30 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6] transition-all"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3b82f6] hover:bg-[#60a5fa] active:bg-[#1e40af] text-white py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-[#3b82f6]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2 text-sm">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : "Login"}
          </button>
        </form>

        {/* Forgot password */}
        <p
          className="text-sm text-center text-[#3b82f6] cursor-pointer hover:text-[#60a5fa] hover:underline mt-4 transition-colors font-medium"
          onClick={() => navigate("/teacher-forgot-password")}
        >
          Forgot password?
        </p>
      </div>
    </div>
  );
}
