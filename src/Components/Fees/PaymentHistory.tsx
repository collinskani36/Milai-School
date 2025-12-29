"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { Receipt, Calendar, CreditCard, Hash, Clock } from "lucide-react";
import { format } from "date-fns";

// ======================
// 🔹 TypeScript Interface
// ======================
export interface PaymentRecord {
  id: string | number;
  // canonical fields
  amount?: number;
  date?: string | null;
  reference_no?: string | null;
  method?: string | null;
  term?: string | null;
  academic_year?: string | null;
  // legacy/alternate fields used elsewhere in the app
  amount_paid?: number;
  payment_date?: string | null;
  reference_number?: string | null;
  transaction_reference?: string | null;
  payment_method?: string | null;
}

interface PaymentHistoryProps {
  payments: PaymentRecord[];
  isLoading?: boolean;
  showStudentInfo?: boolean;
  selectedTerm?: string;
  selectedYear?: string;
}

// =====================================================
// 🔥 Payment History Card (Now Fully TypeScript-capable)
// =====================================================
export default function PaymentHistory({
  payments = [],
  isLoading = false,
  showStudentInfo = false,
}: PaymentHistoryProps) {
  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-6">Loading payments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur">
      <div className="h-1.5 bg-gradient-to-r from-rose-400 via-violet-500 to-indigo-500" />

      <CardHeader className="flex flex-row items-center gap-3 pb-3 border-b">
        <div className="p-2 rounded-lg bg-violet-100">
          <Receipt className="w-5 h-5 text-violet-700" />
        </div>
        <CardTitle className="text-base font-semibold">Payment History</CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
          <ScrollArea className="h-[290px] pr-2">
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No payments recorded yet
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((pay) => (
  <div
    key={pay.id}
    className="p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition-all"
  >
    <div className="flex justify-between items-center mb-2">
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
        <CreditCard className="w-3 h-3 mr-1" />
        {(pay.payment_method || pay.method) ?? "Unknown"}
      </Badge>

      <p className="font-semibold text-gray-900">
        KES {(pay.amount_paid ?? pay.amount ?? 0).toLocaleString()}
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
      <div className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {(pay.payment_date ?? pay.date) ? format(new Date((pay.payment_date ?? pay.date) as string), "dd MMM yyyy") : "No Date"}
      </div>
      <div className="flex items-center gap-1">
        <Hash className="w-3 h-3" />
        Ref: {pay.transaction_reference || pay.reference_number || pay.reference_no || "-"}
      </div>
      {pay.term && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {pay.term}
        </div>
      )}
      {pay.academic_year && <span>Year: {pay.academic_year}</span>}
    </div>
  </div>
))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
