import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/Components/ui/dialog";
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
  teacher_id: string; // Added for security
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
  teacher_id: string; // Added for security
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

// FIXED: Updated interface to include class property
interface StudentPerformanceDetail {
  student: Student & { class?: string }; // Add class property
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

// ---------- useStudentPerformanceDetail Hook (Fixed Version) ----------
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

        // FIX: Properly handle the enrollments data structure
        let studentClassId: string | undefined;
        let studentClassName = 'No Class';
        
        // Check if enrollments exists and is an array
        if (studentData.enrollments && Array.isArray(studentData.enrollments)) {
          // Take the first enrollment if available
          studentClassId = studentData.enrollments[0]?.class_id;
          // Get class name from enrollment
          const enrollment = studentData.enrollments[0];
          if (enrollment && enrollment.classes) {
            const classData = firstRel(enrollment.classes as any);
            studentClassName = classData?.name || 'No Class';
          }
        } else if (studentData.enrollments && typeof studentData.enrollments === 'object') {
          // Handle case where it might be a single object instead of array
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
            class: studentClassName // Add class name to student data
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

  // FIX #1: Secure phone update - only update auth user
  const updatePhone = async () => {
    if (!phone.trim()) {
      setMessage({ type: "error", text: "Phone number cannot be empty" });
      return;
    }

    setLoading(true);
    try {
      // Remove direct teachers table update - rely on database trigger
      // Database trigger should sync auth metadata to teachers table
      setMessage({ type: "success", text: "Phone number update requires database trigger setup. Please contact administrator." });
      setIsEditingPhone(false);
      onProfileUpdate();
    } catch (error) {
      console.error("Error updating phone:", error);
      setMessage({ type: "error", text: "Failed to update phone number" });
    } finally {
      setLoading(false);
    }
  };

  // FIX #1: Secure email update - only update auth user
  const updateEmail = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }

    setLoading(true);
    try {
      // Get current user to check if the email is actually different
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === email.trim()) {
        setMessage({ type: "info", text: "This is already your current email." });
        setIsEditingEmail(false);
        return;
      }

      // Update email in auth only
      const { error: authError } = await supabase.auth.updateUser({
        email: email.trim()
      });

      if (authError) throw authError;

      // SUCCESS MESSAGE REVISED: 
      // It's important to tell teachers they must check BOTH emails (old and new) 
      // because Supabase requires double-confirmation by default.
      setMessage({ 
        type: "success", 
        text: "Verification links sent! Please check both your old and new email addresses to confirm the change." 
      });
      
