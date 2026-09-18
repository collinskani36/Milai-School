import { useState, useEffect } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import {
  Dialog, DialogContent, DialogClose, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/Components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/Components/ui/table";
import {
  Users, Phone, ChevronLeft, X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import StudentPerformanceDetailView from "./StudentPerformanceDetailView";

// ---------- Types (UNCHANGED) ----------
interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  classes?: { id: string; name: string; grade_level: string; created_at: string } |
            { id: string; name: string; grade_level: string; created_at: string }[];
  subjects?: { id: string; name: string; code: string; created_at: string } |
             { id: string; name: string; code: string; created_at: string }[];
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

// ---------- Design tokens ----------
const MAROON = "#7a1f2b";
const MAROON_GRADIENT = "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";
const CARD_SHADOW_HOVER = "0 10px 40px -18px rgba(122,31,43,0.35)";

// ---------- Helpers (UNCHANGED) ----------
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : (rel as T);
};

interface ViewStudentsProps {
  teacherId: string | undefined;
  teacherClasses: TeacherClass[];
  isActive: boolean;
  academicYear?: string;
  assessmentYear?: number;
}

// ---------- Custom hook for student performance detail (UNCHANGED logic) ----------
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
            id, Reg_no, first_name, last_name, created_at, auth_id,
            profiles (*),
            enrollments ( class_id, classes ( name, grade_level ) )
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
            id, score, performance_level, teacher_remarks, is_absent, assessment_date, subject_id,
            assessments (
              id, title, term, year, class_id, max_marks, category, strand_id, sub_strand_id,
              strands (name, code), sub_strands (name, code)
            ),
            subjects ( name )
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
          return { subject: subjectName || "Unknown", average: parseFloat(average.toFixed(1)) };
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

// ---------- Section header (maroon gradient, optional Close / Back) ----------
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  showClose = false,
  onBack,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  showClose?: boolean;
  onBack?: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-t-2xl px-4 sm:px-5 py-3 shrink-0"
      style={{ background: MAROON_GRADIENT }}
    >
      <div
        className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }}
      />
      <div className="relative flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 flex items-center justify-center transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        ) : (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/70 text-[11px] leading-tight truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {showClose && (
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors text-white shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        )}
      </div>
    </div>
  );
}

