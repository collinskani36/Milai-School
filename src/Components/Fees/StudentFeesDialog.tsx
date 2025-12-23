"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GraduationCap, Calendar, Clock, AlertTriangle,
  CheckCircle, Receipt, Building2, FileText, Loader2,
  X
} from "lucide-react";

import FeeBalanceOverview from "@/components/fees/FeeBalanceOverview";
import PaymentHistory from "@/components/fees/PaymentHistory";
import BankDetailsCard from "@/components/fees/BankDetailsCard";
import FeeBreakdownCard from "@/components/fees/FeeBreakdownCard";
import TermHistoryCard from "@/components/fees/TermHistoryCard";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  Reg_no: string;
  auth_id: string;
   guardian_phone?: string;
};

type StudentFee = {
  id: string;
  student_id: string;
  term: string;
  academic_year: string;
  status: string;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
  student_name?: string;
  admission_number?: string;
  last_payment_date?: string;
  fee_structure_id?: string;
};

type FeeStructure = {
  id: string;
  name: string;
  term: string;
  academic_year: string;
  category: 'Mandatory' | 'Optional';
  amount: number;
  description?: string;
  is_active: boolean;
};

type FeeItem = {
  id: string | number;
  name: string;
  amount: number;
  category: 'Mandatory' | 'Optional';
  description?: string;
};

type Payment = {
  id: string;
  student_id: string;
  fee_id: string | null;
  amount_paid: number;
  payment_date: string;
  payment_method?: string;
  transaction_reference?: string;
  status?: string;
  academic_year: string;
  term: string;
  notes?: string;
  reference_number?: string;
  inserted_at?: string;
  updated_at?: string;
};

type TermOption = {
  term: string;
  year: string;
  label: string;
};

interface StudentFeesDialogProps {
  onClose: () => void;
  studentData: any;
  classId: string | null;
  className: string | null;
}

