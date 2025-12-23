import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function NotificationsPanel() {
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ title: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch all announcements
  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching announcements:", error);
    else setAnnouncements(data);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Add new announcement
  const handleAdd = async (e) => {
    e.preventDefault();

    if (!form.title || !form.message) {
      setError("Both title and message are required");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("announcements").insert([form]);
    if (error) setError(error.message);
    else {
      setForm({ title: "", message: "" });
      setError("");
      fetchAnnouncements();
    }
    setLoading(false);
  };

  // Delete announcement
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Delete this announcement?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) console.error(error);
    else fetchAnnouncements();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Manage Announcements</h2>

      {/* Add Announcement Form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-6 bg-white p-4 rounded-lg shadow-md max-w-2xl">
        <input
          type="text"
          placeholder="Announcement Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border p-2 rounded"
        />
        <textarea
          placeholder="Message"
          rows="4"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="border p-2 rounded resize-none"
        ></textarea>
        {error && <p className="text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-fit"
        >
          {loading ? "Posting..." : "Post Announcement"}
        </button>
      </form>

      {/* Announcements Table */}
      <table className="w-full border text-left">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 border">Title</th>
            <th className="p-2 border">Message</th>
            <th className="p-2 border">Date</th>
            <th className="p-2 border text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {announcements.length > 0 ? (
            announcements.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="p-2 border font-semibold">{a.title}</td>
                <td className="p-2 border">{a.message}</td>
                <td className="p-2 border text-sm text-gray-600">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="p-2 border text-center">
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-2 border text-center" colSpan="4">
                No announcements yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

