"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import {
  GraduationCap, Calendar, Clock, AlertTriangle,
  CheckCircle, Receipt, Building2, FileText,
  X, DollarSign, CreditCard, ChevronDown, ChevronUp,
  Info, Smartphone, WifiOff, RefreshCw,
} from "lucide-react";

import FeeBalanceOverview from "@/Components/Fees/FeeBalanceOverview";
import PaymentHistory from "@/Components/Fees/PaymentHistory";
import BankDetailsCard from "@/Components/Fees/BankDetailsCard";
import FeeBreakdownCard from "@/Components/Fees/FeeBreakdownCard";
import TermHistoryCard from "@/Components/Fees/TermHistoryCard";
import MpesaPaymentModal from "@/Components/Fees/MpesaPaymentModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const STALE_TIME_MS = 5 * 60 * 1000;
const PAYMENTS_PAGE_LIMIT = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  Reg_no?: string;
}

interface StudentFee {
  id: string;
  student_id: string;
  term: string;
  academic_year: string;
  fee_structure_id?: string;
  total_billed?: number;
  total_paid?: number;
  outstanding_balance?: number;
  credit_carried?: number;
  status?: string;
}

interface Payment {
  id: string;
  student_id: string;
  term: string;
  academic_year: string;
  amount_paid: number;
  payment_date: string;
  [key: string]: unknown;
}

interface FeeItem {
  id: string;
  name: string;
  amount: number;
  category: 'Mandatory' | 'Optional';
  description: string;
  term?: string;
  academic_year?: string;
}

interface TermOption {
  term: string;
  year: string;
  label: string;
}

interface StudentFeesDialogProps {
  onClose: () => void;
  studentData: Student;
  classId: string;
  className: string;
  isMobileTab: boolean;
  currentTerm?: { term: string; academic_year: string } | null;
}

// ─── Status config ────────────────────────────────────────────────────────────

type FeeStatus = 'paid' | 'partial' | 'pending' | 'overpaid';

const STATUS_CONFIG: Record<FeeStatus, {
  color: string;
  icon: React.ElementType;
  message: string;
}> = {
  paid:     { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle,   message: 'All Fees cleared!' },
  partial:  { color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Clock,         message: 'Partial payment made' },
  pending:  { color: 'bg-red-50 text-red-700 border-red-200',             icon: AlertTriangle, message: 'Payment pending' },
  overpaid: { color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: CheckCircle,   message: 'Overpayment recorded' },
};

const DEFAULT_STATUS = STATUS_CONFIG.pending;

