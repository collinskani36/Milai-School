import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { User, CreditCard, Calendar, TrendingUp, TrendingDown, BookOpen, Home, School, DollarSign, ChevronRight } from "lucide-react";

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
        label: "Boarding",
        shortLabel: "Boarder"
      };
    }
    // Default to Day Scholar
    return {
      color: "bg-green-50 text-green-700 border-green-200",
      icon: Home,
      label: "Day Scholar",
      shortLabel: "Day"
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
        <span className="truncate max-w-[40%]">{record.term || 'N/A'} {record.academic_year || ''}</span>
        <div className="flex flex-col items-end">
          <span className="text-xs">KES {(record.total_paid || 0).toLocaleString()}</span>
          {record.credit_carried > 0 && (
            <span className="text-blue-600 text-[10px]">+KES {record.credit_carried?.toLocaleString()}</span>
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
    <Card className="border-0 shadow-md sm:shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-lg sm:hover:shadow-xl transition-all duration-300 overflow-hidden group">
      <div className={`h-1.5 ${
        studentFee.student_type === 'Boarding' 
          ? 'bg-gradient-to-r from-purple-400 via-purple-500 to-indigo-500' 
          : 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500'
      }`} />
      
      <CardContent className="p-3 sm:p-4 md:p-5">

        {/* ===================== TOP ===================== */}
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          
          {/* Student Info */}
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`p-1.5 sm:p-2 rounded-lg ${
              studentFee.student_type === 'Boarding' 
                ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                : 'bg-gradient-to-br from-emerald-100 to-teal-100'
            } flex-shrink-0`}>
              <User className={`w-4 h-4 sm:w-5 sm:h-5 ${
                studentFee.student_type === 'Boarding' ? 'text-purple-600' : 'text-emerald-600'
              }`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{studentFee.student_name || 'Unknown Student'}</h3>
                  <p className="text-xs text-gray-500 truncate">{studentFee.admission_number || 'N/A'}</p>
                </div>
                
                {/* Status Badge - Move to top right on mobile */}
                <Badge variant="outline" className={`${statusConfig.color} hidden sm:flex text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label || studentFee.status}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                <p className="text-xs text-gray-400">Class: {studentFee.class_name || 'Not Assigned'}</p>
                <Badge variant="outline" className={`${studentTypeConfig.color} text-xs`}>
                  <StudentTypeIcon className="w-3 h-3 mr-1 hidden xs:inline" />
                  <span className="hidden sm:inline">{studentTypeConfig.label}</span>
                  <span className="sm:hidden">{studentTypeConfig.shortLabel}</span>
                </Badge>
                
                {/* Status Badge - Show inline on mobile */}
                <Badge variant="outline" className={`${statusConfig.color} sm:hidden text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label || studentFee.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== AGGREGATED INFO ===================== */}
        {showAggregated ? (
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-wrap items-center justify-between text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3 gap-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{studentFee.fee_records?.length || 0} record(s)</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{getPaymentCountDisplay()}</span>
              </div>
            </div>
            
            {/* Academic Years */}
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Years: {getAcademicYearsDisplay()}</span>
            </div>
            
            {/* Term Breakdown */}
            {studentFee.fee_records && studentFee.fee_records.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1 sm:mb-2">Term Breakdown:</p>
                <div className="space-y-1 max-h-16 sm:max-h-20 overflow-y-auto">
                  {getTermBreakdown()}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===================== ORIGINAL TERM + YEAR ===================== */
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="truncate">{studentFee.term || 'N/A'} • {studentFee.academic_year || 'N/A'}</span>
          </div>
        )}

        {/* ===================== AMOUNTS - MOBILE OPTIMIZED ===================== */}
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          
          {/* Amounts Grid for Mobile */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Billed</p>
              <p className="text-sm sm:text-base font-semibold truncate">KES {(studentFee.total_billed || 0).toLocaleString()}</p>
            </div>
            
            <div className="bg-emerald-50 p-2 rounded-lg">
              <p className="text-xs text-emerald-600 mb-1">Total Paid</p>
              <p className="text-sm sm:text-base font-semibold text-emerald-600 truncate">KES {(studentFee.total_paid || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Credit Carried - Show as separate card on mobile */}
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

          {/* Progress Bar - Compact on mobile */}
          <div className="w-full bg-gray-100 rounded-lg p-2 sm:p-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1 sm:mb-2">
              <span>Progress</span>
              <span className="font-semibold">{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
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

          {/* Outstanding Balance - Compact on mobile */}
          <div className="flex justify-between items-center pt-2 sm:pt-3 border-t border-gray-200">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-700">
                {showAggregated ? 'Balance' : 'Balance'}
              </span>
              {hasCredit && (
                <p className="text-xs text-blue-600 truncate">
                  ({outstandingBalance.toLocaleString()} - {creditCarriedValue.toLocaleString()} credit)
                </p>
              )}
            </div>
            <div className="text-right min-w-0 flex-shrink-0 ml-2">
              <span className={`text-base sm:text-lg font-bold ${
                outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"
              } truncate`}>
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

        {/* ===================== ACTIONS - Stack on mobile ===================== */}
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
            className={`w-full sm:w-1/2 py-2 text-sm ${
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
          <div className={`mt-2 sm:mt-3 p-2 rounded-lg border ${
            outstandingBalance <= 0 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-xs text-center ${
              outstandingBalance <= 0 ? 'text-emerald-700' : 'text-amber-700'
            } truncate`}>
              {outstandingBalance <= 0 
                ? `✓ ${hasCredit ? 'Fully paid with credit' : 'Fully paid'}`
                : `${hasCredit ? `${creditCarriedValue.toLocaleString()} credit available` : 'Payment required'}`
              }
            </p>
          </div>
        )}

        {/* ===================== CREDIT FOOTER ===================== */}
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