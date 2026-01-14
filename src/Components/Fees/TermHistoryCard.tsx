import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { Calendar, CheckCircle, Clock, AlertTriangle, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

export default function TermHistoryCard({
  studentFees = [],
  onSelectTerm,
  selectedTerm,
  selectedYear,
  isLoading = false,
}) {
  if (!Array.isArray(studentFees)) {
    return <div className="text-red-500">Error: invalid fee data</div>;
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500" />
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-lg font-semibold text-gray-900">Term History</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusConfig = (fee) => {
    const status = fee.status?.toLowerCase();
    
    // Determine status based on database values
    if (fee.outstanding_balance <= 0) {
      return { 
        color: "bg-emerald-50 text-emerald-700 border-emerald-200", 
        icon: CheckCircle,
        label: "Paid"
      };
    } else if (fee.total_paid > 0) {
      return { 
        color: "bg-amber-50 text-amber-700 border-amber-200", 
        icon: Clock,
        label: "Partial"
      };
    } else {
      return { 
        color: "bg-red-50 text-red-700 border-red-200", 
        icon: AlertTriangle,
        label: "Unpaid"
      };
    }
  };

  // Sort by year descending, then term descending
  const sortedFees = [...studentFees].sort((a, b) => {
    const yearA = a.academic_year ?? "";
    const yearB = b.academic_year ?? "";
    if (yearA !== yearB) return yearB.localeCompare(yearA);
    const termOrder = { "Term 3": 3, "Term 2": 2, "Term 1": 1 };
    return (termOrder[b.term] || 0) - (termOrder[a.term] || 0);
  });

  // Calculate totals across all terms
  const totals = React.useMemo(() => {
    return sortedFees.reduce((acc, fee) => {
      return {
        totalBilled: acc.totalBilled + (fee.total_billed || 0),
        totalPaid: acc.totalPaid + (fee.total_paid || 0),
        totalCredit: acc.totalCredit + (fee.credit_carried || 0),
      };
    }, { totalBilled: 0, totalPaid: 0, totalCredit: 0 });
  }, [sortedFees]);

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500" />
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <Calendar className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Term History</CardTitle>
              <p className="text-sm text-gray-500">
                {sortedFees.length} term{sortedFees.length !== 1 ? 's' : ''} • 
                Total paid: KES {totals.totalPaid.toLocaleString()}
                {totals.totalCredit > 0 && ` • Total credit: KES ${totals.totalCredit.toLocaleString()}`}
              </p>
            </div>
          </div>
          {totals.totalCredit > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <DollarSign className="w-3 h-3 mr-1" />
              Credit System Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[300px] pr-2">
          {sortedFees.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No fee history available</p>
              <p className="text-sm text-gray-400 mt-1">Fee records will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFees.map((fee, index) => {
                const statusConfig = getStatusConfig(fee);
                const StatusIcon = statusConfig.icon;

                const totalBilled = fee.total_billed || 0;
                const totalPaid = fee.total_paid || 0;
                const outstandingBalance = fee.outstanding_balance || 0;
                const creditCarried = fee.credit_carried || 0;
                const hasCredit = creditCarried > 0;

                const isSelected = fee.term === selectedTerm && fee.academic_year === selectedYear;

                return (
                  <div
                    key={fee.id || index}
                    onClick={() => onSelectTerm(fee.term, fee.academic_year)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/50 shadow-md"
                        : "border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{fee.term}</p>
                          <span className="text-gray-400">•</span>
                          <p className="text-sm text-gray-600">{fee.academic_year}</p>
                        </div>
                        {hasCredit && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            <span className="text-xs text-amber-600">
                              Carried KES {creditCarried.toLocaleString()} to next term
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={`${statusConfig.color} text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Billed</p>
                        <p className="font-medium text-gray-900">
                          KES {totalBilled.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Paid</p>
                        <p className="font-medium text-emerald-600">
                          KES {totalPaid.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Balance</p>
                        <div>
                          <p className={`font-medium ${
                            outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"
                          }`}>
                            KES {outstandingBalance.toLocaleString()}
                          </p>
                          {hasCredit && outstandingBalance > 0 && (
                            <p className="text-xs text-amber-600">
                              (After KES {creditCarried.toLocaleString()} credit)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar for this term */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Term Progress</span>
                        <span>{totalBilled > 0 ? ((totalPaid / totalBilled) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                          style={{ width: `${totalBilled > 0 ? Math.min((totalPaid / totalBilled) * 100, 100) : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* Database Credit System Notice */}
        {sortedFees.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="p-1 rounded bg-gray-100">
                <DollarSign className="w-3 h-3" />
              </div>
              <p>
                Credit system: Overpayments are stored as credit and automatically applied to future terms.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}