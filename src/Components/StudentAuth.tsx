// src/components/StudentAuth.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type StudentAuthProps = {
  onLogin?: (profile: any) => void; // make optional so it won't crash
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
      // 1) Build synthetic email (lowercase is safest)
      const reg = registration.trim().toLowerCase();
      const email = `${reg}@school.local`;
      const password = pin.trim();

      // 2) Auth sign-in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.user) {
        setError(error?.message || "Invalid registration number or PIN");
        return;
      }

      // 3) Fetch profile linked to this auth user
      const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select(`
    id,
    reg_no,
    role,
    students:reg_no (
      student_id,
      first_name,
      last_name,
      dob,
      gender,
      created_at
    )
  `)
  .eq("id", data.user.id)
  .single();


      if (profileError) {
        // Helpful message if you forgot to create profiles row
        setError(
          "Logged in, but profile not found. Make sure a row exists in `profiles` with id = auth.users.id."
        );
        console.error(profileError);
        return;
      }

      // 4) Hand over to parent if provided
      if (typeof onLogin === "function") onLogin(profile);
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
          <img src="/logo.png" alt="School Logo" className="w-28 h-28 object-contain" />
        </div>

        <h2 className="text-2xl font-bold text-center text-[#800000] mb-6">
          Student Login
        </h2>

        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Registration Number (e.g., REG1001)"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800000] focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
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
      </div>
    </div>
  );
}
