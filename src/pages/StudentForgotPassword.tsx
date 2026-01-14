// src/pages/StudentForgotPassword.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function StudentForgotPassword() {
  const [registration, setRegistration] = useState("");
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
      const reg = registration.trim().toUpperCase();

      if (!reg) {
        setError("Please enter registration number");
        return;
      }

      // 1️⃣ Lookup student by registration number
      const { data: profileData, error: lookupError } = await supabase
        .from("profiles")
        .select("guardian_email")
        .eq("reg_no", reg)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!profileData) {
        setError("Registration number not found");
        return;
      }

      if (!profileData.guardian_email) {
        setError("Guardian email not set for this student");
        return;
      }

      const guardianEmail = profileData.guardian_email;

      // 2️⃣ Send reset email to guardian with correct redirect
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(guardianEmail, {
          redirectTo: "http://localhost:8080/reset-password", // ✅ fixed
        });

      if (resetError) throw resetError;

      setSuccess(
        "Password reset link has been sent to the guardian's email."
      );
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
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-2 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="text"
            placeholder="Registration Number"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#800000] text-white py-2 rounded-lg font-semibold"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p
          className="text-sm text-center text-gray-600 cursor-pointer hover:underline mt-4"
          onClick={() => navigate("/login")}
        >
          Back to Student Login
        </p>
      </div>
    </div>
  );
}
