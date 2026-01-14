import React, { useState } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Textarea } from "@/Components/ui/textarea";
import { CreditCard, X, Check, AlertCircle, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function PaymentEntryForm({ 
  studentFee, 
  onSave, 
  onCancel,
  isLoading = false,
  availableCredit = 0 
}) {

  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'Bank Transfer',
    reference_number: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    apply_credit: false
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { amount, payment_date, payment_method, reference_number, notes, apply_credit } = formData;
    const paymentAmount = parseFloat(amount) || 0;

    if (paymentAmount <= 0) {
      alert("❌ Please enter a valid payment amount");
      return;
    }

    // Get the current term fee record
    const currentTermFee = studentFee.current_term_fee || studentFee;
    
    console.log("Submitting payment for student:", {
      student_id: studentFee.student_id,
      fee_id: currentTermFee.id,
      amount_paid: paymentAmount,
      payment_method,
      reference_number,
      payment_date,
      notes,
      academic_year: currentTermFee.academic_year || studentFee.academic_year,
      term: currentTermFee.term || studentFee.term,
      apply_credit: apply_credit && availableCredit > 0
    });

    try {
      // Insert payment - database triggers will handle the rest
      const { data, error } = await supabase
        .from('p_payments')
        .insert([{
          student_id: studentFee.student_id,
          fee_id: currentTermFee.id,
          amount_paid: paymentAmount,
          payment_method: payment_method || 'Bank Transfer',
          reference_number: reference_number || null,
          payment_date: payment_date || new Date().toISOString(),
          notes: notes || null,
          academic_year: currentTermFee.academic_year || studentFee.academic_year,
          term: currentTermFee.term || studentFee.term,
          status: 'completed'
        }])
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Payment inserted successfully. Database triggers will update student_fees.");

      // Call onSave to refresh data and close dialog
      onSave({
        ...data,
        amount_paid: paymentAmount,
        payment_method,
        reference_number
      });

    } catch (err) {
      console.error("❌ Payment submission error:", err);
      alert(`❌ Failed to record payment: ${err.message || 'Unknown error'}`);
    }
  };

  // Calculate maximum payable amount (outstanding balance + available credit)
  const maxPayable = (studentFee.outstanding_balance || 0) + (availableCredit || 0);
  
  // Get the current term fee for display
  const currentTermFee = studentFee.current_term_fee || studentFee;

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">Record Payment</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              {studentFee.student_name} • {studentFee.admission_number}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Class: {studentFee.class_name} • {studentFee.student_type || 'Day Scholar'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">

        {/* BILL SUMMARY */}
        <div className="mb-6 space-y-4">
          {/* Current Term Summary */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {currentTermFee.term || 'Current Term'} • {currentTermFee.academic_year || 'Current Year'}
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Billed</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  KES {currentTermFee.total_billed?.toLocaleString() || 0}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Paid</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                  KES {currentTermFee.total_paid?.toLocaleString() || 0}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Balance</p>
                <p className={`text-lg font-bold mt-1 ${currentTermFee.outstanding_balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  KES {currentTermFee.outstanding_balance?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Aggregated Summary (if showing aggregated view) */}
          {studentFee.total_credit_carried > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Credit Available</span>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  KES {studentFee.total_credit_carried?.toLocaleString() || availableCredit.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                This credit will be automatically applied to current and future term fees
              </p>
            </div>
          )}

          {/* Payment Advice */}
          {maxPayable > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">
                    Maximum payable amount: <span className="font-semibold">KES {maxPayable.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {availableCredit > 0 
                      ? `Includes KES ${availableCredit.toLocaleString()} credit from previous terms`
                      : 'Any overpayment will be stored as credit for future terms'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={maxPayable}
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="h-11 text-lg font-medium"
                placeholder="Enter amount"
                required
              />
              <p className="text-xs text-gray-500">
                Enter amount up to KES {maxPayable.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select 
                value={formData.payment_method} 
                onValueChange={(v) => handleChange("payment_method", v)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                placeholder="Receipt ID / Transaction Code"
                value={formData.reference_number}
                onChange={(e) => handleChange('reference_number', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => handleChange('payment_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="min-h-[80px]"
              placeholder="Add any additional notes about this payment..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>

            <Button 
              type="submit" 
              disabled={isLoading || !formData.amount || parseFloat(formData.amount) <= 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" /> Record Payment
                </>
              )}
            </Button>
          </div>

          {/* Database Trigger Notice */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Note: Payment processing and credit calculations are handled automatically by the database system.
              {availableCredit > 0 && " Any available credit will be applied first."}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}