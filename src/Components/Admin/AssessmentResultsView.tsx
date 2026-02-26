import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { ArrowLeft, Search, FileSignature } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Skeleton } from '@/Components/ui/skeleton';
import { Badge } from '@/Components/ui/badge';
import { format } from 'date-fns';

// ── Performance level badge ───────────────────────────────────────────────────
function PerformanceLevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-gray-400">-</span>;

  const styles: Record<string, string> = {
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

  const normalized = level.toUpperCase().trim();
  const style = styles[normalized] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${style}`}>
      {normalized}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AssessmentResultsView({ assessment, onBack = () => {} }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingResult, setEditingResult] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showStudentEdit, setShowStudentEdit] = useState(false);
  const [studentMarks, setStudentMarks] = useState<Record<string, number | ''>>({});

  // Determine if this is a formative/portfolio assessment
  const isFormative = assessment?.category === 'formative' || assessment?.category === 'portfolio';

  // ── Print ────────────────────────────────────────────────────────────────

  const printStudentResult = (student) => {
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

  const openStudentEdit = (student) => {
    setSelectedStudent(student);
    const marks: Record<string, number | ''> = {};
    for (const subj of subjectsForAssessment) {
      const r = resultLookup.get(`${student.id}_${subj.id}`);
      marks[subj.id] = r ? r.score : '';
    }
    setStudentMarks(marks);
    setShowStudentEdit(true);
  };

  const saveStudentMarks = async () => {
    if (!selectedStudent) return;
    const rowsToUpsert = [];
    for (const subjId of Object.keys(studentMarks)) {
      const score = studentMarks[subjId];
      if (score === '' || score == null) continue;
      const existing = resultLookup.get(`${selectedStudent.id}_${subjId}`);
      const payload: any = {
        assessment_id: assessment.id,
        student_id: selectedStudent.id,
        subject_id: subjId,
        score: Number(score),
        assessment_date: existing?.assessment_date || new Date().toISOString(),
        max_marks: existing?.max_marks || null,
      };
      if (existing && existing.id) payload.id = existing.id;
      rowsToUpsert.push(payload);
    }
    if (rowsToUpsert.length === 0) {
      setShowStudentEdit(false);
      return;
    }
    try {
      const { error } = await supabase.from('assessment_results').upsert(rowsToUpsert, { onConflict: 'id' });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['assessmentResults', assessment.id] });
      setShowStudentEdit(false);
    } catch (err: any) {
      console.error('Failed to save student marks', err);
      alert('Failed to save marks: ' + (err?.message || err));
    }
  };

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: results, isLoading: isLoadingResults } = useQuery({
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
    initialData: [],
    enabled: !!assessment?.id,
  });

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const { data: subjects, isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*');
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  // ── Maps ──────────────────────────────────────────────────────────────────

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, `${s.first_name} ${s.last_name}`])), [students]);
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateMutation = useMutation<any, any, any>({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('assessment_results').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults', assessment.id] });
      setEditingResult(null);
    },
  });

  const deleteMutation = useMutation<any, any, any>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('assessment_results').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults', assessment.id] });
    },
  });

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const raw = formData.get('score');
    const score = parseFloat(typeof raw === 'string' ? raw : String(raw ?? ''));
    if (editingResult && !isNaN(score)) {
      updateMutation.mutate({ id: editingResult.id, data: { score } });
    }
  };

  // ── Pivot data ────────────────────────────────────────────────────────────

  const subjectsForAssessment = useMemo(() => {
    const subjectIds = new Set(results.map(r => r.subject_id));
    return subjects.filter(s => subjectIds.has(s.id));
  }, [results, subjects]);

  const studentsForAssessment = useMemo(() => {
    const studentIds = Array.from(new Set(results.map(r => r.student_id)));
    return students.filter(s => studentIds.includes(s.id));
  }, [results, students]);

  const resultLookup = useMemo(() => {
    const map = new Map();
    for (const r of results) {
      map.set(`${r.student_id}_${r.subject_id}`, r);
    }
    return map;
  }, [results]);

  // Summative only: totals and positions
  const studentTotals = useMemo(() => {
    if (isFormative) return new Map();
    const m = new Map();
    for (const s of studentsForAssessment) {
      let total = 0;
      for (const subj of subjectsForAssessment) {
        const r = resultLookup.get(`${s.id}_${subj.id}`);
        const score = r && typeof r.score === 'number' ? Number(r.score) : (r && r.score ? Number(r.score) : 0);
        total += isNaN(score) ? 0 : score;
      }
      m.set(s.id, total);
    }
    return m;
  }, [studentsForAssessment, subjectsForAssessment, resultLookup, isFormative]);

  const studentPositions = useMemo(() => {
    if (isFormative) return new Map();
    const totals = Array.from(studentTotals.values());
    const uniqueSorted = Array.from(new Set(totals)).sort((a, b) => (b as number) - (a as number));
    const posMap = new Map();
    uniqueSorted.forEach((t, i) => posMap.set(t, i + 1));
    const byStudent = new Map();
    for (const [studentId, total] of studentTotals.entries()) {
      byStudent.set(studentId, posMap.get(total));
    }
    return byStudent;
  }, [studentTotals, isFormative]);

  // ── Search filter ─────────────────────────────────────────────────────────

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

  // Extra columns: summative has Total + Position = 2 extra, formative has Remarks = 1 extra
  const extraColCount = isFormative ? 2 : 3; // name + total + position OR name + remarks

  return (
    <div>
      {!assessment && (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-md mb-6">
          <p className="font-medium">No assessment selected.</p>
          <p className="text-sm text-muted-foreground">Open the Assessments list and click "View Results" on an assessment to see its results.</p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Results for: {assessment.title}</h2>
          <p className="text-sm text-gray-500">
            {studentsForAssessment.length} students × {subjectsForAssessment.length} subjects
            {isFormative && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold bg-teal-100 text-teal-800 border-teal-200 capitalize">
                {assessment.category}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search by student or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={async () => {
            setShowRaw(r => !r);
            if (!showRaw) {
              const { data, error } = await supabase.from('assessment_results').select('*').eq('assessment_id', assessment.id);
              if (error) {
                console.error('Debug fetch assessment_results error', error);
                setRawRows([]);
              } else {
                setRawRows(data || []);
              }
            }
          }}>{showRaw ? 'Hide raw results' : 'Show raw results'}</Button>
        </div>
        {showRaw && (
          <pre className="mt-2 text-xs bg-gray-50 border rounded p-3 overflow-auto max-h-48">
            {JSON.stringify(rawRows, null, 2)}
          </pre>
        )}
      </div>

      {/* ── FORMATIVE TABLE ── */}
      {isFormative ? (
        <div className="overflow-x-auto border rounded-lg">
          {isLoading ? (
            <div className="p-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full mb-3" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  {subjectsForAssessment.map(subj => (
                    <TableHead key={subj.id}>{subj.name}</TableHead>
                  ))}
                  <TableHead>Remarks</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={subjectsForAssessment.length + 3} className="text-center h-24 text-gray-500">
                      No results found for this assessment.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map(student => {
                    // Collect remarks across subjects for this student
                    const allRemarks = subjectsForAssessment
                      .map(subj => resultLookup.get(`${student.id}_${subj.id}`)?.teacher_remarks)
                      .filter(Boolean)
                      .join('; ');

                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{`${student.first_name} ${student.last_name}`}</TableCell>
                        {subjectsForAssessment.map(subj => {
                          const r = resultLookup.get(`${student.id}_${subj.id}`);
                          return (
                            <TableCell key={subj.id} className="text-center">
                              <PerformanceLevelBadge level={r?.performance_level ?? null} />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                          {allRemarks || '-'}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => printStudentResult(student)}>
                            Print
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      ) : (
        // ── SUMMATIVE TABLE ──
        <div className="overflow-x-auto border rounded-lg">
          {isLoading ? (
            <div className="p-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full mb-3" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  {subjectsForAssessment.map(subj => (
                    <TableHead key={subj.id}>{subj.name}</TableHead>
                  ))}
                  <TableHead>Total</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={subjectsForAssessment.length + 4} className="text-center h-24 text-gray-500">
                      No results found for this assessment.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{`${student.first_name} ${student.last_name}`}</TableCell>
                      {subjectsForAssessment.map(subj => {
                        const key = `${student.id}_${subj.id}`;
                        const r = resultLookup.get(key);
                        return (
                          <TableCell key={subj.id} className="text-center">
                            <span>{r ? r.score : '-'}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-medium">{studentTotals.get(student.id) ?? '-'}</TableCell>
                      <TableCell className="text-center">{studentPositions.get(student.id) ?? '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => openStudentEdit(student)}>
                            Edit Marks
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => printStudentResult(student)}>
                            Print
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ── Student Edit Modal (summative only) ── */}
      {showStudentEdit && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Marks for {selectedStudent.first_name} {selectedStudent.last_name}</h3>
            <div className="space-y-3 max-h-96 overflow-auto">
              {subjectsForAssessment.map(subj => (
                <div key={subj.id} className="flex items-center space-x-3">
                  <div className="w-1/3">{subj.name}</div>
                  <input
                    className="border rounded px-2 py-1 w-32"
                    type="number"
                    value={studentMarks[subj.id] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStudentMarks(prev => ({ ...prev, [subj.id]: v === '' ? '' : Number(v) }));
                    }}
                  />
                  <div className="text-sm text-gray-500">
                    Max: {resultLookup.get(`${selectedStudent.id}_${subj.id}`)?.max_marks ?? '-'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setShowStudentEdit(false)}>Cancel</Button>
              <Button onClick={saveStudentMarks}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Result Modal ── */}
      <Dialog open={!!editingResult} onOpenChange={() => setEditingResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5" />
              Edit Result
            </DialogTitle>
            <DialogDescription>
              Update the score for {studentMap.get(editingResult?.student_id)} in {subjectMap.get(editingResult?.subject_id)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="score">Score</Label>
                <Input
                  id="score"
                  name="score"
                  type="number"
                  defaultValue={editingResult?.score}
                  max={editingResult?.max_marks}
                  required
                />
              </div>
              <p className="text-sm text-gray-500">Max Marks: {editingResult?.max_marks}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingResult(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}