import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/Components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Navbar } from "@/Components/Navbar";
import { User, BookOpen, MessageSquare, Upload, Users, TrendingUp, FileText, Plus, Send, Trash2, Mail, Phone, Calendar, X, TrendingDown, Settings, Minus, Target, Edit, Save, Eye, EyeOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { supabase } from "../lib/supabaseClient";

// ---------- Types ----------
interface Teacher {
  id: string;
  auth_id: string;
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  is_admin: boolean;
}

interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  classes?: {
    id: string;
    name: string;
    grade_level: string;
    created_at: string;
  } | {
    id: string;
    name: string;
    grade_level: string;
    created_at: string;
  }[];
  subjects?: {
    id: string;
    name: string;
    code: string;
    created_at: string;
  } | {
    id: string;
    name: string;
    code: string;
    created_at: string;
  }[];
}

interface Assignment {
  id: string;
  title: string;
  subject_id: string;
  class_id: string;
  due_date: string;
  created_at: string;
  file_url: string | null;
  description: string | null;
  total_marks: number | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string | null;
  class_id: string;
  created_at: string;
  priority: string;
  expires_at: string | null;
  is_for_all_classes: boolean;
}

interface Student {
  id: string;
  Reg_no: string;
  first_name: string;
  last_name: string;
  created_at: string;
  auth_id: string | null;
  enrollments?: {
    class_id: string;
    classes: {
      name: string;
      grade_level: string;
    } | {
      name: string;
      grade_level: string;
    }[];
  }[];
  profiles?: {
    email: string;
    phone: string;
    date_of_birth: string;
    guardian_name: string;
    guardian_phone: string;
  } | {
    email: string;
    phone: string;
    date_of_birth: string;
    guardian_name: string;
    guardian_phone: string;
  }[];
}

interface ClassDetail {
  id: string;
  name: string;
  grade_level: string;
  created_at: string;
  student_count: number;
  subject_count: number;
}

interface ClassPerformanceData {
  assessment: string;
  subject: string;
  class: string;
  mean: number;
}

interface GradeDistribution {
  grade: string;
  count: number;
  color: string;
}

interface StudentPerformance {
  student_name: string;
  subject: string;
  average_score: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface StudentAssessment {
  id: string;
  title: string;
  score: number;
  max_marks: number;
  percentage: number;
  assessment_date: string;
  subject: string;
  term: number;
  year: number;
}

interface StudentPerformanceDetail {
  student: Student & { class?: string };
  assessments: StudentAssessment[];
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
  subjectAverages: { subject: string; average: number }[];
  gradeDistribution: { grade: string; count: number }[];
  recentTrend: number;
}

// ---------- KJSEA Achievement Levels (2025) ----------
const KJSEA_LEVELS = [
  { label: "EE1 (L8)", min: 90, max: 100, color: "#10B981", description: "Exceptional" },
  { label: "EE2 (L7)", min: 75, max: 89, color: "#22C55E", description: "Excellent" },
  { label: "ME1 (L6)", min: 58, max: 74, color: "#3B82F6", description: "Very Good" },
  { label: "ME2 (L5)", min: 41, max: 57, color: "#8B5CF6", description: "Good" },
  { label: "AE1 (L4)", min: 31, max: 40, color: "#F59E0B", description: "Average" },
  { label: "AE2 (L3)", min: 21, max: 30, color: "#F97316", description: "Below Average" },
  { label: "BE1 (L2)", min: 11, max: 20, color: "#EF4444", description: "Poor" },
  { label: "BE2 (L1)", min: 0, max: 10, color: "#6B7280", description: "Very Poor" },
] as const;

// Calculate KJSEA grade based on percentage
const calculateKJSEAGrade = (percentage: number): string => {
  const level = KJSEA_LEVELS.find(level => percentage >= level.min && percentage <= level.max);
  return level ? level.label : "BE2 (L1)";
};

// Helper to normalize relation fields returned by Supabase (may be object or single-item array)
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

// ---------- Custom Hooks ----------
const useTeacherProfile = () => {
  const [profile, setProfile] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error(userError?.message || "No user found");
        }

        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .eq('auth_id', user.id)
          .single();

        if (teacherError) throw new Error(teacherError.message);
        
        setProfile(teacher);
      } catch (err) {
        console.error("Error fetching teacher profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { profile, loading, error };
};

const useTeacherClasses = (teacherId: string | undefined) => {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teacherId) {
      setClasses([]);
      return;
    }

    const fetchClasses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("teacher_classes")
          .select(`
            id,
            teacher_id,
            class_id,
            subject_id,
            created_at,
            classes (
              id,
              name,
              grade_level,
              created_at
            ),
            subjects (
              id,
              name,
              code,
              created_at
            )
          `)
          .eq("teacher_id", teacherId);

        if (error) throw error;
        setClasses(data || []);
      } catch (error) {
        console.error("Error fetching teacher classes:", error);
        setClasses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [teacherId]);

  return { classes, loading };
};

