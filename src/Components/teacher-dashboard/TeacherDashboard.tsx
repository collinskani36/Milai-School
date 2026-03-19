import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Navbar } from "@/Components/Navbar";
import { User, Settings, BookOpen, Users, TrendingUp, FileText, Mail, Phone, Target, Calendar, ChevronLeft } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import SettingsModal from "./SettingsModal";
import TeacherAssignmentsAnnouncements from "./teacher_assignments_announcements";
import ViewStudents from "./view_students";
import TeacherMarksEntry from "./TeacherMarksEntry";
import ClassTimetableViewer from "./ClassTimetableViewer";

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
  academic_year: string;
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

interface AcademicTerm {
  id: string;
  academic_year: string;
  term: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface GradeDistribution {
  grade: string;
  count: number;
  color: string;
}

interface TermGradeDistribution {
  term: number;
  data: GradeDistribution[];
}

interface ClassPerformanceData {
  assessment: string;
  mean: number;
}

// ── Class trend types ──
interface TrendPoint {
  label: string;
  term: number;
  assessmentDate: string;
  [seriesKey: string]: number | string;
}

interface TrendSeries {
  key: string;
  label: string;
  color: string;
  latestMean: number | null;
  trend: "improving" | "declining" | "stable" | "insufficient";
  trendDelta: number;
  bestAssessment: string;
  worstAssessment: string;
  assessmentCount: number;
}

// ── Timetable entry from class_timetables ──
interface ClassTimetableEntry {
  id: string;
  class_id: string;
  term: number;
  academic_year: string;
  timetable_data: any;
  className: string;
}

// ---------- KJSEA Achievement Levels ----------
const KJSEA_LEVELS = [
  { label: "EE1 (L8)", min: 90, max: 100, color: "#10B981", description: "Exceptional" },
  { label: "EE2 (L7)", min: 75, max: 89,  color: "#22C55E", description: "Excellent" },
  { label: "ME1 (L6)", min: 58, max: 74,  color: "#3B82F6", description: "Very Good" },
  { label: "ME2 (L5)", min: 41, max: 57,  color: "#8B5CF6", description: "Good" },
  { label: "AE1 (L4)", min: 31, max: 40,  color: "#F59E0B", description: "Average" },
  { label: "AE2 (L3)", min: 21, max: 30,  color: "#F97316", description: "Below Average" },
  { label: "BE1 (L2)", min: 11, max: 20,  color: "#EF4444", description: "Poor" },
  { label: "BE2 (L1)", min: 0,  max: 10,  color: "#6B7280", description: "Very Poor" },
] as const;

const TREND_COLOURS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"] as const;

// ---------- Helpers ----------
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel;
};

function academicYearToCandidateYears(academicYear: string): number[] {
  const parts = academicYear.split("-").map((p) => parseInt(p, 10)).filter((n) => !isNaN(n));
  return [...new Set(parts)];
}

// ---------- Query fetch functions ----------

async function fetchTeacherProfile(): Promise<Teacher> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error(userError?.message || "No user found");
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("*")
    .eq("auth_id", user.id)
    .single();
  if (teacherError) throw new Error(teacherError.message);
  return teacher;
}

async function fetchActiveTerm(): Promise<AcademicTerm | null> {
  const { data, error } = await supabase
    .from("academic_calendar")
    .select("*")
    .eq("is_current", true)
    .single();
  if (error) return null;
  return data as AcademicTerm;
}

async function fetchTeacherClasses(
  teacherId: string,
  academicYear: string
): Promise<TeacherClass[]> {
  const { data, error } = await supabase
    .from("teacher_classes")
    .select(`
      id, teacher_id, class_id, subject_id, academic_year, created_at,
      classes ( id, name, grade_level, created_at ),
      subjects ( id, name, code, created_at )
    `)
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);
  if (error) throw error;
  return data || [];
}

