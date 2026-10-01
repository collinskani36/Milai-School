import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  });

  // Which term's fee record the payment is applied to (null = oldest term with a balance)
  const [applyToId, setApplyToId] = useState(null);

  // Guard against double submissions
  const isSubmittingRef = useRef(false);
  const resetTimerRef = useRef(null);

  // Reset the guard once the parent finishes saving (success or failure),
  // so the user can retry after an error.
  useEffect(() => {
    if (!isLoading) {
      isSubmittingRef.current = false;
    }
  }, [isLoading]);

  // Clear any pending fallback timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double submission
    if (isSubmittingRef.current) return;

    const paymentAmount = parseFloat(formData.amount) || 0;

    if (paymentAmount <= 0) {
      alert("❌ Please enter a valid payment amount");
      return;
    }

    isSubmittingRef.current = true;

    // Fallback: if the parent never toggles isLoading, release the guard
    // after 3 seconds so the form can't get stuck.
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      isSubmittingRef.current = false;
    }, 3000);

    // Do NOT insert into Supabase here.
    // Just pass the raw form data up — the parent's paymentMutation owns the single DB insert.
    onSave({
      amount: formData.amount,
      payment_method: formData.payment_method,
      reference_number: formData.reference_number,
      payment_date: formData.payment_date,
      notes: formData.notes,
      // which term's fee record receives this payment
      fee_id: effectiveApplyId,
      term: applyTarget?.term,
      academic_year: applyTarget?.year,
    });
  };

  // ── Per-term breakdown: every fee record for this student, oldest first ──
  const termNum = (t) => parseInt(String(t || '').match(/\d+/)?.[0] || '0', 10);

  const termRows = useMemo(() => {
    const records =
      Array.isArray(studentFee.fee_records) && studentFee.fee_records.length > 0
        ? studentFee.fee_records
        : [studentFee.current_term_fee || studentFee];
    return records
      .map((r) => {
        const billed = Number(r.total_billed) || 0;
        const paid = Number(r.total_paid) || 0;
        const credit = Number(r.credit_carried) || 0;
        return {
          id: r.id,
          term: r.term || 'Term',
          year: r.academic_year || '',
          billed,
          paid,
          credit,
          outstanding: Math.max(0, billed - paid - credit),
        };
      })
      .sort((a, b) => a.year.localeCompare(b.year) || termNum(a.term) - termNum(b.term));
  }, [studentFee]);

  const outstandingRows = termRows.filter((r) => r.outstanding > 0);
  const paidUpCount = termRows.length - outstandingRows.length;
  const totalBilledAll = termRows.reduce((n, r) => n + r.billed, 0);
  const totalPaidAll = termRows.reduce((n, r) => n + r.paid, 0);
  const totalOutstandingAll = outstandingRows.reduce((n, r) => n + r.outstanding, 0);

  // Default target: oldest term still owing; otherwise the latest term
  const effectiveApplyId =
    applyToId ??
    outstandingRows[0]?.id ??
    termRows[termRows.length - 1]?.id ??
    studentFee.current_term_fee?.id;
  const applyTarget =
    termRows.find((r) => r.id === effectiveApplyId) || termRows[termRows.length - 1];

  // Calculate maximum payable amount
  const maxPayable = (studentFee.outstanding_balance || 0) + (availableCredit || 0);

  // Get the current term fee for display
  const currentTermFee = studentFee.current_term_fee || studentFee;

  return (
    // Fills whatever space the parent dialog gives it (flex-1 min-h-0) and never overflows it.
    // Student header and footer buttons stay fixed; only the middle section scrolls.
    <Card className="flex flex-col flex-1 w-full min-w-0 min-h-0 max-h-full overflow-hidden rounded-none border-0 shadow-none bg-transparent">
      <CardHeader className="shrink-0 px-4 sm:px-6 py-3 border-y border-gray-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-100 flex-shrink-0">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 break-words">
              {studentFee.student_name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5 break-words">
              {studentFee.admission_number}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 break-words">
              Class: {studentFee.class_name} • {studentFee.student_type || 'Day Scholar'}
            </p>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

        {/* SCROLLABLE BODY */}
        <CardContent className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 py-4 space-y-5">

          {/* BILL SUMMARY */}
          <div className="space-y-3 sm:space-y-4">
            {/* Combined totals across all terms */}
            <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                All terms combined
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 sm:text-center">
                <div className="flex items-baseline justify-between gap-3 sm:block min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Billed</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 sm:mt-1 break-words">
                    KES {totalBilledAll.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-3 sm:block min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Paid</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-600 sm:mt-1 break-words">
                    KES {totalPaidAll.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-3 sm:block min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total balance</p>
                  <p className={`text-base sm:text-lg font-bold sm:mt-1 break-words ${totalOutstandingAll > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    KES {totalOutstandingAll.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Outstanding balance per term */}
            <div className="rounded-xl border border-red-100 bg-white overflow-hidden">
              <div className="px-3 sm:px-4 py-2.5 bg-red-50/60 border-b border-red-100">
                <h4 className="text-sm font-semibold text-gray-700">
                  {outstandingRows.length > 0
                    ? `Outstanding by term (${outstandingRows.length})`
                    : 'No outstanding balances'}
                </h4>
              </div>
              {outstandingRows.length > 0 && (
                <ul className="divide-y divide-gray-100">
                  {outstandingRows.map((r) => (
                    <li key={r.id ?? `${r.term}-${r.year}`} className="px-3 sm:px-4 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900 min-w-0 break-words">
                          {r.term}{r.year ? ` • ${r.year}` : ''}
                        </p>
                        <p className="text-sm font-bold text-red-600 text-right flex-shrink-0">
                          KES {r.outstanding.toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 break-words">
                        Billed {r.billed.toLocaleString()} • Paid {r.paid.toLocaleString()}
                        {r.credit > 0 ? ` • Credit ${r.credit.toLocaleString()}` : ''}
                      </p>
                    </li>
                  ))}
                  {outstandingRows.length > 1 && (
                    <li className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 bg-gray-50">
                      <span className="text-sm font-semibold text-gray-700">Total outstanding</span>
                      <span className="text-sm font-bold text-red-700">
                        KES {totalOutstandingAll.toLocaleString()}
                      </span>
                    </li>
                  )}
                </ul>
              )}
              {paidUpCount > 0 && (
                <p className="px-3 sm:px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                  {paidUpCount} other term{paidUpCount > 1 ? 's' : ''} fully paid
                </p>
              )}
            </div>

            {/* Credit Available */}
            {studentFee.total_credit_carried > 0 && (
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <DollarSign className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-700">Credit Available</span>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-blue-700 text-right break-words">
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
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 break-words">
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

          {/* FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {outstandingRows.length > 1 && (
              <div className="space-y-2 min-w-0 sm:col-span-2">
                <Label htmlFor="apply_to">Apply payment to</Label>
                <Select value={String(effectiveApplyId)} onValueChange={(v) => setApplyToId(v)}>
                  <SelectTrigger id="apply_to" className="h-11 w-full">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {outstandingRows.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.term} {r.year} — KES {r.outstanding.toLocaleString()} owing
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Defaults to the oldest term with a balance.
                </p>
              </div>
            )}

            <div className="space-y-2 min-w-0">
              <Label htmlFor="amount">Payment Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={maxPayable}
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="h-11 w-full text-base sm:text-lg font-medium"
                placeholder="Enter amount"
                required
              />
              <p className="text-xs text-gray-500 break-words">
                Enter amount up to KES {maxPayable.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2 min-w-0">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) => handleChange("payment_method", v)}
              >
                <SelectTrigger id="payment_method" className="h-11 w-full">
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

            <div className="space-y-2 min-w-0">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                className="h-11 w-full"
                placeholder="Receipt ID / Transaction Code"
                value={formData.reference_number}
                onChange={(e) => handleChange('reference_number', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label htmlFor="payment_date">Payment Date</Label>
              {/* min-w-0 + w-full + max-w-full stops native date inputs overflowing on mobile */}
              <Input
                id="payment_date"
                type="date"
                className="h-11 w-full min-w-0 max-w-full"
                value={formData.payment_date}
                onChange={(e) => handleChange('payment_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 min-w-0 sm:col-span-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="min-h-[80px] w-full"
                placeholder="Add any additional notes about this payment..."
              />
            </div>
          </div>

          <p className="pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
            Payment processing and credit calculations are handled automatically by the database system.
            {availableCredit > 0 && " Any available credit will be applied first."}
          </p>
        </CardContent>

        {/* FIXED FOOTER — always visible, never cropped */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full sm:w-auto h-11 sm:h-10"
            >
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>

            <Button
              type="submit"
              disabled={isLoading || !formData.amount || parseFloat(formData.amount) <= 0}
              className="w-full sm:w-auto h-11 sm:h-10 bg-emerald-600 hover:bg-emerald-700"
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
        </div>
      </form>
    </Card>
  );
}