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
  currentTerm?: { term: string; academic_year: string } | null; // NEW: active term from parent
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
  currentTerm, // NEW
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

  // Auto‑select term: try currentTerm first, then most recent
  useEffect(() => {
    if (termOptions.length > 0 && !studentFee) {
      // If currentTerm is provided and matches an option, select it
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
      // Otherwise fall back to the most recent term
      const mostRecent = termOptions[0];
      setSelectedTerm(mostRecent.term);
      setSelectedYear(mostRecent.year);
    }
  }, [termOptions, studentFee, currentTerm]);

  // ── Fee items: fetch ALL terms in the selected academic year ──────────────
  // We fetch fee structure items for every term record in the selected year
  // so FeeBreakdownCard can show a full picture including arrears from prior terms.
  const {
    data: allTermFeeItems = [],
    isLoading: loadingFeeItems,
    isError: feeItemsError,
    refetch: refetchFeeItems,
  } = useQuery<FeeItem[]>({
    queryKey: ['allTermFeeItems', student?.id, selectedYear],
    queryFn: async () => {
      if (!student?.id) return [];

      // Get all fee records for this student in the selected academic year
      const feesInYear = allStudentFees.filter(sf => sf.academic_year === selectedYear);
      if (feesInYear.length === 0) return [];

      const structureIds = feesInYear
        .map(sf => sf.fee_structure_id)
        .filter(Boolean) as string[];

      if (structureIds.length === 0) return [];

      // Fetch all fee structures at once
      const { data: structures, error } = await supabase
        .from('fee_structure')
        .select('*')
        .in('id', structureIds);

      if (error) throw error;
      if (!structures) return [];

      // Map each structure back to its term so FeeBreakdownCard can group them
      return feesInYear.flatMap(sf => {
        const structure = structures.find(s => s.id === sf.fee_structure_id);
        if (!structure) return [];
        return [{
          id:           structure.id + '-' + sf.term, // unique key per term
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

  // ── Combined outstanding balance across ALL terms in the selected year ────
  // This is what the student actually owes, not just the current term.
  const combinedOutstandingBalance = useMemo(() => {
    const feesInYear = allStudentFees.filter(sf => sf.academic_year === selectedYear);
    return feesInYear.reduce((sum, sf) => sum + (sf.outstanding_balance ?? 0), 0);
  }, [allStudentFees, selectedYear]);

  // Summary cards still show the selected term in isolation so the parent can
  // see per-term details, but the M-Pesa button and balance overview use the
  // combined figure so the parent knows the true amount owed.
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

  // Pass ALL payments for the selected academic year to PaymentHistory.
  // PaymentHistory groups them by term internally — filtering to selectedTerm
  // here would hide cross-term payments and show 0 results.
  const mappedPayments = useMemo(
    () => payments
      .filter(p => p.academic_year === selectedYear)
      .map(p => ({ ...p, amount: p.amount_paid })),
    [payments, selectedYear]
  );

  // Per-term values for the summary cards at the bottom (selected term only)
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600 mb-4" />
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

      <div className="Fees-dialog-container animate-pop-in bg-white flex flex-col h-[90vh] md:h-[85vh] lg:h-[80vh] w-full max-w-7xl mx-auto rounded-none md:rounded-xl shadow-none md:shadow-2xl overflow-hidden select-none">

        {/* Header */}
        <div className="fees-header-safe sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm flex-shrink-0">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Fee Statement</h2>
                <p className="text-gray-500 text-xs sm:text-sm truncate">
                  {student ? `${student.first_name} ${student.last_name}` : 'Loading...'}
                  {' '}• {student?.Reg_no ?? 'N/A'} • {className ?? 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {studentFee && (
                <Badge
                  variant="outline"
                  className={`${statusConfig.color} hidden sm:flex px-3 py-1.5 text-xs font-medium`}
                >
                  {React.createElement(statusConfig.icon, { className: "w-3 h-3 mr-1 inline-block" })}
                  {statusConfig.message}
                </Badge>
              )}
              <button
                onClick={handleClose}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Close fee statement"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
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

            {/* Current Term Banner */}
            <Card className="border-0 shadow-md sm:shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-3 sm:mb-4">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-sm sm:text-base truncate">
                        Viewing: {selectedTerm} • {selectedYear}
                      </span>
                      {mappedPayments.length > 0 && (
                        <p className="text-xs sm:text-sm text-white/80 truncate">
                          {mappedPayments.length} payment{mappedPayments.length !== 1 ? 's' : ''} recorded
                          {payments.length === PAYMENTS_PAGE_LIMIT && ' (showing latest 50)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-white/30 text-xs py-1">
                      {studentFee?.status ?? 'No Fee Record'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pay with M-Pesa — uses combined balance so parent sees true amount owed */}
            {combinedOutstandingBalance > 0 && (
              <button
                onClick={handleOpenMpesa}
                className="w-full mb-4 flex items-center justify-center gap-3 py-3.5 px-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all duration-200 text-sm sm:text-base"
              >
                <Smartphone className="w-5 h-5" />
                Pay with M-Pesa
                <span className="ml-auto bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  KES {combinedOutstandingBalance.toLocaleString()} due
                </span>
              </button>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
              <div className="relative">
                <TabsList className="bg-white/80 backdrop-blur-sm shadow-sm sm:shadow-md border-0 p-1 rounded-lg sm:rounded-xl w-full overflow-x-auto flex-nowrap sm:flex-wrap">
                  <TabsTrigger value="overview" className="flex-1 min-w-[80px] sm:min-w-0 rounded-md sm:rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs sm:text-sm px-3 py-2">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="fees" className="flex-1 min-w-[80px] sm:min-w-0 rounded-md sm:rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs sm:text-sm px-3 py-2">
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline-block" />
                    <span className="hidden sm:inline">Fee</span> Breakdown
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="flex-1 min-w-[80px] sm:min-w-0 rounded-md sm:rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs sm:text-sm px-3 py-2">
                    <Receipt className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline-block" />
                    Payments
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="flex-1 min-w-[80px] sm:min-w-0 rounded-md sm:rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs sm:text-sm px-3 py-2">
                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline-block" />
                    Bank
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="lg:col-span-2">
                    {/* Pass combined figures + all fees in year so overview shows true totals */}
                    <FeeBalanceOverview
                      studentFee={studentFee}
                      allStudentFees={allStudentFees.filter(sf => sf.academic_year === selectedYear)}
                      combinedTotalBilled={combinedTotalBilled}
                      combinedTotalPaid={combinedTotalPaid}
                      combinedOutstandingBalance={combinedOutstandingBalance}
                      isLoading={loadingFees}
                      currentTerm={currentTerm} // NEW: pass down
                    />
                  </div>
                  <div>
                    <TermHistoryCard
                      studentFees={allStudentFees}
                      onSelectTerm={handleSelectTerm}
                      selectedTerm={selectedTerm}
                      selectedYear={selectedYear}
                      isLoading={loadingFees}
                      currentTerm={currentTerm} // NEW: pass down
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
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-emerald-600" />
                  </div>
                ) : allTermFeeItems.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6 sm:p-8 lg:p-12 text-center">
                      <div className="p-3 sm:p-4 rounded-full bg-gray-100 w-fit mx-auto mb-3 sm:mb-4">
                        <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg">No fee items found</h3>
                      <p className="text-gray-500 mt-1 text-xs sm:text-sm lg:text-base">Fee structure not yet defined for this term</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Pass allStudentFees for the year so breakdown card can show per-term balances */}
                    <FeeBreakdownCard
                      fees={mandatoryFees}
                      title="Mandatory Fees"
                      type="Mandatory"
                      totalLabel="Total Mandatory"
                      allStudentFees={allStudentFees.filter(sf => sf.academic_year === selectedYear)}
                      currentTerm={currentTerm} // NEW: pass down (currently unused)
                    />
                    <FeeBreakdownCard
                      fees={optionalFees}
                      title="Optional Fees"
                      type="Optional"
                      totalLabel="Total Optional"
                      allStudentFees={allStudentFees.filter(sf => sf.academic_year === selectedYear)}
                      currentTerm={currentTerm} // NEW: pass down (currently unused)
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
                  currentTerm={currentTerm} // NEW: pass down
                />
              </TabsContent>

              <TabsContent value="bank">
                <BankDetailsCard />
              </TabsContent>
            </Tabs>

            {/* Summary Cards — show per-term selected figures at bottom */}
            <div className="mb-4 sm:mb-6">
              <div className="sm:hidden mb-2">
                <button
                  onClick={() => setShowSummaryCards(prev => !prev)}
                  className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg border border-gray-200 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Financial Summary</span>
                    <Badge className="ml-2 bg-emerald-100 text-emerald-700">4 items</Badge>
                  </div>
                  {showSummaryCards
                    ? <ChevronUp   className="w-4 h-4 text-gray-500" />
                    : <ChevronDown className="w-4 h-4 text-gray-500" />
                  }
                </button>
              </div>

              <div className={`${showSummaryCards ? 'block' : 'hidden'} sm:block`}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

                  {/* Combined billed for the year */}
                  <Card className="fees-no-hover-shadow border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Billed</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 truncate">
                            KES {combinedTotalBilled.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{selectedYear}</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0 ml-2">
                          <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Combined paid for the year */}
                  <Card className="fees-no-hover-shadow border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Paid</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 truncate">
                            KES {combinedTotalPaid.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{selectedYear}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg flex-shrink-0 ml-2">
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Combined outstanding for the year */}
                  <Card className="fees-no-hover-shadow border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Balance Due</p>
                          <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${combinedOutstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'} truncate`}>
                            KES {combinedOutstandingBalance.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">All terms</p>
                        </div>
                        <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0 ml-2">
                          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Credit on selected term */}
                  <Card className="fees-no-hover-shadow border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 mb-1">Credit</p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 truncate">
                            KES {creditCarried.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0 ml-2">
                          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                      </div>
                      {creditCarried > 0 && (
                        <p className="text-xs text-blue-600 mt-2">Applied to future terms automatically</p>
                      )}
                    </CardContent>
                  </Card>

                </div>
              </div>
            </div>

            {/* Credit System Info */}
            <Card className="fees-no-hover-shadow border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 hover:shadow-sm transition-shadow">
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
    currentTerm={currentTerm} // NEW
  />
)}
    </>
  );
}