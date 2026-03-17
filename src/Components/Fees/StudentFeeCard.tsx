import React, { useMemo } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import {
  User, CreditCard, Calendar, TrendingUp, TrendingDown,
  BookOpen, Home, School, DollarSign, ChevronRight, CalendarDays,
  AlertCircle,
} from "lucide-react";
import { termLabel } from "@/hooks/useActiveTerm";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid:     { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp,   label: "Paid"     },
  partial:  { color: "bg-amber-50 text-amber-700 border-amber-200",       icon: TrendingDown, label: "Partial"  },
  pending:  { color: "bg-red-50 text-red-700 border-red-200",             icon: TrendingDown, label: "Pending"  },
  unpaid:   { color: "bg-red-50 text-red-700 border-red-200",             icon: TrendingDown, label: "Unpaid"   },
  overpaid: { color: "bg-blue-50 text-blue-700 border-blue-200",          icon: TrendingUp,   label: "Overpaid" },
};

const DEFAULT_STATUS_CONFIG = STATUS_CONFIG.pending;

function getStatusConfig(status) {
  if (!status) return DEFAULT_STATUS_CONFIG;
  return STATUS_CONFIG[status.toLowerCase()] ?? DEFAULT_STATUS_CONFIG;
}

// ─── Student type config ──────────────────────────────────────────────────────

const STUDENT_TYPE_CONFIG = {
  boarding: {
    color: "bg-purple-50 text-purple-700 border-purple-200", icon: School,
    label: "Boarding", shortLabel: "Boarder",
    iconBg: "bg-gradient-to-br from-purple-100 to-indigo-100", iconColor: "text-purple-600",
    barGradient: "bg-gradient-to-r from-purple-500 to-indigo-500",
    topBar: "bg-gradient-to-r from-purple-400 via-purple-500 to-indigo-500",
    btnColor: "bg-purple-600 hover:bg-purple-700",
  },
  day: {
    color: "bg-green-50 text-green-700 border-green-200", icon: Home,
    label: "Day Scholar", shortLabel: "Day",
    iconBg: "bg-gradient-to-br from-emerald-100 to-teal-100", iconColor: "text-emerald-600",
    barGradient: "bg-gradient-to-r from-emerald-500 to-teal-500",
    topBar: "bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500",
    btnColor: "bg-emerald-600 hover:bg-emerald-700",
  },
};

function getStudentTypeConfig(studentType) {
  return studentType === 'Boarding' ? STUDENT_TYPE_CONFIG.boarding : STUDENT_TYPE_CONFIG.day;
}

