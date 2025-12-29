import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function TermHistoryCard({ studentFees, onSelectTerm, selectedTerm, selectedYear, isLoading }: any & { isLoading?: boolean }) {
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
  const getStatusConfig = (status) => {
    const configs = {
      'Paid': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
      'Partial': { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
      'Unpaid': { color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle },
      'Overpaid': { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle }
    };
    return configs[status] || configs['Unpaid'];
  };

  // Sort by year (descending) and term (Term 3 > Term 2 > Term 1)
  const sortedFees = [...studentFees].sort((a, b) => {
    const yearA = a.academic_year || '';
    const yearB = b.academic_year || '';
    if (yearA !== yearB) return yearB.localeCompare(yearA);
    const termOrder = { 'Term 3': 3, 'Term 2': 2, 'Term 1': 1 };
    return (termOrder[b.term] || 0) - (termOrder[a.term] || 0);
  });

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500" />
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Calendar className="w-5 h-5 text-violet-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-gray-900">Term History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[300px] pr-2">
          {sortedFees.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No fee history available</p>
          ) : (
            <div className="space-y-2">
              {sortedFees.map((fee, index) => {
                const statusConfig = getStatusConfig(fee.status);
                const StatusIcon = statusConfig.icon;
                const isSelected = fee.term === selectedTerm && fee.academic_year === selectedYear;

                return (
                  <div
                    key={fee.id || index}
                    onClick={() => onSelectTerm(fee.term, fee.academic_year)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md' 
                        : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{fee.term}</p>
                        <span className="text-gray-400">•</span>
                        <p className="text-sm text-gray-600">{fee.academic_year}</p>
                      </div>
                      <Badge variant="outline" className={`${statusConfig.color} text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {fee.status || 'Unpaid'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Billed</p>
                        <p className="font-medium text-gray-900">KES {fee.total_billed?.toLocaleString() || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Paid</p>
                        <p className="font-medium text-emerald-600">KES {fee.total_paid?.toLocaleString() || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Balance</p>
                        <p className={`font-medium ${fee.outstanding_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          KES {fee.outstanding_balance?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
