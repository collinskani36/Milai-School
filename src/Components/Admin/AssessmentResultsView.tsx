// src/Components/Admin/AssessmentResultsView.tsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { ArrowLeft, Search, FileSignature, AlertTriangle, Eye, EyeOff, Printer, Pencil, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Skeleton } from '@/Components/ui/skeleton';

// ─── Design tokens (mirrors every other Admin section) ───────────────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};
const TABLE_HEAD_STYLE: React.CSSProperties = { background: MAROON_GRADIENT };

// ── Type Definitions ─────────────────────────────────────────────────────────
interface Assessment {
  id: string;
  title: string;
  category: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface AssessmentResult {
  id: string;
  assessment_id: string;
  student_id: string;
  subject_id: string;
  score?: number;
  max_marks?: number;
  performance_level?: string;
  teacher_remarks?: string;
  assessment_date?: string;
}

// ── Performance level badge ───────────────────────────────────────────────────
function PerformanceLevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-muted-foreground/60">—</span>;

  const styles: Record<string, string> = {
    EE:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    EE1: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EE2: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ME:  'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/25',
    ME1: 'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/25',
    ME2: 'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/25',
    AE:  'bg-amber-50 text-amber-700 border-amber-200',
    AE1: 'bg-amber-50 text-amber-700 border-amber-200',
    AE2: 'bg-amber-50 text-amber-700 border-amber-200',
    BE:  'bg-red-50 text-red-700 border-red-200',
    BE1: 'bg-red-50 text-red-700 border-red-200',
    BE2: 'bg-red-50 text-red-700 border-red-200',
  };

