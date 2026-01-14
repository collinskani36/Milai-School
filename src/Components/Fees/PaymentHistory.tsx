import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { Receipt, Calendar, CreditCard, Hash, Clock, DollarSign, User, School, BookOpen } from "lucide-react";
import { format } from "date-fns";

export default function PaymentHistory({
  payments = [],
  isLoading = false,
  showStudentInfo = false,
  selectedTerm = null,
  selectedYear = null
}) {
  // Filter payments by term and year if specified
  const filteredPayments = React.useMemo(() => {
    let result = payments;
    
    if (selectedTerm) {
      result = result.filter(p => p.term === selectedTerm);
    }
    
    if (selectedYear) {
      result = result.filter(p => p.academic_year === selectedYear);
    }
    
    return result;
  }, [payments, selectedTerm, selectedYear]);

  // Calculate totals
  const totalPaid = React.useMemo(() => {
    return filteredPayments.reduce((sum, payment) => 
      sum + (parseFloat(payment.amount_paid) || 0), 0);
  }, [filteredPayments]);

  const totalCreditApplied = React.useMemo(() => {
    // This would need to be calculated from student_fees table
    // or you could add a column to p_payments to track credit_used
    return 0; // Placeholder - you'll need to implement this based on your data
  }, [filteredPayments]);

  // Format payment date
  const formatDate = (dateString) => {
    if (!dateString) return "No Date";
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm");
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusMap = {
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      failed: "bg-red-50 text-red-700 border-red-200",
      refunded: "bg-blue-50 text-blue-700 border-blue-200",
      processing: "bg-purple-50 text-purple-700 border-purple-200"
    };
    return statusMap[status?.toLowerCase()] || "bg-gray-50 text-gray-700 border-gray-200";
  };

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

      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Receipt className="w-5 h-5 text-violet-700" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            <p className="text-sm text-gray-500">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} • 
              Total: KES {totalPaid.toLocaleString()}
              {totalCreditApplied > 0 && ` • Credit used: KES ${totalCreditApplied.toLocaleString()}`}
            </p>
          </div>
        </div>
        
        {(selectedTerm || selectedYear) && (
          <Badge variant="outline" className="bg-gray-50">
            {selectedTerm && <span>{selectedTerm}</span>}
            {selectedTerm && selectedYear && <span> • </span>}
            {selectedYear && <span>{selectedYear}</span>}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 rounded-full bg-gray-100 w-fit mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No payments recorded yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {selectedTerm || selectedYear ? "Try changing filters" : "Payments will appear here"}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[290px] pr-2">
            <div className="space-y-3">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all group"
                >
                  {/* Top Row: Amount & Status */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`${getStatusColor(payment.status)} flex items-center gap-1`}
                      >
                        <CreditCard className="w-3 h-3" />
                        {payment.payment_method || payment.method || "Unknown"}
                      </Badge>
                      
                      {payment.status && payment.status !== "completed" && (
                        <Badge 
                          variant="outline" 
                          className={getStatusColor(payment.status)}
                        >
                          {payment.status}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-lg">
                        KES {(payment.amount_paid || payment.amount || 0).toLocaleString()}
                      </p>
                      {payment.notes && (
                        <p className="text-xs text-gray-500 truncate max-w-[150px]">
                          {payment.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Student Info (if enabled) */}
                  {showStudentInfo && payment.student_name && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2 p-2 bg-gray-50 rounded-lg">
                      <User className="w-3 h-3" />
                      <span className="font-medium">{payment.student_name}</span>
                      {payment.admission_number && (
                        <span className="text-gray-500">• {payment.admission_number}</span>
                      )}
                    </div>
                  )}

                  {/* Payment Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{formatDate(payment.payment_date || payment.date)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        Ref: {payment.reference_number || payment.transaction_reference || payment.reference_no || "-"}
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

                  {/* Credit Indicator (if available in data) */}
                  {payment.credit_used && payment.credit_used > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <DollarSign className="w-3 h-3" />
                        <span>Applied KES {payment.credit_used.toLocaleString()} credit from previous term</span>
                      </div>
                    </div>
                  )}

                  {/* Overpayment Indicator */}
                  {payment.resulted_in_credit && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <DollarSign className="w-3 h-3" />
                        <span>Created KES {payment.credit_amount?.toLocaleString() || 'credit'} for future terms</span>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>ID: {payment.id?.substring(0, 8)}...</span>
                      <span>
                        {payment.inserted_at && 
                          format(new Date(payment.inserted_at), "dd MMM yy")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}