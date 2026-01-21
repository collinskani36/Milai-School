import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Building2, CreditCard, MapPin, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { useState } from "react";

export default function BankDetailsCard() {
  const [copied, setCopied] = useState(null);

  const bankDetails = {
    bank: "KCB Bank",
    accountName: "[Fredan Academy]",
    accountNumber: "[Account Number]",
    branch: "[Branch Name]",
    swiftCode: "KCABORXXX"
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const DetailRow = ({ icon: Icon, label, value, field }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-100 group hover:shadow-sm transition-all">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-50">
          <Icon className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="font-semibold text-gray-900 mt-0.5">{value}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(value, field)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied === field ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <Copy className="w-4 h-4 text-gray-400" />
        )}
      </Button>
    </div>
  );

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
      <CardHeader className="pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">School Bank Details</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">Use these details for fee payments</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-3">
        <DetailRow icon={Building2} label="Bank Name" value={bankDetails.bank} field="bank" />
        <DetailRow icon={CreditCard} label="Account Name" value={bankDetails.accountName} field="accountName" />
        <DetailRow icon={CreditCard} label="Account Number" value={bankDetails.accountNumber} field="accountNumber" />
        <DetailRow icon={MapPin} label="Branch" value={bankDetails.branch} field="branch" />
        
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Important:</strong> Please include your admission number as the payment reference to ensure proper allocation of your payment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}