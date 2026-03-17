import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/Components/ui/input';
import {
  Plus, Search, Pencil, Trash2, Shield, BookOpen, Users, X,
  Phone, Mail, User, Hash, Building2, Briefcase,
  UserCog, UtensilsCrossed, ShieldCheck, Wrench, Sparkles,
  ChevronRight, GraduationCap, Star, ArrowLeft, Calendar,
  Users2, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
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

interface AcademicTerm {
  id: string;
  academic_year: string;
  term: number;
  is_current: boolean;
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
  academic_year: string;
}

// ─── Delete target types ───────────────────────────────────────────────────────
// One state object covers all four delete scenarios in the file.

type DeleteTarget =
  | { type: 'teacher';    id: string; authId?: string; name: string }
  | { type: 'staff';      id: string; name: string }
  | { type: 'department'; id: string; name: string }
  | { type: 'assignment'; id: string; name: string };

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

// ─── AssignmentsDetail — lifted out of parent to avoid re-creation on render ──

function AssignmentsDetail({
  teacher,
  activeAcademicYear,
  onDeleteAssignment,
}: {
  teacher: Teacher;
  activeAcademicYear: string;
  onDeleteAssignment: (assignmentId: string, subjectName: string, className: string) => void;
}) {
  const assignments = teacher.assignments || {};
  const years = Object.keys(assignments).sort((a, b) => b.localeCompare(a));
  if (years.length === 0)
    return <p className="text-sm text-gray-400 italic">No class assignments yet.</p>;

  return (
    <div className="space-y-4">
      {years.map(year => {
        const isCurrentYear = year === activeAcademicYear;
        const classIds = Object.keys(assignments[year]);
        return (
          <div key={year}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{year}</span>
              {isCurrentYear && (
                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">Current</Badge>
              )}
            </div>
            <div className="space-y-2 pl-5">
              {classIds.map(classId => {
                const classInfo = assignments[year][classId]?.class;
                const subs      = assignments[year][classId]?.subjects || [];
                if (!classInfo) return null;
                return (
                  <div key={classId} className={`border rounded-lg p-3 ${isCurrentYear ? 'bg-gray-50' : 'bg-gray-50/50 opacity-75'}`}>
                    <div className="font-medium text-sm flex items-center gap-2 mb-2 text-gray-700">
                      <Users className="w-4 h-4" /> {classInfo.name} ({classInfo.grade_level})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((sub: any) => (
                        <div key={sub.assignment_id || sub.id} className="flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs">
                          <BookOpen className="w-3 h-3 text-maroon-500 flex-shrink-0" />
                          <span className="font-medium">{sub.code}</span>
                          <span className="text-gray-400">– {sub.name}</span>
                          <button
                            className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                            onClick={() => onDeleteAssignment(sub.assignment_id, sub.name, classInfo.name)}
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
          </div>
        );
      })}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeachersAndStaffSection() {
  const [activeTab, setActiveTab]         = useState<'teachers' | 'staff' | 'departments'>('teachers');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [staffSearch, setStaffSearch]     = useState('');
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  // ── Delete confirmation state (replaces all window.confirm calls) ──────────
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // ── Teacher state ──────────────────────────────────────────────────────────
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

  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    class_id: '', subject_ids: [], academic_year: '',
  });

  // ── Bulk add state ─────────────────────────────────────────────────────────
  const EMPTY_BULK_ROW = () => ({
    teacher_code: '', first_name: '', last_name: '',
    email: '', phone: '', password: '',
    is_admin: false, department_id: '', department_role: 'Teacher',
  });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows]           = useState<ReturnType<typeof EMPTY_BULK_ROW>[]>(
    () => Array.from({ length: 5 }, EMPTY_BULK_ROW)
  );
  const [bulkResults, setBulkResults] = useState<{ index: number; name: string; status: 'success' | 'error'; message?: string }[]>([]);
  const [bulkSaving, setBulkSaving]   = useState(false);
  const [bulkDone, setBulkDone]       = useState(false);

  // ── Staff state ────────────────────────────────────────────────────────────
  const [showStaffModal, setShowStaffModal]       = useState(false);
  const [editingStaff, setEditingStaff]           = useState<StaffMember | null>(null);
  const [selectedStaffDept, setSelectedStaffDept] = useState<StaffDepartment | null>(null);
  const [staffForm, setStaffForm]                 = useState<StaffFormData>({
    first_name: '', last_name: '', role: '', phone: '', department: '', notes: '',
  });

  // ── Department state ───────────────────────────────────────────────────────
  const [showDeptModal, setShowDeptModal]             = useState(false);
  const [editingDept, setEditingDept]                 = useState<Department | null>(null);
  const [deptForm, setDeptForm]                       = useState({ name: '', description: '' });
  const [showAssignDeptModal, setShowAssignDeptModal] = useState(false);
  const [assignDeptTarget, setAssignDeptTarget]       = useState<Department | null>(null);
  const [assignDeptForm, setAssignDeptForm]           = useState({ teacher_id: '', department_role: 'Teacher' });

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: academicTerms = [] } = useQuery<AcademicTerm[]>({
    queryKey: ['academic-terms-all'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_calendar')
        .select('id, academic_year, term, is_current')
        .order('academic_year', { ascending: false });
      if (error) throw error;
      return data as AcademicTerm[];
    },
  });

  const academicYears: string[] = Array.from(new Set(academicTerms.map(t => t.academic_year)));
  const activeAcademicYear = academicTerms.find(t => t.is_current)?.academic_year ?? '';

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      return data as Department[];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id, name, grade_level').order('grade_level');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classSubjects = [], isLoading: loadingClassSubjects } = useQuery({
    queryKey: ['class-subjects', assignmentForm.class_id],
    enabled: !!assignmentForm.class_id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes_subjects')
        .select('subject_id, subjects(id, code, name)')
        .eq('class_id', assignmentForm.class_id);
      if (error) throw error;
      return (data || []).map((row: any) => row.subjects).filter(Boolean) as { id: string; code: string; name: string }[];
    },
  });

  const { data: teachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*, departments(id, name)')
        .order('created_at', { ascending: false });
      if (teachersError) throw teachersError;

      // ── FIXED: query the view instead of the base table with joins ──
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('teacher_class_subjects')
        .select('*');
      if (assignmentsError) throw assignmentsError;

      const assignmentsByTeacher: Record<string, any> = {};
      assignmentsData?.forEach(a => {
        if (!assignmentsByTeacher[a.teacher_id]) assignmentsByTeacher[a.teacher_id] = {};
        const yearKey = a.academic_year || activeAcademicYear || 'Current Year';
        if (!assignmentsByTeacher[a.teacher_id][yearKey]) {
          assignmentsByTeacher[a.teacher_id][yearKey] = {};
        }
        if (!assignmentsByTeacher[a.teacher_id][yearKey][a.class_id]) {
          assignmentsByTeacher[a.teacher_id][yearKey][a.class_id] = {
            class: { id: a.class_id, name: a.class_name, grade_level: a.grade_level },
            subjects: [],
          };
        }
        assignmentsByTeacher[a.teacher_id][yearKey][a.class_id].subjects.push({
          id: a.subject_id,
          assignment_id: a.teacher_class_id,
          code: a.subject_code,
          name: a.subject_name,
        });
      });
      // ── END FIX ──

      return teachersData?.map(t => ({
        ...t,
        department: t.departments ?? null,
        assignments: assignmentsByTeacher[t.id] || {},
      })) as Teacher[] || [];
    },
  });

  const { data: staffList, isLoading: loadingStaff } = useQuery({
    queryKey: ['staff'],
    staleTime: 2 * 60 * 1000,
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
      setDeleteTarget(null);
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
      setDeleteTarget(null);
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
      setDeleteTarget(null);
      toast({ title: 'Teacher deleted' });
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const addAssignmentsMutation = useMutation({
    mutationFn: async ({ teacherId, classId, subjectIds, academicYear }: {
      teacherId: string; classId: string; subjectIds: string[]; academicYear: string;
    }) => {
      if (!teacherId || !classId || !subjectIds.length || !academicYear) {
        throw new Error('Teacher, class, academic year, and at least one subject are required');
      }
      const { error } = await supabase.from('teacher_classes')
        .insert(subjectIds.map(sid => ({
          teacher_id: teacherId, class_id: classId,
          subject_id: sid, academic_year: academicYear,
        })));
      if (error) {
        if (error.code === '23505') throw new Error('Already assigned to one of these subjects in this class for this year');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowAssignmentModal(false);
      setAssignmentForm({ class_id: '', subject_ids: [], academic_year: '' });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setDeleteTarget(null);
      toast({ title: 'Assignment removed' });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setDeleteTarget(null);
      toast({ title: 'Staff member removed' });
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const resetTeacherForm = () => {
    setTeacherForm({ teacher_code: '', first_name: '', last_name: '', email: '', phone: '', is_admin: false, password: '', department_id: '', department_role: 'Teacher' });
    setFormError(null);
  };
  const resetStaffForm = () => setStaffForm({ first_name: '', last_name: '', role: '', phone: '', department: '', notes: '' });

  const isSaving   = createTeacherMutation.isPending || updateTeacherMutation.isPending;
  const isDeleting = deleteTeacherMutation.isPending;

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

  // Stable callback passed to AssignmentsDetail — opens delete dialog for assignment removal
  const handleDeleteAssignment = useCallback((assignmentId: string, subjectName: string, className: string) => {
    setDeleteTarget({ type: 'assignment', id: assignmentId, name: `${subjectName} in ${className}` });
  }, []);

  // ── Delete dialog confirm handler — routes to correct mutation by type ─────
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    switch (deleteTarget.type) {
      case 'teacher':
        deleteTeacherMutation.mutate({ teacherId: deleteTarget.id, authId: deleteTarget.authId });
        break;
      case 'staff':
        deleteStaffMutation.mutate(deleteTarget.id);
        break;
      case 'department':
        deleteDeptMutation.mutate(deleteTarget.id);
        break;
      case 'assignment':
        removeAssignmentMutation.mutate(deleteTarget.id);
        break;
    }
  };

  const isDeletePending =
    deleteTeacherMutation.isPending  ||
    deleteStaffMutation.isPending    ||
    deleteDeptMutation.isPending     ||
    removeAssignmentMutation.isPending;

  // Delete dialog subtitle per type
  const deleteDialogDescription = () => {
    if (!deleteTarget) return '';
    switch (deleteTarget.type) {
      case 'teacher':    return 'This will permanently delete the teacher account and cannot be undone.';
      case 'staff':      return 'This will permanently remove this staff member and cannot be undone.';
      case 'department': return 'Teachers assigned to this department will be unassigned. This cannot be undone.';
      case 'assignment': return 'This will remove the subject assignment from this teacher.';
    }
  };

  const filteredTeachers = teachers?.filter(t =>
    `${t.first_name} ${t.last_name} ${t.teacher_code} ${t.email || ''}`.toLowerCase().includes(teacherSearch.toLowerCase())
  ) || [];

  const filteredStaff = staffList?.filter(s =>
    `${s.first_name} ${s.last_name} ${s.role} ${s.department}`.toLowerCase().includes(staffSearch.toLowerCase())
  ) || [];

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
            <Shield className="w-6 h-6 text-[#800000]" />
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
                <Button onClick={() => { setEditingTeacher(null); resetTeacherForm(); setShowTeacherModal(true); }} className="bg-[#800000] hover:bg-[#6b0000] h-10" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Teacher
                </Button>
                <Button
                  onClick={() => { setBulkRows(Array.from({ length: 5 }, EMPTY_BULK_ROW)); setBulkResults([]); setBulkDone(false); setShowBulkModal(true); }}
                  variant="outline"
                  className="h-10 border-[#800000] text-[#800000] hover:bg-red-50"
                  size="sm"
                >
                  <Users2 className="w-4 h-4 mr-2" /> Bulk Add
                </Button>
              </div>

              {loadingTeachers ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <>
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
                          <TableRow key={teacher.id} className="cursor-pointer hover:bg-red-50 transition-colors" onClick={() => setViewingTeacher(teacher)}>
                            <TableCell className="font-mono text-sm font-medium text-gray-600">{teacher.teacher_code}</TableCell>
                            <TableCell>
                              <span className="font-medium text-[#800000] hover:underline">
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

                  <div className="sm:hidden space-y-2">
                    {filteredTeachers.map(teacher => (
                      <div key={teacher.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-red-50 transition-colors" onClick={() => setViewingTeacher(teacher)}>
                        <div>
                          <div className="font-medium text-[#800000]">{teacher.first_name} {teacher.last_name}</div>
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
              {!selectedStaffDept ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input placeholder="Search all staff..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} className="pl-9 h-10" />
                    </div>
                    <Button onClick={() => { setEditingStaff(null); resetStaffForm(); setShowStaffModal(true); }} className="bg-[#800000] hover:bg-[#6b0000] h-10" size="sm">
                      <Plus className="w-4 h-4 mr-2" /> Add Staff
                    </Button>
                  </div>

                  {loadingStaff ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28" />)}
                    </div>
                  ) : staffSearch ? (
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
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget({ type: 'staff', id: member.id, name: `${member.first_name} ${member.last_name}` })}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget({ type: 'staff', id: member.id, name: `${member.first_name} ${member.last_name}` })}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                              </div>
                            </div>
                          );
                        })}
                        {filteredStaff.length === 0 && <EmptyState label="No staff found" />}
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {STAFF_DEPARTMENTS.map(deptConfig => {
                        const members = staffList?.filter(s => s.department === deptConfig.value) || [];
                        if (members.length === 0) return null;
                        return (
                          <div
                            key={deptConfig.value}
                            className="border rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#800000] transition-all group"
                            onClick={() => setSelectedStaffDept(deptConfig.value)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${deptConfig.color}`}>
                                {deptConfig.icon}
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#800000] transition-colors mt-1" />
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
                (() => {
                  const deptConfig  = getDeptConfig(selectedStaffDept);
                  const deptMembers = staffList?.filter(s => s.department === selectedStaffDept) || [];
                  return (
                    <div>
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
                        <Button size="sm" className="bg-[#800000] hover:bg-[#6b0000] h-9"
                          onClick={() => { setEditingStaff(null); resetStaffForm(); setStaffForm(p => ({ ...p, department: selectedStaffDept })); setShowStaffModal(true); }}>
                          <Plus className="w-4 h-4 mr-1.5" /> Add to {deptConfig.label}
                        </Button>
                      </div>

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
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget({ type: 'staff', id: member.id, name: `${member.first_name} ${member.last_name}` })}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {deptMembers.length === 0 && <EmptyState label={`No staff in ${deptConfig.label} yet`} />}
                      </div>

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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteTarget({ type: 'staff', id: member.id, name: `${member.first_name} ${member.last_name}` })}><Trash2 className="w-3.5 h-3.5" /></Button>
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
                <Button onClick={() => { setEditingDept(null); setDeptForm({ name: '', description: '' }); setShowDeptModal(true); }} className="bg-[#800000] hover:bg-[#6b0000] h-10" size="sm">
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
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-semibold text-base flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-[#800000]" />
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
                                onClick={() => setDeleteTarget({ type: 'department', id: dept.id, name: dept.name })}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>

                          {deptTeachers.length === 0 ? (
                            <p className="text-sm text-gray-400 italic mb-3">No teachers assigned yet.</p>
                          ) : (
                            <div className="space-y-1.5 mb-3">
                              {deptTeachers.map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-[#800000] text-xs font-bold flex-shrink-0">
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
                                      onClick={() => setDeleteTarget({ type: 'assignment', id: t.id, name: `${t.first_name} ${t.last_name} from ${dept.name}` })}
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

      {/* ════════ TEACHER DETAIL DIALOG ════════ */}
      <Dialog open={!!viewingTeacher} onOpenChange={open => { if (!open) setViewingTeacher(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-0">
          {liveViewingTeacher && (
            <>
              <div className="bg-[#800000] px-6 py-5 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                      {liveViewingTeacher.first_name[0]}{liveViewingTeacher.last_name[0]}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{liveViewingTeacher.first_name} {liveViewingTeacher.last_name}</h2>
                      <div className="flex items-center gap-2 text-red-200 text-sm mt-0.5">
                        <Hash className="w-3 h-3" />{liveViewingTeacher.teacher_code}
                        {liveViewingTeacher.is_admin && (
                          <Badge className="bg-white/20 text-white text-xs border-0 ml-1">Admin</Badge>
                        )}
                      </div>
                    </div>
                  </div>
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
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoRow icon={<Mail className="w-4 h-4" />}  label="Email" value={liveViewingTeacher.email || '—'} />
                    <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={liveViewingTeacher.phone || '—'} />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Department</h3>
                  {liveViewingTeacher.department ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-red-100 text-[#800000] text-sm px-3 py-1 flex items-center gap-1.5">
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

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Class &amp; Subject Assignments</h3>
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        setSelectedTeacher(liveViewingTeacher);
                        setAssignmentForm({ class_id: '', subject_ids: [], academic_year: activeAcademicYear });
                        setShowAssignmentModal(true);
                      }}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  <AssignmentsDetail
                    teacher={liveViewingTeacher}
                    activeAcademicYear={activeAcademicYear}
                    onDeleteAssignment={handleDeleteAssignment}
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    variant="outline" size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                    disabled={isDeleting}
                    onClick={() => setDeleteTarget({
                      type: 'teacher',
                      id: liveViewingTeacher.id,
                      authId: liveViewingTeacher.auth_id,
                      name: `${liveViewingTeacher.first_name} ${liveViewingTeacher.last_name}`,
                    })}
                  >
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
                <Select
                  value={teacherForm.department_id || 'none'}
                  onValueChange={v => setTeacherForm(p => ({ ...p, department_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="No department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
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
              <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] h-10" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ ASSIGNMENT MODAL ════════ */}
      <Dialog open={showAssignmentModal} onOpenChange={open => { setShowAssignmentModal(open); if (!open) { setSelectedTeacher(null); setAssignmentForm({ class_id: '', subject_ids: [], academic_year: '' }); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Assignment — {selectedTeacher?.first_name} {selectedTeacher?.last_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault();
            if (!selectedTeacher) return;
            if (!assignmentForm.academic_year) {
              toast({ title: 'Missing academic year', description: 'Please select an academic year', variant: 'destructive' }); return;
            }
            if (!assignmentForm.class_id || !assignmentForm.subject_ids.length) {
              toast({ title: 'Missing info', description: 'Select a class and at least one subject', variant: 'destructive' }); return;
            }
            addAssignmentsMutation.mutate({
              teacherId: selectedTeacher.id,
              classId: assignmentForm.class_id,
              subjectIds: assignmentForm.subject_ids,
              academicYear: assignmentForm.academic_year,
            });
          }}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" /> Academic Year *
                </Label>
                <Select value={assignmentForm.academic_year} onValueChange={v => setAssignmentForm(p => ({ ...p, academic_year: v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select academic year" /></SelectTrigger>
                  <SelectContent>
                    {academicYears.map(y => (
                      <SelectItem key={y} value={y}>
                        {y}{y === activeAcademicYear && <span className="ml-2 text-xs text-green-600 font-medium">· Current</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!activeAcademicYear && (
                  <p className="text-xs text-amber-600">⚠ No active term set — please activate a term in Academic Calendar first.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select
                  value={assignmentForm.class_id}
                  onValueChange={v => setAssignmentForm(p => ({ ...p, class_id: v, subject_ids: [] }))}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subjects *</Label>
                {!assignmentForm.class_id ? (
                  <div className="border rounded-lg p-4 text-sm text-gray-400 italic text-center">Select a class first to see its subjects</div>
                ) : loadingClassSubjects ? (
                  <div className="border rounded-lg p-4 text-sm text-gray-400 text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading subjects…</div>
                ) : classSubjects.length === 0 ? (
                  <div className="border rounded-lg p-4 text-sm text-amber-600 text-center">No subjects assigned to this class yet. Add them via the Subjects / Classes setup.</div>
                ) : (
                  <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {classSubjects.map(sub => (
                        <div key={sub.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`sub-${sub.id}`}
                            checked={assignmentForm.subject_ids.includes(sub.id)}
                            onCheckedChange={() => setAssignmentForm(p => ({
                              ...p,
                              subject_ids: p.subject_ids.includes(sub.id)
                                ? p.subject_ids.filter(id => id !== sub.id)
                                : [...p.subject_ids, sub.id],
                            }))}
                          />
                          <Label htmlFor={`sub-${sub.id}`} className="text-sm cursor-pointer">{sub.code} – {sub.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">Selected: {assignmentForm.subject_ids.length} subject{assignmentForm.subject_ids.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowAssignmentModal(false)} className="h-10">Cancel</Button>
              <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] h-10" disabled={addAssignmentsMutation.isPending}>
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
              <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] h-10" disabled={assignTeacherToDeptMutation.isPending}>
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
              <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] h-10" disabled={saveStaffMutation.isPending}>
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
              <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] h-10" disabled={saveDeptMutation.isPending}>
                {editingDept ? 'Update' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ BULK ADD TEACHERS MODAL ════════ */}
      <Dialog open={showBulkModal} onOpenChange={open => { if (!open) { setShowBulkModal(false); setBulkDone(false); setBulkResults([]); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto max-w-[98vw] sm:max-w-6xl p-0">
          <div className="bg-[#800000] px-6 py-4 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users2 className="w-5 h-5" />
                <div>
                  <h2 className="font-bold text-lg">Bulk Add Teachers</h2>
                  <p className="text-red-200 text-xs mt-0.5">Fill in rows — only rows with Code + First + Last Name will be saved</p>
                </div>
              </div>
              {!bulkDone && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 text-xs"
                  onClick={() => setBulkRows(r => [...r, ...Array.from({ length: 5 }, EMPTY_BULK_ROW)])}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add 5 More Rows
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {bulkDone ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-gray-800">
                    Bulk save complete — {bulkResults.filter(r => r.status === 'success').length} created,{' '}
                    {bulkResults.filter(r => r.status === 'error').length} failed
                  </span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {bulkResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${r.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      {r.status === 'success'
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                      <span className="font-medium">{r.name}</span>
                      {r.status === 'error'   && <span className="text-xs text-red-600 ml-auto truncate max-w-xs">{r.message}</span>}
                      {r.status === 'success' && <span className="text-xs text-green-600 ml-auto">Created ✓</span>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => { setBulkRows(Array.from({ length: 5 }, EMPTY_BULK_ROW)); setBulkResults([]); setBulkDone(false); }}>
                    Add More Teachers
                  </Button>
                  <Button className="bg-[#800000] hover:bg-[#6b0000]" onClick={() => setShowBulkModal(false)}>Done</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[110px]">Code *</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[120px]">First Name *</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[120px]">Last Name *</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[180px]">Email</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[120px]">Phone</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[130px]">Password</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[150px]">Department</th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 min-w-[160px]">Role</th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 w-14">Admin</th>
                        <th className="px-2 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkRows.map((row, i) => {
                        const isReady = row.teacher_code.trim() && row.first_name.trim() && row.last_name.trim();
                        return (
                          <tr key={i} className={`${isReady ? 'bg-white' : 'bg-gray-50/40'} hover:bg-red-50/20 transition-colors`}>
                            <td className="px-2 py-1.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                            <td className="px-1 py-1"><Input value={row.teacher_code} onChange={e => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, teacher_code: e.target.value } : r))} placeholder="T001" className="h-8 text-xs px-2" /></td>
                            <td className="px-1 py-1"><Input value={row.first_name}   onChange={e => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, first_name: e.target.value } : r))}   placeholder="Jane"            className="h-8 text-xs px-2" /></td>
                            <td className="px-1 py-1"><Input value={row.last_name}    onChange={e => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, last_name: e.target.value } : r))}    placeholder="Doe"             className="h-8 text-xs px-2" /></td>
                            <td className="px-1 py-1"><Input type="email" value={row.email} onChange={e => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, email: e.target.value } : r))} placeholder="jane@school.ke" className="h-8 text-xs px-2" /></td>
                            <td className="px-1 py-1"><Input value={row.phone}        onChange={e => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, phone: e.target.value } : r))}        placeholder="07xx xxx xxx"   className="h-8 text-xs px-2" /></td>
                            <td className="px-1 py-1"><Input type="password" value={row.password} onChange={e => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, password: e.target.value } : r))} placeholder="Auto-gen" className="h-8 text-xs px-2" /></td>
                            <td className="px-1 py-1">
                              <Select value={row.department_id || 'none'} onValueChange={v => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, department_id: v === 'none' ? '' : v } : r))}>
                                <SelectTrigger className="h-8 text-xs px-2"><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No Department</SelectItem>
                                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-1 py-1">
                              <Select value={row.department_role} onValueChange={v => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, department_role: v } : r))}>
                                <SelectTrigger className="h-8 text-xs px-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {DEPARTMENT_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <Checkbox checked={row.is_admin} onCheckedChange={c => setBulkRows(rows => rows.map((r, idx) => idx === i ? { ...r, is_admin: !!c } : r))} />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <button className="text-gray-300 hover:text-red-400 transition-colors" onClick={() => setBulkRows(rows => rows.filter((_, idx) => idx !== i))} title="Remove row">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>
                      <span className="font-semibold text-[#800000]">
                        {bulkRows.filter(r => r.teacher_code.trim() && r.first_name.trim() && r.last_name.trim()).length}
                      </span>{' '}
                      of {bulkRows.length} rows ready
                    </span>
                    <button className="text-[#800000] hover:text-[#6b0000] underline"
                      onClick={() => setBulkRows(r => [...r, ...Array.from({ length: 10 }, EMPTY_BULK_ROW)])}>
                      + Add 10 more rows
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowBulkModal(false)} disabled={bulkSaving}>Cancel</Button>
                    <Button
                      className="bg-[#800000] hover:bg-[#6b0000] min-w-[150px]"
                      disabled={bulkSaving || bulkRows.filter(r => r.teacher_code.trim() && r.first_name.trim() && r.last_name.trim()).length === 0}
                      onClick={async () => {
                        const validRows = bulkRows
                          .map((r, i) => ({ ...r, _index: i }))
                          .filter(r => r.teacher_code.trim() && r.first_name.trim() && r.last_name.trim());
                        if (!validRows.length) {
                          toast({ title: 'No valid rows', description: 'Fill in Code, First Name and Last Name for at least one row', variant: 'destructive' });
                          return;
                        }
                        setBulkSaving(true);
                        const results: typeof bulkResults = [];
                        for (const row of validRows) {
                          const payload = {
                            email: row.email, password: row.password,
                            teacher_code: row.teacher_code,
                            first_name: row.first_name, last_name: row.last_name,
                            phone: row.phone, is_admin: row.is_admin,
                            department_id: row.department_id || null,
                            department_role: row.department_id ? (row.department_role || 'Teacher') : null,
                          };
                          try {
                            const res = await supabase.functions.invoke('create-teacher', { body: payload });
                            if (res.error) throw new Error(res.error.message);
                            let result = typeof res.data === 'string' ? JSON.parse(res.data)
                                       : res.data instanceof ArrayBuffer ? JSON.parse(new TextDecoder().decode(res.data))
                                       : res.data;
                            if (!result?.ok) throw new Error(result?.error || 'Create failed');
                            results.push({ index: row._index, name: `${row.first_name} ${row.last_name}`, status: 'success' });
                          } catch (err: any) {
                            results.push({ index: row._index, name: `${row.first_name} ${row.last_name}`, status: 'error', message: err.message });
                          }
                        }
                        queryClient.invalidateQueries({ queryKey: ['teachers'] });
                        setBulkResults(results);
                        setBulkSaving(false);
                        setBulkDone(true);
                      }}
                    >
                      {bulkSaving
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                        : <>Save {bulkRows.filter(r => r.teacher_code.trim() && r.first_name.trim() && r.last_name.trim()).length} Teachers</>}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════ DELETE CONFIRMATION DIALOG ════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Confirm Delete
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?
              <span className="block mt-1 text-red-600 font-medium">
                {deleteDialogDescription()}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeletePending}
              onClick={handleConfirmDelete}
            >
              {isDeletePending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
                : <><Trash2 className="w-4 h-4 mr-2" /> Yes, Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}