// ---------- useStudentPerformanceDetail Hook ----------
const useStudentPerformanceDetail = (studentId: string | null, teacherClasses: TeacherClass[]) => {
  const [performanceDetail, setPerformanceDetail] = useState<StudentPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !teacherClasses.length) {
      setPerformanceDetail(null);
      return;
    }

    const fetchStudentPerformanceDetail = async () => {
      setLoading(true);
      try {
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select(`
            id,
            Reg_no,
            first_name,
            last_name,
            created_at,
            auth_id,
            profiles (*),
            enrollments (
              class_id,
              classes (
                name,
                grade_level
              )
            )
          `)
          .eq("id", studentId)
          .single();
          
        if (studentError) throw studentError;

        let studentClassId: string | undefined;
        let studentClassName = 'No Class';
        
        if (studentData.enrollments && Array.isArray(studentData.enrollments)) {
          studentClassId = studentData.enrollments[0]?.class_id;
          const enrollment = studentData.enrollments[0];
          if (enrollment && enrollment.classes) {
            const classData = firstRel(enrollment.classes as any);
            studentClassName = classData?.name || 'No Class';
          }
        } else if (studentData.enrollments && typeof studentData.enrollments === 'object') {
          studentClassId = (studentData.enrollments as any).class_id;
          const classData = firstRel((studentData.enrollments as any).classes);
          studentClassName = classData?.name || 'No Class';
        }

        if (!studentClassId) {
          console.warn("No class ID found for student");
          setPerformanceDetail(null);
          setLoading(false);
          return;
        }

        const teacherSubjectsForStudentClass = teacherClasses
          .filter(tc => tc.class_id === studentClassId);

        if (teacherSubjectsForStudentClass.length === 0) {
          console.warn("Teacher has no subjects for student's class");
          setPerformanceDetail(null);
          setLoading(false);
          return;
        }

        const subjectIds = teacherSubjectsForStudentClass.map(tc => tc.subject_id);

        const { data: assessmentResults, error: resultsError } = await supabase
          .from("assessment_results")
          .select(`
            id,
            score,
            assessment_date,
            max_marks,
            subject_id,
            assessments (
              id,
              title,
              term,
              year,
              class_id,
              created_at
            ),
            subjects (
              name
            )
          `)
          .eq("student_id", studentId)
          .in("subject_id", subjectIds)
          .order("assessment_date", { ascending: false })
          .limit(20);

        if (resultsError) throw resultsError;

        const subjectMap = teacherSubjectsForStudentClass.reduce((acc, tc) => {
          const subjName = firstRel(tc.subjects)?.name;
          if (subjName) acc[tc.subject_id] = subjName;
          return acc;
        }, {} as Record<string, string>);
        
        const assessments: StudentAssessment[] = (assessmentResults || [])
          .filter(ar => ar.assessments && ar.subjects && subjectMap[ar.subject_id])
          .map(ar => ({
            id: ar.id,
            title: firstRel(ar.assessments as any)?.title,
            score: parseFloat(ar.score),
            max_marks: ar.max_marks || 100,
            percentage: (parseFloat(ar.score) / (ar.max_marks || 100)) * 100,
            assessment_date: ar.assessment_date,
            subject: firstRel(ar.subjects as any)?.name,
            term: firstRel(ar.assessments as any)?.term,
            year: firstRel(ar.assessments as any)?.year
          }))
          .slice(0, 10);

        const subjectAverages = teacherSubjectsForStudentClass.map(tc => {
          const subjectAssessments = assessments.filter(a => 
            a.subject === firstRel(tc.subjects)?.name
          );
          const average = subjectAssessments.length > 0 
            ? subjectAssessments.reduce((sum, a) => sum + a.percentage, 0) / subjectAssessments.length
            : 0;
          return {
            subject: firstRel(tc.subjects)?.name || "Unknown",
            average: parseFloat(average.toFixed(1))
          };
        }).filter(sa => sa.average > 0);

        const overallAverage = assessments.length > 0
          ? assessments.reduce((sum, a) => sum + a.percentage, 0) / assessments.length
          : 0;

        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        let recentTrend = 0;

        if (assessments.length >= 4) {
          const sortedAssessments = [...assessments].sort((a, b) => 
            new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
          );
          
          const n = sortedAssessments.length;
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          
          sortedAssessments.forEach((assessment, index) => {
            const x = index;
            const y = assessment.percentage;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
          });
          
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          recentTrend = parseFloat((slope * 10).toFixed(1));
          
          if (recentTrend > 2) trend = 'improving';
          else if (recentTrend < -2) trend = 'declining';
          else trend = 'stable';
        } else if (assessments.length >= 2) {
          const sortedAssessments = [...assessments].sort((a, b) => 
            new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
          );
          const firstHalf = sortedAssessments.slice(0, Math.ceil(sortedAssessments.length / 2));
          const secondHalf = sortedAssessments.slice(-Math.floor(sortedAssessments.length / 2));
          
          const firstAvg = firstHalf.reduce((sum, a) => sum + a.percentage, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, a) => sum + a.percentage, 0) / secondHalf.length;
          recentTrend = parseFloat((secondAvg - firstAvg).toFixed(1));
          
          if (recentTrend > 5) trend = 'improving';
          else if (recentTrend < -5) trend = 'declining';
          else trend = 'stable';
        }

        const gradeDistribution = KJSEA_LEVELS.map(level => ({
          grade: level.label,
          count: assessments.filter(a => a.percentage >= level.min && a.percentage <= level.max).length
        }));

        const performanceData = {
          student: {
            ...studentData,
            class: studentClassName
          },
          assessments,
          averageScore: parseFloat(overallAverage.toFixed(1)),
          trend,
          subjectAverages,
          gradeDistribution,
          recentTrend
        };

        setPerformanceDetail(performanceData);
      } catch (error) {
        console.error("Error fetching student performance detail:", error);
        setPerformanceDetail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentPerformanceDetail();
  }, [studentId, teacherClasses]);

  return { performanceDetail, loading };
};

// ---------- Settings Modal Component ----------
interface SettingsModalProps {
  profile: Teacher;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ profile, isOpen, onClose, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const resetForm = () => {
    setPhone(profile.phone || "");
    setEmail(profile.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsEditingPhone(false);
    setIsEditingEmail(false);
    setMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setMessage({ type: "error", text: "Phone number cannot be empty" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      const { error: updateError } = await supabase
        .from('teachers')
        .update({ phone: phone.trim() })
        .eq('auth_id', user.id);
      
      if (updateError) throw updateError;
      
      setMessage({ type: "success", text: "Phone number updated successfully" });
      setIsEditingPhone(false);
      onProfileUpdate();
    } catch (error) {
      console.error("Error updating phone:", error);
      setMessage({ type: "error", text: "Failed to update phone number" });
    } finally {
      setLoading(false);
    }
  };

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }

    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user?.email === email.trim()) {
        setMessage({ type: "info", text: "This is already your current email." });
        setIsEditingEmail(false);
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) throw authError;

      const { error: tableError } = await supabase
        .from('teachers')
        .update({ email: email.trim() })
        .eq('auth_id', user.id);
      if (tableError) throw tableError;

