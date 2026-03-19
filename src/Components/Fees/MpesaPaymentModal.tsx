"use client";

import React, { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import {
  X,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Loader2,
  GraduationCap,
  Lock,
} from "lucide-react";

interface MpesaPaymentModalProps {
  onClose: () => void;
  student: any;
  className: string;
  outstandingBalance: number;
  selectedTerm: string;
  selectedYear: string;
  studentFeeId?: string | null;
  currentTerm?: { term: string; academic_year: string } | null;
}

type Step = "form" | "processing" | "success" | "error";

const LOCAL_SERVER_URL = "https://c8ac-102-68-78-245.ngrok-free.app";

export default function MpesaPaymentModal({
  onClose,
  student,
  className,
  outstandingBalance,
  selectedTerm,
  selectedYear,
  studentFeeId,
  currentTerm,
}: MpesaPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState(
    outstandingBalance > 0 ? outstandingBalance.toString() : ""
  );
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const studentName = student
    ? `${student.first_name} ${student.last_name}`
    : "Student";

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/\s+/g, "");
    return /^(07|01)\d{8}$/.test(cleaned) || /^(\+?254)\d{9}$/.test(cleaned);
  };

  const handlePay = async () => {
    setError("");

    if (!validatePhone(phoneNumber)) {
      setError("Enter a valid Safaricom number e.g. 0712345678");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 1) {
      setError("Amount must be at least KES 1");
      return;
    }

    setStep("processing");

    try {
      const response = await fetch(`${LOCAL_SERVER_URL}/initiate-mpesa-stk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          amount: parsedAmount,
          studentId: student?.id,
          studentName,
          term: selectedTerm,
          academicYear: selectedYear,
          regNo: student?.Reg_no,
          studentFeeId: studentFeeId ?? null,
          feeId: studentFeeId ?? null,
        }),
      });

      const data = await response.json();

      if (data?.success) {
        setSuccessMessage(
          data.customerMessage ||
            "STK Push sent! Check your phone and enter your M-Pesa PIN."
        );
        setStep("success");
      } else {
        throw new Error(data?.error || "Payment initiation failed");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  };

  // On mobile: overlay ends at bottom-16 (64px) — exactly the StudentDashboard's
  // fixed `h-16` bottom nav height. Modal sheet fills the space above it cleanly.
  // On sm+: standard full-screen centered modal.
  return (
    <div className="fixed inset-x-0 top-0 bottom-16 sm:inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">

      {/* Modal sheet */}
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-full sm:max-h-[90vh]">

        {/* Header — sticky, never scrolls away */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Pay with M-Pesa</h3>
              <p className="text-green-100 text-xs">Lipa na M-Pesa · Secure Payment</p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close payment modal"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 hover:bg-white/35 active:bg-white/50 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60 flex-shrink-0"
          >
            <X className="w-4 h-4 text-white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">

          {/* STEP: FORM */}
          {(step === "form" || step === "error") && (
            <div className="space-y-4">

              {/* Student Info */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Student Details
                  </span>
                  <Lock className="w-3 h-3 text-gray-400 ml-auto" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Name</span>
                    <span className="text-sm font-semibold text-gray-800">{studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Reg No.</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {student?.Reg_no || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Class</span>
                    <span className="text-sm font-semibold text-gray-800">{className}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Term</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {selectedTerm} · {selectedYear}
                    </span>
                  </div>
                  {outstandingBalance > 0 && (
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-amber-600 font-medium">Balance Due</span>
                      <span className="text-sm font-bold text-amber-600">
                        KES {outstandingBalance.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  M-Pesa Phone Number
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-500">🇰🇪</span>
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    maxLength={13}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  The M-Pesa PIN prompt will be sent to this number
                </p>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Amount (KES)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <span className="text-sm font-medium text-gray-500">KES</span>
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    min={1}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                {outstandingBalance > 0 && (
                  <button
                    onClick={() => setAmount(outstandingBalance.toString())}
                    className="text-xs text-emerald-600 hover:text-emerald-700 mt-1 font-medium"
                  >
                    Pay full balance (KES {outstandingBalance.toLocaleString()})
                  </button>
                )}
              </div>

              {/* Error */}
              {(error || step === "error") && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error || "Payment failed. Please try again."}</p>
                </div>
              )}

              {/* Pay Button */}
              <button
                onClick={handlePay}
                className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200 text-sm"
              >
                Send STK Push →
              </button>

              <p className="text-center text-xs text-gray-400 pb-1">
                🔒 Secured by Safaricom M-Pesa. Your PIN is never shared.
              </p>
            </div>
          )}

          {/* STEP: PROCESSING */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-base">Sending STK Push...</p>
                <p className="text-sm text-gray-500 mt-1">
                  Check your phone <span className="font-medium">{phoneNumber}</span> for the M-Pesa prompt
                </p>
              </div>
              <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">What to do next:</p>
                    <ol className="text-xs text-emerald-700 mt-1 space-y-1 list-decimal list-inside">
                      <li>A pop-up will appear on your phone</li>
                      <li>Enter your M-Pesa PIN</li>
                      <li>Confirm the payment</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP: SUCCESS */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-800 text-base">STK Push Sent!</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">{successMessage}</p>
              </div>
              <div className="w-full space-y-2">
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Student</span>
                    <span className="font-medium">{studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-bold text-emerald-600">
                      KES {parseFloat(amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium">{phoneNumber}</span>
                  </div>
                </div>
                <Badge className="w-full justify-center bg-amber-50 text-amber-700 border-amber-200 py-2">
                  ⏳ Waiting for PIN confirmation on your phone
                </Badge>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
              >
                Done
              </button>
            </div>
          )}

        </div>
        {/* end scrollable body */}

      </div>
      {/* end modal sheet */}

    </div>
  );
}