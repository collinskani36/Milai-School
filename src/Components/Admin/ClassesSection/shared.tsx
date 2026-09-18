// src/Components/Admin/ClassesSection/shared.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { supabase } from '@/lib/supabaseClient';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const MAROON = '#7a1f2b';
export const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
export const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
export const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
export const HERO_SHADOW = '0 18px 40px -22px rgba(122,31,43,0.45)';
export const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type PromotionStatus = 'promoted' | 'retained' | 'graduated' | 'transferred';
export type DbPromotionStatus = 'promoted' | 'retained' | 'graduated' | 'withdrawn';

export interface RawSubjectJoin { id: string; name: string; code: string; }
export interface SubjectInfo extends RawSubjectJoin { is_optional: boolean; }

export interface ClassRecord {
  id: string; name: string; grade_level: string; created_at: string;
  studentCount: number; subjects: SubjectInfo[];
}
export interface SubjectRecord { id: string; code: string; name: string; }
export interface GradeLevel { id: string; stage: string; grade: string; created_at: string; }
export interface StudentInClass {
  enrollmentId: string; id: string; reg_no: string;
  first_name: string; last_name: string; gender: string;
}
export interface TeacherClassSubjectRow {
  teacher_class_id: string; teacher_id: string; teacher_name: string;
  class_id: string; class_name: string; grade_level: string;
  subject_id: string; subject_name: string; subject_code: string; academic_year: string;
}
export interface OverviewSubject {
  subjectName: string; subjectCode: string; teacherName: string; teacherId: string;
}
export interface OverviewClassEntry {
  className: string; gradeLevel: string; subjects: Record<string, OverviewSubject>;
}
export interface AssignedSubjectRow {
  id: string; is_optional: boolean;
  subjects: { id: string; name: string; code: string } | null;
}
export interface AcademicTerm {
  id: string; term: number; academic_year: string; term_name: string; is_current: boolean;
}
export interface PromotionDecision {
  studentId: string; enrollmentId: string; studentName: string;
  status: PromotionStatus; toClassId: string; transferSchool: string;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
export function SectionHeader({
  icon: Icon, microLabel, title, description, right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; description?: string; right?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden px-4 sm:px-5 py-3.5" style={{ background: MAROON_GRADIENT }}>
      <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
      <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)' }} />
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">{microLabel}</p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{title}</h3>
          {description && (
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">{description}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

export function DialogHero({
  icon: Icon, microLabel, title, subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden shrink-0" style={{ background: MAROON_GRADIENT }}>
      <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
      <div className="relative px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">{microLabel}</p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; message: string }

export class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: string }, ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="rounded-2xl border border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">{this.props.fallback ?? 'Something went wrong in this section'}</p>
            <p className="text-xs mt-1 text-red-400">{this.state.message}</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-xl"
              onClick={() => this.setState({ hasError: false, message: '' })}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

// ─── Shared student fetcher (unchanged logic, guarded shapes) ─────────────────
export async function fetchStudentsForClass(classId: string): Promise<StudentInClass[]> {
  const { data: enrollments, error: eErr } = await supabase
    .from('enrollments')
    .select('id, student_id')
    .eq('class_id', classId);
  if (eErr) throw eErr;
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e: { id: string; student_id: string }) => e.student_id);

  const [studentsRes, profilesRes] = await Promise.all([
    supabase.from('students').select('id, Reg_no, first_name, last_name').in('id', studentIds),
    supabase.from('profiles').select('student_id, gender').in('student_id', studentIds),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const studentMap: Record<string, { id: string; Reg_no: string; first_name: string; last_name: string }> = {};
  (studentsRes.data ?? []).forEach((s: any) => { studentMap[s.id] = s; });
  const profileMap: Record<string, { student_id: string; gender: string }> = {};
  (profilesRes.data ?? []).forEach((p: any) => { if (p.student_id) profileMap[p.student_id] = p; });

  return enrollments.map((e: { id: string; student_id: string }) => {
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