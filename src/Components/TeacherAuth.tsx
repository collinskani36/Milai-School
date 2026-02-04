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

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const scrollIntoView = (ref: React.RefObject<HTMLInputElement>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
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

      onLogin?.(teacherRecord);

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
      className="
        flex min-h-screen w-full
        items-center justify-center
        p-4
        bg-gradient-to-br from-[#f6f2f2] via-[#fdfbfb] to-[#f3eded]
      "
    >
      <div className="relative w-full max-w-sm p-6 bg-white/90 backdrop-blur-xl border border-[#7a1f2b]/10 rounded-3xl shadow-xl">

        {/* Subtle maroon glow */}
        {/* Subtle maroon glow */}
<div className="absolute -top-20 -left-20 w-40 h-40 bg-[#7a1f2b]/10 blur-3xl rounded-full" />

{/* Logo */}
<div className="flex justify-center mb-6">
  <img
    src="/logo.png"
    alt="School Logo"
    className="w-16 h-16 object-contain"
  />
</div>


        {/* Title */}
        <h2 className="text-2xl font-extrabold text-center text-[#3a1b1f] mb-2 tracking-tight">
          Teacher Login
        </h2>
        <p className="text-[#6b4b50] text-center text-sm mb-6 font-medium">
          Access your classroom management dashboard
        </p>

        {/* Error */}
        {error && (
          <div className="bg-[#7a1f2b]/10 border border-[#7a1f2b]/20 text-[#7a1f2b] p-2 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col space-y-4">
          <input
            ref={emailRef}
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => scrollIntoView(emailRef)}
            className="
              w-full px-3 py-2
              bg-[#f6f2f2]
              border border-[#7a1f2b]/20
              rounded-xl
              text-[#3a1b1f]
              placeholder:text-[#9b7a7f]
              focus:outline-none
              focus:ring-2 focus:ring-[#7a1f2b]/30
              focus:border-[#7a1f2b]
              transition-all
            "
            required
          />

          <input
            ref={passwordRef}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => scrollIntoView(passwordRef)}
            className="
              w-full px-3 py-2
              bg-[#f6f2f2]
              border border-[#7a1f2b]/20
              rounded-xl
              text-[#3a1b1f]
              placeholder:text-[#9b7a7f]
              focus:outline-none
              focus:ring-2 focus:ring-[#7a1f2b]/30
              focus:border-[#7a1f2b]
              transition-all
            "
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              bg-[#7a1f2b]
              hover:bg-[#6a1a24]
              active:bg-[#5a161f]
              text-white
              py-2.5
              rounded-xl
              font-bold
              transition-all
              shadow-md
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2 text-sm">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Forgot password */}
        <p
          className="
            text-sm text-center
            text-[#7a1f2b]
            cursor-pointer
            hover:text-[#6a1a24]
            hover:underline
            mt-4
            transition-colors
            font-medium
          "
          onClick={() => navigate("/teacher-forgot-password")}
        >
          Forgot password?
        </p>
      </div>
    </div>
  );
}
