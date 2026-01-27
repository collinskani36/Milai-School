import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Wallet, TrendingUp, AlertCircle, CheckCircle2, DollarSign, CreditCard } from "lucide-react";

export default function FeeBalanceOverview({ studentFee, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  // Safe fallback values from database
  const totalBilled = studentFee?.total_billed ?? 0;
  const totalPaid = studentFee?.total_paid ?? 0;
  const outstandingBalance = studentFee?.outstanding_balance ?? 0;
  const creditCarried = studentFee?.credit_carried ?? 0;

  // Calculate progress based on database values
  const progressPercent = totalBilled > 0
    ? Math.min((totalPaid / totalBilled) * 100, 100)
    : 0;

  // Determine if student has credit
  const hasCredit = creditCarried > 0;

  const stats = [
    {
      label: "Total Billed",
      value: totalBilled,
      icon: Wallet,
      color: "from-blue-500 to-indigo-600",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Amount Paid",
      value: totalPaid,
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Outstanding Balance",
      value: outstandingBalance,
      icon: outstandingBalance > 0 ? AlertCircle : CheckCircle2,
      color: outstandingBalance > 0 ? "from-red-500 to-rose-600" : "from-emerald-500 to-green-600",
      bgColor: outstandingBalance > 0 ? "bg-red-50" : "bg-emerald-50",
      iconColor: outstandingBalance > 0 ? "text-red-600" : "text-emerald-600",
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

      {/* Progress Bar */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Payment Progress</span>
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
          
          {/* Credit Indicator on Progress Bar */}
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