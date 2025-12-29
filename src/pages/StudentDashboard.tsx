import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Navbar } from "@/Components/Navbar";
import { User, BookOpen, Bell, Calendar, BarChart3, Mail, Phone, Download, Printer, FileText, TrendingUp, Target, Settings, Award, CreditCard } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle } from "@/Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid,ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Input } from "@/Components/ui/input";

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

export default function StudentDashboard({ handleLogout }) {
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

  // Add state for Fees Dialog
  const [isFeesDialogOpen, setIsFeesDialogOpen] = useState(false);
  const [feesStudentData, setFeesStudentData] = useState<any>(null);

  // Add new state for notification tracking
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastViewedTimestamp, setLastViewedTimestamp] = useState<Date | null>(null);

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

  // Initialize last viewed timestamp from localStorage
  useEffect(() => {
    const storedTimestamp = localStorage.getItem('lastViewedNotifications');
    if (storedTimestamp) {
      setLastViewedTimestamp(new Date(storedTimestamp));
    } else {
      // If no timestamp stored, set it to now so only future notifications count as new
      const now = new Date();
      setLastViewedTimestamp(now);
      localStorage.setItem('lastViewedNotifications', now.toISOString());
    }
  }, []);

  // Calculate notification count whenever assignments or announcements change
  useEffect(() => {
    if (!lastViewedTimestamp) return;

    let count = 0;

    // Count new assignments (created after last viewed)
    assignments.forEach(assignment => {
      if (assignment.created_at) {
        const assignmentDate = new Date(assignment.created_at);
        if (assignmentDate > lastViewedTimestamp) {
          count++;
        }
      }
    });

    // Count new announcements (created after last viewed)
    announcements.forEach(announcement => {
      if (announcement.created_at) {
        const announcementDate = new Date(announcement.created_at);
        if (announcementDate > lastViewedTimestamp) {
          count++;
        }
      }
    });

    setNotificationCount(count);
  }, [assignments, announcements, lastViewedTimestamp]);

  // Function to mark notifications as read
  const markNotificationsAsRead = () => {
    const now = new Date();
    console.log('Marking notifications as read at:', now);
    setLastViewedTimestamp(now);
    localStorage.setItem('lastViewedNotifications', now.toISOString());
    setNotificationCount(0);
  };

  // Add debug useEffect to see what's happening with notifications
  useEffect(() => {
    console.log('Notification Debug:');
    console.log('Notification Count:', notificationCount);
    console.log('Last Viewed:', lastViewedTimestamp);
    console.log('Assignments count:', assignments.length);
    console.log('Announcements count:', announcements.length);
    
    if (lastViewedTimestamp) {
      const newAssignments = assignments.filter(a => 
        a.created_at && new Date(a.created_at) > lastViewedTimestamp
      );
      const newAnnouncements = announcements.filter(a => 
        a.created_at && new Date(a.created_at) > lastViewedTimestamp
      );
      
      console.log('New assignments since last view:', newAssignments.length);
      console.log('New announcements since last view:', newAnnouncements.length);
      console.log('New assignments:', newAssignments);
      console.log('New announcements:', newAnnouncements);
    }
  }, [notificationCount, assignments, announcements, lastViewedTimestamp]);

  // Update the fetchAssignments function to be reusable
  const fetchAssignments = async () => {
    setAssignmentsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }

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

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .order('created_at', { ascending: false });

      if (assignmentsError) {
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

    // Subscribe to new assignments
    const assignmentsSubscription = supabase
      .channel('assignments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignments',
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

  // Fetch performance history for the last 10 exams
  useEffect(() => {
    const fetchPerformanceHistory = async () => {
      if (!studentId || !classId) return;
      
      setPerformanceLoading(true);
      try {
        const { data: allAssessments, error } = await supabase
          .from("assessment_results")
          .select(`
            id,
            student_id,
            score,
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
          .eq("assessments.class_id", classId);

        if (error) throw error;

        const examTitles = Array.from(new Set(
          (allAssessments || [])
            .filter(a => firstRel(a.assessments as any)?.title?.startsWith(className || ""))
            .map(a => firstRel(a.assessments as any)?.title)
            .filter(Boolean)
        )).sort((a, b) => extractExamNumber(a) - extractExamNumber(b));

        const examMaxTotals: Record<string, number> = {};
        const examSubjects: Record<string, any[]> = {};
        const examClassPositions: Record<string, Record<string, number>> = {};
        
        examTitles.forEach(title => {
          const examAssessments = (allAssessments || []).filter(a => firstRel(a.assessments as any)?.title === title);
          const studentTotals: Record<string, number> = {};
          
          examAssessments.forEach(assessment => {
            const studentId = assessment.student_id;
            if (!studentTotals[studentId]) {
              studentTotals[studentId] = 0;
            }
            studentTotals[studentId] += assessment.score || 0;
          });

          const sortedStudents = Object.entries(studentTotals)
            .sort(([, a], [, b]) => b - a)
            .reduce((acc, [studentId, total], index) => {
              acc[studentId] = index + 1;
              return acc;
            }, {} as Record<string, number>);

          examClassPositions[title] = sortedStudents;

          const subjects = new Set(
            examAssessments.map(a => firstRel(a.subjects as any)?.name).filter(Boolean)
          );
          examMaxTotals[title] = Array.from(subjects).length * 100;
          
          examSubjects[title] = examAssessments
            .filter(a => a.student_id === studentId)
            .map(record => ({
              subject: firstRel(record.subjects as any)?.name,
              score: record.score,
              total_score: 100,
              percentage: Math.round((record.score / 100) * 100),
              grade: calculateKJSEAGrade(record.score / 100)
            }));
        });

        const studentAssessments = (allAssessments || []).filter(a => a.student_id === studentId);
        
        const performanceData: PerformanceRecord[] = examTitles.map(title => {
          const studentScores = studentAssessments.filter(
            a => firstRel(a.assessments as any)?.title === title
          );
          
          const totalScore = studentScores.reduce((sum, a) => sum + (a.score || 0), 0);
          const maxTotal = examMaxTotals[title] || 100;
          const percentage = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;
          const classPosition = examClassPositions[title]?.[studentId] || 1;

          const isEndYearExam = title.toLowerCase().includes('end year') || 
                               title.toLowerCase().includes('final') ||
                               title.toLowerCase().includes('annual') ||
                               title.toLowerCase().includes('year end');

          return {
            id: `${title}-${studentId}`,
            title: title,
            term: firstRel(studentScores[0]?.assessments as any)?.term || "Unknown Term",
            year: firstRel(studentScores[0]?.assessments as any)?.year || new Date().getFullYear(),
            assessment_date: studentScores[0]?.assessment_date || new Date().toISOString(),
            subjects: {
              name: isEndYearExam ? "Overall" : "Multiple Subjects"
            },
            score: totalScore,
            total_score: maxTotal,
            percentage: percentage,
            grade: calculateKJSEAGrade(totalScore / maxTotal),
            isEndYearExam: isEndYearExam,
            subjectBreakdown: isEndYearExam ? null : examSubjects[title],
            classPosition: classPosition
          };
        }).filter(record => record.score > 0)
          .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())
          .slice(0, 10);

        setPerformanceHistory(performanceData);
      } catch (err: any) {
        console.error("Error fetching performance history:", err);
        setError(err.message);
      } finally {
        setPerformanceLoading(false);
      }
    };

    fetchPerformanceHistory();
  }, [studentId, classId, className]);

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
  const downloadYearlyPerformancePDF = () => {
    const yearlyData: Record<number, PerformanceRecord[]> = {};
    recentPerformance.forEach(record => {
      if (!yearlyData[record.year]) {
        yearlyData[record.year] = [];
      }
      yearlyData[record.year].push(record);
    });

    let yearlyContent = '';
    Object.entries(yearlyData).forEach(([year, records]) => {
      const yearlyTotal = records.reduce((sum, record) => sum + record.score, 0);
      const yearlyMaxTotal = records.reduce((sum, record) => sum + record.total_score, 0);
      const yearlyAverage = yearlyMaxTotal > 0 ? Math.round((yearlyTotal / yearlyMaxTotal) * 100) : 0;

      yearlyContent += `
        <div style="margin-bottom: 40px;">
          <h2 style="color: #800000; border-bottom: 2px solid #800000; padding-bottom: 10px;">Year ${year} Performance Summary</h2>
          
          <table>
            <thead>
              <tr>
                <th>Exam Title</th>
                <th>Total Marks</th>
                <th>Class Position</th>
                <th>Assessment Date</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(record => `
                <tr>
                  <td>${record.title}</td>
                  <td>${record.score} / ${record.total_score}</td>
                  <td class="position-${record.classPosition}">${record.classPosition}</td>
                  <td>${new Date(record.assessment_date).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <h3>Year ${year} Summary</h3>
            <p><strong>Total Score:</strong> ${yearlyTotal} / ${yearlyMaxTotal}</p>
            <p><strong>Average Percentage:</strong> ${yearlyAverage}%</p>
            <p><strong>Overall KJSEA Level:</strong> <span class="grade-${calculateKJSEAGrade(yearlyTotal / yearlyMaxTotal)}">${calculateKJSEAGrade(yearlyTotal / yearlyMaxTotal)}</span></p>
            <p><strong>Exams Taken:</strong> ${records.length}</p>
            <p><strong>Best Position:</strong> ${Math.min(...records.map(r => r.classPosition))}</p>
          </div>
        </div>
      `;
    });

    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Yearly Performance Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #800000; padding-bottom: 20px; }
          .student-info { margin-bottom: 30px; background: #f9f0f0; padding: 15px; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
          th { background-color: #800000; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .summary { background-color: #f9f0f0; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #800000; }
          .grade-EE1 { color: #27ae60; font-weight: bold; }
          .grade-EE2 { color: #2980b9; font-weight: bold; }
          .grade-ME1 { color: #3498db; font-weight: bold; }
          .grade-ME2 { color: #9b59b6; font-weight: bold; }
          .grade-AE1 { color: #f39c12; font-weight: bold; }
          .grade-AE2 { color: #e67e22; font-weight: bold; }
          .grade-BE1 { color: #e74c3c; font-weight: bold; }
          .grade-BE2 { color: #95a5a6; font-weight: bold; }
          .position-1 { background-color: #d4edda; font-weight: bold; }
          .position-2 { background-color: #fff3cd; font-weight: bold; }
          .position-3 { background-color: #f8d7da; font-weight: bold; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="color: #800000;">Yearly Academic Performance Report</h1>
        </div>
        
        <div class="student-info">
          <h3>Student Information</h3>
          <p><strong>Name:</strong> ${profile?.first_name} ${profile?.last_name}</p>
          <p><strong>Student ID:</strong> ${profile?.reg_no}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Report Period:</strong> ${Object.keys(yearlyData).join(', ')}</p>
          <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        ${yearlyContent}

        <div class="footer">
          <p>Generated by Student Portal • ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yearly-performance-${profile?.reg_no || "student"}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download individual exam results as HTML
  const downloadExamResultsPDF = (examRecord: PerformanceRecord) => {
    const classPosition = examRecord.classPosition || 'N/A';
    const subjectBreakdown = examRecord.subjectBreakdown;

    let subjectContent = '';
    let summaryContent = '';

    if (subjectBreakdown && subjectBreakdown.length > 0) {
      subjectContent = `
        <div class="subject-results">
          <h3>Subject-wise Performance</h3>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Score</th>
                <th>Total</th>
                <th>Percentage</th>
                <th>KJSEA Level</th>
              </tr>
            </thead>
            <tbody>
              ${subjectBreakdown.map(subject => `
                <tr>
                  <td>${subject.subject}</td>
                  <td>${subject.score}</td>
                  <td>${subject.total_score}</td>
                  <td>${subject.percentage}%</td>
                  <td class="grade-${subject.grade.split(' ')[0]}">${subject.grade}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      subjectContent = `
        <div class="subject-results">
          <h3>Overall Performance</h3>
          <table>
            <thead>
              <tr>
                <th>Score</th>
                <th>Total</th>
                <th>Percentage</th>
                <th>KJSEA Level</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${examRecord.score}</td>
                <td>${examRecord.total_score}</td>
                <td>${examRecord.percentage}%</td>
                <td class="grade-${examRecord.grade.split(' ')[0]}">${examRecord.grade}</td>
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
      <div class="summary">
        <h3>Exam Summary</h3>
        <div class="summary-grid">
          <div class="summary-item"><span class="label">Exam Title:</span><span class="value">${examRecord.title}</span></div>
          <div class="summary-item"><span class="label">Total Marks:</span><span class="value">${totalScore} / ${maxTotal}</span></div>
          <div class="summary-item"><span class="label">Class Position:</span><span class="value position-${classPosition}">${classPosition}</span></div>
          <div class="summary-item"><span class="label">Percentage:</span><span class="value">${averagePercentage}%</span></div>
          <div class="summary-item"><span class="label">KJSEA Level:</span><span class="value grade-${examRecord.grade.split(' ')[0]}">${examRecord.grade}</span></div>
        </div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Exam Results - ${examRecord.title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin:0; padding:20px; color:#333; background:#fff; }
          .header { text-align:center; margin-bottom:30px; border-bottom:2px solid #800000; padding-bottom:20px; }
          .header h1 { margin:0; color:#800000; font-size:24px; }
          .student-info { margin:20px 0; background:#f9f0f0; padding:15px; border-radius:8px; border-left:4px solid #800000; }
          .info-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px; }
          .info-item { display:flex; justify-content:space-between; padding:5px 0; }
          .info-item .label { font-weight:bold; color:#555; }
          table { width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; }
          th,td { border:1px solid #ddd; padding:12px; text-align:left; }
          th { background:#800000; color:white; font-weight:600; }
          tr:nth-child(even) { background:#f9f9f9; }
          .subject-results { margin:30px 0; }
          .subject-results h3 { color:#800000; border-bottom:1px solid #eee; padding-bottom:10px; }
          .summary { background:#f9f0f0; padding:20px; margin:30px 0; border-radius:8px; border-left:4px solid #800000; }
          .summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:10px; }
          .summary-item { display:flex; justify-content:space-between; background:white; border:1px solid #e1e1e1; padding:8px; border-radius:6px; }
          .footer { text-align:center; margin-top:40px; font-size:12px; color:#7f8c8d; border-top:1px solid #eee; padding-top:20px; }
          .grade-EE1 { color:#27ae60; font-weight:bold; }
          .grade-EE2 { color:#2980b9; font-weight:bold; }
          .grade-ME1 { color:#3498db; font-weight:bold; }
          .grade-ME2 { color:#9b59b6; font-weight:bold; }
          .grade-AE1 { color:#f39c12; font-weight:bold; }
          .grade-AE2 { color:#e67e22; font-weight:bold; }
          .grade-BE1 { color:#e74c3c; font-weight:bold; }
          .grade-BE2 { color:#95a5a6; font-weight:bold; }
          .position-1 { background:#d4edda; color:#155724; font-weight:bold; padding:2px 8px; border-radius:4px; }
          .position-2 { background:#fff3cd; color:#856404; font-weight:bold; padding:2px 8px; border-radius:4px; }
          .position-3 { background:#f8d7da; color:#721c24; font-weight:bold; padding:2px 8px; border-radius:4px; }
        </style>
      </head>
      <body>
        <div class="header"><h1>${examRecord.title} - Exam Report</h1></div>
        <div class="student-info">
          <div class="info-grid">
            <div class="info-item"><span class="label">Name:</span><span>${profile?.first_name} ${profile?.last_name}</span></div>
            <div class="info-item"><span class="label">Student ID:</span><span>${profile?.reg_no}</span></div>
            <div class="info-item"><span class="label">Class:</span><span>${className}</span></div>
            <div class="info-item"><span class="label">Exam Date:</span><span>${new Date(examRecord.assessment_date).toLocaleDateString()}</span></div>
          </div>
        </div>

        ${subjectContent}
        ${summaryContent}

        <div class="footer">
          Generated by Student Portal • ${new Date().toLocaleDateString()}
        </div>

        <script>
          window.onload = function() { setTimeout(() => { window.print(); }, 500); }
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-results-${examRecord.title.replace(/\s+/g, '-').toLowerCase()}-${profile?.reg_no || 'student'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Subject Analysis Dialog Handler ---
  const handleSubjectClick = async (subjectName: string) => {
    setSelectedSubject(subjectName);
    setAnalysisLoading(true);

    const examTitles = exams.map(e => e.title);
    const subjectAssessments = assessments.filter(
      a => a.subjects?.name === subjectName && a.student_id === studentId
    );

    const subjectAnalysisData = examTitles.map(examTitle => {
      const found = subjectAssessments.find(
        a => a.assessments?.title === examTitle
      );
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
        const { data, error } = await supabase
          .from("teachers")
          .select("first_name, last_name, email, phone")
          .eq("id", tcData.teacher_id)
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
      
      // REMOVED parent_phone from students query - it doesn't exist in that table
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, Reg_no, first_name, last_name, auth_id") // Removed parent_phone
        .eq("auth_id", user.id)
        .single();
      if (studentError) throw studentError;
      if (!studentData) throw new Error("No student found");
      setStudent(studentData);
      setStudentId(studentData.id);

      // Profile now contains guardian_phone
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("student_id", studentData.id)
        .single();
      if (profileError) throw profileError;
      if (!profileData) throw new Error("No student profile found");
      setProfile(profileData);

      // Log to verify guardian_phone is available
      console.log("Profile loaded - Guardian Phone:", profileData.guardian_phone);

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

      const { data: assessmentsData, error } = await supabase
        .from("assessment_results")
        .select(`
          id,
          student_id,
          score,
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
        .eq("assessments.class_id", classId);

      if (error) {
        console.error("Error fetching assessments:", error);
        setAssessments([]);
      } else {
        setAssessments(assessmentsData || []);
      }
      setAssessmentsLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchStudentData();
}, []);

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
const handlePasswordUpdate = async () => {
  setPasswordLoading(true);
  setPasswordError(null);
  setPasswordSuccess(null);

  try {
    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error("All password fields are required");
    }

    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long");
    }

    if (newPassword !== confirmPassword) {
      throw new Error("New passwords do not match");
    }

    // Update password using Supabase
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    setPasswordSuccess("Password updated successfully!");
    
    // Reset form
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    // Clear success message after 3 seconds
    setTimeout(() => {
      setPasswordSuccess(null);
    }, 3000);

  } catch (err: any) {
    console.error("Error updating password:", err);
    setPasswordError(err.message);
  } finally {
    setPasswordLoading(false);
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
    if (!assessments || assessments.length === 0 || !className) return [];
    const examTitleSet = new Set<string>();
    assessments.forEach(a => {
      if (a.assessments?.title && a.assessments?.title.startsWith(className)) {
        examTitleSet.add(a.assessments.title);
      }
    });
    return Array.from(examTitleSet)
      .sort((a, b) => extractExamNumber(a) - extractExamNumber(b))
      .map(title => ({ id: title, title }));
  }, [assessments, className]);

  // Pivot data for assessment table
  const pivotData = useMemo(() => {
    if (!assessments || assessments.length === 0 || !studentId || !className) return [];

    const examTitles = exams.map(e => e.title);
    const grouped: Record<string, any> = {};
    
    assessments.forEach(a => {
      if (a.student_id !== studentId) return;
      const subject = a.subjects?.name || "Unknown Subject";
      const examTitle = a.assessments?.title || "Untitled Exam";
      if (!grouped[subject]) {
        grouped[subject] = { subject, exams: {} };
      }
      grouped[subject].exams[examTitle] = a.score;
    });
    
    const rows = Object.values(grouped).map((row: any) => ({
      subject: row.subject,
      exams: examTitles.reduce((acc: Record<string, any>, title) => {
        acc[title] = row.exams[title] ?? "-";
        return acc;
      }, {}),
    }));

    const totals: Record<string, number> = {};
    examTitles.forEach(title => {
      let sum = 0;
      Object.values(grouped).forEach((row: any) => {
        const score = row.exams[title];
        if (typeof score === "number") sum += score;
      });
      totals[title] = sum;
    });

    const positions: Record<string, number | string> = {};
    const resultsSource = assessments || [];
    
    examTitles.forEach(title => {
      const totalsByStudent: Record<string, number> = {};
      resultsSource.forEach(row => {
        const sid = row.student_id;
        const rowTitle = row.assessments?.title;
        const scoreRaw = row.score;
        const score = typeof scoreRaw === "number" ? scoreRaw : scoreRaw != null && !Number.isNaN(Number(scoreRaw)) ? Number(scoreRaw) : null;
        if (!sid || !rowTitle || rowTitle !== title || score === null) return;
        totalsByStudent[sid] = (totalsByStudent[sid] || 0) + score;
      });
      
      const studentIds = Object.keys(totalsByStudent);
      if (studentIds.length === 0) {
        positions[title] = "-";
        return;
      }
      
      const ranked = Object.entries(totalsByStudent).sort((a, b) => b[1] - a[1]);
      const ranks: Record<string, number> = {};
      let prevScore: number | null = null;
      let prevRank = 0;
      
      for (let i = 0; i < ranked.length; i++) {
        const [sid, total] = ranked[i];
        if (i === 0) {
          ranks[sid] = 1;
          prevRank = 1;
          prevScore = total;
        } else {
          if (total === prevScore) {
            ranks[sid] = prevRank;
          } else {
            const rank = i + 1;
            ranks[sid] = rank;
            prevRank = rank;
            prevScore = total;
          }
        }
      }
      positions[title] = ranks[studentId] ?? "-";
    });

    return [
      ...rows,
      { subject: "Totals", exams: totals },
      { subject: "Position", exams: positions }
    ];
  }, [assessments, studentId, className, exams]);

  // Calculate GPA using KJSEA levels
  const calculateGPA = () => {
    if (!assessments || assessments.length === 0 || !studentId) return "-";
    const myScores = assessments.filter(a => a.student_id === studentId);
    if (!myScores.length) return "-";
    const total = myScores.reduce((sum, a) => sum + (a.score || 0), 0);
    const avg = total / myScores.length;
    
    // Convert to KJSEA GPA scale
    const percentage = avg; // score out of 100
    
    if (percentage >= 90) return "8.0 (EE1)";
    if (percentage >= 75) return "7.0 (EE2)";
    if (percentage >= 58) return "6.0 (ME1)";
    if (percentage >= 41) return "5.0 (ME2)";
    if (percentage >= 31) return "4.0 (AE1)";
    if (percentage >= 21) return "3.0 (AE2)";
    if (percentage >= 11) return "2.0 (BE1)";
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
      // @ts-ignore - Navbar props include runtime notificationCount not declared in NavbarProps
      <Navbar {...({ showLogout: true, handleLogout, notificationCount, onNotificationClick: markNotificationsAsRead } as any)} />
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Modern Welcome Header - UPDATED WITH FEES MANAGEMENT BUTTON */}
        <div className="bg-maroon-50 rounded-2xl p-8 border border-maroon-200 shadow-sm relative">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {profile.first_name} {profile.last_name}
              </h1>
              <p className="text-gray-600 mt-2">Ready to achieve your academic goals today</p>
              <div className="flex gap-6 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>ID: {profile?.reg_no}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Class: {className}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <span>KJSEA Level: {calculateGPA()}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-4 ml-6">
              {/* Attendance */}
              <div className="bg-maroon/5 rounded-xl p-4 text-center min-w-24 border border-maroon/10">
                <div className="text-2xl font-bold text-maroon">{attendanceData?.attendanceRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Attendance</div>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markNotificationsAsRead}
                  className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors relative"
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                  {notificationCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                      {notificationCount}
                    </span>
                  )}
                </Button>
              </div>

              {/* Fees Management Button - NOW OPENS POPUP */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleFeesManagement}
                className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                Fee Statement
              </Button>

              {/* Settings Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log("Settings button clicked");
                  setIsSettingsOpen(true);
                }}
                className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
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
                {pivotData.length > 0 ? (
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
            No assignments have been uploaded yet.
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
      {/* Enhanced Subject Analysis Dialog - THEMED & SCROLLABLE */}
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
    
    <div className="space-y-6 py-2">
      {analysisLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading detailed analysis...</p>
        </div>
      ) : (
        <>
          {/* Teacher Information Card */}
          {/* Teacher Information Card - Compact Vertical Layout */}
{teacherInfo && (
  <Card className="bg-gradient-to-r from-maroon/5 to-maroon/10 border-maroon/20 shadow-sm">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-maroon/10 rounded-full flex items-center justify-center mr-3">
              <User className="h-5 w-5 text-maroon" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-gray-900">
                {selectedSubject} Teacher
              </h4>
              <p className="text-sm text-gray-600">Your subject instructor</p>
            </div>
          </div>
          
          {/* Contact Information - Compact Vertical Layout */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-maroon mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-700 text-sm">Name</div>
                <div className="text-gray-900">{teacherInfo.first_name} {teacherInfo.last_name}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-maroon mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-700 text-sm">Email</div>
                <div className="text-gray-900 truncate">{teacherInfo.email}</div>
              </div>
            </div>

            {teacherInfo.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-maroon mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-700 text-sm">Phone</div>
                  <div className="text-gray-900 font-mono">{teacherInfo.phone}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Contact Action Buttons */}
        {teacherInfo.phone && (
          <div className="flex flex-col items-end gap-3 ml-6">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-maroon text-maroon hover:bg-maroon hover:text-white transition-colors whitespace-nowrap"
              onClick={() => {
                navigator.clipboard.writeText(teacherInfo.phone);
                alert(`Phone number ${teacherInfo.phone} copied to clipboard!`);
              }}
            >
              <Phone className="h-4 w-4 mr-2" />
              Copy Phone
            </Button>
            <a 
              href={`tel:${teacherInfo.phone}`}
              className="text-xs text-maroon hover:text-maroon/80 transition-colors text-center"
            >
              Tap to call
            </a>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)}

          {subjectAnalysis.length > 0 ? (
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
        </>
      )}
    </div>
  </DialogContent>
</Dialog>

      {/* Fees Dialog - NEW POPUP MODAL */}
      <Dialog open={isFeesDialogOpen} onOpenChange={setIsFeesDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0 border-maroon/20 bg-white">
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
      <Card className="border-maroon/20">
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-maroon" />
            Change Password
          </h3>
          
          {/* Error/Success Messages */}
          {passwordError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                {passwordError}
              </div>
            </div>
          )}
          
          {passwordSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {passwordSuccess}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 flex items-center">
                <span className="w-2 h-2 bg-maroon rounded-full mr-2"></span>
                Current Password
              </label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                disabled={passwordLoading}
                className="w-full border-gray-300 focus:border-maroon focus:ring-maroon"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium text-gray-700 flex items-center">
                <span className="w-2 h-2 bg-maroon rounded-full mr-2"></span>
                New Password
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                disabled={passwordLoading}
                className="w-full border-gray-300 focus:border-maroon focus:ring-maroon"
              />
              <p className="text-xs text-gray-500 flex items-center">
                <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                Must be at least 6 characters long
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 flex items-center">
                <span className="w-2 h-2 bg-maroon rounded-full mr-2"></span>
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                disabled={passwordLoading}
                className="w-full border-gray-300 focus:border-maroon focus:ring-maroon"
              />
            </div>

            <Button
              onClick={handlePasswordUpdate}
              className="w-full bg-maroon hover:bg-maroon/90 text-white font-semibold py-2.5 transition-all duration-200"
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Password...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
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
              <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
              <span>Always choose a strong, unique password with mixed characters</span>
            </li>
            <li className="flex items-start">
              <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
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
    </div>
  );
}