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
  X, DollarSign, CreditCard
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

  // Fetch all student fees (database handles all calculations)
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

      if (error) {
        console.error("Error fetching student fees:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!student?.id,
  });

  // Fetch payments
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', student?.id],
    queryFn: async () => {
      if (!student?.id) return [];

      const { data, error } = await supabase
        .from('p_payments')
        .select('*')
        .eq('student_id', student.id)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error("Error fetching payments:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!student?.id,
  });

  // Current selected fee - use database values directly
  const studentFee = allStudentFees.find(
    sf => sf.term === selectedTerm && sf.academic_year === selectedYear
  );

  // Generate term options from database fees
  const termOptions = allStudentFees.map(sf => ({
    term: sf.term,
    year: sf.academic_year,
    label: `${sf.term} • ${sf.academic_year}`
  }));

  // Default to most recent term if nothing selected
  useEffect(() => {
    if (termOptions.length > 0 && !studentFee) {
      const mostRecent = termOptions[0];
      setSelectedTerm(mostRecent.term);
      setSelectedYear(mostRecent.year);
    }
  }, [termOptions, studentFee]);

  // Fetch fee structure items for breakdown
  const { data: studentFeeItems = [], isLoading: loadingFeeItems } = useQuery({
    queryKey: ['studentFeeItems', student?.id, selectedTerm, selectedYear],
    queryFn: async () => {
      if (!student?.id) return [];

      // Get the current term's fee record
      const { data: feeRecord, error: feeError } = await supabase
        .from('student_fees')
        .select('fee_structure_id')
        .eq('student_id', student.id)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear)
        .single();

      if (feeError || !feeRecord?.fee_structure_id) return [];

      // Get the fee structure details
      const { data: feeStructure, error: structureError } = await supabase
        .from('fee_structure')
        .select('*')
        .eq('id', feeRecord.fee_structure_id)
        .single();

      if (structureError) {
        console.error("Error fetching fee structure:", structureError);
        return [];
      }

      // Return as a fee item for breakdown
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
    <div className="Fees-dialog-container animate-pop-in">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Fee Statement</h2>
            <p className="text-gray-500 text-sm">
              {student ? `${student.first_name} ${student.last_name}` : 'Loading...'} • {student?.Reg_no || 'N/A'} • {className || 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {studentFee && (
            <>
              {creditCarried > 0 && (
                <Badge 
                  variant="outline" 
                  className="bg-amber-50 text-amber-700 border-amber-200 px-4 py-2 text-sm font-medium"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  KES {creditCarried.toLocaleString()} credit available
                </Badge>
              )}
              <Badge 
                variant="outline" 
                className={`${getStatusConfig(studentFee.status).color} px-4 py-2 text-sm font-medium`}
              >
                {React.createElement(getStatusConfig(studentFee.status).icon, { className: "w-4 h-4 mr-2" })}
                {getStatusConfig(studentFee.status).message}
              </Badge>
            </>
          )}
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Close fee statement"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
        {/* Current Term Banner */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              <div>
                <span className="font-medium">Viewing: {selectedTerm} • {selectedYear}</span>
                {mappedPayments.length > 0 && (
                  <p className="text-sm text-white/80">
                    {mappedPayments.length} payment{mappedPayments.length !== 1 ? 's' : ''} recorded
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-white/30">
                {studentFee?.status || 'No Fee Record'}
              </Badge>
              {creditCarried > 0 && (
                <Badge className="bg-amber-500 text-white border-amber-400">
                  <CreditCard className="w-3 h-3 mr-1" />
                  Credit Available
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-lg border-0 p-1.5 rounded-xl w-full">
            <TabsTrigger value="overview" className="flex-1 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="fees" className="flex-1 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-2" />
              Fee Breakdown
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Receipt className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex-1 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Building2 className="w-4 h-4 mr-2" />
              Bank Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <FeeBalanceOverview 
                  studentFee={studentFee} 
                  isLoading={loadingFees}
                />
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

          <TabsContent value="fees" className="space-y-6">
            {loadingFeeItems ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
              </div>
            ) : studentFeeItems.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900">No fee items found</h3>
                  <p className="text-gray-500 mt-1">Fee structure not yet defined for this term</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <FeeBreakdownCard 
                  fees={studentFeeItems.filter(f => f.category === 'Mandatory')} 
                  title="Mandatory Fees" 
                  type="Mandatory" 
                  totalLabel="Total Mandatory" 
                />
                <FeeBreakdownCard 
                  fees={studentFeeItems.filter(f => f.category === 'Optional')} 
                  title="Optional Fees" 
                  type="Optional" 
                  totalLabel="Total Optional" 
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
            />
          </TabsContent>

          <TabsContent value="bank">
            <BankDetailsCard />
          </TabsContent>
        </Tabs>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Billed</p>
                  <p className="text-2xl font-bold text-gray-800">
                    KES {(studentFee?.total_billed || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Receipt className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Paid ({selectedTerm})</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    KES {totalPaid.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    KES {outstandingBalance.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Credit Available</p>
                  <p className="text-2xl font-bold text-blue-600">
                    KES {creditCarried.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              {creditCarried > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  Will be applied to future term fees automatically
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Credit System Notice */}
        <Card className="border border-blue-200 bg-blue-50 mt-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800">Credit System Information</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Any overpayment in the current term is automatically stored as credit and applied to the next term's fees. The system handles all calculations automatically.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-blue-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Outstanding balance is the amount still due</span>
                  </div>
                  <div className="flex items-center gap-1">
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
  );
}