// ---------- Main Component ----------
export default function ViewStudents({
  teacherId,
  teacherClasses,
  isActive,
}: ViewStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [openClassId, setOpenClassId] = useState<string | null>(null);

  const { performanceDetail, loading: detailLoading } = useStudentPerformanceDetail(
    selectedStudentId,
    teacherClasses,
    isActive && !!selectedStudentId
  );

  // Build a deduplicated map of class_id -> class name from teacherClasses (UNCHANGED)
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

  // classMap kept for parity
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
            classes ( name, grade_level )
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
            id, Reg_no, first_name, last_name, created_at, auth_id,
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

  // Students grouped by class_id (UNCHANGED)
  const studentsByClass = students.reduce((acc, student) => {
    const classId = student.enrollments?.[0]?.class_id;
    if (classId) {
      if (!acc[classId]) acc[classId] = [];
      acc[classId].push(student);
    }
    return acc;
  }, {} as Record<string, Student[]>);

  const handleOpenClass = (classId: string) => {
    setOpenClassId(classId);
  };

  const handleCloseAll = (open: boolean) => {
    if (!open) {
      setOpenClassId(null);
      setSelectedStudentId(null);
    }
  };

  const handleBackToRoster = () => {
    setSelectedStudentId(null);
  };

  const openClass = uniqueClasses.find(c => c.class_id === openClassId);
  const openClassStudents = openClassId ? studentsByClass[openClassId] || [] : [];

  // ── Loading gate ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2"
          style={{ borderColor: "rgba(122,31,43,0.15)", borderBottomColor: MAROON }}
        />
      </div>
    );
  }

  return (
    /* Fixed-height root — no outer page scroll */
    <div
      className="flex flex-col overflow-hidden overscroll-contain gap-3 sm:gap-4"
      style={{ height: "calc(100dvh - 290px - env(safe-area-inset-bottom))", minHeight: 300 }}
    >

      {/* ════════ CLASS ROSTER DIALOG (also hosts student performance) ════════ */}
      <Dialog open={!!openClassId} onOpenChange={handleCloseAll}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-4xl h-[85vh] sm:h-[80vh] p-0 rounded-2xl border-[#7a1f2b]/15 overflow-hidden flex flex-col gap-0 [&>button]:hidden"
        >
          {selectedStudentId ? (
            /* ── PERFORMANCE VIEW ── */
            <>
              <SectionHeader
                icon={Users}
                title={
                  detailLoading
                    ? "Loading…"
                    : performanceDetail
                    ? `${performanceDetail.student.first_name} ${performanceDetail.student.last_name}`
                    : "Student Performance"
                }
                subtitle={
                  detailLoading
                    ? "Fetching performance data"
                    : performanceDetail
                    ? `${performanceDetail.student.class} · ${performanceDetail.student.Reg_no}`
                    : "No data"
                }
                onBack={handleBackToRoster}
                showClose
              />
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div
                      className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2"
                      style={{ borderColor: "rgba(122,31,43,0.15)", borderBottomColor: MAROON }}
                    />
                  </div>
                ) : performanceDetail ? (
                  <StudentPerformanceDetailView performanceDetail={performanceDetail} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No performance data available for this student
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── ROSTER VIEW ── */
            <>
              <SectionHeader
                icon={Users}
                title={openClass?.name ?? "Class"}
                subtitle={`${openClassStudents.length} ${openClassStudents.length === 1 ? "student" : "students"} · tap a student to view performance`}
                showClose
              />
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
                {openClassStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(122,31,43,0.2)" }} />
                    <p className="text-sm text-muted-foreground">
                      No students enrolled in this class yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: card list */}
                    <div className="sm:hidden space-y-2">
                      {openClassStudents.map((student) => (
                        <button
                          type="button"
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-[#7a1f2b]/10 bg-white px-3 py-2.5 active:bg-[#7a1f2b]/5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[#3a1b1f] truncate">
                              {student.first_name} {student.last_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <code className="text-[10px] bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15 px-1.5 py-0.5 rounded font-medium">
                                {student.Reg_no}
                              </code>
                              {student.profiles?.[0]?.guardian_phone && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  {student.profiles[0].guardian_phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                            style={{ background: "rgba(122,31,43,0.08)", color: MAROON }}
                          >
                            View
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#7a1f2b]/10">
                            <TableHead className="py-3 px-4 text-xs text-[#7a1f2b]/70 font-semibold uppercase tracking-wider">Student</TableHead>
                            <TableHead className="py-3 px-4 text-xs text-[#7a1f2b]/70 font-semibold uppercase tracking-wider">Reg No</TableHead>
                            <TableHead className="py-3 px-4 text-xs text-[#7a1f2b]/70 font-semibold uppercase tracking-wider">Guardian</TableHead>
                            <TableHead className="py-3 px-4 text-xs text-[#7a1f2b]/70 font-semibold uppercase tracking-wider">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openClassStudents.map((student) => (
                            <TableRow
                              key={student.id}
                              className="hover:bg-[#7a1f2b]/5 cursor-pointer border-[#7a1f2b]/5"
                              onClick={() => setSelectedStudentId(student.id)}
                            >
                              <TableCell className="py-3 px-4">
                                <div className="font-medium text-sm text-[#3a1b1f]">
                                  {student.first_name} {student.last_name}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-4">
                                <code className="text-xs bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15 px-2 py-1 rounded font-medium">
                                  {student.Reg_no}
                                </code>
                              </TableCell>
                              <TableCell className="py-3 px-4">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-4 w-4" />
                                  <span>{student.profiles?.[0]?.guardian_phone ?? 'No contact'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); setSelectedStudentId(student.id); }}
                                  className="h-8 px-3 text-sm rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
                                >
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════ HEADER ROW — count pill only ════════ */}
      <div className="shrink-0 flex items-center justify-end gap-3">
        <div
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold"
          style={{ background: "rgba(122,31,43,0.08)", color: MAROON }}
        >
          <Users className="h-3.5 w-3.5" />
          {students.length} {students.length === 1 ? "Student" : "Students"}
        </div>
      </div>

      {/* ════════ CLASS CIRCLES (main body, scrolls internally if needed) ════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {uniqueClasses.length === 0 ? (
          <Card
            className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <CardContent className="text-center py-10 sm:py-12 px-4">
              <Users className="h-10 w-10 sm:h-14 sm:w-14 mx-auto mb-3 sm:mb-4" style={{ color: "rgba(122,31,43,0.2)" }} />
              <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-[#3a1b1f]">
                No Classes Found
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                No classes assigned to you yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-3 sm:gap-5 pb-1">
            {uniqueClasses.map(({ class_id, name }) => {
              const count = (studentsByClass[class_id] || []).length;
              return (
                <button
                  key={class_id}
                  onClick={() => handleOpenClass(class_id)}
                  className="group flex flex-col items-center gap-1.5 focus:outline-none transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  <div
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center text-white transition-all duration-200 group-hover:shadow-lg"
                    style={{
                      background: MAROON_GRADIENT,
                      boxShadow: CARD_SHADOW,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
                  >
                    <span className="text-2xl sm:text-3xl font-bold leading-none">{count}</span>
                    <span className="text-[10px] sm:text-xs mt-0.5 opacity-80">
                      {count === 1 ? "student" : "students"}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-center max-w-[88px] sm:max-w-[104px] leading-tight text-[#3a1b1f] group-hover:text-[#7a1f2b] transition-colors">
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}