import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ChangePassword({ student }: { student: any }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    if (student.password !== currentPassword) {
      setMessage("Current password is incorrect.");
      return;
    }

    const { error } = await supabase
      .from("students")
      .update({ password: newPassword })
      .eq("id", student.id);

    if (error) {
      setMessage("Error updating password.");
    } else {
      setMessage("Password updated successfully!");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4">Change Password</h2>
      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        <input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="p-2 border rounded"
        />
        <button
          type="submit"
          className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Change Password
        </button>
      </form>
      {message && <p className="mt-3 text-center text-sm">{message}</p>}
    </div>
  );
}
