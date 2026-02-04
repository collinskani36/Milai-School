// src/pages/TeacherForgotPassword.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function TeacherForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!email) {
        setError("Please enter your email");
        return;
      }

     const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: "https://fredanacademy.vercel.app/reset-password",
});

if (resetError) throw resetError;

      setSuccess("Password reset link has been sent to your email.");
    } catch (err: any) {
      console.error("[ERROR] Password reset failed:", err);
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-[#800000] mb-6">
          Forgot Password
        </h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-green-100 text-green-700 p-2 rounded mb-4">{success}</div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800000] focus:outline-none"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#800000] text-white py-2 rounded-lg font-semibold hover:bg-[#660000] transition"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p
          className="text-sm text-center text-gray-600 cursor-pointer hover:underline mt-4"
          onClick={() => navigate("/teacher-login")}
        >
          Back to Teacher Login
        </p>
      </div>
    </div>
  );
}
