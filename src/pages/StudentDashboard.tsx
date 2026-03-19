// StudentDashboard.tsx (updated with academic progress card)
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Navbar } from "@/Components/Navbar";
import { User, BookOpen, Bell, Calendar, BarChart3, FileText, TrendingUp, Target, Settings, Award, CreditCard, ShieldCheck, ShieldAlert, Mail, Phone, Download, Printer, ChevronLeft, Home, Megaphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle, DialogFooter } from "@/Components/ui/dialog";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Input } from "@/Components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Import components directly (NOT lazy loaded)
import Assessments from "./assessments";
import AssignmentAnnouncement from "./assignment_announcement";

// Import the new Fees Dialog
import StudentFeesDialog from "@/Components/Fees/StudentFeesDialog";

// Import utility functions from assessments
import { calculateKJSEAGrade } from "@/utils/assessmentUtils";

// ── NEW: Academic Calendar type ───────────────────────────────────────────────
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
  // State for main dashboard only
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

  // ── NEW: Academic calendar state ──────────────────────────────────────────
  const [academicCalendar, setAcademicCalendar] = useState<AcademicCalendarTerm[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  // Derived active term — the single term with is_current = true
  const [activeTerm, setActiveTerm] = useState<AcademicCalendarTerm | null>(null);

  // State for academic performance data (fetched from assessments)
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    totalExams: 0,
    averageScore: 0,
    currentLevel: "Pending",
    recentPerformance: []
  });
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // State for announcement previews
  const [announcementPreviews, setAnnouncementPreviews] = useState<AnnouncementPreview[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // Tab state for mobile navigation (5 tabs)
  const [activeTab, setActiveTab] = useState<"overview" | "assessments" | "assignments" | "fees" | "settings">("overview");

  // Tab content states
  const [showAssessments, setShowAssessments] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showFees, setShowFees] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Modal states for web view (for backward compatibility)
  const [isAssessmentsOpen, setIsAssessmentsOpen] = useState(false);
  const [isAssignmentsAnnouncementsOpen, setIsAssignmentsAnnouncementsOpen] = useState(false);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Fees dialog state for web view
  const [isFeesDialogOpen, setIsFeesDialogOpen] = useState(false);
  const [feesStudentData, setFeesStudentData] = useState<any>(null);

  // Handle tab switching (similar to teacher dashboard)
  const handleTabSwitch = (tab: "overview" | "assessments" | "assignments" | "fees" | "settings") => {
    setActiveTab(tab);
    
    // Close all tab content first
    setShowAssessments(false);
    setShowAssignments(false);
    setShowFees(false);
    setShowSettings(false);
    
    // Open the selected tab content
    if (tab === "assessments") setShowAssessments(true);
    else if (tab === "assignments") setShowAssignments(true);
    else if (tab === "fees") setShowFees(true);
    else if (tab === "settings") setShowSettings(true);
  };

  // Helper to normalize relation fields
  const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
    if (!rel) return undefined;
    return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
  };

  // Calculate KJSEA Grade based on average percentage
  const calculateGradeFromAverage = (averagePercentage: number): string => {
    return calculateKJSEAGrade(averagePercentage / 100);
  };

  // ── NEW: Fetch academic calendar from admin table ─────────────────────────
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
      // Derive and store the active term so attendance can use it
      const current = terms.find((t) => t.is_current) ?? null;
      setActiveTerm(current);
    } catch (err) {
      console.error("Unexpected error fetching academic calendar:", err);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Fetch student performance data (similar to assessments.tsx)
  const fetchPerformanceData = async () => {
  if (!studentId || !classId) return;
  
  setPerformanceLoading(true);
  try {
    // Step 1: Fetch all student rankings
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
      // Step 2: Cross-reference assessments table to filter summative only
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

      // Filter to summative only
      const summativeRankings = rankingsData.filter(
        (r) => categoryMap[r.assessment_id] === "summative"
      );

      const recentExams = summativeRankings.slice(0, 10);
      const totalExams = recentExams.length;
      
      if (totalExams === 0) {
        setPerformanceData({
          totalExams: 0,
          averageScore: 0,
          currentLevel: "No data",
          recentPerformance: []
        });
        return;
      }

      const totalPercentage = recentExams.reduce((sum, exam) => sum + exam.percentage, 0);
      const averageScore = Math.round(totalPercentage / totalExams);
      const currentLevel = calculateGradeFromAverage(averageScore);
      
      const recentPerformance = recentExams.map(exam => ({
        title: exam.exam_title,
        percentage: exam.percentage,
        classPosition: exam.class_position,
        date: exam.assessment_date
      }));

      setPerformanceData({
        totalExams,
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

  // Fetch announcement previews — mirrors fetchAnnouncements in assignment_announcement.tsx exactly
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

      // Filter out expired announcements (same logic as assignment_announcement.tsx)
      const now = new Date();
      const active = (data || []).filter(
        (a) => !a.expires_at || new Date(a.expires_at) >= now
      );

      setAnnouncementPreviews(active.slice(0, 3));
    } catch (err) {
      console.error("Error fetching announcement previews:", err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // Fetch authenticated user once and store it
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

  // ── NEW: Fetch academic calendar on mount ─────────────────────────────────
  useEffect(() => {
    fetchAcademicCalendar();
  }, []);

  // Fetch all student data in one optimized query to prevent multiple round trips
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

  // ── UPDATED: Fetch attendance scoped to the active academic term ───────────
  // Mirrors the admin AttendanceSection which only counts weeks within the term.
  // Falls back to all-time attendance when no active term is configured.
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

        // If an active term exists, restrict records to that term's date range
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

          attendanceRecords.forEach(record => {
            const weekDays = [record.monday, record.tuesday, record.wednesday, record.thursday, record.friday];
            
            weekDays.forEach(dayPresent => {
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

    // Re-run whenever studentId changes OR whenever the active term resolves/changes.
    // calendarLoading guard ensures we don't fetch before the term is known.
    if (!calendarLoading) {
      fetchAttendance();
    }
  }, [studentId, activeTerm, calendarLoading]);

  // Fetch performance data when studentId and classId are available
  useEffect(() => {
    if (studentId && classId) {
      fetchPerformanceData();
    }
  }, [studentId, classId]);

  // Fetch announcement previews when classId is available
  useEffect(() => {
    if (classId) {
      fetchAnnouncementPreviews();
    }
  }, [classId]);

  // Handle fees management - reuses existing profile and student data
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

  // Password update handler - uses existing profile data
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      setSettingsLoading(false);
      return;
    }

    try {
      // Directly update password without verification - user is already authenticated
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      alert("Password updated successfully!");
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSettingsOpen(false);

    } catch (error: any) {
      alert(error.message || "An error occurred while updating password");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Reset password form when modal closes
  useEffect(() => {
    if (!isSettingsOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      setPasswordSuccess(null);
    }
  }, [isSettingsOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!profile) return <p>No student profile found.</p>;

  // Format announcement date
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

  // Overview Content Component
  const OverviewContent = () => (
    <div className="space-y-6 md:space-y-8">
      {/* WELCOME HEADER */}
      <div className="bg-maroon-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-maroon-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
          <div className="flex-1 w-full">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
              Welcome, {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
              Ready to achieve your academic goals today
            </p>
            
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6 mt-4 text-xs sm:text-sm text-gray-600 pb-4 border-b border-maroon-100">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-maroon" />
                <span>ID: <span className="font-semibold">{profile?.reg_no}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-maroon" />
                <span>Class: <span className="font-semibold">{className}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-3 w-3 sm:h-4 sm:w-4 text-maroon" />
                <span>Current Level: <span className="font-semibold">{performanceData.currentLevel}</span></span>
              </div>
            </div>
            
            {/* Buttons for web view - hidden on mobile */}
            <div className="hidden sm:flex flex-wrap gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssessmentsOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gray-300 text-gray-700 hover:bg-maroon hover:text-white transition-colors text-xs sm:text-sm px-3 py-2 h-auto min-h-[40px]"
              >
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">View Assessments</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignmentsAnnouncementsOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gray-300 text-gray-700 hover:bg-maroon hover:text-white transition-colors text-xs sm:text-sm px-3 py-2 h-auto min-h-[40px]"
              >
                <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Assignments & Announcements</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleFeesManagement();
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gray-300 text-gray-700 hover:bg-maroon hover:text-white transition-colors text-xs sm:text-sm px-3 py-2 h-auto min-h-[40px]"
              >
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Fee Statement</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSettingsOpen(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gray-300 text-gray-700 hover:bg-maroon hover:text-white transition-colors text-xs sm:text-sm px-3 py-2 h-auto min-h-[40px]"
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Settings</span>
              </Button>
            </div>
          </div>
          
          {/* ── ATTENDANCE BOX IN WELCOME CARD ── now shows both % and X/Y days */}
          <div className="flex flex-col items-center sm:items-end gap-4 mt-4 sm:mt-0 sm:ml-6 flex-shrink-0 w-full sm:w-auto">
            <div className="bg-maroon/5 rounded-xl p-4 text-center min-w-[100px] sm:min-w-28 border border-maroon/10 shadow-lg w-full sm:w-auto">
              <div className="text-2xl sm:text-3xl font-extrabold text-maroon">
                {attendanceData?.attendanceRate || 0}%
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                Attendance Rate
                {activeTerm && (
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    Term {activeTerm.term} · {activeTerm.academic_year}
                  </span>
                )}
              </div>
              {attendanceData && (
                <div className="text-xs font-semibold text-maroon mt-1">
                  {attendanceData.presentDays}/{attendanceData.totalDays} days
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD SUMMARY CARDS - 3 CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Academic Progress Card */}
        <Card className="bg-maroon-50 border-l-4 border-l-maroon">
          <CardHeader className="flex flex-row items-center space-y-0 pb-3 sm:pb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-maroon/10 rounded-full flex items-center justify-center mr-3 sm:mr-4">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-maroon" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg text-gray-900">Academic Progress</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-gray-600">Overall performance</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {performanceLoading ? (
              <div className="space-y-2 sm:space-y-3">
                <div className="animate-pulse flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="animate-pulse flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded w-8"></div>
                </div>
                <div className="animate-pulse flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-700">Current Level</span>
                  <Badge variant="secondary" className="bg-maroon/10 text-maroon text-xs">
                    {performanceData.currentLevel}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-700">Exams Completed</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">
                    {performanceData.totalExams}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-700">Average Score</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">
                    {performanceData.averageScore}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Summary Card */}
        <Card className="border-l-4 border-l-green-500 bg-white">
          <CardHeader className="flex flex-row items-center space-y-0 pb-3 sm:pb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center mr-3 sm:mr-4">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg text-gray-900">Today's Summary</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-gray-600">Your current status</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-700">Attendance Today</span>
                <Badge variant="outline" className="border-green-200 text-green-700 text-xs">
                  {attendanceData?.presentDays || 0} days
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-700">Class</span>
                <span className="text-xs sm:text-sm font-medium text-gray-900">{className}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-700">Student ID</span>
                <span className="text-xs sm:text-sm font-medium text-gray-900">{profile?.reg_no}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── ANNOUNCEMENTS CARD — entire card is tappable ── */}
        <Card
          onClick={() => {
            if (window.innerWidth < 640) {
              handleTabSwitch("assignments");
            } else {
              setIsAssignmentsAnnouncementsOpen(true);
            }
          }}
          className="border-l-4 border-l-blue-500 bg-white sm:col-span-2 lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-3 sm:pb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3 sm:mr-4">
              <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg text-gray-900">Announcements</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-gray-600">Latest updates</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {announcementsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex flex-col gap-1 p-2 rounded-lg bg-gray-50">
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : announcementPreviews.length === 0 ? (
              <div className="text-center py-4">
                <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-xs sm:text-sm">No announcements yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcementPreviews.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="w-full text-left p-2 rounded-lg bg-blue-50"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate leading-tight">
                        {announcement.title}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
                        {formatAnnouncementDate(announcement.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1 leading-snug">
                      {announcement.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QUICK ACTIONS - Hidden on mobile */}
      <Card className="hidden sm:block bg-gradient-to-r from-maroon/5 to-maroon/10 border-maroon/20">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl text-gray-900">Quick Actions</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Access important features quickly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={() => setIsAssessmentsOpen(true)}
              className="flex flex-col items-center justify-center h-24 bg-white hover:bg-maroon hover:text-white transition-all border border-maroon/20"
            >
              <BarChart3 className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Assessments</span>
              <span className="text-xs text-gray-500 hover:text-white">View Results</span>
            </Button>
            
            <Button
              onClick={() => setIsAssignmentsAnnouncementsOpen(true)}
              className="flex flex-col items-center justify-center h-24 bg-white hover:bg-maroon hover:text-white transition-all border border-maroon/20"
            >
              <Bell className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Announcements</span>
              <span className="text-xs text-gray-500 hover:text-white">Latest Updates</span>
            </Button>
            
            <Button
              onClick={handleFeesManagement}
              className="flex flex-col items-center justify-center h-24 bg-white hover:bg-maroon hover:text-white transition-all border border-maroon/20"
            >
              <CreditCard className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Fee Statement</span>
              <span className="text-xs text-gray-500 hover:text-white">View Balance</span>
            </Button>
            
            <Button
              onClick={() => setIsSettingsOpen(true)}
              className="flex flex-col items-center justify-center h-24 bg-white hover:bg-maroon hover:text-white transition-all border border-maroon/20"
            >
              <Settings className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Settings</span>
              <span className="text-xs text-gray-500 hover:text-white">Account Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Settings Content Component for Mobile Tab
  const SettingsContent = () => {
    const [mobileCurrentPassword, setMobileCurrentPassword] = useState("");
    const [mobileNewPassword, setMobileNewPassword] = useState("");
    const [mobileConfirmPassword, setMobileConfirmPassword] = useState("");
    const [mobilePasswordLoading, setMobilePasswordLoading] = useState(false);

    const handleMobilePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setMobilePasswordLoading(true);

      if (mobileNewPassword !== mobileConfirmPassword) {
        alert("New passwords do not match!");
        setMobilePasswordLoading(false);
        return;
      }

      try {
        // Directly update password without verification - user is already authenticated
        const { error: updateError } = await supabase.auth.updateUser({
          password: mobileNewPassword
        });

        if (updateError) throw updateError;

        alert("Password updated successfully!");
        
        setMobileCurrentPassword("");
        setMobileNewPassword("");
        setMobileConfirmPassword("");

      } catch (error: any) {
        alert(error.message || "An error occurred while updating password");
      } finally {
        setMobilePasswordLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Account Settings
          </h1>
          <p className="text-sm text-gray-600">
            Update your account password and security settings
          </p>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-r from-maroon/5 to-maroon/10 border-maroon/20">
            <CardContent className="p-4">
              <h4 className="font-semibold text-lg text-gray-900 mb-3 flex items-center">
                <User className="h-5 w-5 mr-2 text-maroon" />
                Student Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="text-gray-900">{profile?.first_name} {profile?.last_name}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                  <span className="font-medium text-gray-700">Student ID:</span>
                  <span className="text-gray-900 font-mono">{profile?.reg_no}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                  <span className="font-medium text-gray-700">Class:</span>
                  <span className="text-gray-900">{className}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="text-gray-900 text-sm truncate max-w-[150px]">{profile?.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-maroon/20 overflow-hidden shadow-lg">
            <CardContent className="p-0">
              <div className="bg-maroon p-4 text-white flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Change Password
                </h3>
                <ShieldAlert className="h-5 w-5 text-maroon-light opacity-50" />
              </div>

              <div className="p-4 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start">
                  <div className="bg-amber-100 p-1.5 rounded-full">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Account Security</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
                      You're currently logged in. Enter your new password below to update your account credentials.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleMobilePasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="mobileNewPassword" className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                      New Password
                    </label>
                    <Input
                      id="mobileNewPassword"
                      type="password"
                      value={mobileNewPassword}
                      onChange={(e) => setMobileNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      disabled={mobilePasswordLoading}
                      className="w-full border-gray-300 focus:border-maroon focus:ring-maroon h-11 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="mobileConfirmPassword" className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                      Confirm New Password
                    </label>
                    <Input
                      id="mobileConfirmPassword"
                      type="password"
                      value={mobileConfirmPassword}
                      onChange={(e) => setMobileConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      disabled={mobilePasswordLoading}
                      className="w-full border-gray-300 focus:border-maroon focus:ring-maroon h-11 text-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-maroon hover:bg-maroon/90 text-white font-bold py-4 shadow-md transition-all active:scale-95 text-sm"
                    disabled={mobilePasswordLoading}
                  >
                    {mobilePasswordLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating Password...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Update Password
                      </div>
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white touch-manipulation pb-20 sm:pb-0">
      <Navbar {...({ showLogout: true, handleLogout } as any)} />
      
      {/* Tab Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {/* Overview Dashboard - Only shown when activeTab is "overview" */}
        {activeTab === "overview" ? (
          <OverviewContent />
        ) : activeTab === "assessments" ? (
          /* Assessments Tab - Full screen focus on mobile */
          <div className="space-y-4 sm:space-y-6">
            {/* Back to Overview Button - Only shown on mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTabSwitch("overview")}
              className="flex items-center gap-2 mb-4 sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Overview
            </Button>

            {/* Page Title - Only shown when in mobile tab view */}
            <div className="mb-6 sm:hidden">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Assessments
              </h1>
              <p className="text-sm text-gray-600">
                View your exam results and performance analysis
              </p>
            </div>

            {showAssessments && (
              <Assessments
                studentId={studentId}
                classId={classId}
                className={className}
                profile={profile}
                isOpen={true}
                onClose={() => handleTabSwitch("overview")}
                academicCalendar={academicCalendar}
              />
            )}
          </div>
        ) : activeTab === "assignments" ? (
          /* Assignments Tab - Full screen focus on mobile */
          <div className="space-y-4 sm:space-y-6">
            {/* Back to Overview Button - Only shown on mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTabSwitch("overview")}
              className="flex items-center gap-2 mb-4 sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Overview
            </Button>

            {/* Page Title - Only shown when in mobile tab view */}
            <div className="mb-6 sm:hidden">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Assignments & Announcements
              </h1>
              <p className="text-sm text-gray-600">
                Check due work and important announcements
              </p>
            </div>

            {showAssignments && (
              <AssignmentAnnouncement
                classId={classId}
                isOpen={true}
                onClose={() => handleTabSwitch("overview")}
              />
            )}
          </div>
        ) : activeTab === "fees" ? (
          /* Fees Tab - Full screen focus on mobile */
          <div className="space-y-4 sm:space-y-6">
            {/* Back to Overview Button - Only shown on mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTabSwitch("overview")}
              className="flex items-center gap-2 mb-4 sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Overview
            </Button>

            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Fee Statement
              </h1>
              <p className="text-sm text-gray-600">
                View your fee balance, payment history, and fee breakdown
              </p>
            </div>

            {showFees && profile && student && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <StudentFeesDialog 
                  onClose={() => handleTabSwitch("overview")}
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
        ) : activeTab === "settings" ? (
          /* Settings Tab - Full screen focus on mobile */
          <div className="space-y-4 sm:space-y-6">
            {/* Back to Overview Button - Only shown on mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTabSwitch("overview")}
              className="flex items-center gap-2 mb-4 sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Overview
            </Button>

            {showSettings && <SettingsContent />}
          </div>
        ) : null}
      </div>

      {/* MODALS FOR WEB VIEW (not lazy loaded) */}
      {isAssessmentsOpen && (
        <Assessments
          studentId={studentId}
          classId={classId}
          className={className}
          profile={profile}
          isOpen={isAssessmentsOpen}
          onClose={() => setIsAssessmentsOpen(false)}
          academicCalendar={academicCalendar}
        />
      )}

      {isAssignmentsAnnouncementsOpen && (
        <AssignmentAnnouncement
          classId={classId}
          isOpen={isAssignmentsAnnouncementsOpen}
          onClose={() => setIsAssignmentsAnnouncementsOpen(false)}
        />
      )}

      {/* FEES DIALOG - For web view only */}
      <Dialog open={isFeesDialogOpen} onOpenChange={setIsFeesDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-hidden p-0 border-maroon/20 bg-white mx-2">
          <VisuallyHidden>
            <DialogTitle>Student Fee Statement</DialogTitle>
            <DialogDescription>
              View student fee balance, payment history, and fee breakdown
            </DialogDescription>
          </VisuallyHidden>

          <StudentFeesDialog 
            onClose={() => setIsFeesDialogOpen(false)}
            studentData={feesStudentData}
            classId={classId}
            className={className} isMobileTab={false}          />
        </DialogContent>
      </Dialog>

      {/* SETTINGS MODAL - For web view only */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[80vh] overflow-y-auto bg-white mx-2">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
            <DialogTitle className="flex items-center text-lg sm:text-xl font-bold text-maroon">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-maroon" />
              Account Settings
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-gray-600">
              Update your account password and security settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 py-4">
            <Card className="bg-gradient-to-r from-maroon/5 to-maroon/10 border-maroon/20">
              <CardContent className="p-3 sm:p-4">
                <h4 className="font-semibold text-base sm:text-lg text-gray-900 mb-2 sm:mb-3 flex items-center">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" />
                  Student Information
                </h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                    <span className="font-medium text-gray-700">Name:</span>
                    <span className="text-gray-900">{profile?.first_name} {profile?.last_name}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                    <span className="font-medium text-gray-700">Student ID:</span>
                    <span className="text-gray-900 font-mono">{profile?.reg_no}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                    <span className="font-medium text-gray-700">Class:</span>
                    <span className="text-gray-900">{className}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded">
                    <span className="font-medium text-gray-700">Email:</span>
                    <span className="text-gray-900 text-xs truncate max-w-[150px]">{profile?.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-maroon/20 overflow-hidden shadow-lg">
              <CardContent className="p-0">
                <div className="bg-maroon p-3 sm:p-4 text-white flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Change Password
                  </h3>
                  <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-maroon-light opacity-50" />
                </div>

                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start animate-in fade-in duration-500">
                    <div className="bg-amber-100 p-1.5 rounded-full">
                      <ShieldAlert className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Account Security</p>
                      <p className="text-[10px] sm:text-[11px] text-amber-700 leading-relaxed mt-1">
                        You're currently logged in. Enter your new password below to update your account credentials.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handlePasswordUpdate} className="space-y-3 sm:space-y-4">
                    <div className="space-y-1 sm:space-y-2">
                      <label htmlFor="newPassword" className="text-xs sm:text-sm font-medium text-gray-700 flex items-center">
                        <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                        New Password
                      </label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        disabled={passwordLoading}
                        className="w-full border-gray-300 focus:border-maroon focus:ring-maroon h-10 sm:h-11 text-sm"
                      />
                    </div>

                    <div className="space-y-1 sm:space-y-2">
                      <label htmlFor="confirmPassword" className="text-xs sm:text-sm font-medium text-gray-700 flex items-center">
                        <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                        Confirm New Password
                      </label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        disabled={passwordLoading}
                        className="w-full border-gray-300 focus:border-maroon focus:ring-maroon h-10 sm:h-11 text-sm"
                      />
                    </div>

                    <Button
                      onClick={handlePasswordUpdate}
                      className="w-full bg-maroon hover:bg-maroon/90 text-white font-bold py-4 sm:py-6 shadow-md transition-all active:scale-95 text-sm"
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                          Updating Password...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          Update Password
                        </div>
                      )}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation Bar for Mobile - Now with 5 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-50 shadow-lg">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => handleTabSwitch("overview")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "overview" 
                ? "text-maroon border-t-2 border-maroon" 
                : "text-gray-500"
            }`}
          >
            <Home className="h-5 w-5 mb-1" />
            <span className="text-xs">Overview</span>
          </button>
          
          <button
            onClick={() => handleTabSwitch("assessments")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "assessments" 
                ? "text-maroon border-t-2 border-maroon" 
                : "text-gray-500"
            }`}
          >
            <BarChart3 className="h-5 w-5 mb-1" />
            <span className="text-xs">Assessments</span>
          </button>
          
          <button
            onClick={() => handleTabSwitch("assignments")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "assignments" 
                ? "text-maroon border-t-2 border-maroon" 
                : "text-gray-500"
            }`}
          >
            <Bell className="h-5 w-5 mb-1" />
            <span className="text-xs">Assignments</span>
          </button>

          <button
            onClick={() => handleTabSwitch("fees")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "fees" 
                ? "text-maroon border-t-2 border-maroon" 
                : "text-gray-500"
            }`}
          >
            <CreditCard className="h-5 w-5 mb-1" />
            <span className="text-xs">Fees</span>
          </button>

          <button
            onClick={() => handleTabSwitch("settings")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "settings" 
                ? "text-maroon border-t-2 border-maroon" 
                : "text-gray-500"
            }`}
          >
            <Settings className="h-5 w-5 mb-1" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}