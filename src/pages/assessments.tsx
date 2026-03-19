import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/Components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle,
} from "@/Components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { supabase } from "../lib/supabaseClient";
import {
  BookOpen, TrendingUp, Calendar, FileText, Download, BarChart3,
  User, Mail, Phone, ShieldAlert, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, ArrowLeft, ArrowRight, FileBarChart2,
} from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Capacitor } from "@capacitor/core";
import { PerformanceBadge } from "@/Components/PerformanceBadge";

import {
  getOrdinalSuffix,
  getPerformanceLevel,
  calculateKJSEAGrade,
  getGradeColor,
  extractExamNumber,
  firstRel,
  PerformanceRecord,
  SubjectAnalysisData,
  AssessmentsProps,
} from "@/utils/assessmentUtils";

import ExamPDF from "@/Components/ExamPDF";
import PerformanceHistoryPDF from "@/Components/PerformanceHistoryPDF";
import TermReportPDF from "@/Components/TermReportPDF";

// ── Import AcademicCalendarTerm type from StudentDashboard ────────────────────
import type { AcademicCalendarTerm } from "./StudentDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  reg_no?: string;
  first_name?: string;
  last_name?: string;
  guardian_phone?: string;
  [key: string]: unknown;
}

interface AttendanceData {
  totalDays: number;
  presentDays: number;
  attendanceRate: number;
}

interface SubjectBreakdownItem {
  subject: string;
  code: string;
  score: number;
  max_marks: number;
  percentage: number;
  performance_level: string | null;
  teacher_remarks: string | null;
  is_absent: boolean;
  grade: string;
}

interface CatRecord {
  assessment_id: string;
  student_id: string;
  title: string;
  term: string | number;
  year: number;
  assessment_date: string;
  score: number;
  total_score: number;
  percentage: number;
  classPosition: number | null;
  grade: string;
  id: string;
}

interface TeacherInfo {
  teacher_id: string;
  first_name: string;
  last_name: string;
}

interface RevealedContact {
  email: string;
  phone: string;
}

interface ExamItem {
  id: string;
  title: string;
}

interface PivotRow {
  subject: string;
  exams: Record<string, string | number>;
}

interface TermGroup {
  key: string;
  termLabel: string;
  term: string | number;
  year: number;
  records: CatRecord[];
}

// ── NEW: Term filter key type ─────────────────────────────────────────────────
type TermFilterKey = "all" | string; // string = `${year}-${term}` e.g. "2025-1"

// ─── Formative result type (from new formative_results table) ────────────────

