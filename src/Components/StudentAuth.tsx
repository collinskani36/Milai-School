import React, { useState } from "react";
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

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: guardianEmail,
        password,
      });

      if (authError || !authData?.user) {
        setError("Invalid registration number or PIN");
        return;
      }

      if (typeof onLogin === "function") {
        onLogin(profileData);
      }

      navigate("/student-dashboard");
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Replaced bg-gray-100 with the Deep Midnight Blue Gradient
    <div className="flex items-center justify-center min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] p-4">
      {/* Replaced white card with the Premium Slate/Glass effect */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-8 w-full max-w-md relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full" />
        
        <div className="flex justify-center mb-8">
          <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
             <img
              src="/logo.png"
              alt="School Logo"
              className="w-20 h-20 object-contain"
            />
          </div>
        </div>

        {/* Replaced Maroon text with White/Blue accent */}
        <h2 className="text-3xl font-extrabold text-center text-white mb-2 tracking-tight">
          Student Login
        </h2>
        <p className="text-slate-400 text-center text-sm mb-8">Enter your credentials to access your portal</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <input
              type="text"
              placeholder="Registration Number"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
              required
            />
          </div>

          {/* Replaced Maroon button with Deep Blue Premium button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Logging in...
              </span>
            ) : "Login to Portal"}
          </button>

          {/* Replaced maroon-700 with blue-400 */}
          <p
            className="text-sm text-center text-blue-400 cursor-pointer hover:text-blue-300 hover:underline mt-4 transition-colors font-medium"
            onClick={() => (window.location.href = "/forgot-password")}
          >
            Forgot password?
          </p>
        </form>
      </div>
    </div>
  );
}