// src/pages/ResetPassword.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  // -------------------------------
  // Step 1: Parse access token from URL and set session
  // -------------------------------
  useEffect(() => {
    const hash = window.location.hash; // e.g., #access_token=...&type=recovery
    if (!hash) return;

    const params = new URLSearchParams(hash.replace("#", ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) setError("Invalid or expired reset link");
        });
    } else {
      setError("Invalid or expired reset link");
    }
  }, []);

  // -------------------------------
  // Step 2: Handle password reset form submission
  // -------------------------------
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess("Password reset successfully!");

      // Optional: remove token hash from URL for cleanliness
      window.history.replaceState({}, document.title, "/login");

      // Redirect to login after short delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err: any) {
      console.error("[ERROR] Reset password failed:", err);
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-[#800000] mb-6">
          Reset Password
        </h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-2 rounded mb-4">{success}</div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="password"
            placeholder="New PIN / Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />

          <input
            type="password"
            placeholder="Confirm New PIN"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#800000] text-white py-2 rounded-lg font-semibold"
          >
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-4">
          You can close this page after resetting your password.
        </p>
      </div>
    </div>
  );
}
