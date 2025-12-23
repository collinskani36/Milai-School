import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TeacherLogin({ onLogin }: { onLogin: (teacher: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 🔑 Step 1: Authenticate with email + password
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError || !authData.session) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      // 🔑 Step 2: Fetch teacher profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, first_name, last_name, email, auth_id")
        .eq("auth_id", authData.user.id)
        .single();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        setError("Could not load profile");
      } else if (profile?.role !== "teacher") {
        setError("You are not authorized as a teacher");
      } else {
        onLogin(profile); // ✅ Send profile to dashboard
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-4">Teacher Login</h2>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 border rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </form>
    </div>
  );
}
