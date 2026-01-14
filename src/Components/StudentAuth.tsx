// src/components/StudentAuth.tsx
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

      console.log("[DEBUG] Registration entered:", reg);
      console.log("[DEBUG] PIN entered:", password ? "***" : "(empty)");

      if (!reg || !password) {
        setError("Please enter registration number and PIN");
        return;
      }

      // 1️⃣ Lookup student profile by registration number
      const { data: profileData, error: lookupError } = await supabase
        .from("profiles")
        .select(`
          id,
          reg_no,
          guardian_email,
          student_id
        `)
        .eq("reg_no", reg)
        .maybeSingle();

      console.log("[DEBUG] Profile lookup result:", profileData, "Error:", lookupError);

      if (lookupError) throw lookupError;

      if (!profileData) {
        setError("Registration number not found");
        console.warn("[WARN] No profile found for reg_no:", reg);
        return;
      }

      const guardianEmail = profileData.guardian_email;

      if (!guardianEmail) {
        setError("Guardian email not set for this student");
        console.warn("[WARN] Profile exists but guardian_email is missing:", profileData);
        return;
      }

      console.log("[DEBUG] Guardian email found:", guardianEmail);

      // 2️⃣ Authenticate using Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: guardianEmail,
        password,
      });

      console.log("[DEBUG] Auth result:", authData, "Auth error:", authError);

      if (authError || !authData?.user) {
        setError("Invalid registration number or PIN");
        console.warn("[WARN] Auth failed for email:", guardianEmail);
        return;
      }

      console.log("[INFO] Login successful for:", guardianEmail);

      // 3️⃣ Hand over profile to parent if callback exists
      if (typeof onLogin === "function") {
        onLogin(profileData);
      }

      // 4️⃣ Navigate to student dashboard
      navigate("/student-dashboard");
    } catch (err: any) {
      console.error("[ERROR] Login runtime error:", err);
      setError("Something went wrong. Please try again.");
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
          Student Login
        </h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Registration Number (e.g., REG1001)"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#800000] text-white py-2 rounded-lg font-semibold"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          <p
  className="text-sm text-center text-maroon-700 cursor-pointer hover:underline mt-3"
  onClick={() => (window.location.href = "/forgot-password")}
>
  Forgot password?
</p>

        </form>
      </div>
    </div>
  );
}
