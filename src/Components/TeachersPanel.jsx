import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function TeachersPanel() {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    teacher_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch all teachers
  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching teachers:", error);
    else setTeachers(data);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Add new teacher
  const handleAdd = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!form.first_name || !form.last_name || !form.teacher_code) {
      setError("First name, last name, and teacher code are required");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("teachers").insert([form]);
    if (error) {
      console.error("Error adding teacher:", error);
      setError(error.message);
    } else {
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        teacher_code: "",
      });
      setError("");
      fetchTeachers();
    }
    setLoading(false);
  };

  // Delete teacher by UUID
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this teacher?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) console.error("Error deleting teacher:", error);
    else fetchTeachers();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Manage Teachers</h2>

      {/* Add Teacher Form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-2 mb-6 bg-white p-4 rounded-lg shadow-md"
      >
        <input
          type="text"
          placeholder="First Name"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          className="border p-2 rounded flex-1 min-w-[150px]"
        />
        <input
          type="text"
          placeholder="Last Name"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          className="border p-2 rounded flex-1 min-w-[150px]"
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded flex-1 min-w-[150px]"
        />
        <input
          type="text"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="border p-2 rounded flex-1 min-w-[150px]"
        />
        <input
          type="text"
          placeholder="Teacher Code"
          value={form.teacher_code}
          onChange={(e) => setForm({ ...form, teacher_code: e.target.value })}
          className="border p-2 rounded flex-1 min-w-[150px]"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {loading ? "Adding..." : "Add"}
        </button>
      </form>

      {error && <p className="text-red-500 mb-3">{error}</p>}

      {/* Teachers Table */}
      <table className="w-full border text-left">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 border">First Name</th>
            <th className="p-2 border">Last Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">Teacher Code</th>
            <th className="p-2 border">Created</th>
            <th className="p-2 border text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teachers.length > 0 ? (
            teachers.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="p-2 border">{t.first_name}</td>
                <td className="p-2 border">{t.last_name}</td>
                <td className="p-2 border">{t.email || "-"}</td>
                <td className="p-2 border">{t.phone || "-"}</td>
                <td className="p-2 border font-semibold">{t.teacher_code}</td>
                <td className="p-2 border text-sm text-gray-600">
                  {new Date(t.created_at).toLocaleString()}
                </td>
                <td className="p-2 border text-center">
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-2 border text-center" colSpan="7">
                No teachers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
