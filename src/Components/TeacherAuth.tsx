import React, { useState } from "react";
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

      if (
        teacherRecord.is_admin === true ||
        teacherRecord.is_admin === "true" ||
        teacherRecord.is_admin === 1
      ) {
        navigate("/admin-dashboard");
      } else {
        navigate("/teacher-dashboard");
      }

      if (typeof onLogin === "function") onLogin(teacherRecord);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Replaced bg-gray-100 with the Deep Midnight Blue Gradient
    <div className="flex items-center justify-center min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] p-4">
      
      {/* Premium Glassmorphic Card */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-8 w-full max-w-md relative overflow-hidden">
        
        {/* Decorative subtle blue glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full" />
        
        <div className="flex justify-center mb-8">
          <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
            <img
              src="/logo.png"
              alt="School Logo"
              className="w-20 h-20 object-contain"
            />
          </div>
        </div>

        <h2 className="text-3xl font-extrabold text-center text-white mb-2 tracking-tight">
          Teacher Login
        </h2>
        <p className="text-slate-400 text-center text-sm mb-8 font-light">Access your classroom management dashboard</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
              required
            />
          </div>
          <div className="space-y-1">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : "Login"}
          </button>
        </form>

        <p
          className="text-sm text-center text-blue-400 cursor-pointer hover:text-blue-300 hover:underline mt-6 transition-colors font-medium"
          onClick={() => navigate("/teacher-forgot-password")}
        >
          Forgot password?
        </p>
      </div>
    </div>
  );
}