async function fetchStudents(teacherClasses: TeacherClass[]): Promise<{ id: string }[]> {
  const classIds = teacherClasses.map((tc) => tc.class_id);
  const { data, error } = await supabase
    .from("enrollments")
    .select("student_id, students ( id )")
    .in("class_id", classIds);
  if (error || !data) return [];
  const uniqueStudents = new Map<string, boolean>();
  data.forEach((row) => {
    const studentRow = Array.isArray(row.students) ? row.students[0] : row.students;
    const studentId = (studentRow as any)?.id;
    if (studentId) uniqueStudents.set(studentId, true);
  });
  return Array.from(uniqueStudents.keys()).map((id) => ({ id }));
}

async function fetchClassPerformance(
  teacherClasses: TeacherClass[],
  candidateYears: number[]
): Promise<ClassPerformanceData[]> {
  const classPairs = teacherClasses.map((tc) => ({
    class_id: tc.class_id,
    subject_id: tc.subject_id,
  }));
  const classIds = classPairs.map((p) => p.class_id);

  const { data: assessments, error: assessError } = await supabase
    .from("assessments")
    .select("id, title, class_id, created_at, assessment_date, term")
    .in("class_id", classIds)
    .eq("category", "summative")
    .in("year", candidateYears)
    .order("assessment_date", { ascending: false })
    .limit(10);

  if (assessError || !assessments?.length) return [];

  const assessmentIds = assessments.map((a) => a.id);

  const { data: publishedResults, error: prError } = await supabase
    .from("assessment_results")
    .select("assessment_id, score, subject_id")
    .in("assessment_id", assessmentIds)
    .eq("status", "published");

  if (prError || !publishedResults?.length) return [];

  const validResults = publishedResults.filter((r) => {
    const assessment = assessments.find((a) => a.id === r.assessment_id);
    if (!assessment) return false;
    return classPairs.some(
      (p) => p.class_id === assessment.class_id && p.subject_id === r.subject_id
    );
  });

  if (!validResults.length) return [];

  const assessmentsWithResults = assessments
    .filter((a) => validResults.some((r) => r.assessment_id === a.id))
    .slice(0, 3);

  return assessmentsWithResults.map((assessment) => {
    const scores = validResults
      .filter((r) => r.assessment_id === assessment.id)
      .map((r) => Number(r.score))
      .filter((s) => !isNaN(s));
    if (scores.length === 0) return null;
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const cls = teacherClasses.find((tc) => tc.class_id === assessment.class_id);
    const className = firstRel(cls?.classes)?.name ?? "";
    const termLabel = assessment.term ? `T${assessment.term}` : "";
    const label = className
      ? `${assessment.title} (${className}${termLabel ? ` · ${termLabel}` : ""})`
      : termLabel
      ? `${assessment.title} · ${termLabel}`
      : assessment.title;
    return { assessment: label, mean: Number(mean.toFixed(2)) };
  }).filter(Boolean) as ClassPerformanceData[];
}

