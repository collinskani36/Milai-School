import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function StudentSignup() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    regNo: "",
    fullName: "",
    dob: "",
    gender: "",
    classId: "",
    contact: "",
    guardianName: "",
    guardianPhone: "",
  });

  // 🔹 fetch classes from Supabase
  useEffect(() => {
    const fetchClasses = async () => {
      const { data, error } = await supabase.from("classes").select("*");
      if (error) {
        console.error("❌ Error fetching classes:", error);
      } else {
        setClasses(data || []);
      }
    };
    fetchClasses();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Mask regNo into a valid email
     const reg = formData.regNo?.trim();
    if (!reg) {
      alert("Please enter your registration number");
      setLoading(false);
      return;
    }
     const maskedEmail = `${reg.toLowerCase()}@school.local`;

    // 2. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: maskedEmail,
      password: formData.password,
    });

    if (authError) {
      alert(`Signup failed: ${authError.message}`);
      console.error(authError);
      setLoading(false);
      return;
    }

    const authId = authData.user?.id;
    if (!authId) {
      alert("Signup failed: no auth ID returned.");
      setLoading(false);
      return;
    }

    // 3. Insert into students table
    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert([
        {
          full_name: formData.fullName,
          dob: formData.dob,
          gender: formData.gender,
          class_id: formData.classId,
          contact: formData.contact,
          guardian_name: formData.guardianName,
          guardian_phone: formData.guardianPhone,
        },
      ])
      .select()
      .single();

    if (studentError) {
      alert("Error creating student: " + studentError.message);
      setLoading(false);
      return;
    }

    // 4. Insert into profiles table
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        auth_id: authId,
        role: "student",
        student_id: student.id,
        reg_no: formData.regNo,
      },
    ]);

    if (profileError) {
      alert("Error creating profile: " + profileError.message);
    } else {
      alert("Signup successful! Please log in.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSignup}
        className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg space-y-4"
      >
        <h2 className="text-2xl font-bold text-center mb-4">Student Signup</h2>

        <input
          type="text"
          name="regNo"
          placeholder="Registration Number"
          className="w-full p-2 border rounded"
          value={formData.regNo}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full p-2 border rounded"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          className="w-full p-2 border rounded"
          value={formData.fullName}
          onChange={handleChange}
          required
        />

        <input
          type="date"
          name="dob"
          className="w-full p-2 border rounded"
          value={formData.dob}
          onChange={handleChange}
          required
        />

        <select
          name="gender"
          className="w-full p-2 border rounded"
          value={formData.gender}
          onChange={handleChange}
          required
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        <select
          name="classId"
          value={formData.classId}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border rounded-lg bg-white text-gray-800 
               focus:outline-none focus:ring-2 focus:ring-maroon-600 appearance-none"
        >
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="contact"
          placeholder="Student Contact"
          className="w-full p-2 border rounded"
          value={formData.contact}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="guardianName"
          placeholder="Guardian Name"
          className="w-full p-2 border rounded"
          value={formData.guardianName}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="guardianPhone"
          placeholder="Guardian Phone"
          className="w-full p-2 border rounded"
          value={formData.guardianPhone}
          onChange={handleChange}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Registering..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
