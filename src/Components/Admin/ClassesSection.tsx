import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import {
  Plus, Pencil, Trash2, BookOpen, Users, GraduationCap,
  X, Calendar, CheckSquare, Square, AlertTriangle, LayoutGrid,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Checkbox } from '@/Components/ui/checkbox';
import { Badge } from '@/Components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Skeleton } from '@/Components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type PromotionStatus = 'promoted' | 'retained' | 'graduated' | 'transferred';
type DbPromotionStatus = 'promoted' | 'retained' | 'graduated' | 'withdrawn';

interface PromotionDecision {
  studentId: string;
  enrollmentId: string;
  studentName: string;
  status: PromotionStatus;
  toClassId: string;
  transferSchool: string;
}

// ─── Shared student fetcher ───────────────────────────────────────────────────

async function fetchStudentsForClass(classId: string) {
  const { data: enrollments, error: eErr } = await supabase
    .from('enrollments')
    .select('id, student_id')
    .eq('class_id', classId);
  if (eErr) throw eErr;
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e: any) => e.student_id);

  const [studentsRes, profilesRes] = await Promise.all([
    supabase.from('students').select('id, Reg_no, first_name, last_name').in('id', studentIds),
    supabase.from('profiles').select('student_id, gender').in('student_id', studentIds),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const studentMap: Record<string, any> = {};
  (studentsRes.data || []).forEach((s: any) => { studentMap[s.id] = s; });

  const profileMap: Record<string, any> = {};
  (profilesRes.data || []).forEach((p: any) => { if (p.student_id) profileMap[p.student_id] = p; });

  return (enrollments || []).map((e: any) => {
    const s = studentMap[e.student_id];
    const p = profileMap[e.student_id];
    return {
      enrollmentId: e.id,
      id:           s?.id ?? e.student_id,
      reg_no:       s?.Reg_no ?? '',
      first_name:   s?.first_name ?? '',
      last_name:    s?.last_name ?? '',
      gender:       p?.gender ?? '-',
    };
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClassesSection() {

  // ── State ──────────────────────────────────────────────────────────────────

  const [showClassModal, setShowClassModal]               = useState(false);
  const [showSubjectModal, setShowSubjectModal]           = useState(false);
  const [showClassDetailModal, setShowClassDetailModal]   = useState(false);
  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
  const [showGradeLevelModal, setShowGradeLevelModal]     = useState(false);
  const [editingClass, setEditingClass]     = useState<any>(null);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [selectedClass, setSelectedClass]   = useState<any>(null);
  const [selectedSubjects, setSelectedSubjects]   = useState<string[]>([]);
  const [optionalSubjects, setOptionalSubjects]   = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm]           = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear().toString());
  const [titleInput, setTitleInput]   = useState('');
  const [uploadFile, setUploadFile]   = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Overview filter
  const [overviewFilter, setOverviewFilter] = useState('');

  // Promotion
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionClass, setPromotionClass]         = useState<any>(null);
  const [decisions, setDecisions]                   = useState<Record<string, PromotionDecision>>({});
  const [selectedForBulk, setSelectedForBulk]       = useState<string[]>([]);
  const [bulkStatus, setBulkStatus]   = useState<PromotionStatus>('promoted');
  const [bulkToClassId, setBulkToClassId]           = useState('');
  const [runningPromotion, setRunningPromotion]     = useState(false);
  const [promotionDone, setPromotionDone]           = useState(false);
  const [promotionResult, setPromotionResult]       = useState<Record<PromotionStatus, number> | null>(null);
  const [promotionError, setPromotionError]         = useState<string | null>(null);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: classes, isLoading: loadingClasses, error: classesError } = useQuery({
    queryKey: ['classes-with-details'],
    queryFn: async () => {
      const [classesRes, csRes, enrollRes] = await Promise.all([
        supabase.from('classes').select('id, name, grade_level, created_at').order('grade_level').order('name'),
        supabase.from('classes_subjects').select('id, class_id, subject_id, is_optional, subjects(id, name, code)'),
        supabase.from('enrollments').select('class_id'),
      ]);
      if (classesRes.error) throw classesRes.error;
      if (csRes.error)      throw csRes.error;
      if (enrollRes.error)  throw enrollRes.error;

      const countMap: Record<string, number> = {};
      (enrollRes.data || []).forEach((e: any) => {
        countMap[e.class_id] = (countMap[e.class_id] || 0) + 1;
      });

      const subjectsMap: Record<string, any[]> = {};
      (csRes.data || []).forEach((cs: any) => {
        if (!subjectsMap[cs.class_id]) subjectsMap[cs.class_id] = [];
        const subj = Array.isArray(cs.subjects) ? cs.subjects[0] : cs.subjects;
        if (subj) subjectsMap[cs.class_id].push({ ...subj, is_optional: cs.is_optional });
      });

      return (classesRes.data || []).map((cls: any) => ({
        ...cls,
        studentCount: countMap[cls.id] || 0,
        subjects: subjectsMap[cls.id] || [],
      }));
    },
  });

  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, code, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: gradeLevels, isLoading: loadingGradeLevels } = useQuery({
    queryKey: ['gradeLevels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grade_levels').select('id, stage, grade, created_at').order('grade');
      if (error) throw error;
      return data || [];
    },
  });

  const uniqueStages = React.useMemo(
    () => [...new Set((gradeLevels || []).map((l: any) => l.stage))],
    [gradeLevels]
  );

  // ── NEW: Class Overview query — fetches all teacher_class_subjects rows ────
  // Groups by class_id → subject_id → teacher so the overview tab can render
  // a full matrix of Class → Subjects → Assigned Teacher without extra queries.
  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ['class-overview'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_class_subjects')
        .select('*');
      if (error) throw error;

      // Build map: classId → { subjectId → { subjectName, subjectCode, teacherName } }
      const map: Record<string, { className: string; gradeLevel: string; subjects: Record<string, { subjectName: string; subjectCode: string; teacherName: string; teacherId: string }> }> = {};

      (data || []).forEach((row: any) => {
        if (!map[row.class_id]) {
          map[row.class_id] = { className: row.class_name, gradeLevel: row.grade_level, subjects: {} };
        }
        map[row.class_id].subjects[row.subject_id] = {
          subjectName: row.subject_name,
          subjectCode: row.subject_code,
          teacherName: row.teacher_name,
          teacherId:   row.teacher_id,
        };
      });

      return map;
    },
  });

  const activeClassId = selectedClass?.id ?? promotionClass?.id ?? null;
  const { data: classStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ['class-students', activeClassId],
    enabled: !!activeClassId,
    queryFn: () => fetchStudentsForClass(activeClassId!),
  });

  const promotionStudents        = classStudents;
  const loadingPromotionStudents = loadingStudents;

  const { data: assignedSubjects } = useQuery({
    queryKey: ['assigned-subjects', selectedClass?.id],
    enabled: !!selectedClass?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes_subjects')
        .select('id, is_optional, subject_id, subjects(id, name, code)')
        .eq('class_id', selectedClass.id);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id:          row.id,
        is_optional: row.is_optional,
        subjects:    Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
      }));
    },
  });

  const { data: timetables } = useQuery({
    queryKey: ['timetables', selectedClass?.id],
    enabled: !!selectedClass?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timetables')
        .select('id, title, file_url, term, academic_year, uploaded_at')
        .eq('class_id', selectedClass.id)
        .order('academic_year', { ascending: false })
        .order('term');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: async () => {
      const { data } = await supabase
        .from('academic_calendar')
        .select('id, term, academic_year, term_name, is_current')
        .eq('is_current', true)
        .maybeSingle();
      return data;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const uploadTimetableMutation = useMutation({
    mutationFn: async ({ file, classId, term, academicYear, title }: any) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${classId}/${academicYear}/term-${term}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('Timetables').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('Timetables').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('timetables').upsert(
        { class_id: classId, term, academic_year: academicYear, title, file_url: publicUrlData.publicUrl },
        { onConflict: 'class_id,term,academic_year' }
      );
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables', selectedClass?.id] });
      setIsUploading(false);
      setUploadFile(null);
      setTitleInput('');
    },
    onError: (err: any) => { setIsUploading(false); alert('Upload failed: ' + err.message); },
  });

  const deleteTimetableMutation = useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      const url       = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const idx       = pathParts.findIndex(p => p === 'Timetables');
      if (idx === -1) throw new Error('Invalid file URL');
      const { error: storageError } = await supabase.storage.from('Timetables').remove([pathParts.slice(idx + 1).join('/')]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('timetables').delete().eq('id', id);
      if (dbError) throw dbError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timetables', selectedClass?.id] }),
    onError:   (err: any) => alert('Delete failed: ' + err.message),
  });

  const createClassMutation = useMutation<any, any, any>({
    mutationFn: async data => {
      const { error } = await supabase.from('classes').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }); setShowClassModal(false); setEditingClass(null); },
  });

  const updateClassMutation = useMutation<any, any, { id: string; data: any }>({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('classes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }); setShowClassModal(false); setEditingClass(null); },
  });

  const deleteClassMutation = useMutation<any, any, string>({
    mutationFn: async id => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }),
  });

  const createSubjectMutation = useMutation<any, any, any>({
    mutationFn: async data => {
      const { error } = await supabase.from('subjects').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subjects'] }); setShowSubjectModal(false); setEditingSubject(null); },
  });

  const updateSubjectMutation = useMutation<any, any, { id: string; data: any }>({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('subjects').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subjects'] }); setShowSubjectModal(false); setEditingSubject(null); },
  });

  const deleteSubjectMutation = useMutation<any, any, string>({
    mutationFn: async id => {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const createGradeLevelMutation = useMutation<any, any, any>({
    mutationFn: async data => {
      const { error } = await supabase.from('grade_levels').insert([data]).select();
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gradeLevels'] }); setShowGradeLevelModal(false); },
    onError:   (err: any) => alert('Error creating grade level: ' + err.message),
  });

  const deleteGradeLevelMutation = useMutation<any, any, string>({
    mutationFn: async id => {
      const { error } = await supabase.from('grade_levels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gradeLevels'] }),
  });

  const assignSubjectsMutation = useMutation<any, any, { classId: string; subjects: string[]; optionalSubjects: string[] }>({
    mutationFn: async ({ classId, subjects, optionalSubjects }) => {
      const { error: del } = await supabase.from('classes_subjects').delete().eq('class_id', classId);
      if (del) throw del;
      if (subjects.length > 0) {
        const { error: ins } = await supabase.from('classes_subjects').insert(
          subjects.map(sid => ({ class_id: classId, subject_id: sid, is_optional: optionalSubjects.includes(sid) }))
        );
        if (ins) throw ins;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-subjects', selectedClass?.id] });
      setShowAssignSubjectModal(false);
      setSelectedSubjects([]);
      setOptionalSubjects([]);
    },
  });

  const removeSubjectMutation = useMutation<any, any, string>({
    mutationFn: async id => {
      const { error } = await supabase.from('classes_subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-subjects', selectedClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    },
  });

  const removeStudentMutation = useMutation<any, any, string>({
    mutationFn: async enrollmentId => {
      const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', selectedClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleClassSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: String(fd.get('name') || ''), grade_level: String(fd.get('grade_level') || '') };
    if (editingClass) updateClassMutation.mutate({ id: editingClass.id, data });
    else createClassMutation.mutate(data);
  };

  const handleSubjectSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: String(fd.get('name') || ''), code: String(fd.get('code') || '') };
    if (editingSubject) updateSubjectMutation.mutate({ id: editingSubject.id, data });
    else createSubjectMutation.mutate(data);
  };

  const handleGradeLevelSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createGradeLevelMutation.mutate({ stage: String(fd.get('stage') || ''), grade: String(fd.get('grade') || '') });
  };

  const handleClassClick = (cls: any) => { setSelectedClass(cls); setShowClassDetailModal(true); };

  const handleAssignSubjects = (cls: any) => {
    setSelectedClass(cls);
    setSelectedSubjects(cls.subjects?.map((s: any) => s.id) || []);
    setOptionalSubjects(cls.subjects?.filter((s: any) => s.is_optional).map((s: any) => s.id) || []);
    setShowAssignSubjectModal(true);
  };

  const handleSubjectSelection = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]
    );
    if (!selectedSubjects.includes(subjectId)) {
      setOptionalSubjects(prev => prev.filter(id => id !== subjectId));
    }
  };

  const handleOptionalToggle = (subjectId: string) => {
    setOptionalSubjects(prev =>
      prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]
    );
  };

  // ── Promotion handlers ─────────────────────────────────────────────────────

  const openPromotion = (cls: any) => {
    setPromotionClass(cls);
    setSelectedClass(cls);
    setDecisions({});
    setSelectedForBulk([]);
    setBulkStatus('promoted');
    setBulkToClassId('');
    setPromotionDone(false);
    setPromotionResult(null);
    setPromotionError(null);
    setShowPromotionModal(true);
  };

  React.useEffect(() => {
    if (!promotionStudents?.length || !promotionClass?.id) return;
    setDecisions(prev => {
      const next = { ...prev };
      promotionStudents.forEach((s: any) => {
        if (!next[s.id]) {
          next[s.id] = {
            studentId: s.id, enrollmentId: s.enrollmentId,
            studentName: `${s.first_name} ${s.last_name}`,
            status: 'promoted', toClassId: '', transferSchool: '',
          };
        }
      });
      return next;
    });
  }, [promotionStudents, promotionClass?.id]);

  const setStudentDecision = (studentId: string, update: Partial<PromotionDecision>) => {
    setDecisions(prev => ({ ...prev, [studentId]: { ...prev[studentId], ...update } }));
  };

  const toggleSelectAll = () => {
    if (!promotionStudents) return;
    setSelectedForBulk(
      selectedForBulk.length === promotionStudents.length ? [] : promotionStudents.map((s: any) => s.id)
    );
  };

  const toggleSelectOne = (studentId: string) => {
    setSelectedForBulk(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const applyBulkAction = () => {
    if (selectedForBulk.length === 0) return;
    setDecisions(prev => {
      const next = { ...prev };
      selectedForBulk.forEach(id => {
        next[id] = { ...next[id], status: bulkStatus, toClassId: bulkStatus === 'promoted' ? bulkToClassId : '', transferSchool: '' };
      });
      return next;
    });
    setSelectedForBulk([]);
    setBulkToClassId('');
  };

  const runPromotion = async () => {
    if (!promotionClass) return;
    const invalid = Object.values(decisions).filter(d => d.status === 'promoted' && !d.toClassId);
    if (invalid.length > 0) {
      setPromotionError(`${invalid.length} student(s) marked "Promote" have no destination class selected.`);
      return;
    }
    setRunningPromotion(true);
    setPromotionError(null);

    const year = currentTerm?.academic_year ?? String(new Date().getFullYear());
    const toDbStatus = (s: PromotionStatus): DbPromotionStatus =>
      s === 'transferred' ? 'withdrawn' : s;

    const promotionRows = Object.values(decisions).map(d => ({
      student_id:    d.studentId,
      from_class_id: promotionClass.id,
      to_class_id:   d.status === 'promoted' ? d.toClassId : null,
      academic_year: year,
      status:        toDbStatus(d.status),
      notes: d.status === 'transferred'
        ? `Transfer to: ${d.transferSchool?.trim() || 'Unknown school'}`
        : undefined,
    }));

    const { error: promoErr } = await supabase
      .from('student_promotions')
      .upsert(promotionRows, { onConflict: 'student_id,academic_year' });

    if (promoErr) { setPromotionError(promoErr.message); setRunningPromotion(false); return; }

    const promoted = Object.values(decisions).filter(d => d.status === 'promoted');
    await Promise.all(
      promoted.map(d => supabase.from('enrollments').update({ class_id: d.toClassId }).eq('student_id', d.studentId))
    );

    const toRemove = Object.values(decisions).filter(d => d.status === 'transferred' || d.status === 'graduated');
    if (toRemove.length > 0) {
      await supabase.from('enrollments').delete().in('student_id', toRemove.map(d => d.studentId));
    }

    const counts: Record<PromotionStatus, number> = { promoted: 0, retained: 0, graduated: 0, transferred: 0 };
    Object.values(decisions).forEach(d => counts[d.status]++);

    setPromotionResult(counts);
    setRunningPromotion(false);
    setPromotionDone(true);
    queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    queryClient.invalidateQueries({ queryKey: ['class-students', promotionClass.id] });
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const otherClasses       = (classes || []).filter((c: any) => c.id !== promotionClass?.id);
  const allSelected        = !!(promotionStudents && selectedForBulk.length === promotionStudents.length);
  const invalidDecisions   = Object.values(decisions).filter(d => d?.status === 'promoted' && !d.toClassId);
  const promoCounts: Record<PromotionStatus, number> = { promoted: 0, retained: 0, graduated: 0, transferred: 0 };
  Object.values(decisions).forEach(d => { if (d) promoCounts[d.status]++; });
  const isCreatingGradeLevel = createGradeLevelMutation.isPending;

  // ── Overview derived: sort classes alphabetically, apply search filter ────
  const overviewClasses = React.useMemo(() => {
    if (!classes || !overviewData) return [];
    return classes
      .filter((cls: any) =>
        !overviewFilter ||
        cls.name.toLowerCase().includes(overviewFilter.toLowerCase()) ||
        cls.grade_level.toLowerCase().includes(overviewFilter.toLowerCase())
      )
      .map((cls: any) => ({
        ...cls,
        overviewSubjects: overviewData[cls.id]
          ? Object.values(overviewData[cls.id].subjects)
          : [],
      }));
  }, [classes, overviewData, overviewFilter]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-600" />
            Classes & Subjects Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="classes">
            <TabsList className="mb-6">
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="overview">
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                Class Overview
              </TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="grade-levels">Grade Levels</TabsTrigger>
            </TabsList>

            {/* ── CLASSES TAB ── */}
            <TabsContent value="classes" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Class Management</h3>
                  <p className="text-sm text-gray-600">Create and manage classes, assign subjects and view students</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowGradeLevelModal(true)} variant="outline"><Plus className="w-4 h-4 mr-2" />Add Grade Level</Button>
                  <Button onClick={() => { setEditingClass(null); setShowClassModal(true); }} className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-2" />Add Class</Button>
                </div>
              </div>

              {currentTerm && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  Active Term: <strong className="ml-1">Term {currentTerm.term}, {currentTerm.academic_year}</strong>
                  {currentTerm.term === 3 && <span className="ml-2 text-emerald-700 font-semibold">— Student promotion available</span>}
                </div>
              )}

              {loadingClasses ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-1/2" /></CardContent></Card>)}
                </div>
              ) : classesError ? (
                <Card className="border-red-200 bg-red-50"><CardContent className="p-6 text-center text-red-600">
                  <p className="font-semibold">Error loading classes</p>
                  <p className="text-sm mt-2">{(classesError as any).message}</p>
                  <Button onClick={() => queryClient.refetchQueries({ queryKey: ['classes-with-details'] })} className="mt-4" variant="outline">Retry</Button>
                </CardContent></Card>
              ) : !classes || classes.length === 0 ? (
                <Card><CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Classes Found</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first class</p>
                  <Button onClick={() => setShowClassModal(true)} className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-2" />Create First Class</Button>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls: any) => (
                    <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500" onClick={() => handleClassClick(cls)}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{cls.grade_level}</p>
                            <div className="flex items-center gap-2 mt-3">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{cls.studentCount} students</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <BookOpen className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{cls.subjects?.length || 0} subjects</span>
                            </div>
                            {cls.subjects?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {cls.subjects.slice(0, 3).map((s: any) => (
                                  <Badge key={s.id} variant={s.is_optional ? 'outline' : 'secondary'} className={`text-xs ${s.is_optional ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}`}>
                                    {s.code}{s.is_optional && ' (Opt)'}
                                  </Badge>
                                ))}
                                {cls.subjects.length > 3 && <Badge variant="outline" className="text-xs">+{cls.subjects.length - 3} more</Badge>}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button variant="ghost" size="icon" title="Promote / Transfer Students" onClick={e => { e.stopPropagation(); openPromotion(cls); }} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" disabled={cls.studentCount === 0}>
                              <GraduationCap className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); handleAssignSubjects(cls); }} title="Assign Subjects">
                              <BookOpen className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setEditingClass(cls); setShowClassModal(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); if (window.confirm(`Delete class ${cls.name}?`)) deleteClassMutation.mutate(cls.id); }}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ══════════════ CLASS OVERVIEW TAB ══════════════ */}
            <TabsContent value="overview" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Class Overview</h3>
                  <p className="text-sm text-gray-500">Subjects and assigned teachers per class</p>
                </div>
                <Input
                  placeholder="Filter by class or grade…"
                  value={overviewFilter}
                  onChange={e => setOverviewFilter(e.target.value)}
                  className="h-9 w-full sm:w-64"
                />
              </div>

              {loadingOverview || loadingClasses ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i}>
                      <CardContent className="p-5 space-y-3">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : overviewClasses.length === 0 ? (
                <Card>
                  <CardContent className="p-10 text-center text-gray-400">
                    <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">No classes found</p>
                    <p className="text-sm mt-1">
                      {overviewFilter ? 'Try a different search term' : 'Add classes and assign subjects to see the overview'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {overviewClasses.map((cls: any) => {
                    const hasAssignments = cls.overviewSubjects.length > 0;
                    const unassignedSubjects = cls.subjects.filter(
                      (s: any) => !cls.overviewSubjects.find((os: any) => os.subjectCode === s.code)
                    );

                    return (
                      <Card key={cls.id} className="overflow-hidden border border-gray-100 shadow-sm">
                        {/* Class header */}
                        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {cls.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-base">{cls.name}</h4>
                              <p className="text-xs text-gray-500">{cls.grade_level}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />{cls.studentCount} students
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />{cls.subjects.length} subjects
                            </span>
                          </div>
                        </div>

                        <CardContent className="p-0">
                          {!hasAssignments && cls.subjects.length === 0 ? (
                            <p className="text-sm text-gray-400 italic px-5 py-4">
                              No subjects assigned to this class yet.
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50/60">
                                  <TableHead className="text-xs font-semibold text-gray-500 w-20">Code</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-500">Subject</TableHead>
                                  <TableHead className="text-xs font-semibold text-gray-500">Assigned Teacher</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Subjects that have a teacher assigned */}
                                {cls.overviewSubjects.map((sub: any) => (
                                  <TableRow key={sub.subjectCode} className="hover:bg-green-50/30">
                                    <TableCell>
                                      <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {sub.subjectCode}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-gray-800">
                                      {sub.subjectName}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0">
                                          {sub.teacherName?.charAt(0) ?? '?'}
                                        </div>
                                        <span className="text-sm text-gray-700">{sub.teacherName}</span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}

                                {/* Subjects assigned to class but no teacher yet */}
                                {unassignedSubjects.map((sub: any) => (
                                  <TableRow key={sub.id} className="hover:bg-amber-50/30">
                                    <TableCell>
                                      <span className="font-mono text-xs font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                        {sub.code}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">{sub.name}</TableCell>
                                    <TableCell>
                                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                        No teacher assigned
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── SUBJECTS TAB ── */}
            <TabsContent value="subjects" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Subject Management</h3>
                  <p className="text-sm text-gray-600">Create and manage subjects across all classes</p>
                </div>
                <Button onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />Add Subject
                </Button>
              </div>
              {loadingSubjects ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-1/2" /></CardContent></Card>)}
                </div>
              ) : !subjects || subjects.length === 0 ? (
                <Card><CardContent className="p-8 text-center">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Subjects Found</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first subject</p>
                  <Button onClick={() => setShowSubjectModal(true)} className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-2" />Create First Subject</Button>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map((subject: any) => (
                    <Card key={subject.id} className="relative"><CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{subject.name}</h4>
                          <p className="text-sm text-gray-500">Code: {subject.code}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingSubject(subject); setShowSubjectModal(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Delete subject ${subject.name}?`)) deleteSubjectMutation.mutate(subject.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── GRADE LEVELS TAB ── */}
            <TabsContent value="grade-levels" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Grade Level Management</h3>
                  <p className="text-sm text-gray-600">Manage grade levels and stages for your school</p>
                </div>
                <Button onClick={() => setShowGradeLevelModal(true)} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />Add Grade Level
                </Button>
              </div>
              {loadingGradeLevels ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-1/2" /></CardContent></Card>)}
                </div>
              ) : !gradeLevels || gradeLevels.length === 0 ? (
                <Card><CardContent className="p-8 text-center">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Grade Levels Found</h3>
                  <Button onClick={() => setShowGradeLevelModal(true)} className="bg-green-600 hover:bg-green-700 mt-4"><Plus className="w-4 h-4 mr-2" />Create First Grade Level</Button>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gradeLevels.map((level: any) => (
                    <Card key={level.id}><CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="text-center flex-1">
                          <h4 className="font-bold text-lg text-gray-900">{level.stage}</h4>
                          <p className="text-sm text-gray-500 mt-1">{level.grade}</p>
                          <div className="mt-4 text-xs text-gray-400">Created: {new Date(level.created_at).toLocaleDateString()}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Delete grade level "${level.stage}"? This will affect classes using this grade level.`)) deleteGradeLevelMutation.mutate(level.id); }}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Class Modal ── */}
      <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle></DialogHeader>
          <form onSubmit={handleClassSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Class Name</Label>
                <Input id="name" name="name" placeholder="e.g., Form 1A, Grade 2B" defaultValue={editingClass?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade_level">Grade Level</Label>
                <Select name="grade_level" defaultValue={editingClass?.grade_level} required>
                  <SelectTrigger><SelectValue placeholder="Select grade level" /></SelectTrigger>
                  <SelectContent>
                    {uniqueStages.map((stage: any) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowClassModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">{editingClass ? 'Update' : 'Create'} Class</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Grade Level Modal ── */}
      <Dialog open={showGradeLevelModal} onOpenChange={setShowGradeLevelModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Grade Level</DialogTitle></DialogHeader>
          <form onSubmit={handleGradeLevelSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stage">Stage Name</Label>
                <Input id="stage" name="stage" placeholder="e.g., Kindergarten, Lower Primary, Junior Secondary" required />
                <p className="text-sm text-gray-500">Displayed in class overview and dropdowns</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade Description</Label>
                <Input id="grade" name="grade" placeholder="e.g., PP1-PP3, Grade 1-3, Form 1-3" required />
                <p className="text-sm text-gray-500">For internal reference only</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowGradeLevelModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isCreatingGradeLevel}>
                {isCreatingGradeLevel ? 'Creating...' : 'Create Grade Level'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Subject Modal ── */}
      <Dialog open={showSubjectModal} onOpenChange={setShowSubjectModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubjectSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input name="name" placeholder="e.g., Mathematics" defaultValue={editingSubject?.name} required />
              </div>
              <div className="space-y-2">
                <Label>Subject Code</Label>
                <Input name="code" placeholder="e.g., MATH" defaultValue={editingSubject?.code} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSubjectModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">{editingSubject ? 'Update' : 'Create'} Subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign Subjects Modal ── */}
      <Dialog open={showAssignSubjectModal} onOpenChange={setShowAssignSubjectModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Assign Subjects to {selectedClass?.name}</DialogTitle>
            <p className="text-sm text-gray-600">Select subjects and mark optional ones for this class</p>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              {(subjects || []).map((subject: any) => {
                const isSelected = selectedSubjects.includes(subject.id);
                const isOptional = optionalSubjects.includes(subject.id);
                return (
                  <div key={subject.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded border">
                    <div className="flex items-center space-x-3 flex-1">
                      <Checkbox id={`s-${subject.id}`} checked={isSelected} onCheckedChange={() => handleSubjectSelection(subject.id)} />
                      <Label htmlFor={`s-${subject.id}`} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{subject.name}</span>
                          <span className="text-sm text-gray-500 ml-4">{subject.code}</span>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Checkbox id={`o-${subject.id}`} checked={isOptional} onCheckedChange={() => handleOptionalToggle(subject.id)} disabled={!isSelected} />
                      <Label htmlFor={`o-${subject.id}`} className={`text-sm ${!isSelected ? 'text-gray-400' : 'text-gray-700'}`}>Optional</Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAssignSubjectModal(false)}>Cancel</Button>
            <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => assignSubjectsMutation.mutate({ classId: selectedClass?.id, subjects: selectedSubjects, optionalSubjects })}>
              Assign Subjects
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Class Detail Modal ── */}
      <Dialog open={showClassDetailModal} onOpenChange={setShowClassDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" />Class: {selectedClass?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Class Information
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => { setShowClassDetailModal(false); openPromotion(selectedClass); }} disabled={(selectedClass?.studentCount ?? 0) === 0}>
                      <GraduationCap className="w-4 h-4 mr-2" />Promote / Transfer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAssignSubjects(selectedClass)}>
                      <GraduationCap className="w-4 h-4 mr-2" />Manage Subjects
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-sm font-medium">Grade Level</Label><p className="text-sm text-gray-600">{selectedClass?.grade_level}</p></div>
                  <div><Label className="text-sm font-medium">Student Count</Label><p className="text-sm text-gray-600">{selectedClass?.studentCount} students</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Students in Class ({classStudents?.length || 0})</CardTitle></CardHeader>
              <CardContent>
                {loadingStudents ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
                ) : classStudents && classStudents.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Registration No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map((student: any) => (
                          <TableRow key={student.enrollmentId}>
                            <TableCell className="font-mono font-medium">{student.reg_no}</TableCell>
                            <TableCell><div className="font-medium">{student.first_name} {student.last_name}</div></TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{student.gender}</Badge></TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Remove ${student.first_name} ${student.last_name} from this class?`)) removeStudentMutation.mutate(student.enrollmentId); }} title="Remove from class">
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8"><Users className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No students enrolled in this class</p></div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Assigned Subjects</CardTitle></CardHeader>
              <CardContent>
                {assignedSubjects && assignedSubjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedSubjects.map((assignment: any) => (
                      <Card key={assignment.id} className="relative"><CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900">{assignment.subjects?.name}</h4>
                            <p className="text-sm text-gray-500">Code: {assignment.subjects?.code}</p>
                            {assignment.is_optional && <Badge className="bg-blue-100 text-blue-700 text-xs mt-1">Optional</Badge>}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Remove ${assignment.subjects?.name} from this class?`)) removeSubjectMutation.mutate(assignment.id); }}>
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </CardContent></Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No subjects assigned to this class</p>
                    <Button variant="outline" className="mt-4" onClick={() => handleAssignSubjects(selectedClass)}><Plus className="w-4 h-4 mr-2" />Assign Subjects</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5" />Timetables</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-4 p-4 border rounded bg-gray-50">
                  <h4 className="font-medium mb-2">Upload New Timetable</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Term</Label>
                      <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                        <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Term 1">Term 1</SelectItem>
                          <SelectItem value="Term 2">Term 2</SelectItem>
                          <SelectItem value="Term 3">Term 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Academic Year</Label>
                      <Input type="text" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)} placeholder="e.g., 2025" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Title (optional)</Label>
                      <Input value={titleInput} onChange={e => setTitleInput(e.target.value)} placeholder="e.g., Form 1A Term 1 Timetable" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>File (PDF or Image)</Label>
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                  <Button
                    className="mt-4"
                    disabled={!selectedTerm || !selectedAcademicYear || !uploadFile || isUploading}
                    onClick={() => {
                      if (!uploadFile) return;
                      setIsUploading(true);
                      uploadTimetableMutation.mutate({
                        file: uploadFile, classId: selectedClass.id,
                        term: selectedTerm, academicYear: selectedAcademicYear,
                        title: titleInput || `${selectedClass?.name} ${selectedTerm} ${selectedAcademicYear} Timetable`,
                      });
                    }}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Timetable'}
                  </Button>
                </div>
                {timetables && timetables.length > 0 ? (
                  <div className="space-y-2">
                    {timetables.map((tt: any) => (
                      <div key={tt.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{tt.title}</p>
                          <p className="text-sm text-gray-500">{tt.term} · {tt.academic_year} · Uploaded {new Date(tt.uploaded_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild><a href={tt.file_url} target="_blank" rel="noopener noreferrer">View</a></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Delete this timetable?')) deleteTimetableMutation.mutate({ id: tt.id, fileUrl: tt.file_url }); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500 text-center py-4">No timetables uploaded yet.</p>}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Promotion Modal ── */}
      <Dialog
        open={showPromotionModal}
        onOpenChange={() => { setShowPromotionModal(false); setPromotionDone(false); setPromotionResult(null); setPromotionError(null); setSelectedForBulk([]); }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
              Promote / Transfer Students — {promotionClass?.name}
            </DialogTitle>
            <DialogDescription>
              {currentTerm ? `Term ${currentTerm.term}, ${currentTerm.academic_year}` : 'No active term — current calendar year will be recorded'}
            </DialogDescription>
          </DialogHeader>

          {promotionDone && promotionResult ? (
            <div className="flex flex-col items-center py-10 gap-5">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">🎉</div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Promotion Complete!</h3>
                <p className="text-sm text-gray-500 mt-1">All decisions saved and enrollments updated.</p>
              </div>
              <div className="grid grid-cols-4 gap-4 w-full max-w-sm">
                {([
                  { key: 'promoted',    label: 'Promoted',    color: 'text-blue-600' },
                  { key: 'retained',    label: 'Retained',    color: 'text-amber-600' },
                  { key: 'graduated',   label: 'Graduated',   color: 'text-emerald-600' },
                  { key: 'transferred', label: 'Transferred', color: 'text-red-600' },
                ] as { key: PromotionStatus; label: string; color: string }[]).map(({ key, label, color }) => (
                  <div key={key} className="text-center bg-gray-50 rounded-xl p-3 border">
                    <p className={`text-2xl font-bold ${color}`}>{promotionResult[key]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowPromotionModal(false); setPromotionDone(false); setPromotionResult(null); }}>Close</Button>
                <Button onClick={() => { setPromotionDone(false); setPromotionResult(null); }}>Run Again / Correct</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 leading-relaxed">
                <strong>⬆ Promote</strong> — move to another class &nbsp;·&nbsp;
                <strong>↺ Retain</strong> — stays in same class &nbsp;·&nbsp;
                <strong>🎓 Graduate</strong> — leaves school, removed from rolls &nbsp;·&nbsp;
                <strong>🚌 Transfer</strong> — moving to another school
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg flex-wrap">
                <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium">
                  {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  {allSelected ? 'Deselect All' : `Select All (${promotionStudents?.length ?? 0})`}
                </button>
                {selectedForBulk.length > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-500 font-medium">{selectedForBulk.length} selected</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-600 font-medium">Apply to selected:</span>
                    <Select value={bulkStatus} onValueChange={v => setBulkStatus(v as PromotionStatus)}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="promoted">⬆ Promote</SelectItem>
                        <SelectItem value="retained">↺ Retain</SelectItem>
                        <SelectItem value="graduated">🎓 Graduate</SelectItem>
                        <SelectItem value="transferred">🚌 Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                    {bulkStatus === 'promoted' && (
                      <Select value={bulkToClassId} onValueChange={setBulkToClassId}>
                        <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Select destination class" /></SelectTrigger>
                        <SelectContent>
                          {otherClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={applyBulkAction} disabled={bulkStatus === 'promoted' && !bulkToClassId}>
                      Apply to {selectedForBulk.length} student{selectedForBulk.length !== 1 ? 's' : ''}
                    </Button>
                  </>
                )}
                <div className="ml-auto flex gap-3 text-xs font-medium">
                  <span className="text-blue-600">{promoCounts.promoted} promote</span>
                  <span className="text-amber-600">{promoCounts.retained} retain</span>
                  <span className="text-red-600">{promoCounts.transferred} transfer</span>
                  <span className="text-emerald-600">{promoCounts.graduated} graduate</span>
                </div>
              </div>

              {loadingPromotionStudents ? (
                <div className="space-y-2 py-4">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : !promotionStudents || promotionStudents.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No students enrolled in this class.</div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[380px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Student</TableHead>
                          <TableHead>Reg No</TableHead>
                          <TableHead className="w-48">Decision</TableHead>
                          <TableHead>Destination / Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promotionStudents.map((student: any) => {
                          const d: PromotionDecision = decisions[student.id] ?? {
                            studentId: student.id, enrollmentId: student.enrollmentId,
                            studentName: `${student.first_name} ${student.last_name}`,
                            status: 'promoted', toClassId: '', transferSchool: '',
                          };
                          const isSelected = selectedForBulk.includes(student.id);
                          return (
                            <TableRow key={student.id} className={isSelected ? 'bg-blue-50' : ''}>
                              <TableCell>
                                <button onClick={() => toggleSelectOne(student.id)}>
                                  {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-gray-300 hover:text-gray-500" />}
                                </button>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                                    {student.first_name?.[0]}{student.last_name?.[0]}
                                  </div>
                                  <span className="font-medium text-sm">{student.first_name} {student.last_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-gray-500">{student.reg_no}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {([
                                    { s: 'promoted', emoji: '⬆', title: 'Promote' },
                                    { s: 'retained', emoji: '↺', title: 'Retain' },
                                    { s: 'graduated', emoji: '🎓', title: 'Graduate' },
                                    { s: 'transferred', emoji: '🚌', title: 'Transfer' },
                                  ] as { s: PromotionStatus; emoji: string; title: string }[]).map(({ s, emoji, title }) => (
                                    <button
                                      key={s} title={title}
                                      onClick={() => setStudentDecision(student.id, { status: s, toClassId: '', transferSchool: '' })}
                                      className={`text-xs px-2 py-1 rounded-full border transition-all font-medium ${d.status === s ? 'border-primary bg-primary text-white shadow-sm' : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary bg-white'}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                {d.status === 'promoted' && (
                                  <select
                                    className={`text-xs border rounded px-2 py-1 w-full bg-white ${!d.toClassId ? 'border-red-300' : 'border-input'}`}
                                    value={d.toClassId ?? ''}
                                    onChange={e => setStudentDecision(student.id, { toClassId: e.target.value })}
                                  >
                                    <option value="">— Select class —</option>
                                    {otherClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.grade_level})</option>)}
                                  </select>
                                )}
                                {d.status === 'transferred' && (
                                  <Input className="text-xs h-8" placeholder="School name (optional)" value={d.transferSchool ?? ''} onChange={e => setStudentDecision(student.id, { transferSchool: e.target.value })} />
                                )}
                                {d.status === 'retained' && <span className="text-xs text-amber-600">Stays in {promotionClass?.name}</span>}
                                {d.status === 'graduated' && <span className="text-xs text-emerald-600">Removed from rolls</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {promotionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{promotionError}
                </div>
              )}
              {invalidDecisions.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  ⚠ {invalidDecisions.length} student(s) marked "Promote" still need a destination class.
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setShowPromotionModal(false)} disabled={runningPromotion}>Cancel</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={runPromotion}
                  disabled={runningPromotion || loadingPromotionStudents || !promotionStudents?.length || invalidDecisions.length > 0}
                >
                  {runningPromotion ? 'Processing…' : `Confirm & Apply (${promotionStudents?.length ?? 0} students)`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}