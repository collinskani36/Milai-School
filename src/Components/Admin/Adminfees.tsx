// src/Components/Admin/Adminfees.tsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/Components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Label } from "@/Components/ui/label";
import {
  Search, Plus, Users, Wallet, TrendingUp, AlertCircle,
  Settings, Receipt, RefreshCw, FileText, CreditCard,
  AlertTriangle, ArrowRightLeft, CheckCircle2, X,
  Banknote, Calendar, Hash, StickyNote, Building2, User,
  CalendarDays, Loader2, Wallet2,
} from "lucide-react";

import FeeStructureForm from "@/Components/Fees/FeeStructureForm";
import PaymentEntryForm from "@/Components/Fees/PaymentEntryForm";
import PaymentHistory from "@/Components/Fees/PaymentHistory";
import StudentFeeCard from "@/Components/Fees/StudentFeeCard";

import { supabase } from "@/lib/supabaseClient";
import { useActiveTerm, termLabel } from "@/hooks/useActiveTerm";

// ─── Design tokens (mirrors every other Admin section) ───────────────────────
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

// ─── Types (unchanged) ───────────────────────────────────────────────────────
interface UnmatchedPayment {
  id: string; admission_number: string | null; amount: number | null;
  reference: string | null; bank_account: string | null; narration: string | null;
  recorded_at: string | null;
}
interface FeeStructureClass { class_id: string; classes: { id: string; name: string } | null; }
interface FeeStructure {
  id: string; name: string; term: string; academic_year: string;
  amount: number; student_type: string; category: string;
  description?: string; is_active: boolean;
  fee_structure_classes: FeeStructureClass[];
}
interface FeeRecord {
  id: string; student_id: string; fee_structure_id: string;
  total_billed: number; total_paid: number; outstanding_balance: number;
  credit_carried: number; status: string; term: string; academic_year: string;
  last_payment_date: string | null;
  fee_structure?: { name: string; term: string; academic_year: string } | { name: any; term: any; academic_year: any }[];
}
interface StudentFee {
  id: string; student_id: string; student_name: string; admission_number: string;
  student_type: string; display_type: string; class_name: string;
  total_billed: number; total_paid: number; outstanding_balance: number;
  effective_outstanding: number; total_credit_carried: number;
  fee_records: FeeRecord[]; last_payment_date: string | null;
  academic_years: string[]; current_term_fee: FeeRecord | null;
  payments: Payment[]; status: string; term?: string; academic_year?: string;
}
interface StudentRow { id: string; first_name: string; last_name: string; Reg_no: string; }
interface Payment {
  id: string; student_id: string; fee_id: string; amount_paid: number;
  payment_date: string; payment_method: string; transaction_reference: string | null;
  status: string; academic_year: string; term: string;
  reference_number: string | null; notes: string | null;
  [key: string]: unknown;
}
interface FeeFormData { classes: string[]; student_type: string; amount: number | string; term: string; academic_year: string; [key: string]: unknown; }
interface PaymentFormData { amount: string; payment_method?: string; payment_date?: string; reference_number?: string; notes?: string; academic_year?: string; term?: string; }
interface FeeStructureFormState extends Omit<FeeStructure, 'fee_structure_classes'> { classes: string[]; }

