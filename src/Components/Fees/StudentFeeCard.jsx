import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { User, CreditCard, Calendar, TrendingUp, TrendingDown, BookOpen, Home, School, DollarSign } from "lucide-react";

export default function StudentFeeCard({ 
  studentFee, 
  onRecordPayment, 
  onViewDetails, 
  showAggregated = false,
  paymentCount = 0,
  creditCarried = 0 
}) {

  // ---------------- STATUS COLORS ---------------- //
  const getStatusConfig = (status) => {
    const map = {
      paid:       { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp, label: "Paid" },
      partial:    { color: "bg-amber-50 text-amber-700 border-amber-200", icon: TrendingDown, label: "Partial" },
      pending:    { color: "bg-red-50 text-red-700 border-red-200", icon: TrendingDown, label: "Pending" },
      unpaid:     { color: "bg-red-50 text-red-700 border-red-200", icon: TrendingDown, label: "Unpaid" },
      overpaid:   { color: "bg-blue-50 text-blue-700 border-blue-200", icon: TrendingUp, label: "Overpaid" }
    };

    return map[status?.toLowerCase()] || map.pending;
  };

  // ---------------- STUDENT TYPE COLORS ---------------- //
  const getStudentTypeConfig = (studentType) => {
    if (studentType === 'Boarding') {
      return {
        color: "bg-purple-50 text-purple-700 border-purple-200",
        icon: School,
        label: "Boarding"
      };
    }
    // Default to Day Scholar
    return {
      color: "bg-green-50 text-green-700 border-green-200",
      icon: Home,
      label: "Day Scholar"
    };
  };

  const statusConfig = getStatusConfig(studentFee.status);
  const StatusIcon = statusConfig.icon;

  const studentTypeConfig = getStudentTypeConfig(studentFee.student_type);
  const StudentTypeIcon = studentTypeConfig.icon;

  // ---------------- DISPLAY VALUES FROM DATABASE ---------------- //
  // All calculations should be done in database triggers, we just display
  const outstandingBalance = studentFee.outstanding_balance || 0;
  const creditCarriedValue = studentFee.credit_carried || creditCarried || 0;
  
  // Calculate progress from database values
  const progress = studentFee.total_billed > 0
    ? Math.min(((studentFee.total_paid || 0) / studentFee.total_billed) * 100, 100)
    : 0;

  // Check if student has credit available (from database)
  const hasCredit = creditCarriedValue > 0;

  // ---------------- AGGREGATED INFO ---------------- //
  const getTermBreakdown = () => {
    if (!studentFee.fee_records || !showAggregated || !Array.isArray(studentFee.fee_records)) return null;
    
    return studentFee.fee_records.map((record, index) => (
      <div key={index} className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-100 last:border-b-0">
        <span>{record.term || 'N/A'} {record.academic_year || ''}</span>
        <div className="flex flex-col items-end">
          <span>KES {(record.total_paid || 0).toLocaleString()} / KES {(record.total_billed || 0).toLocaleString()}</span>
          {record.credit_carried > 0 && (
            <span className="text-blue-600 text-[10px]">+KES {record.credit_carried?.toLocaleString()} credit</span>
          )}
        </div>
      </div>
    ));
  };

  // Get academic years as string for display
  const getAcademicYearsDisplay = () => {
    if (!studentFee.academic_years || !Array.isArray(studentFee.academic_years) || studentFee.academic_years.length === 0) {
      return "No data";
    }
    if (studentFee.academic_years.length === 1) return studentFee.academic_years[0];
    return `${studentFee.academic_years.length} years`;
  };

  // Get payment count display
  const getPaymentCountDisplay = () => {
    if (!paymentCount) return "No payments";
    return `${paymentCount} payment${paymentCount !== 1 ? 's' : ''}`;
  };

  // Determine if payment button should be enabled
  // Button should be enabled if there's any amount to pay (after considering credit)
  const canMakePayment = outstandingBalance > 0;

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
      <div className={`h-1.5 ${
        studentFee.student_type === 'Boarding' 
          ? 'bg-gradient-to-r from-purple-400 via-purple-500 to-indigo-500' 
          : 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500'
      }`} />
      
      <CardContent className="p-5">

        {/* ===================== TOP ===================== */}
        <div className="flex items-start justify-between mb-4">
          
          {/* Student Info */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              studentFee.student_type === 'Boarding' 
                ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                : 'bg-gradient-to-br from-emerald-100 to-teal-100'
            }`}>
              <User className={`w-5 h-5 ${
                studentFee.student_type === 'Boarding' ? 'text-purple-600' : 'text-emerald-600'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{studentFee.student_name || 'Unknown Student'}</h3>
              <p className="text-sm text-gray-500">{studentFee.admission_number || 'N/A'}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">Class: {studentFee.class_name || 'Not Assigned'}</p>
                <Badge variant="outline" className={studentTypeConfig.color}>
                  <StudentTypeIcon className="w-3 h-3 mr-1" />
                  {studentTypeConfig.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Status */}
          <Badge variant="outline" className={statusConfig.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label || studentFee.status}
          </Badge>
        </div>

        {/* ===================== AGGREGATED INFO ===================== */}
        {showAggregated ? (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{studentFee.fee_records?.length || 0} fee record(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" />
                <span>{getPaymentCountDisplay()}</span>
              </div>
            </div>
            
            {/* Academic Years */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <Calendar className="w-3.5 h-3.5" />
              <span>Years: {getAcademicYearsDisplay()}</span>
            </div>
            
            {/* Term Breakdown */}
            {studentFee.fee_records && studentFee.fee_records.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Term Breakdown:</p>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {getTermBreakdown()}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===================== ORIGINAL TERM + YEAR ===================== */
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Calendar className="w-3.5 h-3.5" />
            <span>{studentFee.term || 'N/A'} • {studentFee.academic_year || 'N/A'}</span>
          </div>
        )}

        {/* ===================== AMOUNTS ===================== */}
        <div className="space-y-3 mb-4">
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">
              {showAggregated ? 'Total Billed (All Terms)' : 'Total Billed'}
            </span>
            <span className="font-semibold">KES {(studentFee.total_billed || 0).toLocaleString()}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-gray-500">
              {showAggregated ? 'Total Paid (All Terms)' : 'Total Paid'}
            </span>
            <span className="font-semibold text-emerald-600">
              KES {(studentFee.total_paid || 0).toLocaleString()}
            </span>
          </div>

          {/* Credit Carried */}
          {hasCredit && (
            <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
              <span className="text-sm text-blue-700 flex items-center">
                <DollarSign className="w-3.5 h-3.5 mr-1" />
                Credit Available
              </span>
              <span className="font-semibold text-blue-700">
                KES {creditCarriedValue.toLocaleString()}
              </span>
            </div>
          )}

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full p-1">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1 px-1">
              <span>Payment Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
              <div
                className={`h-full transition-all ${
                  studentFee.student_type === 'Boarding'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                }`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Outstanding Balance */}
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <div>
              <span className="text-sm font-medium text-gray-700">
                {showAggregated ? 'Total Outstanding' : 'Outstanding'}
              </span>
              {hasCredit && (
                <p className="text-xs text-blue-600">
                  (KES {outstandingBalance.toLocaleString()} - KES {creditCarriedValue.toLocaleString()} credit)
                </p>
              )}
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold ${
                outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"
              }`}>
                KES {outstandingBalance.toLocaleString()}
              </span>
              {hasCredit && (
                <p className="text-xs text-blue-600">
                  {outstandingBalance <= 0 ? "Fully paid" : `${creditCarriedValue.toLocaleString()} credit available`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ===================== ACTIONS ===================== */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => onViewDetails(studentFee)} 
            className="w-1/2"
          >
            View Details
          </Button>
          <Button 
            onClick={() => onRecordPayment(studentFee)} 
            className={`w-1/2 ${
              studentFee.student_type === 'Boarding'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            } text-white`}
            disabled={!canMakePayment}
          >
            <CreditCard className="w-4 h-4 mr-2" /> 
            {canMakePayment ? 'Record Payment' : 'Paid'}
          </Button>
        </div>

        {/* ===================== AGGREGATED FOOTNOTE ===================== */}
        {showAggregated && (
          <div className={`mt-3 p-2 rounded-lg border ${
            outstandingBalance <= 0 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-xs text-center ${
              outstandingBalance <= 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {outstandingBalance <= 0 
                ? `✓ ${hasCredit ? 'Fully paid with credit carried' : 'Fully paid across all terms'}`
                : `${hasCredit ? `KES ${creditCarriedValue.toLocaleString()} credit available` : 'Payment required'}`
              }
            </p>
          </div>
        )}

        {/* ===================== CREDIT FOOTER ===================== */}
        {!showAggregated && hasCredit && (
          <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700 text-center">
              This student has KES {creditCarriedValue.toLocaleString()} credit available from previous terms
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}