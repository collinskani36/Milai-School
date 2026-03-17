import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Wallet, TrendingUp, AlertCircle, CheckCircle2, CreditCard } from "lucide-react";

interface StudentFee {
  id: string;
  term: string;
  academic_year: string;
  total_billed?: number;
  total_paid?: number;
  outstanding_balance?: number;
  credit_carried?: number;
  status?: string;
}

interface FeeBalanceOverviewProps {
  studentFee?: StudentFee;                 // selected term (used for credit display)
  allStudentFees?: StudentFee[];           // all terms in selected academic year
  combinedTotalBilled?: number;
  combinedTotalPaid?: number;
  combinedOutstandingBalance?: number;
  isLoading?: boolean;
  currentTerm?: { term: string; academic_year: string } | null; // NEW: active term from parent
}

export default function FeeBalanceOverview({
  studentFee,
  allStudentFees = [],
  combinedTotalBilled,
  combinedTotalPaid,
  combinedOutstandingBalance,
  isLoading = false,
  currentTerm, // NEW (currently unused, added for future sync)
}: FeeBalanceOverviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  // Use combined figures when provided (multi-term), fall back to single term
  const totalBilled      = combinedTotalBilled      ?? studentFee?.total_billed      ?? 0;
  const totalPaid        = combinedTotalPaid         ?? studentFee?.total_paid        ?? 0;
  const outstandingBal   = combinedOutstandingBalance ?? studentFee?.outstanding_balance ?? 0;
  const creditCarried    = studentFee?.credit_carried ?? 0;

  const progressPercent  = totalBilled > 0 ? Math.min((totalPaid / totalBilled) * 100, 100) : 0;
  const hasCredit        = creditCarried > 0;
  const hasMultipleTerms = allStudentFees.length > 1;

  // Terms that still have an outstanding balance — shown in the arrears breakdown
  const termsWithArrears = allStudentFees.filter(sf => (sf.outstanding_balance ?? 0) > 0);

  const stats = [
    {
      label:     "Total Billed",
      value:     totalBilled,
      icon:      Wallet,
      color:     "from-blue-500 to-indigo-600",
      bgColor:   "bg-blue-50",
      iconColor: "text-blue-600",
      note:      hasMultipleTerms ? `${allStudentFees.length} terms` : undefined,
    },
    {
      label:     "Amount Paid",
      value:     totalPaid,
      icon:      TrendingUp,
      color:     "from-emerald-500 to-teal-600",
      bgColor:   "bg-emerald-50",
      iconColor: "text-emerald-600",
      note:      hasMultipleTerms ? "All terms combined" : undefined,
    },
    {
      label:     "Outstanding Balance",
      value:     outstandingBal,
      icon:      outstandingBal > 0 ? AlertCircle : CheckCircle2,
      color:     outstandingBal > 0 ? "from-red-500 to-rose-600" : "from-emerald-500 to-green-600",
      bgColor:   outstandingBal > 0 ? "bg-red-50" : "bg-emerald-50",
      iconColor: outstandingBal > 0 ? "text-red-600" : "text-emerald-600",
      note:      hasMultipleTerms && outstandingBal > 0 ? "Across all terms" : undefined,
    },
  ];

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-2xl transition-all duration-300"
            >
              <div className={`h-1 bg-gradient-to-r ${stat.color}`} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      KES {stat.value.toLocaleString()}
                    </p>
                    {stat.note && (
                      <p className="text-xs text-gray-400 mt-1">{stat.note}</p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Credit Carried Card */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-2xl transition-all duration-300">
          <div className={`h-1 bg-gradient-to-r ${hasCredit ? "from-amber-500 to-orange-600" : "from-gray-400 to-gray-500"}`} />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Credit Available
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  KES {creditCarried.toLocaleString()}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${hasCredit ? "bg-amber-50" : "bg-gray-50"}`}>
                <CreditCard className={`w-6 h-6 ${hasCredit ? "text-amber-600" : "text-gray-400"}`} />
              </div>
            </div>
            {hasCredit && (
              <p className="text-xs text-amber-600 mt-2">
                Will be automatically applied to future fees
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-term arrears breakdown — only shown when multiple terms exist with balances */}
      {hasMultipleTerms && termsWithArrears.length > 0 && (
        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-400 to-rose-500" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700">Outstanding balances by term</p>
            </div>
            <div className="space-y-2">
              {allStudentFees
                .slice()
                .sort((a, b) => a.term.localeCompare(b.term))
                .map(sf => {
                  const owed      = sf.outstanding_balance ?? 0;
                  const billed    = sf.total_billed ?? 0;
                  const paid      = sf.total_paid ?? 0;
                  const credit    = sf.credit_carried ?? 0;
                  const isCleared = owed <= 0;

                  return (
                    <div
                      key={sf.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        isCleared
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCleared
                          ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          : <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0" />
                        }
                        <span className="font-medium">{sf.term}</span>
                        <span className="text-xs opacity-70">
                          {paid.toLocaleString()} / {billed.toLocaleString()} paid
                        </span>
                        {credit > 0 && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0 py-0">
                            +{credit.toLocaleString()} credit
                          </Badge>
                        )}
                      </div>
                      <span className="font-bold">
                        {isCleared ? 'Cleared' : `KES ${owed.toLocaleString()} due`}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Total row */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm font-bold text-gray-800">
              <span>Total outstanding</span>
              <span className="text-red-700">KES {outstandingBal.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Payment Progress</span>
              {hasMultipleTerms && (
                <span className="text-xs text-gray-400 ml-2">All terms combined</span>
              )}
              {hasCredit && (
                <span className="text-xs text-amber-600 ml-2">
                  (KES {creditCarried.toLocaleString()} credit available)
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-emerald-600">
              {progressPercent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-sm text-gray-500">
            <span>KES 0</span>
            <span>KES {totalBilled.toLocaleString()}</span>
          </div>

          {hasCredit && (
            <div className="mt-2 relative">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Credit Available</span>
                <span>KES {creditCarried.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 to-orange-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min((creditCarried / totalBilled) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Credit will be automatically applied when next term fees are uploaded
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}