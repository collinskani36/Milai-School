import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Navbar } from "@/Components/Navbar";
import {
  User, BookOpen, Bell, Calendar, BarChart3, FileText, TrendingUp, Target,
  Settings, Award, CreditCard, Mail, Phone,
  Download, Printer, ChevronLeft, Home, Megaphone, Library
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle } from "@/Components/ui/dialog";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Direct imports
import Assessments from "./assessments";
import AssignmentAnnouncement from "./assignment_announcement";
import StudentFeesDialog from "@/Components/Fees/StudentFeesDialog";
import { calculateKJSEAGrade } from "@/utils/assessmentUtils";
import StudentLibrary from "@/Components/Library/StudentLibrary";
import StudentSettingsModal from "@/Components/StudentSettingsModal";

export interface AcademicCalendarTerm {
  id: string;
  academic_year: string;
  term: number;
  term_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: "upcoming" | "active" | "closed";
}

interface AttendanceData {
  totalDays: number;
  presentDays: number;
  attendanceRate: number;
  records: any[];
}

interface StudentProfile {
  id: string;
  reg_no: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  guardian_phone?: string;
  guardian_email?: string;
}

interface PerformanceData {
  totalExams: number;
  averageScore: number;
  currentLevel: string;
  recentPerformance: any[];
}

interface AnnouncementPreview {
  id: string;
  title: string;
  content: string;
  class_id?: string;
  created_at: string;
  priority?: string;
  expires_at?: string | null;
  is_for_all_classes?: boolean;
}

