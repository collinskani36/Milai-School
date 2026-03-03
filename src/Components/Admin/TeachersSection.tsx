import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/Components/ui/input';
import {
  Plus, Search, Pencil, Trash2, Shield, BookOpen, Users, X,
  Phone, Mail, User, Hash, Building2, Briefcase,
  UserCog, UtensilsCrossed, ShieldCheck, Wrench, Sparkles,
  ChevronRight, GraduationCap, Star, ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Checkbox } from '@/Components/ui/checkbox';
import { Badge } from '@/Components/ui/badge';
import { Skeleton } from '@/Components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Separator } from '@/Components/ui/separator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  auth_id?: string;
  department_id?: string;
  department_role?: string;
  department?: Department;
  assignments?: Record<string, any>;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
  department: StaffDepartment;
  notes?: string;
  created_at?: string;
}

type StaffDepartment =
  | 'kitchen' | 'cleaning' | 'security' | 'maintenance'
  | 'administration' | 'transport' | 'healthcare' | 'other';

interface TeacherFormData {
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  password: string;
  department_id: string;
  department_role: string;
}

interface StaffFormData {
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
  department: StaffDepartment | '';
  notes: string;
}

interface AssignmentForm {
  class_id: string;
  subject_ids: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAFF_DEPARTMENTS: { value: StaffDepartment; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'kitchen',        label: 'Kitchen & Catering',    icon: <UtensilsCrossed className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  { value: 'cleaning',       label: 'Cleaning & Sanitation', icon: <Sparkles className="w-4 h-4" />,        color: 'bg-blue-100 text-blue-700'     },
  { value: 'security',       label: 'Security',              icon: <ShieldCheck className="w-4 h-4" />,     color: 'bg-red-100 text-red-700'       },
  { value: 'maintenance',    label: 'Maintenance',           icon: <Wrench className="w-4 h-4" />,          color: 'bg-yellow-100 text-yellow-700' },
  { value: 'administration', label: 'Administration',        icon: <Briefcase className="w-4 h-4" />,       color: 'bg-purple-100 text-purple-700' },
  { value: 'transport',      label: 'Transport',             icon: <Building2 className="w-4 h-4" />,       color: 'bg-green-100 text-green-700'   },
  { value: 'healthcare',     label: 'Healthcare',            icon: <UserCog className="w-4 h-4" />,         color: 'bg-pink-100 text-pink-700'     },
  { value: 'other',          label: 'Other',                 icon: <User className="w-4 h-4" />,            color: 'bg-gray-100 text-gray-700'     },
];

const DEPARTMENT_ROLES = [
  'Teacher',
  'Head of Department',
  'Deputy Head of Department',
  'Senior Teacher',
  'Subject Coordinator',
];

const ROLE_RANK: Record<string, number> = {
  'Head of Department':        1,
  'Deputy Head of Department': 2,
  'Senior Teacher':            3,
  'Subject Coordinator':       4,
  'Teacher':                   5,
};

const sortByRoleHierarchy = (a: Teacher, b: Teacher) => {
  const rankA = ROLE_RANK[a.department_role || 'Teacher'] ?? 99;
  const rankB = ROLE_RANK[b.department_role || 'Teacher'] ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
};

const getDeptConfig = (dept: string) =>
  STAFF_DEPARTMENTS.find(d => d.value === dept) ?? STAFF_DEPARTMENTS[STAFF_DEPARTMENTS.length - 1];

// ─── SQL Migrations (run in Supabase SQL editor) ──────────────────────────────
/**
 * -- 1. Teacher departments table
 * CREATE TABLE IF NOT EXISTS departments (
 *   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   name        text NOT NULL UNIQUE,
 *   description text,
 *   created_at  timestamptz DEFAULT now()
 * );
 * ALTER TABLE teachers ADD COLUMN IF NOT EXISTS department_id   uuid REFERENCES departments(id) ON DELETE SET NULL;
 * ALTER TABLE teachers ADD COLUMN IF NOT EXISTS department_role text DEFAULT 'Teacher';
 *
 * -- 2. Staff table
 * CREATE TABLE IF NOT EXISTS staff (
 *   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   first_name text NOT NULL,
 *   last_name  text NOT NULL,
 *   role       text NOT NULL,
 *   phone      text,
 *   department text NOT NULL DEFAULT 'other',
 *   notes      text,
 *   created_at timestamptz DEFAULT now()
 * );
 */

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeachersAndStaffSection() {
  const [activeTab, setActiveTab]         = useState<'teachers' | 'staff' | 'departments'>('teachers');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [staffSearch, setStaffSearch]     = useState('');
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  // ── Teacher state ──
  const [showTeacherModal, setShowTeacherModal]       = useState(false);
  const [editingTeacher, setEditingTeacher]           = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher]           = useState<Teacher | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher]         = useState<Teacher | null>(null);
  const [formError, setFormError]                     = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess]         = useState<string | null>(null);

  const [teacherForm, setTeacherForm] = useState<TeacherFormData>({
    teacher_code: '', first_name: '', last_name: '', email: '',
    phone: '', is_admin: false, password: '', department_id: '', department_role: 'Teacher',
  });

  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({ class_id: '', subject_ids: [] });

  // ── Staff state ──
  const [showStaffModal, setShowStaffModal]         = useState(false);
  const [editingStaff, setEditingStaff]             = useState<StaffMember | null>(null);
  const [selectedStaffDept, setSelectedStaffDept]   = useState<StaffDepartment | null>(null);
  const [staffForm, setStaffForm]                   = useState<StaffFormData>({
    first_name: '', last_name: '', role: '', phone: '', department: '', notes: '',
  });

  // ── Department state ──
  const [showDeptModal, setShowDeptModal]         = useState(false);
  const [editingDept, setEditingDept]             = useState<Department | null>(null);
  const [deptForm, setDeptForm]                   = useState({ name: '', description: '' });
  const [showAssignDeptModal, setShowAssignDeptModal] = useState(false);
  const [assignDeptTarget, setAssignDeptTarget]   = useState<Department | null>(null);
  const [assignDeptForm, setAssignDeptForm]       = useState({ teacher_id: '', department_role: 'Teacher' });

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      return data as Department[];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id, name, grade_level').order('grade_level');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, code, name').order('code');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: teachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*, departments(id, name)')
        .order('created_at', { ascending: false });
      if (teachersError) throw teachersError;

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('teacher_classes')
        .select(`id, teacher_id, class_id, subject_id,
          classes ( id, name, grade_level ), subjects ( id, code, name )`);
      if (assignmentsError) throw assignmentsError;

      const assignmentsByTeacher: Record<string, any> = {};
      assignmentsData?.forEach(a => {
        if (!assignmentsByTeacher[a.teacher_id]) assignmentsByTeacher[a.teacher_id] = {};
        if (!assignmentsByTeacher[a.teacher_id][a.class_id]) {
          assignmentsByTeacher[a.teacher_id][a.class_id] = { class: a.classes, subjects: [] };
        }
        assignmentsByTeacher[a.teacher_id][a.class_id].subjects.push({
          id: a.subject_id, assignment_id: a.id, ...a.subjects,
        });
      });

      return teachersData?.map(t => ({
        ...t,
        department: t.departments ?? null,
        assignments: assignmentsByTeacher[t.id] || {},
      })) as Teacher[] || [];
    },
  });

  const { data: staffList, isLoading: loadingStaff } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as StaffMember[];
    },
  });

  // ─── Mutations: Departments ───────────────────────────────────────────────

  const saveDeptMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      if (editingDept) {
        const { error } = await supabase.from('departments').update(data).eq('id', editingDept.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('departments').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowDeptModal(false); setEditingDept(null); setDeptForm({ name: '', description: '' });
      toast({ title: editingDept ? 'Department updated' : 'Department created' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Department deleted' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const assignTeacherToDeptMutation = useMutation({
    mutationFn: async ({ teacherId, departmentId, role }: { teacherId: string; departmentId: string; role: string }) => {
      const { error } = await supabase.from('teachers')
        .update({ department_id: departmentId, department_role: role })
        .eq('id', teacherId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowAssignDeptModal(false);
      setAssignDeptForm({ teacher_id: '', department_role: 'Teacher' });
      toast({ title: 'Teacher assigned to department' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const removeTeacherFromDeptMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.from('teachers')
        .update({ department_id: null, department_role: null })
        .eq('id', teacherId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Teacher removed from department' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ─── Mutations: Teachers ──────────────────────────────────────────────────

  const createTeacherMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      const payload = {
        email: data.email, password: data.password, teacher_code: data.teacher_code,
        first_name: data.first_name, last_name: data.last_name,
        phone: data.phone, is_admin: data.is_admin,
        department_id: data.department_id || null,
        department_role: data.department_id ? (data.department_role || 'Teacher') : null,
      };
      const res = await supabase.functions.invoke('create-teacher', { body: payload });
      if (res.error) throw new Error(`Failed to create teacher: ${res.error.message}`);
      let result = typeof res.data === 'string' ? JSON.parse(res.data)
                 : res.data instanceof ArrayBuffer ? JSON.parse(new TextDecoder().decode(res.data))
                 : res.data;
      if (!result?.ok) throw new Error(result?.error || 'Create failed');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowTeacherModal(false); setEditingTeacher(null); resetTeacherForm();
      setCreationSuccess('Teacher created successfully!');
      setTimeout(() => setCreationSuccess(null), 3500);
      toast({ title: 'Teacher created' });
    },
    onError: (err: Error) => { setFormError(err.message); toast({ title: 'Create failed', description: err.message, variant: 'destructive' }); },
  });

  const updateTeacherMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      if (!editingTeacher) throw new Error('No teacher selected');
      const { error } = await supabase.from('teachers').update({
        teacher_code: data.teacher_code, first_name: data.first_name,
        last_name: data.last_name, email: data.email, phone: data.phone,
        is_admin: data.is_admin,
        department_id: data.department_id || null,
        department_role: data.department_id ? (data.department_role || 'Teacher') : null,
      }).eq('id', editingTeacher.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowTeacherModal(false); setEditingTeacher(null); resetTeacherForm();
      toast({ title: 'Teacher updated' });
    },
    onError: (err: Error) => { setFormError(err.message); toast({ title: 'Update failed', description: err.message, variant: 'destructive' }); },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async ({ teacherId, authId }: { teacherId: string; authId?: string }) => {
      const res = await supabase.functions.invoke('delete-teacher', { body: JSON.stringify({ teacherId, userId: authId }) });
      if (res.error) throw new Error(`Failed: ${res.error.message}`);
      if (!res.data?.success) throw new Error(res.data?.error || 'Delete failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setViewingTeacher(null);
      toast({ title: 'Teacher deleted' });
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const addAssignmentsMutation = useMutation({
    mutationFn: async ({ teacherId, classId, subjectIds }: { teacherId: string; classId: string; subjectIds: string[] }) => {
      if (!teacherId || !classId || !subjectIds.length) throw new Error('Teacher, class, and at least one subject required');
      const { error } = await supabase.from('teacher_classes')
        .insert(subjectIds.map(sid => ({ teacher_id: teacherId, class_id: classId, subject_id: sid })));
      if (error) {
        if (error.code === '23505') throw new Error('Already assigned to one of these subjects in this class');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowAssignmentModal(false);
      setAssignmentForm({ class_id: '', subject_ids: [] });
      setSelectedTeacher(null);
      toast({ title: 'Assignments added' });
    },
    onError: (err: Error) => toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' }),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teacher_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); toast({ title: 'Assignment removed' }); },
    onError: (err: Error) => toast({ title: 'Remove failed', description: err.message, variant: 'destructive' }),
  });

  // ─── Mutations: Staff ─────────────────────────────────────────────────────

  const saveStaffMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      const payload = {
        first_name: data.first_name, last_name: data.last_name,
        role: data.role, phone: data.phone,
        department: data.department || 'other', notes: data.notes,
      };
      if (editingStaff) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editingStaff.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setShowStaffModal(false); setEditingStaff(null); resetStaffForm();
      toast({ title: editingStaff ? 'Staff updated' : 'Staff member added' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); toast({ title: 'Staff member removed' }); },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const resetTeacherForm = () => {
    setTeacherForm({ teacher_code: '', first_name: '', last_name: '', email: '', phone: '', is_admin: false, password: '', department_id: '', department_role: 'Teacher' });
    setFormError(null);
  };
  const resetStaffForm = () => setStaffForm({ first_name: '', last_name: '', role: '', phone: '', department: '', notes: '' });

  const isSaving   = (createTeacherMutation as any)?.isPending || (updateTeacherMutation as any)?.isPending
                  || (createTeacherMutation as any)?.isLoading  || (updateTeacherMutation as any)?.isLoading;
  const isDeleting = (deleteTeacherMutation as any)?.isPending  || (deleteTeacherMutation as any)?.isLoading;

  const openEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setTeacherForm({
      teacher_code:    teacher.teacher_code    || '',
      first_name:      teacher.first_name      || '',
      last_name:       teacher.last_name       || '',
      email:           teacher.email           || '',
      phone:           teacher.phone           || '',
      is_admin:        teacher.is_admin        || false,
      password:        '',
      department_id:   teacher.department_id   || '',
      department_role: teacher.department_role || 'Teacher',
    });
    setShowTeacherModal(true);
  };

  const renderAssignmentsInDetail = (teacher: Teacher) => {
    const assignments = teacher.assignments || {};
    const classIds    = Object.keys(assignments);
    if (classIds.length === 0) return <p className="text-sm text-gray-400 italic">No class assignments yet.</p>;
    return (
      <div className="space-y-3">
        {classIds.map(classId => {
          const classInfo = assignments[classId]?.class;
          const subs      = assignments[classId]?.subjects || [];
          if (!classInfo) return null;
          return (
            <div key={classId} className="border rounded-lg p-3 bg-gray-50">
              <div className="font-medium text-sm flex items-center gap-2 mb-2 text-gray-700">
                <Users className="w-4 h-4" /> {classInfo.name} ({classInfo.grade_level})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subs.map((sub: any) => (
                  <div key={sub.assignment_id || sub.id} className="flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs">
                    <BookOpen className="w-3 h-3 text-purple-500 flex-shrink-0" />
                    <span className="font-medium">{sub.code}</span>
                    <span className="text-gray-400">– {sub.name}</span>
                    <button
                      className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => {
                        if (window.confirm(`Remove ${teacher.first_name} from ${sub.name} in ${classInfo.name}?`))
                          removeAssignmentMutation.mutate(sub.assignment_id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const filteredTeachers = teachers?.filter(t =>
    `${t.first_name} ${t.last_name} ${t.teacher_code} ${t.email || ''}`.toLowerCase().includes(teacherSearch.toLowerCase())
  ) || [];

  const filteredStaff = staffList?.filter(s =>
    `${s.first_name} ${s.last_name} ${s.role} ${s.department}`.toLowerCase().includes(staffSearch.toLowerCase())
  ) || [];

  // Keep viewing teacher in sync after refetch
  const liveViewingTeacher = viewingTeacher
    ? (teachers?.find(t => t.id === viewingTeacher.id) ?? viewingTeacher)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      {creationSuccess && (
        <div className="w-full bg-green-100 text-green-700 rounded px-4 py-2 text-center font-medium text-sm">
          {creationSuccess}
        </div>
      )}

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            Teachers &amp; Staff
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="mb-6 w-full sm:w-auto">
              <TabsTrigger value="teachers"    className="flex-1 sm:flex-none"><GraduationCap className="w-4 h-4 mr-2" />Teachers</TabsTrigger>
              <TabsTrigger value="staff"       className="flex-1 sm:flex-none"><Briefcase className="w-4 h-4 mr-2" />Staff</TabsTrigger>
              <TabsTrigger value="departments" className="flex-1 sm:flex-none"><Building2 className="w-4 h-4 mr-2" />Departments</TabsTrigger>
            </TabsList>

            {/* ══════════════ TEACHERS TAB ══════════════ */}
            <TabsContent value="teachers">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input placeholder="Search teachers..." value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="pl-9 h-10" />
                </div>
                <Button onClick={() => { setEditingTeacher(null); resetTeacherForm(); setShowTeacherModal(true); }} className="bg-purple-600 hover:bg-purple-700 h-10" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Teacher
                </Button>
              </div>

              {loadingTeachers ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <>
                  {/* Desktop table — lean: code, name, email, phone only */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTeachers.map(teacher => (
                          <TableRow key={teacher.id} className="cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => setViewingTeacher(teacher)}>
                            <TableCell className="font-mono text-sm font-medium text-gray-600">{teacher.teacher_code}</TableCell>
                            <TableCell>
                              <span className="font-medium text-purple-700 hover:underline">
                                {teacher.first_name} {teacher.last_name}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-600 truncate max-w-[200px]">{teacher.email || '—'}</TableCell>
                            <TableCell className="text-gray-600">{teacher.phone || '—'}</TableCell>
                            <TableCell><ChevronRight className="w-4 h-4 text-gray-400" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredTeachers.length === 0 && <EmptyState />}
                  </div>

                  {/* Mobile rows */}
                  <div className="sm:hidden space-y-2">
                    {filteredTeachers.map(teacher => (
                      <div key={teacher.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => setViewingTeacher(teacher)}>
                        <div>
                          <div className="font-medium text-purple-700">{teacher.first_name} {teacher.last_name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <Hash className="w-3 h-3" />{teacher.teacher_code}
                            {teacher.email && <><Mail className="w-3 h-3 ml-1" /><span className="truncate max-w-[140px]">{teacher.email}</span></>}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    ))}
                    {filteredTeachers.length === 0 && <EmptyState />}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ══════════════ STAFF TAB ══════════════ */}
            <TabsContent value="staff">
              {/* ── Department overview (default view) ── */}
              {!selectedStaffDept ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input placeholder="Search all staff..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} className="pl-9 h-10" />
                    </div>
                    <Button onClick={() => { setEditingStaff(null); resetStaffForm(); setShowStaffModal(true); }} className="bg-purple-600 hover:bg-purple-700 h-10" size="sm">
                      <Plus className="w-4 h-4 mr-2" /> Add Staff
                    </Button>
                  </div>

                  {loadingStaff ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28" />)}
                    </div>
                  ) : staffSearch ? (
                    /* Search results — flat list when searching */
                    <>
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead className="w-20">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStaff.map(member => {
                              const dept = getDeptConfig(member.department);
                              return (
                                <TableRow key={member.id}>
                                  <TableCell className="font-medium">{member.first_name} {member.last_name}</TableCell>
                                  <TableCell>{member.role}</TableCell>
                                  <TableCell>
                                    <Badge className={`text-xs ${dept.color} flex items-center gap-1 w-fit cursor-pointer`} onClick={() => setSelectedStaffDept(member.department)}>
                                      {dept.icon}<span>{dept.label}</span>
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-gray-600">{member.phone || '—'}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingStaff(member); setStaffForm({ first_name: member.first_name, last_name: member.last_name, role: member.role, phone: member.phone||'', department: member.department, notes: member.notes||'' }); setShowStaffModal(true); }}><Pencil className="w-4 h-4" /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm(`Remove ${member.first_name} ${member.last_name}?`)) deleteStaffMutation.mutate(member.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        {filteredStaff.length === 0 && <EmptyState label="No staff found" />}
                      </div>
                      <div className="sm:hidden space-y-2">
                        {filteredStaff.map(member => {
                          const dept = getDeptConfig(member.department);
                          return (
                            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="font-medium">{member.first_name} {member.last_name}</div>
                                <div className="text-sm text-gray-500">{member.role}</div>
                                <Badge className={`text-xs ${dept.color} mt-1`}>{dept.label}</Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingStaff(member); setStaffForm({ first_name: member.first_name, last_name: member.last_name, role: member.role, phone: member.phone||'', department: member.department, notes: member.notes||'' }); setShowStaffModal(true); }}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm(`Remove ${member.first_name}?`)) deleteStaffMutation.mutate(member.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                              </div>
                            </div>
                          );
                        })}
                        {filteredStaff.length === 0 && <EmptyState label="No staff found" />}
                      </div>
                    </>
                  ) : (
                    /* Department cards grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {STAFF_DEPARTMENTS.map(deptConfig => {
                        const members = staffList?.filter(s => s.department === deptConfig.value) || [];
                        if (members.length === 0) return null;
                        return (
                          <div
                            key={deptConfig.value}
                            className="border rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
                            onClick={() => setSelectedStaffDept(deptConfig.value)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${deptConfig.color}`}>
                                {deptConfig.icon}
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors mt-1" />
                            </div>
                            <div className="font-semibold text-gray-800">{deptConfig.label}</div>
                            <div className="text-sm text-gray-500 mt-0.5">{members.length} staff member{members.length !== 1 ? 's' : ''}</div>
                            <div className="flex -space-x-1.5 mt-3">
                              {members.slice(0, 5).map(m => (
                                <div key={m.id} className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600" title={`${m.first_name} ${m.last_name}`}>
                                  {m.first_name[0]}{m.last_name[0]}
                                </div>
                              ))}
                              {members.length > 5 && (
                                <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-500">+{members.length - 5}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {(!staffList || staffList.length === 0) && (
                        <div className="col-span-full text-center py-12 text-gray-400">
                          <Briefcase className="w-12 h-12 mx-auto mb-2 text-gray-200" />
                          <p>No staff added yet.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* ── Drilled-in department view ── */
                (() => {
                  const deptConfig  = getDeptConfig(selectedStaffDept);
                  const deptMembers = staffList?.filter(s => s.department === selectedStaffDept) || [];
                  return (
                    <div>
                      {/* Back + header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedStaffDept(null)}>
                            <ArrowLeft className="w-4 h-4" />
                          </Button>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${deptConfig.color}`}>
                            {deptConfig.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold text-base">{deptConfig.label}</h3>
                            <p className="text-xs text-gray-500">{deptMembers.length} staff member{deptMembers.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 h-9"
                          onClick={() => { setEditingStaff(null); resetStaffForm(); setStaffForm(p => ({ ...p, department: selectedStaffDept })); setShowStaffModal(true); }}>
                          <Plus className="w-4 h-4 mr-1.5" /> Add to {deptConfig.label}
                        </Button>
                      </div>

                      {/* Desktop table */}
                      <div className="hidden sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead className="w-20">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {deptMembers.map(member => (
                              <TableRow key={member.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                      {member.first_name[0]}{member.last_name[0]}
                                    </div>
                                    <span className="font-medium">{member.first_name} {member.last_name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{member.role}</TableCell>
                                <TableCell className="text-gray-600">{member.phone || '—'}</TableCell>
                                <TableCell className="text-sm text-gray-500 max-w-xs truncate">{member.notes || '—'}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingStaff(member); setStaffForm({ first_name: member.first_name, last_name: member.last_name, role: member.role, phone: member.phone||'', department: member.department, notes: member.notes||'' }); setShowStaffModal(true); }}><Pencil className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm(`Remove ${member.first_name} ${member.last_name}?`)) deleteStaffMutation.mutate(member.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {deptMembers.length === 0 && <EmptyState label={`No staff in ${deptConfig.label} yet`} />}
                      </div>

                      {/* Mobile cards */}
                      <div className="sm:hidden space-y-3">
                        {deptMembers.map(member => (
                          <Card key={member.id} className="p-4 shadow-xs">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                                  {member.first_name[0]}{member.last_name[0]}
                                </div>
                                <div>
                                  <div className="font-medium">{member.first_name} {member.last_name}</div>
                                  <div className="text-sm text-gray-500">{member.role}</div>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingStaff(member); setStaffForm({ first_name: member.first_name, last_name: member.last_name, role: member.role, phone: member.phone||'', department: member.department, notes: member.notes||'' }); setShowStaffModal(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { if (window.confirm(`Remove ${member.first_name}?`)) deleteStaffMutation.mutate(member.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </div>
                            {member.phone && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><Phone className="w-3 h-3" />{member.phone}</div>}
                            {member.notes && <p className="text-xs text-gray-400 mt-1 italic">{member.notes}</p>}
                          </Card>
                        ))}
                        {deptMembers.length === 0 && <EmptyState label={`No staff in ${deptConfig.label} yet`} />}
                      </div>
                    </div>
                  );
                })()
              )}
            </TabsContent>

            {/* ══════════════ DEPARTMENTS TAB ══════════════ */}
            <TabsContent value="departments">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">Organise teachers into departments and assign roles</p>
                <Button onClick={() => { setEditingDept(null); setDeptForm({ name: '', description: '' }); setShowDeptModal(true); }} className="bg-purple-600 hover:bg-purple-700 h-10" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Department
                </Button>
              </div>

              {loadingDepts ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
              ) : departments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-200" />
                  <p>No departments yet.</p>
                  <p className="text-sm mt-1">Add one to start organising teachers.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {departments.map(dept => {
                    const deptTeachers = (teachers?.filter(t => t.department_id === dept.id) || []).slice().sort(sortByRoleHierarchy);
                    return (
                      <Card key={dept.id} className="shadow-xs">
                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-semibold text-base flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-purple-500" />
                                {dept.name}
                              </div>
                              {dept.description && <p className="text-sm text-gray-500 mt-0.5">{dept.description}</p>}
                              <p className="text-xs text-gray-400 mt-1">{deptTeachers.length} teacher{deptTeachers.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => { setEditingDept(dept); setDeptForm({ name: dept.name, description: dept.description || '' }); setShowDeptModal(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => { if (window.confirm(`Delete "${dept.name}"? Teachers will be unassigned.`)) deleteDeptMutation.mutate(dept.id); }}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>

                          {/* Teachers list */}
                          {deptTeachers.length === 0 ? (
                            <p className="text-sm text-gray-400 italic mb-3">No teachers assigned yet.</p>
                          ) : (
                            <div className="space-y-1.5 mb-3">
                              {deptTeachers.map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold flex-shrink-0">
                                      {t.first_name[0]}{t.last_name[0]}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium">{t.first_name} {t.last_name}</div>
                                      <div className="text-xs text-gray-500">{t.teacher_code}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {t.department_role && (
                                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                        {t.department_role === 'Head of Department' && <Star className="w-3 h-3 text-yellow-500" />}
                                        {t.department_role}
                                      </Badge>
                                    )}
                                    <button
                                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                      title="Remove from department"
                                      onClick={() => {
                                        if (window.confirm(`Remove ${t.first_name} ${t.last_name} from ${dept.name}?`))
                                          removeTeacherFromDeptMutation.mutate(t.id);
                                      }}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <Button variant="outline" size="sm" className="h-8 text-xs"
                            onClick={() => { setAssignDeptTarget(dept); setAssignDeptForm({ teacher_id: '', department_role: 'Teacher' }); setShowAssignDeptModal(true); }}>
                            <Plus className="w-3 h-3 mr-1" /> Assign Teacher
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ════════ TEACHER DETAIL DIALOG (click on name) ════════ */}
      <Dialog open={!!viewingTeacher} onOpenChange={open => { if (!open) setViewingTeacher(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-0">
          {liveViewingTeacher && (
            <>
              {/* Purple header band */}
              <div className="bg-purple-600 px-6 py-5 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                      {liveViewingTeacher.first_name[0]}{liveViewingTeacher.last_name[0]}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{liveViewingTeacher.first_name} {liveViewingTeacher.last_name}</h2>
                      <div className="flex items-center gap-2 text-purple-200 text-sm mt-0.5">
                        <Hash className="w-3 h-3" />{liveViewingTeacher.teacher_code}
                        {liveViewingTeacher.is_admin && (
                          <Badge className="bg-white/20 text-white text-xs border-0 ml-1">Admin</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Edit button lives HERE — not in the list */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0 h-8"
                    onClick={() => openEditTeacher(liveViewingTeacher)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoRow icon={<Mail className="w-4 h-4" />}  label="Email" value={liveViewingTeacher.email || '—'} />
                    <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={liveViewingTeacher.phone || '—'} />
                  </div>
                </div>

                <Separator />

                {/* Department */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Department</h3>
                  {liveViewingTeacher.department ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-700 text-sm px-3 py-1 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {liveViewingTeacher.department.name}
                      </Badge>
                      {liveViewingTeacher.department_role && (
                        <Badge variant="secondary" className="text-sm px-3 py-1 flex items-center gap-1.5">
                          {liveViewingTeacher.department_role === 'Head of Department' && <Star className="w-3.5 h-3.5 text-yellow-500" />}
                          {liveViewingTeacher.department_role}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Not assigned to a department</p>
                  )}
                </div>

                <Separator />

                {/* Class & subject assignments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Class &amp; Subject Assignments</h3>
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => { setSelectedTeacher(liveViewingTeacher); setAssignmentForm({ class_id: '', subject_ids: [] }); setShowAssignmentModal(true); }}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {renderAssignmentsInDetail(liveViewingTeacher)}
                </div>

                <Separator />

                {/* Delete */}
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 h-8" disabled={isDeleting}
                    onClick={() => {
                      if (window.confirm(`Delete ${liveViewingTeacher.first_name} ${liveViewingTeacher.last_name}? This cannot be undone.`))
                        deleteTeacherMutation.mutate({ teacherId: liveViewingTeacher.id, authId: liveViewingTeacher.auth_id });
                    }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Teacher
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════ TEACHER ADD / EDIT MODAL ════════ */}
      <Dialog open={showTeacherModal} onOpenChange={open => { setShowTeacherModal(open); if (!open) { setEditingTeacher(null); resetTeacherForm(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault(); setFormError(null);
            if (!teacherForm.teacher_code.trim() || !teacherForm.first_name.trim() || !teacherForm.last_name.trim()) {
              setFormError('Teacher code, first name, and last name are required'); return;
            }
            editingTeacher ? updateTeacherMutation.mutate(teacherForm) : createTeacherMutation.mutate(teacherForm);
          }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Teacher Code *</Label>
                <Input value={teacherForm.teacher_code} onChange={e => setTeacherForm(p => ({ ...p, teacher_code: e.target.value }))} required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={teacherForm.first_name} onChange={e => setTeacherForm(p => ({ ...p, first_name: e.target.value }))} required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={teacherForm.last_name} onChange={e => setTeacherForm(p => ({ ...p, last_name: e.target.value }))} required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={teacherForm.email} onChange={e => setTeacherForm(p => ({ ...p, email: e.target.value }))} placeholder="Optional" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={teacherForm.phone} onChange={e => setTeacherForm(p => ({ ...p, phone: e.target.value }))} className="h-10" />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={teacherForm.department_id} onValueChange={v => setTeacherForm(p => ({ ...p, department_id: v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="No department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Department</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {teacherForm.department_id && (
                <div className="space-y-2">
                  <Label>Departmental Role</Label>
                  <Select value={teacherForm.department_role} onValueChange={v => setTeacherForm(p => ({ ...p, department_role: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!editingTeacher && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Password (optional)</Label>
                  <Input type="password" value={teacherForm.password} onChange={e => setTeacherForm(p => ({ ...p, password: e.target.value }))} placeholder="Leave blank to auto-generate" className="h-10" />
                  <p className="text-xs text-gray-500">If left blank, a temporary password will be auto-generated.</p>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-1">
                <Checkbox id="is_admin" checked={teacherForm.is_admin} onCheckedChange={c => setTeacherForm(p => ({ ...p, is_admin: !!c }))} />
                <Label htmlFor="is_admin" className="cursor-pointer">Grant Admin Access</Label>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              {formError && <div className="text-sm text-red-600 mr-auto">{formError}</div>}
              <Button type="button" variant="outline" onClick={() => setShowTeacherModal(false)} className="h-10">Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 h-10" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ ASSIGNMENT MODAL ════════ */}
      <Dialog open={showAssignmentModal} onOpenChange={open => { setShowAssignmentModal(open); if (!open) { setSelectedTeacher(null); setAssignmentForm({ class_id: '', subject_ids: [] }); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Assignment — {selectedTeacher?.first_name} {selectedTeacher?.last_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            if (!selectedTeacher) return;
            if (!assignmentForm.class_id || !assignmentForm.subject_ids.length) {
              toast({ title: 'Missing info', description: 'Select a class and at least one subject', variant: 'destructive' }); return;
            }
            addAssignmentsMutation.mutate({ teacherId: selectedTeacher.id, classId: assignmentForm.class_id, subjectIds: assignmentForm.subject_ids });
          }}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={assignmentForm.class_id} onValueChange={v => setAssignmentForm(p => ({ ...p, class_id: v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subjects *</Label>
                <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subjects.map(sub => (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox id={`sub-${sub.id}`} checked={assignmentForm.subject_ids.includes(sub.id)}
                          onCheckedChange={() => setAssignmentForm(p => ({
                            ...p,
                            subject_ids: p.subject_ids.includes(sub.id)
                              ? p.subject_ids.filter(id => id !== sub.id)
                              : [...p.subject_ids, sub.id],
                          }))} />
                        <Label htmlFor={`sub-${sub.id}`} className="text-sm cursor-pointer">{sub.code} – {sub.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">Selected: {assignmentForm.subject_ids.length} subjects</p>
              </div>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowAssignmentModal(false)} className="h-10">Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 h-10"
                disabled={(addAssignmentsMutation as any)?.isPending || (addAssignmentsMutation as any)?.isLoading}>
                Add Assignments
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ ASSIGN TEACHER TO DEPARTMENT MODAL ════════ */}
      <Dialog open={showAssignDeptModal} onOpenChange={open => { setShowAssignDeptModal(open); if (!open) { setAssignDeptTarget(null); setAssignDeptForm({ teacher_id: '', department_role: 'Teacher' }); } }}>
        <DialogContent className="max-w-md max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Assign Teacher to {assignDeptTarget?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            if (!assignDeptTarget || !assignDeptForm.teacher_id) {
              toast({ title: 'Please select a teacher', variant: 'destructive' }); return;
            }
            assignTeacherToDeptMutation.mutate({ teacherId: assignDeptForm.teacher_id, departmentId: assignDeptTarget.id, role: assignDeptForm.department_role });
          }}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Teacher *</Label>
                <Select value={assignDeptForm.teacher_id} onValueChange={v => setAssignDeptForm(p => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers
                      ?.filter(t => t.department_id !== assignDeptTarget?.id)
                      .map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.first_name} {t.last_name}
                          {t.department ? ` (currently: ${t.department.name})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Teachers already in other departments will be moved here.</p>
              </div>
              <div className="space-y-2">
                <Label>Departmental Role *</Label>
                <Select value={assignDeptForm.department_role} onValueChange={v => setAssignDeptForm(p => ({ ...p, department_role: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowAssignDeptModal(false)} className="h-10">Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 h-10"
                disabled={(assignTeacherToDeptMutation as any)?.isPending || (assignTeacherToDeptMutation as any)?.isLoading}>
                Assign Teacher
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ STAFF ADD / EDIT MODAL ════════ */}
      <Dialog open={showStaffModal} onOpenChange={open => { setShowStaffModal(open); if (!open) { setEditingStaff(null); resetStaffForm(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            if (!staffForm.first_name.trim() || !staffForm.last_name.trim() || !staffForm.role.trim() || !staffForm.department) {
              toast({ title: 'Missing fields', description: 'First name, last name, role and department are required.', variant: 'destructive' }); return;
            }
            saveStaffMutation.mutate(staffForm);
          }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={staffForm.first_name} onChange={e => setStaffForm(p => ({ ...p, first_name: e.target.value }))} required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={staffForm.last_name} onChange={e => setStaffForm(p => ({ ...p, last_name: e.target.value }))} required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Role / Job Title *</Label>
                <Input value={staffForm.role} onChange={e => setStaffForm(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Head Chef, Security Guard" required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={staffForm.phone} onChange={e => setStaffForm(p => ({ ...p, phone: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Department *</Label>
                <Select value={staffForm.department} onValueChange={v => setStaffForm(p => ({ ...p, department: v as StaffDepartment }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a department" /></SelectTrigger>
                  <SelectContent>
                    {STAFF_DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>
                        <div className="flex items-center gap-2">{d.icon} {d.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes (optional)</Label>
                <Input value={staffForm.notes} onChange={e => setStaffForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional info..." className="h-10" />
              </div>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowStaffModal(false)} className="h-10">Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 h-10"
                disabled={(saveStaffMutation as any)?.isPending || (saveStaffMutation as any)?.isLoading}>
                {editingStaff ? 'Update' : 'Add Staff Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ DEPARTMENT ADD / EDIT MODAL ════════ */}
      <Dialog open={showDeptModal} onOpenChange={open => { setShowDeptModal(open); if (!open) { setEditingDept(null); setDeptForm({ name: '', description: '' }); } }}>
        <DialogContent className="max-w-md max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Add Department'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            if (!deptForm.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
            saveDeptMutation.mutate(deptForm);
          }}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Department Name *</Label>
                <Input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Science, Languages, Arts" required className="h-10" />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input value={deptForm.description} onChange={e => setDeptForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description..." className="h-10" />
              </div>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowDeptModal(false)} className="h-10">Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 h-10"
                disabled={(saveDeptMutation as any)?.isPending || (saveDeptMutation as any)?.isLoading}>
                {editingDept ? 'Update' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="text-gray-400 flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        <div className="text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ label = 'No teachers found' }: { label?: string }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <Search className="w-12 h-12 mx-auto mb-2 text-gray-200" />
      <p>{label}</p>
      <p className="text-sm mt-1">Try a different search term</p>
    </div>
  );
}