async function fetchClassTrend(
  teacherClasses: TeacherClass[],
  candidateYears: number[]
): Promise<{ points: TrendPoint[]; series: TrendSeries[] }> {
  const classPairs = teacherClasses.map((tc, i) => ({
    class_id: tc.class_id,
    subject_id: tc.subject_id,
    className: firstRel(tc.classes)?.name ?? tc.class_id,
    subjectName: firstRel(tc.subjects)?.name ?? tc.subject_id,
    key: `s${i}`,
    color: TREND_COLOURS[i % TREND_COLOURS.length],
  }));
  const classIds = classPairs.map((p) => p.class_id);

  const { data: assessments, error: assessError } = await supabase
    .from("assessments")
    .select("id, title, class_id, term, assessment_date")
    .in("class_id", classIds)
    .eq("category", "summative")
    .in("year", candidateYears)
    .order("term", { ascending: true })
    .order("assessment_date", { ascending: true });

  if (assessError || !assessments?.length) return { points: [], series: [] };

  const assessmentIds = assessments.map((a) => a.id);

  const { data: results, error: resError } = await supabase
    .from("assessment_results")
    .select("assessment_id, score, subject_id")
    .in("assessment_id", assessmentIds)
    .eq("status", "published");

  if (resError || !results?.length) return { points: [], series: [] };

  const validResults = results.filter((r) => {
    const a = assessments.find((x) => x.id === r.assessment_id);
    if (!a) return false;
    return classPairs.some((p) => p.class_id === a.class_id && p.subject_id === r.subject_id);
  });

  const assessmentsWithData = assessments.filter((a) =>
    validResults.some((r) => r.assessment_id === a.id)
  );

  const pointMap = new Map<string, TrendPoint>();
  for (const a of assessmentsWithData) {
    const xLabel = `T${a.term} · ${a.title}`;
    if (!pointMap.has(xLabel)) {
      pointMap.set(xLabel, { label: xLabel, term: a.term, assessmentDate: a.assessment_date ?? "" });
    }
    const point = pointMap.get(xLabel)!;
    for (const s of classPairs) {
      if (s.class_id !== a.class_id) continue;
      const scores = validResults
        .filter((r) => r.assessment_id === a.id && r.subject_id === s.subject_id)
        .map((r) => Number(r.score))
        .filter((n) => Number.isFinite(n));
      if (scores.length > 0) {
        const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        point[s.key] = Number(mean.toFixed(1));
      }
    }
  }

  const points = Array.from(pointMap.values());

  const series: TrendSeries[] = classPairs.map((s) => {
    const seriesMeans = points
      .filter((p) => p[s.key] !== undefined)
      .map((p) => ({ label: p.label, mean: p[s.key] as number }));
    if (seriesMeans.length === 0) return null;
    const latestMean = seriesMeans[seriesMeans.length - 1]?.mean ?? null;
    const firstMean  = seriesMeans[0]?.mean ?? null;
    const delta = (latestMean !== null && firstMean !== null)
      ? Number((latestMean - firstMean).toFixed(1)) : 0;
    let trend: TrendSeries["trend"] = "insufficient";
    if (seriesMeans.length >= 2) {
      if (delta > 3) trend = "improving";
      else if (delta < -3) trend = "declining";
      else trend = "stable";
    }
    const best  = seriesMeans.reduce((a, b) => b.mean > a.mean ? b : a);
    const worst = seriesMeans.reduce((a, b) => b.mean < a.mean ? b : a);
    return {
      key: s.key,
      label: `${s.className} · ${s.subjectName}`,
      color: s.color,
      latestMean,
      trend,
      trendDelta: delta,
      bestAssessment: best.label,
      worstAssessment: worst.label,
      assessmentCount: seriesMeans.length,
    } satisfies TrendSeries;
  }).filter(Boolean) as TrendSeries[];

  return { points, series };
}

