import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { ScrollArea } from "@/Components/ui/scroll-area";
import {
  Receipt, Calendar, CreditCard, Hash, DollarSign,
  User, School, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  term?: string;
  academic_year?: string;
  amount_paid?: number;
  amount?: number;
  payment_date?: string;
  date?: string;
  inserted_at?: string;
  payment_method?: string;
  method?: string;
  status?: string;
  reference_number?: string;
  transaction_reference?: string;
  reference_no?: string;
  notes?: string;
  student_name?: string;
  admission_number?: string;
  credit_used?: number;
  resulted_in_credit?: boolean;
  credit_amount?: number;
  [key: string]: unknown;
}

interface PaymentHistoryProps {
  payments?: Payment[];
  isLoading?: boolean;
  showStudentInfo?: boolean;
  selectedTerm?: string | null;
  selectedYear?: string | null;
  currentTerm?: { term: string; academic_year: string } | null; // NEW: active term from parent
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:    "bg-amber-50 text-amber-700 border-amber-200",
  failed:     "bg-red-50 text-red-700 border-red-200",
  refunded:   "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-purple-50 text-purple-700 border-purple-200",
};

function getStatusColor(status?: string) {
  return STATUS_COLORS[status?.toLowerCase() ?? ""] ?? "bg-gray-50 text-gray-700 border-gray-200";
}

function formatDate(dateString?: string) {
  if (!dateString) return "No Date";
  try { return format(new Date(dateString), "dd MMM yyyy, HH:mm"); }
  catch { return "Invalid Date"; }
}

function paymentAmount(p: Payment) {
  return parseFloat(String(p.amount_paid ?? p.amount ?? 0)) || 0;
}

// ─── Payment Row ──────────────────────────────────────────────────────────────

