"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { 
  GraduationCap, Calendar, Clock, AlertTriangle,
  CheckCircle, Receipt, Building2, FileText,
  X, DollarSign, CreditCard, ChevronDown, ChevronUp, Info
} from "lucide-react";

import FeeBalanceOverview from "@/Components/Fees/FeeBalanceOverview";
import PaymentHistory from "@/Components/Fees/PaymentHistory";
import BankDetailsCard from "@/Components/Fees/BankDetailsCard";
import FeeBreakdownCard from "@/Components/Fees/FeeBreakdownCard";
import TermHistoryCard from "@/Components/Fees/TermHistoryCard";

export default function StudentFeesDialog({ 
  onClose, 
  studentData, 
  classId, 
  className 
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [student, setStudent] = useState(studentData);
  const [showSummaryCards, setShowSummaryCards] = useState(true); // Desktop: expanded, Mobile: collapsed

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching auth user:", error);
        return;
      }
      setCurrentUser(data?.user || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    setStudent(studentData);
  }, [studentData]);

  const { data: allStudentFees = [], isLoading: loadingFees } = useQuery({
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
      return data || [];
    },
    enabled: !!student?.id,
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', student?.id],
    queryFn: async () => {
      if (!student?.id) return [];

      const { data, error } = await supabase
        .from('p_payments')
        .select('*')
        .eq('student_id', student.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!student?.id,
  });

  const studentFee = allStudentFees.find(
    sf => sf.term === selectedTerm && sf.academic_year === selectedYear
  );

  const termOptions = allStudentFees.map(sf => ({
    term: sf.term,
    year: sf.academic_year,
    label: `${sf.term} • ${sf.academic_year}`
  }));

  useEffect(() => {
    if (termOptions.length > 0 && !studentFee) {
      const mostRecent = termOptions[0];
      setSelectedTerm(mostRecent.term);
      setSelectedYear(mostRecent.year);
    }
  }, [termOptions, studentFee]);

  const { data: studentFeeItems = [], isLoading: loadingFeeItems } = useQuery({
    queryKey: ['studentFeeItems', student?.id, selectedTerm, selectedYear],
    queryFn: async () => {
      if (!student?.id) return [];

      const { data: feeRecord, error: feeError } = await supabase
        .from('student_fees')
        .select('fee_structure_id')
        .eq('student_id', student.id)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear)
        .single();

      if (feeError || !feeRecord?.fee_structure_id) return [];

      const { data: feeStructure, error: structureError } = await supabase
        .from('fee_structure')
        .select('*')
        .eq('id', feeRecord.fee_structure_id)
        .single();

      if (structureError) return [];

      return [{
        id: feeStructure.id,
        name: feeStructure.name,
        amount: feeStructure.amount,
        category: feeStructure.category || 'Mandatory',
        description: feeStructure.description || ''
      }];
    },
    enabled: !!student?.id && !!selectedTerm && !!selectedYear,
  });

  const handleSelectTerm = (term, year) => {
    setSelectedTerm(term);
    setSelectedYear(year);
  };

  const mappedPayments = payments
    .filter(p => p.term === selectedTerm && p.academic_year === selectedYear)
    .map(p => ({ ...p, amount: p.amount_paid }));

  const totalPaid = studentFee?.total_paid || 0;
  const outstandingBalance = studentFee?.outstanding_balance || 0;
  const creditCarried = studentFee?.credit_carried || 0;

  const getStatusConfig = (status) => {
    const configs = {
      'paid': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle, message: 'All Fees cleared!' },
      'partial': { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, message: 'Partial payment made' },
      'pending': { color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle, message: 'Payment pending' },
      'overpaid': { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle, message: 'Overpayment recorded' }
    };
    return configs[status?.toLowerCase()] || configs['pending'];
  };

  const handleClose = () => {
    const container = document.querySelector('.Fees-dialog-container');
    if (container) container.classList.add('animate-pop-out');
    setTimeout(onClose, 200);
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600 mb-4"></div>
        <p className="text-gray-600">Loading your fee statement...</p>
      </div>
    );
  }

  return (
    <div className="Fees-dialog-container animate-pop-in bg-white flex flex-col h-[90vh] md:h-[85vh] lg:h-[80vh] w-full max-w-7xl mx-auto rounded-none md:rounded-xl shadow-none md:shadow-2xl overflow-hidden">
      {/* Header - Fixed height for both mobile and desktop */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm flex-shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Fee Statement</h2>
              <p className="text-gray-500 text-xs sm:text-sm truncate">
                {student ? `${student.first_name} ${student.last_name}` : 'Loading...'} • {student?.Reg_no || 'N/A'} • {className || 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {studentFee && (
              <Badge 
                variant="outline" 
                className={`${getStatusConfig(studentFee.status).color} hidden sm:flex px-3 py-1.5 text-xs font-medium`}
              >
                {React.createElement(getStatusConfig(studentFee.status).icon, { className: "w-3 h-3 mr-1 inline-block" })}
                {getStatusConfig(studentFee.status).message}
              </Badge>
            )}
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Flexible for desktop */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6">
          {/* Current Term Banner */}
          <Card className="border-0 shadow-md sm:shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-3 sm:mb-4">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-sm sm:text-base truncate">Viewing: {selectedTerm} • {selectedYear}</span>
                    {mappedPayments.length > 0 && (
                      <p className="text-xs sm:text-sm text-white/80 truncate">
                        {mappedPayments.length} payment{mappedPayments.length !== 1 ? 's' : ''} recorded
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 text-white border-white/30 text-xs py-1">
                    {studentFee?.status || 'No Fee Record'}
                  </Badge>
                  {studentFee && (
                    <Badge 
                      variant="outline" 
                      className={`${getStatusConfig(studentFee.status).color} sm:hidden px-2 py-1 text-xs`}
                    >
                      {React.createElement(getStatusConfig(studentFee.status).icon, { className: "w-3 h-3 mr-1" })}
                      Short
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                  <FeeBalanceOverview studentFee={studentFee} isLoading={loadingFees} />
                </div>
                <div>
                  <TermHistoryCard 
                    studentFees={allStudentFees}
                    onSelectTerm={handleSelectTerm}
                    selectedTerm={selectedTerm}
                    selectedYear={selectedYear}
                    isLoading={loadingFees}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fees" className="space-y-4 sm:space-y-6">
              {loadingFeeItems ? (
                <div className="flex justify-center items-center h-32 sm:h-48">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-emerald-600"></div>
                </div>
              ) : studentFeeItems.length === 0 ? (
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
                  <FeeBreakdownCard fees={studentFeeItems.filter(f => f.category === 'Mandatory')} title="Mandatory Fees" type="Mandatory" totalLabel="Total Mandatory" />
                  <FeeBreakdownCard fees={studentFeeItems.filter(f => f.category === 'Optional')} title="Optional Fees" type="Optional" totalLabel="Total Optional" />
                </>
              )}
            </TabsContent>

            <TabsContent value="payments">
              <PaymentHistory payments={mappedPayments} isLoading={loadingPayments} showStudentInfo={false} selectedTerm={selectedTerm} selectedYear={selectedYear} />
            </TabsContent>

            <TabsContent value="bank">
              <BankDetailsCard />
            </TabsContent>
          </Tabs>

          {/* Summary Cards Section */}
          <div className="mb-4 sm:mb-6">
            {/* Mobile Toggle for Summary Cards */}
            <div className="sm:hidden mb-2">
              <button
                onClick={() => setShowSummaryCards(!showSummaryCards)}
                className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Financial Summary</span>
                  <Badge className="ml-2 bg-emerald-100 text-emerald-700">4 items</Badge>
                </div>
                {showSummaryCards ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>

            {/* Summary Cards Grid - Always visible on desktop */}
            <div className={`${showSummaryCards ? 'block' : 'hidden'} sm:block`}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Billed */}
                <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Billed</p>
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 truncate">
                          KES {(studentFee?.total_billed || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0 ml-2">
                        <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Paid */}
                <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Paid</p>
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 truncate">
                          KES {totalPaid.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{selectedTerm}</p>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-lg flex-shrink-0 ml-2">
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Outstanding Balance */}
                <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Balance</p>
                        <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'} truncate`}>
                          KES {outstandingBalance.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0 ml-2">
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Credit Available */}
                <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
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
                      <p className="text-xs text-blue-600 mt-2">
                        Applied to future terms automatically
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Credit System Information */}
          <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 hover:shadow-sm transition-shadow">
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
                    Any overpayment in the current term is automatically stored as credit and applied to the next term's fees. The system handles all calculations automatically.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-blue-600">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span>Outstanding balance is the amount still due</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
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
  );
}