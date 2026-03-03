import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/Components/ui/dialog";
import { Badge } from "@/Components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Label } from "@/Components/ui/label";
import { 
  Search, Plus, Users, Wallet, TrendingUp, AlertCircle, 
  Settings, Receipt, RefreshCw, FileText, CreditCard,
  AlertTriangle, ArrowRightLeft, CheckCircle2, X, ChevronDown,
  Banknote, Calendar, Hash, StickyNote, Building2, User
} from "lucide-react";

import FeeStructureForm from "@/Components/Fees/FeeStructureForm";
import PaymentEntryForm from "@/Components/Fees/PaymentEntryForm";
import PaymentHistory from "@/Components/Fees/PaymentHistory";
import StudentFeeCard from "@/Components/Fees/StudentFeeCard";

import { supabase } from "@/lib/supabaseClient";

// Helper to normalize relation fields returned by Supabase
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnmatchedPayment {
  id: string;
  admission_number: string | null;
  amount: number | null;
  reference: string | null;
  bank_account: string | null;
  narration: string | null;
  recorded_at: string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminFeesDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedStudentType, setSelectedStudentType] = useState('all');
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [selectedStudentFee, setSelectedStudentFee] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('students');

  // ── Unmatched payment allocation state ──
  const [allocatingPayment, setAllocatingPayment]     = useState<UnmatchedPayment | null>(null);
  const [allocStudentSearch, setAllocStudentSearch]   = useState('');
  const [allocSelectedStudent, setAllocSelectedStudent] = useState<any>(null);
  const [allocSelectedFeeId, setAllocSelectedFeeId]   = useState('');
  const [allocPaymentMethod, setAllocPaymentMethod]   = useState('bank_transfer');
  const [allocNotes, setAllocNotes]                   = useState('');

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: allPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['allPayments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p_payments')
        .select('*')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: unmatchedPayments = [], isLoading: loadingUnmatched } = useQuery({
    queryKey: ['unmatchedPayments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unmatched_bank_payments')
        .select('*')
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as UnmatchedPayment[];
    }
  });

  const { data: studentFees = [], isLoading: loadingStudentFees } = useQuery({
    queryKey: ["studentFees"],
    queryFn: async () => {
      const { data: feesData, error: feesError } = await supabase
        .from("student_fees")
        .select("*")
        .order("inserted_at", { ascending: false });
      if (feesError) throw feesError;

      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`id, first_name, last_name, Reg_no, profiles!inner ( student_type )`);
      if (studentsError) throw studentsError;

      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select(`student_id, class_id, classes (id, name)`);
      if (enrollmentsError) throw enrollmentsError;

      const { data: feeStructures, error: feeStructureError } = await supabase
        .from("fee_structure")
        .select("id, term, academic_year");
      if (feeStructureError) throw feeStructureError;

      const studentMap = new Map();
      studentsData.forEach((student: any) => {
        const profile = firstRel(student.profiles);
        studentMap.set(student.id, { ...student, student_type: profile?.student_type || "Day Scholar" });
      });

      const enrollmentMap = new Map();
      enrollmentsData.forEach((enrollment: any) => {
        enrollmentMap.set(enrollment.student_id, enrollment);
      });

      const feeStructureMap = new Map();
      feeStructures?.forEach((fs: any) => { feeStructureMap.set(fs.id, fs); });

      const studentFeeMap = new Map();
      feesData.forEach((fee: any) => {
        const studentId = fee.student_id;
        if (!studentFeeMap.has(studentId)) {
          const student = studentMap.get(studentId);
          const enrollment = enrollmentMap.get(studentId);
          studentFeeMap.set(studentId, {
            id: studentId, student_id: studentId,
            student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
            admission_number: student?.Reg_no || "N/A",
            student_type: student?.student_type || "Day Scholar",
            display_type: student?.student_type || "Day Scholar",
            class_name: firstRel(enrollment?.classes)?.name || "Not Assigned",
            total_billed: 0, total_paid: 0, outstanding_balance: 0,
            total_credit_carried: 0, fee_records: [], last_payment_date: null,
            academic_years: new Set(), current_term_fee: null, payments: []
          });
        }

        const studentFee = studentFeeMap.get(studentId);
        const feeStructure = feeStructureMap.get(fee.fee_structure_id);
        const feeWithStructure = {
          ...fee,
          term: fee.term || feeStructure?.term,
          academic_year: fee.academic_year || feeStructure?.academic_year
        };

        studentFee.total_billed += Number(fee.total_billed) || 0;
        studentFee.total_paid   += Number(fee.total_paid)   || 0;
        studentFee.total_credit_carried += Number(fee.credit_carried) || 0;
        studentFee.fee_records.push(feeWithStructure);
        if (fee.academic_year) studentFee.academic_years.add(fee.academic_year);

        if (fee.last_payment_date) {
          const feeDate = new Date(fee.last_payment_date);
          if (!studentFee.last_payment_date || feeDate > new Date(studentFee.last_payment_date))
            studentFee.last_payment_date = fee.last_payment_date;
        }

        const currentTerm = `${fee.term || feeStructure?.term}-${fee.academic_year || feeStructure?.academic_year}`;
        if (!studentFee.current_term_fee || currentTerm > `${studentFee.current_term_fee.term}-${studentFee.current_term_fee.academic_year}`)
          studentFee.current_term_fee = feeWithStructure;
      });

      return Array.from(studentFeeMap.values()).map(student => {
        const effectiveOutstanding = Math.max(0, student.total_billed - student.total_paid);
        let status = "Pending";
        if (student.total_paid >= student.total_billed) status = "Paid";
        else if (student.total_paid > 0) status = "Partial";
        return {
          ...student,
          outstanding_balance: student.total_billed - student.total_paid,
          effective_outstanding: effectiveOutstanding,
          status,
          payments: allPayments.filter((p: any) => p.student_id === student.student_id),
          academic_years: Array.from(student.academic_years)
        };
      });
    },
    enabled: true,
  });

  const { data: fees = [], isLoading: loadingFees } = useQuery({
    queryKey: ['fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_structure')
        .select(`*, fee_structure_classes ( class_id, classes (id, name) )`)
        .order('inserted_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // All students (for allocation search)
  const { data: allStudents = [] } = useQuery({
    queryKey: ['allStudents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, Reg_no')
        .order('first_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fee records for the selected student in the allocation modal
  const { data: allocStudentFeeRecords = [] } = useQuery({
    queryKey: ['allocStudentFees', allocSelectedStudent?.id],
    queryFn: async () => {
      if (!allocSelectedStudent?.id) return [];
      const { data, error } = await supabase
        .from('student_fees')
        .select('*, fee_structure(name, term, academic_year)')
        .eq('student_id', allocSelectedStudent.id)
        .order('inserted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!allocSelectedStudent?.id,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const feeMutation = useMutation({
    mutationFn: async (data: any) => {
      const classes = data.classes || [];
      delete data.classes;
      const payload = { ...data, student_type: data.student_type, amount: Number(data.amount) };
      let feeId = selectedFee?.id;

      if (selectedFee) {
        const { error: feeError } = await supabase.from("fee_structure").update(payload).eq("id", feeId);
        if (feeError) throw feeError;
        const { error: delErr } = await supabase.from("fee_structure_classes").delete().eq("fee_structure_id", feeId);
        if (delErr) throw delErr;
        if (classes.length > 0) {
          const { error: classErr } = await supabase.from("fee_structure_classes").insert(classes.map((class_id: string) => ({ fee_structure_id: feeId, class_id })));
          if (classErr) throw classErr;
        }
      } else {
        const { data: inserted, error } = await supabase.from("fee_structure").insert(payload).select().single();
        if (error) throw error;
        feeId = inserted.id;
        if (classes.length > 0) {
          const { error: classErr } = await supabase.from("fee_structure_classes").insert(classes.map((class_id: string) => ({ fee_structure_id: feeId, class_id })));
          if (classErr) throw classErr;
        }
      }

      if (classes.length > 0) {
        const { data: enrollmentsWithStudents, error: enrollmentsError } = await supabase
          .from("enrollments")
          .select(`student_id, class_id, students ( id, first_name, last_name, Reg_no, profiles ( student_type ) )`)
          .in("class_id", classes);
        if (enrollmentsError) throw enrollmentsError;

        const matchingStudents = (enrollmentsWithStudents || []).filter((item: any) => {
          const student = firstRel(item.students);
          const profile = firstRel(student?.profiles);
          return profile?.student_type === payload.student_type;
        });

        const { data: existingFees = [], error: existingErr } = await supabase
          .from("student_fees").select("*")
          .in("student_id", matchingStudents.map((i: any) => i.student_id))
          .eq("fee_structure_id", feeId);
        if (existingErr) throw existingErr;

        const existingMap = new Map();
        existingFees.forEach((ef: any) => existingMap.set(ef.student_id, ef));

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const enrollment of matchingStudents) {
          const studentId = enrollment.student_id;
          const student = firstRel(enrollment.students);
          const existing = existingMap.get(studentId);

          const { data: studentPayments } = await supabase
            .from('p_payments').select('amount_paid, payment_date')
            .eq('student_id', studentId).eq('fee_id', feeId)
            .order('payment_date', { ascending: false });

          const existingPaid = studentPayments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0;

          const feePayload: any = {
            student_id: studentId, fee_structure_id: feeId,
            total_billed: payload.amount, total_paid: existingPaid,
            outstanding_balance: Math.max(0, payload.amount - existingPaid),
            status: existingPaid >= payload.amount ? "paid" : existingPaid > 0 ? "partial" : "pending",
            term: payload.term, academic_year: payload.academic_year,
            student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
            admission_number: student?.Reg_no || "N/A",
            last_payment_date: studentPayments && studentPayments.length > 0 ? studentPayments[0].payment_date : null,
          };

          if (existing) toUpdate.push({ id: existing.id, payload: feePayload });
          else toInsert.push(feePayload);
        }

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase.from("student_fees").insert(toInsert);
          if (insertErr) throw insertErr;
        }
        if (toUpdate.length > 0) {
          await Promise.all(toUpdate.map(async (u) => {
            const { error: updateErr } = await supabase.from("student_fees").update(u.payload).eq("id", u.id);
            if (updateErr) throw updateErr;
          }));
        }
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["studentFees"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      setShowFeeForm(false); setSelectedFee(null);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedStudentFee) throw new Error("No student fee record selected");
      const feeRecord = selectedStudentFee.current_term_fee || selectedStudentFee;
      const amount = parseFloat(data.amount) || 0;
      const { data: paymentInserted, error: paymentError } = await supabase
        .from("p_payments")
        .insert({
          student_id: feeRecord.student_id,
          fee_id: feeRecord.id || feeRecord.fee_structure_id,
          amount_paid: amount,
          payment_method: data.payment_method || "mpesa",
          payment_date: data.payment_date || new Date().toISOString(),
          transaction_reference: data.reference_number || null,
          status: "completed",
          academic_year: data.academic_year || feeRecord.academic_year || "2024-2025",
          term: data.term || feeRecord.term || "Term 1",
          reference_number: data.reference_number || null,
          notes: data.notes || null
        })
        .select().single();
      if (paymentError) throw paymentError;
      return paymentInserted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentFees"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      setShowPaymentForm(false); setSelectedStudentFee(null);
    },
  });

  // ── Allocate unmatched payment mutation ──
  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!allocatingPayment || !allocSelectedStudent || !allocSelectedFeeId)
        throw new Error("Please select a student and fee record");

      const feeRecord = allocStudentFeeRecords.find((f: any) => f.id === allocSelectedFeeId);
      if (!feeRecord) throw new Error("Fee record not found");

      // 1. Insert into p_payments
      const { error: paymentError } = await supabase
        .from("p_payments")
        .insert({
          student_id: allocSelectedStudent.id,
          fee_id: feeRecord.id,
          amount_paid: allocatingPayment.amount,
          payment_method: allocPaymentMethod,
          payment_date: allocatingPayment.recorded_at || new Date().toISOString(),
          transaction_reference: allocatingPayment.reference || null,
          reference_number: allocatingPayment.reference || null,
          status: "completed",
          academic_year: feeRecord.academic_year || feeRecord.fee_structure?.academic_year || "",
          term: feeRecord.term || feeRecord.fee_structure?.term || "",
          notes: allocNotes || `Allocated from unmatched payment. Bank: ${allocatingPayment.bank_account || '—'}. Narration: ${allocatingPayment.narration || '—'}`,
        });
      if (paymentError) throw paymentError;

      // 2. Remove from unmatched_payments
      const { error: deleteError } = await supabase
        .from('unmatched_bank_payments')
        .delete()
        .eq("id", allocatingPayment.id);
      if (deleteError) throw deleteError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmatchedPayments"] });
      queryClient.invalidateQueries({ queryKey: ["studentFees"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      closeAllocModal();
    },
    onError: (err: Error) => {
      alert(`Allocation failed: ${err.message}`);
    }
  });

  const deleteFee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_structure').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fees'] })
  });

  // ── Dismiss unmatched payment (remove without allocating) ──
  const dismissUnmatched = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('unmatched_bank_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unmatchedPayments'] }),
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const closeAllocModal = () => {
    setAllocatingPayment(null);
    setAllocStudentSearch('');
    setAllocSelectedStudent(null);
    setAllocSelectedFeeId('');
    setAllocPaymentMethod('bank_transfer');
    setAllocNotes('');
  };

  const filteredStudentFees = useMemo(() => {
    return (studentFees || []).filter((sf: any) => {
      const matchesSearch = !searchQuery ||
        (sf.student_name && sf.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sf.admission_number && sf.admission_number.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesYear   = selectedYear === 'all' || sf.academic_years?.includes(selectedYear);
      const matchesType   = selectedStudentType === 'all' ||
        (selectedStudentType === 'day' && sf.student_type === 'Day Scholar') ||
        (selectedStudentType === 'boarder' && sf.student_type === 'Boarding');
      return matchesSearch && matchesYear && matchesType;
    });
  }, [studentFees, searchQuery, selectedYear, selectedStudentType]);

  const stats = useMemo(() => {
    const filtered     = filteredStudentFees || [];
    const totalBilled  = filtered.reduce((s: number, sf: any) => s + Number(sf.total_billed ?? 0), 0);
    const totalCollected = filtered.reduce((s: number, sf: any) => s + Number(sf.total_paid ?? 0), 0);
    const totalOutstanding = filtered.reduce((s: number, sf: any) => s + Number(sf.outstanding_balance ?? 0), 0);
    const totalCreditCarried = filtered.reduce((s: number, sf: any) => s + Number(sf.total_credit_carried ?? 0), 0);
    return { totalStudents: filtered.length, totalBilled, totalCollected, totalOutstanding, totalCreditCarried };
  }, [filteredStudentFees]);

  // Allocation modal student search results
  const allocSearchResults = useMemo(() => {
    if (!allocStudentSearch.trim()) return [];
    const q = allocStudentSearch.toLowerCase();
    return allStudents.filter((s: any) =>
      `${s.first_name} ${s.last_name} ${s.Reg_no}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [allStudents, allocStudentSearch]);

  const handleRecordPayment = (studentFee: any) => { setSelectedStudentFee(studentFee); setShowPaymentForm(true); };
  const handleViewDetails   = (studentFee: any) => { setSelectedStudentFee(studentFee); setActiveTab('history'); };
  const handleEditFee = (fee: any) => {
    setSelectedFee({ ...fee, classes: fee.fee_structure_classes?.map((fsc: any) => fsc.class_id) || [] });
    setShowFeeForm(true);
  };

  const isAllocating = (allocateMutation as any).isPending || (allocateMutation as any).isLoading;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fee Management</h1>
            <p className="text-gray-500 mt-1">Manage student fees, payments, and fee structures</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["studentFees"] });
              queryClient.invalidateQueries({ queryKey: ["allPayments"] });
              queryClient.invalidateQueries({ queryKey: ["fees"] });
              queryClient.invalidateQueries({ queryKey: ["unmatchedPayments"] });
            }} className="border-gray-200">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => { setSelectedFee(null); setShowFeeForm(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Fee Type
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Students',  value: stats.totalStudents,                                icon: Users,         color: 'blue'    },
            { label: 'Total Billed',    value: `KES ${stats.totalBilled.toLocaleString()}`,        icon: FileText,      color: 'purple'  },
            { label: 'Total Collected', value: `KES ${stats.totalCollected.toLocaleString()}`,     icon: TrendingUp,    color: 'emerald' },
            { label: 'Outstanding',     value: `KES ${stats.totalOutstanding.toLocaleString()}`,   icon: AlertCircle,   color: 'red'     },
            { label: 'Credit Carried',  value: `KES ${stats.totalCreditCarried.toLocaleString()}`, icon: CreditCard,    color: 'amber'   },
          ].map((stat, i) => {
            const Icon = stat.icon;
            const colorMap: Record<string, string> = {
              blue: 'bg-blue-500',    'bg-blue-50':    'bg-blue-50',    'text-blue-600':    'text-blue-600',
              purple: 'bg-purple-500', emerald: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500'
            };
            const barColor    = { blue: 'bg-blue-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500' }[stat.color];
            const bgIconColor = { blue: 'bg-blue-50', purple: 'bg-purple-50', emerald: 'bg-emerald-50', red: 'bg-red-50', amber: 'bg-amber-50' }[stat.color];
            const txtColor    = { blue: 'text-blue-600', purple: 'text-purple-600', emerald: 'text-emerald-600', red: 'text-red-600', amber: 'text-amber-600' }[stat.color];
            return (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-shadow">
                <div className={`h-1 ${barColor}`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${bgIconColor}`}>
                      <Icon className={`w-5 h-5 ${txtColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-lg border-0 p-1.5 rounded-xl flex-wrap h-auto gap-1">
            <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" /> Student Fees
            </TabsTrigger>
            <TabsTrigger value="structure" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" /> Fee Structure
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Receipt className="w-4 h-4 mr-2" /> Payment History
            </TabsTrigger>
            <TabsTrigger value="unmatched" className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white relative">
              <AlertTriangle className="w-4 h-4 mr-2" /> Unmatched Payments
              {unmatchedPayments.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unmatchedPayments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* STUDENT FEES TAB */}
          <TabsContent value="students" className="space-y-6">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input placeholder="Search by name or admission number..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 border-gray-200" />
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full md:w-40 h-11 border-gray-200"><SelectValue placeholder="Academic Year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2024/2025">2024/2025</SelectItem>
                    <SelectItem value="2025/2026">2025/2026</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedStudentType} onValueChange={setSelectedStudentType}>
                  <SelectTrigger className="w-full md:w-40 h-11 border-gray-200"><SelectValue placeholder="Student Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="day">Day Scholars</SelectItem>
                    <SelectItem value="boarder">Boarders</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {loadingStudentFees ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => <Card key={i} className="border-0 shadow-lg animate-pulse"><CardContent className="p-5 h-64" /></Card>)}
              </div>
            ) : filteredStudentFees.length === 0 ? (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4"><Users className="w-8 h-8 text-gray-400" /></div>
                  <h3 className="font-semibold text-gray-900">No student fees found</h3>
                  <p className="text-gray-500 mt-1">Try adjusting your search or filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudentFees.map((studentFee: any) => (
                  <StudentFeeCard
                    key={studentFee.student_id}
                    studentFee={studentFee}
                    onRecordPayment={handleRecordPayment}
                    onViewDetails={handleViewDetails}
                    showAggregated={true}
                    paymentCount={studentFee.payments?.length || 0}
                    creditCarried={studentFee.total_credit_carried || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* FEE STRUCTURE TAB */}
          <TabsContent value="structure" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingFees ? (
                [1,2,3].map(i => <Card key={i} className="border-0 shadow-lg animate-pulse"><CardContent className="p-5 h-40" /></Card>)
              ) : fees.length === 0 ? (
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm col-span-full">
                  <CardContent className="p-12 text-center">
                    <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4"><Wallet className="w-8 h-8 text-gray-400" /></div>
                    <h3 className="font-semibold text-gray-900">No fee types defined</h3>
                    <p className="text-gray-500 mt-1">Add your first fee type to get started</p>
                    <Button onClick={() => setShowFeeForm(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4 mr-2" /> Add Fee Type
                    </Button>
                  </CardContent>
                </Card>
              ) : fees.map((fee: any) => (
                <Card key={fee.id} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all">
                  <div className={`h-1 ${fee.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{fee.name}</h3>
                        <p className="text-sm text-gray-500">{fee.term} • {fee.academic_year}</p>
                        <div className="text-xs text-gray-400 mt-1">Student Type: <Badge variant="outline" className="ml-1">{fee.student_type}</Badge></div>
                        {fee.fee_structure_classes?.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">Classes: {fee.fee_structure_classes.map((fsc: any) => fsc.classes?.name).join(', ')}</div>
                        )}
                      </div>
                      <Badge variant="outline" className={fee.category === 'Mandatory' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>{fee.category}</Badge>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-3">KES {Number(fee.amount ?? 0).toLocaleString()}</p>
                    {fee.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{fee.description}</p>}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditFee(fee)} className="flex-1">Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => deleteFee.mutate(fee.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* PAYMENT HISTORY TAB */}
          <TabsContent value="history">
            <PaymentHistory
              payments={selectedStudentFee ? (allPayments || []).filter((p: any) => p.student_id === selectedStudentFee.student_id) : (allPayments || [])}
              isLoading={loadingPayments}
              showStudentInfo={true}
            />
            {selectedStudentFee && (
              <Button variant="outline" onClick={() => setSelectedStudentFee(null)} className="mt-4">Show All Payments</Button>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════
              UNMATCHED PAYMENTS TAB
          ══════════════════════════════════════════ */}
          <TabsContent value="unmatched" className="space-y-4">

            {/* Intro banner */}
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-800 text-sm">Unmatched Bank Payments</p>
                <p className="text-orange-700 text-sm mt-0.5">
                  These payments arrived via bank transfer but could not be automatically linked to a student.
                  Review each one and allocate it to the correct student and fee record.
                </p>
              </div>
            </div>

            {loadingUnmatched ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Card key={i} className="border-0 shadow-sm animate-pulse"><CardContent className="h-28" /></Card>)}
              </div>
            ) : unmatchedPayments.length === 0 ? (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-emerald-50 w-fit mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900">All payments matched!</h3>
                  <p className="text-gray-500 mt-1">No unmatched bank payments at this time.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {unmatchedPayments.map((payment) => (
                  <Card key={payment.id} className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                        {/* Amount badge */}
                        <div className="flex-shrink-0">
                          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex flex-col items-center justify-center">
                            <Banknote className="w-5 h-5 text-orange-500 mb-0.5" />
                            <span className="text-xs font-bold text-orange-700">KES</span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
                          <DetailRow icon={<Banknote className="w-3.5 h-3.5" />}   label="Amount"     value={`KES ${Number(payment.amount ?? 0).toLocaleString()}`} highlight />
                          <DetailRow icon={<Hash className="w-3.5 h-3.5" />}       label="Reference"  value={payment.reference  || '—'} />
                          <DetailRow icon={<User className="w-3.5 h-3.5" />}       label="Adm. No."   value={payment.admission_number || '—'} />
                          <DetailRow icon={<Building2 className="w-3.5 h-3.5" />}  label="Bank Acc."  value={payment.bank_account  || '—'} />
                          <DetailRow icon={<StickyNote className="w-3.5 h-3.5" />} label="Narration"  value={payment.narration || '—'} />
                          <DetailRow icon={<Calendar className="w-3.5 h-3.5" />}   label="Recorded"   value={payment.recorded_at ? new Date(payment.recorded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                        </div>

                        {/* Actions */}
                        <div className="flex sm:flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none"
                            onClick={() => {
                              setAllocatingPayment(payment);
                              // Pre-fill search if we have an admission number
                              if (payment.admission_number) setAllocStudentSearch(payment.admission_number);
                            }}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Allocate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 border-red-200 hover:bg-red-50 flex-1 sm:flex-none"
                            onClick={() => {
                              if (window.confirm('Dismiss this payment? It will be permanently removed from the unmatched list.'))
                                dismissUnmatched.mutate(payment.id);
                            }}
                          >
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
      </div>

      {/* ════════════════════════════════════════════════
          ALLOCATE PAYMENT MODAL
      ════════════════════════════════════════════════ */}
      <Dialog open={!!allocatingPayment} onOpenChange={open => { if (!open) closeAllocModal(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
              Allocate Payment to Student
            </DialogTitle>
          </DialogHeader>

          {allocatingPayment && (
            <div className="space-y-5">

              {/* Payment summary */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-orange-600 font-medium">Amount</p>
                  <p className="font-bold text-orange-900 text-lg">KES {Number(allocatingPayment.amount ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-orange-600 font-medium">Reference</p>
                  <p className="text-sm font-medium text-orange-900">{allocatingPayment.reference || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-orange-600 font-medium">Bank Account</p>
                  <p className="text-sm font-medium text-orange-900">{allocatingPayment.bank_account || '—'}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-orange-600 font-medium">Narration</p>
                  <p className="text-sm text-orange-900">{allocatingPayment.narration || '—'}</p>
                </div>
              </div>

              {/* Step 1: Find student */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">1</span>
                  Find Student
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or admission number..."
                    value={allocStudentSearch}
                    onChange={e => { setAllocStudentSearch(e.target.value); setAllocSelectedStudent(null); setAllocSelectedFeeId(''); }}
                    className="pl-9 h-10"
                  />
                </div>

                {/* Search results dropdown */}
                {allocSearchResults.length > 0 && !allocSelectedStudent && (
                  <div className="border rounded-lg divide-y shadow-sm bg-white max-h-48 overflow-y-auto">
                    {allocSearchResults.map((s: any) => (
                      <button
                        key={s.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-3"
                        onClick={() => { setAllocSelectedStudent(s); setAllocStudentSearch(`${s.first_name} ${s.last_name} (${s.Reg_no})`); setAllocSelectedFeeId(''); }}
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{s.first_name} {s.last_name}</div>
                          <div className="text-xs text-gray-500">{s.Reg_no}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {allocSelectedStudent && (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                      {allocSelectedStudent.first_name[0]}{allocSelectedStudent.last_name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{allocSelectedStudent.first_name} {allocSelectedStudent.last_name}</div>
                      <div className="text-xs text-gray-500">{allocSelectedStudent.Reg_no}</div>
                    </div>
                    <button className="text-gray-400 hover:text-red-500" onClick={() => { setAllocSelectedStudent(null); setAllocStudentSearch(''); setAllocSelectedFeeId(''); }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Select fee record */}
              {allocSelectedStudent && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">2</span>
                    Select Fee Record
                  </Label>
                  {allocStudentFeeRecords.length === 0 ? (
                    <p className="text-sm text-gray-500 italic px-1">No fee records found for this student.</p>
                  ) : (
                    <div className="space-y-2">
                      {allocStudentFeeRecords.map((fee: any) => {
                        const isSelected = allocSelectedFeeId === fee.id;
                        const outstanding = Math.max(0, (fee.total_billed || 0) - (fee.total_paid || 0));
                        const feeName = fee.fee_structure?.name || 'Fee';
                        const term    = fee.term || fee.fee_structure?.term || '';
                        const year    = fee.academic_year || fee.fee_structure?.academic_year || '';
                        return (
                          <button
                            key={fee.id}
                            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300 bg-white'}`}
                            onClick={() => setAllocSelectedFeeId(fee.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">{feeName}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{term}{term && year ? ' • ' : ''}{year}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">Outstanding</div>
                                <div className={`font-bold text-sm ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  KES {outstanding.toLocaleString()}
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-3 flex-shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Payment method + notes */}
              {allocSelectedFeeId && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">3</span>
                    Confirm Details
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Payment Method</Label>
                      <Select value={allocPaymentMethod} onValueChange={setAllocPaymentMethod}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
                      <Label className="text-xs text-gray-500">Notes (optional)</Label>
                      <Input
                        placeholder="Any additional notes..."
                        value={allocNotes}
                        onChange={e => setAllocNotes(e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={closeAllocModal} className="h-10">Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-10"
              disabled={!allocSelectedStudent || !allocSelectedFeeId || isAllocating}
              onClick={() => allocateMutation.mutate()}
            >
              {isAllocating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Allocating...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Allocation</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Form Dialog */}
      <Dialog open={showFeeForm} onOpenChange={setShowFeeForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedFee ? "Update Fee Structure" : "Create Fee Structure"}</DialogTitle></DialogHeader>
          <FeeStructureForm
            fee={selectedFee}
            onSave={(data: any) => feeMutation.mutate({ ...data, student_type: data.student_type, amount: Number(data.amount), academic_year: data.academic_year })}
            onCancel={() => { setShowFeeForm(false); setSelectedFee(null); }}
            isLoading={(feeMutation as any).isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Form Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {selectedStudentFee && (
            <PaymentEntryForm
              studentFee={selectedStudentFee}
              onSave={(data: any) => paymentMutation.mutate({
                ...data,
                student_id: selectedStudentFee.student_id,
                term: selectedStudentFee.current_term_fee?.term || selectedStudentFee.term || "Term 1",
                academic_year: selectedStudentFee.current_term_fee?.academic_year || selectedStudentFee.academic_year || "2024-2025"
              })}
              onCancel={() => { setShowPaymentForm(false); setSelectedStudentFee(null); }}
              isLoading={(paymentMutation as any).isLoading}
              availableCredit={selectedStudentFee.total_credit_carried || 0}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

function DetailRow({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-gray-400">{label}</div>
        <div className={`text-sm font-medium ${highlight ? 'text-emerald-700' : 'text-gray-800'}`}>{value}</div>
      </div>
    </div>
  );
}