"use client";

import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { AlertCircle, Circle } from "lucide-react";

interface FeeItem {
  id: string | number;
  name: string;
  description?: string | null;
  amount: number;
  category: "Mandatory" | "Optional";
}

interface FeeBreakdownCardProps {
  fees: FeeItem[] | null;
  title: string;
  type: "Mandatory" | "Optional";
  totalLabel: string;
}

export default function FeeBreakdownCard({ fees, title, type, totalLabel }: FeeBreakdownCardProps) {
  // Filter fees based on type
  const filteredFees = fees?.filter((f) => f.category === type) ?? [];
  const total = filteredFees.reduce((sum, f) => sum + (f.amount ?? 0), 0);

  // Debug logs
  useEffect(() => {
    console.log(`FeeBreakdownCard [${type}] title:`, title);
    console.log(`Filtered ${type} fees:`, filteredFees);
    console.log(`Total ${type} fees:`, total);
  }, [fees, type, title, total, filteredFees]);

  // Color configuration based on fee type
  const colorConfig =
    type === "Mandatory"
      ? {
          gradient: "from-red-500 to-rose-600",
          bg: "bg-red-50",
          text: "text-red-700",
          border: "border-red-200",
        }
      : {
          gradient: "from-blue-500 to-indigo-600",
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
        };

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${colorConfig.gradient}`} />

      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
          <Badge variant="outline" className={`${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}>
            {type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {filteredFees.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No {type.toLowerCase()} fees</p>
        ) : (
          <div className="space-y-3">
            {filteredFees.map((fee) => (
              <div
                key={fee.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {type === "Mandatory" ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-blue-500" />
                  )}

                  <div>
                    <p className="font-medium text-gray-900">{fee.name}</p>
                    {fee.description && <p className="text-xs text-gray-500 mt-0.5">{fee.description}</p>}
                  </div>
                </div>

                <p className="font-semibold text-gray-900">KES {fee.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <p className="font-medium text-gray-700">{totalLabel}</p>
          <p className={`text-xl font-bold ${type === "Mandatory" ? "text-red-600" : "text-blue-600"}`}>
            KES {total.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
