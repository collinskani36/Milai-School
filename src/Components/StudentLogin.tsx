import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function StudentLogin() {
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!regNo || !password) {
        alert("Please enter both registration number and password");
        setLoading(false);
        return;
      }

      // 🔹 Convert regNo to the masked email
      const email = `${regNo.trim().toLowerCase()}@school.local`;

      // 🔹 Log in using Supabase Auth
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new Error(error.message);

      // ✅ Login success
      alert("Login successful!");
      navigate("/student-dashboard"); // 👈 change route to your actual student dashboard
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-4"
      >
        <h2 className="text-2xl font-bold text-center mb-4">Student Login</h2>

        <input
          type="text"
          placeholder="Registration Number"
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <button
  type="button"
  onClick={() => navigate("/")}
  className="w-full border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-100 transition"
>
  Back
</button>


        
      </form>
    </div>
  );
}
