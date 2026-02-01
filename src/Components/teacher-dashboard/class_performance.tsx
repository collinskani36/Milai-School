import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Users, BookOpen, TrendingUp, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabaseClient";

// ---------- Types ----------
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

interface ClassPerformanceData {
  assessment: string;
  subject: string;
  class: string;
  mean: number;
}

interface StudentPerformance {
  student_name: string;
  subject: string;
  average_score: number;
  trend: 'improving' | 'declining' | 'stable';
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

// Helper to normalize relation fields
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

interface ClassPerformanceProps {
  teacherId: string | undefined;
  teacherClasses: TeacherClass[];
  isActive: boolean;
}

export default function ClassPerformance({ teacherId, teacherClasses, isActive }: ClassPerformanceProps) {
  const [loading, setLoading] = useState(false);
  const [classPerformanceData, setClassPerformanceData] = useState<ClassPerformanceData[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);

  // Fetch data only when component is active (tab is selected)
  useEffect(() => {
    if (!isActive || !teacherClasses.length || !teacherId) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchStudents(),
          fetchClassPerformance(),
        ]);
      } catch (error) {
        console.error("Error fetching class performance data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isActive, teacherClasses, teacherId]);

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
      setTotalStudents(studentsWithEnrollments.length);
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
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
  }, [teacherClasses]);

  const averagePerformance = classPerformanceData.length
    ? (classPerformanceData.reduce((sum, d) => sum + d.mean, 0) / classPerformanceData.length).toFixed(1)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 sm:pb-3 p-4 sm:p-6">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary mr-2" />
            <CardTitle className="text-sm sm:text-base md:text-lg">Students</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {loading ? "Loading..." : totalStudents}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 sm:pb-3 p-4 sm:p-6">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary mr-2" />
            <CardTitle className="text-sm sm:text-base md:text-lg">Classes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {loading ? "Loading..." : teacherClasses.length}
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

      {/* Class Performance Chart */}
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
    </div>
  );
}