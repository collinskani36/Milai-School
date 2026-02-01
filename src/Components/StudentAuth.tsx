import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type StudentAuthProps = {
  onLogin?: (profile: any) => void;
};

export default function StudentAuth({ onLogin }: StudentAuthProps) {
  const [registration, setRegistration] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Scroll inputs into view on focus (mobile WebView-friendly)
  useEffect(() => {
    const handleFocus = (e: any) => {
      const target = e.target;
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    };

    const inputs = document.querySelectorAll("input");
    inputs.forEach((input) => input.addEventListener("focus", handleFocus));

    return () => {
      inputs.forEach((input) =>
        input.removeEventListener("focus", handleFocus)
      );
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const reg = registration.trim().toUpperCase();
      const password = pin.trim();

      if (!reg || !password) {
        setError("Please enter registration number and PIN");
        return;
      }

      const { data: profileData, error: lookupError } = await supabase
        .from("profiles")
        .select(`id, reg_no, guardian_email, student_id`)
        .eq("reg_no", reg)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!profileData) {
        setError("Registration number not found");
        return;
      }

      const guardianEmail = profileData.guardian_email;
      if (!guardianEmail) {
        setError("Guardian email not set for this student");
        return;
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: guardianEmail,
          password,
        });

      if (authError || !authData?.user) {
        setError("Invalid registration number or PIN");
        return;
      }

      if (typeof onLogin === "function") onLogin(profileData);

      navigate("/student-dashboard", { replace: true });
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] p-4">
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-6 w-full max-w-sm relative overflow-hidden">

        {/* Background glow with vibrant blue */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#3b82f6]/20 blur-3xl rounded-full" />

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="p-2 bg-[#3b82f6]/20 rounded-2xl border border-[#3b82f6]/40">
            <img
              src="/logo.png"
              alt="School Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-extrabold text-center text-white mb-2 tracking-tight">
          Student Login
        </h2>
        <p className="text-slate-400 text-center text-sm mb-6 font-light">
          Enter your credentials to access your portal
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
            type="text"
            placeholder="Registration Number"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-[#3b82f6]/30 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6] transition-all uppercase"
            required
          />
          <input
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
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
                Logging in...
              </span>
            ) : (
              "Login to Portal"
            )}
          </button>

          <p
            className="text-sm text-center text-[#3b82f6] cursor-pointer hover:text-[#60a5fa] hover:underline mt-4 transition-colors font-medium"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot password?
          </p>
        </form>
      </div>
    </div>
  );
}
