import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Badge } from "@/Components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { 
  Search, Plus, Users, Wallet, TrendingUp, AlertCircle, 
  Settings, Receipt, RefreshCw, FileText, Download, UserCheck, CreditCard
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
  
  // FETCH ALL PAYMENTS
  const { data: allPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['allPayments'],
    queryFn: async () => {
      console.log("Fetching all payments from p_payments...");
      const { data, error } = await supabase
        .from('p_payments')
        .select('*')
        .order('payment_date', { ascending: false });
      
      if (error) {
        console.error("Error fetching payments:", error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} payments`);
      return data || [];
    }
  });

  // FETCH STUDENT FEES WITH CREDIT_CARRIED
  const { data: studentFees = [], isLoading: loadingStudentFees } = useQuery({
    queryKey: ["studentFees"],
    queryFn: async () => {
      console.log("Fetching student fees with credits...");

      // Fetch student fees including credit_carried
      const { data: feesData, error: feesError } = await supabase
        .from("student_fees")
        .select("*")
        .order("inserted_at", { ascending: false });
      
      if (feesError) {
        console.error("Error fetching student fees:", feesError);
        throw feesError;
      }

      // Fetch students with profiles
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id, 
          first_name, 
          last_name, 
          Reg_no,
          profiles!inner (
            student_type
          )
        `);
      
      if (studentsError) {
        console.error("Error fetching students:", studentsError);
        throw studentsError;
      }

      // Fetch enrollments
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          class_id,
          classes (id, name)
        `);
      
      if (enrollmentsError) {
        console.error("Error fetching enrollments:", enrollmentsError);
        throw enrollmentsError;
      }

      // Fetch fee structures for term/year info
      const { data: feeStructures, error: feeStructureError } = await supabase
        .from("fee_structure")
        .select("id, term, academic_year");
      
      if (feeStructureError) {
        console.error("Error fetching fee structures:", feeStructureError);
        throw feeStructureError;
      }

      // Create student map
      const studentMap = new Map();
      studentsData.forEach((student: any) => {
        const profile = firstRel(student.profiles);
        studentMap.set(student.id, {
          ...student,
          student_type: profile?.student_type || "Day Scholar"
        });
      });

      // Create enrollment map
      const enrollmentMap = new Map();
      enrollmentsData.forEach((enrollment: any) => {
        enrollmentMap.set(enrollment.student_id, enrollment);
      });

      // Create fee structure map
      const feeStructureMap = new Map();
      feeStructures?.forEach((fs: any) => {
        feeStructureMap.set(fs.id, fs);
      });

      // Aggregate student fees by student
      const studentFeeMap = new Map();

      feesData.forEach((fee: any) => {
        const studentId = fee.student_id;
        const studentKey = studentId;
        
        if (!studentFeeMap.has(studentKey)) {
          const student = studentMap.get(studentId);
          const enrollment = enrollmentMap.get(studentId);
          const studentType = student?.student_type || "Day Scholar";

          studentFeeMap.set(studentKey, {
            id: studentId,
            student_id: studentId,
            student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
            admission_number: student?.Reg_no || "N/A",
            student_type: studentType,
            display_type: studentType,
            class_name: firstRel(enrollment?.classes)?.name || "Not Assigned",
            total_billed: 0,
            total_paid: 0,
            outstanding_balance: 0,
            total_credit_carried: 0,
            fee_records: [],
            last_payment_date: null,
            academic_years: new Set(),
            current_term_fee: null,
            payments: []
          });
        }

        const studentFee = studentFeeMap.get(studentKey);
        
        // Get fee structure info
        const feeStructure = feeStructureMap.get(fee.fee_structure_id);
        const feeWithStructure = {
          ...fee,
          term: fee.term || feeStructure?.term,
          academic_year: fee.academic_year || feeStructure?.academic_year
        };

        // Update totals
        studentFee.total_billed += Number(fee.total_billed) || 0;
        studentFee.total_paid += Number(fee.total_paid) || 0;
        studentFee.total_credit_carried += Number(fee.credit_carried) || 0;
        
        // Add fee record
        studentFee.fee_records.push(feeWithStructure);
        
        if (fee.academic_year) {
          studentFee.academic_years.add(fee.academic_year);
        }

        // Update last payment date
        if (fee.last_payment_date) {
          const feeDate = new Date(fee.last_payment_date);
          if (!studentFee.last_payment_date || feeDate > new Date(studentFee.last_payment_date)) {
            studentFee.last_payment_date = fee.last_payment_date;
          }
        }

        // Set current term fee (most recent term/year)
        const currentTerm = `${fee.term || feeStructure?.term}-${fee.academic_year || feeStructure?.academic_year}`;
        if (!studentFee.current_term_fee || currentTerm > `${studentFee.current_term_fee.term}-${studentFee.current_term_fee.academic_year}`) {
          studentFee.current_term_fee = feeWithStructure;
        }
      });

      // Calculate outstanding balance and status
      const aggregatedData = Array.from(studentFeeMap.values()).map(student => {
        // Calculate effective outstanding balance (considering credit)
        const effectiveOutstanding = Math.max(0, student.total_billed - student.total_paid);
        
        // Determine status
        let status = "Pending";
        if (student.total_paid >= student.total_billed) {
          status = "Paid";
        } else if (student.total_paid > 0) {
          status = "Partial";
        }

        // Get payments for this student
        const studentPayments = allPayments.filter((p: any) => p.student_id === student.student_id);
        
        // Update last payment date from payments if available
        if (studentPayments.length > 0 && !student.last_payment_date) {
          const latestPayment = studentPayments.reduce((latest: any, current: any) => {
            return new Date(current.payment_date) > new Date(latest.payment_date) ? current : latest;
          }, studentPayments[0]);
          student.last_payment_date = latestPayment.payment_date;
        }

        return {
          ...student,
          outstanding_balance: student.total_billed - student.total_paid,
          effective_outstanding: effectiveOutstanding,
          status,
          payments: studentPayments,
          academic_years: Array.from(student.academic_years)
        };
      });

      console.log("Aggregated student fees:", aggregatedData.length, "students");
      console.log("Total credit carried across all students:", 
        aggregatedData.reduce((sum, sf) => sum + (sf.total_credit_carried || 0), 0));
      
      return aggregatedData;
    },
    enabled: true,
  });

  // FETCH FEE STRUCTURE
  const { data: fees = [], isLoading: loadingFees } = useQuery({
    queryKey: ['fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_structure')
        .select(`
          *,
          fee_structure_classes (
            class_id,
            classes (id, name)
          )
        `)
        .order('inserted_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fee Mutation - Updated to handle credit_carried
  const feeMutation = useMutation({
    mutationFn: async (data: any) => {
      const classes = data.classes || [];
      delete data.classes;

      const payload = {
        ...data,
        student_type: data.student_type,
        amount: Number(data.amount)
      };

      let feeId = selectedFee?.id;

      // 1) Insert or update fee_structure
      if (selectedFee) {
        const { error: feeError } = await supabase
          .from("fee_structure")
          .update(payload)
          .eq("id", feeId);
        if (feeError) throw feeError;

        // Clear previous class mappings
        const { error: delErr } = await supabase
          .from("fee_structure_classes")
          .delete()
          .eq("fee_structure_id", feeId);
        if (delErr) throw delErr;

        // Re-insert class mappings
        if (classes.length > 0) {
          const classMapping = classes.map((class_id: string) => ({
            fee_structure_id: feeId,
            class_id,
          }));
          const { error: classErr } = await supabase
            .from("fee_structure_classes")
            .insert(classMapping);
          if (classErr) throw classErr;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("fee_structure")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        feeId = inserted.id;

        if (classes.length > 0) {
          const classMapping = classes.map((class_id: string) => ({
            fee_structure_id: feeId,
            class_id,
          }));
          const { error: classErr } = await supabase
            .from("fee_structure_classes")
            .insert(classMapping);
          if (classErr) throw classErr;
        }
      }

      // 2) If classes mapped, create/update student_fees
      if (classes.length > 0) {
        // Get students in selected classes with profiles
        const { data: enrollmentsWithStudents, error: enrollmentsError } = await supabase
          .from("enrollments")
          .select(`
            student_id,
            class_id,
            students (
              id,
              first_name,
              last_name,
              Reg_no,
              profiles (
                student_type
              )
            )
          `)
          .in("class_id", classes);

        if (enrollmentsError) throw enrollmentsError;

        if (!enrollmentsWithStudents || enrollmentsWithStudents.length === 0) {
          console.log("No students found in selected classes");
          return { success: true };
        }

        // Filter students by student_type
        const matchingStudents = enrollmentsWithStudents.filter((item: any) => {
          const student = firstRel(item.students);
          const profile = firstRel(student?.profiles);
          return profile?.student_type === payload.student_type;
        });

        const matchingStudentIds = matchingStudents.map((item: any) => item.student_id);

        if (matchingStudentIds.length === 0) {
          console.log(`No ${payload.student_type} students found in selected classes`);
          return { success: true };
        }

        console.log(`Found ${matchingStudentIds.length} ${payload.student_type} students`);

        // 3) Get existing student_fees for this fee_structure
        const { data: existingFees = [], error: existingErr } = await supabase
          .from("student_fees")
          .select("*")
          .in("student_id", matchingStudentIds)
          .eq("fee_structure_id", feeId);
        if (existingErr) throw existingErr;

        const existingMap = new Map();
        existingFees.forEach((ef: any) => existingMap.set(ef.student_id, ef));

        // 4) Prepare batch operations with credit_carried logic
        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const enrollment of matchingStudents) {
  const studentId = enrollment.student_id;
  const student = firstRel(enrollment.students);
  const existing = existingMap.get(studentId);

  // Get existing payments for this student and fee structure
  const { data: studentPayments, error: paymentsError } = await supabase
    .from('p_payments')
    .select('amount_paid, payment_date')
    .eq('student_id', studentId)
    .eq('fee_id', feeId)
    .order('payment_date', { ascending: false });
  
  if (paymentsError) throw paymentsError;

  const existingPaid = studentPayments?.reduce((sum: number, p: any) => 
    sum + Number(p.amount_paid || 0), 0) || 0;

  // Create the student fee record - trigger will handle credit application
  const feePayload: any = {
    student_id: studentId,
    fee_structure_id: feeId,
    total_billed: payload.amount,
    total_paid: existingPaid, // Start with existing payments
    outstanding_balance: Math.max(0, payload.amount - existingPaid),
    // DO NOT set credit_carried here - let trigger handle it
    status: existingPaid >= payload.amount ? "paid" : existingPaid > 0 ? "partial" : "pending",
    term: payload.term,
    academic_year: payload.academic_year,
    student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
    admission_number: student?.Reg_no || "N/A",
    last_payment_date: studentPayments && studentPayments.length > 0 
      ? studentPayments[0].payment_date 
      : null,
  };

  if (existing) {
    toUpdate.push({ id: existing.id, payload: feePayload });
  } else {
    toInsert.push(feePayload);
  }
}
        console.log(`Insert: ${toInsert.length}, Update: ${toUpdate.length}`);

        // 5) Batch insert new student_fees
        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("student_fees")
            .insert(toInsert);
          if (insertErr) throw insertErr;
        }

        // 6) Batch update existing student_fees
        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map(async (u) => {
              const { error: updateErr } = await supabase
                .from("student_fees")
                .update(u.payload)
                .eq("id", u.id);
              if (updateErr) throw updateErr;
            })
          );
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["studentFees"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      setShowFeeForm(false);
      setSelectedFee(null);
    },
  });

  // Payment Mutation - Handles overpayment and credit_carried
  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Starting payment mutation...", { data, selectedStudentFee });

      if (!selectedStudentFee) {
        throw new Error("No student fee record selected");
      }

      const feeRecord = selectedStudentFee.current_term_fee || selectedStudentFee;
      const amount = parseFloat(data.amount) || 0;

      console.log("Inserting payment for student:", {
        student_id: feeRecord.student_id,
        fee_id: feeRecord.id || feeRecord.fee_structure_id,
        amount_paid: amount,
      });

      // Insert payment - triggers will handle credit_carried logic
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
        .select()
        .single();

      if (paymentError) {
        console.error("Error inserting payment:", paymentError);
        throw paymentError;
      }

      console.log("Payment inserted successfully");

      return paymentInserted;
    },
    onSuccess: () => {
      console.log("Payment successful, refreshing data...");
      queryClient.invalidateQueries({ queryKey: ["studentFees"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      setShowPaymentForm(false);
      setSelectedStudentFee(null);
    },
  });

  // Delete fee mutation
  const deleteFee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_structure').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fees'] })
  });

  // Filter student fees
  const filteredStudentFees = useMemo(() => {
    return (studentFees || []).filter((sf: any) => {
      const matchesSearch = !searchQuery || 
        (sf.student_name && sf.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sf.admission_number && sf.admission_number.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesYear = selectedYear === 'all' || sf.academic_years?.includes(selectedYear);
      
      const matchesStudentType = selectedStudentType === 'all' || 
        (selectedStudentType === 'day' && sf.student_type === 'Day Scholar') ||
        (selectedStudentType === 'boarder' && sf.student_type === 'Boarding');

      return matchesSearch && matchesYear && matchesStudentType;
    });
  }, [studentFees, searchQuery, selectedYear, selectedStudentType]);

  // Calculate statistics including credit carried
  const stats = useMemo(() => {
    const filtered = filteredStudentFees || [];
    const totalStudents = filtered.length;
    
    const totalBilled = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.total_billed ?? 0);
    }, 0);
    
    const totalCollected = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.total_paid ?? 0);
    }, 0);
    
    const totalOutstanding = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.outstanding_balance ?? 0);
    }, 0);

    const totalCreditCarried = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.total_credit_carried ?? 0);
    }, 0);

    console.log("Dashboard Stats:", {
      totalStudents,
      totalBilled,
      totalCollected,
      totalOutstanding,
      totalCreditCarried
    });

    return { totalStudents, totalBilled, totalCollected, totalOutstanding, totalCreditCarried };
  }, [filteredStudentFees]);

  const handleRecordPayment = (studentFee: any) => {
    setSelectedStudentFee(studentFee);
    setShowPaymentForm(true);
  };

  const handleViewDetails = (studentFee: any) => {
    setSelectedStudentFee(studentFee);
    setActiveTab('history');
  };

  const handleEditFee = (fee: any) => {
    const feeWithClasses = {
      ...fee,
      classes: fee.fee_structure_classes?.map((fsc: any) => fsc.class_id) || []
    };
    setSelectedFee(feeWithClasses);
    setShowFeeForm(true);
  };

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
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["studentFees"] });
                queryClient.invalidateQueries({ queryKey: ["allPayments"] });
                queryClient.invalidateQueries({ queryKey: ["fees"] });
              }}
              className="border-gray-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => { setSelectedFee(null); setShowFeeForm(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Fee Type
            </Button>
          </div>
        </div>

        {/* Stats Cards - Added Credit Carried */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { 
              label: 'Total Students', 
              value: stats.totalStudents, 
              icon: Users, 
              color: 'blue',
            },
            { 
              label: 'Total Billed', 
              value: `KES ${stats.totalBilled.toLocaleString()}`, 
              icon: FileText, 
              color: 'purple',
            },
            { 
              label: 'Total Collected', 
              value: `KES ${stats.totalCollected.toLocaleString()}`, 
              icon: TrendingUp, 
              color: 'emerald',
            },
            { 
              label: 'Outstanding', 
              value: `KES ${stats.totalOutstanding.toLocaleString()}`, 
              icon: AlertCircle, 
              color: 'red',
            },
            { 
              label: 'Credit Carried', 
              value: `KES ${stats.totalCreditCarried.toLocaleString()}`, 
              icon: CreditCard, 
              color: 'amber',
            }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-shadow">
                <div className={`h-1 ${{
                  'blue': 'bg-blue-500',
                  'purple': 'bg-purple-500',
                  'emerald': 'bg-emerald-500',
                  'red': 'bg-red-500',
                  'amber': 'bg-amber-500'
                }[stat.color]}`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${{
                      'blue': 'bg-blue-50',
                      'purple': 'bg-purple-50',
                      'emerald': 'bg-emerald-50',
                      'red': 'bg-red-50',
                      'amber': 'bg-amber-50'
                    }[stat.color]}`}>
                      <Icon className={`w-5 h-5 ${{
                        'blue': 'text-blue-600',
                        'purple': 'text-purple-600',
                        'emerald': 'text-emerald-600',
                        'red': 'text-red-600',
                        'amber': 'text-amber-600'
                      }[stat.color]}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm shadow-lg border-0 p-1.5 rounded-xl">
            <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Student Fees
            </TabsTrigger>
            <TabsTrigger value="structure" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" />
              Fee Structure
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Receipt className="w-4 h-4 mr-2" />
              Payment History
            </TabsTrigger>
          </TabsList>

          {/* STUDENT FEES TAB */}
          <TabsContent value="students" className="space-y-6">
            {/* Filters & Search */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or admission number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 border-gray-200"
                  />
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full md:w-40 h-11 border-gray-200">
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2024/2025">2024/2025</SelectItem>
                    <SelectItem value="2025/2026">2025/2026</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedStudentType} onValueChange={setSelectedStudentType}>
                  <SelectTrigger className="w-full md:w-40 h-11 border-gray-200">
                    <SelectValue placeholder="Student Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="day">Day Scholars</SelectItem>
                    <SelectItem value="boarder">Boarders</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Student Fee Cards */}
            {loadingStudentFees ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="border-0 shadow-lg animate-pulse">
                    <CardContent className="p-5 h-64" />
                  </Card>
                ))}
              </div>
            ) : filteredStudentFees.length === 0 ? (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
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

          {/* Fee Structure Tab */}
          <TabsContent value="structure" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingFees ? (
                [1, 2, 3].map(i => (
                  <Card key={i} className="border-0 shadow-lg animate-pulse">
                    <CardContent className="p-5 h-40" />
                  </Card>
                ))
              ) : fees.length === 0 ? (
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm col-span-full">
                  <CardContent className="p-12 text-center">
                    <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4">
                      <Wallet className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900">No fee types defined</h3>
                    <p className="text-gray-500 mt-1">Add your first fee type to get started</p>
                    <Button
                      onClick={() => setShowFeeForm(true)}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Fee Type
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                fees.map((fee: any) => (
                  <Card key={fee.id} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all">
                    <div className={`h-1 ${fee.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{fee.name}</h3>
                          <p className="text-sm text-gray-500">{fee.term} • {fee.academic_year}</p>
                          <div className="text-xs text-gray-400 mt-1">
                            Student Type: <Badge variant="outline" className="ml-1">
                              {fee.student_type}
                            </Badge>
                          </div>
                          {fee.fee_structure_classes && fee.fee_structure_classes.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              Classes: {fee.fee_structure_classes.map((fsc: any) => fsc.classes?.name).join(', ')}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={fee.category === 'Mandatory' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                          {fee.category}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 mb-3">
                        KES {Number(fee.amount ?? 0).toLocaleString()}
                      </p>
                      {fee.description && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{fee.description}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditFee(fee)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFee.mutate(fee.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="history">
            <PaymentHistory 
              payments={selectedStudentFee 
                ? (allPayments || []).filter((p: any) => p.student_id === selectedStudentFee.student_id)
                : (allPayments || [])
              } 
              isLoading={loadingPayments}
              showStudentInfo={true}
            />
            {selectedStudentFee && (
              <Button
                variant="outline"
                onClick={() => setSelectedStudentFee(null)}
                className="mt-4"
              >
                Show All Payments
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {/* Fee Form Dialog */}
        <Dialog open={showFeeForm} onOpenChange={setShowFeeForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedFee ? "Update Fee Structure" : "Create Fee Structure"}</DialogTitle>
            </DialogHeader>
            <FeeStructureForm
              fee={selectedFee}
              onSave={(data: any) => feeMutation.mutate({
                ...data,
                student_type: data.student_type,
                amount: Number(data.amount),
                academic_year: data.academic_year
              })}
              onCancel={() => { setShowFeeForm(false); setSelectedFee(null); }}
              isLoading={(feeMutation as any).isLoading}
            />
          </DialogContent>
        </Dialog>

        {/* Payment Form Dialog */}
        <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
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
    </div>
  );
}