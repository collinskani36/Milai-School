
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle } from "@/Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
import TermReportPDF from "@/Components/TermReportPDF"; // NEW

const isNative =
  Capacitor &&
  typeof Capacitor.isNativePlatform === "function" &&
  Capacitor.isNativePlatform();

const PDFLoadingFallback = () => (
  <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-maroon" />
);

// ─── Unchanged: fetch subject breakdown for one assessment ────────────────────
const fetchSubjectBreakdownForAssessment = async (
  studentId: string,
  assessmentId: string
) => {
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

  return (data || []).map((item: any) => {
    const subj   = Array.isArray(item.subjects)    ? item.subjects[0]    : item.subjects;
    const assess = Array.isArray(item.assessments) ? item.assessments[0] : item.assessments;
    const maxMarks = assess?.max_marks ?? 100;
    const score    = item.score ?? 0;
    return {
      subject:           subj?.name,
      code:              subj?.code,
      score,
      max_marks:         maxMarks,
      percentage:        maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0,
      performance_level: item.performance_level,
      teacher_remarks:   item.teacher_remarks,
      is_absent:         item.is_absent,
      grade:             calculateKJSEAGrade(maxMarks > 0 ? score / maxMarks : 0),
    };
  });
};

// ─── Unchanged: individual CAT PDF download ───────────────────────────────────
const downloadExamPDF = async (
  assessmentId: string,
  studentId: string,
  profile: any,
  className: string,
  logoUrl: string,
  classId?: string,
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
      alert("No subject data available for this exam. Make sure results are published.");
      return;
    }

    const totalScore    = ranking?.total_attained ?? subjects.reduce((sum, s) => sum + (s.score     || 0), 0);
    const totalPossible = ranking?.total_possible ?? subjects.reduce((sum, s) => sum + (s.max_marks || 0), 0);
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

    if (isNative) {
      window.open(URL.createObjectURL(blob), "_blank");
    } else {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = `Milai_School_${assessment.title.replace(/\s+/g, "_")}_${profile?.reg_no || "result"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("PDF download failed:", error);
    alert("Failed to generate exam PDF. Check the browser console for details.");
  }
};

// ─── NEW: Full Term Report PDF download ───────────────────────────────────────
// Fetches all required data then renders TermReportPDF and triggers download.
const downloadTermReportPDF = async (
  term: string | number,
  year: number,
  cats: any[],           // summative CAT records for this term
  studentId: string,
  classId: string,
  profile: any,
  className: string,
  logoUrl: string,
  attendanceData: any | null,
) => {
  try {
    // 1. Fetch subject breakdowns for all 3 CATs in parallel
    const breakdownResults = await Promise.all(
      cats.map((cat) =>
        fetchSubjectBreakdownForAssessment(studentId, cat.assessment_id)
      )
    );
    const subjectBreakdowns: Record<string, any[]> = {};
    cats.forEach((cat, i) => {
      subjectBreakdowns[cat.assessment_id] = breakdownResults[i];
    });

    // 2. Fetch all formative assessment_results for this student, class, term, year
    const { data: formativeRaw, error: fErr } = await supabase
      .from("assessment_results")
      .select(`
        id,
        student_id,
        score,
        performance_level,
        teacher_remarks,
        is_absent,
        assessment_date,
        assessments!inner (
          id, title, term, year, class_id, category,
          strand_id, sub_strand_id,
          strands ( name ),
          sub_strands ( name )
        ),
        subjects ( name )
      `)
      .eq("student_id", studentId)
      .eq("assessments.class_id", classId)
      .eq("assessments.category", "formative")
      .eq("assessments.term", term)
      .eq("assessments.year", year)
      .eq("status", "published")
      .order("assessment_date", { ascending: true });

    if (fErr) throw fErr;

    const formativeRecords = (formativeRaw || []).map((item: any) => {
      const assess  = Array.isArray(item.assessments) ? item.assessments[0] : item.assessments;
      const strand  = Array.isArray(assess?.strands)    ? assess.strands[0]    : assess?.strands;
      const sub     = Array.isArray(assess?.sub_strands) ? assess.sub_strands[0] : assess?.sub_strands;
      const subject = Array.isArray(item.subjects)       ? item.subjects[0]      : item.subjects;
      return {
        id:               item.id,
        assessment_date:  item.assessment_date,
        title:            assess?.title || "Activity",
        strand:           strand?.name  || "",
        sub_strand:       sub?.name     || "",
        performance_level: item.performance_level || "",
        teacher_remarks:  item.teacher_remarks || "",
        is_absent:        item.is_absent || false,
        subject:          subject?.name || "",
      };
    });

    // 3. Build attendance summary scoped to the term
    // We use the passed-in attendanceData (full year) — term-scoped filtering
    // would require date ranges; for now pass the full attendance summary with a note.
    // If you add term_start/term_end to your schema later, filter here.
    const attendance = attendanceData
      ? {
          totalDays:      attendanceData.totalDays,
          presentDays:    attendanceData.presentDays,
          attendanceRate: attendanceData.attendanceRate,
        }
      : null;

    // 4. Render and download
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

    const fileName = `Milai_Term${term}_${year}_Report_${profile?.reg_no || "student"}.pdf`;
    if (isNative) {
      window.open(URL.createObjectURL(blob), "_blank");
    } else {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("Term report PDF failed:", err);
    alert("Failed to generate Term Report. Check the console for details.");
  }
};

// ─── Performance history hook — filters to summative only ────────────────────
const usePerformanceHistory = (studentId: string | null, classId: string | null) => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !classId) return;
    const fetchPerformanceHistory = async () => {
      setLoading(true);
      try {
        const { data: rankings, error } = await supabase
          .from("student_rankings")
          .select("*")
          .eq("student_id", studentId)
          .eq("class_id", classId)
          .order("assessment_date", { ascending: false });

        if (error) throw error;
        if (!rankings?.length) { setData([]); return; }

        const assessmentIds = rankings.map((r) => r.assessment_id);
        const { data: assessments, error: catError } = await supabase
          .from("assessments")
          .select("id, category")
          .in("id", assessmentIds);

        if (catError) throw catError;

        const categoryMap = (assessments || []).reduce((acc, a) => {
          acc[a.id] = a.category;
          return acc;
        }, {} as Record<string, string>);

        const summativeRankings = rankings.filter(
          (r) => categoryMap[r.assessment_id] === "summative"
        );

        const history = summativeRankings.map((r: any) => ({
          id:              `${r.assessment_id}-${studentId}`,
          title:           r.exam_title,
          term:            r.term?.toString() || "Unknown Term",
          year:            r.year || new Date().getFullYear(),
          assessment_date: r.assessment_date,
          subjects:        { name: "Multiple Subjects" },
          score:           r.total_attained,
          total_score:     r.total_possible,
          percentage:      r.percentage,
          grade:           calculateKJSEAGrade(r.percentage / 100),
          classPosition:   r.class_position,
          assessment_id:   r.assessment_id,
          student_id:      studentId,
        }));

        setData(history);
      } catch (err) {
        console.error("Error fetching performance history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformanceHistory();
  }, [studentId, classId]);

  return { data, loading };
};

// ─── AssessmentTable (unchanged) ─────────────────────────────────────────────
const AssessmentTable = React.memo(({ pivotData, exams, onSubjectClick, scrollLeft, scrollRight }: any) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <p className="text-xs sm:text-sm text-gray-600">
        Showing {pivotData.length - 2} subjects • {exams.length} exams
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={scrollLeft} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={scrollRight} className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
    <div className="relative overflow-hidden rounded-lg border">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <Table className="min-w-full border-collapse">
          <TableHeader className="bg-maroon-50">
            <TableRow>
              <TableHead className="font-semibold text-gray-900 text-xs sm:text-sm px-3 py-2 sticky left-0 bg-maroon-50 z-20 border-r border-gray-200 min-w-[120px] sm:min-w-[150px]">
                Subject
              </TableHead>
              {exams.map((exam: any) => (
                <TableHead key={exam.id} className="font-semibold text-gray-900 text-xs sm:text-sm px-3 py-2 border-r border-gray-200 min-w-[100px] sm:min-w-[120px]">
                  <div className="whitespace-normal break-words">{exam.title}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pivotData.map((row: any, rowIndex: number) => (
              <TableRow
                key={rowIndex}
                className={
                  row.subject === "Totals"   ? "font-bold bg-gray-50" :
                  row.subject === "Position" ? "font-bold bg-gray-100" :
                  "hover:bg-gray-50 cursor-pointer"
                }
                onClick={() =>
                  row.subject !== "Totals" &&
                  row.subject !== "Position" &&
                  onSubjectClick(row.subject)
                }
              >
                <TableCell className={`${
                  row.subject === "Totals" || row.subject === "Position"
                    ? "font-bold text-gray-900"
                    : "font-medium text-gray-700"
                } text-xs sm:text-sm px-3 py-2 sticky left-0 z-10 bg-white border-r border-gray-200 min-w-[120px] sm:min-w-[150px]`}>
                  <div className="whitespace-normal break-words">{row.subject}</div>
                </TableCell>
                {exams.map((exam: any) => (
                  <TableCell key={exam.id} className={`${
                    row.subject === "Totals" || row.subject === "Position"
                      ? "font-bold text-gray-900"
                      : "text-gray-700"
                  } text-xs sm:text-sm px-3 py-2 border-r border-gray-200 min-w-[100px] sm:min-w-[120px]`}>
                    <div className="whitespace-normal break-words">{row.exams[exam.title] ?? "-"}</div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {exams.length > 3 && (
        <div className="flex justify-center items-center p-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ArrowLeft className="h-3 w-3" />
            <span>Swipe or use buttons to view more exams</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  </div>
));

// ─── NEW: TermGroupCard — one card per term in Performance History ─────────────
// Shows individual CAT download buttons + "Full Term Report" when 3 CATs done.
const TermGroupCard = React.memo(({
  termKey,
  termLabel,
  records,
  profile,
  className,
  logoUrl,
  classId,
  attendanceData,
}: {
  termKey: string;
  termLabel: string;
  records: any[];
  profile: any;
  className: string;
  logoUrl: string;
  classId: string | null;
  attendanceData: any | null;
}) => {
  const [termDownloading, setTermDownloading] = useState(false);
  const [catDownloading, setCatDownloading]   = useState<Record<string, boolean>>({});

  // Sort CATs: CAT 1 → CAT 2 → CAT 3
  const sortedRecords = [...records].sort((a, b) => {
    const na = parseInt((a.title?.match(/CAT\s*(\d)/i) || [])[1] || "0");
    const nb = parseInt((b.title?.match(/CAT\s*(\d)/i) || [])[1] || "0");
    return na - nb;
  });

  // Extract term/year from first record
  const term = sortedRecords[0]?.term;
  const year = sortedRecords[0]?.year;

  // Detect if all 3 CATs are present
  const catNumbers = sortedRecords.map((r) => {
    const m = r.title?.match(/CAT\s*(\d)/i);
    return m ? parseInt(m[1]) : null;
  }).filter(Boolean);
  const hasAllThreeCats =
    catNumbers.includes(1) && catNumbers.includes(2) && catNumbers.includes(3);

  const handleCatDownload = async (record: any) => {
    setCatDownloading((prev) => ({ ...prev, [record.assessment_id]: true }));
    await downloadExamPDF(
      record.assessment_id,
      record.student_id,
      profile,
      className,
      logoUrl,
      classId || undefined,
    );
    setCatDownloading((prev) => ({ ...prev, [record.assessment_id]: false }));
  };

  const handleTermReport = async () => {
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
    );
    setTermDownloading(false);
  };

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden">
      {/* Term header */}
      <div className="bg-maroon px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm">{termLabel}</h3>
          <p className="text-maroon-100 text-xs opacity-80">
            {sortedRecords.length} of 3 CATs completed
          </p>
        </div>
        {/* Full Term Report button — only when all 3 CATs are present */}
        {hasAllThreeCats && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTermReport}
            disabled={termDownloading}
            className="bg-white text-maroon hover:bg-maroon-50 border-white text-xs flex items-center gap-1.5 h-8"
          >
            {termDownloading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-maroon" />
                Generating...
              </>
            ) : (
              <>
                <FileBarChart2 className="h-3.5 w-3.5" />
                Full Term Report
              </>
            )}
          </Button>
        )}
      </div>

      <CardContent className="p-0 divide-y divide-gray-100">
        {sortedRecords.map((record) => {
          const catMatch = record.title?.match(/CAT\s*(\d)/i);
          const catLabel = catMatch ? `CAT ${catMatch[1]}` : record.title;
          const isDownloading = catDownloading[record.assessment_id];

          return (
            <div
              key={record.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* CAT badge */}
                <div className="flex-shrink-0 w-12 h-8 rounded bg-maroon/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-maroon">{catLabel}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{record.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
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
                {/* Class position badge */}
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
                {/* Grade badge */}
                <Badge variant="outline" className={`${getGradeColor(record.grade)} text-xs hidden sm:flex`}>
                  {record.grade.split(" ")[0]}
                </Badge>
                {/* Individual CAT PDF download */}
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

        {/* "Term report not yet available" hint when < 3 CATs */}
        {!hasAllThreeCats && (
          <div className="px-4 py-2 bg-amber-50 flex items-center gap-2">
            <FileBarChart2 className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Full Term Report available after all 3 CATs are completed
              {catNumbers.length > 0
                ? ` (${catNumbers.map((n) => `CAT ${n}`).join(", ")} done)`
                : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ─── PerformanceCard (mobile, unchanged) ─────────────────────────────────────
const PerformanceCard = React.memo(({ record, profile, className, logoUrl, classId }: any) => {
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    await downloadExamPDF(record.assessment_id, record.student_id, profile, className, logoUrl, classId);
    setDownloading(false);
  };
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
          <Button
            variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={handleDownload} disabled={downloading}
          >
            {downloading ? <PDFLoadingFallback /> : <Download className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// ─── PerformanceTableRow (desktop, unchanged) ─────────────────────────────────
const PerformanceTableRow = React.memo(({ record, profile, className, logoUrl, classId }: any) => {
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    await downloadExamPDF(record.assessment_id, record.student_id, profile, className, logoUrl, classId);
    setDownloading(false);
  };
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="font-medium text-xs sm:text-sm">
        <div>{record.title}</div>
        <div className="text-xs text-gray-500 mt-1">{new Date(record.assessment_date).toLocaleDateString()}</div>
      </TableCell>
      <TableCell className="text-xs sm:text-sm">
        <div>{record.subjects.name}</div>
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
        <Button variant="outline" size="sm" className="h-7 w-7 p-0"
          onClick={handleDownload} disabled={downloading}>
          {downloading ? <PDFLoadingFallback /> : <Download className="h-3 w-3" />}
        </Button>
      </TableCell>
    </TableRow>
  );
});

// ─── SubjectAnalysisDialog (unchanged) ───────────────────────────────────────
const SubjectAnalysisDialog = React.memo(({
  selectedSubject, onClose, subjectAssessments, teacherInfo,
  analysisLoading, revealedContact, showWarning, contactLoading,
  onContactReveal, onToggleFullscreen, isFullscreen, subjectDialogRef,
}: any) => {
  const summative = subjectAssessments.filter((a: any) => a.assessments?.category === "summative");
  const formative = subjectAssessments.filter((a: any) => a.assessments?.category === "formative");

  const chartData = summative
    .map((a: any) => ({ exam: a.assessments?.title, score: a.percentage, date: a.assessment_date, fullName: a.assessments?.title }))
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const insights = useMemo(() => {
    if (chartData.length < 2) return null;
    const recentExams   = chartData.slice(-3);
    const scores        = recentExams.map((d: any) => d.score!);
    const latestScore   = scores[scores.length - 1];
    const previousScore = scores[scores.length - 2];
    const trend         = latestScore > previousScore ? "improving" : latestScore < previousScore ? "declining" : "stable";
    const averageScore  = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    let trendStrength = "moderate";
    if (recentExams.length >= 3) {
      const overallChange = latestScore - scores[0];
      trendStrength = Math.abs(overallChange) >= 15 ? "significant" : Math.abs(overallChange) >= 5 ? "moderate" : "minimal";
    }
    return { trend, trendStrength, averageScore, latestScore, previousScore, examsAnalyzed: recentExams.length };
  }, [chartData]);

  return (
    <Dialog open={!!selectedSubject} onOpenChange={onClose}>
      <DialogContent ref={subjectDialogRef} className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-white to-maroon/5 border-maroon/20 p-3 sm:p-4 md:p-6">
        <DialogHeader className="border-b border-maroon/10 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <DialogTitle className="flex items-center text-lg sm:text-xl md:text-2xl font-bold text-maroon">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 mr-2 sm:mr-3 text-maroon" />
                {selectedSubject} Performance Analysis
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm md:text-base text-gray-600">
                Detailed performance insights and trend analysis for {selectedSubject}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onToggleFullscreen} className="ml-2 h-8 w-8 p-0">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="lg:col-span-1 bg-white shadow-sm">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                <User className="h-3 w-3 sm:h-4 sm:w-4 mr-2" /> Subject Teacher
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {analysisLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ) : teacherInfo ? (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="font-bold text-base sm:text-lg">{teacherInfo.first_name} {teacherInfo.last_name}</p>
                    <Badge variant="outline" className="mt-1 text-xs">Lead Instructor</Badge>
                  </div>
                  <div className="pt-2 border-t">
                    {revealedContact ? (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center text-xs sm:text-sm text-gray-600">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-maroon flex-shrink-0" />
                          <span className="truncate">{revealedContact.email}</span>
                        </div>
                        <div className="flex items-center text-xs sm:text-sm text-gray-600">
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-maroon flex-shrink-0" />
                          <span className="truncate">{revealedContact.phone}</span>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={onContactReveal}>
                        <ShieldAlert className="h-3 w-3 mr-2 flex-shrink-0" /> View Contact (Parents Only)
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground italic">Teacher info not assigned</p>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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
                        <CardDescription className="text-xs sm:text-sm text-gray-600">Based on last {insights.examsAnalyzed} summative exams</CardDescription>
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
                                  insights.trend === "declining" ? "bg-red-100 text-red-800 border-red-200" :
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
                                  insights.latestScore >= 90 ? "text-green-600" : insights.latestScore >= 75 ? "text-emerald-600" :
                                  insights.latestScore >= 58 ? "text-blue-600"  : insights.latestScore >= 41 ? "text-cyan-600"    :
                                  insights.latestScore >= 31 ? "text-yellow-600": insights.latestScore >= 21 ? "text-orange-600"  :
                                  insights.latestScore >= 11 ? "text-red-600"   : "text-gray-600"
                                }`}>{insights.latestScore}%</span>
                              </div>
                              <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700 text-xs sm:text-sm">Average Score:</span>
                                <span className="font-semibold text-gray-900 text-xs sm:text-sm">{insights.averageScore}%</span>
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
                        <CardDescription className="text-xs sm:text-sm text-gray-600">Score trend across all summative exams in {selectedSubject}</CardDescription>
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
                              <Line type="monotone" dataKey="score" stroke="#800000" strokeWidth={2} dot={{ r: 3, fill: "#800000", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5, fill: "#800000", stroke: "#fff", strokeWidth: 2 }} name="Score" />
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
                    <CardContent className="p-2 sm:p-6">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Exam</TableHead><TableHead>Date</TableHead>
                              <TableHead>Score</TableHead><TableHead>Level</TableHead><TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summative.map((a: any) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.assessments?.title}</TableCell>
                                <TableCell>{new Date(a.assessment_date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  {a.is_absent ? <Badge variant="outline">Absent</Badge> :
                                    <span>{a.score}/{a.assessments?.max_marks} ({a.percentage?.toFixed(1)}%)</span>}
                                </TableCell>
                                <TableCell>
                                  {a.is_absent ? <Badge variant="outline">Absent</Badge> :
                                    <PerformanceBadge level={a.percentage >= 75 ? "EE" : a.percentage >= 50 ? "ME" : a.percentage >= 25 ? "AE" : "BE"} />}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">{a.teacher_remarks || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {formative.length > 0 && (
                  <Card className="bg-white border-maroon/20 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                      <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" /> Formative Assessments
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-gray-600">Performance levels only — no numeric score</CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Activity</TableHead><TableHead>Date</TableHead>
                              <TableHead>Level</TableHead><TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {formative.map((a: any) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.assessments?.title}</TableCell>
                                <TableCell>{new Date(a.assessment_date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  {a.is_absent ? <Badge variant="outline">Absent</Badge> :
                                    a.performance_level ? <PerformanceBadge level={a.performance_level} /> : "-"}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">{a.teacher_remarks || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
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
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 mt-4">
          <Button variant="default" onClick={onClose} className="w-full bg-maroon hover:bg-maroon/90">Close Analysis</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Assessments({
  studentId, classId, className, profile, isOpen, onClose,
  // NEW optional prop — pass attendanceData from StudentDashboard for the term report
  attendanceData,
}: AssessmentsProps & { attendanceData?: any }) {
  const [assessments, setAssessments]               = useState<any[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [studentRankings, setStudentRankings]       = useState<any[]>([]);
  const [subjectAssessments, setSubjectAssessments] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo]               = useState<any>(null);
  const [analysisLoading, setAnalysisLoading]       = useState(false);
  const [selectedSubject, setSelectedSubject]       = useState<string | null>(null);
  const [showWarning, setShowWarning]               = useState(false);
  const [revealedContact, setRevealedContact]       = useState<{ email: string; phone: string } | null>(null);
  const [contactLoading, setContactLoading]         = useState(false);
  const [isFullscreen, setIsFullscreen]             = useState(false);
  const [logoUrl, setLogoUrl]                       = useState<string>("");
  const [groupByStrand, setGroupByStrand]           = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const subjectDialogRef   = useRef<HTMLDivElement>(null);

  const { data: performanceHistory, loading: performanceLoading } =
    usePerformanceHistory(studentId, classId);

  useEffect(() => {
    if (isOpen && studentId && classId) {
      fetchAssessmentsData();
      fetchStudentRankings();
      loadLogoAsBase64();
    }
  }, [isOpen, studentId, classId]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const loadLogoAsBase64 = async () => {
    try {
      const response = await fetch("/logo.png");
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } else { setLogoUrl(""); }
    } catch { setLogoUrl(""); }
  };

  const fetchAssessmentsData = async () => {
    if (!studentId || !classId) return;
    setAssessmentsLoading(true);
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
        .order("assessment_date", { ascending: false });

      if (error) throw error;
      const processed = (data || []).map((item: any) => ({
        ...item,
        assessments: Array.isArray(item.assessments) ? item.assessments[0] : item.assessments,
        subjects:    Array.isArray(item.subjects)    ? item.subjects[0]    : item.subjects,
        percentage:  item.assessments?.max_marks > 0 && item.score !== null
          ? (item.score / item.assessments.max_marks) * 100 : null,
      }));
      setAssessments(processed);
    } catch (err) {
      console.error("Error fetching assessments:", err);
    } finally { setAssessmentsLoading(false); }
  };

  const fetchStudentRankings = async () => {
    if (!studentId || !classId) return;
    try {
      const { data: rankings, error } = await supabase
        .from("student_rankings").select("*")
        .eq("student_id", studentId).eq("class_id", classId)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      if (!rankings?.length) { setStudentRankings([]); return; }

      const assessmentIds = rankings.map((r) => r.assessment_id);
      const { data: aData, error: catErr } = await supabase
        .from("assessments").select("id, category").in("id", assessmentIds);
      if (catErr) throw catErr;

      const catMap = (aData || []).reduce((acc, a) => { acc[a.id] = a.category; return acc; }, {} as Record<string, string>);
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
      const { data } = await supabase.from("student_teacher_info").select("email, phone")
        .eq("teacher_id", teacherInfo.teacher_id).single();
      setRevealedContact(data);
      setShowWarning(false);
    } catch (err) { console.error("Error fetching contact:", err); }
    finally { setContactLoading(false); }
  };

  const handleSubjectClick = async (subjectName: string) => {
    setSelectedSubject(subjectName);
    setAnalysisLoading(true);
    setRevealedContact(null);
    const subjectId = assessments.find((a) => a.subjects?.name === subjectName)?.subjects?.id;
    if (!subjectId) { setAnalysisLoading(false); return; }
    try {
      const { data: results, error } = await supabase
        .from("assessment_results")
        .select(`
          id, student_id, score, performance_level, teacher_remarks, is_absent, assessment_date,
          assessments!inner (
            id, title, term, year, class_id, category, max_marks,
            strand_id, sub_strand_id, strands ( name, code ), sub_strands ( name, code )
          ),
          subjects!inner ( id, name, code )
        `)
        .eq("student_id", studentId).eq("subject_id", subjectId)
        .eq("status", "published").order("assessment_date", { ascending: false });
      if (error) throw error;
      const processed = (results || []).map((item: any) => ({
        ...item,
        assessments: Array.isArray(item.assessments) ? item.assessments[0] : item.assessments,
        subjects:    Array.isArray(item.subjects)    ? item.subjects[0]    : item.subjects,
        percentage:  item.assessments?.max_marks > 0 && item.score !== null
          ? (item.score / item.assessments.max_marks) * 100 : null,
      }));
      setSubjectAssessments(processed);
      const { data: tcData } = await supabase.from("teacher_classes").select("teacher_id")
        .eq("class_id", classId).eq("subject_id", subjectId).single();
      let teacher = null;
      if (tcData?.teacher_id) {
        const { data } = await supabase.from("student_teacher_info")
          .select("teacher_id, first_name, last_name").eq("teacher_id", tcData.teacher_id).single();
        if (data) teacher = data;
      }
      setTeacherInfo(teacher);
    } catch (err) { console.error("Error fetching subject assessments:", err); }
    finally { setAnalysisLoading(false); }
  };

  const getPerformanceInsights = useCallback(() => {
    if (!performanceHistory || performanceHistory.length < 2) return null;
    const recent       = performanceHistory.slice(0, 6);
    const latestScore  = recent[0].percentage;
    const prevScore    = recent[1].percentage;
    const averageScore = Math.round(recent.reduce((s: number, r: any) => s + r.percentage, 0) / recent.length);
    const topPositions = recent.filter((r: any) => r.classPosition <= 3).length;
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

  const exams = useMemo(() => {
    const seen = new Set<string>();
    assessments.forEach((a: any) => { if (a.assessments?.title) seen.add(a.assessments.title); });
    return Array.from(seen)
      .sort((a, b) => { const na = extractExamNumber(a), nb = extractExamNumber(b); return na !== nb ? na - nb : a.localeCompare(b); })
      .map((title) => ({ id: title, title }));
  }, [assessments]);

  const pivotData = useMemo(() => {
    if (!assessments.length || !studentId) return [];
    const examTitles = exams.map((e: any) => e.title);
    const grouped: Record<string, any> = {};
    assessments.forEach((a: any) => {
      if (String(a.student_id) !== String(studentId)) return;
      const subject   = a.subjects?.name    || "Unknown Subject";
      const examTitle = a.assessments?.title || "Untitled Exam";
      if (!grouped[subject]) grouped[subject] = { subject, exams: {} };
      grouped[subject].exams[examTitle] = a.score !== null ? Number(a.score) : "-";
    });
    const rows = Object.values(grouped).map((row: any) => ({
      subject: row.subject,
      exams: examTitles.reduce((acc: Record<string, any>, title: string) => {
        acc[title] = row.exams[title] ?? "-"; return acc;
      }, {}),
    }));
    if (studentRankings.length > 0) {
      const rankingMap: Record<string, any> = {};
      studentRankings.forEach((r: any) => { if (r.exam_title) rankingMap[r.exam_title] = r; });
      const totals: Record<string, any> = {}, positions: Record<string, any> = {};
      examTitles.forEach((title: string) => {
        const r = rankingMap[title];
        totals[title]    = r ? `${r.total_attained}/${r.total_possible}` : "-";
        positions[title] = r ? r.class_position : "-";
      });
      return [...rows, { subject: "Totals", exams: totals }, { subject: "Position", exams: positions }];
    }
    return rows;
  }, [assessments, studentId, exams, studentRankings]);

  // ── NEW: Group performance history by term+year for the term cards ─────────
  const groupedByTerm = useMemo(() => {
    if (!performanceHistory?.length) return [];
    const map = new Map<string, { termLabel: string; term: string; year: number; records: any[] }>();
    performanceHistory.forEach((record: any) => {
      const key = `${record.year}-${record.term}`;
      if (!map.has(key)) {
        map.set(key, {
          termLabel: `Term ${record.term}, ${record.year}`,
          term: record.term,
          year: record.year,
          records: [],
        });
      }
      map.get(key)!.records.push(record);
    });
    // Sort: most recent term first
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [performanceHistory]);

  const performanceInsights = useMemo(() => getPerformanceInsights(), [getPerformanceInsights]);

  const groupedByStrand = useMemo(() => {
    if (!groupByStrand) return null;
    const map = new Map<string, any[]>();
    assessments.forEach((a) => {
      const strand = a.assessments?.strands?.name || "Uncategorized";
      if (!map.has(strand)) map.set(strand, []);
      map.get(strand)!.push(a);
    });
    return map;
  }, [assessments, groupByStrand]);

  const scrollLeft = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: -(scrollContainerRef.current.clientWidth * 0.8), behavior: "smooth" });
  }, []);
  const scrollRight = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: scrollContainerRef.current.clientWidth * 0.8, behavior: "smooth" });
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (!subjectDialogRef.current) return;
    if (!document.fullscreenElement) subjectDialogRef.current.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6">
        <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <DialogTitle className="flex items-center text-lg sm:text-xl lg:text-2xl text-maroon">
                <BookOpen className="h-5 w-5 lg:h-6 lg:w-6 mr-2" /> Assessments &amp; Performance
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">View your assessment results and performance history</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="mt-2 sm:mt-0">Close</Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="assessments" className="w-full">
          <TabsList className="grid w-full grid-cols-2 p-1 h-auto">
            <TabsTrigger value="assessments" className="text-xs sm:text-sm py-2">Assessments</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm py-2">Performance History</TabsTrigger>
          </TabsList>

          {/* ── Assessments tab (unchanged) ── */}
          <TabsContent value="assessments" className="space-y-4 mt-4">
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={() => setGroupByStrand(!groupByStrand)} className="text-xs">
                {groupByStrand ? "Ungroup" : "Group by Strand"}
              </Button>
            </div>
            {assessmentsLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-maroon mx-auto mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">Loading assessment results...</p>
              </div>
            ) : groupedByStrand ? (
              <div className="space-y-6">
                {Array.from(groupedByStrand.entries()).map(([strand, items]) => (
                  <Card key={strand}>
                    <CardHeader className="py-3"><CardTitle className="text-sm sm:text-base">{strand}</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Assessment</TableHead><TableHead>Subject</TableHead>
                              <TableHead>Score</TableHead><TableHead>Level</TableHead><TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(items as any[]).map((a: any) => (
                              <TableRow key={a.id}>
                                <TableCell>{a.assessments?.title}</TableCell>
                                <TableCell>{a.subjects?.name}</TableCell>
                                <TableCell>{a.is_absent ? "Absent" : a.score !== null ? `${a.score}/${a.assessments?.max_marks}` : "-"}</TableCell>
                                <TableCell>
                                  {a.is_absent ? <Badge variant="outline">Absent</Badge> :
                                    a.performance_level ? <PerformanceBadge level={a.performance_level} /> :
                                    a.percentage !== null ? <PerformanceBadge level={a.percentage >= 75 ? "EE" : a.percentage >= 50 ? "ME" : a.percentage >= 25 ? "AE" : "BE"} /> : "-"}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">{a.teacher_remarks || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : pivotData.length > 0 ? (
              <>
                <AssessmentTable pivotData={pivotData} exams={exams} onSubjectClick={handleSubjectClick} scrollLeft={scrollLeft} scrollRight={scrollRight} />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <div className="bg-blue-100 p-1 rounded-full mt-0.5">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">How to use this table on mobile:</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li className="flex items-start"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0" /><span>Swipe horizontally to view all exams</span></li>
                        <li className="flex items-start"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0" /><span>Subject column stays fixed for reference</span></li>
                        <li className="flex items-start"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0" /><span>Tap any subject row for detailed analysis</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No assessment results found.</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">Assessments will appear here when published.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Performance History tab — UPDATED with term group cards ── */}
          <TabsContent value="performance" className="space-y-6 mt-4">
            {performanceLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-maroon mx-auto mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">Loading performance history...</p>
              </div>
            ) : !performanceHistory?.length ? (
              <div className="text-center py-8 sm:py-12">
                <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No performance records found</p>
              </div>
            ) : (
              <>
                {/* Summary stats row (unchanged) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="border-l-4 border-l-maroon">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-maroon">{performanceHistory.length}</div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Exams Tracked</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600">
                        {Math.round(performanceHistory.reduce((s: number, r: any) => s + r.percentage, 0) / performanceHistory.length)}%
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Avg Score</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-purple-600">
                        {performanceHistory.filter((r: any) => r.grade.includes("EE1") || r.grade.includes("EE2")).length}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Excellent</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-orange-600">
                        {Math.min(...performanceHistory.map((r: any) => r.classPosition))}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Best Position</p>
                    </CardContent>
                  </Card>
                </div>

                {performanceInsights && (
                  <Card className="bg-maroon/5">
                    <CardHeader className="px-4 sm:px-6"><CardTitle className="text-sm sm:text-base">Performance Insights</CardTitle></CardHeader>
                    <CardContent className="px-4 sm:px-6">
                      <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                        <p>
                          <span className="font-medium">Trend: </span>
                          Your performance is{" "}
                          <span className={
                            performanceInsights.trend === "improving" ? "text-green-600 font-medium" :
                            performanceInsights.trend === "declining"  ? "text-red-600 font-medium" :
                            "text-blue-600 font-medium"
                          }>{performanceInsights.trend}</span>
                        </p>
                        <p><span className="font-medium">Overall Level: </span><span className="capitalize">{performanceInsights.performanceLevel}</span></p>
                        <p><span className="font-medium">Achievements: </span>{performanceInsights.topPositions} top 3 class positions in recent exams</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── NEW: Term group cards replace the flat table/card list ── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileBarChart2 className="h-4 w-4 text-maroon" />
                    <h3 className="text-sm font-semibold text-gray-900">Results by Term</h3>
                    <span className="text-xs text-gray-500 ml-1">
                      — tap <strong>Full Term Report</strong> to download the combined PDF when all 3 CATs are done
                    </span>
                  </div>

                  {groupedByTerm.map(({ key, termLabel, records }) => (
                    <TermGroupCard
                      key={key}
                      termKey={key}
                      termLabel={termLabel}
                      records={records}
                      profile={profile}
                      className={className || ""}
                      logoUrl={logoUrl}
                      classId={classId}
                      attendanceData={attendanceData || null}
                    />
                  ))}
                </div>

                {/* Download all history PDF (unchanged) */}
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <PDFDownloadLink
                    document={
                      <PerformanceHistoryPDF
                        performanceHistory={performanceHistory}
                        profile={profile}
                        className={className || ""}
                        logoUrl={logoUrl}
                      />
                    }
                    fileName={`Milai_School_Performance_History_${profile?.reg_no || "student"}.pdf`}
                  >
                    {({ loading }) => (
                      <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs" disabled={loading}>
                        {loading ? (
                          <><PDFLoadingFallback /><span className="hidden sm:inline">Generating PDF...</span><span className="sm:hidden">Generating...</span></>
                        ) : (
                          <><Download className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Download All Exams PDF</span><span className="sm:hidden">All PDF</span></>
                        )}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <SubjectAnalysisDialog
          selectedSubject={selectedSubject} onClose={() => setSelectedSubject(null)}
          subjectAssessments={subjectAssessments} teacherInfo={teacherInfo}
          analysisLoading={analysisLoading} revealedContact={revealedContact}
          showWarning={showWarning} contactLoading={contactLoading}
          onContactReveal={() => setShowWarning(true)} onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen} subjectDialogRef={subjectDialogRef}
        />

        <Dialog open={showWarning} onOpenChange={setShowWarning}>
          <DialogContent className="sm:max-w-[425px] max-w-[95vw] mx-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600 text-sm sm:text-base">
                <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" /> Security Policy Warning
              </DialogTitle>
              <DialogDescription className="py-3 text-xs sm:text-sm">
                Teacher contact details are shared exclusively for parental communication regarding student welfare.
                <br /><br />
                <span className="text-red-600 font-bold">Unauthorized use or sharing of this information by students is a violation of school policy.</span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" onClick={() => setShowWarning(false)} className="text-xs sm:text-sm">Cancel</Button>
              <Button className="bg-maroon hover:bg-maroon/90 text-xs sm:text-sm" onClick={fetchTeacherContact} disabled={contactLoading}>
                {contactLoading ? "Verifying..." : "I am a Parent, I Accept"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}