      setMessage({
        type: "success",
        text: "Email updated! Verification links sent to your old and new email."
      });
      setIsEditingEmail(false);
      if (onProfileUpdate) onProfileUpdate();

    } catch (error: any) {
      console.error("Error updating email:", error);
      setMessage({ type: "error", text: error.message || "Failed to update email" });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Please fill in all password fields" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters long" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: "success", text: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      setMessage({ type: "error", text: "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 sm:space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Teacher Settings</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Manage your profile information and security settings
          </DialogDescription>
        </DialogHeader>

        <div className="flex space-x-2 sm:space-x-4 border-b overflow-x-auto">
          <button
            className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            Profile Information
          </button>
          <button
            className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
              activeTab === "password"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("password")}
          >
            Update Password
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-md text-xs sm:text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Your basic profile information
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-muted-foreground">First Name</label>
                    <Input value={profile.first_name} disabled className="mt-1 h-9 sm:h-10 text-xs sm:text-sm" />
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-muted-foreground">Last Name</label>
                    <Input value={profile.last_name} disabled className="mt-1 h-9 sm:h-10 text-xs sm:text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-muted-foreground">Teacher Code</label>
                    <Input value={profile.teacher_code} disabled className="mt-1 h-9 sm:h-10 text-xs sm:text-sm" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-muted-foreground">Email Address</label>
                    {!isEditingEmail ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingEmail(true)}
                        className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex space-x-1 sm:space-x-2">
                        <Button
                          size="sm"
                          onClick={(e) => updateEmail(e)}
                          disabled={loading}
                          className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingEmail(false);
                            setEmail(profile.email || "");
                          }}
                          className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditingEmail ? (
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="h-9 sm:h-10 text-xs sm:text-sm"
                    />
                  ) : (
                    <Input value={profile.email || "Not set"} disabled className="h-9 sm:h-10 text-xs sm:text-sm" />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-muted-foreground">Phone Number</label>
                    {!isEditingPhone ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPhone(true)}
                        className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex space-x-1 sm:space-x-2">
                        <Button
                          size="sm"
                          onClick={(e) => updatePhone(e)}
                          disabled={loading}
                          className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingPhone(false);
                            setPhone(profile.phone || "");
                          }}
                          className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditingPhone ? (
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter your phone number"
                      className="h-9 sm:h-10 text-xs sm:text-sm"
                    />
                  ) : (
                    <Input value={profile.phone || "Not set"} disabled className="h-9 sm:h-10 text-xs sm:text-sm" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Account Information</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Your account details and membership
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Account Type</span>
                  <span className="text-xs sm:text-sm font-medium">
                    {profile.is_admin ? "Administrator" : "Teacher"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Member Since</span>
                  <span className="text-xs sm:text-sm font-medium">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">User ID</span>
                  <span className="text-xs sm:text-sm font-medium font-mono">
                    {profile.first_name}.{profile.last_name}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "password" && (
          <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Update Password</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Change your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Current Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="h-9 sm:h-10 text-xs sm:text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 sm:px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      className="h-9 sm:h-10 text-xs sm:text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 sm:px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      className="h-9 sm:h-10 text-xs sm:text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 sm:px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={updatePassword}
                  disabled={loading}
                  className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </Button>

                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <h4 className="text-xs sm:text-sm font-medium text-blue-800 mb-1">Password Requirements</h4>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    <li>• At least 6 characters long</li>
                    <li>• Include uppercase and lowercase letters</li>
                    <li>• Include numbers and special characters for better security</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ---------- Dialog Components ----------
interface CreateAssignmentDialogProps {
  teacherClasses: TeacherClass[];
  onAssignmentCreated: () => void;
}

const CreateAssignmentDialog: React.FC<CreateAssignmentDialogProps> = ({ 
  teacherClasses, 
  onAssignmentCreated 
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const resetForm = () => {
    setTitle("");
    setDueDate("");
    setDescription("");
    setSelectedClass("");
    setFile(null);
    setError(null);
  };

  const handleCreateAssignment = async () => {
    if (!title.trim() || !selectedClass || !dueDate) {
      setError("Please fill in all required fields");
      return;
    }

    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDateObj < today) {
      setError("Due date cannot be in the past");
      return;
    }

    if (title.trim().length > 200) {
      setError("Title must be less than 200 characters");
      return;
    }

    if (description.length > 5000) {
      setError("Description must be less than 5000 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedTeacherClass = teacherClasses.find(tc => tc.class_id === selectedClass);
      if (!selectedTeacherClass) {
        setError("Unauthorized: You don't have access to this class");
        setLoading(false);
        return;
      }

      let file_url = null;
      if (file) {
        const allowedTypes = [
          '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', 
          '.zip', '.ppt', '.pptx', '.xlsx', '.csv', '.txt'
        ];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
          setError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
          setLoading(false);
          return;
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
          setError("File size exceeds 10MB limit");
          setLoading(false);
          return;
        }

        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\s+/g, '_');
        
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const filePath = `assignments/${timestamp}_${randomString}_${sanitizedFileName}`;
        
        const { error: storageError } = await supabase.storage
          .from("assignments")
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (storageError) {
          console.error('Storage error:', storageError);
          throw new Error(`File upload failed: ${storageError.message}`);
        }
        
        const { data: urlData } = supabase.storage
          .from("assignments")
          .getPublicUrl(filePath);
        
        file_url = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("assignments").insert([{
        title: title.trim(),
        subject_id: selectedTeacherClass.subject_id,
        class_id: selectedClass,
        due_date: dueDate,
        description: description.trim(),
        created_at: new Date().toISOString(),
        file_url,
      }]);

      if (insertError) {
        console.error("Database insert error:", insertError);
        throw new Error(`Failed to create assignment: ${insertError.message}`);
      }

      resetForm();
      setOpen(false);
      onAssignmentCreated();
    } catch (err: any) {
      console.error("Error creating assignment:", err);
      setError("Failed to create assignment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 px-2 sm:h-9 sm:px-4 text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span>New Assignment</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 sm:space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Create Assignment</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create a new assignment for your class. Maximum file size: 10MB.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Class *</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent className="text-xs sm:text-sm max-h-[200px]">
                {teacherClasses.map(tc => (
                  <SelectItem 
                    value={tc.class_id} 
                    key={tc.class_id}
                    className="text-xs sm:text-sm"
                  >
                    {firstRel(tc.classes)?.name || tc.class_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Assignment title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">
              {title.length}/200 characters
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Description (optional)</label>
            <Textarea
              placeholder="Assignment description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px] text-xs sm:text-sm"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {description.length}/5000 characters
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Due Date *</label>
            <Input
              type="date"
              placeholder="Due date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">
              Attach File (optional)
              <span className="text-xs text-gray-500 ml-1 sm:ml-2">Max 10MB</span>
            </label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.ppt,.pptx,.xlsx,.csv,.txt"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  if (selectedFile.size > 10 * 1024 * 1024) {
                    setError("File size exceeds 10MB limit");
                    e.target.value = '';
                    setFile(null);
                  } else {
                    setError(null);
                    setFile(selectedFile);
                  }
                } else {
                  setFile(null);
                }
              }}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
            {file && (
              <div className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs sm:text-sm text-red-500 bg-red-50 p-2 sm:p-3 rounded border border-red-200">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreateAssignment}
            className="w-full h-9 sm:h-10 text-xs sm:text-sm"
            disabled={loading}
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {loading ? "Creating..." : "Create Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface CreateAnnouncementDialogProps {
  teacherClasses: TeacherClass[];
  onAnnouncementCreated: () => void;
}

const CreateAnnouncementDialog: React.FC<CreateAnnouncementDialogProps> = ({ 
  teacherClasses, 
  onAnnouncementCreated
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const [announcementAttempts, setAnnouncementAttempts] = useState<number[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSelectedClass("");
    setError(null);
  };

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentAttempts = announcementAttempts.filter(time => time > oneMinuteAgo);
    setAnnouncementAttempts(recentAttempts);
    
    if (recentAttempts.length >= 10) {
      setIsRateLimited(true);
      return true;
    }
    
    return false;
  };

  const handleSendAnnouncement = async () => {
    if (checkRateLimit()) {
      setError("Rate limit exceeded. Please wait 1 minute before sending another announcement.");
      return;
    }

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    
    if (title.trim().length > 200) {
      setError("Title must be less than 200 characters");
      return;
    }
    
    if (!content.trim()) {
      setError("Content is required");
      return;
    }
    
    if (content.trim().length > 5000) {
      setError("Content must be less than 5000 characters");
      return;
    }
    
    if (!selectedClass) {
      setError("Class selection is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setAnnouncementAttempts(prev => [...prev, Date.now()]);

      const selectedTeacherClass = teacherClasses.find(tc => tc.class_id === selectedClass);
      if (!selectedTeacherClass) {
        setError("Unauthorized: You don't have access to this class");
        setLoading(false);
        return;
      }

      const sanitizedTitle = title.trim();
      const sanitizedContent = content.trim();

      const { error: insertError } = await supabase.from("announcements").insert([{
        title: sanitizedTitle,
        content: sanitizedContent,
        class_id: selectedClass,
        priority: 'normal',
        created_at: new Date().toISOString(),
        expires_at: null,
        is_for_all_classes: false,
      }]);

      if (insertError) {
        console.error("Database insert error:", insertError);
        
        if (insertError.code === '23502') {
          setError("Required field missing. Please fill in all required fields.");
        } else if (insertError.code === '23503') {
          setError("Invalid class reference. Please select a valid class.");
        } else if (insertError.code === '23514') {
          setError("Invalid data format. Please check your input.");
        } else {
          setError("Failed to send announcement. Please try again.");
        }
        throw insertError;
      }

      resetForm();
      setOpen(false);
      setIsRateLimited(false);
      onAnnouncementCreated();
      
    } catch (err: any) {
      if (!error) {
        setError("Failed to send announcement. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
        setIsRateLimited(false);
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isRateLimited} className="h-8 px-2 sm:h-9 sm:px-4 text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span>New Announcement</span>
          {isRateLimited && <span className="ml-1 sm:ml-2 text-xs">(Rate Limited)</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 sm:space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Create Announcement</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Send an announcement to your selected class.
            {isRateLimited && (
              <div className="text-amber-600 mt-1 text-xs sm:text-sm">
                Rate limited: Please wait before sending another announcement.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Class *</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent className="text-xs sm:text-sm max-h-[200px]">
                {teacherClasses.map(tc => (
                  <SelectItem 
                    value={tc.class_id} 
                    key={tc.class_id}
                    className="text-xs sm:text-sm"
                  >
                    {firstRel(tc.classes)?.name || tc.class_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">
              {title.length}/200 characters
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Content *</label>
            <Textarea
              placeholder="Type your announcement here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] sm:min-h-[100px] text-xs sm:text-sm"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {content.length}/5000 characters
            </div>
          </div>

          {error && (
            <div className="text-xs sm:text-sm text-red-500 bg-red-50 p-2 sm:p-3 rounded border border-red-200">
              {error}
            </div>
          )}

          <Button 
            onClick={handleSendAnnouncement}
            className="w-full h-9 sm:h-10 text-xs sm:text-sm" 
            disabled={loading || isRateLimited}
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {loading ? "Sending..." : "Send Announcement"}
          </Button>
          
          {announcementAttempts.length > 0 && (
            <div className="text-xs text-gray-500 text-center">
              Announcements in last minute: {announcementAttempts.length}/10
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------- StudentPerformanceDetailView Component ----------
const StudentPerformanceDetailView = ({
  performanceDetail
}: {
  performanceDetail: StudentPerformanceDetail;
}) => {
  const {
    student,
    assessments,
    averageScore,
    trend,
    subjectAverages,
    gradeDistribution,
    recentTrend
  } = performanceDetail;

  const studentClass = student.class || 'No Class';

  const performanceOverTime = assessments.map(assessment => ({
    name: assessment.title,
    score: assessment.percentage,
    date: new Date(assessment.assessment_date).toLocaleDateString(),
    subject: assessment.subject
  })).reverse();

  const subjectPerformanceData = subjectAverages.map(subject => ({
    subject: subject.subject,
    average: subject.average,
    fill: KJSEA_LEVELS.find(l => subject.average >= l.min && subject.average <= l.max)?.color || "#6B7280"
  }));

  const getPerformanceInsights = () => {
    const insights = [];
    
    const kjseaLevel = KJSEA_LEVELS.find(level => averageScore >= level.min && averageScore <= level.max);
    
    if (kjseaLevel) {
      insights.push({
        icon: <Target className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5" style={{ color: kjseaLevel.color }} />,
        title: `${kjseaLevel.description} Performance (${kjseaLevel.label})`,
        description: `Student achieves ${kjseaLevel.description} level. ${averageScore >= 58 ? 'Maintain current strategies.' : 'Consider targeted interventions.'}`
      });
    }

    if (trend === 'improving') {
      insights.push({
        icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5" />,
        title: "Positive Momentum",
        description: `Performance is improving by approximately ${Math.abs(recentTrend)} points. Current teaching strategies are effective - maintain this approach.`
      });
    } else if (trend === 'declining') {
      insights.push({
        icon: <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mt-0.5" />,
        title: "Declining Performance",
        description: `Scores have decreased by approximately ${Math.abs(recentTrend)} points. Review recent topics and consider additional support.`
      });
    } else {
      insights.push({
        icon: <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 mt-0.5" />,
        title: "Stable Performance",
        description: "Performance remains consistent. Focus on gradual improvement through targeted practice and feedback."
      });
    }

    if (subjectAverages.length > 0) {
      const strongestSubject = subjectAverages.reduce((prev, current) => 
        prev.average > current.average ? prev : current
      );
      const weakestSubject = subjectAverages.reduce((prev, current) => 
        prev.average < current.average ? prev : current
      );

      if (subjectAverages.length >= 2 && strongestSubject.average - weakestSubject.average > 15) {
        insights.push({
          icon: <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5" />,
          title: "Significant Subject Variation",
          description: `Strong in ${strongestSubject.subject} (${strongestSubject.average}%) but needs support in ${weakestSubject.subject} (${weakestSubject.average}%). Consider cross-subject learning strategies.`
        });
      }
    }

    if (assessments.length < 3) {
      insights.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mt-0.5" />,
        title: "Limited Assessment Data",
        description: "Only a few assessments available. More data needed for accurate trend analysis and performance insights."
      });
    }

    if (insights.length === 0) {
      insights.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />,
        title: "New Student Analysis",
        description: "This student is new to the system. As assessments are completed, more detailed insights will become available."
      });
    }

    return insights;
  };

  const insights = getPerformanceInsights();

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-2xl font-bold truncate">
                  {student.first_name} {student.last_name}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {student.Reg_no} • {studentClass}
                </p>
                {student.profiles?.[0]?.guardian_phone && (
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Guardian: {student.profiles[0].guardian_phone}
                  </p>
                )}
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold text-primary">{averageScore}%</div>
              <div className="flex items-center justify-center sm:justify-end space-x-1 sm:space-x-2 mt-1">
                <div className={trend === 'improving' ? 'text-green-600' : trend === 'declining' ? 'text-red-600' : 'text-yellow-600'}>
                  {trend === 'improving' ? <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" /> : 
                   trend === 'declining' ? <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" /> : 
                   <Minus className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <span className="text-xs sm:text-sm capitalize">{trend}</span>
                {recentTrend !== 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({recentTrend > 0 ? '+' : ''}{recentTrend})
                  </span>
                )}
              </div>
              <Badge 
                className="mt-1 sm:mt-2 text-xs sm:text-sm"
                style={{ 
                  backgroundColor: KJSEA_LEVELS.find(l => averageScore >= l.min && averageScore <= l.max)?.color || "#6B7280",
                  color: "white"
                }}
              >
                {calculateKJSEAGrade(averageScore)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Performance Trend</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Last {assessments.length} assessments over time</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {performanceOverTime.length > 0 ? (
              <div className="w-full h-[220px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tick={{fontSize: 10}}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      fontSize={10}
                      tick={{fontSize: 10}}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Score']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No assessment data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Subject Performance</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Average scores by subject</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {subjectPerformanceData.length > 0 ? (
              <div className="w-full h-[220px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="subject" 
                      stroke="hsl(var(--muted-foreground))"
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      fontSize={10}
                      tick={{fontSize: 10}}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      fontSize={10}
                      tick={{fontSize: 10}}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Average']}
                    />
                    <Bar 
                      dataKey="average" 
                      radius={[4, 4, 0, 0]}
                    >
                      {subjectPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No subject data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Recent Assessments</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Last {assessments.length} exam results</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 pt-0">
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 px-3 sm:py-3 sm:px-4 text-xs">Assessment</TableHead>
                    <TableHead className="py-2 px-3 sm:py-3 sm:px-4 text-xs">Subject</TableHead>
                    <TableHead className="py-2 px-3 sm:py-3 sm:px-4 text-xs">Date</TableHead>
                    <TableHead className="py-2 px-3 sm:py-3 sm:px-4 text-xs">Score</TableHead>
                    <TableHead className="py-2 px-3 sm:py-3 sm:px-4 text-xs">Percentage</TableHead>
                    <TableHead className="py-2 px-3 sm:py-3 sm:px-4 text-xs">KJSEA Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((assessment) => {
                    const grade = calculateKJSEAGrade(assessment.percentage);
                    const level = KJSEA_LEVELS.find(l => l.label === grade);
                    
                    return (
                      <TableRow key={assessment.id}>
                        <TableCell className="py-2 px-3 sm:py-3 sm:px-4 font-medium text-xs sm:text-sm truncate max-w-[100px]">
                          {assessment.title}
                        </TableCell>
                        <TableCell className="py-2 px-3 sm:py-3 sm:px-4">
                          <Badge variant="outline" className="text-xs">{assessment.subject}</Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                          {new Date(assessment.assessment_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm">
                          {assessment.score}/{assessment.max_marks}
                        </TableCell>
                        <TableCell className="py-2 px-3 sm:py-3 sm:px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-12 sm:w-16 bg-secondary rounded-full h-2">
                              <div 
                                className="h-2 rounded-full"
                                style={{ 
                                  width: `${assessment.percentage}%`,
                                  backgroundColor: level?.color || "#6B7280"
                                }}
                              />
                            </div>
                            <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{assessment.percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 sm:py-3 sm:px-4">
                          <Badge 
                            style={{ backgroundColor: level?.color }}
                            className="text-white text-xs"
                          >
                            {grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {assessments.length === 0 && (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
              No assessment records found for this student
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">KJSEA Grade Distribution</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Performance across Kenyan Achievement Levels</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4">
            {KJSEA_LEVELS.map((level, index) => {
              const count = gradeDistribution.find(gd => gd.grade === level.label)?.count || 0;
              return (
                <div key={level.label} className="text-center p-2 sm:p-3 md:p-4 rounded-lg border">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-1 sm:mb-2 text-white font-bold text-xs sm:text-sm"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.label.split(' ')[0]}
                  </div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground truncate">{level.description}</div>
                  <div className="text-xs mt-0.5">Level {level.label.split('(')[1].replace(')', '')}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Performance Insights</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Key observations and recommendations based on KJSEA levels</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base">{insight.title}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ---------- Main Component ----------
interface TeacherDashboardProps {
  handleLogout: () => void;
}

export default function TeacherDashboard({ handleLogout }: TeacherDashboardProps) {
  const { profile, loading: loadingProfile, error: profileError } = useTeacherProfile();
  const { classes: teacherClasses, loading: loadingClasses } = useTeacherClasses(profile?.id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Add state for delete confirmations
  const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classDetails, setClassDetails] = useState<ClassDetail[]>([]);
  const [classPerformanceData, setClassPerformanceData] = useState<ClassPerformanceData[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);

  const { performanceDetail, loading: detailLoading } = useStudentPerformanceDetail(selectedStudentId, teacherClasses);

  const fetchAssignments = useCallback(async () => {
    if (!teacherClasses.length || !profile?.id) {
      setAssignments([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .in("class_id", classIds);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    }
  }, [teacherClasses, profile?.id]);

  const fetchAnnouncements = useCallback(async () => {
    if (!teacherClasses.length || !profile?.id) {
      setAnnouncements([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .in("class_id", classIds);
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setAnnouncements([]);
    }
  }, [teacherClasses, profile?.id]);

  const fetchStudents = useCallback(async () => {
    if (!teacherClasses.length) {
      setStudents([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          class_id,
          classes (
            name,
            grade_level
          )
        `)
        .in("class_id", classIds);

      if (enrollError) throw enrollError;

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = enrollments.map(e => e.student_id);
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          Reg_no,
          first_name,
          last_name,
          created_at,
          auth_id,
          profiles (*)
        `)
        .in("id", studentIds);

      if (studentsError) throw studentsError;

      const studentsWithEnrollments = studentsData?.map(student => {
        const studentEnrollments = enrollments.filter(e => e.student_id === student.id);
        return {
          ...student,
          enrollments: studentEnrollments
        };
      }) || [];

      setStudents(studentsWithEnrollments);
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    }
  }, [teacherClasses]);

  const fetchClassDetails = useCallback(async () => {
    if (!teacherClasses.length) {
      setClassDetails([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("class_id")
        .in("class_id", classIds);

      if (enrollError) throw enrollError;

      const studentCounts = enrollments?.reduce((acc, enrollment) => {
        acc[enrollment.class_id] = (acc[enrollment.class_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const subjectCounts = teacherClasses.reduce((acc, tc) => {
        acc[tc.class_id] = (acc[tc.class_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const classDetailsMap = new Map<string, ClassDetail>();
      
      teacherClasses.forEach(tc => {
        if (!classDetailsMap.has(tc.class_id)) {
          const classObj = firstRel(tc.classes);
          classDetailsMap.set(tc.class_id, {
            id: tc.class_id,
            name: classObj?.name || "Unknown Class",
            grade_level: classObj?.grade_level || "N/A",
            created_at: classObj?.created_at || "",
            student_count: studentCounts[tc.class_id] || 0,
            subject_count: subjectCounts[tc.class_id] || 0,
          });
        }
      });

      setClassDetails(Array.from(classDetailsMap.values()));
    } catch (error) {
      console.error("Error fetching class details:", error);
      setClassDetails([]);
    }
  }, [teacherClasses]);

  const fetchClassPerformance = useCallback(async () => {
    if (!teacherClasses.length) {
      setClassPerformanceData([]);
      return;
    }

    try {
      const results: ClassPerformanceData[] = [];
      const classIds = teacherClasses.map(tc => tc.class_id);

      const ASSESSMENT_PAGE_SIZE = 50;

      const { data: assessments, error: assessError } = await supabase
        .from("assessments")
        .select("*")
        .in("class_id", classIds)
        .order("created_at", { ascending: false })
        .range(0, ASSESSMENT_PAGE_SIZE - 1);

      if (assessError) throw assessError;

      for (const tc of teacherClasses) {
        const classAssessments = (assessments || [])
          .filter(a => a.class_id === tc.class_id)
          .slice(0, 2);

        for (const assessment of classAssessments) {
          const RESULT_PAGE_SIZE = 100;

          const { data: resultsData, error: resultsError } = await supabase
            .from("assessment_results")
            .select("score")
            .eq("assessment_id", assessment.id)
            .eq("subject_id", tc.subject_id)
            .range(0, RESULT_PAGE_SIZE - 1);

          if (resultsError) {
            console.error("Error fetching assessment results:", resultsError);
            continue;
          }

          if (resultsData && resultsData.length > 0) {
            const scores = resultsData
              .map(r => Number(r.score))
              .filter(s => Number.isFinite(s));

            if (!scores.length) continue;

            const mean =
              scores.reduce((sum, s) => sum + s, 0) / scores.length;

            const subj = firstRel(tc.subjects);
            const cls = firstRel(tc.classes);

            results.push({
              assessment: assessment.title,
              subject: subj?.name || "Unknown Subject",
              class: cls?.name || "Unknown Class",
              mean: Number(mean.toFixed(2)),
            });
          }
        }
      }

      setClassPerformanceData(results);
    } catch (error) {
      console.error("Error fetching class performance:", error);
      setClassPerformanceData([]);
    }
  }, [teacherClasses]);

  const fetchGradeDistribution = useCallback(async () => {
    if (!teacherClasses.length) {
      setGradeDistribution([]);
      return;
    }

    try {
      let allScores: number[] = [];
      const classIds = teacherClasses.map(tc => tc.class_id);

      const PAGE_SIZE = 10;
      const page = 0;

      const { data: assessments, error: assessError } = await supabase
        .from("assessments")
        .select("id")
        .in("class_id", classIds)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (assessError) throw assessError;
      if (!assessments) return;

      const subjectIds = teacherClasses.map(tc => tc.subject_id);

      for (const assessment of assessments) {
        const RESULT_PAGE_SIZE = 200;

        const { data: results, error: resultsError } = await supabase
          .from("assessment_results")
          .select("score")
          .eq("assessment_id", assessment.id)
          .in("subject_id", subjectIds)
          .range(0, RESULT_PAGE_SIZE - 1);

        if (!resultsError && results) {
          allScores.push(
            ...results
              .map(r => Number(r.score))
              .filter(s => Number.isFinite(s))
          );
        }
      }

      const dist = KJSEA_LEVELS.map(level => ({
        grade: level.label,
        count: allScores.filter(
          s => s >= level.min && s <= level.max
        ).length,
        color: level.color,
      }));

      setGradeDistribution(dist);
    } catch (error) {
      console.error("Error fetching grade distribution:", error);
      setGradeDistribution([]);
    }
  }, [teacherClasses]);

  const fetchStudentPerformance = useCallback(async () => {
    if (!teacherClasses.length || students.length === 0) {
      setStudentPerformance([]);
      return;
    }

    try {
      const studentIds = students.map(s => s.id);
      const subjectIds = teacherClasses.map(tc => tc.subject_id);

      const RESULT_PAGE_SIZE = 1000;

      const { data: results, error } = await supabase
        .from("assessment_results")
        .select(`
          student_id,
          subject_id,
          score,
          assessment_date
        `)
        .in("student_id", studentIds)
        .in("subject_id", subjectIds)
        .order("assessment_date", { ascending: true })
        .range(0, RESULT_PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching student performance:", error);
        setStudentPerformance([]);
        return;
      }

      if (!results || results.length === 0) {
        setStudentPerformance([]);
        return;
      }

      const grouped = new Map<string, number[]>();

      for (const r of results) {
        const score = Number(r.score);
        if (!Number.isFinite(score)) continue;

        const key = `${r.student_id}-${r.subject_id}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(score);
      }

      const performanceData: StudentPerformance[] = [];

      for (const student of students) {
        for (const tc of teacherClasses) {
          const key = `${student.id}-${tc.subject_id}`;
          const scores = grouped.get(key);

          if (!scores || scores.length === 0) continue;

          const average =
            scores.reduce((sum, s) => sum + s, 0) / scores.length;

          let trend: "improving" | "declining" | "stable" = "stable";

          if (scores.length >= 4) {
            const mid = Math.floor(scores.length / 2);
            const firstAvg =
              scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
            const secondAvg =
              scores.slice(-mid).reduce((a, b) => a + b, 0) / mid;

            const diff = secondAvg - firstAvg;
            if (diff > 3) trend = "improving";
            else if (diff < -3) trend = "declining";
          }

          performanceData.push({
            student_name: `${student.first_name} ${student.last_name}`,
            subject: firstRel(tc.subjects)?.name || "Unknown",
            average_score: Number(average.toFixed(1)),
            trend,
          });
        }
      }

      setStudentPerformance(performanceData);
    } catch (err) {
      console.error("Error fetching student performance:", err);
      setStudentPerformance([]);
    }
  }, [teacherClasses, students]);

  useEffect(() => {
    if (!teacherClasses.length) return;

    Promise.all([
      fetchAssignments(),
      fetchAnnouncements(),
      fetchStudents(),
      fetchClassDetails(),
      fetchClassPerformance(),
      fetchGradeDistribution(),
    ]);
  }, [
    teacherClasses,
    fetchAssignments,
    fetchAnnouncements,
    fetchStudents,
    fetchClassDetails,
    fetchClassPerformance,
    fetchGradeDistribution,
  ]);

  useEffect(() => {
    if (students.length > 0) {
      fetchStudentPerformance();
    }
  }, [students, fetchStudentPerformance]);

  // Fixed delete functions with confirmation
  const handleDeleteAssignment = async (id: string) => {
    if (!profile?.id) return;
    
    try {
      const assignment = assignments.find(a => a.id === id);
      if (!assignment) {
        setError("Assignment not found");
        setAssignmentToDelete(null);
        return;
      }

      const teacherClassIds = teacherClasses.map(tc => tc.class_id);
      if (!teacherClassIds.includes(assignment.class_id)) {
        setError("Unauthorized: You don't have access to delete this assignment");
        setAssignmentToDelete(null);
        return;
      }

      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
      
      setAssignmentToDelete(null);
      await fetchAssignments();
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!profile?.id) return;
    
    try {
      const announcement = announcements.find(a => a.id === id);
      if (!announcement) {
        setError("Announcement not found");
        setAnnouncementToDelete(null);
        return;
      }

      const teacherClassIds = teacherClasses.map(tc => tc.class_id);
      if (!teacherClassIds.includes(announcement.class_id)) {
        setError("Unauthorized: You don't have access to delete this announcement");
        setAnnouncementToDelete(null);
        return;
      }

      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      
      setAnnouncementToDelete(null);
      await fetchAnnouncements();
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete announcement");
    }
  };

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
      setActiveTab("overview");
    }
  };

  const returnToOverview = () => {
    setExpandedSection(null);
  };

  const refreshProfile = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', profile.id)
        .single();

      if (teacherError) throw teacherError;
      
      window.location.reload();
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 sm:h-32 sm:w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile || profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 text-sm sm:text-base px-4">
        {profileError || "Teacher profile not found"}
      </div>
    );
  }

  const averagePerformance = classPerformanceData.length
    ? (classPerformanceData.reduce((sum, d) => sum + d.mean, 0) / classPerformanceData.length).toFixed(1)
    : null;

  const totalStudents = students.length;

  const classMap = classDetails.reduce((acc, classItem) => {
    acc[classItem.id] = classItem.name;
    return acc;
  }, {} as Record<string, string>);

  const OverviewTab = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <Card 
          className={`bg-gradient-to-br from-card to-accent/5 transition-all duration-200 ${
            expandedSection ? 'cursor-pointer hover:shadow-lg ring-2 ring-primary/20' : ''
          }`}
          onClick={expandedSection ? returnToOverview : undefined}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 sm:pb-3 p-4 sm:p-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center mr-2 sm:mr-3 md:mr-4 flex-shrink-0">
              <User className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm sm:text-base md:text-lg truncate">
                {profile.first_name} {profile.last_name}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm truncate">{profile.email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-muted-foreground">Teacher ID:</span>
                <span className="text-xs sm:text-sm font-medium truncate ml-2">{profile.teacher_code}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-muted-foreground">Phone:</span>
                <span className="text-xs sm:text-sm font-medium truncate ml-2">{profile.phone || "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-200 touch-manipulation ${
            expandedSection === 'students' ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
          }`}
          onClick={() => toggleSection('students')}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 sm:pb-3 p-4 sm:p-6">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary mr-2" />
            <CardTitle className="text-sm sm:text-base md:text-lg">Students</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {loadingClasses ? "Loading..." : totalStudents}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-200 touch-manipulation ${
            expandedSection === 'classes' ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
          }`}
          onClick={() => toggleSection('classes')}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 sm:pb-3 p-4 sm:p-6">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary mr-2" />
            <CardTitle className="text-sm sm:text-base md:text-lg">Classes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {loadingClasses ? "Loading..." : teacherClasses.length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Teaching</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 sm:pb-3 p-4 sm:p-6">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary mr-2" />
            <CardTitle className="text-sm sm:text-base md:text-lg">Avg. Performance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {averagePerformance ? `${averagePerformance}%` : "N/A"}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Latest assessments</p>
          </CardContent>
        </Card>
      </div>

      {expandedSection === "classes" && (
        <div className="mt-4 sm:mt-6 animate-in fade-in duration-300">
          <ClassesSection />
        </div>
      )}

      {expandedSection === "students" && (
        <div className="mt-4 sm:mt-6 animate-in fade-in duration-300">
          <StudentsSection />
        </div>
      )}

      {!expandedSection && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Class Performance Overview
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Mean grade by assessment</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {classPerformanceData.length > 0 ? (
                <div className="w-full h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="assessment" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: '12px'
                        }} 
                      />
                      <Bar dataKey="mean" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No performance data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">KJSEA Grade Distribution</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Kenyan Achievement Levels across all assessments</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {gradeDistribution.some(g => g.count > 0) ? (
                <>
                  <div className="w-full h-[250px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gradeDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="count"
                        >
                          {gradeDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center mt-3 sm:mt-4 gap-2 sm:gap-4">
                    {gradeDistribution.map((entry, index) => (
                      <div key={index} className="flex items-center">
                        <div 
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full mr-1 sm:mr-2" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs sm:text-sm">{entry.grade}: {entry.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No grade data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!expandedSection && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation" 
            onClick={() => setActiveTab("assignments")}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base truncate">Create Assignment</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Post new assignment for your class</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation" 
            onClick={() => setActiveTab("announcements")}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base truncate">Send Announcement</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Notify your students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation" 
            onClick={() => toggleSection("students")}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base truncate">View Students</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Check student progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );

  const ClassesSection = () => {
    if (loadingClasses) {
      return <div className="text-center py-6 sm:py-8 text-sm">Loading classes...</div>;
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-bold">My Classes</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <Badge variant="secondary" className="text-xs sm:text-sm">{classDetails.length} Classes</Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpandedSection(null)}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {classDetails.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center justify-between text-sm sm:text-base">
                  <span className="truncate">{classItem.name}</span>
                  <Badge variant="outline" className="text-xs">Grade {classItem.grade_level}</Badge>
                </CardTitle>
                <CardDescription className="text-xs truncate">Class ID: {classItem.id.slice(0, 8)}...</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Students:</span>
                    <span className="font-medium text-xs sm:text-sm">{classItem.student_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Subjects:</span>
                    <span className="font-medium text-xs sm:text-sm">{classItem.subject_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-muted-foreground">Created:</span>
                    <span className="font-medium text-xs">
                      {new Date(classItem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {classDetails.length === 0 && (
          <Card>
            <CardContent className="text-center py-6 sm:py-8">
              <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No Classes Assigned</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">You haven't been assigned to any classes yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const StudentsSection = () => {
    if (loadingClasses) {
      return <div className="text-center py-6 sm:py-8 text-sm">Loading students...</div>;
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-base sm:text-xl">Student Performance Analysis</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {detailLoading 
                  ? "Loading student performance data..." 
                  : performanceDetail 
                    ? `Analysis for ${performanceDetail.student.first_name} ${performanceDetail.student.last_name}`
                    : "No performance data available"
                }
              </DialogDescription>
            </DialogHeader>
            
            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
              </div>
            ) : performanceDetail ? (
              <StudentPerformanceDetailView performanceDetail={performanceDetail} />
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No performance data available for this student
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-bold">Students</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <Badge variant="secondary" className="text-xs sm:text-sm">{students.length} Students</Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpandedSection(null)}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Student Directory</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Tap on a student to view detailed performance analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 pt-0">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <div className="min-w-[600px] px-3 sm:min-w-0 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Student</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Reg No</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden sm:table-cell">Class</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden xs:table-cell">Guardian</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id} className="hover:bg-muted/50">
                        <TableCell 
                          className="py-2 px-2 sm:py-3 sm:px-4 cursor-pointer"
                          onClick={() => setSelectedStudentId(student.id)}
                        >
                          <div className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">
                            {student.first_name} {student.last_name}
                          </div>
                        </TableCell>
                        <TableCell 
                          className="py-2 px-2 sm:py-3 sm:px-4 cursor-pointer"
                          onClick={() => setSelectedStudentId(student.id)}
                        >
                          <code className="text-xs bg-muted px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-nowrap">
                            {student.Reg_no}
                          </code>
                        </TableCell>
                        <TableCell 
                          className="py-2 px-2 sm:py-3 sm:px-4 cursor-pointer hidden sm:table-cell"
                          onClick={() => setSelectedStudentId(student.id)}
                        >
                          {student.enrollments && student.enrollments[0] ? (
                            classMap[student.enrollments[0].class_id] || 'N/A'
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell 
                          className="py-2 px-2 sm:py-3 sm:px-4 cursor-pointer hidden xs:table-cell"
                          onClick={() => setSelectedStudentId(student.id)}
                        >
                          <div className="flex items-center space-x-1 text-xs sm:text-sm">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate max-w-[80px] sm:max-w-[120px]">
                              {student.profiles?.[0]?.guardian_phone ?? 'No contact'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedStudentId(student.id)}
                            className="h-7 text-xs px-2 sm:h-8 sm:px-3 sm:text-sm"
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {students.length === 0 && (
              <div className="text-center py-6 sm:py-8 px-4">
                <Users className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No Students Found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">There are no students enrolled in your classes yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const AnnouncementsSection = () => (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <div className="flex items-center">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <CardTitle className="text-base sm:text-lg">Announcements</CardTitle>
          </div>
          
          <CreateAnnouncementDialog 
            teacherClasses={teacherClasses}
            onAnnouncementCreated={fetchAnnouncements}
          />
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {announcements.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No announcements yet. Create your first announcement!
              </div>
            )}
            {announcements.map((announcement) => (
              <div key={announcement.id} className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 flex-wrap">
                    <h4 className="font-semibold text-sm truncate">{announcement.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {firstRel(teacherClasses.find(tc => tc.class_id === announcement.class_id)?.classes)?.name || "Class"}
                    </Badge>
                    {announcement.priority !== 'normal' && (
                      <Badge variant={announcement.priority === 'high' ? 'destructive' : 'default'} className="text-xs">
                        {announcement.priority}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-foreground mb-1 sm:mb-2 line-clamp-2">{announcement.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(announcement.created_at).toLocaleString()}
                    {announcement.expires_at && ` • Expires: ${new Date(announcement.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAnnouncementToDelete(announcement.id)}
                  title="Delete announcement"
                  className="h-7 w-7 sm:h-8 sm:w-8 ml-1 sm:ml-2 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const AssignmentsSection = () => (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <div className="flex items-center">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <CardTitle className="text-base sm:text-lg">Assignment Management</CardTitle>
          </div>

          <CreateAssignmentDialog 
            teacherClasses={teacherClasses}
            onAssignmentCreated={fetchAssignments}
          />
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {assignments.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No assignments yet. Create your first assignment!
              </div>
            )}

            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1 truncate">{assignment.title}</h4>

                  {assignment.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2 line-clamp-2">
                      {assignment.description}
                    </p>
                  )}

                  <div className="flex items-center flex-wrap gap-x-2 sm:gap-x-4 gap-y-1 text-xs text-muted-foreground mb-1 sm:mb-2">
                    <span className="whitespace-nowrap">
                      Due: {assignment.due_date
                        ? new Date(assignment.due_date).toLocaleDateString()
                        : "N/A"}
                    </span>

                    <span className="whitespace-nowrap">
                      Created: {new Date(assignment.created_at).toLocaleDateString()}
                    </span>

                    {assignment.total_marks && (
                      <span className="whitespace-nowrap">Total Marks: {assignment.total_marks}</span>
                    )}
                  </div>

                  {assignment.file_url && (
                    <a
                      href={assignment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center truncate"
                    >
                      <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">Download Attached File</span>
                    </a>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAssignmentToDelete(assignment.id)}
                  title="Delete assignment"
                  className="h-7 w-7 sm:h-8 sm:w-8 ml-1 sm:ml-2 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background touch-manipulation">
      <Navbar showLogout={true} handleLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 space-y-4 sm:space-y-6 py-4 sm:py-6">
        {/* Confirmation Dialog for Assignment Deletion */}
        <Dialog open={!!assignmentToDelete} onOpenChange={(open) => !open && setAssignmentToDelete(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete this assignment? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-3 sm:mt-4">
              <Button 
                variant="outline" 
                onClick={() => setAssignmentToDelete(null)}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => assignmentToDelete && handleDeleteAssignment(assignmentToDelete)}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              >
                Delete Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for Announcement Deletion */}
        <Dialog open={!!announcementToDelete} onOpenChange={(open) => !open && setAnnouncementToDelete(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete this announcement? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-3 sm:mt-4">
              <Button 
                variant="outline" 
                onClick={() => setAnnouncementToDelete(null)}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => announcementToDelete && handleDeleteAnnouncement(announcementToDelete)}
                className="h-9 sm:h-10 text-xs sm:text-sm"
              >
                Delete Announcement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {error && (
          <div className="bg-destructive/15 text-destructive p-3 sm:p-4 rounded-lg flex justify-between items-center text-xs sm:text-sm">
            <span className="flex-1 mr-2">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 sm:h-8 sm:w-8 p-0">
              ×
            </Button>
          </div>
        )}
    
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 sm:p-6 relative">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">
                Welcome, {profile.first_name} {profile.last_name}!
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Teacher Code: {profile.teacher_code}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm w-full sm:w-auto justify-center sm:justify-start"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Settings</span>
            </Button>
          </div>
        </div>

        <SettingsModal
          profile={profile}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onProfileUpdate={refreshProfile}
        />

        <div className="border-b overflow-x-auto">
          <nav className="flex space-x-2 sm:space-x-4 md:space-x-8 min-w-max sm:min-w-0">
            {["overview", "assignments", "announcements"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setExpandedSection(null);
                }}
                className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm capitalize whitespace-nowrap touch-manipulation ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                {tab === "overview" && <span>Overview</span>}
                {tab === "assignments" && <span>Assignments</span>}
                {tab === "announcements" && <span>Announcements</span>}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "assignments" && <AssignmentsSection />}
        {activeTab === "announcements" && <AnnouncementsSection />}
      </div>
    </div>
  );
}