async function fetchGradeDistribution(
  teacherClasses: TeacherClass[],
  candidateYears: number[]
): Promise<TermGradeDistribution[]> {
  const classPairs = teacherClasses.map((tc) => ({
    class_id: tc.class_id,
    subject_id: tc.subject_id,
  }));
  const classIds = classPairs.map((p) => p.class_id);

  const { data: assessments, error: assessError } = await supabase
    .from("assessments")
    .select("id, term, class_id")
    .in("class_id", classIds)
    .eq("category", "summative")
    .in("year", candidateYears)
    .order("created_at", { ascending: false })
    .limit(30);

  if (assessError || !assessments?.length) return [];

  const assessmentIds = assessments.map((a) => a.id);

  const { data: results, error: resultsError } = await supabase
    .from("assessment_results")
    .select("assessment_id, score, subject_id")
    .in("assessment_id", assessmentIds)
    .eq("status", "published");

  if (resultsError || !results) return [];

  const validResults = results.filter((r) => {
    const assessment = assessments.find((a) => a.id === r.assessment_id);
    if (!assessment) return false;
    return classPairs.some(
      (p) => p.class_id === assessment.class_id && p.subject_id === r.subject_id
    );
  });

  const scoresByTerm = new Map<number, number[]>();
  for (const assessment of assessments) {
    const termNum = assessment.term as number;
    if (!termNum) continue;
    const termScores = validResults
      .filter((r) => r.assessment_id === assessment.id)
      .map((r) => Number(r.score))
      .filter((s) => Number.isFinite(s));
    if (!scoresByTerm.has(termNum)) scoresByTerm.set(termNum, []);
    scoresByTerm.get(termNum)!.push(...termScores);
  }

  return Array.from(scoresByTerm.entries())
    .filter(([, scores]) => scores.length > 0)
    .sort(([a], [b]) => a - b)
    .map(([term, scores]) => ({
      term,
      data: KJSEA_LEVELS.map((level) => ({
        grade: level.label,
        count: scores.filter((s) => s >= level.min && s <= level.max).length,
        color: level.color,
      })),
    }));
}

async function fetchTimetables(
  teacherClasses: TeacherClass[],
  academicYear: string,
  term: number
): Promise<ClassTimetableEntry[]> {
  const classIds = [...new Set(teacherClasses.map((tc) => tc.class_id))];
  const { data, error } = await supabase
    .from("class_timetables")
    .select("id, class_id, term, academic_year, timetable_data, classes(name)")
    .in("class_id", classIds)
    .eq("term", term)
    .eq("academic_year", academicYear);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id:             row.id,
    class_id:       row.class_id,
    term:           row.term,
    academic_year:  row.academic_year,
    timetable_data: row.timetable_data,
    className:      Array.isArray(row.classes)
      ? row.classes[0]?.name
      : row.classes?.name ?? "Unknown Class",
  }));
}

// ---------- Main Component ----------
interface TeacherDashboardProps {
  handleLogout: () => void;
}