// ─── Helper: extract term number from "Term 1" / "Term 2" etc. ───────────────
function termNumber(termStr) {
  if (!termStr) return 0;
  const match = termStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentFeeCard({
  studentFee,
  onRecordPayment,
  onViewDetails,
  showAggregated = false,
  paymentCount = 0,
  creditCarried = 0,
  activeTerm,
}) {
  const statusConfig      = useMemo(() => getStatusConfig(studentFee.status),            [studentFee.status]);
  const studentTypeConfig = useMemo(() => getStudentTypeConfig(studentFee.student_type), [studentFee.student_type]);

  const StatusIcon      = statusConfig.icon;
  const StudentTypeIcon = studentTypeConfig.icon;

  const outstandingBalance = studentFee.outstanding_balance ?? 0;
  const creditCarriedValue = studentFee.credit_carried ?? creditCarried ?? 0;
  const hasCredit          = creditCarriedValue > 0;

  const progress = useMemo(() => {
    if (!studentFee.total_billed || studentFee.total_billed <= 0) return 0;
    return Math.min(((studentFee.total_paid ?? 0) / studentFee.total_billed) * 100, 100);
  }, [studentFee.total_billed, studentFee.total_paid]);

  const progressLabel = useMemo(() => {
    if (studentFee.status?.toLowerCase() === 'overpaid') return 'Overpaid';
    return `${progress.toFixed(1)}%`;
  }, [progress, studentFee.status]);

  const canMakePayment = outstandingBalance > 0 && outstandingBalance > creditCarriedValue;

  // ── Active term context ───────────────────────────────────────────────────
  const hasActiveTermRecord = useMemo(() => {
    if (!activeTerm || !Array.isArray(studentFee.fee_records)) return false;
    const activeTermLabel = termLabel(activeTerm);
    return studentFee.fee_records.some(
      r => r.term === activeTermLabel && r.academic_year === activeTerm.academic_year
    );
  }, [activeTerm, studentFee.fee_records]);

  // ── Previous terms in the SAME academic year with outstanding balances ────
  // e.g. active = Term 2, 2025-2026 → show Term 1, 2025-2026 if balance > 0
  const previousTermArrears = useMemo(() => {
    if (!activeTerm || !Array.isArray(studentFee.fee_records)) return [];

    const activeTermNum  = activeTerm.term;           // numeric: 1, 2 or 3
    const activeYear     = activeTerm.academic_year;

    return studentFee.fee_records
      .filter(r => {
        // same academic year only
        if (r.academic_year !== activeYear) return false;
        // only terms that come BEFORE the current one
        if (termNumber(r.term) >= activeTermNum) return false;
        // only if there's a real outstanding balance
        const outstanding = (r.total_billed ?? 0) - (r.total_paid ?? 0) - (r.credit_carried ?? 0);
        return outstanding > 0;
      })
      .map(r => ({
        term:        r.term,
        year:        r.academic_year,
        outstanding: Math.max(0, (r.total_billed ?? 0) - (r.total_paid ?? 0) - (r.credit_carried ?? 0)),
        total_billed: r.total_billed ?? 0,
        total_paid:   r.total_paid   ?? 0,
      }))
      .sort((a, b) => termNumber(a.term) - termNumber(b.term)); // Term 1 first
  }, [activeTerm, studentFee.fee_records]);

  const hasPreviousArrears  = previousTermArrears.length > 0;
  const totalPreviousArrears = previousTermArrears.reduce((sum, r) => sum + r.outstanding, 0);

  // ── Aggregated term breakdown ─────────────────────────────────────────────
  const termBreakdown = useMemo(() => {
    if (!showAggregated || !Array.isArray(studentFee.fee_records) || studentFee.fee_records.length === 0) return null;
    return studentFee.fee_records.map((record, index) => {
      const isCurrentTerm = activeTerm &&
        record.term === termLabel(activeTerm) &&
        record.academic_year === activeTerm.academic_year;
      const isPrevArrear = activeTerm &&
        record.academic_year === activeTerm.academic_year &&
        termNumber(record.term) < activeTerm.term &&
        ((record.total_billed ?? 0) - (record.total_paid ?? 0) - (record.credit_carried ?? 0)) > 0;

      return (
        <div
          key={index}
          className={`flex justify-between text-xs py-1 border-b border-gray-100 last:border-b-0 ${
            isCurrentTerm  ? 'text-blue-700 font-medium' :
            isPrevArrear   ? 'text-red-600 font-medium'  :
            'text-gray-500'
          }`}
        >
          <span className="truncate max-w-[55%] flex items-center gap-1">
            {isCurrentTerm && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />}
            {isPrevArrear  && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />}
            {record.term ?? 'N/A'} {record.academic_year ?? ''}
          </span>
          <div className="flex flex-col items-end">
            <span>KES {(record.total_paid ?? 0).toLocaleString()}</span>
            {(record.credit_carried ?? 0) > 0 && (
              <span className="text-blue-600 text-[10px]">+KES {(record.credit_carried ?? 0).toLocaleString()} cr</span>
            )}
            {isPrevArrear && (
              <span className="text-red-500 text-[10px]">
                -{( (record.total_billed ?? 0) - (record.total_paid ?? 0) - (record.credit_carried ?? 0) ).toLocaleString()} owing
              </span>
            )}
          </div>
        </div>
      );
    });
  }, [showAggregated, studentFee.fee_records, activeTerm]);

  const academicYearsDisplay = useMemo(() => {
    const years = studentFee.academic_years;
    if (!years) return "No data";
    if (typeof years === 'string') return years;
    if (!Array.isArray(years) || years.length === 0) return "No data";
    if (years.length === 1) return years[0];
    return `${years.length} years`;
  }, [studentFee.academic_years]);

  const paymentCountDisplay = useMemo(() => {
    const count = Number(paymentCount);
    if (!count) return "No payments";
    return `${count} payment${count !== 1 ? 's' : ''}`;
  }, [paymentCount]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="border-0 shadow-md sm:shadow-lg bg-white/80 backdrop-blur-sm transition-all duration-300 overflow-hidden
                     hover:shadow-lg sm:hover:shadow-xl">
      <div className={`h-1.5 ${studentTypeConfig.topBar}`} />

      <CardContent className="p-3 sm:p-4 md:p-5">

        {/* ── Student info ── */}
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`p-1.5 sm:p-2 rounded-lg ${studentTypeConfig.iconBg} flex-shrink-0`}>
              <User className={`w-4 h-4 sm:w-5 sm:h-5 ${studentTypeConfig.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                    {studentFee.student_name ?? 'Unknown Student'}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{studentFee.admission_number ?? 'N/A'}</p>
                </div>
                <Badge variant="outline" className={`${statusConfig.color} hidden sm:flex text-xs ml-2 flex-shrink-0`}>
                  <StatusIcon className="w-3 h-3 mr-1" />{statusConfig.label}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                <p className="text-xs text-gray-400">Class: {studentFee.class_name ?? 'Not Assigned'}</p>
                <Badge variant="outline" className={`${studentTypeConfig.color} text-xs`}>
                  <StudentTypeIcon className="w-3 h-3 mr-1 hidden sm:inline" />
                  <span className="hidden sm:inline">{studentTypeConfig.label}</span>
                  <span className="sm:hidden">{studentTypeConfig.shortLabel}</span>
                </Badge>
                <Badge variant="outline" className={`${statusConfig.color} sm:hidden text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />{statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active term context badge ── */}
        {activeTerm && (
          <div className={`mb-3 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
            hasActiveTermRecord
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {termLabel(activeTerm)}, {activeTerm.academic_year}
              {hasActiveTermRecord ? ' — fee record found' : ' — no fee record yet'}
            </span>
            {hasActiveTermRecord && (
              <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
          </div>
        )}

        {/* ── Previous term arrears banner ── */}
        {hasPreviousArrears && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-red-700">
                Previous term balance{previousTermArrears.length > 1 ? 's' : ''} outstanding
              </span>
            </div>
            <div className="space-y-1">
              {previousTermArrears.map((arrear, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-red-600">
                    {arrear.term}, {arrear.year}
                  </span>
                  <span className="font-semibold text-red-700">
                    KES {arrear.outstanding.toLocaleString()} owing
                  </span>
                </div>
              ))}
              {previousTermArrears.length > 1 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-red-200 mt-1">
                  <span className="text-red-700 font-medium">Total arrears</span>
                  <span className="font-bold text-red-800">KES {totalPreviousArrears.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Aggregated view ── */}
        {showAggregated ? (
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-wrap items-center justify-between text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3 gap-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{studentFee.fee_records?.length ?? 0} record(s)</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{paymentCountDisplay}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Years: {academicYearsDisplay}</span>
            </div>

            {termBreakdown && (
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1 sm:mb-2">Term Breakdown:</p>
                <div className="space-y-1">{termBreakdown}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="truncate">{studentFee.term ?? 'N/A'} • {studentFee.academic_year ?? 'N/A'}</span>
          </div>
        )}

        {/* ── Amounts ── */}
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Billed</p>
              <p className="text-sm sm:text-base font-semibold truncate">
                KES {(studentFee.total_billed ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-emerald-50 p-2 rounded-lg">
              <p className="text-xs text-emerald-600 mb-1">Total Paid</p>
              <p className="text-sm sm:text-base font-semibold text-emerald-600 truncate">
                KES {(studentFee.total_paid ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          {hasCredit && (
            <div className="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-blue-700 flex items-center">
                  <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Credit Available</span>
                  <span className="sm:hidden">Credit</span>
                </span>
                <span className="text-sm sm:text-base font-semibold text-blue-700 truncate max-w-[50%]">
                  KES {creditCarriedValue.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-lg p-2 sm:p-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1 sm:mb-2">
              <span>Progress</span>
              <span className="font-semibold">{progressLabel}</span>
            </div>
            <div className="w-full h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${studentTypeConfig.barGradient}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Outstanding balance */}
          <div className="flex justify-between items-center pt-2 sm:pt-3 border-t border-gray-200">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-700">
                {!hasActiveTermRecord && hasPreviousArrears ? 'Carried Balance' : 'Balance'}
              </span>
              {hasCredit && (
                <p className="text-xs text-blue-600 truncate">
                  ({outstandingBalance.toLocaleString()} - {creditCarriedValue.toLocaleString()} credit)
                </p>
              )}
            </div>
            <div className="text-right min-w-0 flex-shrink-0 ml-2">
              <span className={`text-base sm:text-lg font-bold truncate ${outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                KES {outstandingBalance.toLocaleString()}
              </span>
              {hasCredit && (
                <p className="text-xs text-blue-600 truncate">
                  {outstandingBalance <= 0 ? "Paid" : `${creditCarriedValue.toLocaleString()} credit`}
                </p>
              )}
            </div>
          </div>


        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onViewDetails(studentFee)}
            className="w-full sm:w-1/2 py-2 text-sm"
          >
            <span>View Details</span>
            <ChevronRight className="w-4 h-4 ml-2 hidden sm:inline" />
          </Button>
          <Button
            onClick={() => onRecordPayment(studentFee)}
            className={`w-full sm:w-1/2 py-2 text-sm ${studentTypeConfig.btnColor} text-white`}
            disabled={!canMakePayment}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {canMakePayment ? 'Record Payment' : 'Paid'}
          </Button>
        </div>

        {/* ── Aggregated footnote ── */}
        {showAggregated && (
          <div className={`mt-2 sm:mt-3 p-2 rounded-lg border ${
            hasPreviousArrears
              ? 'bg-red-50 border-red-200'
              : outstandingBalance <= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-xs text-center truncate ${
              hasPreviousArrears
                ? 'text-red-700'
                : outstandingBalance <= 0
                  ? 'text-emerald-700'
                  : 'text-amber-700'
            }`}>
              {hasPreviousArrears
                ? `⚠ Arrears from previous term${previousTermArrears.length > 1 ? 's' : ''}`
                : outstandingBalance <= 0
                  ? `✓ ${hasCredit ? 'Fully paid with credit' : 'Fully paid'}`
                  : `${hasCredit ? `${creditCarriedValue.toLocaleString()} credit available` : 'Payment required'}`
              }
            </p>
          </div>
        )}

        {/* ── Credit footer (single-term view) ── */}
        {!showAggregated && hasCredit && (
          <div className="mt-2 sm:mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700 text-center truncate">
              {creditCarriedValue.toLocaleString()} credit available
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}