// ─── Shared SectionHeader ─────────────────────────────────────────────────────
function SectionHeader({
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

function DetailRow({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-[#7a1f2b]/40 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className={`text-sm font-medium ${highlight ? 'text-[#7a1f2b]' : 'text-[#3a1b1f]'}`}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminFeesDashboard() {
  const queryClient = useQueryClient();
  const { data: activeTerm, isLoading: termLoading } = useActiveTerm();

  const [searchQuery, setSearchQuery]               = useState('');
  const [selectedYear, setSelectedYear]             = useState('all');
  const [selectedStudentType, setSelectedStudentType] = useState('all');
  const [showFeeForm, setShowFeeForm]               = useState(false);
  const [showPaymentForm, setShowPaymentForm]       = useState(false);
  const [selectedFee, setSelectedFee]               = useState<FeeStructureFormState | null>(null);
  const [selectedStudentFee, setSelectedStudentFee] = useState<StudentFee | null>(null);
  const [activeTab, setActiveTab]                   = useState('students');
  const [currentPage, setCurrentPage]               = useState(1);
  const PAGE_SIZE = 24; // 24 cards = 8 rows of 3, clean grid
  const [deleteTarget, setDeleteTarget]             = useState<FeeStructure | null>(null);
  const [dismissTarget, setDismissTarget]           = useState<UnmatchedPayment | null>(null);
  const [allocatingPayment, setAllocatingPayment]   = useState<UnmatchedPayment | null>(null);
  const [allocStudentSearch, setAllocStudentSearch] = useState('');
  const [allocSelectedStudent, setAllocSelectedStudent] = useState<StudentRow | null>(null);
  const [allocSelectedFeeId, setAllocSelectedFeeId] = useState('');
  const [allocPaymentMethod, setAllocPaymentMethod] = useState('bank_transfer');
  const [allocNotes, setAllocNotes]                 = useState('');
  const [allocError, setAllocError]                 = useState<string | null>(null);
  const [feeError, setFeeError]                     = useState<string | null>(null);
  const [paymentError, setPaymentError]             = useState<string | null>(null);

  // Derived: true once the admin has typed or picked a non-default filter
  const hasActiveFilter = searchQuery.trim() !== '' || selectedYear !== 'all' || selectedStudentType !== 'all';

  // ─── Queries (unchanged) ───────────────────────────────────────────────────
  const { data: allPayments = [], isLoading: loadingPayments, isError: paymentsError } = useQuery<Payment[]>({
    queryKey: ['allPayments', activeTerm?.academic_year],
    staleTime: 5 * 60 * 1000,
    enabled: !termLoading && hasActiveFilter,
    queryFn: async () => {
      let q = supabase
        .from('p_payments')
        .select('id, student_id, fee_id, amount_paid, payment_date, payment_method, transaction_reference, status, academic_year, term, reference_number, notes')
        .order('payment_date', { ascending: false });
      if (activeTerm?.academic_year) {
        q = q.eq('academic_year', activeTerm.academic_year);
      } else {
        q = q.limit(2000);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Payment[];
    },
  });

  const { data: unmatchedPayments = [], isLoading: loadingUnmatched, isError: unmatchedError } = useQuery<UnmatchedPayment[]>({
    queryKey: ['unmatchedPayments'], staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unmatched_bank_payments')
        .select('id, admission_number, amount, reference, bank_account, narration, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as UnmatchedPayment[];
    }
  });

  const { data: studentFees = [], isLoading: loadingStudentFees, isError: studentFeesError } = useQuery<StudentFee[]>({
    queryKey: ['studentFees', activeTerm?.academic_year], staleTime: 3 * 60 * 1000,
    enabled: !termLoading && hasActiveFilter,
    queryFn: async () => {
      const currentYear = activeTerm?.academic_year;

      const studentFeesQuery = (() => {
        let q = supabase
          .from('student_fees')
          .select('id, student_id, fee_structure_id, total_billed, total_paid, outstanding_balance, credit_carried, status, term, academic_year, last_payment_date, inserted_at')
          .order('inserted_at', { ascending: false });
        if (currentYear) q = q.eq('academic_year', currentYear);
        return q;
      })();

      const [
        { data: feesData, error: feesError },
        { data: studentsData, error: studentsError },
        { data: enrollmentsData, error: enrollmentsError },
        { data: feeStructures, error: feeStructureError },
      ] = await Promise.all([
        studentFeesQuery,
        supabase.from('students').select('id, first_name, last_name, Reg_no, profiles!inner ( student_type )'),
        supabase.from('enrollments').select('student_id, class_id, classes (id, name)'),
        supabase.from('fee_structure').select('id, term, academic_year'),
      ]);
      if (feesError) throw feesError;
      if (studentsError) throw studentsError;
      if (enrollmentsError) throw enrollmentsError;
      if (feeStructureError) throw feeStructureError;

      const studentMap = new Map<string, any>();
      studentsData.forEach((student: any) => {
        const profile = firstRel(student.profiles);
        studentMap.set(student.id, { ...student, student_type: profile?.student_type || 'Day Scholar' });
      });
      const enrollmentMap = new Map<string, any>();
      enrollmentsData.forEach((e: any) => enrollmentMap.set(e.student_id, e));
      const feeStructureMap = new Map<string, any>();
      feeStructures?.forEach((fs: any) => feeStructureMap.set(fs.id, fs));

      const studentFeeMap = new Map<string, any>();
      feesData.forEach((fee: any) => {
        const studentId = fee.student_id;
        if (!studentFeeMap.has(studentId)) {
          const student    = studentMap.get(studentId);
          const enrollment = enrollmentMap.get(studentId);
          studentFeeMap.set(studentId, {
            id: studentId, student_id: studentId,
            student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
            admission_number: student?.Reg_no || 'N/A',
            student_type: student?.student_type || 'Day Scholar',
            display_type: student?.student_type || 'Day Scholar',
            class_name: firstRel(enrollment?.classes)?.name || 'Not Assigned',
            total_billed: 0, total_paid: 0, outstanding_balance: 0,
            total_credit_carried: 0, fee_records: [], last_payment_date: null,
            academic_years: new Set<string>(), current_term_fee: null,
          });
        }
        const studentFee   = studentFeeMap.get(studentId);
        const feeStructure = feeStructureMap.get(fee.fee_structure_id);
        // Normalise fee_structure: Supabase may return an array; always coerce to a plain object
        const rawFs = fee.fee_structure;
        const normalisedFs: FeeRecord['fee_structure'] = rawFs
          ? (Array.isArray(rawFs)
              ? (rawFs.length > 0 ? { name: String(rawFs[0].name ?? ''), term: String(rawFs[0].term ?? ''), academic_year: String(rawFs[0].academic_year ?? '') } : undefined)
              : { name: String((rawFs as any).name ?? ''), term: String((rawFs as any).term ?? ''), academic_year: String((rawFs as any).academic_year ?? '') })
          : undefined;
        const feeWithStructure: FeeRecord = {
          ...(fee as unknown as FeeRecord),
          term: fee.term || feeStructure?.term || '',
          academic_year: fee.academic_year || feeStructure?.academic_year || '',
          fee_structure: normalisedFs,
        };
        studentFee.total_billed         += Number(fee.total_billed)   || 0;
        studentFee.total_paid           += Number(fee.total_paid)     || 0;
        studentFee.total_credit_carried += Number(fee.credit_carried) || 0;
        studentFee.fee_records.push(feeWithStructure);
        if (fee.academic_year) studentFee.academic_years.add(fee.academic_year);
        if (fee.last_payment_date) {
          const d = new Date(fee.last_payment_date);
          if (!studentFee.last_payment_date || d > new Date(studentFee.last_payment_date))
            studentFee.last_payment_date = fee.last_payment_date;
        }
        const ct = `${fee.term || feeStructure?.term}-${fee.academic_year || feeStructure?.academic_year}`;
        if (!studentFee.current_term_fee || ct > `${studentFee.current_term_fee.term}-${studentFee.current_term_fee.academic_year}`)
          studentFee.current_term_fee = feeWithStructure;
      });

      return Array.from(studentFeeMap.values()).map(student => {
        const effectiveOutstanding = Math.max(0, student.total_billed - student.total_paid);
        let status = 'Pending';
        if (student.total_paid >= student.total_billed) status = 'Paid';
        else if (student.total_paid > 0) status = 'Partial';
        return { ...student, outstanding_balance: student.total_billed - student.total_paid, effective_outstanding: effectiveOutstanding, status, academic_years: Array.from(student.academic_years) as string[] } as StudentFee;
      });
    },
  });

  const { data: fees = [], isLoading: loadingFees } = useQuery<FeeStructure[]>({
    queryKey: ['fees'], staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('fee_structure').select(`*, fee_structure_classes ( class_id, classes (id, name) )`).order('inserted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FeeStructure[];
    }
  });

  const { data: allStudents = [] } = useQuery<StudentRow[]>({
    queryKey: ['allStudents'], staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id, first_name, last_name, Reg_no').order('first_name');
      if (error) throw error;
      return (data || []) as StudentRow[];
    }
  });

  const { data: allocStudentFeeRecords = [] } = useQuery<FeeRecord[]>({
    queryKey: ['allocStudentFees', allocSelectedStudent?.id],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!allocSelectedStudent?.id) return [];
      const { data, error } = await supabase
        .from('student_fees')
        .select('id, student_id, fee_structure_id, total_billed, total_paid, outstanding_balance, credit_carried, status, term, academic_year, last_payment_date, fee_structure(name, term, academic_year)')
        .eq('student_id', allocSelectedStudent.id)
        .order('inserted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FeeRecord[];
    },
    enabled: !!allocSelectedStudent?.id,
  });

  // ─── Mutations (unchanged) ─────────────────────────────────────────────────
  const feeMutation = useMutation({
    mutationFn: async (data: FeeFormData) => {
      const amount = Number(data.amount);
      if (!amount || amount <= 0) throw new Error('Fee amount must be greater than zero.');
      if (!data.term) throw new Error('Please select a term.');
      if (!data.academic_year) throw new Error('Please select an academic year.');
      if (!data.student_type) throw new Error('Please select a student type.');

      const classes = data.classes || [];
      const { classes: _classes, ...rest } = data;
      const payload = { ...rest, student_type: data.student_type, amount };
      let feeId = selectedFee?.id;

      if (selectedFee) {
        const { error: feeErr } = await supabase.from('fee_structure').update(payload).eq('id', feeId!);
        if (feeErr) throw feeErr;
        const { error: delErr } = await supabase.from('fee_structure_classes').delete().eq('fee_structure_id', feeId!);
        if (delErr) throw delErr;
        if (classes.length > 0) {
          const { error: classErr } = await supabase.from('fee_structure_classes').insert(classes.map((class_id: string) => ({ fee_structure_id: feeId, class_id })));
          if (classErr) throw classErr;
        }
      } else {
        const { data: inserted, error } = await supabase.from('fee_structure').insert(payload).select().single();
        if (error) throw error;
        feeId = inserted.id;
        if (classes.length > 0) {
          const { error: classErr } = await supabase.from('fee_structure_classes').insert(classes.map((class_id: string) => ({ fee_structure_id: feeId, class_id })));
          if (classErr) throw classErr;
        }
      }

      if (classes.length > 0) {
        const { data: enrollmentsWithStudents, error: enrollmentsError } = await supabase
          .from('enrollments').select(`student_id, class_id, students ( id, first_name, last_name, Reg_no, profiles ( student_type ) )`).in('class_id', classes);
        if (enrollmentsError) throw enrollmentsError;
        const matchingStudents = (enrollmentsWithStudents || []).filter((item: any) => {
          const student = firstRel(item.students); const profile = firstRel((student as any)?.profiles);
          return (profile as any)?.student_type === payload.student_type;
        });
        const allStudentIds = matchingStudents.map((i: any) => i.student_id);
        const { data: allStudentPayments } = await supabase.from('p_payments').select('student_id, amount_paid, payment_date').in('student_id', allStudentIds).eq('fee_id', feeId!);
        const paymentsByStudent = new Map<string, { totalPaid: number; lastDate: string | null }>();
        (allStudentPayments || []).forEach((p: any) => {
          const ex = paymentsByStudent.get(p.student_id) || { totalPaid: 0, lastDate: null };
          ex.totalPaid += Number(p.amount_paid || 0);
          if (p.payment_date && (!ex.lastDate || new Date(p.payment_date) > new Date(ex.lastDate))) ex.lastDate = p.payment_date;
          paymentsByStudent.set(p.student_id, ex);
        });
        const { data: existingFees = [], error: existingErr } = await supabase.from('student_fees').select('*').in('student_id', allStudentIds).eq('fee_structure_id', feeId!);
        if (existingErr) throw existingErr;
        const existingMap = new Map<string, any>();
        (existingFees || []).forEach((ef: any) => existingMap.set(ef.student_id, ef));
        const toInsert: any[] = [], toUpdate: any[] = [];
        for (const enrollment of matchingStudents) {
          const studentId = enrollment.student_id;
          const student   = firstRel(enrollment.students);
          const existing  = existingMap.get(studentId);
          const pmtData   = paymentsByStudent.get(studentId) || { totalPaid: 0, lastDate: null };
          const feePayload: any = {
            student_id: studentId, fee_structure_id: feeId, total_billed: payload.amount,
            total_paid: pmtData.totalPaid, outstanding_balance: Math.max(0, payload.amount - pmtData.totalPaid),
            status: pmtData.totalPaid >= payload.amount ? 'paid' : pmtData.totalPaid > 0 ? 'partial' : 'pending',
            term: payload.term, academic_year: payload.academic_year,
            student_name: student ? `${(student as any).first_name} ${(student as any).last_name}` : 'Unknown',
            admission_number: (student as any)?.Reg_no || 'N/A', last_payment_date: pmtData.lastDate,
          };
          if (existing) toUpdate.push({ id: existing.id, payload: feePayload });
          else toInsert.push(feePayload);
        }
        if (toInsert.length > 0) { const { error: insertErr } = await supabase.from('student_fees').insert(toInsert); if (insertErr) throw insertErr; }
        if (toUpdate.length > 0) {
          const upsertRows = toUpdate.map(u => ({ id: u.id, ...u.payload }));
          const { error: upsertErr } = await supabase.from('student_fees').upsert(upsertRows, { onConflict: 'id' });
          if (upsertErr) throw upsertErr;
        }
      }
      return { success: true };
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fees'] }); queryClient.invalidateQueries({ queryKey: ['studentFees'] }); queryClient.invalidateQueries({ queryKey: ['allPayments'] }); setShowFeeForm(false); setSelectedFee(null); setFeeError(null); },
    onError: (err: Error) => { setFeeError(err.message || 'Failed to save fee structure. Please try again.'); },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData & { student_id: string; term: string; academic_year: string }) => {
      if (!selectedStudentFee) throw new Error('No student fee record selected');
      const feeRecord = selectedStudentFee.current_term_fee || (selectedStudentFee as any);
      const amount = parseFloat(data.amount) || 0;
      if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
      if (!feeRecord.id && !feeRecord.fee_structure_id) throw new Error('Fee record is missing an ID — cannot record payment.');
      const { data: paymentInserted, error: paymentError } = await supabase.from('p_payments').insert({
        student_id: feeRecord.student_id, fee_id: feeRecord.id || feeRecord.fee_structure_id,
        amount_paid: amount, payment_method: data.payment_method || 'mpesa',
        payment_date: data.payment_date || new Date().toISOString(),
        transaction_reference: data.reference_number || null, status: 'completed',
        academic_year: data.academic_year || feeRecord.academic_year || activeTerm?.academic_year || (() => { throw new Error('Academic year could not be determined — please refresh and try again.'); })(),
        term: data.term || feeRecord.term || (activeTerm ? termLabel(activeTerm) : 'Term 1'),
        reference_number: data.reference_number || null, notes: data.notes || null,
      }).select().single();
      if (paymentError) throw paymentError;
      return paymentInserted;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['studentFees'] }); queryClient.invalidateQueries({ queryKey: ['allPayments'] }); setShowPaymentForm(false); setSelectedStudentFee(null); setPaymentError(null); },
    onError: (err: Error) => { setPaymentError(err.message || 'Failed to record payment. Please try again.'); },
  });

  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!allocatingPayment || !allocSelectedStudent || !allocSelectedFeeId)
        throw new Error('Please select a student and fee record');
      const feeRecord = allocStudentFeeRecords.find((f) => f.id === allocSelectedFeeId);
      if (!feeRecord) throw new Error('Fee record not found');
      const amount = Number(allocatingPayment.amount);
      if (!amount || amount <= 0) throw new Error('Payment amount is invalid — cannot allocate.');

      const { error: paymentError } = await supabase.from('p_payments').insert({
        student_id: allocSelectedStudent.id, fee_id: feeRecord.id, amount_paid: amount,
        payment_method: allocPaymentMethod, payment_date: allocatingPayment.recorded_at || new Date().toISOString(),
        transaction_reference: allocatingPayment.reference || null, reference_number: allocatingPayment.reference || null,
        status: 'completed', academic_year: feeRecord.academic_year || (feeRecord as any).fee_structure?.academic_year || '',
        term: feeRecord.term || (feeRecord as any).fee_structure?.term || '',
        notes: allocNotes || `Allocated from unmatched payment. Bank: ${allocatingPayment.bank_account || '—'}. Narration: ${allocatingPayment.narration || '—'}`,
      });
      if (paymentError) throw paymentError;

      const { error: deleteError } = await supabase
        .from('unmatched_bank_payments')
        .delete()
        .eq('id', allocatingPayment.id);
      if (deleteError) {
        throw new Error(
          `Payment was recorded successfully, but the unmatched entry could not be removed (${deleteError.message}). ` +
          `Please delete it manually from the Unmatched Payments list.`
        );
      }
      return { success: true };
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['unmatchedPayments'] }); queryClient.invalidateQueries({ queryKey: ['studentFees'] }); queryClient.invalidateQueries({ queryKey: ['allPayments'] }); closeAllocModal(); },
    onError: (err: Error) => { setAllocError(err.message || 'Allocation failed. Please try again.'); },
  });

  const deleteFee = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('fee_structure').delete().eq('id', id); if (error) throw error; return true; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      setDeleteTarget(null);
    },
  });

  const dismissUnmatched = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('unmatched_bank_payments').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['unmatchedPayments'] }); setDismissTarget(null); },
  });

  // ─── Helpers (unchanged) ───────────────────────────────────────────────────
  const closeAllocModal = () => {
    setAllocatingPayment(null); setAllocStudentSearch(''); setAllocSelectedStudent(null);
    setAllocSelectedFeeId(''); setAllocPaymentMethod('bank_transfer'); setAllocNotes(''); setAllocError(null);
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    studentFees.forEach(sf => sf.academic_years?.forEach(y => years.add(y)));
    return Array.from(years).sort().reverse();
  }, [studentFees]);

  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of allPayments) {
      if (!map.has(p.student_id)) map.set(p.student_id, []);
      map.get(p.student_id)!.push(p);
    }
    return map;
  }, [allPayments]);

  const filteredStudentFees = useMemo(() => {
    return (studentFees || [])
      .map(sf => ({ ...sf, payments: paymentsByStudent.get(sf.student_id) ?? [] }))
      .filter((sf) => {
        const matchesSearch = !searchQuery || (sf.student_name && sf.student_name.toLowerCase().includes(searchQuery.toLowerCase())) || (sf.admission_number && sf.admission_number.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesYear   = selectedYear === 'all' || sf.academic_years?.includes(selectedYear);
        const matchesType   = selectedStudentType === 'all' || (selectedStudentType === 'day' && sf.student_type === 'Day Scholar') || (selectedStudentType === 'boarder' && sf.student_type === 'Boarding');
        return matchesSearch && matchesYear && matchesType;
      });
  }, [studentFees, paymentsByStudent, searchQuery, selectedYear, selectedStudentType]);

  // Reset to page 1 whenever the filter result set changes
  React.useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedYear, selectedStudentType]);

  const totalPages = Math.ceil(filteredStudentFees.length / PAGE_SIZE);
  const paginatedStudentFees = useMemo(
    () => filteredStudentFees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredStudentFees, currentPage]
  );

  const stats = useMemo(() => {
    const filtered       = filteredStudentFees || [];
    const totalBilled    = filtered.reduce((s, sf) => s + Number(sf.total_billed ?? 0), 0);
    const totalCollected = filtered.reduce((s, sf) => s + Number(sf.total_paid ?? 0), 0);
    const totalOutstanding   = filtered.reduce((s, sf) => s + Number(sf.outstanding_balance ?? 0), 0);
    const totalCreditCarried = filtered.reduce((s, sf) => s + Number(sf.total_credit_carried ?? 0), 0);
    return { totalStudents: filtered.length, totalBilled, totalCollected, totalOutstanding, totalCreditCarried };
  }, [filteredStudentFees]);

  const allocSearchResults = useMemo(() => {
    if (!allocStudentSearch.trim()) return [];
    const q = allocStudentSearch.toLowerCase();
    return allStudents.filter((s) => `${s.first_name} ${s.last_name} ${s.Reg_no}`.toLowerCase().includes(q)).slice(0, 8);
  }, [allStudents, allocStudentSearch]);

  const handleRecordPayment = (studentFee: StudentFee) => { setSelectedStudentFee(studentFee); setShowPaymentForm(true); };
  const handleViewDetails   = (studentFee: StudentFee) => { setSelectedStudentFee(studentFee); setActiveTab('history'); };
  const handleEditFee = (fee: FeeStructure) => {
    const { fee_structure_classes, ...rest } = fee;
    setSelectedFee({ ...rest, classes: fee_structure_classes?.map((fsc) => fsc.class_id) || [] });
    setShowFeeForm(true);
  };

  const isFeeSubmitting     = feeMutation.isPending;
  const isPaymentSubmitting = paymentMutation.isPending;
  const isAllocating        = allocateMutation.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      {/* ══════════ HEADER CARD ══════════ */}
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={Wallet2}
          microLabel="Finance"
          title="Fee Management"
          description="Manage student fees, payments, and fee structures"
          right={
            <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
              {/* Active term pill */}
              {termLoading ? (
                <div className="flex items-center gap-1.5 text-[11px] text-white/70 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : activeTerm ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-[11px] font-medium">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  <CalendarDays className="w-3.5 h-3.5" />
                  {termLabel(activeTerm)}, {activeTerm.academic_year}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400/20 border border-amber-300/40 text-amber-50 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> No active term
                </div>
              )}
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['studentFees'] });
                  queryClient.invalidateQueries({ queryKey: ['allPayments'] });
                  queryClient.invalidateQueries({ queryKey: ['fees'] });
                  queryClient.invalidateQueries({ queryKey: ['unmatchedPayments'] });
                  queryClient.invalidateQueries({ queryKey: ['activeTerm'] });
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[11px] font-medium transition-colors active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={() => { setSelectedFee(null); setShowFeeForm(true); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white text-[#7a1f2b] hover:bg-white/90 text-[11px] font-semibold transition-colors active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Add Fee Type
              </button>
            </div>
          }
        />

        {/* Mobile action row */}
        <div className="sm:hidden p-3 border-b border-[#7a1f2b]/10 bg-[#fdfbfb] space-y-2.5">
          {termLoading ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground px-3 py-2 rounded-xl border border-[#7a1f2b]/10 bg-white">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7a1f2b]" /> Loading term…
            </div>
          ) : activeTerm ? (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#7a1f2b]/15 text-[#7a1f2b] text-xs font-medium"
              style={{ background: 'rgba(122,31,43,0.05)' }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <CalendarDays className="w-3.5 h-3.5" />
              {termLabel(activeTerm)}, {activeTerm.academic_year}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" /> No active term
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['studentFees'] });
                queryClient.invalidateQueries({ queryKey: ['allPayments'] });
                queryClient.invalidateQueries({ queryKey: ['fees'] });
                queryClient.invalidateQueries({ queryKey: ['unmatchedPayments'] });
                queryClient.invalidateQueries({ queryKey: ['activeTerm'] });
              }}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
            <Button
              onClick={() => { setSelectedFee(null); setShowFeeForm(true); }}
              className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
              style={GRADIENT_BTN_STYLE}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Fee
            </Button>
          </div>
        </div>
      </Card>

      {/* ══════════ STAT CARDS ══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: 'Total Students',  value: stats.totalStudents,                                icon: Users,       accent: false },
          { label: 'Total Billed',    value: `KES ${stats.totalBilled.toLocaleString()}`,        icon: FileText,    accent: false },
          { label: 'Total Collected', value: `KES ${stats.totalCollected.toLocaleString()}`,     icon: TrendingUp,  accent: true },
          { label: 'Outstanding',     value: `KES ${stats.totalOutstanding.toLocaleString()}`,   icon: AlertCircle, accent: false },
          { label: 'Credit Carried',  value: `KES ${stats.totalCreditCarried.toLocaleString()}`, icon: CreditCard,  accent: false },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}
              className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden hover:-translate-y-0.5 transition-all"
              style={{ boxShadow: CARD_SHADOW }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW_HOVER}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW}>
              <div className="h-1" style={{ background: MAROON_GRADIENT }} />
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold truncate">
                      {stat.label}
                    </p>
                    <p className={`font-bold mt-1 truncate ${stat.accent ? 'text-[#7a1f2b] text-lg sm:text-xl' : 'text-[#3a1b1f] text-base sm:text-lg'}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(122,31,43,0.08)' }}>
                    <Icon className="w-4 h-4 text-[#7a1f2b]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ══════════ ERROR BANNER ══════════ */}
      {(studentFeesError || paymentsError || unmatchedError) && (
        <div className="flex items-start gap-3 rounded-2xl p-4 border border-red-200 bg-red-50">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Failed to load fee data</p>
            <p className="text-red-700 text-sm mt-0.5">
              One or more data sources could not be reached. Check your connection and click{' '}
              <strong>Refresh</strong> to try again.
              {studentFeesError && ' [Student fees]'}
              {paymentsError && ' [Payments]'}
              {unmatchedError && ' [Unmatched]'}
            </p>
          </div>
        </div>
      )}

      {/* ══════════ TABS ══════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-1 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <TabsList className="bg-transparent p-0 h-auto flex-wrap gap-0.5 w-full justify-start">
            {[
              { value: 'students',  label: 'Student Fees',      icon: Users },
              { value: 'structure', label: 'Fee Structure',     icon: Settings },
              { value: 'history',   label: 'Payment History',   icon: Receipt },
              { value: 'unmatched', label: 'Unmatched',         icon: AlertTriangle, badge: unmatchedPayments.length },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative rounded-lg px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium text-[#3a1b1f]/70 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors active:scale-[0.98]"
                  style={{ background: activeTab === tab.value ? MAROON_GRADIENT : 'transparent' }}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                      activeTab === tab.value ? 'bg-white/25 text-white' : 'bg-[#7a1f2b] text-white'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ══════════ STUDENT FEES TAB ══════════ */}
        <TabsContent value="students" className="space-y-4 sm:space-y-6">
          <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a1f2b]/40 w-4 h-4" />
                  <Input
                    placeholder="Search by name or admission number…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 sm:h-11 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 bg-white"
                  />
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full md:w-40 h-10 sm:h-11 rounded-xl border-[#7a1f2b]/15 bg-white">
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedStudentType} onValueChange={setSelectedStudentType}>
                  <SelectTrigger className="w-full md:w-40 h-10 sm:h-11 rounded-xl border-[#7a1f2b]/15 bg-white">
                    <SelectValue placeholder="Student Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="day">Day Scholars</SelectItem>
                    <SelectItem value="boarder">Boarders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {!hasActiveFilter ? (
            <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(122,31,43,0.06)' }}>
                  <Search className="w-7 h-7 text-[#7a1f2b]/40" />
                </div>
                <h3 className="font-semibold text-[#3a1b1f]">Search to view student fees</h3>
                <p className="text-muted-foreground mt-1 text-sm">Enter a name or admission number, or pick a year / student type above</p>
              </CardContent>
            </Card>
          ) : loadingStudentFees ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <Card key={i} className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden animate-pulse" style={{ boxShadow: CARD_SHADOW }}>
                  <CardContent className="p-5 h-64" />
                </Card>
              ))}
            </div>
          ) : filteredStudentFees.length === 0 ? (
            <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(122,31,43,0.06)' }}>
                  <Users className="w-7 h-7 text-[#7a1f2b]/40" />
                </div>
                <h3 className="font-semibold text-[#3a1b1f]">No student fees found</h3>
                <p className="text-muted-foreground mt-1 text-sm">Try adjusting your search or filters</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Result count */}
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">
                  Showing{' '}
                  <span className="font-semibold text-[#3a1b1f]">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredStudentFees.length)}
                  </span>{' '}
                  of <span className="font-semibold text-[#3a1b1f]">{filteredStudentFees.length}</span> students
                </p>
                {totalPages > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Page <span className="font-semibold text-[#3a1b1f]">{currentPage}</span> of{' '}
                    <span className="font-semibold text-[#3a1b1f]">{totalPages}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedStudentFees.map((studentFee) => (
                  <StudentFeeCard
                    key={studentFee.student_id}
                    studentFee={studentFee}
                    onRecordPayment={handleRecordPayment}
                    onViewDetails={handleViewDetails}
                    showAggregated={true}
                    paymentCount={studentFee.payments?.length || 0}
                    creditCarried={studentFee.total_credit_carried || 0}
                    activeTerm={activeTerm ?? null}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-2">
                  <button
                    onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={currentPage === 1}
                    className="h-8 w-8 rounded-lg border border-[#7a1f2b]/15 text-[#7a1f2b] text-xs font-medium hover:bg-[#7a1f2b]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    aria-label="First page"
                  >
                    «
                  </button>
                  <button
                    onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={currentPage === 1}
                    className="h-8 w-8 rounded-lg border border-[#7a1f2b]/15 text-[#7a1f2b] text-xs font-medium hover:bg-[#7a1f2b]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    aria-label="Previous page"
                  >
                    ‹
                  </button>

                  {/* Page number pills — show at most 5 around the current page */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === 'ellipsis' ? (
                        <span key={`e${idx}`} className="h-8 w-8 flex items-center justify-center text-[#7a1f2b]/40 text-xs select-none">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => { setCurrentPage(item as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                            currentPage === item
                              ? 'text-white border-0'
                              : 'border border-[#7a1f2b]/15 text-[#7a1f2b] hover:bg-[#7a1f2b]/5'
                          }`}
                          style={currentPage === item ? { background: MAROON_GRADIENT } : undefined}
                          aria-label={`Page ${item}`}
                          aria-current={currentPage === item ? 'page' : undefined}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 rounded-lg border border-[#7a1f2b]/15 text-[#7a1f2b] text-xs font-medium hover:bg-[#7a1f2b]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    aria-label="Next page"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 rounded-lg border border-[#7a1f2b]/15 text-[#7a1f2b] text-xs font-medium hover:bg-[#7a1f2b]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    aria-label="Last page"
                  >
                    »
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══════════ FEE STRUCTURE TAB ══════════ */}
        <TabsContent value="structure" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {loadingFees ? (
              [1,2,3].map(i => (
                <Card key={i} className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden animate-pulse" style={{ boxShadow: CARD_SHADOW }}>
                  <CardContent className="p-5 h-40" />
                </Card>
              ))
            ) : fees.length === 0 ? (
              <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white col-span-full" style={{ boxShadow: CARD_SHADOW }}>
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'rgba(122,31,43,0.06)' }}>
                    <Wallet className="w-7 h-7 text-[#7a1f2b]/40" />
                  </div>
                  <h3 className="font-semibold text-[#3a1b1f]">No fee types defined</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Add your first fee type to get started</p>
                  <Button onClick={() => setShowFeeForm(true)}
                    className="mt-4 h-10 rounded-xl text-white border-0 active:scale-[0.98]"
                    style={GRADIENT_BTN_STYLE}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add Fee Type
                  </Button>
                </CardContent>
              </Card>
            ) : fees.map((fee) => (
              <Card key={fee.id}
                className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden hover:-translate-y-0.5 transition-all"
                style={{ boxShadow: CARD_SHADOW }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW_HOVER}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW}>
                <div className="h-1" style={{ background: fee.is_active ? MAROON_GRADIENT : '#e5e7eb' }} />
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[#3a1b1f] truncate">{fee.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{fee.term} • {fee.academic_year}</p>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span>Type:</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15 text-[10px] font-semibold">
                          {fee.student_type}
                        </span>
                      </div>
                      {fee.fee_structure_classes?.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-1 truncate">
                          Classes: {fee.fee_structure_classes.map((fsc) => fsc.classes?.name).filter(Boolean).join(', ')}
                        </div>
                      )}
                      {activeTerm && fee.term === termLabel(activeTerm) && fee.academic_year === activeTerm.academic_year && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          Current term
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border shrink-0 ${
                      fee.category === 'Mandatory'
                        ? 'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/20'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {fee.category}
                    </span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-[#7a1f2b] mb-3">
                    KES {Number(fee.amount ?? 0).toLocaleString()}
                  </p>
                  {fee.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{fee.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditFee(fee)}
                      className="flex-1 h-9 rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget(fee)}
                      className="h-9 rounded-lg text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50 active:scale-[0.98]">
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ══════════ PAYMENT HISTORY TAB ══════════ */}
        <TabsContent value="history">
          <PaymentHistory
            payments={selectedStudentFee ? allPayments.filter((p) => p.student_id === selectedStudentFee.student_id) : allPayments}
            isLoading={loadingPayments} showStudentInfo={true}
          />
          {selectedStudentFee && (
            <Button variant="outline" onClick={() => setSelectedStudentFee(null)}
              className="mt-4 h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]">
              Show All Payments
            </Button>
          )}
        </TabsContent>

        {/* ══════════ UNMATCHED PAYMENTS TAB ══════════ */}
        <TabsContent value="unmatched" className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4 border border-amber-200 bg-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Unmatched Bank Payments</p>
              <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                These payments arrived via bank transfer but could not be automatically linked to a student.
                Review each one and allocate it to the correct student and fee record.
              </p>
            </div>
          </div>

          {loadingUnmatched ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <Card key={i} className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden animate-pulse" style={{ boxShadow: CARD_SHADOW }}>
                  <CardContent className="h-28" />
                </Card>
              ))}
            </div>
          ) : unmatchedPayments.length === 0 ? (
            <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-[#3a1b1f]">All payments matched!</h3>
                <p className="text-muted-foreground mt-1 text-sm">No unmatched bank payments at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {unmatchedPayments.map((payment) => (
                <Card key={payment.id}
                  className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden hover:-translate-y-0.5 transition-all"
                  style={{ boxShadow: CARD_SHADOW }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW_HOVER}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center border border-amber-200"
                          style={{ background: 'rgba(245,158,11,0.08)' }}>
                          <Banknote className="w-5 h-5 text-amber-600 mb-0.5" />
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">KES</span>
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                        <DetailRow icon={<Banknote className="w-3.5 h-3.5" />} label="Amount" value={`KES ${Number(payment.amount ?? 0).toLocaleString()}`} highlight />
                        <DetailRow icon={<Hash className="w-3.5 h-3.5" />} label="Reference" value={payment.reference || '—'} />
                        <DetailRow icon={<User className="w-3.5 h-3.5" />} label="Adm. No." value={payment.admission_number || '—'} />
                        <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label="Bank Acc." value={payment.bank_account || '—'} />
                        <DetailRow icon={<StickyNote className="w-3.5 h-3.5" />} label="Narration" value={payment.narration || '—'} />
                        <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Recorded"
                          value={payment.recorded_at
                            ? new Date(payment.recorded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'} />
                      </div>
                      <div className="flex sm:flex-col gap-2 flex-shrink-0">
                        <Button size="sm"
                          className="h-9 rounded-lg text-white border-0 active:scale-[0.98] flex-1 sm:flex-none"
                          style={GRADIENT_BTN_STYLE}
                          onClick={() => {
                            setAllocatingPayment(payment);
                            if (payment.admission_number) setAllocStudentSearch(payment.admission_number);
                          }}>
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Allocate
                        </Button>
                        <Button size="sm" variant="outline"
                          className="h-9 rounded-lg text-red-600 border-red-200 hover:bg-red-50 active:scale-[0.98] flex-1 sm:flex-none"
                          onClick={() => setDismissTarget(payment)}>
                          <X className="w-3.5 h-3.5 mr-1.5" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════ Allocate Payment Modal ══════════ */}
      <Dialog open={!!allocatingPayment} onOpenChange={open => { if (!open) closeAllocModal(); }}>
        <DialogContent className="max-w-2xl max-w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={GRADIENT_BTN_STYLE}>
                <ArrowRightLeft className="w-4 h-4 text-white" />
              </div>
              Allocate Payment to Student
            </DialogTitle>
          </DialogHeader>
          {allocatingPayment && (
            <div className="space-y-4 sm:space-y-5">
              <div className="rounded-xl border border-[#7a1f2b]/15 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
                style={{ background: 'rgba(122,31,43,0.04)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Amount</p>
                  <p className="font-bold text-[#7a1f2b] text-base sm:text-lg mt-0.5">KES {Number(allocatingPayment.amount ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Reference</p>
                  <p className="text-sm font-medium text-[#3a1b1f] mt-0.5 truncate">{allocatingPayment.reference || '—'}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Bank Account</p>
                  <p className="text-sm font-medium text-[#3a1b1f] mt-0.5 truncate">{allocatingPayment.bank_account || '—'}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Narration</p>
                  <p className="text-sm text-[#3a1b1f] mt-0.5">{allocatingPayment.narration || '—'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5 text-[#3a1b1f]">
                  <span className="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold" style={GRADIENT_BTN_STYLE}>1</span>
                  Find Student
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a1f2b]/40 w-4 h-4" />
                  <Input placeholder="Search by name or admission number…"
                    value={allocStudentSearch}
                    onChange={e => { setAllocStudentSearch(e.target.value); setAllocSelectedStudent(null); setAllocSelectedFeeId(''); setAllocError(null); }}
                    className="pl-9 h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                </div>
                {allocSearchResults.length > 0 && !allocSelectedStudent && (
                  <div className="rounded-xl border border-[#7a1f2b]/10 divide-y divide-[#7a1f2b]/8 bg-white max-h-48 overflow-y-auto"
                    style={{ boxShadow: CARD_SHADOW }}>
                    {allocSearchResults.map((s) => (
                      <button key={s.id}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[#7a1f2b]/[0.04] active:bg-[#7a1f2b]/[0.06] transition-colors flex items-center gap-3"
                        onClick={() => {
                          setAllocSelectedStudent(s);
                          setAllocStudentSearch(`${s.first_name} ${s.last_name} (${s.Reg_no})`);
                          setAllocSelectedFeeId('');
                          setAllocError(null);
                        }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={GRADIENT_BTN_STYLE}>
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#3a1b1f] truncate">{s.first_name} {s.last_name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{s.Reg_no}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {allocSelectedStudent && (
                  <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border border-[#7a1f2b]/15"
                    style={{ background: 'rgba(122,31,43,0.05)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={GRADIENT_BTN_STYLE}>
                      {allocSelectedStudent.first_name[0]}{allocSelectedStudent.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[#3a1b1f] truncate">{allocSelectedStudent.first_name} {allocSelectedStudent.last_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{allocSelectedStudent.Reg_no}</div>
                    </div>
                    <button
                      className="w-7 h-7 rounded-lg text-[#7a1f2b]/40 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                      onClick={() => { setAllocSelectedStudent(null); setAllocStudentSearch(''); setAllocSelectedFeeId(''); setAllocError(null); }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {allocSelectedStudent && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5 text-[#3a1b1f]">
                    <span className="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold" style={GRADIENT_BTN_STYLE}>2</span>
                    Select Fee Record
                  </Label>
                  {allocStudentFeeRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic px-1">No fee records found for this student.</p>
                  ) : (
                    <div className="space-y-2">
                      {allocStudentFeeRecords.map((fee) => {
                        const isSelected = allocSelectedFeeId === fee.id;
                        const outstanding = Math.max(0, (fee.total_billed || 0) - (fee.total_paid || 0));
                        const feeName = (fee as any).fee_structure?.name || 'Fee';
                        const term    = fee.term || (fee as any).fee_structure?.term || '';
                        const year    = fee.academic_year || (fee as any).fee_structure?.academic_year || '';
                        return (
                          <button key={fee.id}
                            className={`w-full text-left px-3.5 py-3 rounded-xl border-2 transition-all active:scale-[0.99] ${
                              isSelected
                                ? 'border-[#7a1f2b]/50 bg-[#7a1f2b]/[0.05]'
                                : 'border-[#7a1f2b]/15 hover:border-[#7a1f2b]/30 bg-white'
                            }`}
                            onClick={() => { setAllocSelectedFeeId(fee.id); setAllocError(null); }}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-[#3a1b1f] truncate">{feeName}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{term}{term && year ? ' • ' : ''}{year}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Outstanding</div>
                                <div className={`font-bold text-sm ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  KES {outstanding.toLocaleString()}
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-5 h-5 text-[#7a1f2b] ml-1 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {allocSelectedFeeId && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-1.5 text-[#3a1b1f]">
                    <span className="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold" style={GRADIENT_BTN_STYLE}>3</span>
                    Confirm Details
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Payment Method</Label>
                      <Select value={allocPaymentMethod} onValueChange={setAllocPaymentMethod}>
                        <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Notes (optional)</Label>
                      <Input placeholder="Any additional notes…" value={allocNotes}
                        onChange={e => setAllocNotes(e.target.value)}
                        className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                    </div>
                  </div>
                </div>
              )}

              {allocError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {allocError}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#7a1f2b]/10 mt-2">
            <Button variant="outline" onClick={closeAllocModal}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button
              className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
              style={GRADIENT_BTN_STYLE}
              disabled={!allocSelectedStudent || !allocSelectedFeeId || isAllocating}
              onClick={() => allocateMutation.mutate()}>
              {isAllocating
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Allocating…</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Allocation</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ Delete Fee Dialog ══════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              Delete Fee Structure
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#3a1b1f]/80 py-2">
            Are you sure you want to delete <strong className="text-[#3a1b1f]">"{deleteTarget?.name}"</strong>?
            <span className="block mt-1.5 text-red-600 font-medium text-xs">
              This will permanently delete the fee structure and cannot be undone.
            </span>
          </p>
          <DialogFooter className="flex gap-3 pt-3 border-t border-[#7a1f2b]/10">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button className="h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white border-0 active:scale-[0.98]"
              disabled={deleteFee.isPending}
              onClick={() => { if (deleteTarget) deleteFee.mutate(deleteTarget.id); }}>
              {deleteFee.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</>
                : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ Dismiss Dialog ══════════ */}
      <Dialog open={!!dismissTarget} onOpenChange={open => { if (!open) setDismissTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              Dismiss Payment
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#3a1b1f]/80 py-2">
            Are you sure you want to dismiss this payment of{' '}
            <strong className="text-[#3a1b1f]">KES {Number(dismissTarget?.amount ?? 0).toLocaleString()}</strong>?
            <span className="block mt-1.5 text-amber-700 font-medium text-xs">
              It will be permanently removed from the unmatched list.
            </span>
          </p>
          <DialogFooter className="flex gap-3 pt-3 border-t border-[#7a1f2b]/10">
            <Button variant="outline" onClick={() => setDismissTarget(null)}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button className="h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white border-0 active:scale-[0.98]"
              disabled={dismissUnmatched.isPending}
              onClick={() => { if (dismissTarget) dismissUnmatched.mutate(dismissTarget.id); }}>
              {dismissUnmatched.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dismissing…</>
                : 'Yes, Dismiss'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ Fee Form Dialog ══════════ */}
      <Dialog open={showFeeForm} onOpenChange={(open) => { setShowFeeForm(open); if (!open) { setSelectedFee(null); setFeeError(null); } }}>
        <DialogContent className="max-w-2xl max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={GRADIENT_BTN_STYLE}>
                <Wallet className="w-4 h-4 text-white" />
              </div>
              {selectedFee ? 'Update Fee Structure' : 'Create Fee Structure'}
            </DialogTitle>
          </DialogHeader>
          {feeError && (
            <div className="flex items-start gap-2 px-1 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 ml-1" /> {feeError}
            </div>
          )}
          <FeeStructureForm
            fee={selectedFee}
            onSave={(data: FeeFormData) => { setFeeError(null); feeMutation.mutate({ ...data, student_type: data.student_type, amount: Number(data.amount), academic_year: data.academic_year }); }}
            onCancel={() => { setShowFeeForm(false); setSelectedFee(null); setFeeError(null); }}
            isLoading={isFeeSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* ══════════ Payment Form Dialog ══════════ */}
      <Dialog open={showPaymentForm} onOpenChange={(open) => { setShowPaymentForm(open); if (!open) { setSelectedStudentFee(null); setPaymentError(null); } }}>
        <DialogContent className="max-w-2xl max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={GRADIENT_BTN_STYLE}>
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              Record Payment
            </DialogTitle>
          </DialogHeader>
          {paymentError && (
            <div className="flex items-start gap-2 px-1 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 ml-1" /> {paymentError}
            </div>
          )}
          {selectedStudentFee && (
            <PaymentEntryForm
              studentFee={selectedStudentFee}
              onSave={(data: PaymentFormData) => {
                setPaymentError(null);
                paymentMutation.mutate({
                  ...data,
                  student_id:    selectedStudentFee.student_id,
                  term:          selectedStudentFee.current_term_fee?.term || selectedStudentFee.term || (activeTerm ? termLabel(activeTerm) : 'Term 1'),
                  academic_year: selectedStudentFee.current_term_fee?.academic_year || selectedStudentFee.academic_year || activeTerm?.academic_year || '2024-2025',
                });
              }}
              onCancel={() => { setShowPaymentForm(false); setSelectedStudentFee(null); setPaymentError(null); }}
              isLoading={isPaymentSubmitting}
              availableCredit={selectedStudentFee.total_credit_carried || 0}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}