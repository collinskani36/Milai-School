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

  useEffect(() => {
    const validateSession = async () => {
      // 1. Check if the recovery type is in the URL hash
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      const isRecoveryHash = params.get("type") === "recovery";

      if (isRecoveryHash) {
        return; // Valid hash found, stay on page
      }

      // 2. If hash is gone (consumed by Supabase), check for an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      // If there's no hash AND no session, the link is truly invalid
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
    };

    validateSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
      // updatePassword updates the currently logged-in user (from the recovery link)
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess("Password reset successful. Redirecting to login...");

      // Log out to clear the recovery session and force a fresh login
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to reset password");
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
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4 text-sm text-center">
            {success}
          </div>
        )}

        {/* We only show the form if there is NO error and NO success message */}
        {!error && !success && (
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="password"
              placeholder="New PIN / Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000]"
              required
            />

            <input
              type="password"
              placeholder="Confirm New PIN"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000]"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#800000] text-white py-2 rounded-lg font-semibold hover:bg-red-900 transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}