  const normalized = level.toUpperCase().trim();
  const style = styles[normalized] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${style}`}>
      {normalized}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface AssessmentResultsViewProps {
  assessment: Assessment | null;
  onBack?: () => void;
}

export default function AssessmentResultsView({ assessment, onBack = () => {} }: AssessmentResultsViewProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingResult, setEditingResult] = useState<AssessmentResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [rawRows, setRawRows] = useState<AssessmentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentEdit, setShowStudentEdit] = useState(false);
  const [studentMarks, setStudentMarks] = useState<Record<string, number | ''>>({});

  const isFormative = assessment?.category === 'formative' || assessment?.category === 'portfolio';

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: results = [], isLoading: isLoadingResults } = useQuery({
    queryKey: ['assessmentResults', assessment?.id ?? 'none'],
    queryFn: async () => {
      if (!assessment?.id) return [];
      const { data, error } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('assessment_id', assessment.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assessment?.id,
  });

  const studentIds = useMemo(() => {
    if (!results.length) return [];
    return Array.from(new Set(results.map(r => r.student_id)));
  }, [results]);

  const subjectIds = useMemo(() => {
    if (!results.length) return [];
    return Array.from(new Set(results.map(r => r.subject_id)));
  }, [results]);

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assessment?.id && studentIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjects = [], isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['subjects', subjectIds],
    queryFn: async () => {
      if (subjectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .in('id', subjectIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assessment?.id && subjectIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ── Maps ──────────────────────────────────────────────────────────────────
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, `${s.first_name} ${s.last_name}`])), [students]);
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation<void, Error, { id: string; data: Partial<AssessmentResult> }>({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('assessment_results').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults', assessment?.id] });
      setEditingResult(null);
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('assessment_results').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults', assessment?.id] });
    },
  });
  void deleteMutation;

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const raw = formData.get('score');
    const score = parseFloat(raw?.toString() ?? '');
    if (editingResult && !isNaN(score)) {
      updateMutation.mutate({ id: editingResult.id, data: { score } });
    }
  };

  // ── Pivot data ────────────────────────────────────────────────────────────
  const subjectsForAssessment = subjects;
  const studentsForAssessment = students;

  const resultLookup = useMemo(() => {
    const map = new Map<string, AssessmentResult>();
    for (const r of results) {
      map.set(`${r.student_id}_${r.subject_id}`, r);
    }
    return map;
  }, [results]);

  const studentTotals = useMemo(() => {
    if (isFormative) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const s of studentsForAssessment) {
      let total = 0;
      for (const subj of subjectsForAssessment) {
        const r = resultLookup.get(`${s.id}_${subj.id}`);
        const score = r?.score ?? 0;
        total += typeof score === 'number' ? score : 0;
      }
      m.set(s.id, total);
    }
    return m;
  }, [studentsForAssessment, subjectsForAssessment, resultLookup, isFormative]);

  const studentPositions = useMemo(() => {
    if (isFormative) return new Map<string, number>();
    const totals = Array.from(studentTotals.values());
    const uniqueSorted = Array.from(new Set(totals)).sort((a, b) => b - a);
    const posMap = new Map<number, number>();
    uniqueSorted.forEach((t, i) => posMap.set(t, i + 1));
    const byStudent = new Map<string, number>();
    for (const [studentId, total] of studentTotals.entries()) {
      byStudent.set(studentId, posMap.get(total) ?? 0);
    }
    return byStudent;
  }, [studentTotals, isFormative]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return studentsForAssessment;
    const q = searchTerm.toLowerCase();
    return studentsForAssessment.filter(s => {
      const studentName = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (studentName.includes(q)) return true;
      for (const subj of subjectsForAssessment) {
        if ((subj.name || '').toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [studentsForAssessment, subjectsForAssessment, searchTerm]);

  const isLoading = isLoadingResults || isLoadingStudents || isLoadingSubjects;

  // ── Print function ────────────────────────────────────────────────────────
  const printStudentResult = (student: Student) => {
    const rows = subjectsForAssessment.map(subj => {
      const r = resultLookup.get(`${student.id}_${subj.id}`);
      if (isFormative) {
        return `<tr><td>${subj.name}</td><td>${r?.performance_level || '-'}</td><td>${r?.teacher_remarks || '-'}</td></tr>`;
      }
      return `<tr><td>${subj.name}</td><td>${r ? r.score : '-'}</td><td>${r ? r.max_marks : '-'}</td></tr>`;
    }).join('');

    const summaryRow = isFormative
      ? ''
      : `<p><strong>Total:</strong> ${studentTotals.get(student.id) ?? '-'} &nbsp; <strong>Position:</strong> ${studentPositions.get(student.id) ?? '-'}</p>`;

    const tableHeader = isFormative
      ? `<thead><tr><th>Subject</th><th>Performance Level</th><th>Remarks</th></tr></thead>`
      : `<thead><tr><th>Subject</th><th>Score</th><th>Max Marks</th></tr></thead>`;

    const html = `
      <html>
        <head>
          <title>Result - ${student.first_name} ${student.last_name}</title>
          <style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>
        </head>
        <body>
          <h2>Result for ${student.first_name} ${student.last_name}</h2>
          <p>Assessment: ${assessment?.title || ''}</p>
          <p>Category: ${assessment?.category || ''}</p>
          <table>
            ${tableHeader}
            <tbody>${rows}</tbody>
          </table>
          ${summaryRow}
        </body>
      </html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } else {
      alert('Pop-up blocked. Please allow pop-ups for this site to print.');
    }
  };

  // ── Edit student marks ────────────────────────────────────────────────────
  const openStudentEdit = (student: Student) => {
    setSelectedStudent(student);
    const marks: Record<string, number | ''> = {};
    for (const subj of subjectsForAssessment) {
      const r = resultLookup.get(`${student.id}_${subj.id}`);
      marks[subj.id] = r?.score ?? '';
    }
    setStudentMarks(marks);
    setShowStudentEdit(true);
  };

  const saveStudentMarks = async () => {
    if (!selectedStudent) return;
    const rowsToUpsert: Partial<AssessmentResult>[] = [];
    for (const subjId of Object.keys(studentMarks)) {
      const score = studentMarks[subjId];
      if (score === '' || score == null) continue;
      const existing = resultLookup.get(`${selectedStudent.id}_${subjId}`);
      const payload: Partial<AssessmentResult> = {
        assessment_id: assessment!.id,
        student_id: selectedStudent.id,
        subject_id: subjId,
        score: Number(score),
        assessment_date: existing?.assessment_date || new Date().toISOString(),
        max_marks: existing?.max_marks || null,
      };
      if (existing?.id) payload.id = existing.id;
      rowsToUpsert.push(payload);
    }
    if (rowsToUpsert.length === 0) {
      setShowStudentEdit(false);
      return;
    }
    try {
      const { error } = await supabase.from('assessment_results').upsert(rowsToUpsert, { onConflict: 'id' });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['assessmentResults', assessment!.id] });
      setShowStudentEdit(false);
    } catch (err: any) {
      console.error('Failed to save student marks', err);
      alert('Failed to save marks: ' + (err?.message || err));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      {!assessment && (
        <div className="rounded-2xl p-5 border border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">No assessment selected</p>
              <p className="text-xs text-amber-700/80 mt-0.5">
                Open the Assessments list and click "View" on an assessment to see its results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header with back button + gradient hero ── */}
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-[#7a1f2b] hover:bg-[#7a1f2b]/5 border border-[#7a1f2b]/15 active:scale-[0.98] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Assessments
        </button>

        <div
          className="relative overflow-hidden rounded-2xl p-4 sm:p-5"
          style={{ background: MAROON_GRADIENT, boxShadow: '0 18px 40px -22px rgba(122,31,43,0.45)' }}
        >
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)' }} />
          <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)' }} />

          <div className="relative flex items-start gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
              <FileSignature className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">
                Results
              </p>
              <h1 className="text-base sm:text-xl font-bold text-white leading-tight truncate">
                {assessment?.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-[11px] sm:text-xs text-white/70">
                  {studentsForAssessment.length} students × {subjectsForAssessment.length} subjects
                </p>
                {isFormative && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/20 text-white border border-white/20 capitalize">
                    {assessment?.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + Raw toggle ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a1f2b]/40 w-4 h-4" />
          <Input
            placeholder="Search by student or subject…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98] text-xs gap-1.5"
            onClick={() => {
              setShowRaw(r => !r);
              if (!showRaw) setRawRows(results);
            }}
          >
            {showRaw ? <><EyeOff className="w-3.5 h-3.5" />Hide raw results</> : <><Eye className="w-3.5 h-3.5" />Show raw results</>}
          </Button>
        </div>
        {showRaw && (
          <pre className="text-[11px] rounded-xl border border-[#7a1f2b]/15 bg-[#fdfbfb] p-3 overflow-auto max-h-48 text-[#3a1b1f]">
            {JSON.stringify(rawRows, null, 2)}
          </pre>
        )}
      </div>

      {/* ══════════ FORMATIVE TABLE ══════════ */}
      {isFormative ? (
        <div className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden"
          style={{ boxShadow: CARD_SHADOW }}>
          {isLoading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ background: 'rgba(122,31,43,0.06)' }} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10" style={TABLE_HEAD_STYLE}>
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Student Name</TableHead>
                    {subjectsForAssessment.map(subj => (
                      <TableHead key={subj.id} className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-center">{subj.name}</TableHead>
                    ))}
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Remarks</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={subjectsForAssessment.length + 3} className="text-center h-24 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <FileSignature className="w-8 h-8 text-[#7a1f2b]/15" />
                          <span className="text-sm">No results found for this assessment.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map(student => {
                      const allRemarks = subjectsForAssessment
                        .map(subj => resultLookup.get(`${student.id}_${subj.id}`)?.teacher_remarks)
                        .filter(Boolean)
                        .join('; ');

                      return (
                        <TableRow key={student.id}
                          className="border-b border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.03] transition-colors">
                          <TableCell className="font-medium text-[#3a1b1f]">
                            {`${student.first_name} ${student.last_name}`}
                          </TableCell>
                          {subjectsForAssessment.map(subj => {
                            const r = resultLookup.get(`${student.id}_${subj.id}`);
                            return (
                              <TableCell key={subj.id} className="text-center">
                                <PerformanceLevelBadge level={r?.performance_level ?? null} />
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {allRemarks || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline"
                              className="h-8 rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]"
                              onClick={() => printStudentResult(student)}>
                              <Printer className="w-3 h-3 mr-1.5" />Print
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        // ══════════ SUMMATIVE TABLE ══════════
        <div className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden"
          style={{ boxShadow: CARD_SHADOW }}>
          {isLoading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ background: 'rgba(122,31,43,0.06)' }} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10" style={TABLE_HEAD_STYLE}>
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Student Name</TableHead>
                    {subjectsForAssessment.map(subj => (
                      <TableHead key={subj.id} className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-center">{subj.name}</TableHead>
                    ))}
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-center">Total</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-center">Position</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={subjectsForAssessment.length + 4} className="text-center h-24 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <FileSignature className="w-8 h-8 text-[#7a1f2b]/15" />
                          <span className="text-sm">No results found for this assessment.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map(student => (
                      <TableRow key={student.id}
                        className="border-b border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.03] transition-colors">
                        <TableCell className="font-medium text-[#3a1b1f]">
                          {`${student.first_name} ${student.last_name}`}
                        </TableCell>
                        {subjectsForAssessment.map(subj => {
                          const key = `${student.id}_${subj.id}`;
                          const r = resultLookup.get(key);
                          return (
                            <TableCell key={subj.id} className="text-center text-sm text-[#3a1b1f]/80">
                              {r ? r.score : <span className="text-muted-foreground/60">—</span>}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b] font-bold text-sm border border-[#7a1f2b]/15">
                            {studentTotals.get(student.id) ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#7a1f2b]/10 text-[#7a1f2b] font-bold text-xs border border-[#7a1f2b]/20">
                            #{studentPositions.get(student.id) ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            <Button size="sm"
                              className="h-8 rounded-lg text-white border-0 active:scale-[0.98]"
                              style={GRADIENT_BTN_STYLE}
                              onClick={() => openStudentEdit(student)}>
                              <Pencil className="w-3 h-3 mr-1.5" />Edit Marks
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-8 rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]"
                              onClick={() => printStudentResult(student)}>
                              <Printer className="w-3 h-3 mr-1.5" />Print
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ══════════ Student Edit Modal (custom — summative only) ══════════ */}
      {showStudentEdit && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowStudentEdit(false)} />
          <div
            className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-2xl border border-[#7a1f2b]/15 overflow-hidden"
            style={{ boxShadow: '0 24px 60px -24px rgba(122,31,43,0.45)' }}
          >
            {/* Gradient header */}
            <div className="relative overflow-hidden shrink-0" style={{ background: MAROON_GRADIENT }}>
              <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
              <div className="relative px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                  <Pencil className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                    Edit Marks
                  </p>
                  <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h3>
                </div>
                <button
                  onClick={() => setShowStudentEdit(false)}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors active:scale-95 shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#fdfbfb] space-y-3">
              {subjectsForAssessment.map(subj => {
                const existing = resultLookup.get(`${selectedStudent.id}_${subj.id}`);
                return (
                  <div key={subj.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#7a1f2b]/10 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#3a1b1f] truncate">{subj.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Max: {existing?.max_marks ?? '—'}
                      </div>
                    </div>
                    <input
                      className="w-24 h-10 rounded-xl border border-[#7a1f2b]/15 px-3 text-sm text-[#3a1b1f] focus:outline-none focus:ring-2 focus:ring-[#7a1f2b]/30 text-center font-semibold"
                      type="number"
                      value={studentMarks[subj.id] ?? ''}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value;
                        setStudentMarks(prev => ({ ...prev, [subj.id]: v === '' ? '' : Number(v) }));
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-[#7a1f2b]/10 bg-white">
              <Button variant="outline" onClick={() => setShowStudentEdit(false)}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button onClick={saveStudentMarks}
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
                style={GRADIENT_BTN_STYLE}>
                Save Marks
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Edit Result Dialog ══════════ */}
      <Dialog open={!!editingResult} onOpenChange={() => setEditingResult(null)}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-[#3a1b1f]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={GRADIENT_BTN_STYLE}>
                <FileSignature className="w-4 h-4 text-white" />
              </div>
              Edit Result
            </DialogTitle>
            <DialogDescription className="pt-2 text-[#3a1b1f]/70">
              Update the score for <strong className="text-[#3a1b1f]">{studentMap.get(editingResult?.student_id ?? '')}</strong>{' '}
              in <strong className="text-[#3a1b1f]">{subjectMap.get(editingResult?.subject_id ?? '')}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="py-3 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="score" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Score
                </Label>
                <Input
                  id="score"
                  name="score"
                  type="number"
                  defaultValue={editingResult?.score}
                  max={editingResult?.max_marks}
                  required
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
                />
                <p className="text-[11px] text-muted-foreground">Max Marks: {editingResult?.max_marks}</p>
              </div>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t border-[#7a1f2b]/10 mt-2">
              <Button type="button" variant="outline" onClick={() => setEditingResult(null)}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button type="submit"
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
                style={GRADIENT_BTN_STYLE}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}