export default function StudentDashboard({ handleLogout }) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const navigate = useNavigate();

  const [academicCalendar, setAcademicCalendar] = useState<AcademicCalendarTerm[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [activeTerm, setActiveTerm] = useState<AcademicCalendarTerm | null>(null);

  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    totalExams: 0,
    averageScore: 0,
    currentLevel: "Pending",
    recentPerformance: []
  });
  const [performanceLoading, setPerformanceLoading] = useState(false);

  const [announcementPreviews, setAnnouncementPreviews] = useState<AnnouncementPreview[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "assessments" | "assignments" | "fees" | "library">("overview");
  const [tabVisible, setTabVisible] = useState(true);

  const [showAssessments, setShowAssessments] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showFees, setShowFees] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isFeesDialogOpen, setIsFeesDialogOpen] = useState(false);
  const [feesStudentData, setFeesStudentData] = useState<any>(null);

  const handleTabSwitch = (tab: "overview" | "assessments" | "assignments" | "fees" | "library", immediate = false) => {
    if (tab === activeTab && !immediate) return;

    if (immediate) {
      setActiveTab(tab);
      setShowAssessments(false);
      setShowAssignments(false);
      setShowFees(false);
      setShowLibrary(false);

      if (tab === "assessments") setShowAssessments(true);
      else if (tab === "assignments") setShowAssignments(true);
      else if (tab === "fees") setShowFees(true);
      else if (tab === "library") setShowLibrary(true);

      return;
    }

    setTabVisible(false);
    setTimeout(() => {
      setActiveTab(tab);
      setShowAssessments(false);
      setShowAssignments(false);
      setShowFees(false);
      setShowLibrary(false);

      if (tab === "assessments") setShowAssessments(true);
      else if (tab === "assignments") setShowAssignments(true);
      else if (tab === "fees") setShowFees(true);
      else if (tab === "library") setShowLibrary(true);

      setTabVisible(true);
    }, 120);
  };

  const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
    if (!rel) return undefined;
    return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : (rel as T);
  };

  const calculateGradeFromAverage = (averagePercentage: number): string => {
    return calculateKJSEAGrade(averagePercentage / 100);
  };

  const fetchAcademicCalendar = async () => {
    setCalendarLoading(true);
    try {
      const { data, error } = await supabase
        .from("academic_calendar")
        .select("id, academic_year, term, term_name, start_date, end_date, is_current, status")
        .order("academic_year", { ascending: false })
        .order("term", { ascending: true });

      if (error) {
        console.error("Error fetching academic calendar:", error);
        return;
      }

      const terms = data || [];
      setAcademicCalendar(terms);
      const current = terms.find((t) => t.is_current) ?? null;
      setActiveTerm(current);
    } catch (err) {
      console.error("Unexpected error fetching academic calendar:", err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchPerformanceData = async () => {
    if (!studentId || !classId) return;

    setPerformanceLoading(true);
    try {
      const { data: rankingsData, error } = await supabase
        .from("student_rankings")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .order("assessment_date", { ascending: false });

      if (error) {
        console.error("Error fetching rankings:", error);
        return;
      }

      if (rankingsData && rankingsData.length > 0) {
        const assessmentIds = rankingsData.map((r) => r.assessment_id);
        const { data: assessmentsData, error: catError } = await supabase
          .from("assessments")
          .select("id, category")
          .in("id", assessmentIds);

        if (catError) {
          console.error("Error fetching assessment categories:", catError);
          return;
        }

        const categoryMap = (assessmentsData || []).reduce((acc, a) => {
          acc[a.id] = a.category;
          return acc;
        }, {} as Record<string, string>);

        const summativeRankings = rankingsData.filter((r) => categoryMap[r.assessment_id] === "summative");
        const recentExams = summativeRankings.slice(0, 10);

        if (recentExams.length === 0) {
          setPerformanceData({
            totalExams: 0,
            averageScore: 0,
            currentLevel: "No data",
            recentPerformance: []
          });
          return;
        }

        const totalPercentage = recentExams.reduce((sum, exam) => sum + exam.percentage, 0);
        const averageScore = Math.round(totalPercentage / recentExams.length);
        const currentLevel = calculateGradeFromAverage(averageScore);

        const recentPerformance = recentExams.map((exam) => ({
          title: exam.exam_title,
          percentage: exam.percentage,
          classPosition: exam.class_position,
          date: exam.assessment_date
        }));

        setPerformanceData({
          totalExams: recentExams.length,
          averageScore,
          currentLevel,
          recentPerformance
        });
      } else {
        setPerformanceData({
          totalExams: 0,
          averageScore: 0,
          currentLevel: "No data",
          recentPerformance: []
        });
      }
    } catch (err) {
      console.error("Error fetching performance data:", err);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const fetchAnnouncementPreviews = async () => {
    if (!classId) return;

    setAnnouncementsLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, class_id, created_at, priority, expires_at, is_for_all_classes")
        .or(`class_id.eq.${classId},is_for_all_classes.eq.true`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcement previews:", error);
        return;
      }

      const now = new Date();
      const active = (data || []).filter((a) => !a.expires_at || new Date(a.expires_at) >= now);

      setAnnouncementPreviews(active.slice(0, 3));
    } catch (err) {
      console.error("Error fetching announcement previews:", err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    const fetchAuthUser = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setAuthUser(userData.user);
      } catch (err: any) {
        console.error("Error fetching auth user:", err);
        setError(err.message);
      }
    };

    fetchAuthUser();
  }, []);

  useEffect(() => {
    fetchAcademicCalendar();
  }, []);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!authUser) return;

      setLoading(true);

      try {
        if (!authUser) throw new Error("User not signed in");

        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select(`
            id,
            Reg_no,
            first_name,
            last_name,
            auth_id,
            profiles!student_id (*),
            enrollments!student_id (
              class_id,
              classes (name)
            )
          `)
          .eq("auth_id", authUser.id)
          .single();

        if (studentError) throw studentError;
        if (!studentData) throw new Error("No student found");

        setStudent(studentData);
        setStudentId(studentData.id);

        const profileData = firstRel(studentData.profiles);
        if (profileData) {
          setProfile(profileData);
        } else {
          throw new Error("No student profile found");
        }

        const enrollmentData = firstRel(studentData.enrollments);
        const classId = enrollmentData?.class_id || null;
        const className = firstRel(enrollmentData?.classes as any)?.name || "Unknown";
        setClassId(classId);
        setClassName(className);
      } catch (err: any) {
        console.error("Error in fetchStudentData:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [authUser]);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!studentId) return;

      setAttendanceLoading(true);
      setAttendanceError(null);
      try {
        let query = supabase
          .from("attendance")
          .select("monday, tuesday, wednesday, thursday, friday, week_start, week_end")
          .eq("student_id", studentId)
          .order("week_start", { ascending: true });

        if (activeTerm) {
          query = query
            .gte("week_start", activeTerm.start_date)
            .lte("week_end", activeTerm.end_date);
        }

        const { data: attendanceRecords, error: attendanceError } = await query;

        if (attendanceError) {
          console.error("Error fetching attendance:", attendanceError.message);
          setAttendanceError(attendanceError.message);
          setAttendanceData(null);
        } else if (attendanceRecords && attendanceRecords.length > 0) {
          let totalSchoolDays = 0;
          let totalDaysPresent = 0;

          attendanceRecords.forEach((record) => {
            const weekDays = [record.monday, record.tuesday, record.wednesday, record.thursday, record.friday];
            weekDays.forEach((dayPresent) => {
              totalSchoolDays++;
              if (dayPresent === true) {
                totalDaysPresent++;
              }
            });
          });

          setAttendanceData({
            totalDays: totalSchoolDays,
            presentDays: totalDaysPresent,
            attendanceRate: totalSchoolDays > 0 ? Math.round((totalDaysPresent / totalSchoolDays) * 100) : 0,
            records: attendanceRecords
          });
        } else {
          setAttendanceData(null);
        }
      } catch (err) {
        console.error("Unexpected error fetching attendance:", err);
        setAttendanceError("Unexpected error occurred");
        setAttendanceData(null);
      } finally {
        setAttendanceLoading(false);
      }
    };

    if (!calendarLoading) {
      fetchAttendance();
    }
  }, [studentId, activeTerm, calendarLoading]);

  useEffect(() => {
    if (studentId && classId) {
      fetchPerformanceData();
    }
  }, [studentId, classId]);

  useEffect(() => {
    if (classId) {
      fetchAnnouncementPreviews();
    }
  }, [classId]);

  const handleFeesManagement = () => {
    if (!profile || !student) return;

    setFeesStudentData({
      ...student,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      Reg_no: profile?.reg_no,
      guardian_phone: profile?.guardian_phone || profile?.phone || "2547XXXXXXXX"
    });
    setIsFeesDialogOpen(true);
  };

  if (loading) {
    return (
      <>
        <div className="sm:hidden h-[100dvh] bg-maroon flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center animate-pulse">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-base tracking-tight">Milai School</p>
            <p className="text-white/50 text-xs mt-1">Loading your dashboard…</p>
          </div>
        </div>

        <div className="hidden sm:flex min-h-screen bg-white items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!profile) return <p>No student profile found.</p>;

  const formatAnnouncementDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const OverviewContent = () => (
    <>
      {/* ============================ MOBILE ============================ */}
      <div className="sm:hidden h-full flex flex-col gap-3">

        {/* --- Identity + stats (the hero card you liked) --- */}
        <div
          className="flex-shrink-0 rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            border: "0.5px solid rgba(122,31,43,0.15)",
            boxShadow: "0 6px 24px -10px rgba(122,31,43,0.35)"
          }}
        >
          <div style={{ position: "relative", background: "linear-gradient(135deg, #7a1f2b 0%, #5f1620 100%)", padding: "16px 56px 14px 16px" }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
              style={{
                position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: 10,
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
              }}
            >
              <Settings size={17} color="#fff" />
            </button>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}
            </p>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15, marginTop: 5 }}>
              {profile.first_name} {profile.last_name}
            </h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, letterSpacing: "0.01em" }}>
              {profile?.reg_no} · {className}
            </p>
          </div>

          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, padding: "13px 16px", borderRight: "0.5px solid rgba(122,31,43,0.08)" }}>
              <p style={{ fontSize: 10, color: "#9b7a7f", marginBottom: 4 }}>Attendance</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#7a1f2b", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {attendanceData?.attendanceRate ?? 0}%
              </p>
              <p style={{ fontSize: 10, color: "#9b7a7f", marginTop: 3 }}>
                {attendanceData ? `${attendanceData.presentDays}/${attendanceData.totalDays} days` : "No records"}
              </p>
            </div>

            <div style={{ flex: 1, padding: "13px 16px", borderRight: "0.5px solid rgba(122,31,43,0.08)" }}>
              <p style={{ fontSize: 10, color: "#9b7a7f", marginBottom: 4 }}>Grade</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#7a1f2b", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                {performanceLoading ? "—" : performanceData.currentLevel}
              </p>
              <p style={{ fontSize: 10, color: "#9b7a7f", marginTop: 3 }}>
                {performanceLoading ? "\u00A0" : `${performanceData.averageScore}% avg`}
              </p>
            </div>

            <div style={{ flex: 1, padding: "13px 16px" }}>
              <p style={{ fontSize: 10, color: "#9b7a7f", marginBottom: 4 }}>Exams</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#7a1f2b", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {performanceLoading ? "—" : performanceData.totalExams}
              </p>
              <p style={{ fontSize: 10, color: "#9b7a7f", marginTop: 3 }}>completed</p>
            </div>
          </div>
        </div>

        {/* --- Updates (fills remaining height, no page scroll) --- */}
        {(() => {
          const [updatesTab, setUpdatesTab] = React.useState<"announcements" | "assignments">("announcements");

          return (
            <div
              className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: "#fff",
                border: "0.5px solid rgba(122,31,43,0.12)",
                boxShadow: "0 6px 24px -12px rgba(122,31,43,0.28)"
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(122,31,43,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bell size={15} color="#7a1f2b" />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#3a1b1f", letterSpacing: "-0.01em", flex: 1 }}>
                  Updates
                </p>
                <button
                  onClick={() => handleTabSwitch("assignments", true)}
                  style={{ fontSize: 10.5, color: "#7a1f2b", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", letterSpacing: "-0.01em" }}
                >
                  See all →
                </button>
              </div>

              {/* Segmented control */}
              <div style={{ margin: "0 16px 12px", display: "flex", gap: 4, background: "#f7f0f1", borderRadius: 10, padding: 3 }}>
                {(["announcements", "assignments"] as const).map((t) => {
                  const isOn = updatesTab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setUpdatesTab(t)}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 7,
                        border: "none",
                        cursor: "pointer",
                        letterSpacing: "-0.01em",
                        background: isOn ? "#fff" : "transparent",
                        color: isOn ? "#7a1f2b" : "#9b7a7f",
                        boxShadow: isOn ? "0 1px 3px rgba(122,31,43,0.14)" : "none",
                        transition: "background 0.16s, color 0.16s, box-shadow 0.16s"
                      }}
                    >
                      {t === "announcements" ? "Announcements" : "Assignments"}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "0 16px 14px" }}>
                {updatesTab === "announcements" ? (
                  announcementsLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          <div style={{ height: 11, borderRadius: 6, background: "#f5eded", width: i === 1 ? "72%" : "58%" }} />
                          <div style={{ height: 9, borderRadius: 6, background: "#faf5f5", width: i === 1 ? "50%" : "38%" }} />
                        </div>
                      ))}
                    </div>
                  ) : announcementPreviews.length === 0 ? (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, paddingBottom: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 13, background: "#faf5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Megaphone size={18} color="#c4a4a8" />
                      </div>
                      <p style={{ fontSize: 11.5, color: "#9b7a7f" }}>No announcements yet</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {announcementPreviews.map((a, i) => (
                        <button
                          key={a.id}
                          onClick={() => handleTabSwitch("assignments", true)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: "none",
                            border: "none",
                            padding: "11px 0",
                            cursor: "pointer",
                            borderTop: i === 0 ? "none" : "0.5px solid rgba(122,31,43,0.07)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#3a1b1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                                {a.title}
                              </p>
                              <p style={{ fontSize: 10.5, color: "#9b7a7f", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {a.content}
                              </p>
                            </div>
                            <span style={{ fontSize: 9.5, color: "#c4a4a8", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>
                              {formatAnnouncementDate(a.created_at)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2 }}>
                    <p style={{ fontSize: 11, color: "#9b7a7f", lineHeight: 1.5 }}>
                      View your assignments, due dates and submissions.
                    </p>
                    <button
                      onClick={() => handleTabSwitch("assignments", true)}
                      style={{
                        width: "100%",
                        background: "#faf6f6",
                        border: "0.5px solid rgba(122,31,43,0.12)",
                        borderRadius: 11,
                        padding: "11px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer"
                      }}
                    >
                      <FileText size={16} color="#7a1f2b" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#3a1b1f", flex: 1, textAlign: "left" }}>
                        Open Assignments
                      </span>
                      <ChevronLeft size={13} color="#9b7a7f" style={{ transform: "rotate(180deg)" }} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ============================ DESKTOP (PREMIUM) ============================ */}
      <div className="hidden sm:block space-y-6">

        {/* --- PREMIUM HERO --- */}
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            background: "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)",
            boxShadow: "0 24px 60px -28px rgba(122,31,43,0.6)"
          }}
        >
          <div
            className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full opacity-60"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
          />

          <div className="relative px-8 py-9 lg:px-10 lg:py-11">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  {activeTerm ? `Term ${activeTerm.term} · ${activeTerm.academic_year}` : "Student Portal"}
                </p>
                <h1 className="mt-3 text-3xl lg:text-[2.5rem] font-bold text-white tracking-tight leading-[1.1]">
                  Welcome back, {profile.first_name}
                </h1>
                <p className="mt-3 text-sm text-white/55 max-w-lg leading-relaxed">
                  Here's a snapshot of your academic journey at Milai School.
                </p>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11.5px] font-medium text-white/85 backdrop-blur-sm">
                    <User className="h-3.5 w-3.5 opacity-70" /> {profile.reg_no}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11.5px] font-medium text-white/85 backdrop-blur-sm">
                    <BookOpen className="h-3.5 w-3.5 opacity-70" /> {className}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11.5px] font-medium text-white/85 backdrop-blur-sm">
                    <Award className="h-3.5 w-3.5 opacity-70" /> {performanceData.currentLevel}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/12 bg-white/[0.07] px-8 py-6 backdrop-blur-md lg:min-w-[180px] lg:shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Attendance</span>
                <span className="mt-2.5 text-[2.75rem] font-bold leading-none tracking-tight text-white">
                  {attendanceData?.attendanceRate ?? 0}
                  <span className="text-2xl text-white/50">%</span>
                </span>
                <span className="mt-2.5 text-[11px] text-white/50">
                  {attendanceData ? `${attendanceData.presentDays} of ${attendanceData.totalDays} days` : "No records yet"}
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                { icon: BarChart3, label: "View Assessments", action: () => handleTabSwitch("assessments", true) },
                { icon: Bell, label: "Assignments & Announcements", action: () => handleTabSwitch("assignments", true) },
                { icon: CreditCard, label: "Fee Statement", action: () => handleFeesManagement() },
                { icon: Library, label: "Library", action: () => handleTabSwitch("library", true) },
                { icon: Settings, label: "Settings", action: () => setIsSettingsOpen(true) }
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-white/90 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-white hover:text-maroon"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --- CONTENT GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          <Card className="lg:col-span-3 rounded-2xl border border-gray-100 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-maroon/10">
                    <TrendingUp className="h-5 w-5 text-maroon" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-gray-900">Academic Progress</CardTitle>
                    <CardDescription className="text-xs text-gray-500">Your latest performance snapshot</CardDescription>
                  </div>
                </div>
                {!performanceLoading && (
                  <span className="rounded-full bg-maroon/10 px-3 py-1 text-[11px] font-semibold text-maroon">
                    Level {performanceData.currentLevel}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="h-3 w-20 rounded bg-gray-200" />
                        <div className="mt-3 h-7 w-16 rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                  <div className="h-2 rounded-full bg-gray-100" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">Average Score</p>
                      <p className="mt-1.5 text-3xl font-bold tracking-tight text-gray-900">
                        {performanceData.averageScore}
                        <span className="text-lg text-gray-400">%</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">Exams Completed</p>
                      <p className="mt-1.5 text-3xl font-bold tracking-tight text-gray-900">
                        {performanceData.totalExams}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-500">Overall attainment</span>
                      <span className="font-semibold text-gray-700">{performanceData.averageScore}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(0, Math.min(100, performanceData.averageScore))}%`,
                          background: "linear-gradient(90deg, #7a1f2b 0%, #a8324a 100%)"
                        }}
                      />
                    </div>
                  </div>

                  {performanceData.recentPerformance.length > 0 && (
                    <div>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Recent Exams</p>
                      <div className="space-y-2">
                        {performanceData.recentPerformance.slice(0, 3).map((exam, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3.5 py-2.5"
                          >
                            <span className="truncate text-sm font-medium text-gray-800">{exam.title}</span>
                            <div className="ml-3 flex shrink-0 items-center gap-3">
                              <span className="text-xs text-gray-400">Pos {exam.classPosition ?? "—"}</span>
                              <span className="text-sm font-semibold text-maroon">{exam.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-2xl border border-gray-100 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-gray-900">Announcements</CardTitle>
                    <CardDescription className="text-xs text-gray-500">Latest from your school</CardDescription>
                  </div>
                </div>
                <button
                  onClick={() => handleTabSwitch("assignments", true)}
                  className="text-xs font-semibold text-maroon hover:underline"
                >
                  See all →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                      <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                      <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
              ) : announcementPreviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                    <Megaphone className="h-5 w-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500">No announcements yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {announcementPreviews.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleTabSwitch("assignments", true)}
                      className="w-full rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-3.5 text-left transition-all hover:border-maroon/20 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{a.title}</p>
                        <span className="shrink-0 text-[10px] font-medium text-gray-400">
                          {formatAnnouncementDate(a.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{a.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="sm:hidden flex flex-col touch-manipulation" style={{ height: "100dvh", overflow: "hidden", background: "#fdfbfb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Navbar showLogout handleLogout={handleLogout} subtitle="Student Dashboard" />

        {/* Tab panel — overview locks to viewport height (no page scroll) */}
        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{
            transition: "opacity 0.12s ease, transform 0.12s ease",
            opacity: tabVisible ? 1 : 0,
            transform: tabVisible ? "translateY(0)" : "translateY(6px)"
          }}
        >
          {activeTab === "overview" ? (
            <div className="flex-1 min-h-0 px-4 pt-4 pb-3">
              <OverviewContent />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-4 py-4 pb-6">
                {activeTab === "assessments" && (
                  <div className="space-y-4">
                    {showAssessments && (
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <Assessments
                          studentId={studentId}
                          classId={classId}
                          className={className}
                          profile={profile}
                          isOpen={true}
                          isMobileTab={true}
                          onClose={() => handleTabSwitch("overview", true)}
                          academicCalendar={academicCalendar}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "assignments" && (
                  <div className="space-y-4">
                    {showAssignments && (
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <AssignmentAnnouncement
                          classId={classId}
                          isOpen={true}
                          isMobileTab={true}
                          onClose={() => handleTabSwitch("overview", true)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "fees" && (
                  <div className="space-y-4">
                    {showFees && profile && student && (
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <StudentFeesDialog
                          onClose={() => handleTabSwitch("overview", true)}
                          studentData={{
                            ...student,
                            first_name: profile?.first_name,
                            last_name: profile?.last_name,
                            Reg_no: profile?.reg_no,
                            guardian_phone: profile?.guardian_phone || profile?.phone || "2547XXXXXXXX"
                          }}
                          classId={classId}
                          className={className}
                          isMobileTab={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "library" && showLibrary && <StudentLibrary classId={classId} />}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: "#fdfbfb", borderTop: "0.5px solid rgba(122,31,43,0.1)", paddingBottom: "env(safe-area-inset-bottom)", flexShrink: 0 }}>
          <div style={{ display: "flex", height: 60 }}>
            {(
              [
                { id: "overview", icon: Home, label: "Home" },
                { id: "assessments", icon: BarChart3, label: "Results" },
                { id: "assignments", icon: Bell, label: "Updates" },
                { id: "fees", icon: CreditCard, label: "Fees" },
                { id: "library", icon: Library, label: "Library" }
              ] as const
            ).map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => handleTabSwitch(id)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, border: "none", background: "transparent", cursor: "pointer", transition: "transform 0.1s ease", transform: "scale(1)" }}
                >
                  <div style={{ width: isActive ? 20 : 0, height: 3, borderRadius: 99, background: "#7a1f2b", marginBottom: 2, transition: "width 0.2s ease", overflow: "hidden" }} />
                  <Icon size={20} color={isActive ? "#7a1f2b" : "#9b7a7f"} strokeWidth={isActive ? 2.2 : 1.7} />
                  <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? "#7a1f2b" : "#9b7a7f", letterSpacing: "-0.01em", lineHeight: 1 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden sm:block min-h-screen bg-white touch-manipulation pb-0">
        <Navbar showLogout handleLogout={handleLogout} subtitle="Student Dashboard" />

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {activeTab === "overview" ? (
            <OverviewContent />
          ) : activeTab === "assessments" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
                  <p className="text-sm text-gray-600">Exam results and performance</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleTabSwitch("overview", true)}>
                  Back to Overview
                </Button>
              </div>

              {showAssessments && (
                <Assessments
                  studentId={studentId}
                  classId={classId}
                  className={className}
                  profile={profile}
                  isOpen={true}
                  onClose={() => handleTabSwitch("overview", true)}
                  academicCalendar={academicCalendar}
                />
              )}
            </div>
          ) : activeTab === "assignments" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Assignments & Announcements</h1>
                  <p className="text-sm text-gray-600">Latest due work and school updates</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleTabSwitch("overview", true)}>
                  Back to Overview
                </Button>
              </div>

              {showAssignments && (
                <AssignmentAnnouncement
                  classId={classId}
                  isOpen={true}
                  onClose={() => handleTabSwitch("overview", true)}
                />
              )}
            </div>
          ) : activeTab === "fees" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Fee Statement</h1>
                  <p className="text-sm text-gray-600">View your fee balance, payment history, and fee breakdown</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleTabSwitch("overview", true)}>
                  Back to Overview
                </Button>
              </div>

              {showFees && profile && student && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <StudentFeesDialog
                    onClose={() => handleTabSwitch("overview", true)}
                    studentData={{
                      ...student,
                      first_name: profile?.first_name,
                      last_name: profile?.last_name,
                      Reg_no: profile?.reg_no,
                      guardian_phone: profile?.guardian_phone || profile?.phone || "2547XXXXXXXX"
                    }}
                    classId={classId}
                    className={className}
                    isMobileTab={true}
                  />
                </div>
              )}
            </div>
          ) : activeTab === "library" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Library</h1>
                  <p className="text-sm text-gray-600">Books and animated lessons</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleTabSwitch("overview", true)}>
                  Back to Overview
                </Button>
              </div>

              {showLibrary && <StudentLibrary classId={classId} />}
            </div>
          ) : null}
        </div>

        <Dialog open={isFeesDialogOpen} onOpenChange={setIsFeesDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-hidden p-0 border-maroon/20 bg-white mx-2">
            <VisuallyHidden>
              <DialogTitle>Student Fee Statement</DialogTitle>
              <DialogDescription>View student fee balance, payment history, and fee breakdown</DialogDescription>
            </VisuallyHidden>

            <StudentFeesDialog
              onClose={() => setIsFeesDialogOpen(false)}
              studentData={feesStudentData}
              classId={classId}
              className={className}
              isMobileTab={false}
            />
          </DialogContent>
        </Dialog>

        <StudentSettingsModal
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          profile={profile}
          classLabel={className}
        />
      </div>
    </>
  );
}