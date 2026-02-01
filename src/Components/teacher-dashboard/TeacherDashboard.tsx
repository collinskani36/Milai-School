import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Navbar } from "@/Components/Navbar";
import { User, Settings, BookOpen, MessageSquare, Users, TrendingUp, FileText, Mail, Phone, Target, Calendar, Plus, Send, ChevronLeft } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import SettingsModal from "./SettingsModal";
import TeacherAssignmentsAnnouncements from "./teacher_assignments_announcements";
import ViewStudents from "./view_students";

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

interface GradeDistribution {
  grade: string;
  count: number;
  color: string;
}

interface ClassPerformanceData {
  assessment: string;
  subject: string;
  class: string;
  mean: number;
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

// Helper to normalize relation fields
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

// ---------- Main Component ----------
interface TeacherDashboardProps {
  handleLogout: () => void;
}

export default function TeacherDashboard({ handleLogout }: TeacherDashboardProps) {
  const { profile, loading: loadingProfile, error: profileError } = useTeacherProfile();
  const { classes: teacherClasses, loading: loadingClasses } = useTeacherClasses(profile?.id);
  
  const [activeTab, setActiveTab] = useState<"overview" | "assignments" | "students">("overview");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);
  const [classPerformanceData, setClassPerformanceData] = useState<ClassPerformanceData[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch students count
  useEffect(() => {
    if (!teacherClasses.length || !profile?.id) return;

    const fetchStudents = async () => {
      try {
        const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
        
        const { data: enrollments, error: enrollError } = await supabase
          .from("enrollments")
          .select("student_id")
          .in("class_id", classIds);

        if (enrollError) throw enrollError;

        if (!enrollments) {
          setStudents([]);
          return;
        }

        const studentIds = enrollments.map(e => e.student_id);
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id")
          .in("id", studentIds);

        if (studentsError) throw studentsError;
        setStudents(studentsData || []);
      } catch (error) {
        console.error("Error fetching students:", error);
        setStudents([]);
      }
    };

    fetchStudents();
  }, [teacherClasses, profile?.id]);

  // Fetch class performance data
  useEffect(() => {
    if (!teacherClasses.length) {
      setClassPerformanceData([]);
      return;
    }

    const fetchClassPerformance = async () => {
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

            if (resultsError) continue;

            if (resultsData && resultsData.length > 0) {
              const scores = resultsData
                .map(r => Number(r.score))
                .filter(s => Number.isFinite(s));

              if (!scores.length) continue;

              const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
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
    };

    fetchClassPerformance();
  }, [teacherClasses]);

  // Fetch KJSEA Grade Distribution - always loads immediately (not lazy-loaded)
  useEffect(() => {
    if (!teacherClasses.length) {
      setGradeDistribution([]);
      return;
    }

    const fetchGradeDistribution = async () => {
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
    };

    fetchGradeDistribution();
  }, [teacherClasses]);

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

  // Calculate average performance
  const averagePerformance = classPerformanceData.length
    ? (classPerformanceData.reduce((sum, d) => sum + d.mean, 0) / classPerformanceData.length).toFixed(1)
    : "0";

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

  return (
    <div className="min-h-screen bg-background touch-manipulation pb-16 sm:pb-0">
      <Navbar showLogout={true} handleLogout={handleLogout} />
      
      {/* Tab Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {/* Overview Dashboard - Only shown when activeTab is "overview" */}
        {activeTab === "overview" ? (
          <div className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-destructive/15 text-destructive p-3 sm:p-4 rounded-lg flex justify-between items-center text-xs sm:text-sm">
                <span className="flex-1 mr-2">{error}</span>
                <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 sm:h-8 sm:w-8 p-0">
                  ×
                </Button>
              </div>
            )}
        
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 sm:p-6">
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

            {/* Teacher Profile Card and Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Teacher Profile Card */}
              <Card className="lg:col-span-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold mb-2">
                        {profile.first_name} {profile.last_name}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{profile.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{profile.phone || "Not set"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Member since: {new Date(profile.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
                    <div className="text-xl sm:text-2xl font-bold">{students.length}</div>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
                    <div className="text-xl sm:text-2xl font-bold">{teacherClasses.length}</div>
                    <p className="text-xs text-muted-foreground">Classes</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
                    <div className="text-xl sm:text-2xl font-bold">{averagePerformance}%</div>
                    <p className="text-xs text-muted-foreground">Avg. Performance</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* KJSEA Grade Distribution */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  KJSEA Grade Distribution
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Kenyan Achievement Levels across all assessments
                </CardDescription>
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

            {/* Class Performance Overview */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Class Performance Overview
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Mean grade by assessment across your classes
                </CardDescription>
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

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation h-full"
                onClick={() => setActiveTab("assignments")}
              >
                <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Plus className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Create Assignment</h3>
                  <p className="text-sm text-muted-foreground">Post new assignment for your class</p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation h-full"
                onClick={() => setActiveTab("assignments")}
              >
                <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Send className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Send Announcement</h3>
                  <p className="text-sm text-muted-foreground">Notify your students with important updates</p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation h-full"
                onClick={() => setActiveTab("students")}
              >
                <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">View Students</h3>
                  <p className="text-sm text-muted-foreground">Check student progress and performance</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Assignments or Students Tab - Full screen focus */
          <div className="space-y-4 sm:space-y-6">
            {/* Back to Overview Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("overview")}
              className="flex items-center gap-2 mb-4"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Overview
            </Button>

            {/* Page Title */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {activeTab === "assignments" ? "Assignments & Announcements" : "View Students"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "assignments" 
                    ? "Manage assignments and send announcements to your classes" 
                    : "View and manage student information and performance"}
                </p>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === "assignments" && (
              <TeacherAssignmentsAnnouncements 
                teacherId={profile.id} 
                teacherClasses={teacherClasses} 
                isActive={true}
              />
            )}
            
            {activeTab === "students" && (
              <ViewStudents 
                teacherId={profile.id} 
                teacherClasses={teacherClasses} 
                isActive={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        profile={profile}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProfileUpdate={refreshProfile}
      />

      {/* Bottom Navigation Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border sm:hidden z-50">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "overview" 
                ? "text-primary border-t-2 border-primary" 
                : "text-muted-foreground"
            }`}
          >
            <TrendingUp className="h-5 w-5 mb-1" />
            <span className="text-xs">Overview</span>
          </button>
          
          <button
            onClick={() => setActiveTab("assignments")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "assignments" 
                ? "text-primary border-t-2 border-primary" 
                : "text-muted-foreground"
            }`}
          >
            <FileText className="h-5 w-5 mb-1" />
            <span className="text-xs">Assignments</span>
          </button>
          
          <button
            onClick={() => setActiveTab("students")}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              activeTab === "students" 
                ? "text-primary border-t-2 border-primary" 
                : "text-muted-foreground"
            }`}
          >
            <Users className="h-5 w-5 mb-1" />
            <span className="text-xs">Students</span>
          </button>
        </div>
      </div>
    </div>
  );
}