import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Badge } from "@/Components/ui/badge";
import {
  AlertTriangle, CheckCircle, Save, Loader2, BookOpen,
  ClipboardList, Plus, ArrowLeft, History, Pencil,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  classes?: { id: string; name: string; grade_level: string; created_at: string }
    | { id: string; name: string; grade_level: string; created_at: string }[];
  subjects?: { id: string; name: string; code: string; created_at: string }
    | { id: string; name: string; code: string; created_at: string }[];
}

interface Assessment {
  id: string;
  title: string;
  term: number;
  year: number;
  class_id: string;
  category: "formative" | "summative" | "portfolio";
  max_marks: number;
  strand_id?: string | null;
  sub_strand_id?: string | null;
  strands?: { name: string } | { name: string }[] | null;
  sub_strands?: { name: string } | { name: string }[] | null;
}

interface Student {
  id: string;
  Reg_no: string;
  first_name: string;
  last_name: string;
}

interface ExistingResult {
  student_id: string;
  score: number;
  performance_level: "EE" | "ME" | "AE" | "BE" | null;
  teacher_remarks: string | null;
  is_absent: boolean;
  assessment_date: string | null;
}

interface HistoryItem {
  assessment: Assessment;
  subject_id: string;
  subject_name: string;
  result_count: number;
  latest_date: string | null;
  status: "draft" | "published";
}

