// src/Components/Admin/ClassesSection/index.tsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import {
  Plus, Pencil, Trash2, BookOpen, Users, GraduationCap,
  X, LayoutGrid, Search,
} from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Badge } from '@/Components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Skeleton } from '@/Components/ui/skeleton';

import {
  SectionHeader, SectionErrorBoundary, fetchStudentsForClass,
  CARD_SHADOW, CARD_SHADOW_HOVER, GRADIENT_BTN_STYLE, MAROON_GRADIENT,
  type ClassRecord, type SubjectRecord, type GradeLevel, type StudentInClass,
  type OverviewClassEntry, type OverviewSubject, type AssignedSubjectRow,
  type AcademicTerm, type TeacherClassSubjectRow, type SubjectInfo, type RawSubjectJoin,
} from './shared.tsx';
import {
  ClassModal, GradeLevelModal, SubjectModal, AssignSubjectsModal,
  ClassDetailModal, PromotionModal,
} from './modals.tsx';

export default function ClassesSection() {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassDetailModal, setShowClassDetailModal] = useState(false);
  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
  const [showGradeLevelModal, setShowGradeLevelModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [optionalSubjects, setOptionalSubjects] = useState<string[]>([]);
  const [overviewFilter, setOverviewFilter] = useState('');

  // Promotion: parent only tracks which class is being promoted + modal visibility
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionClass, setPromotionClass] = useState<ClassRecord | null>(null);

  const queryClient = useQueryClient();

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: classes, isLoading: loadingClasses, error: classesError } = useQuery<ClassRecord[]>({
    queryKey: ['classes-with-details'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [classesRes, csRes, enrollRes] = await Promise.all([
        supabase.from('classes').select('id, name, grade_level, created_at').order('grade_level').order('name'),
        supabase.from('classes_subjects').select('id, class_id, subject_id, is_optional, subjects(id, name, code)'),
        supabase.from('enrollments').select('class_id'),
      ]);
      if (classesRes.error) throw classesRes.error;
      if (csRes.error) throw csRes.error;
      if (enrollRes.error) throw enrollRes.error;

      const countMap: Record<string, number> = {};
      (enrollRes.data ?? []).forEach((e: { class_id: string }) => {
        countMap[e.class_id] = (countMap[e.class_id] || 0) + 1;
      });

      const subjectsMap: Record<string, SubjectInfo[]> = {};
      (csRes.data ?? []).forEach((cs: {
        class_id: string; subject_id: string; is_optional: boolean;
        subjects: RawSubjectJoin | RawSubjectJoin[] | null;
      }) => {
        if (!subjectsMap[cs.class_id]) subjectsMap[cs.class_id] = [];
        const subj = Array.isArray(cs.subjects) ? cs.subjects[0] : cs.subjects;
        if (subj) subjectsMap[cs.class_id].push({ ...subj, is_optional: cs.is_optional });
      });

      return (classesRes.data ?? []).map((cls: {
        id: string; name: string; grade_level: string; created_at: string;
      }) => ({
        ...cls,
        studentCount: countMap[cls.id] ?? 0,
        subjects: subjectsMap[cls.id] ?? [],
      }));
    },
  });

  const { data: subjects, isLoading: loadingSubjects } = useQuery<SubjectRecord[]>({
    queryKey: ['subjects'], staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, code, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: gradeLevels, isLoading: loadingGradeLevels } = useQuery<GradeLevel[]>({
    queryKey: ['gradeLevels'], staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('grade_levels').select('id, stage, grade, created_at').order('grade');
      if (error) throw error;
      return data ?? [];
    },
  });

  const uniqueStages = useMemo(
    () => [...new Set((gradeLevels ?? []).map((l) => l.stage))],
    [gradeLevels]
  );

  const { data: overviewData, isLoading: loadingOverview } = useQuery<Record<string, OverviewClassEntry>>({
    queryKey: ['class-overview'], staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_class_subjects')
        .select('teacher_id, teacher_name, class_id, class_name, grade_level, subject_id, subject_name, subject_code');
      if (error) throw error;
      const map: Record<string, OverviewClassEntry> = {};
      (data ?? []).forEach((row: TeacherClassSubjectRow) => {
        if (!row.class_id) return;
        if (!map[row.class_id]) {
          map[row.class_id] = { className: row.class_name ?? '', gradeLevel: row.grade_level ?? '', subjects: {} };
        }
        if (row.subject_id) {
          map[row.class_id].subjects[row.subject_id] = {
            subjectName: row.subject_name ?? '', subjectCode: row.subject_code ?? '',
            teacherName: row.teacher_name ?? '', teacherId: row.teacher_id ?? '',
          };
        }
      });
      return map;
    },
  });

  const { data: classStudents, isLoading: loadingStudents } = useQuery<StudentInClass[]>({
    queryKey: ['class-students', selectedClass?.id],
    enabled: !!selectedClass?.id && showClassDetailModal,
    staleTime: 1 * 60 * 1000,
    queryFn: () => fetchStudentsForClass(selectedClass!.id),
  });

  const { data: promotionStudents, isLoading: loadingPromotionStudents } = useQuery<StudentInClass[]>({
    queryKey: ['promotion-students', promotionClass?.id],
    enabled: !!promotionClass?.id && showPromotionModal,
    staleTime: 1 * 60 * 1000,
    queryFn: () => fetchStudentsForClass(promotionClass!.id),
  });

  const { data: assignedSubjects } = useQuery<AssignedSubjectRow[]>({
    queryKey: ['assigned-subjects', selectedClass?.id],
    enabled: !!selectedClass?.id, staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes_subjects').select('id, is_optional, subject_id, subjects(id, name, code)')
        .eq('class_id', selectedClass!.id);
      if (error) throw error;
      return (data ?? []).map((row: {
        id: string; is_optional: boolean;
        subjects: AssignedSubjectRow['subjects'] | AssignedSubjectRow['subjects'][];
      }) => ({
        id: row.id, is_optional: row.is_optional,
        subjects: Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
      }));
    },
  });

  const { data: currentTerm } = useQuery<AcademicTerm | null>({
    queryKey: ['current-term'], staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('academic_calendar')
        .select('id, term, academic_year, term_name, is_current')
        .eq('is_current', true).maybeSingle();
      return data ?? null;
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createClassMutation = useMutation<void, Error, { name: string; grade_level: string }>({
    mutationFn: async (data) => { const { error } = await supabase.from('classes').insert([data]); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }); setShowClassModal(false); setEditingClass(null); },
  });

  const updateClassMutation = useMutation<void, Error, { id: string; data: { name: string; grade_level: string } }>({
    mutationFn: async ({ id, data }) => { const { error } = await supabase.from('classes').update(data).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }); setShowClassModal(false); setEditingClass(null); },
  });

  const deleteClassMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => { const { error } = await supabase.from('classes').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }),
  });

  const createSubjectMutation = useMutation<void, Error, { name: string; code: string }>({
    mutationFn: async (data) => { const { error } = await supabase.from('subjects').insert([data]); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subjects'] }); setShowSubjectModal(false); setEditingSubject(null); },
  });

  const updateSubjectMutation = useMutation<void, Error, { id: string; data: { name: string; code: string } }>({
    mutationFn: async ({ id, data }) => { const { error } = await supabase.from('subjects').update(data).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subjects'] }); setShowSubjectModal(false); setEditingSubject(null); },
  });

  const deleteSubjectMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => { const { error } = await supabase.from('subjects').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const createGradeLevelMutation = useMutation<void, Error, { stage: string; grade: string }>({
    mutationFn: async (data) => { const { error } = await supabase.from('grade_levels').insert([data]).select(); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gradeLevels'] }); setShowGradeLevelModal(false); },
    onError: (err) => alert('Error creating grade level: ' + err.message),
  });

  const deleteGradeLevelMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => { const { error } = await supabase.from('grade_levels').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gradeLevels'] }),
  });

  const assignSubjectsMutation = useMutation<
    void, Error, { classId: string; subjects: string[]; optionalSubjects: string[] }
  >({
    mutationFn: async ({ classId, subjects: subjectIds, optionalSubjects: optIds }) => {
      const { error: del } = await supabase.from('classes_subjects').delete().eq('class_id', classId);
      if (del) throw del;
      if (subjectIds.length > 0) {
        const { error: ins } = await supabase.from('classes_subjects').insert(
          subjectIds.map((sid) => ({ class_id: classId, subject_id: sid, is_optional: optIds.includes(sid) }))
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

  const removeSubjectMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => { const { error } = await supabase.from('classes_subjects').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-subjects', selectedClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    },
  });

  const removeStudentMutation = useMutation<void, Error, string>({
    mutationFn: async (enrollmentId) => { const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', selectedClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClassSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: String(fd.get('name') ?? ''), grade_level: String(fd.get('grade_level') ?? '') };
    if (editingClass) updateClassMutation.mutate({ id: editingClass.id, data });
    else createClassMutation.mutate(data);
  };

  const handleSubjectSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: String(fd.get('name') ?? ''), code: String(fd.get('code') ?? '') };
    if (editingSubject) updateSubjectMutation.mutate({ id: editingSubject.id, data });
    else createSubjectMutation.mutate(data);
  };

  const handleGradeLevelSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createGradeLevelMutation.mutate({
      stage: String(fd.get('stage') ?? ''),
      grade: String(fd.get('grade') ?? ''),
    });
  };

  const handleClassClick = (cls: ClassRecord) => { setSelectedClass(cls); setShowClassDetailModal(true); };

  const handleAssignSubjects = (cls: ClassRecord) => {
    setSelectedClass(cls);
    setSelectedSubjects(cls.subjects?.map((s) => s.id) ?? []);
    setOptionalSubjects(cls.subjects?.filter((s) => s.is_optional).map((s) => s.id) ?? []);
    setShowAssignSubjectModal(true);
  };

  const handleSubjectSelection = (subjectId: string) => {
    const nowSelected = !selectedSubjects.includes(subjectId);
    setSelectedSubjects((prev) => nowSelected ? [...prev, subjectId] : prev.filter((id) => id !== subjectId));
    if (!nowSelected) setOptionalSubjects((prev) => prev.filter((id) => id !== subjectId));
  };

  const handleOptionalToggle = (subjectId: string) => {
    setOptionalSubjects((prev) => prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]);
  };

  const openPromotion = (cls: ClassRecord) => {
    setPromotionClass(cls);
    setShowPromotionModal(true);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const otherClasses = (classes ?? []).filter((c) => c.id !== promotionClass?.id);

  const overviewClasses = useMemo(() => {
    if (!classes?.length) return [];
    return classes
      .filter((cls) => {
        if (!overviewFilter) return true;
        const q = overviewFilter.toLowerCase();
        return (cls.name ?? '').toLowerCase().includes(q) || (cls.grade_level ?? '').toLowerCase().includes(q);
      })
      .map((cls) => {
        const overviewEntry = overviewData?.[cls.id];
        const overviewSubjects: OverviewSubject[] = overviewEntry ? Object.values(overviewEntry.subjects) : [];
        const unassignedSubjects = (cls.subjects ?? []).filter(
          (s) => s?.code && !overviewSubjects.find((os) => os.subjectCode === s.code)
        );
        return { ...cls, overviewSubjects, unassignedSubjects };
      });
  }, [classes, overviewData, overviewFilter]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={BookOpen}
          microLabel="Curriculum"
          title="Classes & Subjects Management"
          description="Create classes, assign subjects and manage grade levels"
        />

        <CardContent className="p-3 sm:p-5">
          <Tabs defaultValue="classes">
            <TabsList className="mb-5 w-full sm:w-auto rounded-xl bg-[#7a1f2b]/5 p-1 h-auto">
              <TabsTrigger value="classes"
                className="flex-1 sm:flex-none rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#7a1f2b] data-[state=active]:shadow-sm text-xs sm:text-sm py-2">
                Classes
              </TabsTrigger>
              <TabsTrigger value="overview"
                className="flex-1 sm:flex-none rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#7a1f2b] data-[state=active]:shadow-sm text-xs sm:text-sm py-2">
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Overview
              </TabsTrigger>
              <TabsTrigger value="subjects"
                className="flex-1 sm:flex-none rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#7a1f2b] data-[state=active]:shadow-sm text-xs sm:text-sm py-2">
                Subjects
              </TabsTrigger>
              <TabsTrigger value="grade-levels"
                className="flex-1 sm:flex-none rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#7a1f2b] data-[state=active]:shadow-sm text-xs sm:text-sm py-2">
                Grade Levels
              </TabsTrigger>
            </TabsList>

            {/* ══════════ CLASSES TAB ══════════ */}
            <TabsContent value="classes" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[#3a1b1f]">Class Management</h3>
                  <p className="text-sm text-muted-foreground">Create and manage classes, assign subjects and view students</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setShowGradeLevelModal(true)} variant="outline"
                    className="h-10 rounded-xl border-[#7a1f2b]/25 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]">
                    <Plus className="w-4 h-4 mr-1.5" />Add Grade Level
                  </Button>
                  <Button onClick={() => { setEditingClass(null); setShowClassModal(true); }}
                    className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
                    <Plus className="w-4 h-4 mr-1.5" />Add Class
                  </Button>
                </div>
              </div>

              {currentTerm && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-[#7a1f2b]/15 text-sm text-[#7a1f2b]"
                  style={{ background: 'rgba(122,31,43,0.04)' }}>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  Active Term: <strong className="ml-1">Term {currentTerm.term}, {currentTerm.academic_year}</strong>
                  {currentTerm.term === 3 && (
                    <span className="ml-2 text-emerald-700 font-semibold">— Student promotion available</span>
                  )}
                </div>
              )}

              {loadingClasses ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-40 rounded-2xl" style={{ background: 'rgba(122,31,43,0.06)' }} />
                  ))}
                </div>
              ) : classesError ? (
                <Card className="rounded-2xl border border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center text-red-600">
                    <p className="font-semibold">Error loading classes</p>
                    <p className="text-sm mt-2">{(classesError as Error).message}</p>
                    <Button onClick={() => queryClient.refetchQueries({ queryKey: ['classes-with-details'] })}
                      className="mt-4 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5" variant="outline">
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : !classes || classes.length === 0 ? (
                <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-[#7a1f2b]/15" />
                    <h3 className="text-lg font-semibold text-[#3a1b1f] mb-2">No Classes Found</h3>
                    <p className="text-muted-foreground mb-4">Get started by creating your first class</p>
                    <Button onClick={() => setShowClassModal(true)}
                      className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
                      <Plus className="w-4 h-4 mr-1.5" />Create First Class
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls) => (
                    <Card key={cls.id}
                      className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden hover:-translate-y-0.5 cursor-pointer transition-all active:scale-[0.99]"
                      style={{ boxShadow: CARD_SHADOW }}
                      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)}
                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
                      onClick={() => handleClassClick(cls)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                                style={GRADIENT_BTN_STYLE}>
                                {cls.name?.charAt(0) ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-bold text-[#3a1b1f] truncate">{cls.name}</h3>
                                <p className="text-[11px] text-muted-foreground">{cls.grade_level}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />{cls.studentCount} students
                              </span>
                              <span className="flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5" />{cls.subjects?.length ?? 0} subjects
                              </span>
                            </div>
                            {(cls.subjects?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {cls.subjects.slice(0, 3).map((s) => (
                                  <Badge key={s.id}
                                    variant={s.is_optional ? 'outline' : 'secondary'}
                                    className={`text-[10px] ${s.is_optional
                                      ? 'border-[#7a1f2b]/25 text-[#7a1f2b] bg-[#7a1f2b]/5'
                                      : 'bg-[#7a1f2b]/10 text-[#7a1f2b] border-[#7a1f2b]/20'}`}>
                                    {s.code}{s.is_optional && ' · Opt'}
                                  </Badge>
                                ))}
                                {cls.subjects.length > 3 && (
                                  <Badge variant="outline" className="text-[10px] border-[#7a1f2b]/15 text-[#7a1f2b]/60">
                                    +{cls.subjects.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" title="Promote / Transfer"
                              onClick={(e) => { e.stopPropagation(); openPromotion(cls); }}
                              className="h-8 w-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 active:scale-90"
                              disabled={cls.studentCount === 0}>
                              <GraduationCap className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Assign Subjects"
                              onClick={(e) => { e.stopPropagation(); handleAssignSubjects(cls); }}
                              className="h-8 w-8 rounded-lg hover:bg-[#7a1f2b]/5 active:scale-90">
                              <BookOpen className="w-4 h-4 text-[#7a1f2b]/70" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Edit"
                              onClick={(e) => { e.stopPropagation(); setEditingClass(cls); setShowClassModal(true); }}
                              className="h-8 w-8 rounded-lg hover:bg-[#7a1f2b]/5 active:scale-90">
                              <Pencil className="w-4 h-4 text-[#7a1f2b]/70" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete class ${cls.name}?`)) deleteClassMutation.mutate(cls.id);
                              }}
                              className="h-8 w-8 rounded-lg hover:bg-red-50 active:scale-90">
                              <Trash2 className="w-4 h-4 text-red-500/80" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ══════════ OVERVIEW TAB ══════════ */}
            <TabsContent value="overview" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#3a1b1f]">Class Overview</h3>
                  <p className="text-sm text-muted-foreground">Subjects and assigned teachers per class</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a1f2b]/40 w-4 h-4" />
                  <Input placeholder="Filter by class or grade…" value={overviewFilter}
                    onChange={(e) => setOverviewFilter(e.target.value)}
                    className="pl-9 h-9 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                </div>
              </div>

              <SectionErrorBoundary fallback="Error rendering class overview — try refreshing">
                {loadingOverview || loadingClasses ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="rounded-2xl border border-[#7a1f2b]/10 bg-white">
                        <CardContent className="p-5 space-y-3">
                          <Skeleton className="h-5 w-32" style={{ background: 'rgba(122,31,43,0.06)' }} />
                          <Skeleton className="h-4 w-full" style={{ background: 'rgba(122,31,43,0.06)' }} />
                          <Skeleton className="h-4 w-3/4" style={{ background: 'rgba(122,31,43,0.06)' }} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : overviewClasses.length === 0 ? (
                  <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white">
                    <CardContent className="p-10 text-center">
                      <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-[#7a1f2b]/15" />
                      <p className="font-medium text-muted-foreground">No classes found</p>
                      <p className="text-sm mt-1 text-muted-foreground/70">
                        {overviewFilter ? 'Try a different search term' : 'Add classes and assign subjects to see the overview'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {overviewClasses.map((cls) => {
                      const hasAssignments = cls.overviewSubjects.length > 0;
                      return (
                        <Card key={cls.id} className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden"
                          style={{ boxShadow: CARD_SHADOW }}>
                          <div className="relative overflow-hidden px-4 py-3 flex items-center justify-between gap-3"
                            style={{ background: MAROON_GRADIENT }}>
                            <div className="relative flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {cls.name?.charAt(0) ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-white text-base truncate">{cls.name}</h4>
                                <p className="text-[11px] text-white/70">{cls.grade_level}</p>
                              </div>
                            </div>
                            <div className="relative flex items-center gap-3 text-[11px] text-white/80 shrink-0">
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />{cls.studentCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />{cls.subjects.length}
                              </span>
                            </div>
                          </div>

                          <CardContent className="p-0">
                            {!hasAssignments && cls.subjects.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic px-5 py-4">
                                No subjects assigned to this class yet.
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                                    <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold w-20">Code</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Subject</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Assigned Teacher</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cls.overviewSubjects.map((sub) => (
                                    <TableRow key={sub.subjectCode} className="border-b border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.03] transition-colors">
                                      <TableCell>
                                        <span className="font-mono text-[11px] font-semibold text-[#7a1f2b] bg-[#7a1f2b]/10 px-1.5 py-0.5 rounded">
                                          {sub.subjectCode}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-sm font-medium text-[#3a1b1f]">{sub.subjectName}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                            style={GRADIENT_BTN_STYLE}>
                                            {sub.teacherName?.charAt(0) ?? '?'}
                                          </div>
                                          <span className="text-sm text-[#3a1b1f]/80">{sub.teacherName}</span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {cls.unassignedSubjects.map((sub) => (
                                    <TableRow key={sub.id} className="border-b border-[#7a1f2b]/5 hover:bg-amber-50/40 transition-colors">
                                      <TableCell>
                                        <span className="font-mono text-[11px] font-semibold text-muted-foreground bg-[#fdfbfb] px-1.5 py-0.5 rounded">
                                          {sub.code}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{sub.name}</TableCell>
                                      <TableCell>
                                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
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
              </SectionErrorBoundary>
            </TabsContent>

            {/* ══════════ SUBJECTS TAB ══════════ */}
            <TabsContent value="subjects" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#3a1b1f]">Subject Management</h3>
                  <p className="text-sm text-muted-foreground">Create and manage subjects across all classes</p>
                </div>
                <Button onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}
                  className="h-10 rounded-xl text-white border-0 active:scale-[0.98] self-start sm:self-auto"
                  style={GRADIENT_BTN_STYLE}>
                  <Plus className="w-4 h-4 mr-1.5" />Add Subject
                </Button>
              </div>

              {loadingSubjects ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" style={{ background: 'rgba(122,31,43,0.06)' }} />
                  ))}
                </div>
              ) : !subjects || subjects.length === 0 ? (
                <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
                  <CardContent className="p-8 text-center">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 text-[#7a1f2b]/15" />
                    <h3 className="text-lg font-semibold text-[#3a1b1f] mb-2">No Subjects Found</h3>
                    <p className="text-muted-foreground mb-4">Get started by creating your first subject</p>
                    <Button onClick={() => setShowSubjectModal(true)}
                      className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
                      <Plus className="w-4 h-4 mr-1.5" />Create First Subject
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjects.map((subject) => (
                    <Card key={subject.id} className="rounded-2xl border border-[#7a1f2b]/10 bg-white hover:-translate-y-0.5 transition-all"
                      style={{ boxShadow: CARD_SHADOW }}>
                      <CardContent className="p-4 flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-[#3a1b1f] truncate">{subject.name}</h4>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Code: {subject.code}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#7a1f2b]/5 active:scale-95"
                            onClick={() => { setEditingSubject(subject); setShowSubjectModal(true); }}>
                            <Pencil className="w-3.5 h-3.5 text-[#7a1f2b]/70" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 active:scale-95"
                            onClick={() => {
                              if (window.confirm(`Delete subject ${subject.name}?`)) deleteSubjectMutation.mutate(subject.id);
                            }}>
                            <Trash2 className="w-3.5 h-3.5 text-red-500/80" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ══════════ GRADE LEVELS TAB ══════════ */}
            <TabsContent value="grade-levels" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#3a1b1f]">Grade Level Management</h3>
                  <p className="text-sm text-muted-foreground">Manage grade levels and stages for your school</p>
                </div>
                <Button onClick={() => setShowGradeLevelModal(true)}
                  className="h-10 rounded-xl text-white border-0 active:scale-[0.98] self-start sm:self-auto"
                  style={GRADIENT_BTN_STYLE}>
                  <Plus className="w-4 h-4 mr-1.5" />Add Grade Level
                </Button>
              </div>

              {loadingGradeLevels ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" style={{ background: 'rgba(122,31,43,0.06)' }} />
                  ))}
                </div>
              ) : !gradeLevels || gradeLevels.length === 0 ? (
                <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
                  <CardContent className="p-8 text-center">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 text-[#7a1f2b]/15" />
                    <h3 className="text-lg font-semibold text-[#3a1b1f] mb-2">No Grade Levels Found</h3>
                    <Button onClick={() => setShowGradeLevelModal(true)}
                      className="mt-4 h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
                      <Plus className="w-4 h-4 mr-1.5" />Create First Grade Level
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gradeLevels.map((level) => (
                    <Card key={level.id} className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden"
                      style={{ boxShadow: CARD_SHADOW }}>
                      <CardContent className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(122,31,43,0.08)' }}>
                              <GraduationCap className="w-4 h-4 text-[#7a1f2b]" />
                            </div>
                            <h4 className="font-bold text-base text-[#3a1b1f] truncate">{level.stage}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{level.grade}</p>
                          <div className="text-[11px] text-muted-foreground/70 mt-2">
                            Created: {new Date(level.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 active:scale-95 shrink-0"
                          onClick={() => {
                            if (window.confirm(`Delete grade level "${level.stage}"? This will affect classes using this grade level.`)) {
                              deleteGradeLevelMutation.mutate(level.id);
                            }
                          }}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500/80" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ══════════ MODALS ══════════ */}
      <ClassModal
        open={showClassModal}
        onClose={() => { setShowClassModal(false); setEditingClass(null); }}
        editingClass={editingClass}
        uniqueStages={uniqueStages}
        onSubmit={handleClassSubmit}
      />

      <GradeLevelModal
        open={showGradeLevelModal}
        onClose={() => setShowGradeLevelModal(false)}
        onSubmit={handleGradeLevelSubmit}
        isCreating={createGradeLevelMutation.isPending}
      />

      <SubjectModal
        open={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); setEditingSubject(null); }}
        editingSubject={editingSubject}
        onSubmit={handleSubjectSubmit}
      />

      <AssignSubjectsModal
        open={showAssignSubjectModal}
        onClose={() => { setShowAssignSubjectModal(false); setSelectedSubjects([]); setOptionalSubjects([]); }}
        selectedClass={selectedClass}
        subjects={subjects ?? []}
        selectedSubjects={selectedSubjects}
        optionalSubjects={optionalSubjects}
        onSubjectSelection={handleSubjectSelection}
        onOptionalToggle={handleOptionalToggle}
        onSubmit={() => assignSubjectsMutation.mutate({
          classId: selectedClass?.id ?? '',
          subjects: selectedSubjects,
          optionalSubjects,
        })}
      />

      <ClassDetailModal
        open={showClassDetailModal}
        onClose={() => setShowClassDetailModal(false)}
        selectedClass={selectedClass}
        classStudents={classStudents}
        loadingStudents={loadingStudents}
        assignedSubjects={assignedSubjects}
        onRemoveStudent={(enrollmentId, name) => {
          if (window.confirm(`Remove ${name} from this class?`)) removeStudentMutation.mutate(enrollmentId);
        }}
        onRemoveSubject={(assignmentId, name) => {
          if (window.confirm(`Remove ${name} from this class?`)) removeSubjectMutation.mutate(assignmentId);
        }}
        onAssignSubjects={() => selectedClass && handleAssignSubjects(selectedClass)}
        onPromote={() => {
          setShowClassDetailModal(false);
          if (selectedClass) openPromotion(selectedClass);
        }}
      />

      <PromotionModal
        open={showPromotionModal}
        onClose={() => { setShowPromotionModal(false); setPromotionClass(null); }}
        promotionClass={promotionClass}
        otherClasses={otherClasses}
        currentTerm={currentTerm ?? null}
        promotionStudents={promotionStudents}
        loadingStudents={loadingPromotionStudents}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
          if (promotionClass) {
            queryClient.invalidateQueries({ queryKey: ['promotion-students', promotionClass.id] });
          }
        }}
      />
    </div>
  );
}