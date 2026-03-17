import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Users, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import StudentPerformanceDetailView from "./StudentPerformanceDetailView";
import { PerformanceBadge } from "@/Components/PerformanceBadge";

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
  enrollments?: any[];
  profiles?: any[];
  class?: string;
}

interface StudentPerformanceDetail {
  student: Student;
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
  academicYear?: string;
  assessmentYear?: number;
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
            performance_level,
            teacher_remarks,
            is_absent,
            assessment_date,
            subject_id,
            assessments (
              id,
              title,
              term,
              year,
              class_id,
              max_marks,
              category,
              strand_id,
              sub_strand_id,
              strands (name, code),
              sub_strands (name, code)
            ),
            subjects (
              name
            )
          `)
          .eq("student_id", studentId)
          .in("subject_id", subjectIds)
          .eq("status", "published")
          .order("assessment_date", { ascending: false })
          .limit(50);

        if (resultsError) throw resultsError;

        const subjectMap = teacherSubjectsForStudentClass.reduce((acc, tc) => {
          const subjName = firstRel(tc.subjects)?.name;
          if (subjName) acc[tc.subject_id] = subjName;
          return acc;
        }, {} as Record<string, string>);
        
        const assessments: any[] = (assessmentResults || [])
          .filter(ar => ar.assessments && ar.subjects && subjectMap[ar.subject_id])
          .map(ar => {
            const assessment = Array.isArray(ar.assessments) ? ar.assessments[0] : ar.assessments;
            const subject = Array.isArray(ar.subjects) ? ar.subjects[0] : ar.subjects;
            const isSummative = !assessment?.category || assessment?.category === 'summative';
            return {
              id: ar.id,
              title: assessment?.title,
              score: ar.score,
              performance_level: ar.performance_level,
              teacher_remarks: ar.teacher_remarks,
              is_absent: ar.is_absent,
              max_marks: assessment?.max_marks || 100,
              percentage: isSummative && ar.score !== null
                ? (ar.score / (assessment?.max_marks || 100)) * 100
                : null,
              assessment_date: ar.assessment_date,
              subject: subject?.name,
              term: assessment?.term,
              year: assessment?.year,
              category: assessment?.category || 'summative',
              strand: assessment?.strands,
              sub_strand: assessment?.sub_strands,
            };
          });

        const summativeAssessments = assessments.filter(a => a.category === 'summative');

        const subjectAverages = teacherSubjectsForStudentClass.map(tc => {
          const subjectName = firstRel(tc.subjects)?.name;
          const subjectSummative = summativeAssessments.filter(a => a.subject === subjectName);
          const average = subjectSummative.length > 0
            ? subjectSummative.reduce((sum, a) => sum + (a.percentage || 0), 0) / subjectSummative.length
            : 0;
          return {
            subject: subjectName || "Unknown",
            average: parseFloat(average.toFixed(1))
          };
        }).filter(sa => sa.average > 0);

        const overallAverage = summativeAssessments.length > 0
          ? summativeAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) / summativeAssessments.length
          : 0;

        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        let recentTrend = 0;

        if (summativeAssessments.length >= 4) {
          const sorted = [...summativeAssessments].sort((a, b) =>
            new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
          );
          const n = sorted.length;
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          sorted.forEach((a, i) => {
            sumX += i; sumY += a.percentage || 0;
            sumXY += i * (a.percentage || 0); sumX2 += i * i;
          });
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          recentTrend = parseFloat((slope * 10).toFixed(1));
          if (recentTrend > 2) trend = 'improving';
          else if (recentTrend < -2) trend = 'declining';
        } else if (summativeAssessments.length >= 2) {
          const sorted = [...summativeAssessments].sort((a, b) =>
            new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
          );
          const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
          const secondHalf = sorted.slice(-Math.floor(sorted.length / 2));
          const firstAvg = firstHalf.reduce((sum, a) => sum + (a.percentage || 0), 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, a) => sum + (a.percentage || 0), 0) / secondHalf.length;
          recentTrend = parseFloat((secondAvg - firstAvg).toFixed(1));
          if (recentTrend > 5) trend = 'improving';
          else if (recentTrend < -5) trend = 'declining';
        }

        const gradeDistribution = [
          { label: "EE1 (L8)", min: 90, max: 100 },
          { label: "EE2 (L7)", min: 75, max: 89 },
          { label: "ME1 (L6)", min: 58, max: 74 },
          { label: "ME2 (L5)", min: 41, max: 57 },
          { label: "AE1 (L4)", min: 31, max: 40 },
          { label: "AE2 (L3)", min: 21, max: 30 },
          { label: "BE1 (L2)", min: 11, max: 20 },
          { label: "BE2 (L1)", min: 0,  max: 10  },
        ].map(level => ({
          grade: level.label,
          count: summativeAssessments.filter(a =>
            a.percentage !== null && a.percentage >= level.min && a.percentage <= level.max
          ).length
        }));

        setPerformanceDetail({
          student: { ...(studentData as any), class: studentClassName },
          assessments,
          averageScore: parseFloat(overallAverage.toFixed(1)),
          trend,
          subjectAverages,
          gradeDistribution,
          recentTrend
        });
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

export default function ViewStudents({ teacherId, teacherClasses, isActive, academicYear, assessmentYear }: ViewStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  // Track which class circles are expanded (by class_id)
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set());

  const { performanceDetail, loading: detailLoading } = useStudentPerformanceDetail(
    selectedStudentId, 
    teacherClasses, 
    isActive && !!selectedStudentId
  );

  // Build a deduplicated map of class_id -> class name from teacherClasses
  const uniqueClasses: { class_id: string; name: string }[] = [];
  const seenClassIds = new Set<string>();
  for (const tc of teacherClasses) {
    if (!seenClassIds.has(tc.class_id)) {
      const classObj = firstRel(tc.classes);
      if (classObj) {
        uniqueClasses.push({ class_id: tc.class_id, name: classObj.name });
        seenClassIds.add(tc.class_id);
      }
    }
  }

  const classMap = teacherClasses.reduce((acc, tc) => {
    const classObj = firstRel(tc.classes);
    if (classObj) acc[tc.class_id] = classObj.name;
    return acc;
  }, {} as Record<string, string>);

  useEffect(() => {
    if (!isActive || !teacherClasses.length || !teacherId) return;

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

        const studentsWithEnrollments = studentsData?.map(student => ({
          ...student,
          enrollments: enrollments.filter(e => e.student_id === student.id)
        })) || [];

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

  const toggleClass = (classId: string) => {
    setExpandedClassIds(prev => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  // Students grouped by class_id
  const studentsByClass = students.reduce((acc, student) => {
    const classId = student.enrollments?.[0]?.class_id;
    if (classId) {
      if (!acc[classId]) acc[classId] = [];
      acc[classId].push(student);
    }
    return acc;
  }, {} as Record<string, Student[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-2xl font-bold">Students</h2>
        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="secondary" className="text-xs sm:text-sm">{students.length} Students</Badge>
        </div>
      </div>

      {/* Class Circles */}
      {uniqueClasses.length > 0 && (
        <div className="flex flex-wrap gap-4 sm:gap-6">
          {uniqueClasses.map(({ class_id, name }) => {
            const count = (studentsByClass[class_id] || []).length;
            const isExpanded = expandedClassIds.has(class_id);
            return (
              <button
                key={class_id}
                onClick={() => toggleClass(class_id)}
                className="flex flex-col items-center gap-1.5 group focus:outline-none"
                aria-expanded={isExpanded}
              >
                <div
                  className={`
                    w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex flex-col items-center justify-center
                    transition-all duration-200 shadow-sm
                    ${isExpanded
                      ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                      : "border-primary/40 bg-primary/5 text-foreground group-hover:border-primary group-hover:bg-primary/10"
                    }
                  `}
                >
                  <span className="text-2xl sm:text-3xl font-bold leading-none">{count}</span>
                  <span className="text-[10px] sm:text-xs mt-0.5 opacity-80">students</span>
                </div>
                <span
                  className={`
                    text-xs sm:text-sm font-semibold underline underline-offset-2 text-center max-w-[80px] sm:max-w-[96px] leading-tight
                    ${isExpanded ? "text-primary" : "text-foreground group-hover:text-primary"}
                  `}
                >
                  {name}
                </span>
                {isExpanded
                  ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                }
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded class student lists */}
      {uniqueClasses
        .filter(({ class_id }) => expandedClassIds.has(class_id))
        .map(({ class_id, name }) => {
          const classStudents = studentsByClass[class_id] || [];
          return (
            <Card key={class_id} className="border-primary/20">
              <CardHeader className="p-4 sm:p-5 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {name}
                  <Badge variant="secondary" className="ml-1 text-xs">{classStudents.length} students</Badge>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Tap a student to view their detailed performance analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-5 pt-2">
                {/* Mobile: stacked cards. Desktop: table */}
                <div className="sm:hidden space-y-2">
                  {classStudents.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 active:bg-muted cursor-pointer"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-medium text-sm truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {student.Reg_no}
                          </code>
                          {student.profiles?.[0]?.guardian_phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              {student.profiles[0].guardian_phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedStudentId(student.id); }}
                        className="h-7 text-xs px-2 flex-shrink-0"
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Desktop: full table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-3 px-4 text-xs">Student</TableHead>
                        <TableHead className="py-3 px-4 text-xs">Reg No</TableHead>
                        <TableHead className="py-3 px-4 text-xs">Guardian</TableHead>
                        <TableHead className="py-3 px-4 text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/50">
                          <TableCell className="py-3 px-4 cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
                            <div className="font-medium text-sm">{student.first_name} {student.last_name}</div>
                          </TableCell>
                          <TableCell className="py-3 px-4 cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{student.Reg_no}</code>
                          </TableCell>
                          <TableCell className="py-3 px-4 cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{student.profiles?.[0]?.guardian_phone ?? 'No contact'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <Button variant="outline" size="sm" onClick={() => setSelectedStudentId(student.id)} className="h-8 px-3 text-sm">
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {classStudents.length === 0 && (
                  <div className="text-center py-6 px-4">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-muted-foreground">No students enrolled in this class yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

      {/* Empty state */}
      {students.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-10 sm:py-12 px-4">
            <Users className="h-10 w-10 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No Students Found</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              There are no students enrolled in your classes yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}