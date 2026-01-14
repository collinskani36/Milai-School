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
      // 1️⃣ Authenticate user via Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error || !data?.user) {
        setError(error?.message || "Invalid email or password");
        return;
      }

      // 2️⃣ Check if teacher exists and fetch role info
      const { data: teacherRecord, error: teacherError } = await supabase
        .from("teachers")
        .select("id, first_name, last_name, is_admin, auth_id")
        .eq("auth_id", data.user.id) // <--- Use auth_id to match Supabase user id
        .single();

      if (teacherError || !teacherRecord) {
        setError(
          "Logged in but teacher record not found. Ensure your teacher exists in the 'teachers' table."
        );
        console.error(teacherError);
        return;
      }

      // 3️⃣ Navigate based on admin role (string or boolean)
      if (
        teacherRecord.is_admin === true ||
        teacherRecord.is_admin === "true" ||
        teacherRecord.is_admin === 1
      ) {
        navigate("/admin-dashboard");
      } else {
        navigate("/teacher-dashboard");
      }

      // 4️⃣ Optionally trigger callback if parent component uses it
      if (typeof onLogin === "function") onLogin(teacherRecord);
    } catch (err: any) {
      console.error("Login runtime error:", err);
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="School Logo"
            className="w-28 h-28 object-contain"
          />
        </div>

        <h2 className="text-2xl font-bold text-center text-[#800000] mb-6">
          Teacher Login
        </h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800000] focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800000] focus:outline-none"
            required
          />
          <button
            type="submit"
            className="w-full bg-[#800000] text-white py-2 rounded-lg font-semibold hover:bg-[#660000] transition"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
         <p
  className="text-sm text-center text-gray-600 cursor-pointer hover:underline mt-3"
  onClick={() => navigate("/teacher-forgot-password")}
>
  Forgot password?
</p>

      </div>
    </div>
  );
}