type PerformanceLevel = "EE" | "ME" | "AE" | "BE";
type Mode = "summative" | "formative" | "history";
type EntryRow = {
  score: string;
  performance_level: PerformanceLevel | null;
  teacher_remarks: string;
  is_absent: boolean;
  date: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_TERM = (() => {
  const m = new Date().getMonth() + 1;
  if (m <= 4) return 1;
  if (m <= 8) return 2;
  return 3;
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

const getPerformanceLevel = (score: number, maxMarks: number): PerformanceLevel => {
  const pct = (score / maxMarks) * 100;
  if (pct >= 75) return "EE";
  if (pct >= 50) return "ME";
  if (pct >= 25) return "AE";
  return "BE";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<PerformanceLevel, { bg: string; text: string }> = {
  EE: { bg: "bg-green-100 border-green-300",    text: "text-green-800" },
  ME: { bg: "bg-blue-100 border-blue-300",      text: "text-blue-800" },
  AE: { bg: "bg-yellow-100 border-yellow-300",  text: "text-yellow-800" },
  BE: { bg: "bg-red-100 border-red-300",        text: "text-red-800" },
};

function PerformanceBadge({ level }: { level: PerformanceLevel }) {
  const s = LEVEL_STYLES[level];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${s.bg} ${s.text}`}>
      {level}
    </span>
  );
}

function LevelToggle({ value, onChange, disabled }: {
  value: PerformanceLevel | null;
  onChange: (l: PerformanceLevel) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1">
      {(["EE", "ME", "AE", "BE"] as PerformanceLevel[]).map((level) => {
        const s = LEVEL_STYLES[level];
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            disabled={disabled}
            className={`px-2 py-1 rounded border text-xs font-bold transition-all ${
              selected
                ? `${s.bg} ${s.text} border-current shadow-sm`
                : "bg-white border-gray-200 text-gray-400 hover:border-gray-400"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}

function CategoryBadge({ category }: { category: Assessment["category"] }) {
  const styles = {
    summative: "bg-purple-100 text-purple-800 border-purple-200",
    formative:  "bg-teal-100 text-teal-800 border-teal-200",
    portfolio:  "bg-orange-100 text-orange-800 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold capitalize ${styles[category]}`}>
      {category}
    </span>
  );
}

// ─── Stable input components defined OUTSIDE the parent ──────────────────────
// These must live outside TeacherMarksEntry so they are never recreated on
// each render, which would cause the input to lose focus after every keystroke.

const RemarksInput = memo(({
  value,
  studentId,
  disabled,
  onChange,
}: {
  value: string;
  studentId: string;
  disabled: boolean;
  onChange: (studentId: string, value: string) => void;
}) => (
  <Input
    type="text"
    placeholder="Optional remark"
    value={value}
    onChange={(e) => onChange(studentId, e.target.value)}
    className="w-full text-sm"
    disabled={disabled}
  />
));
RemarksInput.displayName = "RemarksInput";

const ScoreInput = memo(({
  value,
  studentId,
  maxMarks,
  disabled,
  onChange,
}: {
  value: string;
  studentId: string;
  maxMarks: number;
  disabled: boolean;
  onChange: (studentId: string, value: string) => void;
}) => (
  <Input
    type="number"
    step="0.01"
    min="0"
    max={maxMarks}
    value={value}
    onChange={(e) => onChange(studentId, e.target.value)}
    className="w-24"
    disabled={disabled}
    placeholder="0"
  />
));
ScoreInput.displayName = "ScoreInput";

const DateInput = memo(({
  value,
  studentId,
  disabled,
  onChange,
}: {
  value: string;
  studentId: string;
  disabled: boolean;
  onChange: (studentId: string, value: string) => void;
}) => (
  <Input
    type="date"
    value={value}
    onChange={(e) => onChange(studentId, e.target.value)}
    className="w-36"
    disabled={disabled}
  />
));
DateInput.displayName = "DateInput";

// ─── MarksTable defined OUTSIDE TeacherMarksEntry ────────────────────────────

interface MarksTableProps {
  mode: Mode;
  editingHistory: boolean;
  selectedAssessment: Assessment | null;
  selectedSubjectId: string;
  students: Student[];
  entries: Record<string, EntryRow>;
  loadingData: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  filledCount: number;
  strandName: string | undefined;
  subStrandName: string | undefined;
  fDate: string;
  onBack: () => void;
  onScoreChange: (studentId: string, value: string) => void;
  onLevelChange: (studentId: string, level: PerformanceLevel) => void;
  onRemarksChange: (studentId: string, value: string) => void;
  onDateChange: (studentId: string, value: string) => void;
  onAbsentToggle: (studentId: string) => void;
  onSave: () => void;
}

const MarksTable = memo(({
  mode,
  editingHistory,
  selectedAssessment,
  selectedSubjectId,
  students,
  entries,
  loadingData,
  saving,
  error,
  success,
  filledCount,
  strandName,
  subStrandName,
  fDate,
  onBack,
  onScoreChange,
  onLevelChange,
  onRemarksChange,
  onDateChange,
  onAbsentToggle,
  onSave,
}: MarksTableProps) => {
  if (!selectedAssessment) return null;

  const isFormative = selectedAssessment.category === "formative";

  return (
    <>
      {/* Assessment info strip */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/40 border text-sm">
        {(mode === "formative" || editingHistory) && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {editingHistory ? "Back to history" : "New activity"}
          </button>
        )}
        <CategoryBadge category={selectedAssessment.category} />
        {!isFormative && (
          <span className="text-muted-foreground">
            Max marks: <strong className="text-foreground">{selectedAssessment.max_marks}</strong>
          </span>
        )}
        <span className="font-medium">{selectedAssessment.title}</span>
        {strandName && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <strong className="text-foreground">{strandName}</strong>
            {subStrandName && <> › <strong className="text-foreground">{subStrandName}</strong></>}
          </span>
        )}
        {isFormative && (
          <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-0.5">
            Select EE / ME / AE / BE per student
          </span>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 text-red-800 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-800 p-3 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {/* Table */}
      {selectedAssessment && selectedSubjectId && (
        <>
          {!loadingData && students.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No students enrolled in this class.</div>
          ) : (
            <div className="relative">
              {loadingData && (
                <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center z-10 rounded">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Reg No</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="w-[70px] text-center">Absent</TableHead>
                      <TableHead>{isFormative ? "Performance Level" : `Score (out of ${selectedAssessment.max_marks})`}</TableHead>
                      <TableHead className="w-[180px]">Remarks</TableHead>
                      <TableHead className="w-[140px]">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      const entry = entries[student.id] ?? {
                        score: "", performance_level: null, teacher_remarks: "", is_absent: false,
                        date: fDate || new Date().toISOString().slice(0, 10),
                      };
                      const absent = entry.is_absent;
                      return (
                        <TableRow key={student.id} className={absent ? "opacity-50" : ""}>
                          <TableCell className="font-mono text-xs">{student.Reg_no}</TableCell>
                          <TableCell className="font-medium">{student.first_name} {student.last_name}</TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={absent}
                              onChange={() => onAbsentToggle(student.id)}
                              disabled={loadingData}
                              className="h-4 w-4 accent-orange-600"
                            />
                          </TableCell>
                          <TableCell>
                            {absent ? (
                              <span className="text-xs italic text-muted-foreground">Absent</span>
                            ) : isFormative ? (
                              <LevelToggle
                                value={entry.performance_level}
                                onChange={(l) => onLevelChange(student.id, l)}
                                disabled={loadingData}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <ScoreInput
                                  value={entry.score}
                                  studentId={student.id}
                                  maxMarks={selectedAssessment.max_marks}
                                  disabled={loadingData}
                                  onChange={onScoreChange}
                                />
                                {entry.performance_level && <PerformanceBadge level={entry.performance_level} />}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <RemarksInput
                              value={entry.teacher_remarks}
                              studentId={student.id}
                              disabled={loadingData}
                              onChange={onRemarksChange}
                            />
                          </TableCell>
                          <TableCell>
                            <DateInput
                              value={entry.date}
                              studentId={student.id}
                              disabled={loadingData}
                              onChange={onDateChange}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {students.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {filledCount} / {students.length} entries ready
                {isFormative && <span className="ml-2 text-xs text-teal-600">• publishes immediately</span>}
              </span>
              <Button
                onClick={onSave}
                disabled={saving || loadingData || filledCount === 0}
                className={isFormative ? "bg-teal-600 hover:bg-teal-700" : "bg-green-600 hover:bg-green-700"}
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : isFormative ? (
                  <><CheckCircle className="mr-2 h-4 w-4" /> Save &amp; Publish</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save Draft</>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
});
MarksTable.displayName = "MarksTable";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherMarksEntry({
  teacherId,
  teacherClasses,
}: {
  teacherId: string;
  teacherClasses: TeacherClass[];
}) {
  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("summative");

  // ── Summative state ───────────────────────────────────────────────────────
  const [assessments, setAssessments]                   = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [selectedAssessment, setSelectedAssessment]     = useState<Assessment | null>(null);
  const [selectedSubjectId, setSelectedSubjectId]       = useState("");
  const [loadingAssessments, setLoadingAssessments]     = useState(false);

  // ── Formative creation state ──────────────────────────────────────────────
  const [fClassId, setFClassId]     = useState("");
  const [fSubjectId, setFSubjectId] = useState("");
  const [fTitle, setFTitle]         = useState("");
  const [fStrand, setFStrand]       = useState("");
  const [fSubStrand, setFSubStrand] = useState("");
  const [fDate, setFDate]           = useState(new Date().toISOString().slice(0, 10));
  const [fTerm, setFTerm]           = useState(String(CURRENT_TERM));
  const [fYear, setFYear]           = useState(String(CURRENT_YEAR));
  const [creatingFormative, setCreatingFormative] = useState(false);
  const [createError, setCreateError]             = useState<string | null>(null);

  // ── History state ─────────────────────────────────────────────────────────
  const [historyItems, setHistoryItems]     = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter]   = useState<"all" | "formative" | "summative">("all");
  const [editingHistory, setEditingHistory] = useState(false);

  // ── Shared marks entry state ──────────────────────────────────────────────
  const [students, setStudents]               = useState<Student[]>([]);
  const [entries, setEntries]                 = useState<Record<string, EntryRow>>({});
  const [existingResults, setExistingResults] = useState<Record<string, ExistingResult>>({});
  const [loadingData, setLoadingData]         = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const classIds = useMemo(
    () => [...new Set(teacherClasses.map((tc) => tc.class_id))],
    [teacherClasses]
  );

  const teacherClassList = useMemo(() => {
    const seen = new Set<string>();
    return teacherClasses.filter((tc) => {
      if (seen.has(tc.class_id)) return false;
      seen.add(tc.class_id);
      return true;
    });
  }, [teacherClasses]);

  const formativeSubjects = useMemo(
    () => teacherClasses.filter((tc) => tc.class_id === fClassId),
    [teacherClasses, fClassId]
  );

  const availableSubjects = useMemo(() => {
    if (!selectedAssessment) return [];
    return teacherClasses
      .filter((tc) => tc.class_id === selectedAssessment.class_id)
      .filter((tc) => !!firstRel(tc.subjects)?.name);
  }, [teacherClasses, selectedAssessment]);

  // ── Fetch summative assessments ───────────────────────────────────────────
  useEffect(() => {
    if (!classIds.length) return;
    setLoadingAssessments(true);
    supabase
      .from("assessments")
      .select(`id, title, term, year, class_id, category, max_marks, strand_id, sub_strand_id, strands(name), sub_strands(name)`)
      .in("class_id", classIds)
      .eq("category", "summative")
      .order("year",  { ascending: false })
      .order("term",  { ascending: false })
      .order("title", { ascending: true })
      .then(({ data, error: err }) => {
        if (!isMounted.current) return;
        if (err) { console.error(err); setError("Failed to load assessments"); }
        else setAssessments(data || []);
        setLoadingAssessments(false);
      });
  }, [classIds]);

  // ── Fetch history ─────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    if (!classIds.length || !teacherClasses.length) return;
    setLoadingHistory(true);

    try {
      const validPairs = new Set(
        teacherClasses.map((tc) => `${tc.class_id}__${tc.subject_id}`)
      );
      const subjectIds = teacherClasses.map((tc) => tc.subject_id);

      const { data: results, error: rErr } = await supabase
        .from("assessment_results")
        .select("assessment_id, subject_id, score, is_absent, assessment_date, status")
        .in("subject_id", subjectIds);

      if (rErr) throw rErr;
      if (!results?.length) { setHistoryItems([]); setLoadingHistory(false); return; }

      const assessmentIds = [...new Set(results.map((r) => r.assessment_id))];
      const { data: assessmentData, error: aErr } = await supabase
        .from("assessments")
        .select(`id, title, term, year, class_id, category, max_marks, strand_id, sub_strand_id, strands(name), sub_strands(name)`)
        .in("id", assessmentIds)
        .in("class_id", classIds);

      if (aErr) throw aErr;

      const assessmentMap = new Map((assessmentData || []).map((a) => [a.id, a]));

      const pairs = new Map<
        string,
        { assessment_id: string; subject_id: string; count: number; latest: string | null; status: "draft" | "published" }
      >();

      results.forEach((r) => {
        const assessment = assessmentMap.get(r.assessment_id);
        if (!assessment) return;

        const pairKey = `${assessment.class_id}__${r.subject_id}`;
        if (!validPairs.has(pairKey)) return;

        const key = `${r.assessment_id}__${r.subject_id}`;
        if (!pairs.has(key)) {
          pairs.set(key, { assessment_id: r.assessment_id, subject_id: r.subject_id, count: 0, latest: null, status: r.status });
        }
        const p = pairs.get(key)!;
        p.count++;
        if (r.assessment_date && (!p.latest || r.assessment_date > p.latest)) p.latest = r.assessment_date;
        if (r.status === "published") p.status = "published";
      });

      const subjectNameMap = new Map(
        teacherClasses.map((tc) => [tc.subject_id, firstRel(tc.subjects)?.name ?? tc.subject_id])
      );

      const items: HistoryItem[] = [];
      pairs.forEach((p) => {
        const assessment = assessmentMap.get(p.assessment_id);
        if (!assessment) return;
        items.push({
          assessment,
          subject_id:   p.subject_id,
          subject_name: subjectNameMap.get(p.subject_id) ?? p.subject_id,
          result_count: p.count,
          latest_date:  p.latest,
          status:       p.status,
        });
      });

      items.sort((a, b) => {
        const da = a.latest_date ?? "";
        const db = b.latest_date ?? "";
        return db.localeCompare(da);
      });

      if (isMounted.current) setHistoryItems(items);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      if (isMounted.current) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (mode === "history") fetchHistory();
  }, [mode, classIds]);

  // ── Load students + existing results ─────────────────────────────────────
  const loadStudentsAndResults = async (
    classId: string,
    assessmentId: string,
    subjectId: string,
  ) => {
    setLoadingData(true);
    setError(null);

    const [enrollRes, resultsRes] = await Promise.all([
      supabase
        .from("enrollments")
        .select(`student_id, students!inner(id, Reg_no, first_name, last_name)`)
        .eq("class_id", classId),
      supabase
        .from("assessment_results")
        .select("student_id, score, performance_level, teacher_remarks, is_absent, assessment_date")
        .eq("assessment_id", assessmentId)
        .eq("subject_id", subjectId)
        .in("status", ["draft", "published"]),
    ]);

    if (!isMounted.current) return;

    if (enrollRes.error) { setError("Failed to load students."); setLoadingData(false); return; }
    if (resultsRes.error) { setError("Failed to load existing results."); setLoadingData(false); return; }

    const studentList: Student[] = (enrollRes.data || [])
      .map((e) => firstRel(e.students))
      .filter((s): s is Student => !!s);

    const resultsMap: Record<string, ExistingResult> = {};
    (resultsRes.data || []).forEach((r) => { resultsMap[r.student_id] = r; });

    const today = new Date().toISOString().slice(0, 10);
    const initialEntries: Record<string, EntryRow> = {};
    studentList.forEach((s) => {
      const ex = resultsMap[s.id];
      initialEntries[s.id] = {
        score:             ex ? String(ex.score) : "",
        performance_level: ex?.performance_level ?? null,
        teacher_remarks:   ex?.teacher_remarks ?? "",
        is_absent:         ex?.is_absent ?? false,
        date:              ex?.assessment_date ? ex.assessment_date.slice(0, 10) : today,
      };
    });

    setStudents(studentList);
    setExistingResults(resultsMap);
    setEntries(initialEntries);
    setLoadingData(false);
  };

  useEffect(() => {
    if (!selectedAssessment || !selectedSubjectId) { resetMarksState(); return; }
    loadStudentsAndResults(selectedAssessment.class_id, selectedAssessment.id, selectedSubjectId);
  }, [selectedAssessment, selectedSubjectId]);

  useEffect(() => {
    if (!selectedAssessmentId) { setSelectedAssessment(null); setSelectedSubjectId(""); resetMarksState(); return; }
    const found = assessments.find((a) => a.id === selectedAssessmentId) || null;
    setSelectedAssessment(found);
    setSelectedSubjectId("");
    resetMarksState();
    setError(null);
    setSuccess(null);
  }, [selectedAssessmentId, assessments]);

  const resetMarksState = () => {
    setStudents([]);
    setEntries({});
    setExistingResults({});
  };

  // ── Switch mode ───────────────────────────────────────────────────────────
  const switchMode = (m: Mode) => {
    setMode(m);
    setSelectedAssessmentId("");
    setSelectedAssessment(null);
    setSelectedSubjectId("");
    setFClassId(""); setFSubjectId(""); setFTitle("");
    setFStrand(""); setFSubStrand("");
    setFDate(new Date().toISOString().slice(0, 10));
    setFTerm(String(CURRENT_TERM)); setFYear(String(CURRENT_YEAR));
    resetMarksState();
    setError(null); setSuccess(null); setCreateError(null);
    setEditingHistory(false);
  };

  // ── Open a history item for editing ──────────────────────────────────────
  const handleEditHistoryItem = async (item: HistoryItem) => {
    setEditingHistory(true);
    setSelectedAssessment(item.assessment);
    setSelectedSubjectId(item.subject_id);
    setError(null);
    setSuccess(null);
    await loadStudentsAndResults(item.assessment.class_id, item.assessment.id, item.subject_id);
  };

  const handleBackToHistory = () => {
    setEditingHistory(false);
    setSelectedAssessment(null);
    setSelectedSubjectId("");
    resetMarksState();
    setError(null);
    setSuccess(null);
    fetchHistory();
  };

  // ── Create formative ──────────────────────────────────────────────────────
  const handleCreateFormative = async () => {
    if (!fClassId || !fSubjectId || !fTitle.trim() || !fDate) {
      setCreateError("Class, subject, title and date are all required.");
      return;
    }
    setCreatingFormative(true);
    setCreateError(null);

    try {
      let strandId: string | null = null;
      let subStrandId: string | null = null;

      if (fStrand.trim()) {
        const { data: existingStrand } = await supabase
          .from("strands").select("id")
          .eq("subject_id", fSubjectId).ilike("name", fStrand.trim()).maybeSingle();

        if (existingStrand) {
          strandId = existingStrand.id;
        } else {
          const { data: newStrand, error: sErr } = await supabase
            .from("strands")
            .insert({ subject_id: fSubjectId, name: fStrand.trim(), code: fStrand.trim().slice(0, 10).toUpperCase().replace(/\s+/g, "_") })
            .select("id").single();
          if (sErr) throw sErr;
          strandId = newStrand.id;
        }

        if (fSubStrand.trim() && strandId) {
          const { data: existingSub } = await supabase
            .from("sub_strands").select("id")
            .eq("strand_id", strandId).ilike("name", fSubStrand.trim()).maybeSingle();

          if (existingSub) {
            subStrandId = existingSub.id;
          } else {
            const { data: newSub, error: ssErr } = await supabase
              .from("sub_strands")
              .insert({ strand_id: strandId, name: fSubStrand.trim(), code: fSubStrand.trim().slice(0, 10).toUpperCase().replace(/\s+/g, "_") })
              .select("id").single();
            if (ssErr) throw ssErr;
            subStrandId = newSub.id;
          }
        }
      }

      const { data: newAssessment, error: aErr } = await supabase
        .from("assessments")
        .insert({
          title: fTitle.trim(), class_id: fClassId, category: "formative",
          max_marks: 0, term: parseInt(fTerm), year: parseInt(fYear),
          teacher_id: teacherId, strand_id: strandId, sub_strand_id: subStrandId,
        })
        .select("id, title, term, year, class_id, category, max_marks, strand_id, sub_strand_id")
        .single();

      if (aErr) throw aErr;

      setSelectedAssessment({
        ...newAssessment,
        strands:     strandId    ? [{ name: fStrand.trim() }]    : null,
        sub_strands: subStrandId ? [{ name: fSubStrand.trim() }] : null,
      });
      setSelectedSubjectId(fSubjectId);
      await loadStudentsAndResults(fClassId, newAssessment.id, fSubjectId);
      setSuccess(`"${newAssessment.title}" created. Enter performance levels below.`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to create assessment.");
    } finally {
      if (isMounted.current) setCreatingFormative(false);
    }
  };

  // ── Entry handlers (stable with useCallback) ──────────────────────────────

  const updateEntry = useCallback((studentId: string, patch: Partial<EntryRow>) =>
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } })),
  []);

  const handleScoreChange = useCallback((studentId: string, value: string) => {
    setEntries((prev) => {
      const assessment = prev[studentId]; // we need selectedAssessment here
      return prev; // placeholder — see below
    });
    // We need selectedAssessment in scope, so keep it as a regular function
    // but stable via the functional updater pattern
    setEntries((prev) => {
      const n = parseFloat(value);
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          score: value,
          // performance_level is derived — we pass selectedAssessment via closure
          // This is fine because handleScoreChange is recreated only when selectedAssessment changes
          performance_level: (!isNaN(n) && selectedAssessment)
            ? getPerformanceLevel(n, selectedAssessment.max_marks)
            : null,
        },
      };
    });
  }, [selectedAssessment]);

  const handleLevelChange = useCallback((studentId: string, level: PerformanceLevel) =>
    updateEntry(studentId, { performance_level: level }),
  [updateEntry]);

  const handleRemarksChange = useCallback((studentId: string, value: string) =>
    updateEntry(studentId, { teacher_remarks: value }),
  [updateEntry]);

  const handleDateChange = useCallback((studentId: string, value: string) =>
    updateEntry(studentId, { date: value }),
  [updateEntry]);

  const handleAbsentToggle = useCallback((studentId: string) => {
    setEntries((prev) => {
      const current = prev[studentId]?.is_absent ?? false;
      return {
        ...prev,
        [studentId]: { ...prev[studentId], is_absent: !current, score: "", performance_level: null },
      };
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedAssessment || !selectedSubjectId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const isFormativeMode = selectedAssessment.category === "formative";
    const saveStatus = isFormativeMode ? "published" : "draft";

    try {
      const records = students.map((s) => {
        const entry = entries[s.id];
        if (!entry?.date) return null;
        const base = {
          assessment_id: selectedAssessment.id, student_id: s.id,
          subject_id: selectedSubjectId, assessment_date: entry.date,
          teacher_remarks: entry.teacher_remarks || null,
          status: saveStatus, updated_at: new Date().toISOString(),
        };
        if (entry.is_absent) return { ...base, score: 0, performance_level: null, is_absent: true };
        if (isFormativeMode) {
          if (!entry.performance_level) return null;
          return { ...base, score: 0, performance_level: entry.performance_level, is_absent: false };
        }
        const score = parseFloat(entry.score);
        if (isNaN(score) || entry.score === "") return null;
        return {
          ...base, score, is_absent: false,
          performance_level: entry.performance_level || getPerformanceLevel(score, selectedAssessment.max_marks),
        };
      }).filter(Boolean);

      if (!records.length) {
        setError(isFormativeMode
          ? "Select EE / ME / AE / BE for at least one student."
          : "Enter a score for at least one student.");
        setSaving(false);
        return;
      }

      const { error: upsertError } = await supabase
        .from("assessment_results")
        .upsert(records, { onConflict: "assessment_id, student_id, subject_id", ignoreDuplicates: false });

      if (upsertError) throw upsertError;

      setSuccess(isFormativeMode
        ? `${records.length} result(s) saved and published!`
        : `${records.length} result(s) saved as draft for admin to publish.`);

      const { data: refreshed } = await supabase
        .from("assessment_results")
        .select("student_id, score, performance_level, teacher_remarks, is_absent, assessment_date")
        .eq("assessment_id", selectedAssessment.id)
        .eq("subject_id", selectedSubjectId)
        .in("status", ["draft", "published"]);

      if (isMounted.current) {
        const newMap: Record<string, ExistingResult> = {};
        refreshed?.forEach((r) => { newMap[r.student_id] = r; });
        setExistingResults(newMap);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to save. Please try again.");
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const isFormative = selectedAssessment?.category === "formative";

  const filledCount = students.filter((s) => {
    const e = entries[s.id];
    if (!e) return false;
    if (e.is_absent) return true;
    if (isFormative) return !!e.performance_level;
    return e.score !== "";
  }).length;

  const strandName    = firstRel(selectedAssessment?.strands)?.name;
  const subStrandName = firstRel(selectedAssessment?.sub_strands)?.name;

  const filteredHistory = historyItems.filter((item) => {
    if (historyFilter === "all") return true;
    return item.assessment.category === historyFilter;
  });

  const showMarksTable =
    mode === "summative" ||
    (mode === "formative" && !!selectedAssessment) ||
    (mode === "history" && editingHistory);

  const handleMarksBack = () => {
    if (editingHistory) {
      handleBackToHistory();
    } else {
      setSelectedAssessment(null);
      setSelectedSubjectId("");
      resetMarksState();
      setSuccess(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Mode switcher ── */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "summative" ? "default" : "outline"} size="sm"
          onClick={() => switchMode("summative")}
          className={mode === "summative" ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          <ClipboardList className="h-4 w-4 mr-2" /> Enter Exam Marks
        </Button>
        <Button
          variant={mode === "formative" ? "default" : "outline"} size="sm"
          onClick={() => switchMode("formative")}
          className={mode === "formative" ? "bg-teal-600 hover:bg-teal-700" : ""}
        >
          <Plus className="h-4 w-4 mr-2" /> Record Class Activity
        </Button>
        <Button
          variant={mode === "history" ? "default" : "outline"} size="sm"
          onClick={() => switchMode("history")}
          className={mode === "history" ? "bg-orange-600 hover:bg-orange-700" : ""}
        >
          <History className="h-4 w-4 mr-2" /> View &amp; Edit History
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {mode === "summative" && <><ClipboardList className="h-5 w-5 text-purple-600" /> Enter Exam Marks</>}
            {mode === "formative" && <><Plus className="h-5 w-5 text-teal-600" /> Record Formative / Class Activity</>}
            {mode === "history"   && <><History className="h-5 w-5 text-orange-600" /> View &amp; Edit History</>}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">

          {/* ════════ SUMMATIVE MODE ════════ */}
          {mode === "summative" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="assessment">Assessment</Label>
                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger id="assessment"><SelectValue placeholder="Select an assessment" /></SelectTrigger>
                  <SelectContent>
                    {loadingAssessments ? (
                      <div className="flex items-center justify-center p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : assessments.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">No exams available for your classes</div>
                    ) : assessments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.title} — Term {a.term}, {a.year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAssessment && (
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Your Subject</Label>
                  <Select value={selectedSubjectId} onValueChange={(v) => { setSelectedSubjectId(v); setError(null); setSuccess(null); }}>
                    <SelectTrigger id="subject"><SelectValue placeholder="Select your subject" /></SelectTrigger>
                    <SelectContent>
                      {availableSubjects.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No subjects found for this class</div>
                      ) : availableSubjects.map((tc) => {
                        const subj = firstRel(tc.subjects);
                        return <SelectItem key={tc.subject_id} value={tc.subject_id}>{subj?.name ?? tc.subject_id}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* ════════ FORMATIVE CREATION FORM ════════ */}
          {mode === "formative" && !selectedAssessment && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a new formative assessment. Results publish immediately — no admin approval needed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Class *</Label>
                  <Select value={fClassId} onValueChange={(v) => { setFClassId(v); setFSubjectId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {teacherClassList.map((tc) => {
                        const cls = firstRel(tc.classes);
                        return (
                          <SelectItem key={tc.class_id} value={tc.class_id}>
                            {cls?.name ?? tc.class_id} {cls?.grade_level ? `(Grade ${cls.grade_level})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject *</Label>
                  <Select value={fSubjectId} onValueChange={setFSubjectId} disabled={!fClassId}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {formativeSubjects.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">Select a class first</div>
                      ) : formativeSubjects.map((tc) => {
                        const subj = firstRel(tc.subjects);
                        return <SelectItem key={tc.subject_id} value={tc.subject_id}>{subj?.name ?? tc.subject_id}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Activity Title *</Label>
                <Input placeholder="e.g. Week 5 Fractions Activity" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5 text-teal-600" />
                    Strand <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                  </Label>
                  <Input placeholder="e.g. Numbers, Measurement, Reading" value={fStrand} onChange={(e) => setFStrand(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sub-strand <span className="text-muted-foreground text-xs ml-1">(optional)</span></Label>
                  <Input placeholder="e.g. Fractions, Whole Numbers" value={fSubStrand}
                    onChange={(e) => setFSubStrand(e.target.value)} disabled={!fStrand.trim()} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Term *</Label>
                  <Select value={fTerm} onValueChange={setFTerm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Year *</Label>
                  <Input type="number" value={fYear} onChange={(e) => setFYear(e.target.value)} min="2020" max="2100" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                </div>
              </div>
              {createError && (
                <div className="bg-red-50 text-red-800 p-3 rounded-lg flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {createError}
                </div>
              )}
              <Button
                onClick={handleCreateFormative}
                disabled={creatingFormative || !fClassId || !fSubjectId || !fTitle.trim() || !fDate}
                className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
              >
                {creatingFormative
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                  : <><Plus className="mr-2 h-4 w-4" /> Create &amp; Enter Marks</>}
              </Button>
            </div>
          )}

          {/* ════════ HISTORY MODE ════════ */}
          {mode === "history" && !editingHistory && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {(["all", "summative", "formative"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      historyFilter === f
                        ? "bg-orange-600 text-white border-orange-600"
                        : "border-gray-200 text-muted-foreground hover:border-gray-400"
                    }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground self-center ml-1">
                  {filteredHistory.length} record{filteredHistory.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No filled assessments found yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredHistory.map((item, idx) => {
                    const strandN    = firstRel(item.assessment.strands)?.name;
                    const subStrandN = firstRel(item.assessment.sub_strands)?.name;
                    const cls = teacherClasses.find((tc) => tc.class_id === item.assessment.class_id);
                    const className = firstRel(cls?.classes)?.name ?? item.assessment.class_id;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card gap-3"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">{item.assessment.title}</span>
                            <CategoryBadge category={item.assessment.category} />
                            <Badge
                              variant="outline"
                              className={item.status === "published"
                                ? "bg-green-50 text-green-700 border-green-200 text-xs"
                                : "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"}
                            >
                              {item.status === "published" ? "Published" : "Draft"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{className}</span>
                            <span>•</span>
                            <span>{item.subject_name}</span>
                            <span>•</span>
                            <span>Term {item.assessment.term}, {item.assessment.year}</span>
                            <span>•</span>
                            <span>{item.result_count} student{item.result_count !== 1 ? "s" : ""}</span>
                            {item.latest_date && (
                              <><span>•</span><span>{new Date(item.latest_date).toLocaleDateString()}</span></>
                            )}
                          </div>
                          {strandN && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <BookOpen className="h-3 w-3" />
                              {strandN}{subStrandN && ` › ${subStrandN}`}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditHistoryItem(item)}
                          className="h-8 shrink-0 gap-1"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════ MARKS TABLE ════════ */}
          {showMarksTable && (
            <MarksTable
              mode={mode}
              editingHistory={editingHistory}
              selectedAssessment={selectedAssessment}
              selectedSubjectId={selectedSubjectId}
              students={students}
              entries={entries}
              loadingData={loadingData}
              saving={saving}
              error={error}
              success={success}
              filledCount={filledCount}
              strandName={strandName}
              subStrandName={subStrandName}
              fDate={fDate}
              onBack={handleMarksBack}
              onScoreChange={handleScoreChange}
              onLevelChange={handleLevelChange}
              onRemarksChange={handleRemarksChange}
              onDateChange={handleDateChange}
              onAbsentToggle={handleAbsentToggle}
              onSave={handleSave}
            />
          )}

        </CardContent>
      </Card>
    </div>
  );
}