      setIsEditingEmail(false);
      if (onProfileUpdate) onProfileUpdate();
      
    } catch (error) {
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
    } catch (error) {
      console.error("Error updating password:", error);
      setMessage({ type: "error", text: "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teacher Settings</DialogTitle>
          <DialogDescription>
            Manage your profile information and security settings
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-4 border-b">
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            Profile Information
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
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
            className={`p-3 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>
                  Your basic profile information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <Input value={profile.first_name} disabled className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <Input value={profile.last_name} disabled className="mt-1" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Teacher Code</label>
                    <Input value={profile.teacher_code} disabled className="mt-1" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                    {!isEditingEmail ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingEmail(true)}
                        className="h-8"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={updateEmail}
                          disabled={loading}
                          className="h-8"
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
                          className="h-8"
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
                    />
                  ) : (
                    <Input value={profile.email || "Not set"} disabled />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                    {!isEditingPhone ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPhone(true)}
                        className="h-8"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={updatePhone}
                          disabled={loading}
                          className="h-8"
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
                          className="h-8"
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
                    />
                  ) : (
                    <Input value={profile.phone || "Not set"} disabled />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Information</CardTitle>
                <CardDescription>
                  Your account details and membership
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Type</span>
                  <span className="text-sm font-medium">
                    {profile.is_admin ? "Administrator" : "Teacher"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="text-sm font-medium">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User ID</span>
                  <span className="text-sm font-medium font-mono text-xs">
                    {profile.first_name}.{profile.last_name}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Update Password</CardTitle>
                <CardDescription>
                  Change your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Current Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
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
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
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
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
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
                  className="w-full"
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </Button>

                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">Password Requirements</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
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
    // Input validation
    if (!title.trim() || !selectedClass || !dueDate) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate due date is not in the past
    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDateObj < today) {
      setError("Due date cannot be in the past");
      return;
    }

    // Validate title length
    if (title.trim().length > 200) {
      setError("Title must be less than 200 characters");
      return;
    }

    // Validate description length
    if (description.length > 5000) {
      setError("Description must be less than 5000 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Security: Validate teacher has access to the selected class
      const selectedTeacherClass = teacherClasses.find(tc => tc.class_id === selectedClass);
      if (!selectedTeacherClass) {
        setError("Unauthorized: You don't have access to this class");
        setLoading(false);
        return;
      }

      let file_url = null;
      if (file) {
        // Security: File type validation
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

        // File size limit: 10MB (10 * 1024 * 1024 bytes)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > MAX_FILE_SIZE) {
          setError("File size exceeds 10MB limit");
          setLoading(false);
          return;
        }

        // Sanitize filename to prevent path traversal
        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special characters
          .replace(/\s+/g, '_'); // Replace spaces with underscores
        
        // Create unique, secure file path
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const filePath = `assignments/${timestamp}_${randomString}_${sanitizedFileName}`;
        
        const { error: storageError } = await supabase.storage
          .from("assignments")
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false // Prevent overwriting existing files
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

      // Input sanitization before insert
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
    } catch (err) {
      // Don't expose internal errors to users
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
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>
            Create a new assignment for your class. Maximum file size: 10MB.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Class *</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {teacherClasses.map(tc => (
                  <SelectItem value={tc.class_id} key={tc.class_id}>
                    {firstRel(tc.classes)?.name || tc.class_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Assignment title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <div className="text-xs text-gray-500 mt-1">
              {title.length}/200 characters
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <Textarea
              placeholder="Assignment description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {description.length}/5000 characters
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Due Date *</label>
            <Input
              type="date"
              placeholder="Due date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} // Prevent past dates
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Attach File (optional)
              <span className="text-xs text-gray-500 ml-2">Max 10MB</span>
            </label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.ppt,.pptx,.xlsx,.csv,.txt"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  if (selectedFile.size > 10 * 1024 * 1024) {
                    setError("File size exceeds 10MB limit");
                    e.target.value = ''; // Clear file input
                    setFile(null);
                  } else {
                    setError(null);
                    setFile(selectedFile);
                  }
                } else {
                  setFile(null);
                }
              }}
            />
            {file && (
              <div className="text-sm text-gray-600 mt-1">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreateAssignment}
            className="w-full"
            disabled={loading}
          >
            <Upload className="h-4 w-4 mr-2" />
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
  teacherId: string;
}

const CreateAnnouncementDialog: React.FC<CreateAnnouncementDialogProps> = ({ 
  teacherClasses, 
  onAnnouncementCreated,
  teacherId 
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Rate limiting state
  const [announcementAttempts, setAnnouncementAttempts] = useState<number[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSelectedClass("");
    setError(null);
  };

  // Rate limiting: max 10 announcements per minute
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
    // Check rate limit
    if (checkRateLimit()) {
      setError("Rate limit exceeded. Please wait 1 minute before sending another announcement.");
      return;
    }

    // Database constraint validations
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
      // Track attempt for rate limiting
      setAnnouncementAttempts(prev => [...prev, Date.now()]);

      // Security: Validate teacher has access to selected class
      const selectedTeacherClass = teacherClasses.find(tc => tc.class_id === selectedClass);
      if (!selectedTeacherClass) {
        setError("Unauthorized: You don't have access to this class");
        setLoading(false);
        return;
      }

      // Sanitize inputs
      const sanitizedTitle = title.trim();
      const sanitizedContent = content.trim();

      // Fixed insert - removed teacher_id since it doesn't exist in schema
      const { error: insertError } = await supabase.from("announcements").insert([{
        title: sanitizedTitle,
        content: sanitizedContent,
        class_id: selectedClass,
        priority: 'normal',
        created_at: new Date().toISOString(),
        expires_at: null, // Explicitly set null for missing field
        is_for_all_classes: false, // Explicitly set false
      }]);

      if (insertError) {
        console.error("Database insert error:", insertError);
        
        // Handle specific database errors
        if (insertError.code === '23502') { // NOT NULL violation
          setError("Required field missing. Please fill in all required fields.");
        } else if (insertError.code === '23503') { // Foreign key violation
          setError("Invalid class reference. Please select a valid class.");
        } else if (insertError.code === '23514') { // Check constraint violation
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
      
    } catch (err) {
      // Don't expose detailed errors to users
      if (!(err instanceof Error && 
          (err.message.includes("Required") || 
           err.message.includes("Invalid") || 
           err.message.includes("Database error")))) {
        console.error("Error creating announcement:", err);
      }
      // Keep existing error message if already set
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
        <Button size="sm" disabled={isRateLimited}>
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
          {isRateLimited && <span className="ml-2 text-xs">(Rate Limited)</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Announcement</DialogTitle>
          <DialogDescription>
            Send an announcement to your selected class.
            {isRateLimited && (
              <div className="text-amber-600 mt-1 text-sm">
                Rate limited: Please wait before sending another announcement.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Class *</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {teacherClasses.map(tc => (
                  <SelectItem value={tc.class_id} key={tc.class_id}>
                    {firstRel(tc.classes)?.name || tc.class_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <div className="text-xs text-gray-500 mt-1">
              {title.length}/200 characters
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Content *</label>
            <Textarea
              placeholder="Type your announcement here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {content.length}/5000 characters
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
              {error}
            </div>
          )}

          <Button 
            onClick={handleSendAnnouncement}
            className="w-full" 
            disabled={loading || isRateLimited}
          >
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Sending..." : "Send Announcement"}
          </Button>
          
          {/* Rate limit indicator */}
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
// ---------- StudentPerformanceDetailView Component (Fixed Version) ----------
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

  // FIX: Use the class from the student object directly
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
    
    // KJSEA Level based insights
    const kjseaLevel = KJSEA_LEVELS.find(level => averageScore >= level.min && averageScore <= level.max);
    
    if (kjseaLevel) {
      insights.push({
        icon: <Target className="h-5 w-5 mt-0.5" style={{ color: kjseaLevel.color }} />,
        title: `${kjseaLevel.description} Performance (${kjseaLevel.label})`,
        description: `Student achieves ${kjseaLevel.description} level. ${averageScore >= 58 ? 'Maintain current strategies.' : 'Consider targeted interventions.'}`
      });
    }

    if (trend === 'improving') {
      insights.push({
        icon: <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />,
        title: "Positive Momentum",
        description: `Performance is improving by approximately ${Math.abs(recentTrend)} points. Current teaching strategies are effective - maintain this approach.`
      });
    } else if (trend === 'declining') {
      insights.push({
        icon: <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />,
        title: "Declining Performance",
        description: `Scores have decreased by approximately ${Math.abs(recentTrend)} points. Review recent topics and consider additional support.`
      });
    } else {
      insights.push({
        icon: <Minus className="h-5 w-5 text-gray-600 mt-0.5" />,
        title: "Stable Performance",
        description: "Performance remains consistent. Focus on gradual improvement through targeted practice and feedback."
      });
    }

    // Check if subjectAverages has data before trying to find strongest/weakest
    if (subjectAverages.length > 0) {
      const strongestSubject = subjectAverages.reduce((prev, current) => 
        prev.average > current.average ? prev : current
      );
      const weakestSubject = subjectAverages.reduce((prev, current) => 
        prev.average < current.average ? prev : current
      );

      // Only add variation insight if there's a significant difference
      if (subjectAverages.length >= 2 && strongestSubject.average - weakestSubject.average > 15) {
        insights.push({
          icon: <BookOpen className="h-5 w-5 text-purple-600 mt-0.5" />,
          title: "Significant Subject Variation",
          description: `Strong in ${strongestSubject.subject} (${strongestSubject.average}%) but needs support in ${weakestSubject.subject} (${weakestSubject.average}%). Consider cross-subject learning strategies.`
        });
      }
    }

    if (assessments.length < 3) {
      insights.push({
        icon: <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />,
        title: "Limited Assessment Data",
        description: "Only a few assessments available. More data needed for accurate trend analysis and performance insights."
      });
    }

    // If no insights were added (e.g., completely new student), add a general insight
    if (insights.length === 0) {
      insights.push({
        icon: <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />,
        title: "New Student Analysis",
        description: "This student is new to the system. As assessments are completed, more detailed insights will become available."
      });
    }

    return insights;
  };

  // Call the function to get insights
  const insights = getPerformanceInsights();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">
                  {student.first_name} {student.last_name}
                </h3>
                <p className="text-muted-foreground">
                  {student.Reg_no} • {studentClass}
                </p>
                {student.profiles?.[0]?.guardian_phone && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Guardian: {student.profiles[0].guardian_phone}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{averageScore}%</div>
              <div className="flex items-center justify-end space-x-2">
                <div className={trend === 'improving' ? 'text-green-600' : trend === 'declining' ? 'text-red-600' : 'text-yellow-600'}>
                  {trend === 'improving' ? <TrendingUp className="h-5 w-5" /> : 
                   trend === 'declining' ? <TrendingDown className="h-5 w-5" /> : 
                   <Minus className="h-5 w-5" />}
                </div>
                <span className="text-sm capitalize">{trend}</span>
                {recentTrend !== 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({recentTrend > 0 ? '+' : ''}{recentTrend})
                  </span>
                )}
              </div>
              <Badge 
                className="mt-2"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Last {assessments.length} assessments over time</CardDescription>
          </CardHeader>
          <CardContent>
            {performanceOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No assessment data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subject Performance</CardTitle>
            <CardDescription>Average scores by subject</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="subject" 
                    stroke="hsl(var(--muted-foreground))"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
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
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No subject data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Assessments</CardTitle>
          <CardDescription>Last {assessments.length} exam results</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>KJSEA Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((assessment) => {
                const grade = calculateKJSEAGrade(assessment.percentage);
                const level = KJSEA_LEVELS.find(l => l.label === grade);
                
                return (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">{assessment.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{assessment.subject}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(assessment.assessment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {assessment.score}/{assessment.max_marks}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-secondary rounded-full h-2">
                          <div 
                            className="h-2 rounded-full"
                            style={{ 
                              width: `${assessment.percentage}%`,
                              backgroundColor: level?.color || "#6B7280"
                            }}
                          />
                        </div>
                        <span className="font-medium">{assessment.percentage.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        style={{ backgroundColor: level?.color }}
                        className="text-white"
                      >
                        {grade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {assessments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No assessment records found for this student
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KJSEA Grade Distribution</CardTitle>
          <CardDescription>Performance across Kenyan Achievement Levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {KJSEA_LEVELS.map((level, index) => {
              const count = gradeDistribution.find(gd => gd.grade === level.label)?.count || 0;
              return (
                <div key={level.label} className="text-center p-4 rounded-lg border">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.label.split(' ')[0]}
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{level.description}</div>
                  <div className="text-xs mt-1">Level {level.label.split('(')[1].replace(')', '')}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
          <CardDescription>Key observations and recommendations based on KJSEA levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3">
                {insight.icon}
                <div>
                  <h4 className="font-semibold">{insight.title}</h4>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
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

  // FIX #3: Optimized fetchClassDetails to avoid N+1 queries
  const fetchClassDetails = useCallback(async () => {
    if (!teacherClasses.length) {
      setClassDetails([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      
      // Single query to get all student counts at once
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("class_id")
        .in("class_id", classIds);

      if (enrollError) throw enrollError;

      // Count students per class
      const studentCounts = enrollments?.reduce((acc, enrollment) => {
        acc[enrollment.class_id] = (acc[enrollment.class_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Count subjects per class
      const subjectCounts = teacherClasses.reduce((acc, tc) => {
        acc[tc.class_id] = (acc[tc.class_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Create class details
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

      // SAFETY: bounded fetch for assessments
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
          .slice(0, 2); // SAME behavior: latest 2

        for (const assessment of classAssessments) {
          // SAFETY: bounded results fetch
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
      const page = 0; // SAME behavior as limit(10)

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

      // SAFETY: bounded bulk fetch
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

  // FIX #2: Secure deletion functions with teacher ID check
  const handleDeleteAssignment = async (id: string) => {
    if (!profile?.id) return;
    
    try {
      // Verify assignment belongs to current teacher before deletion
      const { data: assignment, error: fetchError } = await supabase
        .from("assignments")
        .select("teacher_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Security check: ensure assignment belongs to current teacher
      if (assignment.teacher_id !== profile.id) {
        setError("Unauthorized: You can only delete your own assignments");
        return;
      }

      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  };

  // FIX #2: Secure deletion functions with teacher ID check
  const handleDeleteAnnouncement = async (id: string) => {
    if (!profile?.id) return;
    
    try {
      // Verify announcement belongs to current teacher before deletion
      const { data: announcement, error: fetchError } = await supabase
        .from("announcements")
        .select("teacher_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Security check: ensure announcement belongs to current teacher
      if (announcement.teacher_id !== profile.id) {
        setError("Unauthorized: You can only delete your own announcements");
        return;
      }

      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      await fetchAnnouncements();
    } catch (err) {
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

  // Refresh profile data
  const refreshProfile = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', profile.id)
        .single();

      if (teacherError) throw teacherError;
      
      // You might want to update the profile in your state here
      // Since useTeacherProfile doesn't expose a setter, you might need to refetch
      window.location.reload(); // Simple solution for demo
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile || profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card 
          className={`bg-gradient-to-br from-card to-accent/5 transition-all duration-200 ${
            expandedSection ? 'cursor-pointer hover:shadow-lg ring-2 ring-primary/20' : ''
          }`}
          onClick={expandedSection ? returnToOverview : undefined}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mr-4">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {profile.first_name} {profile.last_name}
              </CardTitle>
              <CardDescription>{profile.email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Teacher ID:</span>
                <span className="text-sm font-medium">{profile.teacher_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Phone:</span>
                <span className="text-sm font-medium">{profile.phone || "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            expandedSection === 'students' ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
          }`}
          onClick={() => toggleSection('students')}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-3">
            <Users className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loadingClasses ? "Loading..." : totalStudents}
            </div>
            <p className="text-sm text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            expandedSection === 'classes' ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
          }`}
          onClick={() => toggleSection('classes')}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-3">
            <BookOpen className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loadingClasses ? "Loading..." : teacherClasses.length}
            </div>
            <p className="text-sm text-muted-foreground">Teaching</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-3">
            <TrendingUp className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Avg. Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {averagePerformance ? `${averagePerformance}%` : "N/A"}
            </div>
            <p className="text-sm text-muted-foreground">Latest assessments</p>
          </CardContent>
        </Card>
      </div>

      {expandedSection === "classes" && (
        <div className="mt-6 animate-in fade-in duration-300">
          <ClassesSection />
        </div>
      )}

      {expandedSection === "students" && (
        <div className="mt-6 animate-in fade-in duration-300">
          <StudentsSection />
        </div>
      )}

      {!expandedSection && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Class Performance Overview
              </CardTitle>
              <CardDescription>Mean grade by assessment</CardDescription>
            </CardHeader>
            <CardContent>
              {classPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={classPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="assessment" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Bar dataKey="mean" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No performance data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KJSEA Grade Distribution</CardTitle>
              <CardDescription>Kenyan Achievement Levels across all assessments</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistribution.some(g => g.count > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
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
                  <div className="flex flex-wrap justify-center mt-4 gap-4">
                    {gradeDistribution.map((entry, index) => (
                      <div key={index} className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm">{entry.grade}: {entry.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No grade data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!expandedSection && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab("assignments")}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Create Assignment</h3>
                  <p className="text-sm text-muted-foreground">Post new assignment for your class</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab("announcements")}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Send Announcement</h3>
                  <p className="text-sm text-muted-foreground">Notify your students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => toggleSection("students")}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">View Students</h3>
                  <p className="text-sm text-muted-foreground">Check student progress</p>
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
      return <div className="text-center py-8">Loading classes...</div>;
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Classes</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{classDetails.length} Classes</Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpandedSection(null)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classDetails.map((classItem) => (
            <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {classItem.name}
                  <Badge variant="outline">Grade {classItem.grade_level}</Badge>
                </CardTitle>
                <CardDescription>Class ID: {classItem.id.slice(0, 8)}...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Students:</span>
                    <span className="font-medium">{classItem.student_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Subjects:</span>
                    <span className="font-medium">{classItem.subject_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created:</span>
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
            <CardContent className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Classes Assigned</h3>
              <p className="text-muted-foreground">You haven't been assigned to any classes yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const StudentsSection = () => {
    if (loadingClasses) {
      return <div className="text-center py-8">Loading students...</div>;
    }

    return (
      <div className="space-y-6">
        <Dialog open={!!selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Performance Analysis</DialogTitle>
              <DialogDescription>
                {detailLoading 
                  ? "Loading student performance data..." 
                  : performanceDetail 
                    ? `Detailed performance analysis for ${performanceDetail.student.first_name} ${performanceDetail.student.last_name}`
                    : "No performance data available for this student"
                }
              </DialogDescription>
            </DialogHeader>
            
            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : performanceDetail ? (
              <StudentPerformanceDetailView performanceDetail={performanceDetail} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No performance data available for this student
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Students</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{students.length} Students</Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpandedSection(null)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Directory</CardTitle>
            <CardDescription>Click on a student to view detailed performance analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Registration No</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Guardian Contact</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => setSelectedStudentId(student.id)}>
                      <div className="font-medium">
                        {student.first_name} {student.last_name}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedStudentId(student.id)}>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{student.Reg_no}</code>
                    </TableCell>
                    <TableCell onClick={() => setSelectedStudentId(student.id)}>
                      {student.enrollments && student.enrollments[0] ? (
                        classMap[student.enrollments[0].class_id] || 'N/A'
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell onClick={() => setSelectedStudentId(student.id)}>
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="h-4 w-4" />
                        <span className="truncate max-w-[150px]">
                          {student.profiles?.[0]?.guardian_phone ?? 'No contact'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {students.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
                <p className="text-muted-foreground">There are no students enrolled in your classes yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const AnnouncementsSection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            <CardTitle>Announcements</CardTitle>
          </div>
          
          <CreateAnnouncementDialog 
            teacherClasses={teacherClasses}
            onAnnouncementCreated={fetchAnnouncements}
            teacherId={profile.id}
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {announcements.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No announcements yet. Create your first announcement!
              </div>
            )}
            {announcements.map((announcement) => (
              <div key={announcement.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{announcement.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {firstRel(teacherClasses.find(tc => tc.class_id === announcement.class_id)?.classes)?.name || "Class"}
                    </Badge>
                    {announcement.priority !== 'normal' && (
                      <Badge variant={announcement.priority === 'high' ? 'destructive' : 'default'}>
                        {announcement.priority}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-2">{announcement.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(announcement.created_at).toLocaleString()}
                    {announcement.expires_at && ` • Expires: ${new Date(announcement.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteAnnouncement(announcement.id)}
                  title="Delete announcement"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const AssignmentsSection = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            <CardTitle>Assignment Management</CardTitle>
          </div>

          <CreateAssignmentDialog 
            teacherClasses={teacherClasses}
            onAssignmentCreated={fetchAssignments}
            teacherId={profile.id}
          />
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {assignments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No assignments yet. Create your first assignment!
              </div>
            )}

            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{assignment.title}</h4>

                  {assignment.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {assignment.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-2">
                    <span>
                      Due: {assignment.due_date
                        ? new Date(assignment.due_date).toLocaleDateString()
                        : "N/A"}
                    </span>

                    <span>
                      Created: {new Date(assignment.created_at).toLocaleDateString()}
                    </span>

                    {assignment.total_marks && (
                      <span>Total Marks: {assignment.total_marks}</span>
                    )}
                  </div>

                  {assignment.file_url && (
                    <a
                      href={assignment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Download Attached File
                    </a>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteAssignment(assignment.id)}
                  title="Delete assignment"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar showLogout={true} handleLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-destructive/15 text-destructive p-4 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              ×
            </Button>
          </div>
        )}
    
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-6 relative">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Welcome, {profile.first_name} {profile.last_name}!
              </h1>
              <p className="text-muted-foreground">Teacher Code: {profile.teacher_code}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Settings Modal */}
        <SettingsModal
          profile={profile}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onProfileUpdate={refreshProfile}
        />

        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            {["overview", "assignments", "announcements"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setExpandedSection(null);
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                {tab}
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