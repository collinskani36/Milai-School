"use client";
import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Wallet, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

interface FeeRow {
  total_billed: number | null;
  total_paid: number | null;
  outstanding_balance: number | null;
}

interface FeeBalanceOverviewProps {
  studentFee: FeeRow | null;
  isLoading?: boolean;
}

export default function FeeBalanceOverview({ studentFee }: FeeBalanceOverviewProps) {

  if ((arguments[0] as FeeBalanceOverviewProps)?.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  // ⭐ Safe fallback values
  const totalBilled = studentFee?.total_billed ?? 0;
  const totalPaid = studentFee?.total_paid ?? 0;
  const outstanding = studentFee?.outstanding_balance ?? (totalBilled - totalPaid);

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
      value: outstanding,
      icon: outstanding > 0 ? AlertCircle : CheckCircle2,
      color: outstanding > 0 ? "from-red-500 to-rose-600" : "from-emerald-500 to-green-600",
      bgColor: outstanding > 0 ? "bg-red-50" : "bg-emerald-50",
      iconColor: outstanding > 0 ? "text-red-600" : "text-emerald-600",
    },
  ];

  const progressPercent = totalBilled > 0
    ? Math.min((totalPaid / totalBilled) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Progress Bar */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Payment Progress</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
