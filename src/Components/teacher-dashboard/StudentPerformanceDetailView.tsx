import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/Components/ui/table";
import {
  User, TrendingUp, TrendingDown, Minus, Target,
  BookOpen, Calendar, Phone, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { useState, useMemo, Fragment } from "react";
import { PerformanceBadge } from "@/Components/PerformanceBadge";

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

// Pre-built lookup — avoids repeated .find() calls at render time
const KJSEA_LOOKUP = KJSEA_LEVELS.reduce<Record<string, KJSEALevel>>((acc, l) => {
  for (let i = l.min; i <= l.max; i++) acc[i] = l;
  return acc;
}, {});

function getKJSEALevel(percentage: number): KJSEALevel {
  return KJSEA_LOOKUP[Math.round(Math.max(0, Math.min(100, percentage)))] ?? KJSEA_LEVELS[7];
}

function calculateKJSEAGrade(percentage: number): string {
  return getKJSEALevel(percentage).label;
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${
      FORMATIVE_STYLES[normalized] ?? 'bg-gray-100 text-gray-800 border-gray-200'
    }`}>
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
  // Sort groups: newest year + highest term first
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, v]) => ({ key, ...v }));
}

function TermGroupHeader({
  label, count, open, onToggle,
}: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <TableRow
      className="bg-muted/40 hover:bg-muted/60 cursor-pointer select-none"
      onClick={onToggle}
    >
      <TableCell colSpan={7} className="py-2 px-2 sm:px-4">
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">({count})</span>
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

  const studentClass    = student.class ?? 'No Class';
  const guardianPhone   = student.profiles?.[0]?.guardian_phone;

  // ── Derived data — all memoised so they don't recompute on every render ──

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
      icon: <Target className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5" style={{ color: currentKJSEALevel.color }} />,
      title: `${currentKJSEALevel.description} Performance (${currentKJSEALevel.label})`,
      description: `Student achieves ${currentKJSEALevel.description} level. ${
        averageScore >= 58
          ? 'Maintain current strategies.'
          : 'Consider targeted interventions.'
      }`,
    });

    if (trend === 'improving') {
      result.push({
        icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5" />,
        title: "Positive Momentum",
        description: `Performance is improving by approximately ${Math.abs(recentTrend)} points. Current teaching strategies are effective.`,
      });
    } else if (trend === 'declining') {
      result.push({
        icon: <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mt-0.5" />,
        title: "Declining Performance",
        description: `Scores have decreased by approximately ${Math.abs(recentTrend)} points. Review recent topics and consider additional support.`,
      });
    } else {
      result.push({
        icon: <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 mt-0.5" />,
        title: "Stable Performance",
        description: "Performance remains consistent. Focus on gradual improvement through targeted practice.",
      });
    }

    if (subjectAverages.length >= 2) {
      const strongest = subjectAverages.reduce((p, c) => p.average > c.average ? p : c);
      const weakest   = subjectAverages.reduce((p, c) => p.average < c.average ? p : c);
      if (strongest.average - weakest.average > 15) {
        result.push({
          icon: <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5" />,
          title: "Significant Subject Variation",
          description: `Strong in ${strongest.subject} (${strongest.average}%) but needs support in ${weakest.subject} (${weakest.average}%).`,
        });
      }
    }

    if (summativeAssessments.length < 3) {
      result.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mt-0.5" />,
        title: "Limited Assessment Data",
        description: "Only a few summative assessments available. More data needed for accurate trend analysis.",
      });
    }

    if (result.length === 1) {
      result.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />,
        title: "New Student Analysis",
        description: "As assessments are completed, more detailed insights will become available.",
      });
    }

    return result;
  }, [averageScore, trend, recentTrend, subjectAverages, summativeAssessments.length, currentKJSEALevel]);

  // ── Chart width — 100px per data point, minimum fills container ──────────

  const chartScrollWidth = useMemo(
    () => Math.max(performanceOverTime.length * 100, 400),
    [performanceOverTime.length]
  );

  // ── Term-grouped assessments ──────────────────────────────────────────────

  const summativeByTerm = useMemo(() => groupByTerm(summativeAssessments), [summativeAssessments]);
  const formativeByTerm = useMemo(() => groupByTerm(formativeAssessments), [formativeAssessments]);

  // All term groups start expanded
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Student Header */}
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
                {guardianPhone && (
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Guardian: {guardianPhone}
                  </p>
                )}
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold text-primary">{averageScore}%</div>
              <div className="flex items-center justify-center sm:justify-end space-x-1 sm:space-x-2 mt-1">
                <div className={
                  trend === 'improving' ? 'text-green-600' :
                  trend === 'declining' ? 'text-red-600'   : 'text-yellow-600'
                }>
                  {trend === 'improving' ? <TrendingUp  className="h-4 w-4 sm:h-5 sm:w-5" /> :
                   trend === 'declining' ? <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" /> :
                                           <Minus        className="h-4 w-4 sm:h-5 sm:w-5" />}
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
                style={{ backgroundColor: currentKJSEALevel.color, color: "white" }}
              >
                {currentKJSEALevel.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Performance Trend */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Performance Trend</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Summative exams only • {performanceOverTime.length} results
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {performanceOverTime.length > 0 ? (
              <div
                className="overflow-x-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div style={{ width: chartScrollWidth, height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={performanceOverTime}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: '12px',
                          padding: '8px',
                          maxWidth: '200px',
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
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
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
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Subject Performance</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Average summative scores by subject</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {subjectPerformanceData.length > 0 ? (
              <div className="w-full h-[200px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectPerformanceData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: '12px',
                        padding: '8px',
                        maxWidth: '200px',
                      }}
                      formatter={(value: number, _, props: { payload?: { fullSubject?: string; subject?: string } }) => [
                        `${value}%`,
                        props.payload?.fullSubject ?? props.payload?.subject ?? '',
                      ]}
                    />
                    <Bar dataKey="average" radius={[4, 4, 0, 0]}>
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

      {/* Summative Assessments Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Summative Assessments</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {summativeAssessments.length} exam results with scores
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 pt-0">
          {summativeAssessments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No summative results found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[300px] sm:min-w-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Assessment</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden sm:table-cell">Subject</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Date</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Term</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Score</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Level</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden md:table-cell">Remarks</TableHead>
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
                          <TableRow key={a.id}>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                              {a.title}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">{a.subject}</Badge>
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

      {/* Formative Assessments Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base sm:text-lg">Formative Assessments</CardTitle>
            <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold bg-teal-100 text-teal-800 border-teal-200">
              Activity / Portfolio
            </span>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            {formativeAssessments.length} formative entries — performance levels only
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 pt-0">
          {formativeAssessments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No formative assessments recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[300px] sm:min-w-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Activity</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden sm:table-cell">Subject</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Date</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Level</TableHead>
                      <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden md:table-cell">Remarks</TableHead>
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
                          <TableRow key={a.id}>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                              {a.title}
                            </TableCell>
                            <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">{a.subject}</Badge>
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

      {/* KJSEA Grade Distribution */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">KJSEA Grade Distribution</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Based on summative exams only</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-1 sm:gap-2 md:gap-4">
            {KJSEA_LEVELS.map(level => {
              const count = gradeDistribution.find(gd => gd.grade === level.label)?.count ?? 0;
              // Extract level number e.g. "EE1 (L8)" → "8"
              const levelNum = level.label.split('(L')[1]?.replace(')', '') ?? '';
              return (
                <div key={level.label} className="text-center p-1 sm:p-2 md:p-4 rounded-lg border">
                  <div
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mx-auto mb-1 text-white font-bold text-xs"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.label.split(' ')[0]}
                  </div>
                  <div className="text-sm sm:text-base md:text-lg font-bold">{count}</div>
                  <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                    {level.description}
                  </div>
                  <div className="text-[10px] mt-0.5">L{levelNum}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              EE = Exceptional, ME = Merit, AE = Average, BE = Below Average
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Performance Insights</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Key observations and recommendations</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start space-x-2 sm:space-x-3">
                <div className="flex-shrink-0 mt-0.5">{insight.icon}</div>
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

export default StudentPerformanceDetailView;