export default function TeacherDashboard({ handleLogout }: TeacherDashboardProps) {

  // ── Core queries — profile and term load first, everything else is gated on them ──

  const {
    data: profile,
    isLoading: loadingProfile,
    error: profileError,
  } = useQuery({
    queryKey:  ["teacherProfile"],
    queryFn:   fetchTeacherProfile,
    staleTime: 1000 * 60 * 10, // 10 min — profile changes rarely
    retry: 1,
  });

  const {
    data: activeTerm,
    isLoading: loadingTerm,
  } = useQuery({
    queryKey:  ["activeTerm"],
    queryFn:   fetchActiveTerm,
    staleTime: 1000 * 60 * 10, // 10 min — term changes rarely mid-session
  });

  const currentAcademicYear = activeTerm?.academic_year ?? null;
  const currentTerm         = activeTerm?.term ?? null;

  // Stable reference — only recomputed when academic year string changes
  const candidateYears = useMemo(
    () => (currentAcademicYear ? academicYearToCandidateYears(currentAcademicYear) : null),
    [currentAcademicYear]
  );

  const {
    data: teacherClasses = [],
    isLoading: loadingClasses,
  } = useQuery({
    queryKey:  ["teacherClasses", profile?.id, currentAcademicYear],
    queryFn:   () => fetchTeacherClasses(profile!.id, currentAcademicYear!),
    enabled:   !!profile?.id && !!currentAcademicYear,
    staleTime: 1000 * 60 * 10, // 10 min
  });

  // ── Dependent queries — all gated on teacherClasses being loaded ──

  const { data: students = [] } = useQuery({
    queryKey:  ["teacherStudents", teacherClasses.map((tc) => tc.class_id)],
    queryFn:   () => fetchStudents(teacherClasses),
    enabled:   teacherClasses.length > 0,
    staleTime: 1000 * 60 * 10, // 10 min — enrolment changes infrequently
  });

  const { data: classPerformanceData = [] } = useQuery({
    queryKey:  ["classPerformance", teacherClasses.map((tc) => tc.class_id), candidateYears],
    queryFn:   () => fetchClassPerformance(teacherClasses, candidateYears!),
    enabled:   teacherClasses.length > 0 && !!candidateYears,
    staleTime: 1000 * 60 * 5, // 5 min — scores updated by teachers regularly
  });

  const { data: trendData, isLoading: loadingTrend } = useQuery({
    queryKey:  ["classTrend", teacherClasses.map((tc) => tc.class_id), candidateYears],
    queryFn:   () => fetchClassTrend(teacherClasses, candidateYears!),
    enabled:   teacherClasses.length > 0 && !!candidateYears,
    staleTime: 1000 * 60 * 5, // 5 min
  });
  const trendPoints = trendData?.points ?? [];
  const trendSeries = trendData?.series ?? [];

  const { data: termGradeDistributions = [] } = useQuery({
    queryKey:  ["gradeDistribution", teacherClasses.map((tc) => tc.class_id), candidateYears, currentTerm],
    queryFn:   () => fetchGradeDistribution(teacherClasses, candidateYears!),
    enabled:   teacherClasses.length > 0 && !!candidateYears && !!currentTerm,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const { data: timetables = [], isLoading: loadingTimetables } = useQuery({
    queryKey:  ["timetables", teacherClasses.map((tc) => tc.class_id), currentAcademicYear, currentTerm],
    queryFn:   () => fetchTimetables(teacherClasses, currentAcademicYear!, currentTerm!),
    enabled:   teacherClasses.length > 0 && !!currentAcademicYear && !!currentTerm,
    staleTime: 1000 * 60 * 10, // 10 min — timetables rarely change mid-term
  });

  // ── UI state (unchanged) ──
  const [activeTab, setActiveTab]         = useState<"overview" | "assignments" | "students" | "marks">("overview");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gradeView, setGradeView]         = useState<"current" | "all">("current");
  const [perfView, setPerfView]           = useState<"trend" | "recent">("trend");
  const [showTimetables, setShowTimetables] = useState(false);
  const [viewerOpen, setViewerOpen]       = useState(false);
  const [selectedTimetable, setSelectedTimetable] = useState<{
    className: string; term: number; academicYear: string; data: any;
  } | null>(null);

  const currentAssessmentYear = candidateYears ? candidateYears[0] : null;

  const refreshProfile = async () => {
    if (!profile?.id) return;
    try {
      await supabase.from("teachers").select("id, first_name, last_name, email, phone, teacher_code, is_admin").eq("id", profile.id).single();
      window.location.reload();
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  // ── Loading / error gates (identical behaviour to before) ──
  if (loadingProfile || loadingTerm) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7a1f2b] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile || profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 text-sm sm:text-base px-4">
        {profileError instanceof Error ? profileError.message : "Teacher profile not found"}
      </div>
    );
  }

  // ── All JSX below is byte-for-byte identical to the original ──
  return (
    <div className="min-h-screen bg-background touch-manipulation pb-16 sm:pb-0">
      <Navbar showLogout={true} handleLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {activeTab === "overview" ? (
          <div className="space-y-4 sm:space-y-6">

            {!activeTerm && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                No active academic term is set. Contact your administrator to activate a term in Academic Calendar settings.
              </div>
            )}

            <div className="relative bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 sm:p-6">
              <div className="pr-8">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">
                  Welcome, {profile.first_name} {profile.last_name}!
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Teacher Code: {profile.teacher_code}
                  {activeTerm && (
                    <span className="ml-3 text-primary font-medium">
                      · Term {activeTerm.term}, {activeTerm.academic_year}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/10 transition-colors"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Card and Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card className="lg:col-span-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold mb-2">{profile.first_name} {profile.last_name}</h3>
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

              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
                    <div className="text-xl sm:text-2xl font-bold">{students.length}</div>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                    <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2" />
                    <div className="text-xl sm:text-2xl font-bold">{teacherClasses.length}</div>
                    <p className="text-xs text-muted-foreground">Classes</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center text-center h-full">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary mb-1.5" />
                    {classPerformanceData.length > 0 ? (
                      <div className="w-full space-y-1">
                        {classPerformanceData.slice(0, 3).map((d, i) => (
                          <div key={i} className="bg-primary/5 rounded px-1 py-0.5">
                            <div className="text-sm sm:text-base font-bold leading-tight">{d.mean}%</div>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate leading-tight" title={d.assessment}>
                              {d.assessment}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="text-xl sm:text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">No data yet</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Timetable Section */}
            <div className="space-y-2">
              <Button onClick={() => setShowTimetables(!showTimetables)} variant="outline" className="w-full sm:w-auto">
                <Calendar className="mr-2 h-4 w-4" />
                {showTimetables ? "Hide Timetables" : "View Timetables"}
              </Button>

              {showTimetables && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Your Class Timetables
                      {activeTerm && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          — Term {activeTerm.term}, {activeTerm.academic_year}
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your assigned periods are highlighted in <span className="font-semibold text-[#9a3412]">maroon</span>
                    </p>
                  </CardHeader>
                  <CardContent>
                    {loadingTimetables ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : timetables.length > 0 ? (
                      <div className="space-y-2">
                        {timetables.map((tt) => (
                          <div key={tt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div>
                              <p className="font-medium text-sm">{tt.className}</p>
                              <p className="text-xs text-muted-foreground">
                                Term {tt.term} · {tt.academic_year}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTimetable({
                                  className:    tt.className,
                                  term:         tt.term,
                                  academicYear: tt.academic_year,
                                  data:         tt.timetable_data,
                                });
                                setViewerOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm">
                          {activeTerm
                            ? `No timetables available for Term ${activeTerm.term} yet. Ask your admin to build them.`
                            : "No active term set."}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* KJSEA Grade Distribution */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  KJSEA Grade Distribution
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {currentAcademicYear
                    ? `Kenyan Achievement Levels — ${currentAcademicYear} (published results only)`
                    : "Kenyan Achievement Levels across all assessments"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {termGradeDistributions.length > 0 ? (() => {
                  const displayTerm = (() => {
                    if (currentTerm && termGradeDistributions.some((t) => t.term === currentTerm)) return currentTerm;
                    return termGradeDistributions[termGradeDistributions.length - 1].term;
                  })();
                  const visibleTerms = gradeView === "current"
                    ? termGradeDistributions.filter((t) => t.term === displayTerm)
                    : termGradeDistributions;

                  return (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => setGradeView("current")}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            gradeView === "current"
                              ? "bg-[#9a3412] text-white"
                              : "border border-[#9a3412] text-[#9a3412] hover:bg-[#9a3412]/10"
                          }`}
                        >
                          Term {displayTerm}
                        </button>
                        <button
                          onClick={() => setGradeView("all")}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            gradeView === "all"
                              ? "bg-[#9a3412] text-white"
                              : "border border-[#9a3412] text-[#9a3412] hover:bg-[#9a3412]/10"
                          }`}
                        >
                          All Terms
                        </button>
                      </div>

                      <div className={
                        gradeView === "all"
                          ? `flex flex-col gap-4 sm:grid sm:gap-6 ${
                              visibleTerms.length === 1 ? "sm:grid-cols-1" :
                              visibleTerms.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
                            }`
                          : `grid gap-6 ${
                              visibleTerms.length === 1 ? "grid-cols-1" :
                              visibleTerms.length === 2 ? "grid-cols-2" : "grid-cols-3"
                            }`
                      }>
                        {visibleTerms.map((tgd) => (
                          <div key={tgd.term} className="flex flex-col items-center">
                            {gradeView === "all" && (
                              <p className="text-sm font-semibold mb-1" style={{ color: "#9a3412" }}>Term {tgd.term}</p>
                            )}
                            <div className={`w-full ${
                              gradeView === "all"
                                ? "h-[180px] sm:h-[240px] md:h-[280px]"
                                : "h-[240px] sm:h-[280px]"
                            }`}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={tgd.data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={gradeView === "all" ? 22 : 50}
                                    outerRadius={gradeView === "all" ? 55 : 100}
                                    paddingAngle={2}
                                    dataKey="count"
                                  >
                                    {tgd.data.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    formatter={(value, name) => [value, String(name).replace(/ \(L\d+\)/, "")]}
                                    contentStyle={{ fontSize: "11px" }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 mt-2 border-t w-full pt-2">
                              {tgd.data.filter((e) => e.count > 0).map((entry, index) => (
                                <div key={index} className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap">
                                    {entry.grade.replace(/ \(L\d+\)/, "")}: <span className="font-semibold text-foreground">{entry.count}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })() : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                    {currentAcademicYear
                      ? `No published grade data for ${currentAcademicYear} yet`
                      : "No grade data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Class Performance Trend */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {perfView === "trend" ? "Class Performance Trend" : "Recent Assessments (Last 3)"}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-0.5">
                      {perfView === "trend"
                        ? currentAcademicYear
                          ? `Mean scores per assessment, grouped by term — ${currentAcademicYear}`
                          : "Mean scores per assessment, grouped by term"
                        : currentAcademicYear
                          ? `Mean scores of the 3 most recent exams — ${currentAcademicYear}`
                          : "Mean scores of the 3 most recent exams across your classes"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => setPerfView("trend")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        perfView === "trend"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Trend
                    </button>
                    <button
                      onClick={() => setPerfView("recent")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        perfView === "recent"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Recent
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6 pt-0">
                {perfView === "trend" ? (
                  loadingTrend ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      Loading trend data…
                    </div>
                  ) : trendPoints.length > 0 && trendSeries.length > 0 ? (
                    <>
                      <div className="w-full overflow-x-auto">
                        <div style={{ minWidth: Math.max(trendPoints.length * 90, 320), height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendPoints} margin={{ top: 10, right: 16, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={9}
                                angle={-40}
                                textAnchor="end"
                                interval={0}
                                tick={{ fontSize: 9 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                domain={[0, 100]}
                                fontSize={10}
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  padding: "8px",
                                }}
                                formatter={(value: number, key: string) => {
                                  const s = trendSeries.find((x) => x.key === key);
                                  return [`${value}%`, s?.label ?? key];
                                }}
                              />
                              {trendSeries.map((s) => (
                                <Line
                                  key={s.key}
                                  type="monotone"
                                  dataKey={s.key}
                                  stroke={s.color}
                                  strokeWidth={2}
                                  dot={{ fill: s.color, r: 4, strokeWidth: 0 }}
                                  activeDot={{ r: 6 }}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 mb-4 px-1">
                        {trendSeries.map((s) => (
                          <div key={s.key} className="flex items-center gap-1.5">
                            <span className="inline-block w-5 h-0.5 rounded-full" style={{ backgroundColor: s.color, minWidth: 20 }} />
                            <span className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                        {trendSeries.map((s) => {
                          const trendIcon =
                            s.trend === "improving" ? "↑" :
                            s.trend === "declining" ? "↓" :
                            s.trend === "stable"    ? "→" : "—";
                          const trendColor =
                            s.trend === "improving" ? "text-green-600" :
                            s.trend === "declining" ? "text-red-500" :
                            s.trend === "stable"    ? "text-blue-500" : "text-muted-foreground";
                          return (
                            <div
                              key={s.key}
                              className="rounded-lg border p-3 text-xs space-y-1"
                              style={{ borderLeftWidth: 3, borderLeftColor: s.color }}
                            >
                              <p className="font-semibold text-sm truncate">{s.label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Latest mean:</span>
                                <span className="font-bold">{s.latestMean !== null ? `${s.latestMean}%` : "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Trend:</span>
                                <span className={`font-semibold ${trendColor}`}>
                                  {trendIcon} {s.trend === "insufficient" ? "Not enough data" : `${s.trendDelta > 0 ? "+" : ""}${s.trendDelta} pts`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Assessments:</span>
                                <span>{s.assessmentCount}</span>
                              </div>
                              <div className="text-muted-foreground truncate" title={`Best: ${s.bestAssessment}`}>
                                Best: <span className="text-foreground">{s.bestAssessment}</span>
                              </div>
                              <div className="text-muted-foreground truncate" title={`Weakest: ${s.worstAssessment}`}>
                                Weakest: <span className="text-foreground">{s.worstAssessment}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      {currentAcademicYear
                        ? `No published assessment data for ${currentAcademicYear} yet`
                        : "No assessment data available"}
                    </div>
                  )
                ) : (
                  classPerformanceData.length > 0 ? (
                    <div className="w-full h-[250px] sm:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classPerformanceData} margin={{ top: 10, right: 16, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="assessment" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="mean" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                      {currentAcademicYear
                        ? `No assessments found for ${currentAcademicYear}`
                        : "No recent assessments found"}
                    </div>
                  )
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
                    <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Assignments & Announcements</h3>
                  <p className="text-sm text-muted-foreground">Manage assignments and send announcements</p>
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
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98] touch-manipulation h-full"
                onClick={() => setActiveTab("marks")}
              >
                <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Enter Marks</h3>
                  <p className="text-sm text-muted-foreground">Submit assessment results for your subjects</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("overview")}
              className="flex items-center gap-2 mb-4"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Overview
            </Button>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {activeTab === "assignments"
                    ? "Assignments & Announcements"
                    : activeTab === "students"
                    ? "View Students"
                    : "Enter Marks"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "assignments"
                    ? "Manage assignments and send announcements to your classes"
                    : activeTab === "students"
                    ? "View and manage student information and performance"
                    : "Enter marks for your subjects per assessment"}
                </p>
                {activeTerm && (
                  <p className="text-xs text-primary font-medium mt-1">
                    Term {activeTerm.term} · {activeTerm.academic_year}
                  </p>
                )}
              </div>
            </div>

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
                academicYear={currentAcademicYear ?? undefined}
                assessmentYear={currentAssessmentYear ?? undefined}
              />
            )}
            {activeTab === "marks" && (
              <TeacherMarksEntry
                teacherId={profile.id}
                teacherClasses={teacherClasses}
                academicYear={currentAcademicYear ?? undefined}
                assessmentYear={currentAssessmentYear ?? undefined}
                currentTerm={activeTerm?.term ?? undefined}
              />
            )}
          </div>
        )}
      </div>

      <SettingsModal
        profile={profile}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProfileUpdate={refreshProfile}
      />

      <ClassTimetableViewer
        isOpen={viewerOpen}
        onClose={() => { setViewerOpen(false); setSelectedTimetable(null); }}
        timetable={selectedTimetable}
        teacherId={profile.id}
      />

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border sm:hidden z-50">
        <div className="flex justify-around items-center h-16">
          {(["overview", "assignments", "students", "marks"] as const).map((tab) => {
            const Icon =
              tab === "overview"     ? TrendingUp :
              tab === "assignments"  ? FileText :
              tab === "students"     ? Users : FileText;
            const label =
              tab === "overview"    ? "Overview" :
              tab === "assignments" ? "Assignments" :
              tab === "students"    ? "Students" : "Marks";
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center justify-center flex-1 h-full ${
                  activeTab === tab
                    ? "text-primary border-t-2 border-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}