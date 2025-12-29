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
  Settings, Receipt, RefreshCw, FileText, Download, UserCheck
} from "lucide-react";

import FeeStructureForm from "@/Components/fees/FeeStructureForm";
import PaymentEntryForm from "@/Components/fees/PaymentEntryForm";
import PaymentHistory from "@/Components/Fees/PaymentHistory";
import StudentFeeCard from "@/Components/fees/StudentFeeCard";

import { supabase } from "@/lib/supabaseClient";

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
  

  // FETCH ALL PAYMENTS from p_payments table
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
      
      console.log(`Fetched ${data?.length || 0} payments from p_payments`);
      return data || [];
    }
  });

  // FETCH STUDENT FEES - AGGREGATED BY STUDENT WITH STUDENT TYPE
  // UPDATED: Now calculates total_paid from p_payments table instead of student_fees
  const { data: studentFees = [], isLoading: loadingStudentFees } = useQuery({
    queryKey: ["studentFees", allPayments],
    queryFn: async () => {
      console.log("Fetching student fees from Supabase...");

      // Fetch student fees
      const { data: feesData, error: feesError } = await supabase
        .from("student_fees")
        .select("*")
        .order("inserted_at", { ascending: false });
      
      if (feesError) {
        console.error("Error fetching student fees:", feesError);
        throw feesError;
      }

      // Fetch students with their profiles
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
          id,
          student_id,
          class_id,
          classes (id, name)
        `);
      
      if (enrollmentsError) {
        console.error("Error fetching enrollments:", enrollmentsError);
        throw enrollmentsError;
      }

      // Create a map to store payments by student_id for quick lookup
      const paymentsByStudent = new Map();
      if (allPayments && allPayments.length > 0) {
        allPayments.forEach((payment: any) => {
          const studentId = payment.student_id;
          const currentTotal = paymentsByStudent.get(studentId) || 0;
          paymentsByStudent.set(studentId, currentTotal + Number(payment.amount_paid || 0));
        });
        console.log("Payments by student map created:", paymentsByStudent.size, "students");
      }

      // Aggregate student fees
      const studentFeeMap = new Map();

      feesData.forEach((fee) => {
        const studentId = fee.student_id;
        const studentKey = studentId;
        
        if (!studentFeeMap.has(studentKey)) {
          const student = studentsData.find(s => s.id === studentId);
          const enrollment = enrollmentsData.find(e => e.student_id === studentId);

          // Use DB value for consistency
          const studentType = student?.profiles?.[0]?.student_type || "Day Scholar";

          studentFeeMap.set(studentKey, {
            id: studentId,
            student_id: studentId,
            student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
            admission_number: student?.Reg_no || "N/A",
            student_type: studentType,
            display_type: studentType,
            class_name: enrollment?.classes?.name || "Not Assigned",
            total_billed: 0,
            // Initialize total_paid from p_payments table
            total_paid: paymentsByStudent.get(studentId) || 0,
            outstanding_balance: 0,
            fee_records: [],
            last_payment_date: null,
            academic_years: new Set(),
            payments: [] // Store individual payments for this student
          });
        }

        const studentFee = studentFeeMap.get(studentKey);
        studentFee.total_billed += Number(fee.total_billed) || 0;
        
        // Add fee record
        studentFee.fee_records.push(fee);
        studentFee.academic_years.add(fee.academic_year);

        // Update last payment date if this fee has one
        if (fee.last_payment_date) {
          if (!studentFee.last_payment_date || new Date(fee.last_payment_date) > new Date(studentFee.last_payment_date)) {
            studentFee.last_payment_date = fee.last_payment_date;
          }
        }
      });

      // After processing all fees, calculate outstanding balance and status
      const aggregatedData = Array.from(studentFeeMap.values()).map(student => {
        // Recalculate outstanding balance using total_paid from p_payments
        student.outstanding_balance = student.total_billed - student.total_paid;
        
        // Determine status based on calculated balances
        if (student.outstanding_balance <= 0) {
          student.status = "Paid";
        } else if (student.total_paid > 0) {
          student.status = "Partial";
        } else {
          student.status = "Unpaid";
        }
        
        // Get payments for this student from allPayments
        student.payments = allPayments.filter((p: any) => p.student_id === student.student_id);
        
        // Find the most recent payment date from p_payments if not set from student_fees
        if (!student.last_payment_date && student.payments.length > 0) {
          const latestPayment = student.payments.reduce((latest: any, current: any) => {
            return new Date(current.payment_date) > new Date(latest.payment_date) ? current : latest;
          }, student.payments[0]);
          student.last_payment_date = latestPayment.payment_date;
        }
        
        return {
          ...student,
          academic_years: Array.from(student.academic_years)
        };
      });

      console.log("Aggregated student fees with payments from p_payments:", aggregatedData.length, "students");
      console.log("Sample student:", aggregatedData[0] ? {
        name: aggregatedData[0].student_name,
        total_billed: aggregatedData[0].total_billed,
        total_paid: aggregatedData[0].total_paid,
        outstanding_balance: aggregatedData[0].outstanding_balance,
        status: aggregatedData[0].status,
        payment_count: aggregatedData[0].payments?.length || 0
      } : "No data");
      
      return aggregatedData;
    },
    enabled: true, // Always enabled since we need this for the dashboard
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

  // Fee Mutation - FIXED: Now properly filters by both class AND student type
  const feeMutation = useMutation({
    mutationFn: async (data: any) => {
      const classes = data.classes || [];
      delete data.classes;

      const payload = {
        ...data,
        student_type: data.student_type,
      };

      let feeId = selectedFee?.id;

      // 1) Insert or update fee_structure
      if (selectedFee) {
        const { error: feeError } = await supabase
          .from("fee_structure")
          .update(payload)
          .eq("id", feeId);
        if (feeError) throw feeError;

        // clear previous class mappings
        const { error: delErr } = await supabase
          .from("fee_structure_classes")
          .delete()
          .eq("fee_structure_id", feeId);
        if (delErr) throw delErr;

        // re-insert class mappings if provided
        if (classes.length > 0) {
          const classMapping = classes.map(class_id => ({
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
          const classMapping = classes.map(class_id => ({
            fee_structure_id: feeId,
            class_id,
          }));
          const { error: classErr } = await supabase
            .from("fee_structure_classes")
            .insert(classMapping);
          if (classErr) throw classErr;
        }
      }

      // 2) If there are classes mapped, ONLY create student_fees for students in those classes with matching student_type
      if (classes.length > 0) {
        // Get students in the selected classes with their profiles
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

        // Filter students by the fee's student_type
        const matchingStudents = enrollmentsWithStudents.filter(item => 
          item.students?.profiles?.[0]?.student_type === payload.student_type
        );

        const matchingStudentIds = matchingStudents.map(item => item.student_id);

        if (matchingStudentIds.length === 0) {
          console.log(`No ${payload.student_type} students found in selected classes`);
          return { success: true };
        }

        console.log(`Found ${matchingStudentIds.length} ${payload.student_type} students in selected classes`, matchingStudentIds);

        // 3) Fetch existing student_fees for this fee_structure
        const { data: existingFees = [], error: existingErr } = await supabase
          .from("student_fees")
          .select("*")
          .in("student_id", matchingStudentIds)
          .eq("fee_structure_id", feeId);
        if (existingErr) throw existingErr;

        const existingMap = new Map();
        existingFees.forEach((ef: any) => existingMap.set(ef.student_id, ef));

        // 4) Prepare batch inserts and updates - ONLY for matching students
        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const enrollment of matchingStudents) {
          const studentId = enrollment.student_id;
          const student = enrollment.students;
          const existing = existingMap.get(studentId);

          // Get existing payments for this student from p_payments for this fee structure
          const { data: studentPayments, error: paymentsError } = await supabase
            .from('p_payments')
            .select('amount_paid')
            .eq('student_id', studentId)
            .eq('fee_id', feeId);
          
          const existingPaid = studentPayments?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;

          const feePayload = {
            student_id: studentId,
            fee_structure_id: feeId,
            total_billed: payload.amount,
            total_paid: existingPaid, // Use actual payments from p_payments
            outstanding_balance: payload.amount - existingPaid,
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

        console.log(`Inserting ${toInsert.length} new student fees, updating ${toUpdate.length} existing fees`);

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

  // Record payment mutation - Using selectedStudentFee directly
  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Starting payment mutation...", { data, selectedStudentFee });

      if (!selectedStudentFee) {
        console.error("No student fee record selected!");
        throw new Error("No student fee record selected");
      }

      // Find the specific fee record to apply payment to
      const feeRecord = selectedStudentFee;
      const amount = parseFloat(data.amount) || 0;

      console.log("Preparing to insert payment for student:", {
        student_id: feeRecord.student_id,
        amount_paid: amount,
        payment_method: data.payment_method,
      });

      // Insert payment into p_payments table
      const { data: paymentInserted, error: paymentError } = await supabase
        .from("p_payments")
        .insert({
          student_id: feeRecord.student_id,
          fee_id: feeRecord.fee_structure_id, // Use fee_structure_id if available
          amount_paid: amount,
          payment_method: data.payment_method || "mpesa",
          payment_date: data.payment_date || new Date().toISOString(),
          transaction_reference: data.reference_number || null,
          status: "completed",
          academic_year: data.academic_year || feeRecord.academic_year || "2024-2025",
          term: data.term || feeRecord.term || "Term 1",
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Error inserting payment:", paymentError);
        throw paymentError;
      }

      console.log("Payment inserted successfully:", paymentInserted);

      // Get all payments for this student to calculate new totals
      const { data: studentPayments, error: paymentsError } = await supabase
        .from('p_payments')
        .select('amount_paid')
        .eq('student_id', feeRecord.student_id);
      
      if (paymentsError) {
        console.error("Error fetching student payments:", paymentsError);
        throw paymentsError;
      }

      // Calculate total paid from p_payments
      const totalPaidFromPayments = studentPayments?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
      
      // Update ALL student_fees records for this student
      const { data: studentFeeRecords, error: feeRecordsError } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', feeRecord.student_id);
      
      if (feeRecordsError) {
        console.error("Error fetching student fee records:", feeRecordsError);
        throw feeRecordsError;
      }

      // Update each student fee record
      const updatePromises = studentFeeRecords?.map(async (record) => {
        const newBalance = Number(record.total_billed || 0) - totalPaidFromPayments;
        const status = newBalance <= 0 ? "paid" : totalPaidFromPayments > 0 ? "partial" : "pending";
        
        return supabase
          .from("student_fees")
          .update({
            total_paid: totalPaidFromPayments,
            outstanding_balance: newBalance,
            last_payment_date: data.payment_date || new Date().toISOString(),
            status,
          })
          .eq("id", record.id);
      }) || [];

      await Promise.all(updatePromises);

      console.log("All student fee records updated successfully");

      return paymentInserted;
    },
    onSuccess: () => {
      console.log("Payment mutation successful, invalidating queries...");
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

  // Filter student fees based on search and filters
  const filteredStudentFees = useMemo(() => {
    return (studentFees || []).filter((sf: any) => {
      const matchesSearch = !searchQuery || 
        (sf.student_name && sf.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sf.admission_number && sf.admission_number.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesYear = selectedYear === 'all' || sf.academic_years?.includes(selectedYear);
      
      // FIXED: Use correct student_type values from your data
      const matchesStudentType = selectedStudentType === 'all' || 
        (selectedStudentType === 'day' && sf.student_type === 'Day Scholar') ||
        (selectedStudentType === 'boarder' && sf.student_type === 'Boarding');

      return matchesSearch && matchesYear && matchesStudentType;
    });
  }, [studentFees, searchQuery, selectedYear, selectedStudentType]);

  // Calculate summary statistics - UPDATED to use payments from p_payments table
  const stats = useMemo(() => {
    const filtered = filteredStudentFees || [];
    const totalStudents = filtered.length;
    
    const totalBilled = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.total_billed ?? 0);
    }, 0);
    
    // Total collected from p_payments table (sum of total_paid from studentFees which now comes from p_payments)
    const totalCollected = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.total_paid ?? 0);
    }, 0);
    
    // Total outstanding calculated from the data
    const totalOutstanding = filtered.reduce((sum: number, sf: any) => {
      return sum + Number(sf.outstanding_balance ?? 0);
    }, 0);

    // Also calculate total collected from allPayments for verification
    const totalFromPaymentsTable = allPayments.reduce((sum: number, p: any) => {
      return sum + Number(p.amount_paid || 0);
    }, 0);

    console.log("Dashboard Stats:", {
      totalStudents,
      totalBilled,
      totalCollected,
      totalOutstanding,
      totalFromPaymentsTable,
      filteredCount: filtered.length,
      allPaymentsCount: allPayments.length
    });

    return { totalStudents, totalBilled, totalCollected, totalOutstanding };
  }, [filteredStudentFees, allPayments]);

  const handleRecordPayment = (studentFee: any) => {
    setSelectedStudentFee(studentFee);
    setShowPaymentForm(true);
  };

  const handleViewDetails = (studentFee: any) => {
    setSelectedStudentFee(studentFee);
    setActiveTab('history');
  };

  const handleEditFee = (fee: any) => {
    // Transform the fee data to include classes array for the form
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

        {/* Stats Cards - IMPROVED with payment source info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-shadow">
                <div className={`h-1 bg-${stat.color}-500`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-${stat.color}-50`}>
                      <Icon className={`w-5 h-5 text-${stat.color}-600`} />
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

            {/* Student Fee Cards - ONE CARD PER STUDENT */}
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
                {filteredStudentFees.map((studentFee) => (
                  <StudentFeeCard
                    key={studentFee.student_id}
                    studentFee={studentFee}
                    onRecordPayment={handleRecordPayment}
                    onViewDetails={handleViewDetails}
                    showAggregated={true}
                    // Pass payments count for display
                    paymentCount={studentFee.payments?.length || 0}
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
              isLoading={feeMutation.isLoading}
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
                  term: selectedStudentFee.term || "Term 1",
                  academic_year: selectedStudentFee.academic_year || "2024-2025"
                })}
                onCancel={() => { setShowPaymentForm(false); setSelectedStudentFee(null); }}
                isLoading={paymentMutation.isLoading}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}