export default function StudentFeesDialog({ 
  onClose, 
  studentData, 
  classId, 
  className 
}: StudentFeesDialogProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  
  // Sandbox Payment state
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"" | "pending" | "success" | "failed">("");

  // Use passed student data instead of fetching
  const [student, setStudent] = useState<any>(studentData);

  // Fetch current logged-in user
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
    console.log("Current Auth User:", currentUser);
  }, [currentUser]);

  useEffect(() => {
    console.log("Student data in fees dialog:", studentData);
    setStudent(studentData);
  }, [studentData]);

  // Fetch all student fees
  const { data: allStudentFees = [], isLoading: loadingFees } = useQuery({
    queryKey: ['allStudentFees', student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase
        .from<StudentFee>('student_fees')
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

  // Get current term/year combination
  const studentFee = allStudentFees.find(
    sf => sf.term === selectedTerm && sf.academic_year === selectedYear
  );

  // Generate term options from available fees
  const termOptions: TermOption[] = allStudentFees.map(sf => ({
    term: sf.term,
    year: sf.academic_year,
    label: `${sf.term} • ${sf.academic_year}`
  }));

  // If no specific term/year is selected and we have data, select the most recent one
  useEffect(() => {
    if (termOptions.length > 0 && !studentFee) {
      const mostRecent = termOptions[0];
      setSelectedTerm(mostRecent.term);
      setSelectedYear(mostRecent.year);
    }
  }, [termOptions, studentFee]);

  // Fetch student fee items joined with fee_structure
  const { data: studentFeeItems = [], isLoading: loadingFeeItems } = useQuery({
    queryKey: ['studentFeeItems', student?.id, selectedTerm, selectedYear],
    queryFn: async () => {
      if (!student?.id) return [];
      
      const { data, error } = await supabase
        .from('student_fees')
        .select(`
          id,
          fee_structure_id,
          total_billed,
          total_paid,
          outstanding_balance,
          status,
          term,
          academic_year,
          fee_structure:fee_structure_id (
            id,
            name,
            amount,
            category,
            description
          )
        `)
        .eq('student_id', student.id)
        .eq('term', selectedTerm)
        .eq('academic_year', selectedYear);
      
      if (error) {
        console.error("Error fetching student fee items:", error);
        throw error;
      }
      
      console.log('Fee items raw data:', data);
      
      return data.map((sf: any) => ({
        id: sf.id,
        name: sf.fee_structure?.name || 'Unnamed Fee',
        amount: sf.fee_structure?.amount || 0,
        category: sf.fee_structure?.category || 'Mandatory',
        description: sf.fee_structure?.description || ''
      }));
    },
    enabled: !!student?.id && !!selectedTerm && !!selectedYear,
  });

  const handleSelectTerm = (term: string, year: string) => {
    setSelectedTerm(term);
    setSelectedYear(year);
  };

  // Fetch payment history from p_payments table
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', student?.id],
    queryFn: async () => {
      if (!student?.id) {
        console.warn("Cannot fetch payments: student.id is undefined");
        return [];
      }

      console.log(`Querying payments with: student_id=${student.id}, term=${selectedTerm}, academic_year=${selectedYear}`);
      console.log('Fetching payments for student:', student.id);
      
      const { data, error } = await supabase
        .from('p_payments')
        .select(`
          id,
          student_id,
          fee_id,
          amount_paid,
          payment_date,
          payment_method,
          transaction_reference,
          status,
          academic_year,
          term,
          notes,
          reference_number,
          inserted_at,
          updated_at
        `)
        .eq('student_id', student.id)
        .order('payment_date', { ascending: false });
      
      if (error) {
        console.error("Error fetching payments:", error);
        throw error;
      }
      
      console.log('Raw payments data from Supabase:', data);
      
      return (data as Payment[]) || [];
    },
    enabled: !!student?.id,
  });

  // Filter payments by selected term and year
  const filteredPayments = payments.filter(
    p => p.term === selectedTerm && p.academic_year === selectedYear
  );

  console.log('Filtered payments for current term:', {
    selectedTerm,
    selectedYear,
    filteredPayments,
    totalPayments: payments.length
  });

  // Compute dynamic balances from payments
  const totalPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const outstandingBalance = (studentFee?.total_billed || 0) - totalPaid;

  const paymentStatus =
    totalPaid === 0 ? "Unpaid" :
    totalPaid < (studentFee?.total_billed || 0) ? "Partial" :
    totalPaid === (studentFee?.total_billed || 0) ? "Paid" :
    "Overpaid";

  const updatedStudentFee = studentFee ? {
    ...studentFee,
    total_paid: totalPaid,
    outstanding_balance: outstandingBalance,
    status: paymentStatus
  } : null;

  const mappedPayments = filteredPayments.map(p => ({
    ...p,
    amount: p.amount_paid
  }));

  const getStatusConfig = (status: string) => {
    const configs: Record<string, any> = {
      'Paid': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle, message: 'All fees cleared!' },
      'Partial': { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, message: 'Partial payment made' },
      'Unpaid': { color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle, message: 'Payment pending' },
      'Overpaid': { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle, message: 'Overpayment recorded' }
    };
    return configs[status] || configs['Unpaid'];
  };

 const handlePay = async () => {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    alert("Please enter a valid amount greater than 0");
    return;
  }

  setStatus("pending");

  try {
    const response = await fetch(
      "https://YOUR_PROJECT_ID.functions.supabase.co/kcb_payment",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student?.id,
          amount: Number(amount),
          term: selectedTerm,
          academic_year: selectedYear,
          phone: student?.guardian_phone || "2547XXXXXXXX", // Changed from parent_phone to guardian_phone
        }),
      }
    );

    const data = await response.json();

    console.log('Sandbox payment response:', data);

    if (data.error) {
      setStatus("failed");
      alert("Payment failed: " + data.error);
      return;
    }

    setStatus("pending");
    alert("Sandbox payment initiated! Check callback to update dashboard.");

  } catch (err: any) {
    console.error(err);
    setStatus("failed");
    alert("Payment error: " + err.message);
  }
};

  const handleClose = () => {
    const container = document.querySelector('.fees-dialog-container');
    if (container) {
      container.classList.add('animate-pop-out');
    }
    setTimeout(() => {
      onClose();
    }, 200);
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
    <div className="fees-dialog-container animate-pop-in">
      {/* Header with Close Button */}
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
          {updatedStudentFee && (
            <Badge 
              variant="outline" 
              className={`${getStatusConfig(updatedStudentFee.status).color} px-4 py-2 text-sm font-medium`}
            >
              {React.createElement(getStatusConfig(updatedStudentFee.status).icon, { className: "w-4 h-4 mr-2" })}
              {getStatusConfig(updatedStudentFee.status).message}
            </Badge>
          )}
          
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white hover:bg-gray-50 
                     border border-gray-200 shadow-sm hover:shadow transition-all duration-200 
                     hover:scale-105 active:scale-95"
            aria-label="Close fee statement"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
        {/* Current Term Banner */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              <div>
                <span className="font-medium">Viewing: {selectedTerm} • {selectedYear}</span>
                {filteredPayments.length > 0 && (
                  <p className="text-sm text-white/80">
                    {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} recorded
                  </p>
                )}
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-white/30">
              {updatedStudentFee?.status || 'No Fee Record'}
            </Badge>
          </CardContent>
        </Card>

        {/* Debug Info - Remove in production */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 hidden mb-6">
          <p><strong>Debug Info:</strong></p>
          <p>Total Payments Fetched: {payments.length}</p>
          <p>Filtered Payments: {filteredPayments.length}</p>
          <p>Total Paid (calculated): {totalPaid.toFixed(2)}</p>
          <p>Student Fee Total Billed: {studentFee?.total_billed || 'N/A'}</p>
          <p>Status: {paymentStatus}</p>
        </div>

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
                  studentFee={updatedStudentFee} 
                  isLoading={loadingFees}
                />

                {/* Pay Fees Section */}
                <div className="mt-6 p-6 border rounded-xl bg-white shadow-sm">
                  <h3 className="text-lg font-semibold mb-3">Test Payment (Sandbox)</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Amount
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">KES</span>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          placeholder="Enter amount"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="border rounded-lg p-3 flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <button
                          onClick={handlePay}
                          disabled={!amount || status === "pending"}
                          className={`px-6 py-3 rounded-lg text-white font-medium transition-all ${status === "pending" ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"}`}
                        >
                          {status === "pending" ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                              Processing...
                            </>
                          ) : "Pay Now"}
                        </button>
                      </div>
                    </div>
                    {status && status !== "pending" && (
                      <div className={`p-3 rounded-lg ${status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {status === "success" ? "✅ Payment successful!" : "❌ Payment failed!"}
                      </div>
                    )}
                    <p className="text-sm text-gray-500">
                      Note: This is a sandbox payment for testing purposes only.
                    </p>
                  </div>
                </div>

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

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Paid ({selectedTerm})</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    KES {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <p className="text-2xl font-bold text-amber-600">
                    KES {outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <p className="text-sm text-gray-500">Total Billed</p>
                  <p className="text-2xl font-bold text-gray-800">
                    KES {(studentFee?.total_billed || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Receipt className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}