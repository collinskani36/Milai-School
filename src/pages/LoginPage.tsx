import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    // 1️⃣ Sign in with Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("User not found");

    const userId = authData.user.id;
    console.log("✅ Logged-in user:", authData.user);

    // 2️⃣ Fetch profile with role check
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .eq("auth_id", userId)
      .single(); // expect only one profile per user

    if (profileError) throw profileError;

    if (!profileData) {
      setError("❌ No profile found for this user");
      return;
    }

    console.log(`✅ Logged in as ${profileData.role}:`, profileData);

    // 3️⃣ Redirect based on role
    switch (profileData.role) {
      case "student":
        window.location.href = "/student-dashboard";
        break;
      case "teacher":
        window.location.href = "/teacher-dashboard";
        break;
      default:
        setError("❌ Unknown role");
    }
  } catch (err: any) {
    console.error("Login error:", err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};



  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {/* Card */}
      <div className="bg-white shadow-xl rounded-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/milai-school-logo.webp" // place the uploaded logo in /public folder
            alt="School Logo"
            className="w-24 h-24 mb-3"
          />
          <h1 className="text-2xl font-bold text-maroon-700">Student Portal</h1>
          <p className="text-gray-500 text-sm">Nurture With Excellence</p>
        </div>

        {/* Login Form */}
        <form className="space-y-5">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-600"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-600"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-maroon-700 text-white font-semibold py-2 px-4 rounded-lg shadow hover:bg-maroon-800 transition duration-300"
          >
            Login
          </button>
        </form>
        

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600">
          © 2025 Milai School. All rights reserved.
        </p>
      </div>
    </div>
  );
}