function PaymentRow({ payment, showStudentInfo }: { payment: Payment; showStudentInfo: boolean }) {
  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all">

      {/* Top row: method badge + amount */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`${getStatusColor(payment.status)} flex items-center gap-1`}
          >
            <CreditCard className="w-3 h-3" />
            {payment.payment_method ?? payment.method ?? "Unknown"}
          </Badge>
          {payment.status && payment.status !== "completed" && (
            <Badge variant="outline" className={getStatusColor(payment.status)}>
              {payment.status}
            </Badge>
          )}
          {/* Cross-term label — shown when notes contain the allocation marker */}
          {payment.notes?.includes("Cross-term allocation") && (
            <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-0 py-0">
              Cross-term
            </Badge>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-900 text-lg">
            KES {paymentAmount(payment).toLocaleString()}
          </p>
          {payment.notes && (
            <p className="text-xs text-gray-500 truncate max-w-[180px]" title={payment.notes}>
              {payment.notes}
            </p>
          )}
        </div>
      </div>

      {/* Student info */}
      {showStudentInfo && payment.student_name && (
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-2 p-2 bg-gray-50 rounded-lg">
          <User className="w-3 h-3" />
          <span className="font-medium">{payment.student_name}</span>
          {payment.admission_number && (
            <span className="text-gray-500">• {payment.admission_number}</span>
          )}
        </div>
      )}

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span>{formatDate(payment.payment_date ?? payment.date)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            Ref: {payment.reference_number ?? payment.transaction_reference ?? payment.reference_no ?? "—"}
          </span>
        </div>
        {payment.term && (
          <div className="flex items-center gap-1">
            <BookOpen className="w-3 h-3 flex-shrink-0" />
            <span>{payment.term}</span>
          </div>
        )}
        {payment.academic_year && (
          <div className="flex items-center gap-1">
            <School className="w-3 h-3 flex-shrink-0" />
            <span>{payment.academic_year}</span>
          </div>
        )}
      </div>

      {/* Credit used indicator */}
      {(payment.credit_used ?? 0) > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-xs text-blue-600">
          <DollarSign className="w-3 h-3" />
          <span>Applied KES {payment.credit_used!.toLocaleString()} credit from previous term</span>
        </div>
      )}

      {/* Overpayment / credit created indicator */}
      {payment.resulted_in_credit && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-xs text-emerald-600">
          <DollarSign className="w-3 h-3" />
          <span>Created KES {payment.credit_amount?.toLocaleString() ?? "credit"} for future terms</span>
        </div>
      )}

      {/* Metadata footer */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-[10px] text-gray-400">
        <span>ID: {payment.id?.substring(0, 8)}…</span>
        {payment.inserted_at && (
          <span>{format(new Date(payment.inserted_at), "dd MMM yy")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Term Group ───────────────────────────────────────────────────────────────

function TermGroup({
  termLabel,
  payments,
  showStudentInfo,
  defaultOpen = true,
  isActive = false, // NEW: whether this term is the currently active term
}: {
  termLabel: string;
  payments: Payment[];
  showStudentInfo: boolean;
  defaultOpen?: boolean;
  isActive?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const total = payments.reduce((s, p) => s + paymentAmount(p), 0);

  return (
    <div className={`rounded-xl border overflow-hidden ${isActive ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200'}`}>
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left ${
          isActive ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">{termLabel}</span>
          <Badge className="text-[10px] bg-white text-gray-600 border border-gray-200 py-0">
            {payments.length} payment{payments.length !== 1 ? "s" : ""}
          </Badge>
          {isActive && (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
              Active Term
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-emerald-700">
            KES {total.toLocaleString()}
          </span>
          {open
            ? <ChevronUp   className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {/* Payment rows */}
      {open && (
        <div className="p-3 space-y-3 bg-white">
          {payments.map(p => (
            <PaymentRow key={p.id} payment={p} showStudentInfo={showStudentInfo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentHistory({
  payments = [],
  isLoading = false,
  showStudentInfo = false,
  selectedTerm = null,
  selectedYear = null,
  currentTerm, // NEW
}: PaymentHistoryProps) {

  // Show ALL payments for the selected academic year (not just the selected term).
  // This ensures cross-term payments are visible even when they were recorded
  // against Term 1 but also reduced Term 2's balance.
  const yearPayments = React.useMemo(() => {
    if (!selectedYear) return payments;
    return payments.filter(p => p.academic_year === selectedYear);
  }, [payments, selectedYear]);

  // Group payments by term, sorted oldest-first
  const grouped = React.useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of yearPayments) {
      const key = p.term ?? "Unknown Term";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort keys: "Term 1" < "Term 2" < "Term 3"
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [yearPayments]);

  const yearTotal = React.useMemo(
    () => yearPayments.reduce((s, p) => s + paymentAmount(p), 0),
    [yearPayments],
  );

  // ── Highlight the selected term group by defaulting it open ──────────────

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-6">Loading payments…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur">
      <div className="h-1.5 bg-gradient-to-r from-rose-400 via-violet-500 to-indigo-500" />

      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Receipt className="w-5 h-5 text-violet-700" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            <p className="text-sm text-gray-500">
              {yearPayments.length} payment{yearPayments.length !== 1 ? "s" : ""} •{" "}
              Total: KES {yearTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {selectedYear && (
          <Badge variant="outline" className="bg-gray-50 text-gray-600">
            {selectedYear}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {yearPayments.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No payments recorded yet</p>
            <p className="text-sm text-gray-400 mt-1">Payments will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-3">
              {grouped.map(([termKey, termPayments]) => {
                const isActive = currentTerm
                  ? termKey === currentTerm.term && selectedYear === currentTerm.academic_year
                  : false;
                return (
                  <TermGroup
                    key={termKey}
                    termLabel={termKey}
                    payments={termPayments}
                    showStudentInfo={showStudentInfo}
                    defaultOpen={termKey === selectedTerm}
                    isActive={isActive} // NEW
                  />
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}