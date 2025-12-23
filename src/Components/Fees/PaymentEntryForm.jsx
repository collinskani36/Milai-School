import React, { useState } from 'react';
import { supabase } from "@/lib/supabaseClient"; // ← required
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, X, Check } from "lucide-react";
import { format } from "date-fns";

export default function PaymentEntryForm({ studentFee, onSave, onCancel }) {

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'Bank Transfer',
    reference_number: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 🔥 Supabase Insert Handler
  const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);

  const { amount, payment_date, payment_method, reference_number, notes } = formData;

  console.log("Submitting payment for:", {
    student_id: studentFee.student_id,
    fee_id: studentFee.id,
    amount,
    payment_method,
    reference_number,
    payment_date,
    notes
  });

  try {
    const { data, error } = await supabase
      .from('p_payments')
      .insert([{
        student_id: studentFee.student_id,
        fee_id: studentFee.id, // Use the fee record already loaded
        amount_paid: parseFloat(amount) || 0,
        payment_method,
        reference_number,
        payment_date,
        notes,
        academic_year: studentFee.academic_year,
        term: studentFee.term
      }])
      .select()
      .single();

    if (error) throw error;

    console.log("Payment inserted successfully:", data);

    // Update student_fee totals
    const newTotalPaid = Number(studentFee.total_paid || 0) + (parseFloat(amount) || 0);
    const newBalance = Number(studentFee.total_billed || 0) - newTotalPaid;
    const status = newBalance <= 0 ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending';

    const { error: updateError } = await supabase
      .from('student_fees')
      .update({
        total_paid: newTotalPaid,
        outstanding_balance: newBalance,
        last_payment_date: payment_date,
        status
      })
      .eq('id', studentFee.id);

    if (updateError) throw updateError;

    console.log("Student fee updated successfully");

    alert("✅ Payment recorded successfully");
    onSave(data);
  } catch (err) {
    console.error("Payment submission error:", err);
    alert("❌ Failed to record payment");
  } finally {
    setIsLoading(false);
  }
};



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
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">

        {/* BILL SUMMARY */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
          <div className="grid grid-cols-3 gap-4 text-center">

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Billed</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                KES {studentFee.total_billed?.toLocaleString() || 0}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Paid</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">
                KES {studentFee.total_paid?.toLocaleString() || 0}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Balance</p>
              <p className="text-lg font-bold text-red-600 mt-1">
                KES {studentFee.outstanding_balance?.toLocaleString() || 0}
              </p>
            </div>

          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="space-y-2">
              <Label>Payment Amount (KES)</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="h-11 text-lg font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={formData.payment_method} onValueChange={(v) => handleChange("payment_method", v)}>
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
              <Label>Reference Number</Label>
              <Input
                placeholder="Receipt ID / Txn Code"
                value={formData.reference_number}
                onChange={(e) => handleChange('reference_number', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={(e) => handleChange('payment_date', e.target.value)}
                required
              />
            </div>

          </div>

          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">

            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>

            <Button type="submit" disabled={isLoading} className="bg-emerald-600">
              {isLoading ? "Processing..." : <><Check className="w-4 h-4 mr-2" />Record Payment</>}
            </Button>

          </div>

        </form>
      </CardContent>
    </Card>
  );
}
