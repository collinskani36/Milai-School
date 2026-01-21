import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Navbar } from "@/Components/Navbar";
import { User, BookOpen, Bell, Calendar, BarChart3, Mail, Phone, Download, Printer, FileText, TrendingUp, Target, Settings, Award, CreditCard, ShieldCheck, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle, DialogFooter } from "@/Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Input } from "@/Components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Add PDF generation imports
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Import the new Fees Dialog
import StudentFeesDialog from "@/Components/Fees/StudentFeesDialog";

interface AttendanceRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  week_start: string;
  week_end: string;
  status: "Present" | "Absent" | "Excused";
  class_id: string | null;
  classes?: {
    name?: string;
    grade_level?: string;
  };
}

interface PerformanceRecord {
  id: string;
  title: string;
  term: string;
  year: number;
  assessment_date: string;
  subjects: {
    name: string;
  };
  score: number;
  total_score: number;
  percentage: number;
  grade: string;
  isEndYearExam?: boolean;
  subjectBreakdown?: any[];
  classPosition: number;
}

interface AttendanceData {
  totalDays: number;
  presentDays: number;
  attendanceRate: number;
  records: any[];
}

// Custom tooltip for line charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">
          Score: <span className="font-semibold text-maroon">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

function extractExamNumber(title: string) {
  const match = title.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

// Calculate KJSEA Achievement Level based on percentage
const calculateKJSEAGrade = (percentage: number): string => {
  const perc = percentage * 100; // Convert decimal to percentage
  
  if (perc >= 90) return "EE1 (Level 8)";
  if (perc >= 75) return "EE2 (Level 7)";
  if (perc >= 58) return "ME1 (Level 6)";
  if (perc >= 41) return "ME2 (Level 5)";
  if (perc >= 31) return "AE1 (Level 4)";
  if (perc >= 21) return "AE2 (Level 3)";
  if (perc >= 11) return "BE1 (Level 2)";
  return "BE2 (Level 1)";
};

// Get grade color for badges
const getGradeColor = (grade: string) => {
  if (grade.includes("EE1")) return "bg-green-100 text-green-800 border-green-200";
  if (grade.includes("EE2")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (grade.includes("ME1")) return "bg-blue-100 text-blue-800 border-blue-200";
  if (grade.includes("ME2")) return "bg-cyan-100 text-cyan-800 border-cyan-200";
  if (grade.includes("AE1")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (grade.includes("AE2")) return "bg-orange-100 text-orange-800 border-orange-200";
  if (grade.includes("BE1")) return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

// Helper to normalize relation fields returned by Supabase (may be object or single-item array)
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

// Helper function for PDF grade styling
const getGradeStyles = (grade: string) => {
  if (grade.includes("EE1")) return "color: #27ae60; font-weight: bold;";
  if (grade.includes("EE2")) return "color: #2980b9; font-weight: bold;";
  if (grade.includes("ME1")) return "color: #3498db; font-weight: bold;";
  if (grade.includes("ME2")) return "color: #9b59b6; font-weight: bold;";
  if (grade.includes("AE1")) return "color: #f39c12; font-weight: bold;";
  if (grade.includes("AE2")) return "color: #e67e22; font-weight: bold;";
  if (grade.includes("BE1")) return "color: #e74c3c; font-weight: bold;";
  return "color: #95a5a6; font-weight: bold;";
};

export default function StudentDashboard({ handleLogout }) {
  // --- NEW STATE FOR SECURITY FIX ---
  const [showWarning, setShowWarning] = useState(false);
  const [revealedContact, setRevealedContact] = useState<{email: string, phone: string} | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  const [subjectAnalysis, setSubjectAnalysis] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceRecord[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // NEW: State for student rankings from the view
  const [studentRankings, setStudentRankings] = useState<any[]>([]);
  const [studentRankingsLoading, setStudentRankingsLoading] = useState(false);

  // Add state for Fees Dialog
  const [isFeesDialogOpen, setIsFeesDialogOpen] = useState(false);
  const [feesStudentData, setFeesStudentData] = useState<any>(null);

  // --- NEW: fetchTeacherContact (Step 2: Fetch PII only after confirmation) ---
  const fetchTeacherContact = async () => {
    if (!teacherInfo?.teacher_id) return;
    
    setContactLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_teacher_info")
        .select("email, phone")
        .eq("teacher_id", teacherInfo.teacher_id)
        .single();

      if (error) throw error;
      
      setRevealedContact(data);
      setShowWarning(false);
    } catch (err) {
      console.error("Error fetching contact:", err);
    } finally {
      setContactLoading(false);
    }
  };

  // Function to handle fees management - NOW AS POPUP
  const handleFeesManagement = () => {
    // Pass student data to the fees dialog
    setFeesStudentData({
      ...student,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      Reg_no: profile?.reg_no,
      guardian_phone: profile?.guardian_phone || profile?.phone || "2547XXXXXXXX" // Use guardian_phone from profile
    });
    setIsFeesDialogOpen(true);
  };

  // NEW: Fetch student rankings from the view
const fetchStudentRankings = async () => {
  if (!studentId || !classId) return;
  
  setStudentRankingsLoading(true);
  try {
    console.log("Fetching student rankings for student:", studentId, "class:", classId);
    
    const { data, error } = await supabase
      .from("student_rankings")
      .select("*")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .order("assessment_date", { ascending: false });

    if (error) {
      console.error("Supabase error fetching rankings:", error);
      throw error;
    }
    
    console.log("Student rankings data:", data);
    setStudentRankings(data || []);
  } catch (err) {
    console.error("Error fetching student rankings:", err);
  } finally {
    setStudentRankingsLoading(false);
  }
};
  // Update the fetchAssignments function to filter by class
  const fetchAssignments = async () => {
    setAssignmentsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }

      // First, get the student's class ID
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (studentError || !studentData) {
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }

      // Get the student's enrollment to find their class
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentData.id)
        .single();

      if (enrollmentError || !enrollmentData) {
        console.error("Error fetching enrollment:", enrollmentError);
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }

      const studentClassId = enrollmentData.class_id;
      
      // Now fetch assignments ONLY for the student's class
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .eq('class_id', studentClassId)  // ADDED: Filter by class ID
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        console.error("Error fetching assignments:", assignmentsError);
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }

      setAssignments(assignmentsData || []);
      setAssignmentsLoading(false);

    } catch (err) {
      console.error('Error fetching assignments:', err);
      setAssignmentsLoading(false);
    }
  };

  // Update the fetchAnnouncements function to be reusable
  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No logged-in user found");
        setAnnouncements([]);
        setAnnouncementsLoading(false);
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (studentError || !studentData) {
        console.error("Error fetching student:", studentError);
        setAnnouncements([]);
        setAnnouncementsLoading(false);
        return;
      }

      const studentId = studentData.id;
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .single();

      if (enrollmentError || !enrollmentData) {
        console.error("Error fetching enrollment:", enrollmentError);
        setAnnouncements([]);
        setAnnouncementsLoading(false);
        return;
      }

      const studentClassId = enrollmentData.class_id;
      
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, class_id, created_at, priority, expires_at, is_for_all_classes")
        .or(`class_id.eq.${studentClassId},is_for_all_classes.eq.true`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error.message);
        setAnnouncements([]);
      } else {
        setAnnouncements(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching announcements:", err);
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // Add real-time subscription to listen for new assignments and announcements
  useEffect(() => {
    if (!classId) return;

    // Subscribe to new assignments for THIS CLASS ONLY
    const assignmentsSubscription = supabase
      .channel('assignments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignments',
          filter: `class_id=eq.${classId}`,  // ADDED: Filter by class ID
        },
        (payload) => {
          console.log('New assignment received:', payload.new);
          // Refresh assignments to include the new one
          fetchAssignments();
        }
      )
      .subscribe();

    // Subscribe to new announcements
    const announcementsSubscription = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          console.log('New announcement received:', payload.new);
          // Refresh announcements to include the new one
          fetchAnnouncements();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      assignmentsSubscription.unsubscribe();
      announcementsSubscription.unsubscribe();
    };
  }, [classId]);

  // Generate insights for performance history
  const getPerformanceInsights = () => {
    if (recentPerformance.length < 2) return null;

    const latestScore = recentPerformance[0].percentage;
    const previousScore = recentPerformance[1].percentage;
    const averageScore = Math.round(recentPerformance.reduce((sum, record) => sum + record.percentage, 0) / recentPerformance.length);
    const topPositions = recentPerformance.filter(record => record.classPosition <= 3).length;
    
    const trend = latestScore > previousScore ? "improving" : latestScore < previousScore ? "declining" : "stable";
    
    // Update performance level based on KJSEA levels
    let performanceLevel = "";
    if (averageScore >= 90) performanceLevel = "Exceptional (EE1)";
    else if (averageScore >= 75) performanceLevel = "Excellent (EE2)";
    else if (averageScore >= 58) performanceLevel = "Very Good (ME1)";
    else if (averageScore >= 41) performanceLevel = "Good (ME2)";
    else if (averageScore >= 31) performanceLevel = "Average (AE1)";
    else if (averageScore >= 21) performanceLevel = "Below Average (AE2)";
    else if (averageScore >= 11) performanceLevel = "Poor (BE1)";
    else performanceLevel = "Very Poor (BE2)";

    return {
      trend,
      performanceLevel,
      averageScore,
      topPositions,
      latestScore,
      previousScore
    };
  };

  // Generate insights for subject analysis
  const getSubjectInsights = (subjectData: any[]) => {
    const validData = subjectData
      .filter(d => d.score !== null && d.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (validData.length < 2) return null;

    const recentExams = validData.slice(0, 3);
    const scores = recentExams.map(d => d.score);
    
    const latestScore = scores[0];
    const previousScore = scores[1];
    
    const trend = latestScore > previousScore ? "improving" : 
                 latestScore < previousScore ? "declining" : "stable";

    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    let trendStrength = "moderate";
    if (recentExams.length >= 3) {
      const firstScore = scores[2];
      const overallChange = latestScore - firstScore;
      if (Math.abs(overallChange) >= 15) trendStrength = "significant";
      else if (Math.abs(overallChange) >= 5) trendStrength = "moderate";
      else trendStrength = "minimal";
    }

    return {
      trend,
      trendStrength,
      averageScore,
      latestScore,
      previousScore,
      highestScore,
      lowestScore,
      examsAnalyzed: recentExams.length
    };
  };

  // Print individual exam results
  const printExamResults = (examTitle: string) => {
    const examRecord = performanceHistory.find(record => record.title === examTitle);
    if (examRecord) {
      downloadExamResultsPDF(examRecord);
    }
  };

  // Fetch performance history for the last 10 exams - NOW USING THE VIEW
  // Fetch performance history for the last 10 exams - NOW USING THE VIEW
useEffect(() => {
  const fetchPerformanceHistory = async () => {
    if (!studentId || !classId) return;
    
    setPerformanceLoading(true);
    try {
      console.log("Fetching performance history for student:", studentId, "class:", classId);
      
      // Fetch performance data from the view
      const { data: rankingsData, error } = await supabase
        .from("student_rankings")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .order("assessment_date", { ascending: false });

      if (error) {
        console.error("Supabase error fetching rankings:", error);
        throw error;
      }

      console.log("Rankings data for performance history:", rankingsData);

      // Fetch subject breakdowns for each exam
      const performanceData: PerformanceRecord[] = [];
      
      if (rankingsData && rankingsData.length > 0) {
        for (const ranking of rankingsData) {
          // Get subject breakdown for this exam
          const { data: subjectData, error: subjectError } = await supabase
            .from("assessment_results")
            .select(`
              score,
              max_marks,
              subjects (
                name
              )
            `)
            .eq("student_id", studentId)
            .eq("assessment_id", ranking.assessment_id);

          if (!subjectError && subjectData && subjectData.length > 0) {
            const isEndYearExam = ranking.exam_title.toLowerCase().includes('end year') || 
                                 ranking.exam_title.toLowerCase().includes('final') ||
                                 ranking.exam_title.toLowerCase().includes('annual') ||
                                 ranking.exam_title.toLowerCase().includes('year end');

            const subjectBreakdown = subjectData.map(record => ({
              subject: firstRel(record.subjects as any)?.name,
              score: record.score,
              total_score: record.max_marks || 100,
              percentage: Math.round((record.score / (record.max_marks || 100)) * 100),
              grade: calculateKJSEAGrade(record.score / (record.max_marks || 100))
            }));

            performanceData.push({
              id: `${ranking.assessment_id}-${ranking.student_id}`,
              title: ranking.exam_title,
              term: ranking.term ? ranking.term.toString() : "Unknown Term",
              year: ranking.year || new Date().getFullYear(),
              assessment_date: ranking.assessment_date || new Date().toISOString(),
              subjects: {
                name: isEndYearExam ? "Overall" : "Multiple Subjects"
              },
              score: ranking.total_attained,
              total_score: ranking.total_possible,
              percentage: ranking.percentage,
              grade: calculateKJSEAGrade(ranking.percentage / 100),
              isEndYearExam: isEndYearExam,
              subjectBreakdown: isEndYearExam ? null : subjectBreakdown,
              classPosition: ranking.class_position
            });
          }
        }
      }

      // Sort by date and limit to 10 most recent
      const sortedData = performanceData
        .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())
        .slice(0, 10);

      console.log("Performance data sorted:", sortedData);
      setPerformanceHistory(sortedData);
    } catch (err: any) {
      console.error("Error fetching performance history:", err);
      setError(err.message);
    } finally {
      setPerformanceLoading(false);
    }
  };

  if (studentId && classId) {
    fetchPerformanceHistory();
  }
}, [studentId, classId]);
  // Get last 6 most recent exams
  const recentPerformance = useMemo(() => {
    return performanceHistory.slice(0, 6);
  }, [performanceHistory]);

  // Download performance history as CSV
  const downloadPerformanceHistory = () => {
    const headers = ["Exam", "Total Marks", "Class Position", "Date", "Percentage", "KJSEA Level"];
    const csvData = recentPerformance.map(record => [
      record.title,
      `${record.score}/${record.total_score}`,
      record.classPosition.toString(),
      new Date(record.assessment_date).toLocaleDateString(),
      `${record.percentage}%`,
      record.grade
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `performance-history-${profile?.reg_no || "student"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print performance history
  const printPerformanceHistory = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Performance History - ${profile?.first_name} ${profile?.last_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #800000; color: white; }
          .header { text-align: center; margin-bottom: 30px; }
          .student-info { margin-bottom: 20px; }
          .summary { background-color: #f9f0f0; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #800000; }
          .position-1 { background-color: #d4edda; font-weight: bold; }
          .position-2 { background-color: #fff3cd; font-weight: bold; }
          .position-3 { background-color: #f8d7da; font-weight: bold; }
          @media print {
            body { margin: 0; }
            .header { margin-bottom: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="color: #800000;">Performance History</h1>
          <div class="student-info">
            <p><strong>Student:</strong> ${profile?.first_name} ${profile?.last_name}</p>
            <p><strong>Student ID:</strong> ${profile?.reg_no}</p>
            <p><strong>Class:</strong> ${className}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Exam</th>
              <th>Total Marks</th>
              <th>Class Position</th>
              <th>Date</th>
              <th>Percentage</th>
              <th>KJSEA Level</th>
            </tr>
          </thead>
          <tbody>
            ${recentPerformance.map(record => `
              <tr>
                <td>${record.title}</td>
                <td>${record.score} / ${record.total_score}</td>
                <td class="position-${record.classPosition}">${record.classPosition}</td>
                <td>${new Date(record.assessment_date).toLocaleDateString()}</td>
                <td>${record.percentage}%</td>
                <td>${record.grade}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="summary">
          <h3>Performance Summary</h3>
          <p><strong>Total Exams:</strong> ${recentPerformance.length}</p>
          <p><strong>Average Percentage:</strong> ${Math.round(recentPerformance.reduce((sum, record) => sum + record.percentage, 0) / recentPerformance.length)}%</p>
          <p><strong>Top Positions (1st/2nd/3rd):</strong> ${recentPerformance.filter(record => record.classPosition <= 3).length}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Generate PDF for overall yearly performance
  const downloadYearlyPerformancePDF = async () => {
    const yearlyData: Record<number, PerformanceRecord[]> = {};
    recentPerformance.forEach(record => {
      if (!yearlyData[record.year]) {
        yearlyData[record.year] = [];
      }
      yearlyData[record.year].push(record);
    });

    // Create a container element for the PDF content
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '0';
    pdfContainer.style.width = '800px';
    pdfContainer.style.padding = '20px';
    pdfContainer.style.backgroundColor = 'white';
    pdfContainer.style.fontFamily = 'Arial, sans-serif';
    
    let yearlyContent = '';
    Object.entries(yearlyData).forEach(([year, records]) => {
      const yearlyTotal = records.reduce((sum, record) => sum + record.score, 0);
      const yearlyMaxTotal = records.reduce((sum, record) => sum + record.total_score, 0);
      const yearlyAverage = yearlyMaxTotal > 0 ? Math.round((yearlyTotal / yearlyMaxTotal) * 100) : 0;

      yearlyContent += `
        <div style="margin-bottom: 40px;">
          <h2 style="color: #800000; border-bottom: 2px solid #800000; padding-bottom: 10px; margin-bottom: 20px;">Year ${year} Performance Summary</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: left; background-color: #800000; color: white;">Exam Title</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: left; background-color: #800000; color: white;">Total Marks</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: left; background-color: #800000; color: white;">Class Position</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: left; background-color: #800000; color: white;">Assessment Date</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(record => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 10px;">${record.title}</td>
                  <td style="border: 1px solid #ddd; padding: 10px;">${record.score} / ${record.total_score}</td>
                  <td style="border: 1px solid #ddd; padding: 10px; ${record.classPosition === 1 ? 'background-color: #d4edda; font-weight: bold;' : record.classPosition === 2 ? 'background-color: #fff3cd; font-weight: bold;' : record.classPosition === 3 ? 'background-color: #f8d7da; font-weight: bold;' : ''}">${record.classPosition}</td>
                  <td style="border: 1px solid #ddd; padding: 10px;">${new Date(record.assessment_date).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background-color: #f9f0f0; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #800000;">
            <h3 style="color: #800000; margin-top: 0;">Year ${year} Summary</h3>
            <p><strong>Total Score:</strong> ${yearlyTotal} / ${yearlyMaxTotal}</p>
            <p><strong>Average Percentage:</strong> ${yearlyAverage}%</p>
            <p><strong>Overall KJSEA Level:</strong> <span style="${getGradeStyles(calculateKJSEAGrade(yearlyTotal / yearlyMaxTotal))}">${calculateKJSEAGrade(yearlyTotal / yearlyMaxTotal)}</span></p>
            <p><strong>Exams Taken:</strong> ${records.length}</p>
            <p><strong>Best Position:</strong> ${Math.min(...records.map(r => r.classPosition))}</p>
          </div>
        </div>
      `;
    });

    const pdfContent = `
      <div style="padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #800000; padding-bottom: 20px;">
          <h1 style="color: #800000; margin: 0; font-size: 24px;">Yearly Academic Performance Report</h1>
        </div>
        
        <div style="margin-bottom: 30px; background: #f9f0f0; padding: 15px; border-radius: 5px;">
          <h3 style="color: #800000; margin-top: 0;">Student Information</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
            <div><strong>Name:</strong> ${profile?.first_name} ${profile?.last_name}</div>
            <div><strong>Student ID:</strong> ${profile?.reg_no}</div>
            <div><strong>Class:</strong> ${className}</div>
            <div><strong>Report Period:</strong> ${Object.keys(yearlyData).join(', ')}</div>
            <div><strong>Report Generated:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        ${yearlyContent}

        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 20px;">
          <p>Generated by Student Portal • ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;

    pdfContainer.innerHTML = pdfContent;
    document.body.appendChild(pdfContainer);

    try {
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`yearly-performance-${profile?.reg_no || "student"}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      document.body.removeChild(pdfContainer);
    }
  };

  // Download individual exam results as PDF
  const downloadExamResultsPDF = async (examRecord: PerformanceRecord) => {
    const classPosition = examRecord.classPosition || 'N/A';
    const subjectBreakdown = examRecord.subjectBreakdown;

    let subjectContent = '';
    let summaryContent = '';

    if (subjectBreakdown && subjectBreakdown.length > 0) {
      subjectContent = `
        <div style="margin: 30px 0;">
          <h3 style="color: #800000; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">Subject-wise Performance</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Subject</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Score</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Total</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Percentage</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">KJSEA Level</th>
              </tr>
            </thead>
            <tbody>
              ${subjectBreakdown.map(subject => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 12px;">${subject.subject}</td>
                  <td style="border: 1px solid #ddd; padding: 12px;">${subject.score}</td>
                  <td style="border: 1px solid #ddd; padding: 12px;">${subject.total_score}</td>
                  <td style="border: 1px solid #ddd; padding: 12px;">${subject.percentage}%</td>
                  <td style="border: 1px solid #ddd; padding: 12px; ${getGradeStyles(subject.grade)}">${subject.grade}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      subjectContent = `
        <div style="margin: 30px 0;">
          <h3 style="color: #800000; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">Overall Performance</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Score</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Total</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">Percentage</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background: #800000; color: white; font-weight: 600;">KJSEA Level</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${examRecord.score}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${examRecord.total_score}</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${examRecord.percentage}%</td>
                <td style="border: 1px solid #ddd; padding: 12px; ${getGradeStyles(examRecord.grade)}">${examRecord.grade}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const totalScore = subjectBreakdown
      ? subjectBreakdown.reduce((sum, s) => sum + s.score, 0)
      : examRecord.score;
    const maxTotal = subjectBreakdown
      ? subjectBreakdown.reduce((sum, s) => sum + s.total_score, 0)
      : examRecord.total_score;
    const averagePercentage = Math.round((totalScore / maxTotal) * 100);

    summaryContent = `
      <div style="background: #f9f0f0; padding: 20px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #800000;">
        <h3 style="color: #800000; margin-top: 0;">Exam Summary</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">
          <div style="display: flex; justify-content: space-between; background: white; border: 1px solid #e1e1e1; padding: 8px; border-radius: 6px;">
            <span style="font-weight: bold; color: #555;">Exam Title:</span>
            <span style="color: #333;">${examRecord.title}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: white; border: 1px solid #e1e1e1; padding: 8px; border-radius: 6px;">
            <span style="font-weight: bold; color: #555;">Total Marks:</span>
            <span style="color: #333;">${totalScore} / ${maxTotal}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: white; border: 1px solid #e1e1e1; padding: 8px; border-radius: 6px;">
            <span style="font-weight: bold; color: #555;">Class Position:</span>
            <span style="${classPosition === 1 ? 'background: #d4edda; color: #155724;' : classPosition === 2 ? 'background: #fff3cd; color: #856404;' : classPosition === 3 ? 'background: #f8d7da; color: #721c24;' : ''} font-weight: bold; padding: 2px 8px; border-radius: 4px;">${classPosition}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: white; border: 1px solid #e1e1e1; padding: 8px; border-radius: 6px;">
            <span style="font-weight: bold; color: #555;">Percentage:</span>
            <span style="color: #333;">${averagePercentage}%</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: white; border: 1px solid #e1e1e1; padding: 8px; border-radius: 6px;">
            <span style="font-weight: bold; color: #555;">KJSEA Level:</span>
            <span style="${getGradeStyles(examRecord.grade)}">${examRecord.grade}</span>
          </div>
        </div>
      </div>
    `;

    const htmlContent = `
      <div style="padding: 20px; color: #333; background: #fff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #800000; padding-bottom: 20px;">
          <h1 style="color: #800000; margin: 0; font-size: 24px;">${examRecord.title} - Exam Report</h1>
        </div>
        
        <div style="margin: 20px 0; background: #f9f0f0; padding: 15px; border-radius: 8px; border-left: 4px solid #800000;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
            <div style="display: flex; justify-content: space-between; padding: 5px 0;">
              <span style="font-weight: bold; color: #555;">Name:</span>
              <span style="color: #333;">${profile?.first_name} ${profile?.last_name}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 5px 0;">
              <span style="font-weight: bold; color: #555;">Student ID:</span>
              <span style="color: #333;">${profile?.reg_no}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 5px 0;">
              <span style="font-weight: bold; color: #555;">Class:</span>
              <span style="color: #333;">${className}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 5px 0;">
              <span style="font-weight: bold; color: #555;">Exam Date:</span>
              <span style="color: #333;">${new Date(examRecord.assessment_date).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        ${subjectContent}
        ${summaryContent}

        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 20px;">
          Generated by Student Portal • ${new Date().toLocaleDateString()}
        </div>
      </div>
    `;

    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '0';
    pdfContainer.style.width = '800px';
    pdfContainer.style.padding = '20px';
    pdfContainer.style.backgroundColor = 'white';
    pdfContainer.style.fontFamily = 'Arial, sans-serif';
    pdfContainer.innerHTML = htmlContent;
    
    document.body.appendChild(pdfContainer);

    try {
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`exam-results-${examRecord.title.replace(/\s+/g, '-').toLowerCase()}-${profile?.reg_no || 'student'}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      document.body.removeChild(pdfContainer);
    }
  };

  // --- MODIFIED: handleSubjectClick (Step 1: Removed email/phone from initial fetch) ---
  const handleSubjectClick = async (subjectName: string) => {
    setSelectedSubject(subjectName);
    setAnalysisLoading(true);
    setRevealedContact(null); // Reset revealed info when switching subjects

    const examTitles = exams.map(e => e.title);
    const subjectAssessments = assessments.filter(
      a => a.subjects?.name === subjectName && a.student_id === studentId
    );
    
    const subjectAnalysisData = examTitles.map(examTitle => {
      const found = subjectAssessments.find(a => a.assessments?.title === examTitle);
      return {
        exam: examTitle,
        score: found ? found.score : null,
        date: found ? found.assessment_date : null,
        subject_id: found ? found.subjects?.id : null,
      };
    });
    setSubjectAnalysis(subjectAnalysisData);

    let teacher = null;
    const subjectId = subjectAnalysisData.find(sa => sa.subject_id)?.subject_id;
    if (subjectId && classId) {
      const { data: tcData, error: tcError } = await supabase
        .from("teacher_classes")
        .select("teacher_id")
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .single();

      if (!tcError && tcData?.teacher_id) {
        // ONLY FETCH NAMES HERE - NO PII
        const { data, error } = await supabase
          .from("student_teacher_info")
          .select("teacher_id, first_name, last_name")
          .eq("teacher_id", tcData.teacher_id)
          .single();
        if (!error && data) teacher = data;
      }
    }
    setTeacherInfo(teacher);
    setAnalysisLoading(false);
  };

  // Fetch student profile and all assessment results
  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const user = userData.user;
        if (!user) throw new Error("User not signed in");
        
        // Get student data
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("id, Reg_no, first_name, last_name, auth_id")
          .eq("auth_id", user.id)
          .single();
        
        if (studentError) throw studentError;
        if (!studentData) throw new Error("No student found");
        setStudent(studentData);
        setStudentId(studentData.id);

        // Get student profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("student_id", studentData.id)
          .single();
        
        if (profileError) throw profileError;
        if (!profileData) throw new Error("No student profile found");
        setProfile(profileData);

        // Get enrollment and class info
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from("enrollments")
          .select(`
            class_id,
            classes (name)
          `)
          .eq("student_id", studentData.id)
          .single();
        
        if (enrollmentError) throw enrollmentError;
        const classId = enrollmentData?.class_id || null;
        const className = firstRel(enrollmentData?.classes as any)?.name || "Unknown";
        setClassId(classId);
        setClassName(className);

        // Fetch assessments for the current student - ADDED TIME FILTER
        const currentYear = new Date().getFullYear();
        const lastYear = currentYear - 1;
        
        const { data: assessmentsData, error: assessmentsError } = await supabase
  .from("assessment_results")
  .select(`
    id,
    student_id,
    score,
    max_marks,
    assessment_date,
    assessments (
      id,
      title,
      term,
      year,
      class_id
    ),
    subjects (
      id,
      name
    )
  `)
  .eq("student_id", studentData.id)  // Filter by student_id first
  .eq("assessments.class_id", classId)  // Then filter by class
  .in("assessments.year", [currentYear, lastYear])
  .order("assessment_date", { ascending: false });
        
        if (assessmentsError) {
          console.error("Error fetching assessments:", assessmentsError);
          setAssessments([]);
        } else {
          // Process the data to ensure proper structure
          const processedData = (assessmentsData || []).map(item => ({
            ...item,
            assessments: firstRel(item.assessments),
            subjects: firstRel(item.subjects),
            // Calculate percentage if not present
            percentage: item.max_marks > 0 ? (item.score / item.max_marks) * 100 : 0
          }));
          
          setAssessments(processedData);
        }
        
        setAssessmentsLoading(false);
        
        // Fetch student rankings from the view
        if (classId) {
          fetchStudentRankings();
        }
      } catch (err: any) {
        console.error("Error in fetchStudentData:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, []);

  // Fetch student rankings when studentId or classId changes
  useEffect(() => {
    if (studentId && classId) {
      fetchStudentRankings();
    }
  }, [studentId, classId]);

  // Fetch attendance
  useEffect(() => {
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("No logged-in user found");
          setAttendanceData(null);
          setAttendanceLoading(false);
          return;
        }

        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("id")
          .eq("auth_id", user.id)
          .single();

        if (studentError || !studentData) {
          console.error("Error fetching student:", studentError);
          setAttendanceData(null);
          setAttendanceLoading(false);
          return;
        }

        const studentId = studentData.id;

        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from("attendance")
          .select("monday, tuesday, wednesday, thursday, friday, week_start, week_end")
          .eq("student_id", studentId)
          .order("week_start", { ascending: true });

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
            attendanceRate: totalSchoolDays > 0 ? (totalDaysPresent / totalSchoolDays) * 100 : 0,
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
    fetchAttendance();
  }, []);

  // Password update handler
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);

    // 1. Check if the two new passwords actually match
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      setSettingsLoading(false);
      return;
    }

    try {
      // 2. THE SECURITY GATE: Re-authenticate the user
      // We try to log in again using the email and the OLD password they provided
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      // If the old password is wrong, stop immediately!
      if (signInError) {
        alert("Current password is incorrect. Please try again.");
        setSettingsLoading(false);
        return;
      }

      // 3. If we got here, it means the current password was CORRECT.
      // Now it is safe to update to the new password.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      alert("Password updated successfully!");
      
      // Clear the boxes
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

  // Update the existing assignments useEffect to use the new function
  useEffect(() => {
    fetchAssignments();
  }, []);

  // Update the existing announcements useEffect to use the new function  
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Reset password form when modal closes
  useEffect(() => {
    console.log("Settings modal state:", isSettingsOpen);
  }, [isSettingsOpen]);

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

  // Exams list for table
  const exams = useMemo(() => {
    if (!assessments || assessments.length === 0) {
      return [];
    }
    
    const examTitleSet = new Set<string>();
    assessments.forEach(a => {
      if (a.assessments?.title) {
        examTitleSet.add(a.assessments.title);
      }
    });
    
    return Array.from(examTitleSet)
      .sort((a, b) => extractExamNumber(a) - extractExamNumber(b))
      .map(title => ({ id: title, title }));
  }, [assessments]);

  // Pivot data for assessment table - NOW USING THE VIEW FOR TOTALS AND POSITIONS
  // Pivot data for assessment table - NOW USING THE VIEW FOR TOTALS AND POSITIONS
const pivotData = useMemo(() => {
  // Guard clause: Ensure we have the necessary data
  if (!assessments || !studentId || !studentRankings || studentRankings.length === 0) {
    console.log("Pivot data conditions:", {
      hasAssessments: !!assessments,
      studentId,
      hasStudentRankings: !!studentRankings,
      studentRankingsLength: studentRankings?.length
    });
    return [];
  }

  const examTitles = exams.map(e => e.title);
  const grouped: Record<string, any> = {};
  
  console.log("Building pivot data for exams:", examTitles);
  console.log("Student rankings:", studentRankings);
  
  // 1. Group Subject Rows for the LOGGED-IN Student
  assessments.forEach(a => {
    if (String(a.student_id) !== String(studentId)) return;
    const subject = a.subjects?.name || "Unknown Subject";
    const examTitle = a.assessments?.title || "Untitled Exam";
    
    if (!grouped[subject]) {
      grouped[subject] = { subject, exams: {} };
    }
    // Store score as a number for calculation, or "-" if null
    grouped[subject].exams[examTitle] = a.score !== null ? Number(a.score) : "-";
  });
  
  // Map grouped data into table rows
  const rows = Object.values(grouped).map((row: any) => ({
    subject: row.subject,
    exams: examTitles.reduce((acc: Record<string, any>, title) => {
      acc[title] = row.exams[title] ?? "-";
      return acc;
    }, {}),
  }));

  // 2. Create a map from exam title to the studentRanking data for the current student
  const rankingMap: Record<string, any> = {};
  studentRankings.forEach(r => {
    if (r.exam_title) {
      rankingMap[r.exam_title] = {
        total_attained: r.total_attained,
        total_possible: r.total_possible,
        class_position: r.class_position
      };
    }
  });

  console.log("Ranking map:", rankingMap);

  // 3. Calculate Totals and Positions using the rankingMap
  const totals: Record<string, any> = {};
  const positions: Record<string, any> = {};

  examTitles.forEach(title => {
    if (rankingMap[title]) {
      totals[title] = `${rankingMap[title].total_attained}/${rankingMap[title].total_possible}`;
      positions[title] = rankingMap[title].class_position;
    } else {
      totals[title] = "-";
      positions[title] = "-";
    }
  });

  // 4. Return the combined data for the table
  return [
    ...rows,
    { subject: "Totals", exams: totals },
    { subject: "Position", exams: positions }
  ];
}, [assessments, studentId, exams, studentRankings]);

  // Calculate GPA using weighted percentages across all assessments
  const calculateGPA = () => {
    if (!assessments || assessments.length === 0 || !studentId) return "-";
    
    const myScores = assessments.filter(a => a.student_id === studentId);
    if (!myScores.length) return "-";
    
    // Calculate total score and total max marks
    let totalScore = 0;
    let totalMaxMarks = 0;
    
    myScores.forEach(assessment => {
      totalScore += assessment.score || 0;
      // Use max_marks from the assessment, default to 100 if not available
      totalMaxMarks += assessment.max_marks || 100;
    });
    
    // Avoid division by zero
    if (totalMaxMarks === 0) return "-";
    
    // Calculate overall percentage
    const overallPercentage = (totalScore / totalMaxMarks) * 100;
    
    // Convert to KJSEA GPA scale based on overall percentage
    if (overallPercentage >= 90) return "8.0 (EE1)";
    if (overallPercentage >= 75) return "7.0 (EE2)";
    if (overallPercentage >= 58) return "6.0 (ME1)";
    if (overallPercentage >= 41) return "5.0 (ME2)";
    if (overallPercentage >= 31) return "4.0 (AE1)";
    if (overallPercentage >= 21) return "3.0 (AE2)";
    if (overallPercentage >= 11) return "2.0 (BE1)";
    return "1.0 (BE2)";
  };

  const performanceInsights = getPerformanceInsights();

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

  return (
    <div className="min-h-screen bg-white">
     
      <Navbar {...({ showLogout: true, handleLogout } as any)} />
      <div className="max-w-7xl mx-auto p-6 space-y-8">
       {/* Modern Welcome Header - UPDATED WITH HORIZONTAL BUTTONS (Notifications Removed) */}
<div className="bg-maroon-50 rounded-2xl p-8 border border-maroon-200 shadow-sm relative">
  <div className="flex justify-between items-start">
    <div className="flex-1">
      {/* 1. Welcome and Primary Details (Unchanged) */}
      <h1 className="text-3xl font-bold text-gray-900">
        Welcome, {profile.first_name} {profile.last_name}
      </h1>
      <p className="text-gray-600 mt-2">Ready to achieve your academic goals today</p>
      
      {/* Student Details (ID, Class, GPA) (Unchanged) */}
      <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-600 pb-4 border-b border-maroon-100">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-maroon" />
          <span>ID: **{profile?.reg_no}**</span>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-maroon" />
          <span>Class: **{className}**</span>
        </div>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-maroon" />
          <span>KJSEA Level: **{calculateGPA()}**</span>
        </div>
      </div>
      
      {/* 2. HORIZONTAL ACTION BUTTONS (Only Fees and Settings remain) */}
      <div className="flex flex-wrap gap-4 mt-4">
        
        {/* Fee Statement Button */}
        <Button
          variant="outline"
          size="default"
          onClick={handleFeesManagement}
          className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-maroon hover:text-white transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Fee Statement
        </Button>

        {/* Settings Button */}
        <Button
          variant="outline"
          size="default"
          onClick={() => {
            console.log("Settings button clicked");
            setIsSettingsOpen(true);
          }}
          className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-maroon hover:text-white transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
    
    {/* 3. Attendance Card (Unchanged) */}
    <div className="flex flex-col items-end gap-4 ml-6 flex-shrink-0">
      <div className="bg-maroon/5 rounded-xl p-4 text-center min-w-28 border border-maroon/10 shadow-lg">
        <div className="text-3xl font-extrabold text-maroon">{attendanceData?.attendanceRate.toFixed(1)}%</div>
        <div className="text-sm text-gray-600 mt-1">Attendance Rate</div>
      </div>
    </div>
  </div>
</div>

        {/* Tabs for Dashboard and Performance History */}
        <Tabs defaultValue="dashboard" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 p-1 bg-maroon-50 rounded-lg">
<TabsTrigger value="dashboard" className="rounded-md data-[state=active]:bg-maroon data-[state=active]:text-white">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="performance" className="rounded-md data-[state=active]:bg-maroon data-[state=active]:text-white">
              Performance History
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8">
            {/* Modern Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-maroon-50 border-l-4 border-l-maroon">
                <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                  <div className="w-12 h-12 bg-maroon/10 rounded-full flex items-center justify-center mr-4">
                    <TrendingUp className="h-6 w-6 text-maroon" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Academic Progress</CardTitle>
                    <CardDescription className="text-gray-600">Overall performance</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Current Level</span>
                      <Badge variant="secondary" className="bg-maroon/10 text-maroon">{calculateGPA()}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Exams Completed</span>
                      <span className="text-sm font-medium text-gray-900">{recentPerformance.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Average Score</span>
                      <span className="text-sm font-medium text-gray-900">
                        {recentPerformance.length > 0 
                          ? Math.round(recentPerformance.reduce((sum, r) => sum + r.percentage, 0) / recentPerformance.length) 
                          : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 bg-white">
                <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">This Week</CardTitle>
                    <CardDescription className="text-gray-600">Current priorities</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Assignments Due</span>
                      <Badge variant="outline" className="border-gray-200 text-gray-700">
                        {assignments.filter(a => !a.submitted && a.due_date && new Date(a.due_date) > new Date()).length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Tests Scheduled</span>
                      <Badge variant="outline" className="border-gray-200 text-gray-700">
                        {(assessments.filter(a => a.assessment_date && new Date(a.assessment_date) > new Date() && a.student_id === studentId)).length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Active Subjects</span>
                      <Badge className="bg-maroon text-white">
                        {new Set(assessments.filter(a => a.student_id === studentId).map(a => a.subjects?.name)).size}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 bg-white">
                <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Attendance</CardTitle>
                    <CardDescription className="text-gray-600">Class participation</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {attendanceLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-maroon mx-auto"></div>
                    </div>
                  ) : attendanceError ? (
                    <div className="text-center py-4 text-red-500">{attendanceError}</div>
                  ) : !attendanceData ? (
                    <div className="text-center py-4">
                      <p className="text-gray-600">No attendance records yet</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {attendanceData.attendanceRate.toFixed(1)}%
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        {attendanceData.presentDays}/{attendanceData.totalDays} days present
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-green-500" 
                          style={{ width: `${attendanceData.attendanceRate}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Academic Performance */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center text-xl text-gray-900">
                  <BookOpen className="h-6 w-6 mr-3 text-maroon" />
                  Recent Assessment Results
                </CardTitle>
                <CardDescription className="text-gray-600">Click any subject for detailed performance analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {assessmentsLoading || studentRankingsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading assessment results...</p>
                  </div>
                ) : pivotData.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-maroon-50">
                        <TableRow>
                          <TableHead className="font-semibold text-gray-900">Subject</TableHead>
                          {exams.map((exam) => (
                            <TableHead key={exam.id} className="font-semibold text-gray-900">{exam.title}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pivotData.map((row, rowIndex) => (
                          <TableRow
                            key={rowIndex}
                            className={
                              row.subject === "Totals"
                                ? "font-bold bg-gray-50"
                                : row.subject === "Position"
                                ? "font-bold bg-gray-100"
                                : "hover:bg-gray-50 cursor-pointer transition-colors"
                            }
                            onClick={() => {
                              if (row.subject !== "Totals" && row.subject !== "Position") {
                                handleSubjectClick(row.subject);
                              }
                            }}
                          >
                            <TableCell className={
                              row.subject === "Totals" || row.subject === "Position" 
                                ? "font-bold text-gray-900" 
                                : "font-medium text-gray-700"
                            }>
                              {row.subject}
                            </TableCell>
                            {exams.map((exam) => (
                              <TableCell key={exam.id} className={
                                row.subject === "Totals" || row.subject === "Position" 
                                  ? "font-bold text-gray-900" 
                                  : "text-gray-700"
                              }>
                                {row.exams[exam.title] ?? "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No assessment results found.</p>
                    <p className="text-sm text-gray-500 mt-2">Check if assessments have been added for your class.</p>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Announcements and Assignments */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  <Card className="bg-white">
    <CardHeader>
      <CardTitle className="flex items-center text-xl text-gray-900">
        <Bell className="h-6 w-6 mr-3 text-maroon" />
        Recent Announcements
      </CardTitle>
    </CardHeader>
    <CardContent>
      {announcementsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto"></div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.slice(0, 4).map((a) => {
            const isNew = new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            return (
              <div 
                key={a.id} 
                className="p-4 bg-maroon/5 rounded-lg border-l-4 border-l-maroon"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-sm text-gray-900">{a.title}</h4>
                  <div className="flex items-center gap-2">
                    {isNew && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs hover:bg-green-100">
                        New
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className="text-xs border-gray-200 text-gray-700"
                    >
                      {new Date(a.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{a.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>

  <Card className="bg-white">
    <CardHeader>
      <CardTitle className="flex items-center text-xl text-gray-900">
        <FileText className="h-6 w-6 mr-3 text-maroon" />
        Upcoming Assignments
      </CardTitle>
    </CardHeader>
    <CardContent>
      {assignmentsLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon"></div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm">
            No assignments have been uploaded for your class yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.slice(0, 4).map((a) => {
            const isNew = new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const isDueSoon = a.due_date && new Date(a.due_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            
            return (
              <div 
                key={a.id} 
                className="p-4 bg-blue-50 rounded-lg border-l-4 border-l-blue-500"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-gray-900">{a.title}</h4>
                    {isNew && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs hover:bg-green-100">
                        New
                      </Badge>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      isDueSoon 
                        ? "bg-red-50 text-red-700 border-red-200" 
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }
                  >
                    Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "No due date"}
                  </Badge>
                </div>
                {a.file_url ? (
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 text-xs text-maroon font-medium hover:text-maroon/80 transition"
                  >
                    <Download className="h-3 w-3" />
                    Download Assignment
                  </a>
                ) : (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    No file attached
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
</div>
          </TabsContent>

          {/* Performance History Tab */}
          <TabsContent value="performance" className="space-y-8">
            <Card className="bg-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center text-xl text-gray-900">
                      <TrendingUp className="h-6 w-6 mr-3 text-maroon" />
                      Performance History
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Your last {recentPerformance.length} most recent exam results
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={downloadYearlyPerformancePDF} 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Yearly PDF
                    </Button>
                    <Button 
                      onClick={downloadPerformanceHistory} 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </Button>
                    <Button 
                      onClick={printPerformanceHistory} 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      <Printer className="h-4 w-4" />
                      Print All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {performanceLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading performance history...</p>
                  </div>
                ) : recentPerformance.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No performance records found</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Performance Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <Card className="border-l-4 border-l-maroon bg-white">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-maroon">
                            {recentPerformance.length}
                          </div>
                          <p className="text-sm text-gray-600">Exams Tracked</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-blue-500 bg-white">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round(
                              recentPerformance.reduce((sum, record) => sum + record.percentage, 0) / 
                              recentPerformance.length
                            )}%
                          </div>
                          <p className="text-sm text-gray-600">Average Score</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-purple-500 bg-white">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {recentPerformance.filter(record => record.grade.includes("EE1") || record.grade.includes("EE2")).length}
                          </div>
                          <p className="text-sm text-gray-600">Exceptional/Excellent</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-orange-500 bg-white">
                        <CardContent className="p-6 text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {Math.min(...recentPerformance.map(r => r.classPosition))}
                          </div>
                          <p className="text-sm text-gray-600">Best Position</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Performance Insights */}
                    {performanceInsights && (
                      <Card className="bg-maroon/5">
                        <CardHeader>
                          <CardTitle className="text-lg text-gray-900">Performance Insights</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm text-gray-700">
                            <p>
                              <span className="font-medium">Trend: </span>
                              Your performance is <span className={performanceInsights.trend === 'improving' ? 'text-green-600 font-medium' : performanceInsights.trend === 'declining' ? 'text-red-600 font-medium' : 'text-blue-600 font-medium'}>{performanceInsights.trend}</span> 
                              {performanceInsights.trend === 'improving' && ' - keep up the good work!'}
                              {performanceInsights.trend === 'declining' && ' - consider reviewing recent topics'}
                              {performanceInsights.trend === 'stable' && ' - consistent performance maintained'}
                            </p>
                            <p>
                              <span className="font-medium">Overall Level: </span>
                              <span className="capitalize">{performanceInsights.performanceLevel}</span>
                            </p>
                            <p>
                              <span className="font-medium">Achievements: </span>
                              {performanceInsights.topPositions} top 3 class positions in recent exams
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Performance Table */}
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader className="bg-maroon-50">
                          <TableRow>
                            <TableHead className="font-semibold text-gray-900">Exam</TableHead>
                            <TableHead className="font-semibold text-gray-900">Subject</TableHead>
                            <TableHead className="font-semibold text-gray-900">Term/Year</TableHead>
                            <TableHead className="font-semibold text-gray-900">Date</TableHead>
                            <TableHead className="font-semibold text-gray-900">Score</TableHead>
                            <TableHead className="font-semibold text-gray-900">Percentage</TableHead>
                            <TableHead className="font-semibold text-gray-900">KJSEA Level</TableHead>
                            <TableHead className="font-semibold text-gray-900">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentPerformance.map((record) => (
                            <TableRow key={record.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium text-gray-700">{record.title}</TableCell>
                              <TableCell className="text-gray-700">{record.subjects.name}</TableCell>
                              <TableCell className="text-gray-700">{record.term} {record.year}</TableCell>
                              <TableCell className="text-gray-700">
                                {new Date(record.assessment_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-gray-700">
                                {record.score} / {record.total_score}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="secondary"
                                  className={
                                    record.percentage >= 90 ? "bg-green-100 text-green-800 hover:bg-green-100" :
                                    record.percentage >= 75 ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" :
                                    record.percentage >= 58 ? "bg-blue-100 text-blue-800 hover:bg-blue-100" :
                                    record.percentage >= 41 ? "bg-cyan-100 text-cyan-800 hover:bg-cyan-100" :
                                    record.percentage >= 31 ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                                    record.percentage >= 21 ? "bg-orange-100 text-orange-800 hover:bg-orange-100" :
                                    record.percentage >= 11 ? "bg-red-100 text-red-800 hover:bg-red-100" :
                                    "bg-gray-100 text-gray-800 hover:bg-gray-100"
                                  }
                                >
                                  {record.percentage}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline"
                                  className={getGradeColor(record.grade)}
                                >
                                  {record.grade}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadExamResultsPDF(record)}
                                    className="h-8 px-3 border-gray-200 text-gray-700 hover:bg-gray-50"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => printExamResults(record.title)}
                                    className="h-8 px-3 border-gray-200 text-gray-700 hover:bg-gray-50"
                                  >
                                    <Printer className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Performance Chart - Now Line Chart */}
                    <Card className="bg-white">
                      <CardHeader>
                        <CardTitle className="text-lg text-gray-900">Performance Trend</CardTitle>
                        <CardDescription className="text-gray-600">Your score progression across recent exams</CardDescription>
                      </CardHeader>
                      <CardContent>
  <ResponsiveContainer width="100%" height={400}>
    <LineChart 
      data={[...recentPerformance].reverse()}
      margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis 
        dataKey="title" 
        angle={-45}
        textAnchor="end"
        height={80}
        tick={{ fontSize: 11 }}
        stroke="#64748b"
        interval={0}
      />
      <YAxis 
        domain={['dataMin - 10', 'dataMax + 10']}
        stroke="#64748b" 
        tickFormatter={(value) => `${value}%`}
        width={40}
        tickCount={8}
      />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: "white", 
          border: "2px solid #80000020",
          borderRadius: "8px",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
        }}
        formatter={(value: number) => [`${value}%`, 'Score']}
        labelFormatter={(label) => `Exam: ${label}`}
      />
      <Line 
        type="monotone" 
        dataKey="percentage" 
        stroke="#800000"
        strokeWidth={3}
        dot={{ 
          r: 6, 
          fill: "#800000",
          stroke: "#fff",
          strokeWidth: 2
        }}
        activeDot={{ 
          r: 8, 
          fill: "#800000",
          stroke: "#fff",
          strokeWidth: 2
        }}
        name="Percentage"
      />
      {/* Reference line to show average if you want */}
      <ReferenceLine 
        y={recentPerformance.reduce((sum, item) => sum + item.percentage, 0) / recentPerformance.length} 
        stroke="#666" 
        strokeDasharray="5 5" 
        label={{ 
          value: 'Average', 
          position: 'right',
          fill: '#666',
          fontSize: 12
        }}
      />
    </LineChart>
  </ResponsiveContainer>
</CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Enhanced Subject Analysis Dialog */}
      {/* Subject Analysis Dialog - THEMED & SCROLLABLE */}
<Dialog open={!!selectedSubject} onOpenChange={() => setSelectedSubject(null)}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-maroon/5 border-maroon/20">
    <DialogHeader className="border-b border-maroon/10 pb-4">
      <DialogTitle className="flex items-center text-2xl font-bold text-maroon">
        <BarChart3 className="h-7 w-7 mr-3 text-maroon" />
        {selectedSubject} Performance Analysis
      </DialogTitle>
      <DialogDescription className="text-gray-600 text-base">
        Detailed performance insights and trend analysis for {selectedSubject}
      </DialogDescription>
    </DialogHeader>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
      <Card className="md:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            <User className="h-4 w-4 mr-2" />
            Subject Teacher
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysisLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : teacherInfo ? (
            <div className="space-y-4">
              <div>
                <p className="font-bold text-lg">{teacherInfo.first_name} {teacherInfo.last_name}</p>
                <Badge variant="outline" className="mt-1">Lead Instructor</Badge>
              </div>

              {/* --- THE FIX: Reveal Logic --- */}
              <div className="pt-2 border-t">
                {revealedContact ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2 text-maroon" />
                      {revealedContact.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2 text-maroon" />
                      {revealedContact.phone}
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => setShowWarning(true)}
                  >
                    <ShieldAlert className="h-3 w-3 mr-2" />
                    View Contact (Parents Only)
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Teacher info not assigned</p>
          )}
        </CardContent>
      </Card>

      {/* Charts and Analysis Section */}
      <div className="md:col-span-2 space-y-6">
        {analysisLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading detailed analysis...</p>
          </div>
        ) : subjectAnalysis.length > 0 ? (
          <>
            {/* Subject Insights Card */}
            {(() => {
              const insights = getSubjectInsights(subjectAnalysis.filter(d => d.score !== null));
              return insights && (
                <Card className="bg-white border-maroon/20 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10">
                    <CardTitle className="flex items-center text-xl text-gray-900">
                      <TrendingUp className="h-5 w-5 mr-2 text-maroon" />
                      Performance Insights
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Based on analysis of last {insights.examsAnalyzed} exams in {selectedSubject}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Trend Analysis */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 border-b pb-2">Trend Analysis</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">Current Trend:</span>
                            <Badge 
                              className={
                                insights.trend === 'improving' 
                                  ? 'bg-green-100 text-green-800 border-green-200' 
                                  : insights.trend === 'declining' 
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }
                            >
                              {insights.trend === 'improving' ? '📈 Improving' : 
                              insights.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">Trend Strength:</span>
                            <span className="font-semibold capitalize text-gray-900">{insights.trendStrength}</span>
                          </div>
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 border-b pb-2">Performance Metrics</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">Latest Score:</span>
                            <span className={`font-bold text-lg ${
                              insights.latestScore >= 90 ? 'text-green-600' :
                              insights.latestScore >= 75 ? 'text-emerald-600' :
                              insights.latestScore >= 58 ? 'text-blue-600' :
                              insights.latestScore >= 41 ? 'text-cyan-600' :
                              insights.latestScore >= 31 ? 'text-yellow-600' :
                              insights.latestScore >= 21 ? 'text-orange-600' :
                              insights.latestScore >= 11 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {insights.latestScore}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">Average Score:</span>
                            <span className="font-semibold text-gray-900">{insights.averageScore}%</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">Score Range:</span>
                            <span className="text-sm text-gray-700">
                              {insights.lowestScore}% - {insights.highestScore}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Recommendations */}
                    <div className={`mt-6 p-4 rounded-lg border-l-4 ${
                      insights.latestScore >= 90 ? 'border-green-400 bg-green-50' :
                      insights.latestScore >= 75 ? 'border-emerald-400 bg-emerald-50' :
                      insights.latestScore >= 58 ? 'border-blue-400 bg-blue-50' :
                      insights.latestScore >= 41 ? 'border-cyan-400 bg-cyan-50' :
                      insights.latestScore >= 31 ? 'border-yellow-400 bg-yellow-50' :
                      insights.latestScore >= 21 ? 'border-orange-400 bg-orange-50' :
                      insights.latestScore >= 11 ? 'border-red-400 bg-red-50' :
                      'border-gray-400 bg-gray-50'
                    }`}>
                      <h5 className="font-semibold text-gray-900 mb-2">Recommendations:</h5>
                      <p className="text-sm text-gray-700">
                        {insights.latestScore >= 90 
                          ? "Exceptional performance! Maintain your current study habits and consider advanced topics."
                          : insights.latestScore >= 75
                          ? "Excellent performance. Focus on consistent practice to reach exceptional level."
                          : insights.latestScore >= 58
                          ? "Very good performance. Regular practice and review challenging concepts."
                          : insights.latestScore >= 41
                          ? "Good performance. Focus on strengthening weak areas and regular revision."
                          : insights.latestScore >= 31
                          ? "Average performance. Increase study time and seek help when needed."
                          : insights.latestScore >= 21
                          ? "Below average performance. Consider additional tutoring and focus on fundamentals."
                          : insights.latestScore >= 11
                          ? "Poor performance. Seek immediate help from teacher and increase study hours."
                          : "Very poor performance. Requires intensive tutoring and complete revision of basics."
                        }
                      </p>
                      {insights.trend === 'improving' && insights.trendStrength === 'significant' && (
                        <p className="text-sm text-green-600 font-medium mt-2">
                          🎉 Great progress! Your improvement trend is strong.
                        </p>
                      )}
                      {insights.trend === 'declining' && insights.trendStrength === 'significant' && (
                        <p className="text-sm text-red-600 font-medium mt-2">
                          ⚠️ Significant decline detected. Consider reviewing recent topics and seeking help.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Performance Chart Card */}
            <Card className="bg-white border-maroon/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10">
                <CardTitle className="flex items-center text-xl text-gray-900">
                  <BarChart3 className="h-5 w-5 mr-2 text-maroon" />
                  Performance Progression
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Your score trend across all exams in {selectedSubject}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
<ResponsiveContainer width="100%" height={400}>
  <LineChart 
    data={subjectAnalysis.filter(d => d.score !== null)}
    margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
  >
    <CartesianGrid 
      strokeDasharray="3 3" 
      stroke="#e5e7eb" 
      strokeOpacity={0.6}
    />
    <XAxis 
      dataKey="exam" 
      angle={-45}
      textAnchor="end"
      height={80}
      tick={{ fontSize: 11, fill: '#6b7280' }}
      stroke="#9ca3af"
      interval={0}
    />
    <YAxis 
      domain={['dataMin - 15', 'dataMax + 15']}
      tick={{ fontSize: 12, fill: '#6b7280' }}
      stroke="#9ca3af"
      tickFormatter={(value) => `${value}%`}
      width={40}
      tickCount={8}
    />
    <Tooltip 
      contentStyle={{ 
        backgroundColor: "white", 
        border: "2px solid #80000020",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
      }}
      formatter={(value: number) => [`${value}%`, 'Score']}
      labelFormatter={(label) => `Exam: ${label}`}
    />
    <Line 
      type="monotone" 
      dataKey="score" 
      stroke="#800000"
      strokeWidth={3}
      dot={{ 
        r: 6, 
        fill: "#800000",
        stroke: "#fff",
        strokeWidth: 2
      }}
      activeDot={{ 
        r: 8, 
        fill: "#800000",
        stroke: "#fff",
        strokeWidth: 2
      }}
      name="Score"
    />
  </LineChart>
</ResponsiveContainer>

{/* Chart Legend */}
<div className="flex justify-center items-center mt-4 p-3 bg-maroon/5 rounded-lg">
  <div className="flex items-center gap-2 text-sm text-gray-700">
    <div className="w-3 h-1 bg-maroon rounded-full"></div>
    <span>Your ${selectedSubject} Scores</span>
  </div>
</div>
</CardContent>
            </Card>

            {/* Recent Exam Scores Table */}
            <Card className="bg-white border-maroon/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10">
                <CardTitle className="flex items-center text-xl text-gray-900">
                  <FileText className="h-5 w-5 mr-2 text-maroon" />
                  Recent Exam Scores
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Detailed breakdown of your performance in recent exams
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-maroon-50">
                      <TableRow>
                        <TableHead className="font-semibold text-gray-900">Exam</TableHead>
                        <TableHead className="font-semibold text-gray-900">Score</TableHead>
                        <TableHead className="font-semibold text-gray-900">Percentage</TableHead>
                        <TableHead className="font-semibold text-gray-900">Date</TableHead>
                        <TableHead className="font-semibold text-gray-900">Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectAnalysis
                        .filter(d => d.score !== null)
                        .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
                        .map((data, index) => (
                          <TableRow key={index} className="hover:bg-maroon/5 transition-colors">
                            <TableCell className="font-medium text-gray-900">
                              {data.exam}
                            </TableCell>
                            <TableCell className="font-semibold text-gray-900">
                              {data.score}/100
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="secondary"
                                className={
                                  data.score >= 90 ? "bg-green-100 text-green-800 border-green-200" :
                                  data.score >= 75 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                  data.score >= 58 ? "bg-blue-100 text-blue-800 border-blue-200" :
                                  data.score >= 41 ? "bg-cyan-100 text-cyan-800 border-cyan-200" :
                                  data.score >= 31 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                                  data.score >= 21 ? "bg-orange-100 text-orange-800 border-orange-200" :
                                  data.score >= 11 ? "bg-red-100 text-red-800 border-red-200" :
                                  "bg-gray-100 text-gray-800 border-gray-200"
                                }
                              >
                                {data.score}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {data.date ? new Date(data.date).toLocaleDateString() : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="h-2 rounded-full transition-all duration-300"
                                    style={{ 
                                      width: `${data.score}%`,
                                      backgroundColor: 
                                        data.score >= 90 ? '#10b981' :
                                        data.score >= 75 ? '#10b981' :
                                        data.score >= 58 ? '#3b82f6' :
                                        data.score >= 41 ? '#06b6d4' :
                                        data.score >= 31 ? '#f59e0b' :
                                        data.score >= 21 ? '#f97316' :
                                        data.score >= 11 ? '#ef4444' : '#6b7280'
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{data.score}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-white border-maroon/20 text-center py-12">
            <CardContent>
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Exam Data Available</h3>
              <p className="text-gray-600">
                No assessment data found for {selectedSubject}. 
                This could be because no exams have been conducted yet or grades are pending.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  </DialogContent>
</Dialog>

     {/* Fees Dialog - NEW POPUP MODAL */}
<Dialog open={isFeesDialogOpen} onOpenChange={setIsFeesDialogOpen}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0 border-maroon/20 bg-white">
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
      className={className}
    />
  </DialogContent>
</Dialog>


      {/* Settings Modal for Password Update - SCROLLABLE */}
<Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
  <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-white">
    <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
      <DialogTitle className="flex items-center text-xl font-bold text-maroon">
        <Settings className="h-6 w-6 mr-3 text-maroon" />
        Account Settings
      </DialogTitle>
      <DialogDescription className="text-gray-600">
        Update your account password and security settings
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-6 py-4">
      {/* Student Info Display */}
      <Card className="bg-gradient-to-r from-maroon/5 to-maroon/10 border-maroon/20">
        <CardContent className="p-4">
          <h4 className="font-semibold text-lg mb-3 text-gray-900 flex items-center">
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
              <span className="text-gray-900 text-xs truncate max-w-[150px]">{profile?.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Update Form */}
      <Card className="border-maroon/20 overflow-hidden shadow-lg">
  <CardContent className="p-0">
    {/* High Security Header */}
    <div className="bg-maroon p-4 text-white flex items-center justify-between">
      <h3 className="text-lg font-semibold flex items-center">
        <Settings className="h-5 w-5 mr-2" />
        Change Password
      </h3>
      <ShieldAlert className="h-5 w-5 text-maroon-light opacity-50" />
    </div>

    <div className="p-4 space-y-4">
      {/* SECURITY NOTICE BOX */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start animate-in fade-in duration-500">
        <div className="bg-amber-100 p-1.5 rounded-full">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Identity Verification Required</p>
          <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
            To protect your account from hijacking, you must verify your <b>Current Password</b> before choosing a new one.
          </p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {passwordError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-shake">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            {passwordError}
          </div>
        </div>
      )}

      {passwordSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            {passwordSuccess}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* CURRENT PASSWORD - STYLED TO LOOK IMPORTANT */}
        <div className="space-y-2">
          <label htmlFor="currentPassword" className="text-sm font-bold text-gray-800 flex items-center">
            <span className="w-2 h-2 bg-maroon rounded-full mr-2"></span>
            Current Password
          </label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Verify current password"
            disabled={passwordLoading}
            className="w-full border-2 border-gray-200 focus:border-maroon focus:ring-maroon bg-gray-50/50 h-11"
          />
        </div>

        <div className="h-px bg-gray-100 w-full" />

        {/* NEW PASSWORD */}
        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium text-gray-700 flex items-center">
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
            className="w-full border-gray-300 focus:border-maroon focus:ring-maroon h-11"
          />
        </div>

        {/* CONFIRM NEW PASSWORD */}
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 flex items-center">
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
            className="w-full border-gray-300 focus:border-maroon focus:ring-maroon h-11"
          />
        </div>

        <Button
          onClick={handlePasswordUpdate}
          className="w-full bg-maroon hover:bg-maroon/90 text-white font-bold py-6 shadow-md transition-all active:scale-95"
          disabled={passwordLoading}
        >
          {passwordLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Verifying Security...
            </div>
          ) : (
            <div className="flex items-center">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Secure My Account
            </div>
          )}
        </Button>
      </div>
    </div>
  </CardContent>
</Card>

      {/* Security Notice */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-sm text-blue-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Security Best Practices
          </h4>
          <ul className="text-xs text-blue-700 space-y-2">
            <li className="flex items-start">
              <span className="w-1 h-1 bg-blue-500 rounded-full mt=1.5 mr-2 flex-shrink-0"></span>
              <span>Always choose a strong, unique password with mixed characters</span>
            </li>
            <li className="flex items-start">
              <span className="w-1 h-1 bg-blue-500 rounded-full mt=1.5 mr-2 flex-shrink-0"></span>
              <span>Never share your password with anyone, including friends</span>
            </li>
            <li className="flex items-start">
              <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>Log out after each session, especially on shared devices</span>
            </li>
            <li className="flex items-start">
              <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>Update your password regularly for better security</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </DialogContent>
</Dialog>

      {/* --- NEW: THE WARNING DIALOG --- */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              Security Policy Warning
            </DialogTitle>
            <DialogDescription className="py-4">
              <p className="font-semibold text-gray-900 mb-2">Notice for Students & Guardians:</p>
              Teacher contact details are shared exclusively for parental communication regarding student welfare. 
              <br /><br />
              <span className="text-red-600 font-bold">Unauthorized use or sharing of this information by students is a violation of school policy and will result in a disciplinary penalty.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" onClick={() => setShowWarning(false)}>Cancel</Button>
            <Button 
              className="bg-maroon hover:bg-maroon/90" 
              onClick={fetchTeacherContact}
              disabled={contactLoading}
            >
              {contactLoading ? "Verifying..." : "I am a Parent, I Accept"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}