function getStatusConfig(status?: string) {
  if (!status) return DEFAULT_STATUS;
  return STATUS_CONFIG[status.toLowerCase() as FeeStatus] ?? DEFAULT_STATUS;
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function QueryErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-medium transition-colors active:scale-95"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentFeesDialog({
  onClose,
  studentData,
  classId,
  className,
  isMobileTab,
  currentTerm,
}: StudentFeesDialogProps) {

  const [currentUser, setCurrentUser]           = useState<{ id: string } | null>(null);
  const [selectedTerm, setSelectedTerm]         = useState('Term 1');
  const [selectedYear, setSelectedYear]         = useState('2024-2025');
  const [student, setStudent]                   = useState<Student>(studentData);
  const [showSummaryCards, setShowSummaryCards] = useState(true);
  const [showMpesaModal, setShowMpesaModal]     = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) { console.error("Error fetching auth user:", error); return; }
      setCurrentUser(data?.user ? { id: data.user.id } : null);
    };
    fetchUser();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setStudent(studentData); }, [studentData]);

  // ── Queries ───────────────────────────────────────────────────────────────

  const {
    data: allStudentFees = [],
    isLoading: loadingFees,
    isError: feesError,
    refetch: refetchFees,
  } = useQuery<StudentFee[]>({
    queryKey: ['allStudentFees', student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', student.id)
        .order('academic_year', { ascending: false })
        .order('term', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!student?.id,
    staleTime: STALE_TIME_MS,
    retry: 2,
  });

  const {
    data: payments = [],
    isLoading: loadingPayments,
    isError: paymentsError,
    refetch: refetchPayments,
  } = useQuery<Payment[]>({
    queryKey: ['payments', student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase
        .from('p_payments')
        .select('*')
        .eq('student_id', student.id)
        .order('payment_date', { ascending: false })
        .limit(PAYMENTS_PAGE_LIMIT);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!student?.id,
    staleTime: STALE_TIME_MS,
    retry: 2,
  });

  // ── Derived / memoised state ──────────────────────────────────────────────

  const studentFee = useMemo(
    () => allStudentFees.find(sf => sf.term === selectedTerm && sf.academic_year === selectedYear),
    [allStudentFees, selectedTerm, selectedYear]
  );

  const termOptions = useMemo<TermOption[]>(
    () => allStudentFees.map(sf => ({
      term:  sf.term,
      year:  sf.academic_year,
      label: `${sf.term} • ${sf.academic_year}`,
    })),
    [allStudentFees]
  );

  useEffect(() => {
    if (termOptions.length > 0 && !studentFee) {
      if (currentTerm) {
        const matchingOption = termOptions.find(
          opt => opt.term === currentTerm.term && opt.year === currentTerm.academic_year
        );
        if (matchingOption) {
          setSelectedTerm(matchingOption.term);
          setSelectedYear(matchingOption.year);
          return;
        }
      }
      const mostRecent = termOptions[0];
      setSelectedTerm(mostRecent.term);
      setSelectedYear(mostRecent.year);
    }
  }, [termOptions, studentFee, currentTerm]);

  const {
    data: allTermFeeItems = [],
    isLoading: loadingFeeItems,
    isError: feeItemsError,
    refetch: refetchFeeItems,
  } = useQuery<FeeItem[]>({
    queryKey: ['allTermFeeItems', student?.id, selectedYear],
    queryFn: async () => {
      if (!student?.id) return [];

      const feesInYear = allStudentFees.filter(sf => sf.academic_year === selectedYear);
      if (feesInYear.length === 0) return [];

      const structureIds = feesInYear
        .map(sf => sf.fee_structure_id)
        .filter(Boolean) as string[];

      if (structureIds.length === 0) return [];

      const { data: structures, error } = await supabase
        .from('fee_structure')
        .select('*')
        .in('id', structureIds);

      if (error) throw error;
      if (!structures) return [];

      return feesInYear.flatMap(sf => {
        const structure = structures.find(s => s.id === sf.fee_structure_id);
        if (!structure) return [];
        return [{
          id:           structure.id + '-' + sf.term,
          name:         structure.name,
          amount:       structure.amount,
          category:     (structure.category ?? 'Mandatory') as 'Mandatory' | 'Optional',
          description:  structure.description ?? '',
          term:         sf.term,
          academic_year: sf.academic_year,
        }];
      });
    },
    enabled: !!student?.id && !!selectedYear && allStudentFees.length > 0,
    staleTime: STALE_TIME_MS,
    retry: 2,
  });

  const combinedOutstandingBalance = useMemo(() => {
    const feesInYear = allStudentFees.filter(sf => sf.academic_year === selectedYear);
    return feesInYear.reduce((sum, sf) => sum + (sf.outstanding_balance ?? 0), 0);
  }, [allStudentFees, selectedYear]);

  const combinedTotalBilled = useMemo(() => {
    return allStudentFees
      .filter(sf => sf.academic_year === selectedYear)
      .reduce((sum, sf) => sum + (sf.total_billed ?? 0), 0);
  }, [allStudentFees, selectedYear]);

  const combinedTotalPaid = useMemo(() => {
    return allStudentFees
      .filter(sf => sf.academic_year === selectedYear)
      .reduce((sum, sf) => sum + (sf.total_paid ?? 0), 0);
  }, [allStudentFees, selectedYear]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectTerm  = useCallback((term: string, year: string) => {
    setSelectedTerm(term);
    setSelectedYear(year);
  }, []);

  const handleClose = useCallback(() => {
    const container = document.querySelector('.Fees-dialog-container');
    if (container) container.classList.add('animate-pop-out');
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleOpenMpesa  = useCallback(() => setShowMpesaModal(true),  []);
  const handleCloseMpesa = useCallback(() => setShowMpesaModal(false), []);

  // ── Derived values ────────────────────────────────────────────────────────

  const mappedPayments = useMemo(
    () => payments
      .filter(p => p.academic_year === selectedYear)
      .map(p => ({ ...p, amount: p.amount_paid })),
    [payments, selectedYear]
  );

  const totalPaid          = studentFee?.total_paid          ?? 0;
  const outstandingBalance = studentFee?.outstanding_balance ?? 0;
  const creditCarried      = studentFee?.credit_carried      ?? 0;
  const statusConfig       = getStatusConfig(studentFee?.status);

  const mandatoryFees = useMemo(() => allTermFeeItems.filter(f => f.category === 'Mandatory'), [allTermFeeItems]);
  const optionalFees  = useMemo(() => allTermFeeItems.filter(f => f.category === 'Optional'),  [allTermFeeItems]);

  // ── Auth loading gate ─────────────────────────────────────────────────────

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon mb-4" />
        <p className="text-gray-600">Loading your fee statement...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .fees-safe-scroll {
          padding-bottom: env(safe-area-inset-bottom, 0px);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          -webkit-overflow-scrolling: touch;
        }
        .fees-header-safe {
          padding-top: env(safe-area-inset-top, 0px);
        }
        @media (hover: none) {
          .fees-no-hover-shadow:hover { box-shadow: none !important; }
        }
      `}</style>

      <div className="Fees-dialog-container animate-pop-in bg-white flex flex-col h-[90vh] md:h-[85vh] lg:h-[80vh] w-full max-w-7xl mx-auto rounded-none md:rounded-2xl shadow-none md:shadow-2xl overflow-hidden select-none">

        {/* ===== Premium gradient header ===== */}
        <div
          className="fees-header-safe relative overflow-hidden flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)" }}
        >
          <div
            className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full opacity-60"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
          />

          <div className="relative px-4 sm:px-6 py-3.5 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.12] backdrop-blur-sm sm:h-11 sm:w-11">
                  <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                    Fee Statement
                  </h2>
                  <p className="text-white/55 text-[11px] sm:text-xs truncate">
                    {student ? `${student.first_name} ${student.last_name}` : 'Loading...'}
                    {' '}· {student?.Reg_no ?? 'N/A'} · {className ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {studentFee && (
                  <span
                    className={`${statusConfig.color} hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full border backdrop-blur-sm`}
                  >
                    {React.createElement(statusConfig.icon, { className: "w-3 h-3" })}
                    {statusConfig.message}
                  </span>
                )}
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                  aria-label="Close fee statement"
                >
                  <X className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-white" />
                </button>
              </div>
            </div>

            {/* Quick stat chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
                <Calendar className="h-3 w-3 opacity-75" />
                {selectedTerm} · {selectedYear}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
                <Receipt className="h-3 w-3 opacity-75" />
                {mappedPayments.length} payment{mappedPayments.length !== 1 ? 's' : ''}
                {payments.length === PAYMENTS_PAGE_LIMIT && ' (latest 50)'}
              </span>
              {combinedOutstandingBalance > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-100 backdrop-blur-sm">
                  <DollarSign className="h-3 w-3" />
                  KES {combinedOutstandingBalance.toLocaleString()} due
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[#fdfbfb]">
          <div className="fees-safe-scroll h-full overflow-y-auto p-3 sm:p-4 md:p-6">

            {feesError && (
              <QueryErrorBanner
                message="Could not load fee records. Check your connection and try again."
                onRetry={refetchFees}
              />
            )}
            {paymentsError && (
              <QueryErrorBanner
                message="Could not load payment history."
                onRetry={refetchPayments}
              />
            )}

            {/* ===== Current Term Banner (refined) ===== */}
            <div
              className="relative overflow-hidden rounded-2xl mb-3 sm:mb-4 border border-maroon/10"
              style={{
                background: "linear-gradient(135deg, rgba(122,31,43,0.06) 0%, rgba(122,31,43,0.02) 100%)",
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-maroon/10">
                    <Calendar className="w-4 h-4 text-maroon" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] sm:text-sm font-bold tracking-tight text-maroon truncate">
                      Viewing: {selectedTerm} · {selectedYear}
                    </p>
                    {mappedPayments.length > 0 && (
                      <p className="text-[11px] text-gray-500 truncate">
                        {mappedPayments.length} payment{mappedPayments.length !== 1 ? 's' : ''} recorded
                        {payments.length === PAYMENTS_PAGE_LIMIT && ' (showing latest 50)'}
                      </p>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-maroon/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-maroon border border-maroon/15">
                  {studentFee?.status ?? 'No Fee Record'}
                </span>
              </div>
            </div>

            {/* ===== Pay with M-Pesa — premium CTA ===== */}
            {combinedOutstandingBalance > 0 && (
  <button
    onClick={handleOpenMpesa}
    className="relative overflow-hidden w-full mb-4 flex items-center gap-3 py-3.5 px-5 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.99] transition-all duration-200 text-sm sm:text-base"
    style={{ background: "linear-gradient(135deg, #16a34a 0%, #059669 55%, #047857 100%)" }}
  >
    <span
      className="pointer-events-none absolute -top-10 -right-6 h-28 w-28 rounded-full opacity-60"
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 65%)" }}
    />
    <span
      className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full opacity-50"
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)" }}
    />
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.15] backdrop-blur-sm">
      <Smartphone className="w-4.5 h-4.5" />
    </span>
    <span className="relative flex-1 text-left">Pay with M-Pesa</span>
    <span className="relative bg-white/20 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-white/20 backdrop-blur-sm">
      KES {combinedOutstandingBalance.toLocaleString()} due
    </span>
  </button>
)}

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
              <div className="relative">
                <TabsList className="bg-maroon/[0.06] border-0 p-1 rounded-xl w-full overflow-x-auto flex-nowrap sm:flex-wrap">
                  <TabsTrigger value="overview" className="flex-1 min-w-[80px] sm:min-w-0 rounded-lg data-[state=active]:bg-maroon data-[state=active]:text-white text-maroon/70 hover:text-maroon text-xs sm:text-sm px-3 py-2 font-semibold transition-all">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="fees" className="flex-1 min-w-[80px] sm:min-w-0 rounded-lg data-[state=active]:bg-maroon data-[state=active]:text-white text-maroon/70 hover:text-maroon text-xs sm:text-sm px-3 py-2 font-semibold transition-all">
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline-block" />
                    <span className="hidden sm:inline">Fee</span> Breakdown
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="flex-1 min-w-[80px] sm:min-w-0 rounded-lg data-[state=active]:bg-maroon data-[state=active]:text-white text-maroon/70 hover:text-maroon text-xs sm:text-sm px-3 py-2 font-semibold transition-all">
                    <Receipt className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline-block" />
                    Payments
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="flex-1 min-w-[80px] sm:min-w-0 rounded-lg data-[state=active]:bg-maroon data-[state=active]:text-white text-maroon/70 hover:text-maroon text-xs sm:text-sm px-3 py-2 font-semibold transition-all">
                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline-block" />
                    Bank
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="lg:col-span-2">
                    <FeeBalanceOverview
                      studentFee={studentFee}
                      allStudentFees={allStudentFees.filter(sf => sf.academic_year === selectedYear)}
                      combinedTotalBilled={combinedTotalBilled}
                      combinedTotalPaid={combinedTotalPaid}
                      combinedOutstandingBalance={combinedOutstandingBalance}
                      isLoading={loadingFees}
                      currentTerm={currentTerm}
                    />
                  </div>
                  <div>
                    <TermHistoryCard
                      studentFees={allStudentFees}
                      onSelectTerm={handleSelectTerm}
                      selectedTerm={selectedTerm}
                      selectedYear={selectedYear}
                      isLoading={loadingFees}
                      currentTerm={currentTerm}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fees" className="space-y-4 sm:space-y-6">
                {feeItemsError ? (
                  <QueryErrorBanner
                    message="Could not load fee structure for this term."
                    onRetry={refetchFeeItems}
                  />
                ) : loadingFeeItems ? (
                  <div className="flex justify-center items-center h-32 sm:h-48">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-maroon" />
                  </div>
                ) : allTermFeeItems.length === 0 ? (
                  <Card className="border border-maroon/10 rounded-2xl shadow-none">
                    <CardContent className="p-6 sm:p-8 lg:p-12 text-center">
                      <div className="p-3 sm:p-4 rounded-full bg-maroon/[0.05] w-fit mx-auto mb-3 sm:mb-4">
                        <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-maroon/50" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg">No fee items found</h3>
                      <p className="text-gray-500 mt-1 text-xs sm:text-sm lg:text-base">Fee structure not yet defined for this term</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <FeeBreakdownCard
                      fees={mandatoryFees}
                      title="Mandatory Fees"
                      type="Mandatory"
                      totalLabel="Total Mandatory"
                      allStudentFees={allStudentFees.filter(sf => sf.academic_year === selectedYear)}
                      currentTerm={currentTerm}
                    />
                    <FeeBreakdownCard
                      fees={optionalFees}
                      title="Optional Fees"
                      type="Optional"
                      totalLabel="Total Optional"
                      allStudentFees={allStudentFees.filter(sf => sf.academic_year === selectedYear)}
                      currentTerm={currentTerm}
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="payments">
                <PaymentHistory
                  payments={mappedPayments}
                  isLoading={loadingPayments}
                  showStudentInfo={false}
                  selectedTerm={selectedTerm}
                  selectedYear={selectedYear}
                  currentTerm={currentTerm}
                />
              </TabsContent>

              <TabsContent value="bank">
                <BankDetailsCard />
              </TabsContent>
            </Tabs>

            {/* Summary Cards */}
            <div className="mb-4 sm:mb-6">
              <div className="sm:hidden mb-2">
                <button
                  onClick={() => setShowSummaryCards(prev => !prev)}
                  className="flex items-center justify-between w-full p-3 bg-white rounded-xl border border-maroon/10 active:bg-maroon/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon/10">
                      <DollarSign className="w-3.5 h-3.5 text-maroon" />
                    </span>
                    <span className="text-sm font-semibold text-maroon">Financial Summary</span>
                    <span className="ml-1 rounded-full bg-maroon/[0.08] px-2 py-0.5 text-[10px] font-semibold text-maroon">
                      4 items
                    </span>
                  </div>
                  {showSummaryCards
                    ? <ChevronUp   className="w-4 h-4 text-maroon/60" />
                    : <ChevronDown className="w-4 h-4 text-maroon/60" />
                  }
                </button>
              </div>

              <div className={`${showSummaryCards ? 'block' : 'hidden'} sm:block`}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

                  <Card className="fees-no-hover-shadow border border-maroon/10 rounded-2xl shadow-none hover:shadow-[0_8px_24px_-16px_rgba(122,31,43,0.28)] transition-shadow overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Total Billed</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 truncate tracking-tight">
                            KES {combinedTotalBilled.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">{selectedYear}</p>
                        </div>
                        <div className="p-2 bg-maroon/[0.06] rounded-xl flex-shrink-0 ml-2">
                          <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-maroon" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="fees-no-hover-shadow border border-maroon/10 rounded-2xl shadow-none hover:shadow-[0_8px_24px_-16px_rgba(122,31,43,0.28)] transition-shadow overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Total Paid</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 truncate tracking-tight">
                            KES {combinedTotalPaid.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">{selectedYear}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-xl flex-shrink-0 ml-2">
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="fees-no-hover-shadow border border-maroon/10 rounded-2xl shadow-none hover:shadow-[0_8px_24px_-16px_rgba(122,31,43,0.28)] transition-shadow overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Balance Due</p>
                          <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${combinedOutstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'} truncate tracking-tight`}>
                            KES {combinedOutstandingBalance.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">All terms</p>
                        </div>
                        <div className="p-2 bg-amber-50 rounded-xl flex-shrink-0 ml-2">
                          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="fees-no-hover-shadow border border-maroon/10 rounded-2xl shadow-none hover:shadow-[0_8px_24px_-16px_rgba(122,31,43,0.28)] transition-shadow overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Credit</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 truncate tracking-tight">
                            KES {creditCarried.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-xl flex-shrink-0 ml-2">
                          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                      </div>
                      {creditCarried > 0 && (
                        <p className="text-[11px] text-blue-600 mt-2">Applied to future terms automatically</p>
                      )}
                    </CardContent>
                  </Card>

                </div>
              </div>
            </div>

            {/* Credit System Info */}
            <Card className="fees-no-hover-shadow border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-2xl shadow-none">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex-shrink-0">
                    <Info className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h4 className="text-sm sm:text-base font-semibold text-blue-800">Credit System Information</h4>
                      <Badge variant="outline" className="bg-white/80 text-blue-700 border-blue-300 text-xs px-3 py-1 w-fit">
                        Automatic Application
                      </Badge>
                    </div>
                    <p className="text-sm text-blue-700 mb-3">
                      Any overpayment in the current term is automatically stored as credit and applied to the next term's fees.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-blue-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span>Outstanding balance is the amount still due</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>Credit is automatically applied to future terms</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {showMpesaModal && (
  <MpesaPaymentModal
    onClose={handleCloseMpesa}
    student={student}
    className={className}
    outstandingBalance={combinedOutstandingBalance}
    selectedTerm={selectedTerm}
    selectedYear={selectedYear}
    studentFeeId={studentFee?.id ?? null}
    currentTerm={currentTerm}
  />
)}
    </>
  );
}