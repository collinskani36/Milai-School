import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import {
  User, Settings, BookOpen, Users, TrendingUp, FileText, Mail, Phone,
  Target, Calendar, ChevronLeft, ChevronRight, GraduationCap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import ClassPerformance from "./ClassPerformance";
import SettingsModal from "./SettingsModal";
import TeacherAssignmentsAnnouncements from "./teacher_assignments_announcements";
import ViewStudents from "./view_students";
import TeacherMarksEntry from "./TeacherMarksEntry";
import ClassTimetableViewer from "./ClassTimetableViewer";
import KJSEAGradeDistribution from "./KJSEAGradeDistribution";

// ---------- Types (UNCHANGED) ----------
interface Teacher {
  id: string; auth_id: string; teacher_code: string;
  first_name: string; last_name: string;
  email: string; phone: string; created_at: string; is_admin: boolean;
}
interface TeacherClass {
  id: string; teacher_id: string; class_id: string; subject_id: string;
  academic_year: string; created_at: string;
  classes?: { id: string; name: string; grade_level: string; created_at: string } |
            { id: string; name: string; grade_level: string; created_at: string }[];
  subjects?: { id: string; name: string; code: string; created_at: string } |
             { id: string; name: string; code: string; created_at: string }[];
}
interface AcademicTerm {
  id: string; academic_year: string; term: number;
  start_date: string; end_date: string; is_current: boolean;
}
interface GradeDistribution { grade: string; count: number; color: string; }
interface TermGradeDistribution { term: number; data: GradeDistribution[]; }
interface ClassPerformanceData { assessment: string; mean: number; }
interface TrendPoint { label: string; term: number; assessmentDate: string; [seriesKey: string]: number | string; }
interface TrendSeries {
  key: string; label: string; color: string; latestMean: number | null;
  trend: "improving" | "declining" | "stable" | "insufficient";
  trendDelta: number; bestAssessment: string; worstAssessment: string; assessmentCount: number;
}
interface ClassTimetableEntry {
  id: string; class_id: string; term: number; academic_year: string;
  timetable_data: any; className: string;
}

// ---------- Design tokens ----------
const MAROON = "#7a1f2b";
const MAROON_GRADIENT = "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";
const CARD_SHADOW_HOVER = "0 10px 40px -18px rgba(122,31,43,0.35)";
const HERO_SHADOW = "0 18px 40px -22px rgba(122,31,43,0.45)";

// ---------- KJSEA Levels ----------
const KJSEA_LEVELS = [
  { label: "EE1 (L8)", min: 90, max: 100, color: "#10B981" },
  { label: "EE2 (L7)", min: 75, max: 89,  color: "#22C55E" },
  { label: "ME1 (L6)", min: 58, max: 74,  color: "#3B82F6" },
  { label: "ME2 (L5)", min: 41, max: 57,  color: "#8B5CF6" },
  { label: "AE1 (L4)", min: 31, max: 40,  color: "#F59E0B" },
  { label: "AE2 (L3)", min: 21, max: 30,  color: "#F97316" },
  { label: "BE1 (L2)", min: 11, max: 20,  color: "#EF4444" },
  { label: "BE2 (L1)", min: 0,  max: 10,  color: "#6B7280" },
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

// ---------- Fetch helpers (ALL IDENTICAL) ----------
async function fetchTeacherProfile(): Promise<Teacher> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error(userError?.message || "No user found");
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers").select("*").eq("auth_id", user.id).single();
  if (teacherError) throw new Error(teacherError.message);
  return teacher;
}
async function fetchActiveTerm(): Promise<AcademicTerm | null> {
  const { data, error } = await supabase
    .from("academic_calendar").select("*").eq("is_current", true).single();
  if (error) return null;
  return data as AcademicTerm;
}
async function fetchTeacherClasses(teacherId: string, academicYear: string): Promise<TeacherClass[]> {
  const { data, error } = await supabase
    .from("teacher_classes")
    .select(`
      id, teacher_id, class_id, subject_id, academic_year, created_at,
      classes ( id, name, grade_level, created_at ),
      subjects ( id, name, code, created_at )
    `)
    .eq("teacher_id", teacherId).eq("academic_year", academicYear);
  if (error) throw error;
  return data || [];
}
async function fetchStudents(teacherClasses: TeacherClass[]): Promise<{ id: string }[]> {
  const classIds = teacherClasses.map((tc) => tc.class_id);
  const { data, error } = await supabase
    .from("enrollments").select("student_id, students ( id )").in("class_id", classIds);
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
  teacherClasses: TeacherClass[], candidateYears: number[]
): Promise<ClassPerformanceData[]> {
  const classPairs = teacherClasses.map((tc) => ({ class_id: tc.class_id, subject_id: tc.subject_id }));
  const classIds = classPairs.map((p) => p.class_id);
  const { data: assessments, error: assessError } = await supabase
    .from("assessments")
    .select("id, title, class_id, created_at, assessment_date, term")
    .in("class_id", classIds).eq("category", "summative")
    .in("year", candidateYears)
    .order("assessment_date", { ascending: false }).limit(10);
  if (assessError || !assessments?.length) return [];
  const assessmentIds = assessments.map((a) => a.id);
  const { data: publishedResults, error: prError } = await supabase
    .from("assessment_results")
    .select("assessment_id, score, subject_id")
    .in("assessment_id", assessmentIds).eq("status", "published");
  if (prError || !publishedResults?.length) return [];
  const validResults = publishedResults.filter((r) => {
    const assessment = assessments.find((a) => a.id === r.assessment_id);
    if (!assessment) return false;
    return classPairs.some((p) => p.class_id === assessment.class_id && p.subject_id === r.subject_id);
  });
  if (!validResults.length) return [];
  const assessmentsWithResults = assessments
    .filter((a) => validResults.some((r) => r.assessment_id === a.id)).slice(0, 3);
  return assessmentsWithResults.map((assessment) => {
    const scores = validResults.filter((r) => r.assessment_id === assessment.id)
      .map((r) => Number(r.score)).filter((s) => !isNaN(s));
    if (scores.length === 0) return null;
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const cls = teacherClasses.find((tc) => tc.class_id === assessment.class_id);
    const className = firstRel(cls?.classes)?.name ?? "";
    const termLabel = assessment.term ? `T${assessment.term}` : "";
    const label = className
      ? `${assessment.title} (${className}${termLabel ? ` · ${termLabel}` : ""})`
      : termLabel ? `${assessment.title} · ${termLabel}` : assessment.title;
    return { assessment: label, mean: Number(mean.toFixed(2)) };
  }).filter(Boolean) as ClassPerformanceData[];
}
async function fetchClassTrend(
  teacherClasses: TeacherClass[], candidateYears: number[]
): Promise<{ points: TrendPoint[]; series: TrendSeries[] }> {
  const classPairs = teacherClasses.map((tc, i) => ({
    class_id: tc.class_id, subject_id: tc.subject_id,
    className: firstRel(tc.classes)?.name ?? tc.class_id,
    subjectName: firstRel(tc.subjects)?.name ?? tc.subject_id,
    key: `s${i}`, color: TREND_COLOURS[i % TREND_COLOURS.length],
  }));
  const classIds = classPairs.map((p) => p.class_id);
  const { data: assessments, error: assessError } = await supabase
    .from("assessments")
    .select("id, title, class_id, term, assessment_date")
    .in("class_id", classIds).eq("category", "summative")
    .in("year", candidateYears)
    .order("term", { ascending: true }).order("assessment_date", { ascending: true });
  if (assessError || !assessments?.length) return { points: [], series: [] };
  const assessmentIds = assessments.map((a) => a.id);
  const { data: results, error: resError } = await supabase
    .from("assessment_results").select("assessment_id, score, subject_id")
    .in("assessment_id", assessmentIds).eq("status", "published");
  if (resError || !results?.length) return { points: [], series: [] };
  const validResults = results.filter((r) => {
    const a = assessments.find((x) => x.id === r.assessment_id);
    if (!a) return false;
    return classPairs.some((p) => p.class_id === a.class_id && p.subject_id === r.subject_id);
  });
  const assessmentsWithData = assessments.filter((a) =>
    validResults.some((r) => r.assessment_id === a.id));
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
        .map((r) => Number(r.score)).filter((n) => Number.isFinite(n));
      if (scores.length > 0) {
        const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        point[s.key] = Number(mean.toFixed(1));
      }
    }
  }
  const points = Array.from(pointMap.values());
  const series: TrendSeries[] = classPairs.map((s) => {
    const seriesMeans = points.filter((p) => p[s.key] !== undefined)
      .map((p) => ({ label: p.label, mean: p[s.key] as number }));
    if (seriesMeans.length === 0) return null;
    const latestMean   = seriesMeans[seriesMeans.length - 1]?.mean ?? null;
    const previousMean = seriesMeans[seriesMeans.length - 2]?.mean ?? null;
    const delta = (latestMean !== null && previousMean !== null)
      ? Number((latestMean - previousMean).toFixed(1)) : 0;
    let trend: TrendSeries["trend"] = "insufficient";
    if (seriesMeans.length >= 2) {
      if (delta > 3) trend = "improving";
      else if (delta < -3) trend = "declining";
      else trend = "stable";
    }
    const best  = seriesMeans.reduce((a, b) => b.mean > a.mean ? b : a);
    const worst = seriesMeans.reduce((a, b) => b.mean < a.mean ? b : a);
    return {
      key: s.key, label: `${s.className} · ${s.subjectName}`, color: s.color,
      latestMean, trend, trendDelta: delta,
      bestAssessment: best.label, worstAssessment: worst.label,
      assessmentCount: seriesMeans.length,
    } satisfies TrendSeries;
  }).filter(Boolean) as TrendSeries[];
  return { points, series };
}
async function fetchGradeDistribution(
  teacherClasses: TeacherClass[], candidateYears: number[]
): Promise<TermGradeDistribution[]> {
  const classPairs = teacherClasses.map((tc) => ({ class_id: tc.class_id, subject_id: tc.subject_id }));
  const classIds = classPairs.map((p) => p.class_id);
  const { data: assessments, error: assessError } = await supabase
    .from("assessments").select("id, term, class_id")
    .in("class_id", classIds).eq("category", "summative")
    .in("year", candidateYears)
    .order("created_at", { ascending: false }).limit(30);
  if (assessError || !assessments?.length) return [];
  const assessmentIds = assessments.map((a) => a.id);
  const { data: results, error: resultsError } = await supabase
    .from("assessment_results").select("assessment_id, score, subject_id")
    .in("assessment_id", assessmentIds).eq("status", "published");
  if (resultsError || !results) return [];
  const validResults = results.filter((r) => {
    const assessment = assessments.find((a) => a.id === r.assessment_id);
    if (!assessment) return false;
    return classPairs.some((p) => p.class_id === assessment.class_id && p.subject_id === r.subject_id);
  });
  const scoresByTerm = new Map<number, number[]>();
  for (const assessment of assessments) {
    const termNum = assessment.term as number;
    if (!termNum) continue;
    const termScores = validResults.filter((r) => r.assessment_id === assessment.id)
      .map((r) => Number(r.score)).filter((s) => Number.isFinite(s));
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
  teacherClasses: TeacherClass[], academicYear: string, term: number
): Promise<ClassTimetableEntry[]> {
  const classIds = [...new Set(teacherClasses.map((tc) => tc.class_id))];
  const { data, error } = await supabase
    .from("class_timetables")
    .select("id, class_id, term, academic_year, timetable_data, classes(name)")
    .in("class_id", classIds).eq("term", term).eq("academic_year", academicYear);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id, class_id: row.class_id, term: row.term,
    academic_year: row.academic_year, timetable_data: row.timetable_data,
    className: Array.isArray(row.classes) ? row.classes[0]?.name : row.classes?.name ?? "Unknown Class",
  }));
}

