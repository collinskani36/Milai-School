import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Users, Phone, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import StudentPerformanceDetailView from "./StudentPerformanceDetailView"; // We'll need to extract this component too

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

interface StudentPerformanceDetail {
  student: Student & { class?: string };
  assessments: any[];
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
  subjectAverages: { subject: string; average: number }[];
  gradeDistribution: { grade: string; count: number }[];
  recentTrend: number;
}

// Helper to normalize relation fields
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

interface ViewStudentsProps {
  teacherId: string | undefined;
  teacherClasses: TeacherClass[];
  isActive: boolean;
}

// Custom hook for student performance detail
const useStudentPerformanceDetail = (studentId: string | null, teacherClasses: TeacherClass[], isActive: boolean) => {
  const [performanceDetail, setPerformanceDetail] = useState<StudentPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !teacherClasses.length || !isActive) {
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
        
        const assessments: any[] = (assessmentResults || [])
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

        const gradeDistribution = [
          { label: "EE1 (L8)", min: 90, max: 100, color: "#10B981" },
          { label: "EE2 (L7)", min: 75, max: 89, color: "#22C55E" },
          { label: "ME1 (L6)", min: 58, max: 74, color: "#3B82F6" },
          { label: "ME2 (L5)", min: 41, max: 57, color: "#8B5CF6" },
          { label: "AE1 (L4)", min: 31, max: 40, color: "#F59E0B" },
          { label: "AE2 (L3)", min: 21, max: 30, color: "#F97316" },
          { label: "BE1 (L2)", min: 11, max: 20, color: "#EF4444" },
          { label: "BE2 (L1)", min: 0, max: 10, color: "#6B7280" },
        ].map(level => ({
          grade: level.label,
          count: assessments.filter(a => a.percentage >= level.min && a.percentage <= level.max).length
        }));

        const performanceData: StudentPerformanceDetail = {
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
  }, [studentId, teacherClasses, isActive]);

  return { performanceDetail, loading };
};

export default function ViewStudents({ teacherId, teacherClasses, isActive }: ViewStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const { performanceDetail, loading: detailLoading } = useStudentPerformanceDetail(
    selectedStudentId, 
    teacherClasses, 
    isActive && !!selectedStudentId
  );

  // Create class map for student class names
  const classMap = teacherClasses.reduce((acc, tc) => {
    const classObj = firstRel(tc.classes);
    if (classObj) {
      acc[tc.class_id] = classObj.name;
    }
    return acc;
  }, {} as Record<string, string>);

  // Fetch students only when component is active (tab is selected)
  useEffect(() => {
    if (!isActive || !teacherClasses.length || !teacherId) {
      return;
    }

    const fetchStudentsData = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };

    fetchStudentsData();
  }, [isActive, teacherClasses, teacherId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Student Performance Detail Dialog */}
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
              <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Class</TableHead>
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
                  className="py-2 px-2 sm:py-3 sm:px-4 cursor-pointer"
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  <div className="text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">
                    {student.enrollments && student.enrollments[0]
                      ? classMap[student.enrollments[0].class_id] || 'N/A'
                      : 'N/A'}
                  </div>
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
        <p className="text-xs sm:text-sm text-muted-foreground">
          There are no students enrolled in your classes yet.
        </p>
      </div>
    )}
  </CardContent>
</Card>

    </div>
  );
}