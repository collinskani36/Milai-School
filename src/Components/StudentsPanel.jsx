import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function StudentsPanel() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    reg_no: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch students from profiles table
  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, student_id, reg_no, first_name, last_name, email, phone, gender, date_of_birth"
      )
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    setStudents(data || []);
    setLoading(false);
  };

  // Add student to students & profiles table
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Add to students table
    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .insert([
        {
          Reg_no: form.reg_no,
          first_name: form.first_name,
          last_name: form.last_name,
        },
      ])
      .select()
      .single();

    if (studentError) {
      setError("Student table error: " + studentError.message);
      setLoading(false);
      return;
    }

    // 2. Add to profiles table
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        student_id: studentData.id,
        reg_no: form.reg_no,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        gender: form.gender,
        date_of_birth: form.date_of_birth || null,
      },
    ]);

    if (profileError) {
      setError("Profiles table error: " + profileError.message);
      setLoading(false);
      return;
    }

    setForm({
      reg_no: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      gender: "",
      date_of_birth: "",
    });
    setLoading(false);
    fetchStudents();
  };

  // ✅ NEW: Delete student function
  const handleDeleteStudent = async (id) => {
    if (!confirm("Are you sure you want to delete this student?")) return;

    const { error } = await supabase.from("profiles").delete().eq("id", id);

    if (error) {
      console.error("Error deleting student:", error.message);
      setError("Delete failed: " + error.message);
    } else {
      alert("Student deleted successfully!");
      fetchStudents(); // refresh the table
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Student Management</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}

      <form onSubmit={handleAddStudent} className="grid grid-cols-2 gap-2 mb-6">
        <input
          type="text"
          placeholder="Registration Number"
          value={form.reg_no}
          onChange={(e) => setForm({ ...form, reg_no: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="First Name"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Last Name"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="border p-2 rounded"
        />
        <select
          value={form.gender}
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Gender (optional)</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="date"
          placeholder="Date of Birth"
          value={form.date_of_birth}
          onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          className="border p-2 rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded col-span-2"
        >
          {loading ? "Adding..." : "Add Student"}
        </button>
      </form>

      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 border">Reg No</th>
            <th className="p-2 border">First Name</th>
            <th className="p-2 border">Last Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">Gender</th>
            <th className="p-2 border">DOB</th>
            <th className="p-2 border">Action</th> {/* ✅ Added */}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td className="border p-2">{s.reg_no}</td>
              <td className="border p-2">{s.first_name}</td>
              <td className="border p-2">{s.last_name}</td>
              <td className="border p-2">{s.email}</td>
              <td className="border p-2">{s.phone}</td>
              <td className="border p-2">{s.gender}</td>
              <td className="border p-2">{s.date_of_birth || ""}</td>
              <td className="border p-2 text-center">
                <button
                  onClick={() => handleDeleteStudent(s.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
