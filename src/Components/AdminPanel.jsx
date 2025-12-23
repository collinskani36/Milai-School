import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("students");
  const [loading, setLoading] = useState(false);

  // core lists
  const [students, setStudents] = useState([]); // from profiles
  const [teachers, setTeachers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  // Student form
  const [studentForm, setStudentForm] = useState({
    reg_no: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
  });
  const [editingStudent, setEditingStudent] = useState(null);

  // Teacher form
  const [teacherForm, setTeacherForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    teacher_code: "",
  });
  const [editingTeacher, setEditingTeacher] = useState(null);

  // Announcement form
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    class_id: "",
  });

  // Assessments & results states
  const [assessmentForm, setAssessmentForm] = useState({
    title: "",
    term: "",
    year: "",
    class_id: "",
  });
  const [editingAssessment, setEditingAssessment] = useState(null);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);
  const [results, setResults] = useState([]); // assessment_results for selected assessment

  const [resultForm, setResultForm] = useState({
    id: null, // for editing result (assessment_results.id)
    student_id: "",
    subject_id: "",
    score: "",
    max_marks: 100,
    assessment_date: "", // ISO date or timestamp string
  });

  // ---------------- Fetch basics ----------------
  useEffect(() => {
    fetchCoreData();
  }, []);

  const fetchCoreData = async () => {
    fetchStudents();
    fetchTeachers();
    fetchAnnouncements();
    fetchAssessments();
    fetchSubjects();
    fetchClasses();
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, student_id, reg_no, first_name, last_name, email, phone");
    if (error) console.error("fetchStudents:", error);
    else setStudents(data || []);
  };

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, email, phone, teacher_code");
    if (error) console.error("fetchTeachers:", error);
    else setTeachers(data || []);
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, content, created_at, class_id")
      .order("created_at", { ascending: false });
    if (error) console.error("fetchAnnouncements:", error);
    else setAnnouncements(data || []);
  };

  const fetchAssessments = async () => {
    const { data, error } = await supabase
      .from("assessments")
      .select("id, title, term, year, class_id, created_at")
      .order("created_at", { ascending: false });
    if (error) console.error("fetchAssessments:", error);
    else setAssessments(data || []);
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name")
      .order("name", { ascending: true });
    if (error) console.error("fetchSubjects:", error);
    else setSubjects(data || []);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, grade_level")
      .order("name", { ascending: true });
    if (error) console.error("fetchClasses:", error);
    else setClasses(data || []);
  };

  // ---------------- Announcements CRUD ----------------
  const addAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title) return alert("Title is required");
    setLoading(true);
    const { error } = await supabase.from("announcements").insert([
      {
        title: announcementForm.title,
        content: announcementForm.content,
        class_id: announcementForm.class_id || null,
      },
    ]);
    setLoading(false);
    if (error) alert("Failed to post announcement: " + error.message);
    else {
      setAnnouncementForm({ title: "", content: "", class_id: "" });
      fetchAnnouncements();
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) alert("Failed to delete announcement");
    else fetchAnnouncements();
  };

  // ---------------- Students CRUD ----------------
  const addOrUpdateStudent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingStudent) {
        // update profiles row by profiles.id
        const { error } = await supabase
          .from("profiles")
          .update({
            reg_no: studentForm.reg_no,
            first_name: studentForm.first_name,
            last_name: studentForm.last_name,
            email: studentForm.email,
            phone: studentForm.phone,
            gender: studentForm.gender,
            date_of_birth: studentForm.date_of_birth || null,
          })
          .eq("id", editingStudent);
        if (error) throw error;
        alert("Student updated");
      } else {
        // insert into students then insert profile linking student_id
        const { data: studentData, error: sErr } = await supabase
          .from("students")
          .insert([
            {
              Reg_no: studentForm.reg_no,
              first_name: studentForm.first_name,
              last_name: studentForm.last_name,
            },
          ])
          .select()
          .single();
        if (sErr) throw sErr;

        const { error: pErr } = await supabase.from("profiles").insert([
          {
            student_id: studentData.id,
            reg_no: studentForm.reg_no,
            first_name: studentForm.first_name,
            last_name: studentForm.last_name,
            email: studentForm.email || null,
            phone: studentForm.phone || null,
            gender: studentForm.gender || null,
            date_of_birth: studentForm.date_of_birth || null,
          },
        ]);
        if (pErr) throw pErr;
        alert("Student added");
      }
      setEditingStudent(null);
      setStudentForm({
        reg_no: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        gender: "",
        date_of_birth: "",
      });
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const editStudent = (student) => {
    setEditingStudent(student.id);
    setStudentForm({
      reg_no: student.reg_no,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email || "",
      phone: student.phone || "",
      gender: student.gender || "",
      date_of_birth: student.date_of_birth ? student.date_of_birth.split("T")[0] : "",
    });
    setActiveTab("students");
  };

  const deleteStudent = async (id) => {
    if (!confirm("Delete this student profile? This will remove profile only.")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) alert("Failed to delete student: " + error.message);
    else {
      alert("Student profile deleted");
      fetchStudents();
    }
  };

  // ---------------- Teachers CRUD ----------------
  const addOrUpdateTeacher = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingTeacher) {
        const { error } = await supabase
          .from("teachers")
          .update({
            first_name: teacherForm.first_name,
            last_name: teacherForm.last_name,
            email: teacherForm.email || null,
            phone: teacherForm.phone || null,
            teacher_code: teacherForm.teacher_code,
          })
          .eq("id", editingTeacher);
        if (error) throw error;
        alert("Teacher updated");
      } else {
        const { error } = await supabase.from("teachers").insert([
          {
            first_name: teacherForm.first_name,
            last_name: teacherForm.last_name,
            email: teacherForm.email || null,
            phone: teacherForm.phone || null,
            teacher_code: teacherForm.teacher_code,
          },
        ]);
        if (error) throw error;
        alert("Teacher added");
      }
      setEditingTeacher(null);
      setTeacherForm({ first_name: "", last_name: "", email: "", phone: "", teacher_code: "" });
      fetchTeachers();
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const editTeacher = (t) => {
    setEditingTeacher(t.id);
    setTeacherForm({
      first_name: t.first_name,
      last_name: t.last_name,
      email: t.email || "",
      phone: t.phone || "",
      teacher_code: t.teacher_code || "",
    });
    setActiveTab("teachers");
  };

  const deleteTeacher = async (id) => {
    if (!confirm("Delete this teacher?")) return;
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) alert("Failed to delete teacher");
    else {
      alert("Teacher deleted");
      fetchTeachers();
    }
  };

  // ---------------- Assessments CRUD ----------------
  const addOrUpdateAssessment = async (e) => {
    e.preventDefault();
    if (!assessmentForm.title || !assessmentForm.term || !assessmentForm.year) {
      return alert("Title, term and year are required");
    }
    setLoading(true);
    try {
      if (editingAssessment) {
        const { error } = await supabase
          .from("assessments")
          .update({
            title: assessmentForm.title,
            term: parseInt(assessmentForm.term, 10),
            year: parseInt(assessmentForm.year, 10),
            class_id: assessmentForm.class_id || null,
          })
          .eq("id", editingAssessment);
        if (error) throw error;
        alert("Assessment updated");
      } else {
        const { error } = await supabase.from("assessments").insert([
          {
            title: assessmentForm.title,
            term: parseInt(assessmentForm.term, 10),
            year: parseInt(assessmentForm.year, 10),
            class_id: assessmentForm.class_id || null,
          },
        ]);
        if (error) throw error;
        alert("Assessment created");
      }
      setEditingAssessment(null);
      setAssessmentForm({ title: "", term: "", year: "", class_id: "" });
      fetchAssessments();
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const editAssessment = (a) => {
    setEditingAssessment(a.id);
    setAssessmentForm({
      title: a.title,
      term: a.term,
      year: a.year,
      class_id: a.class_id || "",
    });
    setActiveTab("assessments");
  };

  const deleteAssessment = async (id) => {
    if (!confirm("Delete this assessment and all linked results?")) return;
    setLoading(true);
    try {
      // optionally delete linked results first (depends on db constraints). We'll delete results then assessment.
      const { error: err1 } = await supabase.from("assessment_results").delete().eq("assessment_id", id);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from("assessments").delete().eq("id", id);
      if (err2) throw err2;
      alert("Assessment and linked results deleted");
      fetchAssessments();
      setResults([]);
      if (selectedAssessmentId === id) setSelectedAssessmentId(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting assessment: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Results CRUD ----------------
  const fetchResultsForAssessment = async (assessmentId) => {
    setSelectedAssessmentId(assessmentId);
    if (!assessmentId) {
      setResults([]);
      return;
    }
    const { data, error } = await supabase
      .from("assessment_results")
      .select(
        "id, assessment_id, student_id, subject_id, score, max_marks, assessment_date, updated_at, student:profiles(first_name,last_name,reg_no)"
      )
      .eq("assessment_id", assessmentId)
      .order("assessment_date", { ascending: true });
    if (error) console.error("fetchResultsForAssessment:", error);
    else setResults(data || []);
  };

  const addOrUpdateResult = async (e) => {
    e.preventDefault();

    if (!selectedAssessmentId) return alert("Select an assessment first");
    if (!resultForm.student_id || !resultForm.subject_id) return alert("Student and subject required");
    if (resultForm.score === "" || resultForm.score === null) return alert("Score required");

    setLoading(true);
    try {
      const payload = {
        assessment_id: selectedAssessmentId,
        student_id: resultForm.student_id,
        subject_id: resultForm.subject_id,
        score: parseFloat(resultForm.score),
        max_marks: resultForm.max_marks ? parseInt(resultForm.max_marks, 10) : 100,
        assessment_date: resultForm.assessment_date || new Date().toISOString(),
      };

      if (resultForm.id) {
        // update
        const { error } = await supabase.from("assessment_results").update(payload).eq("id", resultForm.id);
        if (error) throw error;
        alert("Result updated");
      } else {
        // insert
        const { error } = await supabase.from("assessment_results").insert([payload]);
        if (error) throw error;
        alert("Result added");
      }

      // reset and refresh
      setResultForm({ id: null, student_id: "", subject_id: "", score: "", max_marks: 100, assessment_date: "" });
      fetchResultsForAssessment(selectedAssessmentId);
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const editResult = (r) => {
    setResultForm({
      id: r.id,
      student_id: r.student_id,
      subject_id: r.subject_id,
      score: r.score,
      max_marks: r.max_marks,
      assessment_date: r.assessment_date ? r.assessment_date.split("T")[0] : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteResult = async (id) => {
    if (!confirm("Delete this result?")) return;
    const { error } = await supabase.from("assessment_results").delete().eq("id", id);
    if (error) alert("Failed to delete result");
    else {
      alert("Result deleted");
      fetchResultsForAssessment(selectedAssessmentId);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-6">Admin Panel</h1>

      <div className="flex justify-center gap-3 mb-6">
        {[
          "students",
          "teachers",
          "assessments",
          "results", // separate tab to go directly to results-management
          "announcements",
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-md font-medium ${
              activeTab === tab ? "bg-blue-600 text-white" : "bg-white border border-gray-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ---------- STUDENTS ---------- */}
      {activeTab === "students" && (
        <div>
          <h2 className="text-xl font-semibold mb-3">{editingStudent ? "Edit Student" : "Add Student"}</h2>
          <form onSubmit={addOrUpdateStudent} className="grid grid-cols-2 gap-3 mb-6">
            <input
              placeholder="Reg No"
              required
              value={studentForm.reg_no}
              onChange={(e) => setStudentForm({ ...studentForm, reg_no: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="First Name"
              required
              value={studentForm.first_name}
              onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Last Name"
              required
              value={studentForm.last_name}
              onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Phone"
              value={studentForm.phone}
              onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
              className="border p-2 rounded"
            />
            <select
              value={studentForm.gender}
              onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">Gender (optional)</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="date"
              placeholder="DOB"
              value={studentForm.date_of_birth}
              onChange={(e) => setStudentForm({ ...studentForm, date_of_birth: e.target.value })}
              className="border p-2 rounded"
            />
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
                {editingStudent ? "Update Student" : "Add Student"}
              </button>
              {editingStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingStudent(null);
                    setStudentForm({
                      reg_no: "",
                      first_name: "",
                      last_name: "",
                      email: "",
                      phone: "",
                      gender: "",
                      date_of_birth: "",
                    });
                  }}
                  className="bg-gray-200 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h3 className="text-lg font-semibold mb-2">Students</h3>
          <div className="overflow-auto bg-white rounded shadow">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Reg No</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.reg_no}</td>
                    <td className="p-2">{s.first_name} {s.last_name}</td>
                    <td className="p-2">{s.email || "-"}</td>
                    <td className="p-2">{s.phone || "-"}</td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => editStudent(s)} className="text-blue-600">Edit</button>
                      <button onClick={() => deleteStudent(s.id)} className="text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- TEACHERS ---------- */}
      {activeTab === "teachers" && (
        <div>
          <h2 className="text-xl font-semibold mb-3">{editingTeacher ? "Edit Teacher" : "Add Teacher"}</h2>
          <form onSubmit={addOrUpdateTeacher} className="grid grid-cols-2 gap-3 mb-6">
            <input
              placeholder="First Name"
              required
              value={teacherForm.first_name}
              onChange={(e) => setTeacherForm({ ...teacherForm, first_name: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Last Name"
              required
              value={teacherForm.last_name}
              onChange={(e) => setTeacherForm({ ...teacherForm, last_name: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Teacher Code"
              required
              value={teacherForm.teacher_code}
              onChange={(e) => setTeacherForm({ ...teacherForm, teacher_code: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Email"
              value={teacherForm.email}
              onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Phone"
              value={teacherForm.phone}
              onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
              className="border p-2 rounded"
            />
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">
                {editingTeacher ? "Update Teacher" : "Add Teacher"}
              </button>
              {editingTeacher && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeacher(null);
                    setTeacherForm({ first_name: "", last_name: "", email: "", phone: "", teacher_code: "" });
                  }}
                  className="bg-gray-200 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h3 className="text-lg font-semibold mb-2">Teachers</h3>
          <div className="overflow-auto bg-white rounded shadow">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.first_name} {t.last_name}</td>
                    <td className="p-2">{t.email || "-"}</td>
                    <td className="p-2">{t.phone || "-"}</td>
                    <td className="p-2">{t.teacher_code}</td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => editTeacher(t)} className="text-blue-600">Edit</button>
                      <button onClick={() => deleteTeacher(t.id)} className="text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- ASSESSMENTS ---------- */}
      {activeTab === "assessments" && (
        <div>
          <h2 className="text-xl font-semibold mb-3">{editingAssessment ? "Edit Assessment" : "Create Assessment"}</h2>

          <form onSubmit={addOrUpdateAssessment} className="grid grid-cols-3 gap-3 mb-6">
            <input
              placeholder="Title (e.g. CAT 1 - Maths)"
              value={assessmentForm.title}
              onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })}
              className="border p-2 rounded col-span-2"
              required
            />
            <select
              value={assessmentForm.class_id}
              onChange={(e) => setAssessmentForm({ ...assessmentForm, class_id: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">All Classes (optional)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.grade_level ? ` - ${c.grade_level}` : ""}
                </option>
              ))}
            </select>

            <input
              placeholder="Term (number)"
              value={assessmentForm.term}
              onChange={(e) => setAssessmentForm({ ...assessmentForm, term: e.target.value })}
              className="border p-2 rounded"
              required
            />
            <input
              placeholder="Year (e.g. 2025)"
              value={assessmentForm.year}
              onChange={(e) => setAssessmentForm({ ...assessmentForm, year: e.target.value })}
              className="border p-2 rounded"
              required
            />
            <div className="flex items-center gap-2">
              <button disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded">
                {editingAssessment ? "Update Assessment" : "Create Assessment"}
              </button>
              {editingAssessment && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssessment(null);
                    setAssessmentForm({ title: "", term: "", year: "", class_id: "" });
                  }}
                  className="bg-gray-200 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h3 className="text-lg font-semibold mb-2">All Assessments</h3>
          <div className="overflow-auto bg-white rounded shadow mb-6">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Term</th>
                  <th className="p-2 text-left">Year</th>
                  <th className="p-2 text-left">Class</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.title}</td>
                    <td className="p-2">{a.term}</td>
                    <td className="p-2">{a.year}</td>
                    <td className="p-2">
                      {classes.find((c) => c.id === a.class_id)?.name || "All"}
                    </td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => editAssessment(a)} className="text-blue-600">Edit</button>
                      <button onClick={() => deleteAssessment(a.id)} className="text-red-600">Delete</button>
                      <button onClick={() => fetchResultsForAssessment(a.id)} className="text-green-600">Manage Results</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- RESULTS MANAGEMENT ---------- */}
      {activeTab === "results" && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Manage Results</h2>

          <div className="mb-4 flex gap-3 items-center">
            <select
              className="border p-2 rounded"
              value={selectedAssessmentId || ""}
              onChange={(e) => fetchResultsForAssessment(e.target.value)}
            >
              <option value="">Select Assessment...</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} — Term {a.term} {a.year} {classes.find((c) => c.id === a.class_id) ? `(${classes.find((c) => c.id === a.class_id).name})` : ""}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                // open create-assessment tab
                setActiveTab("assessments");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="bg-indigo-600 text-white px-3 py-2 rounded"
            >
              Create Assessment
            </button>
          </div>

          {selectedAssessmentId ? (
            <>
              <form onSubmit={addOrUpdateResult} className="grid grid-cols-4 gap-3 mb-4">
                <select
                  className="border p-2 rounded"
                  value={resultForm.student_id}
                  onChange={(e) => setResultForm({ ...resultForm, student_id: e.target.value })}
                  required
                >
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.student_id || s.id}>
                      {s.reg_no} — {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>

                <select
                  className="border p-2 rounded"
                  value={resultForm.subject_id}
                  onChange={(e) => setResultForm({ ...resultForm, subject_id: e.target.value })}
                  required
                >
                  <option value="">Select Subject</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>

                <input
                  placeholder="Score"
                  value={resultForm.score}
                  onChange={(e) => setResultForm({ ...resultForm, score: e.target.value })}
                  className="border p-2 rounded"
                  required
                />

                <input
                  placeholder="Max Marks"
                  value={resultForm.max_marks}
                  onChange={(e) => setResultForm({ ...resultForm, max_marks: e.target.value })}
                  className="border p-2 rounded"
                  type="number"
                />

                <input
                  type="date"
                  value={resultForm.assessment_date}
                  onChange={(e) => setResultForm({ ...resultForm, assessment_date: e.target.value })}
                  className="border p-2 rounded col-span-2"
                />

                <div className="col-span-2 flex gap-2">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>
                    {resultForm.id ? "Update Result" : "Add Result"}
                  </button>
                  {resultForm.id && (
                    <button
                      type="button"
                      onClick={() =>
                        setResultForm({ id: null, student_id: "", subject_id: "", score: "", max_marks: 100, assessment_date: "" })
                      }
                      className="bg-gray-200 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <h3 className="text-lg font-semibold mb-2">Results for Selected Assessment</h3>
              <div className="overflow-auto bg-white rounded shadow">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Student</th>
                      <th className="p-2 text-left">Subject</th>
                      <th className="p-2 text-left">Score</th>
                      <th className="p-2 text-left">Max</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          {r.student?.reg_no || "-"} — {r.student?.first_name || "-"} {r.student?.last_name || "-"}
                        </td>
                        <td className="p-2">
                          {subjects.find((s) => s.id === r.subject_id)?.name || r.subject_id}
                        </td>
                        <td className="p-2">{r.score}</td>
                        <td className="p-2">{r.max_marks}</td>
                        <td className="p-2">{r.assessment_date ? new Date(r.assessment_date).toLocaleDateString() : "-"}</td>
                        <td className="p-2 space-x-2">
                          <button onClick={() => editResult(r)} className="text-blue-600">Edit</button>
                          <button onClick={() => deleteResult(r.id)} className="text-red-600">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td className="p-4 text-center" colSpan="6">No results yet for this assessment.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">Select an assessment above to manage its results.</p>
          )}
        </div>
      )}

      {/* ---------- ANNOUNCEMENTS ---------- */}
      {activeTab === "announcements" && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Post Announcement</h2>
          <form onSubmit={addAnnouncement} className="grid grid-cols-3 gap-3 mb-6">
            <input
              placeholder="Title"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
              required
              className="border p-2 rounded col-span-2"
            />
            <select
              value={announcementForm.class_id}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, class_id: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <textarea
              placeholder="Content (optional)"
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
              className="border p-2 rounded col-span-3"
              rows={3}
            />

            <div className="col-span-3">
              <button disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded">
                Post Announcement
              </button>
            </div>
          </form>

          <h3 className="text-lg font-semibold mb-2">Recent Announcements</h3>
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white p-3 rounded shadow">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-semibold">{a.title}</h4>
                    <p className="text-sm text-gray-600">{a.content}</p>
                    <small className="text-xs text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</small>
                  </div>
                  <div className="space-y-2">
                    <button onClick={() => deleteAnnouncement(a.id)} className="text-red-600">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