// ---------- Shared small components ----------
function SectionHeader({
  icon: Icon, microLabel, title, description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; description?: string;
}) {
  return (
    <div className="relative overflow-hidden px-4 sm:px-5 py-3.5" style={{ background: MAROON_GRADIENT }}>
      <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }} />
      <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }} />
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">{microLabel}</p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{title}</h3>
          {description && <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
    </div>
  );
}

function BackToOverview({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1.5 mb-2 sm:mb-3 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-[#7a1f2b] hover:bg-[#7a1f2b]/5 border border-[#7a1f2b]/15 transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      Back to Overview
    </button>
  );
}

function SubViewTitle({ microLabel, title, description }: { microLabel: string; title: string; description: string }) {
  return (
    <div className="mb-3 sm:mb-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a1f2b]/60 font-semibold mb-0.5">{microLabel}</p>
      <h1 className="text-lg sm:text-3xl font-bold text-[#3a1b1f] leading-tight">{title}</h1>
      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, description, onClick, className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description: string; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left w-full h-full rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${className}`}
      style={{ boxShadow: CARD_SHADOW }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
    >
      <div className="h-full p-3.5 sm:p-4 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: MAROON_GRADIENT, boxShadow: "0 8px 18px -10px rgba(122,31,43,0.5)" }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#3a1b1f] leading-tight truncate">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-[#7a1f2b]/40 group-hover:text-[#7a1f2b] transition-colors shrink-0" />
      </div>
    </button>
  );
}

// ---------- Main Component ----------
type ActiveTab =
  | "overview" | "assignments" | "students" | "marks"
  | "timetables" | "performance" | "kjsea";

interface TeacherDashboardProps { handleLogout: () => void; }

export default function TeacherDashboard({ handleLogout }: TeacherDashboardProps) {

  const { data: profile, isLoading: loadingProfile, error: profileError } = useQuery({
    queryKey: ["teacherProfile"], queryFn: fetchTeacherProfile,
    staleTime: 1000 * 60 * 10, retry: 1,
  });
  const { data: activeTerm, isLoading: loadingTerm } = useQuery({
    queryKey: ["activeTerm"], queryFn: fetchActiveTerm, staleTime: 1000 * 60 * 10,
  });
  const currentAcademicYear = activeTerm?.academic_year ?? null;
  const currentTerm         = activeTerm?.term ?? null;

  const candidateYears = useMemo(
    () => (currentAcademicYear ? academicYearToCandidateYears(currentAcademicYear) : null),
    [currentAcademicYear]
  );

  const { data: teacherClasses = [] } = useQuery({
    queryKey: ["teacherClasses", profile?.id, currentAcademicYear],
    queryFn: () => fetchTeacherClasses(profile!.id, currentAcademicYear!),
    enabled: !!profile?.id && !!currentAcademicYear,
    staleTime: 1000 * 60 * 10,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["teacherStudents", teacherClasses.map((tc) => tc.class_id)],
    queryFn: () => fetchStudents(teacherClasses),
    enabled: teacherClasses.length > 0, staleTime: 1000 * 60 * 10,
  });

  const { data: classPerformanceData = [] } = useQuery({
    queryKey: ["classPerformance", teacherClasses.map((tc) => tc.class_id), candidateYears],
    queryFn: () => fetchClassPerformance(teacherClasses, candidateYears!),
    enabled: teacherClasses.length > 0 && !!candidateYears, staleTime: 1000 * 60 * 5,
  });

  const { data: trendData, isLoading: loadingTrend } = useQuery({
    queryKey: ["classTrend", teacherClasses.map((tc) => tc.class_id), candidateYears],
    queryFn: () => fetchClassTrend(teacherClasses, candidateYears!),
    enabled: teacherClasses.length > 0 && !!candidateYears, staleTime: 1000 * 60 * 5,
  });
  const trendPoints = trendData?.points ?? [];
  const trendSeries = trendData?.series ?? [];

  const { data: termGradeDistributions = [] } = useQuery({
    queryKey: ["gradeDistribution", teacherClasses.map((tc) => tc.class_id), candidateYears, currentTerm],
    queryFn: () => fetchGradeDistribution(teacherClasses, candidateYears!),
    enabled: teacherClasses.length > 0 && !!candidateYears && !!currentTerm,
    staleTime: 1000 * 60 * 5,
  });

  const { data: timetables = [], isLoading: loadingTimetables } = useQuery({
    queryKey: ["timetables", teacherClasses.map((tc) => tc.class_id), currentAcademicYear, currentTerm],
    queryFn: () => fetchTimetables(teacherClasses, currentAcademicYear!, currentTerm!),
    enabled: teacherClasses.length > 0 && !!currentAcademicYear && !!currentTerm,
    staleTime: 1000 * 60 * 10,
  });

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [perfView, setPerfView] = useState<"trend" | "recent">("trend");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedTimetable, setSelectedTimetable] = useState<{
    className: string; term: number; academicYear: string; data: any;
  } | null>(null);

  const currentAssessmentYear = candidateYears ? candidateYears[0] : null;

  const refreshProfile = async () => {
    if (!profile?.id) return;
    try {
      await supabase.from("teachers")
        .select("id, first_name, last_name, email, phone, teacher_code, is_admin")
        .eq("id", profile.id).single();
      window.location.reload();
    } catch (err) { console.error("Error refreshing profile:", err); }
  };

  if (loadingProfile || loadingTerm) {
    return (
      <div className="min-h-[100dvh] bg-[#fdfbfb] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 mx-auto border-2"
            style={{ borderColor: "rgba(122,31,43,0.15)", borderBottomColor: MAROON }} />
          <p className="mt-3 text-sm text-[#6b4b50] font-medium">Loading portal…</p>
        </div>
      </div>
    );
  }
  if (!profile || profileError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#fdfbfb] px-4">
        <div className="max-w-md text-center bg-white rounded-2xl border border-[#7a1f2b]/10 p-6"
          style={{ boxShadow: CARD_SHADOW }}>
          <p className="text-[#7a1f2b] font-semibold text-sm">
            {profileError instanceof Error ? profileError.message : "Teacher profile not found"}
          </p>
        </div>
      </div>
    );
  }

  const overviewFamily: ActiveTab[] = ["overview", "timetables", "performance", "kjsea"];
  const isOverviewFamily = overviewFamily.includes(activeTab);
  const isOverview = activeTab === "overview";
  const isPerformance = activeTab === "performance";
  const isKjsea = activeTab === "kjsea";
  // Performance + KJSEA use full-height (no page scroll) layout
  const noScrollTab = isOverview || isPerformance || isKjsea;

  return (
    <div className="h-[100dvh] sm:h-screen bg-[#fdfbfb] flex flex-col overflow-hidden">

      {/* ── MOBILE HEADER ── */}
      <header className="sm:hidden shrink-0 z-40"
        style={{ background: MAROON_GRADIENT, paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 py-2 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-4 w-4 text-white shrink-0" />
            <span className="text-white font-semibold text-[13px] whitespace-nowrap tracking-tight">
              Milai School Portal
            </span>
          </div>
          <button onClick={handleLogout} className="text-white/90 hover:text-white text-[13px] font-medium shrink-0">
            Logout
          </button>
        </div>
      </header>

      {/* ── DESKTOP HEADER ── */}
      <header className="hidden sm:block shrink-0 z-40" style={{ background: MAROON_GRADIENT }}>
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-[13px] leading-tight">Milai School Portal</p>
              <p className="text-white/60 text-[10px] leading-tight">Teacher Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/80 text-[13px]">
              {profile.first_name} {profile.last_name}
            </span>
            <button onClick={handleLogout}
              className="text-white/90 hover:text-white text-[13px] font-medium transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className={`flex-1 min-h-0 ${noScrollTab ? "overflow-hidden" : "overflow-y-auto"}`}>
        {isOverview ? (
          /* ==================== OVERVIEW ==================== */
          <div className="h-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-5 pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3 sm:gap-4">

            <div className="relative shrink-0 overflow-hidden rounded-2xl p-4 sm:p-5"
              style={{ background: MAROON_GRADIENT, boxShadow: HERO_SHADOW }}>
              <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)" }} />
              <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)" }} />

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors"
                title="Settings"
              >
                <Settings className="h-4 w-4 text-white" />
              </button>

              <div className="relative flex items-start gap-3 sm:gap-4 pr-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-xl font-bold text-white leading-tight truncate">
                    Welcome, {profile.first_name} {profile.last_name}
                  </h1>
                  <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">
                    Code: <span className="text-white/90 font-medium">{profile.teacher_code}</span>
                    {activeTerm ? (
                      <> · Term {activeTerm.term}, {activeTerm.academic_year}</>
                    ) : (
                      <> · <span className="text-white/50 italic">No active term</span></>
                    )}
                  </p>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] sm:text-xs text-white/70">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[170px] sm:max-w-none">{profile.email}</span>
                    </span>
                    {profile.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        {profile.phone}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      Since {new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 grid grid-cols-3 gap-3 sm:gap-4">
              <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
                style={{ boxShadow: CARD_SHADOW }}>
                <CardContent className="p-3 sm:p-4 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: MAROON_GRADIENT }}>
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#3a1b1f] leading-none">
                    {students.length}
                  </div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
                    Students
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
                style={{ boxShadow: CARD_SHADOW }}>
                <CardContent className="p-3 sm:p-4 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: MAROON_GRADIENT }}>
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#3a1b1f] leading-none">
                    {teacherClasses.length}
                  </div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
                    Classes
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
                style={{ boxShadow: CARD_SHADOW }}>
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center text-center h-full">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-[#7a1f2b] mb-1.5" />
                  {classPerformanceData.length > 0 ? (
                    <div className="w-full space-y-1">
                      {classPerformanceData.slice(0, 3).map((d, i) => (
                        <div key={i} className="bg-[#7a1f2b]/5 rounded px-1 py-0.5">
                          <div className="text-sm sm:text-base font-bold leading-tight text-[#3a1b1f]">
                            {d.mean}%
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate leading-tight"
                            title={d.assessment}>
                            {d.assessment}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="text-xl sm:text-2xl font-bold text-[#3a1b1f]">—</div>
                      <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
                        No data
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
              <FeatureCard icon={Calendar} title="Class Timetables"
                description="View your class schedules"
                onClick={() => setActiveTab("timetables")} />
              <FeatureCard icon={TrendingUp} title="Performance Analytics"
                description="Track trends across assessments"
                onClick={() => setActiveTab("performance")} />
              <FeatureCard icon={Target} title="KJSEA Grades"
                description="Grade distribution by term"
                onClick={() => setActiveTab("kjsea")} />
              <FeatureCard className="hidden sm:flex" icon={FileText}
                title="Assignments & Announcements"
                description="Manage assignments and announcements"
                onClick={() => setActiveTab("assignments")} />
              <FeatureCard className="hidden sm:flex" icon={Users}
                title="View Students"
                description="Check student progress and performance"
                onClick={() => setActiveTab("students")} />
              <FeatureCard className="hidden sm:flex" icon={FileText}
                title="Enter Marks"
                description="Submit assessment results"
                onClick={() => setActiveTab("marks")} />
            </div>
          </div>
        ) : isPerformance ? (
          /* ==================== PERFORMANCE (no-scroll) ==================== */
          <div className="h-full max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-6 flex flex-col gap-2 sm:gap-3">
            <div className="shrink-0">
              <BackToOverview onBack={() => setActiveTab("overview")} />
              <SubViewTitle
                microLabel="Insights"
                title="Performance Analytics"
                description={
                  currentAcademicYear
                    ? `Assessment means across your classes — ${currentAcademicYear}`
                    : "Assessment means across your classes"
                }
              />
            </div>
            <div className="flex-1 min-h-0">
              <ClassPerformance
                trendPoints={trendPoints}
                trendSeries={trendSeries}
                loadingTrend={loadingTrend}
                classPerformanceData={classPerformanceData}
                perfView={perfView}
                setPerfView={setPerfView}
                currentAcademicYear={currentAcademicYear}
              />
            </div>
          </div>
        ) : isKjsea ? (
          /* ==================== KJSEA (no-scroll) ==================== */
          <div className="h-full max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-6 flex flex-col gap-2 sm:gap-3">
            <div className="shrink-0">
              <BackToOverview onBack={() => setActiveTab("overview")} />
            </div>
            <div className="flex-1 min-h-0">
              <KJSEAGradeDistribution
                termGradeDistributions={termGradeDistributions}
                currentTerm={currentTerm}
                currentAcademicYear={currentAcademicYear}
              />
            </div>
          </div>
        ) : (
          /* ==================== OTHER SUB-VIEWS (scrollable) ==================== */
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-6">
            <BackToOverview onBack={() => setActiveTab("overview")} />

            {activeTab === "timetables" && (
              <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
                style={{ boxShadow: CARD_SHADOW }}>
                <SectionHeader
                  icon={Calendar}
                  microLabel="Schedule"
                  title="Class Timetables"
                  description={activeTerm ? `Term ${activeTerm.term} · ${activeTerm.academic_year} — assigned periods highlighted in maroon` : undefined}
                />
                <CardContent className="p-4 sm:p-5">
                  {loadingTimetables ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-[#7a1f2b]/5 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : timetables.length > 0 ? (
                    <div className="space-y-2">
                      {timetables.map((tt) => (
                        <div key={tt.id}
                          className="flex items-center justify-between p-3 border border-[#7a1f2b]/10 rounded-xl hover:bg-[#7a1f2b]/5 transition-colors">
                          <div>
                            <p className="font-medium text-sm text-[#3a1b1f]">{tt.className}</p>
                            <p className="text-xs text-muted-foreground">
                              Term {tt.term} · {tt.academic_year}
                            </p>
                          </div>
                          <Button variant="outline" size="sm"
                            className="border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
                            onClick={() => {
                              setSelectedTimetable({
                                className: tt.className,
                                term: tt.term,
                                academicYear: tt.academic_year,
                                data: tt.timetable_data,
                              });
                              setViewerOpen(true);
                            }}>
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-[#7a1f2b]/20 mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">
                        {activeTerm
                          ? `No timetables available for Term ${activeTerm.term} yet. Ask your admin to build them.`
                          : "No active term set."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "assignments" && (
              <>
                <SubViewTitle
                  microLabel="Classroom"
                  title="Assignments & Announcements"
                  description="Manage assignments and send announcements to your classes"
                />
                <TeacherAssignmentsAnnouncements
                  teacherId={profile.id}
                  teacherClasses={teacherClasses}
                  isActive={true}
                />
              </>
            )}
            {activeTab === "students" && (
              <>
                <SubViewTitle
                  microLabel="Classroom"
                  title="View Students"
                  description="View and manage student information and performance"
                />
                <ViewStudents
                  teacherId={profile.id}
                  teacherClasses={teacherClasses}
                  isActive={true}
                  academicYear={currentAcademicYear ?? undefined}
                  assessmentYear={currentAssessmentYear ?? undefined}
                />
              </>
            )}
            {activeTab === "marks" && (
              <>
                <SubViewTitle
                  microLabel="Assessment"
                  title="Enter Marks"
                  description="Enter marks for your subjects per assessment"
                />
                <TeacherMarksEntry
                  teacherId={profile.id}
                  teacherClasses={teacherClasses}
                  academicYear={currentAcademicYear ?? undefined}
                  assessmentYear={currentAssessmentYear ?? undefined}
                  currentTerm={activeTerm?.term ?? undefined}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#7a1f2b]/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-around items-center h-16">
          {(["overview", "assignments", "students", "marks"] as const).map((tab) => {
            const Icon = tab === "overview" ? TrendingUp
              : tab === "assignments" ? FileText
              : tab === "students" ? Users : FileText;
            const label = tab === "overview" ? "Overview"
              : tab === "assignments" ? "Assignments"
              : tab === "students" ? "Students" : "Marks";
            const isActive = tab === "overview" ? isOverviewFamily : activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? "text-[#7a1f2b]" : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-b-full bg-[#7a1f2b]" />
                )}
                <Icon className="h-5 w-5 mb-1" />
                <span className={`text-[11px] ${isActive ? "font-semibold" : ""}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <SettingsModal
        profile={profile}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProfileUpdate={refreshProfile}
      />

      <ClassTimetableViewer
        isOpen={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setSelectedTimetable(null);
        }}
        timetable={selectedTimetable}
        teacherId={profile.id}
      />
    </div>
  );
}