interface FormativeActivityResult {
  id: string;
  formative_activity_id: string;
  performance_level: string | null;
  is_absent: boolean;
  teacher_comment: string | null;
  recorded_at: string;
  formative_activities: {
    id: string;
    title: string;
    description: string | null;
    term: number;
    year: number;
    activity_date: string;
    strand_id: string | null;
    sub_strand_id: string | null;
    strands:     { name: string } | null;
    sub_strands: { name: string } | null;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const isNative =
  Capacitor &&
  typeof Capacitor.isNativePlatform === "function" &&
  Capacitor.isNativePlatform();

const ASSESSMENTS_LIMIT = 200; // free-tier guard

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PDFLoadingFallback = () => (
  <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-maroon" />
);

function triggerPDFDownload(blob: Blob, fileName: string) {
  if (isNative) {
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Logo loader — cached in module scope, fetched once ──────────────────────

let cachedLogoUrl = "";

async function loadLogoAsBase64(): Promise<string> {
  if (cachedLogoUrl) return cachedLogoUrl;
  try {
    const response = await fetch("/logo.png");
    if (!response.ok) return "";
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoUrl = reader.result as string;
        resolve(cachedLogoUrl);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

// ─── Fetch subject breakdown for one assessment ───────────────────────────────

const fetchSubjectBreakdownForAssessment = async (
  studentId: string,
  assessmentId: string
): Promise<SubjectBreakdownItem[]> => {
  const { data, error } = await supabase
    .from("assessment_results")
    .select(`
      score,
      performance_level,
      teacher_remarks,
      is_absent,
      subjects!inner ( name, code ),
      assessments!inner ( max_marks )
    `)
    .eq("student_id", studentId)
    .eq("assessment_id", assessmentId)
    .eq("status", "published");

  if (error) {
    console.error("Error fetching subject breakdown:", error);
    return [];
  }

  return (data ?? []).map((item: Record<string, unknown>) => {
    const subj     = Array.isArray(item.subjects)    ? (item.subjects as Record<string, string>[])[0]    : item.subjects as Record<string, string>;
    const assess   = Array.isArray(item.assessments) ? (item.assessments as Record<string, number>[])[0] : item.assessments as Record<string, number>;
    const maxMarks = assess?.max_marks ?? 100;
    const score    = (item.score as number) ?? 0;
    return {
      subject:           subj?.name ?? "",
      code:              subj?.code ?? "",
      score,
      max_marks:         maxMarks,
      percentage:        maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0,
      performance_level: item.performance_level as string | null,
      teacher_remarks:   item.teacher_remarks as string | null,
      is_absent:         (item.is_absent as boolean) ?? false,
      grade:             calculateKJSEAGrade(maxMarks > 0 ? score / maxMarks : 0),
    };
  });
};

// ─── Individual CAT PDF download ──────────────────────────────────────────────

const downloadExamPDF = async (
  assessmentId: string,
  studentId: string,
  profile: Profile,
  className: string,
  logoUrl: string,
  classId?: string,
  onError?: (msg: string) => void,
) => {
  try {
    const [assessRes, rankingRes] = await Promise.all([
      supabase.from("assessments").select("title, term, year, max_marks, category").eq("id", assessmentId).single(),
      supabase.from("student_rankings").select("class_position, total_attained, total_possible, assessment_date")
        .eq("assessment_id", assessmentId).eq("student_id", studentId).maybeSingle(),
    ]);

    if (assessRes.error) throw assessRes.error;
    const assessment = assessRes.data;
    const ranking    = rankingRes.data;
    const subjects   = await fetchSubjectBreakdownForAssessment(studentId, assessmentId);

    if (subjects.length === 0) {
      onError?.("No subject data available for this exam. Make sure results are published.");
      return;
    }

    const totalScore    = ranking?.total_attained    ?? subjects.reduce((sum, s) => sum + (s.score     ?? 0), 0);
    const totalPossible = ranking?.total_possible    ?? subjects.reduce((sum, s) => sum + (s.max_marks ?? 0), 0);
    const percentage    = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

    const examRecord = {
      id:               assessmentId,
      title:            assessment.title,
      term:             assessment.term,
      year:             assessment.year,
      assessment_date:  ranking?.assessment_date ?? new Date().toISOString(),
      subjects:         { name: "Multiple Subjects" },
      score:            totalScore,
      total_score:      totalPossible,
      percentage,
      grade:            calculateKJSEAGrade(percentage / 100),
      subjectBreakdown: subjects,
      classPosition:    ranking?.class_position ?? null,
    };

    const { pdf } = await import("@react-pdf/renderer");
    const blob = await pdf(
      <ExamPDF examRecord={examRecord} profile={profile} className={className} logoUrl={logoUrl} />
    ).toBlob();

    triggerPDFDownload(
      blob,
      `Milai_School_${assessment.title.replace(/\s+/g, "_")}_${profile?.reg_no ?? "result"}.pdf`
    );
  } catch (error) {
    console.error("PDF download failed:", error);
    onError?.("Failed to generate exam PDF. Please try again.");
  }
};

// ─── Full Term Report PDF download ───────────────────────────────────────────

const downloadTermReportPDF = async (
  term: string | number,
  year: number,
  cats: CatRecord[],
  studentId: string,
  classId: string,
  profile: Profile,
  className: string,
  logoUrl: string,
  attendanceData: AttendanceData | null,
  onError?: (msg: string) => void,
) => {
  try {
    const breakdownResults = await Promise.all(
      cats.map((cat) => fetchSubjectBreakdownForAssessment(studentId, cat.assessment_id))
    );
    const subjectBreakdowns: Record<string, SubjectBreakdownItem[]> = {};
    cats.forEach((cat, i) => { subjectBreakdowns[cat.assessment_id] = breakdownResults[i]; });

    // Fetch formative results from the new formative_results + formative_activities tables
    const { data: formativeRaw, error: fErr } = await supabase
      .from("formative_results")
      .select(`
        id,
        performance_level,
        is_absent,
        teacher_comment,
        recorded_at,
        formative_activities!inner (
          id, title, description, term, year, activity_date,
          class_id, subject_id,
          strand_id, sub_strand_id,
          strands ( name ),
          sub_strands ( name ),
          subjects ( name )
        )
      `)
      .eq("student_id", studentId)
      .eq("formative_activities.class_id", classId)
      .eq("formative_activities.term", term)
      .eq("formative_activities.year", year)
      .order("recorded_at", { ascending: true });

    if (fErr) throw fErr;

    const formativeRecords = (formativeRaw ?? []).map((item: Record<string, unknown>) => {
      const act     = Array.isArray(item.formative_activities)
        ? (item.formative_activities as Record<string, unknown>[])[0]
        : item.formative_activities as Record<string, unknown>;
      const strand  = Array.isArray((act as Record<string, unknown>)?.strands)
        ? ((act as Record<string, unknown[]>).strands as Record<string, string>[])[0]
        : (act as Record<string, unknown>)?.strands as Record<string, string>;
      const sub     = Array.isArray((act as Record<string, unknown>)?.sub_strands)
        ? ((act as Record<string, unknown[]>).sub_strands as Record<string, string>[])[0]
        : (act as Record<string, unknown>)?.sub_strands as Record<string, string>;
      const subject = Array.isArray((act as Record<string, unknown>)?.subjects)
        ? ((act as Record<string, unknown[]>).subjects as Record<string, string>[])[0]
        : (act as Record<string, unknown>)?.subjects as Record<string, string>;
      return {
        id:                item.id as string,
        assessment_date:   (act as Record<string, string>)?.activity_date ?? "",
        title:             (act as Record<string, string>)?.title ?? "Activity",
        strand:            strand?.name  ?? "",
        sub_strand:        sub?.name     ?? "",
        performance_level: (item.performance_level as string) ?? "",
        teacher_remarks:   (item.teacher_comment as string) ?? "",
        is_absent:         (item.is_absent as boolean) ?? false,
        subject:           subject?.name ?? "",
      };
    });

    const attendance = attendanceData
      ? {
          totalDays:      attendanceData.totalDays,
          presentDays:    attendanceData.presentDays,
          attendanceRate: attendanceData.attendanceRate,
        }
      : null;

    const { pdf } = await import("@react-pdf/renderer");
    const blob = await pdf(
      <TermReportPDF
        term={term}
        year={year}
        cats={cats}
        subjectBreakdowns={subjectBreakdowns}
        formativeRecords={formativeRecords}
        attendance={attendance}
        profile={profile}
        className={className}
        logoUrl={logoUrl}
      />
    ).toBlob();

    triggerPDFDownload(
      blob,
      `Milai_Term${term}_${year}_Report_${profile?.reg_no ?? "student"}.pdf`
    );
  } catch (err) {
    console.error("Term report PDF failed:", err);
    onError?.("Failed to generate Term Report. Please try again.");
  }
};

// ─── AssessmentTable — sticky subject column, CATs scroll right ───────────────

const SUBJECT_COL_WIDTH = 100;
const CAT_COL_WIDTH     = 82;

const AssessmentTable = React.memo(({
  pivotData,
  exams,
  onSubjectClick,
}: {
  pivotData: PivotRow[];
  exams: ExamItem[];
  onSubjectClick: (subject: string) => void;
}) => (
  <div
    className="rounded-lg border border-gray-200"
    style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
  >
    <div
      style={{
        overflowX: "auto",
        overflowY: "auto",
        flex: 1,
        minHeight: 0,
        WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        position: "relative",
        borderRadius: "0.5rem",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          minWidth: `${SUBJECT_COL_WIDTH + exams.length * CAT_COL_WIDTH}px`,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                left: 0,
                top: 0,
                zIndex: 40,
                minWidth: SUBJECT_COL_WIDTH,
                maxWidth: SUBJECT_COL_WIDTH,
                backgroundColor: "#f9fafb",
                borderRight: "2px solid #d1d5db",
                borderBottom: "1px solid #e5e7eb",
                padding: "5px 8px",
                textAlign: "left",
                fontSize: "10px",
                fontWeight: 600,
                color: "#111827",
                whiteSpace: "nowrap",
              }}
            >
              Subject
            </th>
            {exams.map((exam) => (
              <th
                key={exam.id}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  minWidth: CAT_COL_WIDTH,
                  backgroundColor: "#f9fafb",
                  borderRight: "1px solid #e5e7eb",
                  borderBottom: "1px solid #e5e7eb",
                  padding: "5px 8px",
                  textAlign: "center",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {exam.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pivotData.map((row, rowIndex) => {
            const isTotals   = row.subject === "Totals";
            const isPosition = row.subject === "Position";
            const isFooter   = isTotals || isPosition;
            const rowBg      = isTotals ? "#f3f4f6" : isPosition ? "#e5e7eb" : "#ffffff";

            return (
              <tr
                key={rowIndex}
                style={{ backgroundColor: rowBg, cursor: isFooter ? "default" : "pointer" }}
                onClick={() => !isFooter && onSubjectClick(row.subject)}
              >
                <td
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                    minWidth: SUBJECT_COL_WIDTH,
                    maxWidth: SUBJECT_COL_WIDTH,
                    backgroundColor: rowBg,
                    borderRight: "2px solid #d1d5db",
                    borderBottom: "1px solid #f3f4f6",
                    padding: "5px 8px",
                    fontSize: "10px",
                    fontWeight: isFooter ? 700 : 500,
                    color: isFooter ? "#111827" : "#374151",
                    boxShadow: "2px 0 4px -1px rgb(0 0 0 / 0.08)",
                  }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.subject}
                  </div>
                </td>

                {exams.map((exam) => (
                  <td
                    key={exam.id}
                    style={{
                      minWidth: CAT_COL_WIDTH,
                      borderRight: "1px solid #e5e7eb",
                      borderBottom: "1px solid #f3f4f6",
                      padding: "5px 8px",
                      textAlign: "center",
                      fontSize: "10px",
                      fontWeight: isFooter ? 700 : 400,
                      color: isFooter ? "#111827" : "#374151",
                    }}
                  >
                    {row.exams[exam.title] ?? "-"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {exams.length > 2 && (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "6px",
          backgroundColor: "#f9fafb",
          borderTop: "1px solid #e5e7eb",
          borderBottomLeftRadius: "0.5rem",
          borderBottomRightRadius: "0.5rem",
          gap: "6px",
          fontSize: "10px",
          color: "#9ca3af",
        }}
      >
        <ArrowLeft style={{ width: 10, height: 10 }} />
        <span>Scroll to see all CATs</span>
        <ArrowRight style={{ width: 10, height: 10 }} />
      </div>
    )}
  </div>
));

// ─── TermGroupCard ────────────────────────────────────────────────────────────

const TermGroupCard = React.memo(({
  termKey,
  termLabel,
  records,
  profile,
  className,
  logoUrl,
  classId,
  attendanceData,
  onError,
}: {
  termKey: string;
  termLabel: string;
  records: CatRecord[];
  profile: Profile;
  className: string;
  logoUrl: string;
  classId: string | null;
  attendanceData: AttendanceData | null;
  onError: (msg: string) => void;
}) => {
  const [termDownloading, setTermDownloading]   = useState(false);
  const [catDownloading, setCatDownloading]     = useState<Record<string, boolean>>({});

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => {
      const na = parseInt((a.title?.match(/CAT\s*(\d)/i) ?? [])[1] ?? "0");
      const nb = parseInt((b.title?.match(/CAT\s*(\d)/i) ?? [])[1] ?? "0");
      return na - nb;
    }),
    [records]
  );

  const term = sortedRecords[0]?.term;
  const year = sortedRecords[0]?.year;

  const catNumbers = useMemo(
    () => sortedRecords
      .map((r) => { const m = r.title?.match(/CAT\s*(\d)/i); return m ? parseInt(m[1]) : null; })
      .filter((n): n is number => n !== null),
    [sortedRecords]
  );

  const hasAllThreeCats = catNumbers.includes(1) && catNumbers.includes(2) && catNumbers.includes(3);

  const handleCatDownload = useCallback(async (record: CatRecord) => {
    setCatDownloading((prev) => ({ ...prev, [record.assessment_id]: true }));
    await downloadExamPDF(
      record.assessment_id,
      record.student_id,
      profile,
      className,
      logoUrl,
      classId ?? undefined,
      onError,
    );
    setCatDownloading((prev) => ({ ...prev, [record.assessment_id]: false }));
  }, [profile, className, logoUrl, classId, onError]);

  const handleTermReport = useCallback(async () => {
    if (!classId) return;
    setTermDownloading(true);
    await downloadTermReportPDF(
      term,
      year,
      sortedRecords,
      sortedRecords[0]?.student_id,
      classId,
      profile,
      className,
      logoUrl,
      attendanceData,
      onError,
    );
    setTermDownloading(false);
  }, [classId, term, year, sortedRecords, profile, className, logoUrl, attendanceData, onError]);

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-maroon px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm">{termLabel}</h3>
          <p className="text-maroon-100 text-xs opacity-80">
            {sortedRecords.length} of 3 CATs completed
          </p>
        </div>
        {hasAllThreeCats && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTermReport}
            disabled={termDownloading}
            className="bg-white text-maroon hover:bg-maroon-50 border-white text-xs flex items-center gap-1.5 h-8"
          >
            {termDownloading ? (
              <><div className="h-3 w-3 animate-spin rounded-full border-b-2 border-maroon" />Generating...</>
            ) : (
              <><FileBarChart2 className="h-3.5 w-3.5" />Full Term Report</>
            )}
          </Button>
        )}
      </div>

      <CardContent className="p-0 divide-y divide-gray-100">
        {sortedRecords.map((record) => {
          const catMatch  = record.title?.match(/CAT\s*(\d)/i);
          const catLabel  = catMatch ? `CAT ${catMatch[1]}` : record.title;
          const isDownloading = catDownloading[record.assessment_id];

          return (
            <div key={record.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-12 h-8 rounded bg-maroon/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-maroon">{catLabel}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{record.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {new Date(record.assessment_date).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs font-medium text-gray-700">
                      {record.score}/{record.total_score}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <Badge variant="secondary" className="text-xs h-4 px-1">
                      {record.percentage}%
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {record.classPosition && (
                  <Badge className={`text-xs ${
                    record.classPosition === 1 ? "bg-green-100 text-green-800" :
                    record.classPosition === 2 ? "bg-yellow-100 text-yellow-800" :
                    record.classPosition === 3 ? "bg-orange-100 text-orange-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    #{record.classPosition}
                  </Badge>
                )}
                <Badge variant="outline" className={`${getGradeColor(record.grade)} text-xs hidden sm:flex`}>
                  {record.grade.split(" ")[0]}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title={`Download ${catLabel} Result Slip`}
                  onClick={() => handleCatDownload(record)}
                  disabled={isDownloading}
                >
                  {isDownloading ? <PDFLoadingFallback /> : <Download className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          );
        })}

        {!hasAllThreeCats && (
          <div className="px-4 py-2 bg-amber-50 flex items-center gap-2">
            <FileBarChart2 className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Full Term Report available after all 3 CATs are completed
              {catNumbers.length > 0 ? ` (${catNumbers.map((n) => `CAT ${n}`).join(", ")} done)` : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ─── PerformanceCard (mobile) ─────────────────────────────────────────────────

const PerformanceCard = React.memo(({
  record,
  profile,
  className,
  logoUrl,
  classId,
  onError,
}: {
  record: CatRecord;
  profile: Profile;
  className: string;
  logoUrl: string;
  classId: string | null;
  onError: (msg: string) => void;
}) => {
  const [downloading, setDownloading] = useState(false);
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    await downloadExamPDF(record.assessment_id, record.student_id, profile, className, logoUrl, classId ?? undefined, onError);
    setDownloading(false);
  }, [record, profile, className, logoUrl, classId, onError]);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">{record.title}</h3>
            <div className="flex items-center text-xs text-gray-500 mb-2">
              <Calendar className="h-3 w-3 mr-1" />
              {new Date(record.assessment_date).toLocaleDateString()} • {record.term} {record.year}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Score</div>
            <div className="font-medium text-sm">{record.score}/{record.total_score}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Percentage</div>
            <Badge variant="secondary" className="text-xs font-medium">{record.percentage}%</Badge>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Position</div>
            <Badge className={`${
              record.classPosition === 1 ? "bg-green-100 text-green-800" :
              record.classPosition === 2 ? "bg-yellow-100 text-yellow-800" :
              record.classPosition === 3 ? "bg-orange-100 text-orange-800" :
              "bg-gray-100 text-gray-800"
            } text-xs font-medium`}>
              {record.classPosition}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Grade</div>
            <Badge variant="outline" className={`${getGradeColor(record.grade)} text-xs`}>
              {record.grade.split(" ")[0]}
            </Badge>
          </div>
        </div>
        <div className="flex justify-end pt-3 border-t border-gray-100">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={handleDownload} disabled={downloading}>
            {downloading ? <PDFLoadingFallback /> : <Download className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// ─── PerformanceTableRow (desktop) ───────────────────────────────────────────

const PerformanceTableRow = React.memo(({
  record,
  profile,
  className,
  logoUrl,
  classId,
  onError,
}: {
  record: CatRecord;
  profile: Profile;
  className: string;
  logoUrl: string;
  classId: string | null;
  onError: (msg: string) => void;
}) => {
  const [downloading, setDownloading] = useState(false);
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    await downloadExamPDF(record.assessment_id, record.student_id, profile, className, logoUrl, classId ?? undefined, onError);
    setDownloading(false);
  }, [record, profile, className, logoUrl, classId, onError]);

  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="font-medium text-xs sm:text-sm">
        <div>{record.title}</div>
        <div className="text-xs text-gray-500 mt-1">{new Date(record.assessment_date).toLocaleDateString()}</div>
      </TableCell>
      <TableCell className="text-xs sm:text-sm">
        <div>Multiple Subjects</div>
        <div className="text-xs text-gray-500 mt-1">{record.term} {record.year}</div>
      </TableCell>
      <TableCell className="text-xs sm:text-sm">{record.score} / {record.total_score}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">{record.percentage}%</Badge>
        <div className="mt-1">
          <Badge variant="outline" className={`${getGradeColor(record.grade)} text-xs`}>
            {record.grade.split(" ")[0]}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={`${
          record.classPosition === 1 ? "bg-green-100 text-green-800" :
          record.classPosition === 2 ? "bg-yellow-100 text-yellow-800" :
          record.classPosition === 3 ? "bg-orange-100 text-orange-800" :
          "bg-gray-100 text-gray-800"
        } text-xs`}>
          {record.classPosition}
        </Badge>
      </TableCell>
      <TableCell>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={handleDownload} disabled={downloading}>
          {downloading ? <PDFLoadingFallback /> : <Download className="h-3 w-3" />}
        </Button>
      </TableCell>
    </TableRow>
  );
});

// ─── SubjectAnalysisDialog ────────────────────────────────────────────────────

const SubjectAnalysisDialog = React.memo(({
  selectedSubject,
  onClose,
  subjectAssessments,
  teacherInfo,
  analysisLoading,
  revealedContact,
  onContactReveal,
  onToggleFullscreen,
  isFullscreen,
  subjectDialogRef,
}: {
  selectedSubject: string | null;
  onClose: () => void;
  subjectAssessments: Record<string, unknown>[];
  teacherInfo: TeacherInfo | null;
  analysisLoading: boolean;
  revealedContact: RevealedContact | null;
  onContactReveal: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  subjectDialogRef: React.RefObject<HTMLDivElement>;
}) => {
  const summative = useMemo(
    () => subjectAssessments.filter((a) => (a.assessments as Record<string, string>)?.category === "summative"),
    [subjectAssessments]
  );
  const formative = useMemo(
    () => subjectAssessments.filter((a) => (a.assessments as Record<string, string>)?.category === "formative"),
    [subjectAssessments]
  );

  // Group summative by term+year
  const summativeByTerm = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof summative }> = {};
    summative.forEach((a) => {
      const assess = a.assessments as Record<string, string | number>;
      const term = assess?.term ?? "?";
      const year = assess?.year ?? "";
      const key = `${year}-${term}`;
      if (!groups[key]) groups[key] = { label: `Term ${term} · ${year}`, items: [] };
      groups[key].items.push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [summative]);

  // Group formative by term+year
  const formativeByTerm = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof formative }> = {};
    formative.forEach((a) => {
      const assess = a.assessments as Record<string, string | number>;
      const term = assess?.term ?? "?";
      const year = assess?.year ?? "";
      const key = `${year}-${term}`;
      if (!groups[key]) groups[key] = { label: `Term ${term} · ${year}`, items: [] };
      groups[key].items.push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [formative]);

  // Track which term groups are expanded (default: last term open)
  const [openSummativeTerms, setOpenSummativeTerms] = useState<Record<string, boolean>>({});
  const [openFormativeTerms, setOpenFormativeTerms] = useState<Record<string, boolean>>({});

  // Auto-open the last (most recent) term group when data changes
  React.useEffect(() => {
    if (summativeByTerm.length > 0) {
      const lastKey = summativeByTerm[summativeByTerm.length - 1][0];
      setOpenSummativeTerms({ [lastKey]: true });
    }
  }, [summativeByTerm.length]);

  React.useEffect(() => {
    if (formativeByTerm.length > 0) {
      const lastKey = formativeByTerm[formativeByTerm.length - 1][0];
      setOpenFormativeTerms({ [lastKey]: true });
    }
  }, [formativeByTerm.length]);

  const chartData = useMemo(
    () => summative
      .map((a) => ({
        exam:     (a.assessments as Record<string, string>)?.title,
        score:    a.percentage as number,
        date:     a.assessment_date as string,
        fullName: (a.assessments as Record<string, string>)?.title,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [summative]
  );

  const insights = useMemo(() => {
    if (chartData.length < 2) return null;
    const recentExams   = chartData.slice(-3);
    const scores        = recentExams.map((d) => d.score ?? 0);
    const latestScore   = scores[scores.length - 1];
    const previousScore = scores[scores.length - 2];
    const trend         = latestScore > previousScore ? "improving" : latestScore < previousScore ? "declining" : "stable";
    const averageScore  = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    let trendStrength = "moderate";
    if (recentExams.length >= 3) {
      const overallChange = latestScore - scores[0];
      trendStrength = Math.abs(overallChange) >= 15 ? "significant" : Math.abs(overallChange) >= 5 ? "moderate" : "minimal";
    }
    return { trend, trendStrength, averageScore, latestScore, previousScore, examsAnalyzed: recentExams.length };
  }, [chartData]);

  return (
    <Dialog open={!!selectedSubject} onOpenChange={onClose}>
      <DialogContent
        ref={subjectDialogRef}
        className="max-w-[85vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto overflow-x-hidden bg-gradient-to-br from-white to-maroon/5 border-maroon/20 p-2 sm:p-4 md:p-6 [&_*]:break-words [&_*]:min-w-0"
      >
        <DialogHeader className="border-b border-maroon/10 pb-4 mb-4">
          <DialogTitle className="flex items-center text-base sm:text-xl md:text-2xl font-bold text-maroon">
            <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6 md:h-7 md:w-7 mr-2 sm:mr-3 flex-shrink-0 text-maroon" />
            {selectedSubject} Performance Analysis
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base text-gray-600">
            Detailed performance insights and trend analysis for {selectedSubject}
          </DialogDescription>
        </DialogHeader>

        {/* Teacher info — compact bar, always full width, never overflows */}
        <div className="mb-4 w-full">
          <Card className="bg-white shadow-sm w-full">
            <CardContent className="px-3 py-2">
              {analysisLoading ? (
                <div className="animate-pulse flex items-center gap-3">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ) : teacherInfo ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-maroon flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-500">Teacher:</span>
                    <span className="text-xs font-semibold text-gray-900">{teacherInfo.first_name} {teacherInfo.last_name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                    {revealedContact ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 animate-in fade-in slide-in-from-top-1 min-w-0">
                        <div className="flex items-center text-xs text-gray-600 min-w-0">
                          <Mail className="h-3 w-3 mr-1 text-maroon flex-shrink-0" />
                          <span className="truncate">{revealedContact.email}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-600 flex-shrink-0">
                          <Phone className="h-3 w-3 mr-1 text-maroon flex-shrink-0" />
                          <span>{revealedContact.phone}</span>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2 flex-shrink-0" onClick={onContactReveal}>
                        <ShieldAlert className="h-3 w-3 mr-1 flex-shrink-0" /> Contact (Parents Only)
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-xs text-muted-foreground italic">Teacher info not assigned</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6">
            {analysisLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-maroon mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">Loading detailed analysis...</p>
              </div>
            ) : (
              <>
                {chartData.length > 0 && insights && (
                  <>
                    <Card className="bg-white border-maroon/20 shadow-sm">
                      <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                        <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" /> Performance Insights (Summative)
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-gray-600">
                          Based on last {insights.examsAnalyzed} summative exams
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-2 sm:space-y-3">
                            <h4 className="font-semibold text-gray-900 border-b pb-2 text-xs sm:text-sm">Trend Analysis</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700 text-xs sm:text-sm">Current Trend:</span>
                                <Badge className={`${
                                  insights.trend === "improving" ? "bg-green-100 text-green-800 border-green-200" :
                                  insights.trend === "declining" ? "bg-red-100 text-red-800 border-red-200"     :
                                  "bg-blue-100 text-blue-800 border-blue-200"
                                } text-xs`}>
                                  {insights.trend === "improving" ? "📈 Improving" : insights.trend === "declining" ? "📉 Declining" : "➡️ Stable"}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700 text-xs sm:text-sm">Trend Strength:</span>
                                <span className="font-semibold capitalize text-gray-900 text-xs sm:text-sm">{insights.trendStrength}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            <h4 className="font-semibold text-gray-900 border-b pb-2 text-xs sm:text-sm">Performance Metrics</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700 text-xs sm:text-sm">Latest Score:</span>
                                <span className={`font-bold text-base sm:text-lg ${
                                  insights.latestScore >= 90 ? "text-green-600"  : insights.latestScore >= 75 ? "text-emerald-600" :
                                  insights.latestScore >= 58 ? "text-blue-600"   : insights.latestScore >= 41 ? "text-cyan-600"    :
                                  insights.latestScore >= 31 ? "text-yellow-600" : insights.latestScore >= 21 ? "text-orange-600"  :
                                  insights.latestScore >= 11 ? "text-red-600"    : "text-gray-600"
                                }`}>{Math.round(insights.latestScore)}%</span>
                              </div>
                              <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700 text-gray-700 text-xs sm:text-sm">Average Score:</span>
                                <span className="font-semibold text-gray-900 text-xs sm:text-sm">{Math.round(insights.averageScore)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-maroon/20 shadow-sm">
                      <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                        <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" /> Performance Progression (Summative)
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-gray-600">
                          Score trend across all summative exams in {selectedSubject}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-6">
                        <div className="h-[250px] sm:h-[300px] md:h-[350px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
                              <XAxis dataKey="exam" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 10 }} stroke="#9ca3af" interval={0} />
                              <YAxis domain={["dataMin - 15", "dataMax + 15"]} tick={{ fontSize: 9 }} stroke="#9ca3af" tickFormatter={(v) => `${v}%`} width={25} tickCount={6} />
                              <Tooltip
                                contentStyle={{ backgroundColor: "white", border: "1px solid #80000020", borderRadius: "6px", boxShadow: "0 2px 4px -1px rgb(0 0 0 / 0.1)", fontSize: "11px", padding: "8px" }}
                                formatter={(value: number) => [`${value}%`, "Score"]}
                                labelFormatter={(label) => `Exam: ${label}`}
                              />
                              <Line type="monotone" dataKey="score" stroke="#800000" strokeWidth={2}
                                dot={{ r: 3, fill: "#800000", stroke: "#fff", strokeWidth: 1 }}
                                activeDot={{ r: 5, fill: "#800000", stroke: "#fff", strokeWidth: 2 }}
                                name="Score"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {summative.length > 0 && (
                  <Card className="bg-white border-maroon/20 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                      <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" /> Summative Assessments
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4 space-y-2">
                      {summativeByTerm.map(([key, { label, items }]) => {
                        const isOpen = !!openSummativeTerms[key];
                        return (
                          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              onClick={() => setOpenSummativeTerms((prev) => ({ ...prev, [key]: !prev[key] }))}
                            >
                              <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-maroon" />
                                {label}
                                <span className="text-gray-400 font-normal">({items.length} exam{items.length !== 1 ? "s" : ""})</span>
                              </span>
                              <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                            {isOpen && (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Exam</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Score</TableHead>
                                      <TableHead>Level</TableHead>
                                      <TableHead>Remarks</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {items.map((a) => (
                                      <TableRow key={a.id as string}>
                                        <TableCell className="font-medium">{(a.assessments as Record<string, string>)?.title}</TableCell>
                                        <TableCell>{new Date(a.assessment_date as string).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                          {a.is_absent ? <Badge variant="outline">Absent</Badge> :
                                            <span>{a.score as number}/{(a.assessments as Record<string, number>)?.max_marks} ({(a.percentage as number)?.toFixed(1)}%)</span>}
                                        </TableCell>
                                        <TableCell>
                                          {a.is_absent ? <Badge variant="outline">Absent</Badge> :
                                            <PerformanceBadge level={
                                              (a.percentage as number) >= 75 ? "EE" :
                                              (a.percentage as number) >= 50 ? "ME" :
                                              (a.percentage as number) >= 25 ? "AE" : "BE"
                                            } />}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{(a.teacher_remarks as string) ?? "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {formative.length > 0 && (
                  <Card className="bg-white border-maroon/20 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                      <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" /> Formative Assessments
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-gray-600">
                        Performance levels only — no numeric score
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4 space-y-2">
                      {formativeByTerm.map(([key, { label, items }]) => {
                        const isOpen = !!openFormativeTerms[key];
                        return (
                          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              onClick={() => setOpenFormativeTerms((prev) => ({ ...prev, [key]: !prev[key] }))}
                            >
                              <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-maroon" />
                                {label}
                                <span className="text-gray-400 font-normal">({items.length} activit{items.length !== 1 ? "ies" : "y"})</span>
                              </span>
                              <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                            {isOpen && (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Activity</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Level</TableHead>
                                      <TableHead>Remarks</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {items.map((a) => (
                                      <TableRow key={a.id as string}>
                                        <TableCell className="font-medium">{(a.assessments as Record<string, string>)?.title}</TableCell>
                                        <TableCell>{new Date(a.assessment_date as string).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                          {a.is_absent
                                            ? <Badge variant="outline">Absent</Badge>
                                            : a.performance_level
                                              ? <PerformanceBadge level={a.performance_level as string} />
                                              : "-"}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{(a.teacher_remarks as string) ?? "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {summative.length === 0 && formative.length === 0 && (
                  <Card className="bg-white border-maroon/20 text-center py-8">
                    <CardContent>
                      <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                      <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2">No Assessment Data</h3>
                      <p className="text-gray-600 text-xs sm:text-sm">No results found for {selectedSubject}.</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 mt-4 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToggleFullscreen} className="h-9 w-9 p-0 shrink-0">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="default" onClick={onClose} className="flex-1 bg-maroon hover:bg-maroon/90">
            Close Analysis
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

// ─── Annual Trend Chart ───────────────────────────────────────────────────────

const AnnualTrendChart = React.memo(({
  performanceHistory,
  academicCalendar,
}: {
  performanceHistory: CatRecord[];
  academicCalendar: AcademicCalendarTerm[];
}) => {
  const activeYear = useMemo(() => {
    const current = academicCalendar.find((t) => t.is_current);
    if (current) return parseInt(current.academic_year.split("-")[0]);
    if (academicCalendar.length > 0) return parseInt(academicCalendar[0].academic_year.split("-")[0]);
    return new Date().getFullYear();
  }, [academicCalendar]);

  const yearRecords = useMemo(
    () =>
      performanceHistory
        .filter((r) => r.year === activeYear)
        .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()),
    [performanceHistory, activeYear]
  );

  const chartData = useMemo(
    () =>
      yearRecords.map((r) => {
        const catMatch = r.title?.match(/CAT\s*(\d)/i);
        const catNum   = catMatch ? catMatch[1] : "?";
        return {
          label:      `T${r.term} CAT${catNum}`,
          score:      r.percentage,
          term:       Number(r.term),
          date:       r.assessment_date,
          title:      r.title,
          grade:      r.grade,
          position:   r.classPosition,
        };
      }),
    [yearRecords]
  );

  const termBoundaries = useMemo(() => {
    const boundaries: number[] = [];
    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].term !== chartData[i - 1].term) {
        boundaries.push(i);
      }
    }
    return boundaries;
  }, [chartData]);

  const avgScore = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.round(chartData.reduce((s, d) => s + d.score, 0) / chartData.length);
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
          <TrendingUp className="h-8 w-8 text-gray-300" />
          <p className="text-xs text-gray-400">No data yet for Academic Year {activeYear}–{activeYear + 1}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center text-sm font-semibold text-gray-900">
            <TrendingUp className="h-4 w-4 mr-2 text-maroon" />
            Annual Performance Trend — {activeYear}/{activeYear + 1}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-maroon rounded" />
              Score %
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-blue-400 rounded border-dashed border-t border-blue-400" />
              Avg {avgScore}%
            </span>
          </div>
        </div>
        <CardDescription className="text-xs text-gray-500 mt-0.5">
          All CATs across Terms 1–3 · click a dot to see details
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 py-3 sm:px-4 sm:py-4">
        <div className="h-[200px] sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#6b7280" }}
                angle={-35}
                textAnchor="end"
                height={42}
                stroke="#d1d5db"
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#6b7280" }}
                tickFormatter={(v) => `${v}%`}
                width={28}
                stroke="#d1d5db"
                tickCount={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #80000030",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
                  fontSize: "11px",
                  padding: "8px 12px",
                }}
                formatter={(value: number, _: string, props: any) => [
                  `${value}%  ·  ${props.payload?.grade?.split(" ")[0] ?? ""}`,
                  "Score",
                ]}
                labelFormatter={(label: string, payload: any[]) => {
                  const p = payload?.[0]?.payload;
                  return p
                    ? `${p.title} (${new Date(p.date).toLocaleDateString()})${p.position ? ` · #${p.position}` : ""}`
                    : label;
                }}
              />
              <ReferenceLine
                y={avgScore}
                stroke="#60a5fa"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: `Avg ${avgScore}%`, position: "right", fontSize: 9, fill: "#60a5fa" }}
              />
              {termBoundaries.map((idx) => (
                <ReferenceLine
                  key={idx}
                  x={chartData[idx]?.label}
                  stroke="#d1d5db"
                  strokeDasharray="6 3"
                  strokeWidth={1}
                  label={{ value: `Term ${chartData[idx]?.term}`, position: "top", fontSize: 8, fill: "#9ca3af" }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="score"
                stroke="#800000"
                strokeWidth={2}
                dot={{ r: 4, fill: "#800000", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#800000", stroke: "#fff", strokeWidth: 2 }}
                name="Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-center gap-4 mt-2 flex-wrap">
          {[1, 2, 3].map((t) => {
            const termData = chartData.filter((d) => d.term === t);
            if (!termData.length) return null;
            const termAvg = Math.round(termData.reduce((s, d) => s + d.score, 0) / termData.length);
            return (
              <div key={t} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-maroon opacity-60" />
                <span>Term {t}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{termAvg}% avg</Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Assessments({
  studentId,
  classId,
  className,
  profile,
  isOpen,
  onClose,
  attendanceData,
  academicCalendar = [],
}: AssessmentsProps & {
  attendanceData?: AttendanceData;
  academicCalendar?: AcademicCalendarTerm[];
}) {

  const [assessments, setAssessments]               = useState<Record<string, unknown>[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [assessmentsError, setAssessmentsError]     = useState<string | null>(null);
  const [studentRankings, setStudentRankings]       = useState<Record<string, unknown>[]>([]);
  const [subjectAssessments, setSubjectAssessments] = useState<Record<string, unknown>[]>([]);
  const [teacherInfo, setTeacherInfo]               = useState<TeacherInfo | null>(null);
  const [analysisLoading, setAnalysisLoading]       = useState(false);
  const [selectedSubject, setSelectedSubject]       = useState<string | null>(null);
  const [showWarning, setShowWarning]               = useState(false);
  const [revealedContact, setRevealedContact]       = useState<RevealedContact | null>(null);
  const [contactLoading, setContactLoading]         = useState(false);
  const [isFullscreen, setIsFullscreen]             = useState(false);
  const [logoUrl, setLogoUrl]                       = useState<string>("");
  const [pdfError, setPdfError]                     = useState<string | null>(null);

  // ── Term filter defaults to "all" ─────────────────────────────────────────
  const [selectedTermFilter, setSelectedTermFilter] = useState<TermFilterKey>("all");

  const subjectDialogRef = useRef<HTMLDivElement>(null);

  // ── Performance history derived from already-fetched studentRankings ──────
  // Replaces the usePerformanceHistory hook — no extra Supabase calls needed.
  const performanceHistory = useMemo<CatRecord[]>(() => {
    if (!studentRankings.length) return [];
    return (studentRankings as Record<string, unknown>[])
      .map((r) => ({
        id:              `${r.assessment_id}-${studentId}`,
        title:           r.exam_title as string,
        term:            r.term?.toString() ?? "Unknown Term",
        year:            (r.year as number) ?? new Date().getFullYear(),
        assessment_date: r.assessment_date as string,
        subjects:        { name: "Multiple Subjects" } as unknown as string,
        score:           r.total_attained as number,
        total_score:     r.total_possible as number,
        percentage:      r.percentage as number,
        grade:           calculateKJSEAGrade((r.percentage as number) / 100),
        classPosition:   r.class_position as number | null,
        assessment_id:   r.assessment_id as string,
        student_id:      studentId as string,
      }))
      .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
  }, [studentRankings, studentId]);

  // No separate loading/error state needed for performance history —
  // it shares assessmentsLoading since both fetch on the same trigger.
  const performanceLoading = assessmentsLoading;
  const historyError       = assessmentsError;

  // Load logo once per session
  useEffect(() => {
    loadLogoAsBase64().then(setLogoUrl);
  }, []);

  useEffect(() => {
    if (isOpen && studentId && classId) {
      fetchAssessmentsData();
      fetchStudentRankings();
    }
  }, [isOpen, studentId, classId]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handlePdfError = useCallback((msg: string) => {
    setPdfError(msg);
    setTimeout(() => setPdfError(null), 5000);
  }, []);

  const fetchAssessmentsData = async () => {
    if (!studentId || !classId) return;
    setAssessmentsLoading(true);
    setAssessmentsError(null);
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("assessment_results")
        .select(`
          id, student_id, score, performance_level, teacher_remarks, is_absent, assessment_date,
          assessments!inner (
            id, title, term, year, class_id, category, max_marks,
            strand_id, sub_strand_id, strands ( name, code ), sub_strands ( name, code )
          ),
          subjects!inner ( id, name, code )
        `)
        .eq("student_id", studentId)
        .eq("assessments.class_id", classId)
        .eq("status", "published")
        .eq("assessments.category", "summative")
        .in("assessments.year", [currentYear, currentYear - 1])
        .order("assessment_date", { ascending: false })
        .limit(ASSESSMENTS_LIMIT);

      if (error) throw error;

      const processed = (data ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        assessments: Array.isArray(item.assessments) ? (item.assessments as Record<string, unknown>[])[0] : item.assessments,
        subjects:    Array.isArray(item.subjects)    ? (item.subjects    as Record<string, unknown>[])[0] : item.subjects,
        percentage:
          (item.assessments as Record<string, number>)?.max_marks > 0 && item.score !== null
            ? Math.round(((item.score as number) / (item.assessments as Record<string, number>).max_marks) * 100)
            : null,
      }));
      setAssessments(processed);
    } catch (err) {
      console.error("Error fetching assessments:", err);
      setAssessmentsError("Failed to load assessments. Please try again.");
    } finally {
      setAssessmentsLoading(false);
    }
  };

  const fetchStudentRankings = async () => {
    if (!studentId || !classId) return;
    try {
      const { data: rankings, error } = await supabase
        .from("student_rankings")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .order("assessment_date", { ascending: false });

      if (error) throw error;
      if (!rankings?.length) { setStudentRankings([]); return; }

      const assessmentIds = rankings.map((r) => r.assessment_id);
      const { data: aData, error: catErr } = await supabase
        .from("assessments")
        .select("id, category")
        .in("id", assessmentIds);

      if (catErr) throw catErr;

      const catMap = (aData ?? []).reduce<Record<string, string>>((acc, a) => {
        acc[a.id] = a.category;
        return acc;
      }, {});

      setStudentRankings(rankings.filter((r) => catMap[r.assessment_id] === "summative"));
    } catch (err) {
      console.error("Error fetching student rankings:", err);
      setStudentRankings([]);
    }
  };

  const fetchTeacherContact = async () => {
    if (!teacherInfo?.teacher_id) return;
    setContactLoading(true);
    try {
      const { data } = await supabase
        .from("student_teacher_info")
        .select("email, phone")
        .eq("teacher_id", teacherInfo.teacher_id)
        .single();
      setRevealedContact(data);
      setShowWarning(false);
    } catch (err) {
      console.error("Error fetching contact:", err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleSubjectClick = async (subjectName: string) => {
    setSelectedSubject(subjectName);
    setAnalysisLoading(true);
    setRevealedContact(null);

    const subjectEntry = assessments.find(
      (a) => (a.subjects as Record<string, string>)?.name === subjectName
    )?.subjects as Record<string, string> | undefined;

    if (!subjectEntry?.id) { setAnalysisLoading(false); return; }

    try {
      // Fetch summative results (unchanged — from assessment_results)
      const { data: summativeResults, error: sErr } = await supabase
        .from("assessment_results")
        .select(`
          id, student_id, score, performance_level, teacher_remarks, is_absent, assessment_date,
          assessments!inner (
            id, title, term, year, class_id, category, max_marks,
            strand_id, sub_strand_id, strands ( name, code ), sub_strands ( name, code )
          ),
          subjects!inner ( id, name, code )
        `)
        .eq("student_id", studentId)
        .eq("subject_id", subjectEntry.id)
        .eq("status", "published")
        .eq("assessments.category", "summative")
        .order("assessment_date", { ascending: false });

      if (sErr) throw sErr;

      const processedSummative = (summativeResults ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        assessments: Array.isArray(item.assessments) ? (item.assessments as Record<string, unknown>[])[0] : item.assessments,
        subjects:    Array.isArray(item.subjects)    ? (item.subjects    as Record<string, unknown>[])[0] : item.subjects,
        percentage:
          (item.assessments as Record<string, number>)?.max_marks > 0 && item.score !== null
            ? Math.round(((item.score as number) / (item.assessments as Record<string, number>).max_marks) * 100)
            : null,
        _type: "summative",
      }));

      // Fetch formative results from new tables
      const { data: formativeResults, error: fErr } = await supabase
        .from("formative_results")
        .select(`
          id, performance_level, is_absent, teacher_comment, recorded_at,
          formative_activities!inner (
            id, title, description, term, year, activity_date,
            class_id, subject_id,
            strand_id, sub_strand_id,
            strands ( name, code ),
            sub_strands ( name, code )
          )
        `)
        .eq("student_id", studentId)
        .eq("formative_activities.subject_id", subjectEntry.id)
        .order("recorded_at", { ascending: false });

      if (fErr) throw fErr;

      // Normalise formative rows to the same shape the dialog expects
      const processedFormative = (formativeResults ?? []).map((item: Record<string, unknown>) => {
        const act = Array.isArray(item.formative_activities)
          ? (item.formative_activities as Record<string, unknown>[])[0]
          : item.formative_activities as Record<string, unknown>;
        return {
          id:              item.id,
          student_id:      studentId,
          score:           0,
          performance_level: item.performance_level,
          teacher_remarks: item.teacher_comment,   // map teacher_comment → teacher_remarks for dialog reuse
          is_absent:       item.is_absent,
          assessment_date: (act as Record<string, string>)?.activity_date ?? "",
          // Shape assessments sub-object to match what the dialog already renders
          assessments: {
            id:          (act as Record<string, string>)?.id,
            title:       (act as Record<string, string>)?.title ?? "Activity",
            term:        (act as Record<string, unknown>)?.term,
            year:        (act as Record<string, unknown>)?.year,
            category:    "formative",
            max_marks:   0,
            strand_id:   (act as Record<string, unknown>)?.strand_id,
            sub_strand_id: (act as Record<string, unknown>)?.sub_strand_id,
            strands:     (act as Record<string, unknown>)?.strands,
            sub_strands: (act as Record<string, unknown>)?.sub_strands,
          },
          subjects: subjectEntry,
          percentage: null,
          _type: "formative",
        };
      });

      setSubjectAssessments([...processedSummative, ...processedFormative]);

      const { data: tcData } = await supabase
        .from("teacher_classes")
        .select("teacher_id")
        .eq("class_id", classId)
        .eq("subject_id", subjectEntry.id)
        .single();

      if (tcData?.teacher_id) {
        const { data: tData } = await supabase
          .from("student_teacher_info")
          .select("teacher_id, first_name, last_name")
          .eq("teacher_id", tcData.teacher_id)
          .single();
        setTeacherInfo(tData ?? null);
      } else {
        setTeacherInfo(null);
      }
    } catch (err) {
      console.error("Error fetching subject assessments:", err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // ── Memoised derived data ──────────────────────────────────────────────────

  const termFilterOptions = useMemo<Array<{ key: TermFilterKey; label: string; isCurrent: boolean }>>(() => {
    const seen = new Map<string, { term: number; year: number }>();
    assessments.forEach((a) => {
      const assess = a.assessments as Record<string, unknown>;
      const term   = assess?.term;
      const year   = assess?.year;
      if (term !== undefined && year !== undefined) {
        const k = `${year}-${term}`;
        if (!seen.has(k)) seen.set(k, { term: Number(term), year: Number(year) });
      }
    });

    return Array.from(seen.values())
      .sort((a, b) => a.year !== b.year ? b.year - a.year : b.term - a.term)
      .map(({ term, year }) => {
        const key: TermFilterKey = `${year}-${term}`;
        const calEntry = academicCalendar.find(
          (c) => parseInt(c.academic_year.split("-")[0]) === year && c.term === term
        );
        const isCurrent = calEntry?.is_current ?? false;
        return {
          key,
          label: `Term ${term} ${year}`,
          isCurrent,
        };
      });
  }, [assessments, academicCalendar]);

  const filteredAssessments = useMemo(() => {
    if (selectedTermFilter === "all") return assessments;
    const [yearStr, termStr] = selectedTermFilter.split("-");
    const filterYear = parseInt(yearStr);
    const filterTerm = parseInt(termStr);
    return assessments.filter((a) => {
      const assess = a.assessments as Record<string, unknown>;
      return Number(assess?.year) === filterYear && Number(assess?.term) === filterTerm;
    });
  }, [assessments, selectedTermFilter]);

  const filteredRankings = useMemo(() => {
    if (selectedTermFilter === "all") return studentRankings;
    const [yearStr, termStr] = selectedTermFilter.split("-");
    const filterYear = parseInt(yearStr);
    const filterTerm = parseInt(termStr);
    return (studentRankings as Record<string, unknown>[]).filter(
      (r) => Number(r.year) === filterYear && Number(r.term) === filterTerm
    );
  }, [studentRankings, selectedTermFilter]);

  const exams = useMemo<ExamItem[]>(() => {
    const seen = new Map<string, { id: string; title: string; sortKey: number }>();
    filteredAssessments.forEach((a) => {
      const assess = a.assessments as Record<string, unknown>;
      const title  = assess?.title as string | undefined;
      const term   = assess?.term;
      const year   = assess?.year;
      if (!title) return;
      // When showing all terms, scope the column key to term so "CAT 1 T1"
      // and "CAT 1 T2" become separate columns instead of collapsing into one.
      const colKey = selectedTermFilter === "all"
        ? `${title} (T${term})`
        : title;
      if (!seen.has(colKey)) {
        // Sort: year asc → term asc → exam number asc
        const sortKey = selectedTermFilter === "all"
          ? (Number(year) * 100 + Number(term)) * 1000 + extractExamNumber(title)
          : extractExamNumber(title);
        seen.set(colKey, { id: colKey, title: colKey, sortKey });
      }
    });
    return Array.from(seen.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ id, title }) => ({ id, title }));
  }, [filteredAssessments, selectedTermFilter]);

  const pivotData = useMemo<PivotRow[]>(() => {
    if (!filteredAssessments.length || !studentId) return [];
    const examTitles = exams.map((e) => e.title);
    const grouped: Record<string, PivotRow> = {};

    filteredAssessments.forEach((a) => {
      if (String(a.student_id) !== String(studentId)) return;
      const subject   = (a.subjects as Record<string, string>)?.name ?? "Unknown Subject";
      const examTitle = (a.assessments as Record<string, string>)?.title ?? "Untitled Exam";
      const term      = (a.assessments as Record<string, unknown>)?.term;
      // Match the same key used in the exams memo
      const colKey = selectedTermFilter === "all" ? `${examTitle} (T${term})` : examTitle;
      if (!grouped[subject]) grouped[subject] = { subject, exams: {} };
      grouped[subject].exams[colKey] = a.score !== null ? Number(a.score) : "-";
    });

    const rows: PivotRow[] = Object.values(grouped).map((row) => ({
      subject: row.subject,
      exams: examTitles.reduce<Record<string, string | number>>((acc, title) => {
        acc[title] = row.exams[title] ?? "-";
        return acc;
      }, {}),
    }));

    if (filteredRankings.length > 0) {
      // Key by assessment_id — this is unique per exam, so "CAT 1 Term 1" and
      // "CAT 1 Term 2" never overwrite each other the way exam_title alone would.
      const rankingMap: Record<string, Record<string, unknown>> = {};
      (filteredRankings as Record<string, unknown>[]).forEach((r) => {
        if (r.assessment_id) rankingMap[r.assessment_id as string] = r;
      });

      // Build a lookup from colKey → assessment_id using filteredAssessments
      const colKeyToAssessmentId: Record<string, string> = {};
      filteredAssessments.forEach((a) => {
        const examTitle = (a.assessments as Record<string, string>)?.title ?? "";
        const term      = (a.assessments as Record<string, unknown>)?.term;
        const aId       = (a.assessments as Record<string, string>)?.id;
        const colKey    = selectedTermFilter === "all" ? `${examTitle} (T${term})` : examTitle;
        if (aId && !colKeyToAssessmentId[colKey]) colKeyToAssessmentId[colKey] = aId;
      });

      const totals: Record<string, string | number> = {};
      const positions: Record<string, string | number> = {};
      examTitles.forEach((colKey) => {
        const aId = colKeyToAssessmentId[colKey];
        const r   = aId ? rankingMap[aId] : undefined;
        totals[colKey]    = r ? `${r.total_attained}/${r.total_possible}` : "-";
        positions[colKey] = r ? (r.class_position as number) : "-";
      });
      return [...rows, { subject: "Totals", exams: totals }, { subject: "Position", exams: positions }];
    }
    return rows;
  }, [filteredAssessments, studentId, exams, filteredRankings, selectedTermFilter]);

  const groupedByTerm = useMemo<TermGroup[]>(() => {
    if (!performanceHistory?.length) return [];
    const map = new Map<string, TermGroup>();
    performanceHistory.forEach((record) => {
      const key = `${record.year}-${record.term}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          termLabel: `Term ${record.term}, ${record.year}`,
          term: record.term,
          year: record.year,
          records: [],
        });
      }
      map.get(key)!.records.push(record);
    });
    return Array.from(map.values()).sort((a, b) =>
      `${b.year}-${b.term}`.localeCompare(`${a.year}-${a.term}`)
    );
  }, [performanceHistory]);

  const performanceInsights = useMemo(() => {
    if (!performanceHistory || performanceHistory.length < 2) return null;
    const recent       = performanceHistory.slice(0, 6);
    const latestScore  = recent[0].percentage;
    const prevScore    = recent[1].percentage;
    const averageScore = Math.round(recent.reduce((s, r) => s + r.percentage, 0) / recent.length);
    const topPositions = recent.filter((r) => r.classPosition !== null && r.classPosition <= 3).length;
    const trend        = latestScore > prevScore ? "improving" : latestScore < prevScore ? "declining" : "stable";
    let performanceLevel = "";
    if      (averageScore >= 90) performanceLevel = "Exceptional (EE1)";
    else if (averageScore >= 75) performanceLevel = "Excellent (EE2)";
    else if (averageScore >= 58) performanceLevel = "Very Good (ME1)";
    else if (averageScore >= 41) performanceLevel = "Good (ME2)";
    else if (averageScore >= 31) performanceLevel = "Average (AE1)";
    else if (averageScore >= 21) performanceLevel = "Below Average (AE2)";
    else if (averageScore >= 11) performanceLevel = "Poor (BE1)";
    else                          performanceLevel = "Very Poor (BE2)";
    return { trend, performanceLevel, averageScore, topPositions, latestScore, previousScore: prevScore };
  }, [performanceHistory]);

  const bestPosition = useMemo(() => {
    if (!performanceHistory?.length) return "-";
    const positions = performanceHistory
      .map((r) => r.classPosition)
      .filter((p): p is number => typeof p === "number");
    return positions.length > 0 ? Math.min(...positions) : "-";
  }, [performanceHistory]);

  const toggleFullscreen = useCallback(() => {
    if (!subjectDialogRef.current) return;
    if (!document.fullscreenElement) {
      subjectDialogRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  }, []);

  const [activeTab, setActiveTab] = useState<"assessments" | "performance">("assessments");

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent
        className="max-w-[95vw] lg:max-w-6xl p-0 flex flex-col gap-0"
        style={{ height: "90vh", maxHeight: "90vh", overflow: "hidden" }}
      >
        {/* ── Fixed header ── */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 bg-white">
          <div>
            <DialogTitle className="flex items-center text-lg sm:text-xl text-maroon font-bold">
              <BookOpen className="h-5 w-5 mr-2" /> Assessments &amp; Performance
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 mt-0.5">
              View your assessment results and performance history
            </DialogDescription>
          </div>
          {pdfError && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <span className="flex-1">{pdfError}</span>
              <button onClick={() => setPdfError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-1 mx-4 mt-1 sm:mt-2 h-9 rounded-md bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab("assessments")}
            className={`rounded-sm text-xs sm:text-sm font-medium transition-all ${
              activeTab === "assessments"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Assessments
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`rounded-sm text-xs sm:text-sm font-medium transition-all ${
              activeTab === "performance"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Performance History
          </button>
        </div>

        {/* ── ASSESSMENTS PANEL ── */}
        {activeTab === "assessments" && (
          <div
            className="flex-1 min-h-0 px-4 pb-4 mt-2 sm:mt-3"
            style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {assessmentsLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-maroon" />
                <p className="text-gray-600 text-sm">Loading assessment results...</p>
              </div>
            ) : assessmentsError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-red-600 text-sm">{assessmentsError}</p>
                <Button variant="outline" size="sm" onClick={fetchAssessmentsData}>Retry</Button>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {/* ── Term filter bar — compact on mobile ── */}
                {termFilterOptions.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "6px", marginTop: "18px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => setSelectedTermFilter("all")}
                      style={{
                        all: "unset" as any,
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "9999px",
                        border: `1px solid ${selectedTermFilter === "all" ? "#800000" : "#d1d5db"}`,
                        fontWeight: 500,
                        fontSize: "9px",
                        lineHeight: 1,
                        padding: "1.5px 4px",
                        cursor: "pointer",
                        backgroundColor: selectedTermFilter === "all" ? "#800000" : "#ffffff",
                        color: selectedTermFilter === "all" ? "#ffffff" : "#4b5563",
                      }}
                    >
                      All
                    </button>
                    {termFilterOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedTermFilter(opt.key)}
                        style={{
                          all: "unset" as any,
                          boxSizing: "border-box",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          borderRadius: "9999px",
                          border: `1px solid ${
                            selectedTermFilter === opt.key
                              ? "#800000"
                              : opt.isCurrent
                              ? "rgba(128,0,0,0.3)"
                              : "#d1d5db"
                          }`,
                          fontWeight: 500,
                          fontSize: "9px",
                          lineHeight: 1,
                          padding: "1.5px 4px",
                          cursor: "pointer",
                          backgroundColor:
                            selectedTermFilter === opt.key
                              ? "#800000"
                              : opt.isCurrent
                              ? "rgba(128,0,0,0.08)"
                              : "#ffffff",
                          color:
                            selectedTermFilter === opt.key
                              ? "#ffffff"
                              : opt.isCurrent
                              ? "#800000"
                              : "#4b5563",
                        }}
                      >
                        {opt.label}
                        {opt.isCurrent && selectedTermFilter !== opt.key && (
                          <span style={{ display: "inline-block", width: "5px", height: "5px", borderRadius: "9999px", backgroundColor: "#22c55e", flexShrink: 0 }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {pivotData.length > 0 ? (
                  <AssessmentTable
                    pivotData={pivotData}
                    exams={exams}
                    onSubjectClick={handleSubjectClick}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <BookOpen className="h-10 w-10 text-gray-400" />
                    <p className="text-gray-600 text-sm">
                      {selectedTermFilter === "all"
                        ? "No assessment results found."
                        : `No results found for this term. Try a different term or "All".`}
                    </p>
                    {selectedTermFilter !== "all" && (
                      <Button variant="outline" size="sm" onClick={() => setSelectedTermFilter("all")}>
                        View All Terms
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PERFORMANCE HISTORY PANEL ── */}
        {activeTab === "performance" && (
          <div
            className="flex-1 min-h-0 px-4 pb-4 pt-0"
            style={{ overflowY: "auto", paddingTop: "30px" }}
          >
            {performanceLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-maroon" />
                <p className="text-gray-600 text-sm">Loading performance history...</p>
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-red-600 text-sm">{historyError}</p>
              </div>
            ) : !performanceHistory?.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <TrendingUp className="h-10 w-10 text-gray-400" />
                <p className="text-gray-600 text-sm">No performance records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnnualTrendChart
                  performanceHistory={performanceHistory}
                  academicCalendar={academicCalendar}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <Card className="border-l-4 border-l-maroon">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-maroon">{performanceHistory.length}</div>
                      <p className="text-xs text-gray-600 mt-0.5">Exams Tracked</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {Math.round(performanceHistory.reduce((s, r) => s + r.percentage, 0) / performanceHistory.length)}%
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">Avg Score</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-purple-600">
                        {performanceHistory.filter((r) => r.grade.includes("EE1") || r.grade.includes("EE2")).length}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">Excellent</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-orange-600">{bestPosition}</div>
                      <p className="text-xs text-gray-600 mt-0.5">Best Position</p>
                    </CardContent>
                  </Card>
                </div>

                {performanceInsights && (
                  <Card className="bg-maroon/5 border-maroon/20">
                    <CardContent className="p-3 space-y-1 text-xs sm:text-sm text-gray-700">
                      <p>
                        <span className="font-semibold">Trend: </span>
                        Your performance is{" "}
                        <span className={
                          performanceInsights.trend === "improving" ? "text-green-600 font-semibold" :
                          performanceInsights.trend === "declining"  ? "text-red-600 font-semibold"   :
                          "text-blue-600 font-semibold"
                        }>{performanceInsights.trend}</span>
                      </p>
                      <p><span className="font-semibold">Overall Level: </span>{performanceInsights.performanceLevel}</p>
                      <p><span className="font-semibold">Achievements: </span>{performanceInsights.topPositions} top-3 positions in recent exams</p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileBarChart2 className="h-4 w-4 text-maroon flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-900">Results by Term</h3>
                  </div>
                  {groupedByTerm.map(({ key, termLabel, records }) => (
                    <TermGroupCard
                      key={key}
                      termKey={key}
                      termLabel={termLabel}
                      records={records}
                      profile={profile as Profile}
                      className={className ?? ""}
                      logoUrl={logoUrl}
                      classId={classId}
                      attendanceData={attendanceData ?? null}
                      onError={handlePdfError}
                    />
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <PDFDownloadLink
                    document={
                      <PerformanceHistoryPDF
                        performanceHistory={performanceHistory}
                        profile={profile}
                        className={className ?? ""}
                        logoUrl={logoUrl}
                      />
                    }
                    fileName={`Milai_School_Performance_History_${(profile as Profile)?.reg_no ?? "student"}.pdf`}
                  >
                    {({ loading }) => (
                      <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs" disabled={loading}>
                        {loading
                          ? <><PDFLoadingFallback />Generating...</>
                          : <><Download className="h-3 w-3" />Download All Exams PDF</>
                        }
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sticky bottom close ── */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
          <Button variant="default" onClick={onClose} className="w-full bg-maroon hover:bg-maroon/90">
            Close
          </Button>
        </div>

        {/* Subject analysis dialog */}
        <SubjectAnalysisDialog
          selectedSubject={selectedSubject}
          onClose={() => setSelectedSubject(null)}
          subjectAssessments={subjectAssessments}
          teacherInfo={teacherInfo}
          analysisLoading={analysisLoading}
          revealedContact={revealedContact}
          onContactReveal={() => setShowWarning(true)}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          subjectDialogRef={subjectDialogRef}
        />

        {/* Parent contact warning dialog */}
        <Dialog open={showWarning} onOpenChange={setShowWarning}>
          <DialogContent className="sm:max-w-[425px] max-w-[95vw] mx-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600 text-sm sm:text-base">
                <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" /> Security Policy Warning
              </DialogTitle>
              <DialogDescription className="py-3 text-xs sm:text-sm">
                Teacher contact details are shared exclusively for parental communication regarding student welfare.
                <br /><br />
                <span className="text-red-600 font-bold">
                  Unauthorized use or sharing of this information by students is a violation of school policy.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" onClick={() => setShowWarning(false)} className="text-xs sm:text-sm">Cancel</Button>
              <Button
                className="bg-maroon hover:bg-maroon/90 text-xs sm:text-sm"
                onClick={fetchTeacherContact}
                disabled={contactLoading}
              >
                {contactLoading ? "Verifying..." : "I am a Parent, I Accept"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}