import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/Components/ui/table";
import {
  User, TrendingUp, TrendingDown, Minus, Target,
  BookOpen, Calendar, Phone, ChevronDown, ChevronRight,
  BarChart3, Sparkles, FileText, Activity, Award,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { useState, useMemo, Fragment } from "react";
import { PerformanceBadge } from "@/Components/PerformanceBadge";

// ─── Design tokens (mirrors TeacherDashboard) ─────────────────────────────────

const MAROON = "#7a1f2b";
const MAROON_GRADIENT =
  "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";
const HERO_SHADOW = "0 18px 40px -22px rgba(122,31,43,0.45)";

// ─── KJSEA Achievement Levels (2025) ─────────────────────────────────────────

const KJSEA_LEVELS = [
  { label: "EE1 (L8)", min: 90, max: 100, color: "#10B981", description: "Exceptional"   },
  { label: "EE2 (L7)", min: 75, max: 89,  color: "#22C55E", description: "Excellent"      },
  { label: "ME1 (L6)", min: 58, max: 74,  color: "#3B82F6", description: "Very Good"      },
  { label: "ME2 (L5)", min: 41, max: 57,  color: "#8B5CF6", description: "Good"           },
  { label: "AE1 (L4)", min: 31, max: 40,  color: "#F59E0B", description: "Average"        },
  { label: "AE2 (L3)", min: 21, max: 30,  color: "#F97316", description: "Below Average"  },
  { label: "BE1 (L2)", min: 11, max: 20,  color: "#EF4444", description: "Poor"           },
  { label: "BE2 (L1)", min: 0,  max: 10,  color: "#6B7280", description: "Very Poor"      },
] as const;

type KJSEALevel = typeof KJSEA_LEVELS[number];

const KJSEA_LOOKUP = KJSEA_LEVELS.reduce<Record<string, KJSEALevel>>((acc, l) => {
  for (let i = l.min; i <= l.max; i++) acc[i] = l;
  return acc;
}, {});

function getKJSEALevel(percentage: number): KJSEALevel {
  return KJSEA_LOOKUP[Math.round(Math.max(0, Math.min(100, percentage)))] ?? KJSEA_LEVELS[7];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentAssessment {
  id: string;
  title: string;
  score: number | null;
  performance_level: 'EE' | 'ME' | 'AE' | 'BE' | null;
  teacher_remarks: string | null;
  is_absent: boolean;
  max_marks: number;
  percentage: number | null;
  assessment_date: string;
  subject: string;
  term: number;
  year: number;
  category: string;
  strand?: { name: string; code: string };
  sub_strand?: { name: string; code: string };
}

interface GuardianProfile {
  guardian_phone?: string;
  [key: string]: unknown;
}

interface Enrollment {
  [key: string]: unknown;
}

interface Student {
  id: string;
  Reg_no: string;
  first_name: string;
  last_name: string;
  created_at: string;
  auth_id: string | null;
  enrollments?: Enrollment[];
  profiles?: GuardianProfile[];
  class?: string;
}

interface StudentPerformanceDetail {
  student: Student;
  assessments: StudentAssessment[];
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
  subjectAverages: { subject: string; average: number }[];
  gradeDistribution: { grade: string; count: number }[];
  recentTrend: number;
}

interface Props {
  performanceDetail: StudentPerformanceDetail;
}

// ─── Section header (themed, matches dashboard) ──────────────────────────────

function SectionHeader({
  icon: Icon, microLabel, title, description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string;
  title: string;
  description?: string;
}) {
  return (
    <div
      className="relative overflow-hidden px-4 sm:px-5 py-3.5"
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
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
            {microLabel}
          </p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{title}</h3>
          {description && (
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Formative level badge ────────────────────────────────────────────────────

const FORMATIVE_STYLES: Record<string, string> = {
  EE:  'bg-green-100 text-green-800 border-green-200',
  EE1: 'bg-green-100 text-green-800 border-green-200',
  EE2: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ME:  'bg-blue-100 text-blue-800 border-blue-200',
  ME1: 'bg-blue-100 text-blue-800 border-blue-200',
  ME2: 'bg-sky-100 text-sky-800 border-sky-200',
  AE:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  AE1: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  AE2: 'bg-amber-100 text-amber-800 border-amber-200',
  BE:  'bg-red-100 text-red-800 border-red-200',
  BE1: 'bg-red-100 text-red-800 border-red-200',
  BE2: 'bg-rose-100 text-rose-800 border-rose-200',
};

function FormativeLevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-gray-400 text-xs">-</span>;
  const normalized = level.toUpperCase().trim();
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${
        FORMATIVE_STYLES[normalized] ?? 'bg-gray-100 text-gray-800 border-gray-200'
      }`}
    >
      {normalized}
    </span>
  );
}

// ─── Term grouping helpers ────────────────────────────────────────────────────

function groupByTerm<T extends { term: number; year: number }>(
  items: T[]
): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const key = `${item.year}-${item.term ?? 0}`;
    const label = item.term ? `Term ${item.term} — ${item.year}` : `${item.year}`;
    if (!map.has(key)) map.set(key, { label, items: [] });
    map.get(key)!.items.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, v]) => ({ key, ...v }));
}

function TermGroupHeader({
  label, count, open, onToggle,
}: {
  label: string; count: number; open: boolean; onToggle: () => void;
}) {
  return (
    <TableRow
      className="bg-[#7a1f2b]/[0.06] hover:bg-[#7a1f2b]/[0.09] cursor-pointer select-none transition-colors active:bg-[#7a1f2b]/[0.12]"
      onClick={onToggle}
    >
      <TableCell colSpan={7} className="py-2 px-2 sm:px-4">
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown  className="h-3.5 w-3.5 text-[#7a1f2b] flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-[#7a1f2b] flex-shrink-0" />}
          <span className="text-xs font-semibold text-[#3a1b1f]">{label}</span>
          <span className="text-xs text-[#7a1f2b]/60">({count})</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentPerformanceDetailView: React.FC<Props> = ({ performanceDetail }) => {
  const {
    student, assessments, averageScore, trend,
    subjectAverages, gradeDistribution, recentTrend,
  } = performanceDetail;

  const studentClass  = student.class ?? 'No Class';
  const guardianPhone = student.profiles?.[0]?.guardian_phone;

  const summativeAssessments = useMemo(
    () => assessments.filter(a => !a.category || a.category === 'summative'),
    [assessments]
  );

  const formativeAssessments = useMemo(
    () => assessments.filter(a => a.category === 'formative' || a.category === 'portfolio'),
    [assessments]
  );

  const performanceOverTime = useMemo(
    () => summativeAssessments
      .filter(a => a.percentage !== null)
      .map(a => ({
        name:     a.title.length > 20 ? `${a.title.substring(0, 20)}...` : a.title,
        fullName: a.title,
        score:    a.percentage,
        date:     new Date(a.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: new Date(a.assessment_date).toLocaleDateString(),
        subject:  a.subject,
      }))
      .reverse(),
    [summativeAssessments]
  );

  const subjectPerformanceData = useMemo(
    () => subjectAverages.map(s => ({
      subject:     s.subject.length > 10 ? `${s.subject.substring(0, 10)}...` : s.subject,
      fullSubject: s.subject,
      average:     s.average,
      fill:        getKJSEALevel(s.average).color,
    })),
    [subjectAverages]
  );

  const currentKJSEALevel = useMemo(() => getKJSEALevel(averageScore), [averageScore]);

  const insights = useMemo(() => {
    const result: { icon: React.ReactNode; title: string; description: string }[] = [];

    result.push({
      icon: <Target className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: currentKJSEALevel.color }} />,
      title: `${currentKJSEALevel.description} Performance (${currentKJSEALevel.label})`,
      description: `Student achieves ${currentKJSEALevel.description} level. ${
        averageScore >= 58
          ? 'Maintain current strategies.'
          : 'Consider targeted interventions.'
      }`,
    });

    if (trend === 'improving') {
      result.push({
        icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />,
        title: "Positive Momentum",
        description: `Performance is improving by approximately ${Math.abs(recentTrend)} points. Current teaching strategies are effective.`,
      });
    } else if (trend === 'declining') {
      result.push({
        icon: <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />,
        title: "Declining Performance",
        description: `Scores have decreased by approximately ${Math.abs(recentTrend)} points. Review recent topics and consider additional support.`,
      });
    } else {
      result.push({
        icon: <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />,
        title: "Stable Performance",
        description: "Performance remains consistent. Focus on gradual improvement through targeted practice.",
      });
    }

    if (subjectAverages.length >= 2) {
      const strongest = subjectAverages.reduce((p, c) => p.average > c.average ? p : c);
      const weakest   = subjectAverages.reduce((p, c) => p.average < c.average ? p : c);
      if (strongest.average - weakest.average > 15) {
        result.push({
          icon: <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />,
          title: "Significant Subject Variation",
          description: `Strong in ${strongest.subject} (${strongest.average}%) but needs support in ${weakest.subject} (${weakest.average}%).`,
        });
      }
    }

    if (summativeAssessments.length < 3) {
      result.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />,
        title: "Limited Assessment Data",
        description: "Only a few summative assessments available. More data needed for accurate trend analysis.",
      });
    }

    if (result.length === 1) {
      result.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />,
        title: "New Student Analysis",
        description: "As assessments are completed, more detailed insights will become available.",
      });
    }

    return result;
  }, [averageScore, trend, recentTrend, subjectAverages, summativeAssessments.length, currentKJSEALevel]);

  const chartScrollWidth = useMemo(
    () => Math.max(performanceOverTime.length * 100, 400),
    [performanceOverTime.length]
  );

  const summativeByTerm = useMemo(() => groupByTerm(summativeAssessments), [summativeAssessments]);
  const formativeByTerm = useMemo(() => groupByTerm(formativeAssessments), [formativeAssessments]);

  const [openSummativeTerms, setOpenSummativeTerms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(summativeByTerm.map(g => [g.key, true]))
  );
  const [openFormativeTerms, setOpenFormativeTerms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(formativeByTerm.map(g => [g.key, true]))
  );

  const toggleSummativeTerm = (key: string) =>
    setOpenSummativeTerms(p => ({ ...p, [key]: !p[key] }));
  const toggleFormativeTerm = (key: string) =>
    setOpenFormativeTerms(p => ({ ...p, [key]: !p[key] }));

  const trendColorClass =
    trend === 'improving' ? 'text-green-300' :
    trend === 'declining' ? 'text-red-300'   : 'text-yellow-200';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 sm:space-y-5 pb-[calc(env(safe-area-inset-bottom))]">

      {/* ── STUDENT HERO ─────────────────────────────────────────────── */}
      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: HERO_SHADOW }}
      >
        <div className="relative overflow-hidden p-4 sm:p-6" style={{ background: MAROON_GRADIENT }}>
          <div
            className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)" }}
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                  Student Profile
                </p>
                <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight truncate">
                  {student.first_name} {student.last_name}
                </h3>
                <p className="text-[11px] sm:text-sm text-white/70 truncate mt-0.5">
                  {student.Reg_no} • {studentClass}
                </p>
                {guardianPhone && (
                  <p className="text-[11px] sm:text-xs text-white/70 flex items-center mt-1">
                    <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5 shrink-0" />
                    <span className="truncate">Guardian: {guardianPhone}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="text-center sm:text-right shrink-0">
              <div className="text-2xl sm:text-3xl font-bold text-white leading-none">
                {averageScore}%
              </div>
              <div className="flex items-center justify-center sm:justify-end gap-1.5 mt-1.5">
                <span className={trendColorClass}>
                  {trend === 'improving' ? <TrendingUp   className="h-4 w-4 sm:h-5 sm:w-5" /> :
                   trend === 'declining' ? <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" /> :
                                           <Minus        className="h-4 w-4 sm:h-5 sm:w-5" />}
                </span>
                <span className="text-xs sm:text-sm capitalize text-white/85 font-medium">
                  {trend}
                </span>
                {recentTrend !== 0 && (
                  <span className="text-xs text-white/60">
                    ({recentTrend > 0 ? '+' : ''}{recentTrend})
                  </span>
                )}
              </div>
              <Badge
                className="mt-2 text-[11px] sm:text-xs border-0 font-semibold"
                style={{ backgroundColor: currentKJSEALevel.color, color: "white" }}
              >
                {currentKJSEALevel.label}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* ── CHARTS ROW ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">

        {/* Performance Trend */}
        <Card
          className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <SectionHeader
            icon={TrendingUp}
            microLabel="Progress"
            title="Performance Trend"
            description={`Summative exams only • ${performanceOverTime.length} results`}
          />
          <CardContent className="p-3 sm:p-5">
            {performanceOverTime.length > 0 ? (
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div style={{ width: chartScrollWidth, height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={performanceOverTime}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(122,31,43,0.08)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        domain={[0, 100]}
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                        tickCount={6}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid rgba(122,31,43,0.15)",
                          borderRadius: "10px",
                          fontSize: '12px',
                          padding: '8px',
                          maxWidth: '200px',
                          boxShadow: CARD_SHADOW,
                        }}
                        formatter={(value: number) => [`${value?.toFixed(1)}%`, 'Score']}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload
                            ? `${payload[0].payload.fullName} (${payload[0].payload.fullDate})`
                            : ''
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={MAROON}
                        strokeWidth={2}
                        dot={{ fill: MAROON, strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: MAROON, strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-[200px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No summative exam data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subject Performance */}
        <Card
          className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <SectionHeader
            icon={BarChart3}
            microLabel="Subjects"
            title="Subject Performance"
            description="Average summative scores by subject"
          />
          <CardContent className="p-3 sm:p-5">
            {subjectPerformanceData.length > 0 ? (
              <div className="w-full h-[220px] sm:h-[260px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectPerformanceData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(122,31,43,0.08)" vertical={false} />
                    <XAxis
                      dataKey="subject"
                      stroke="hsl(var(--muted-foreground))"
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      fontSize={10}
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      fontSize={10}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid rgba(122,31,43,0.15)",
                        borderRadius: "10px",
                        fontSize: '12px',
                        padding: '8px',
                        maxWidth: '200px',
                        boxShadow: CARD_SHADOW,
                      }}
                      formatter={(value: number, _, props: { payload?: { fullSubject?: string; subject?: string } }) => [
                        `${value}%`,
                        props.payload?.fullSubject ?? props.payload?.subject ?? '',
                      ]}
                    />
                    <Bar dataKey="average" radius={[6, 6, 0, 0]}>
                      {subjectPerformanceData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No subject data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── SUMMATIVE TABLE ─────────────────────────────────────────── */}
      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <SectionHeader
          icon={FileText}
          microLabel="Assessments"
          title="Summative Assessments"
          description={`${summativeAssessments.length} exam results with scores`}
        />
        <CardContent className="p-0">
          {summativeAssessments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No summative results found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[300px] sm:min-w-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#7a1f2b]/[0.03] hover:bg-[#7a1f2b]/[0.03] border-b border-[#7a1f2b]/10">
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Assessment</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold hidden sm:table-cell">Subject</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Date</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Term</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Score</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Level</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold hidden md:table-cell">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summativeByTerm.map(group => (
                      <Fragment key={group.key}>
                        <TermGroupHeader
                          key={`hdr-${group.key}`}
                          label={group.label}
                          count={group.items.length}
                          open={openSummativeTerms[group.key] ?? true}
                          onToggle={() => toggleSummativeTerm(group.key)}
                        />
                        {(openSummativeTerms[group.key] ?? true) && group.items.map(a => (
                          <TableRow key={a.id} className="hover:bg-[#7a1f2b]/[0.03] border-b border-[#7a1f2b]/5">
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                              {a.title}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs border-[#7a1f2b]/20 text-[#7a1f2b]">
                                {a.subject}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                              {new Date(a.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                              {a.term ? `T${a.term}` : '-'}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm">
                              {a.is_absent ? (
                                <span className="italic text-muted-foreground">Absent</span>
                              ) : a.score !== null ? (
                                `${a.score}/${a.max_marks}`
                              ) : '-'}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4">
                              {a.is_absent ? (
                                <Badge variant="outline">Absent</Badge>
                              ) : a.performance_level ? (
                                <PerformanceBadge level={a.performance_level} />
                              ) : a.percentage !== null ? (
                                <PerformanceBadge level={
                                  a.percentage >= 75 ? 'EE' :
                                  a.percentage >= 50 ? 'ME' :
                                  a.percentage >= 25 ? 'AE' : 'BE'
                                } />
                              ) : '-'}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden md:table-cell max-w-xs truncate text-xs">
                              {a.teacher_remarks ?? '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FORMATIVE TABLE ─────────────────────────────────────────── */}
      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <SectionHeader
          icon={Activity}
          microLabel="Activity"
          title="Formative Assessments"
          description={`${formativeAssessments.length} formative entries — performance levels only`}
        />
        <CardContent className="p-0">
          {formativeAssessments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No formative assessments recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[300px] sm:min-w-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#7a1f2b]/[0.03] hover:bg-[#7a1f2b]/[0.03] border-b border-[#7a1f2b]/10">
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Activity</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold hidden sm:table-cell">Subject</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Date</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold">Level</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-[#7a1f2b]/70 font-semibold hidden md:table-cell">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formativeByTerm.map(group => (
                      <Fragment key={group.key}>
                        <TermGroupHeader
                          key={`hdr-${group.key}`}
                          label={group.label}
                          count={group.items.length}
                          open={openFormativeTerms[group.key] ?? true}
                          onToggle={() => toggleFormativeTerm(group.key)}
                        />
                        {(openFormativeTerms[group.key] ?? true) && group.items.map(a => (
                          <TableRow key={a.id} className="hover:bg-[#7a1f2b]/[0.03] border-b border-[#7a1f2b]/5">
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                              {a.title}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs border-[#7a1f2b]/20 text-[#7a1f2b]">
                                {a.subject}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                              {new Date(a.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4">
                              {a.is_absent ? (
                                <Badge variant="outline">Absent</Badge>
                              ) : (
                                <FormativeLevelBadge level={a.performance_level} />
                              )}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden md:table-cell max-w-xs truncate text-xs">
                              {a.teacher_remarks ?? '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── KJSEA GRADE DISTRIBUTION ────────────────────────────────── */}
      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <SectionHeader
          icon={Award}
          microLabel="Achievement"
          title="KJSEA Grade Distribution"
          description="Based on summative exams only"
        />
        <CardContent className="p-3 sm:p-5">
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2 md:gap-3">
            {KJSEA_LEVELS.map(level => {
              const count = gradeDistribution.find(gd => gd.grade === level.label)?.count ?? 0;
              const levelNum = level.label.split('(L')[1]?.replace(')', '') ?? '';
              return (
                <div
                  key={level.label}
                  className="text-center p-1.5 sm:p-2 md:p-3 rounded-xl border border-[#7a1f2b]/10 bg-white transition-colors"
                  style={{ boxShadow: "0 2px 8px -6px rgba(122,31,43,0.15)" }}
                >
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mx-auto mb-1 text-white font-bold text-[10px] sm:text-xs shadow-sm"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.label.split(' ')[0]}
                  </div>
                  <div className="text-sm sm:text-base md:text-lg font-bold text-[#3a1b1f] leading-none">
                    {count}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate hidden sm:block mt-0.5">
                    {level.description}
                  </div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 text-[#7a1f2b]/60 font-medium">
                    L{levelNum}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              EE = Exceptional, ME = Merit, AE = Average, BE = Below Average
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── PERFORMANCE INSIGHTS ────────────────────────────────────── */}
      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <SectionHeader
          icon={Sparkles}
          microLabel="Insights"
          title="Performance Insights"
          description="Key observations and recommendations"
        />
        <CardContent className="p-3 sm:p-5">
          <div className="space-y-2.5 sm:space-y-3.5">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2.5 sm:gap-3">
                <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#7a1f2b]/[0.06] flex items-center justify-center">
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h4 className="font-semibold text-sm sm:text-base text-[#3a1b1f] leading-tight">
                    {insight.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
                    {insight.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default StudentPerformanceDetailView;