import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY") ?? "";
const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") ?? "";
const SHORTCODE = "174379";
const PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const res = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { method: "GET", headers: { Authorization: `Basic ${credentials}` } }
  );
  if (!res.ok) throw new Error(`Token fetch failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

function generatePassword(): { password: string; timestamp: string } {
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
  return { password, timestamp };
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\s+/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phoneNumber, amount, studentId, studentName, term, academicYear, regNo, studentFeeId, feeId } = await req.json();

    if (!phoneNumber || !amount || !studentId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phoneNumber, amount, studentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount < 1) {
      return new Response(
        JSON.stringify({ error: "Amount must be at least KES 1" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = normalizePhone(phoneNumber);
    const accessToken = await getAccessToken();
    const { password, timestamp } = generatePassword();

    const accountReference = regNo || studentId.slice(0, 12);
    const transactionDesc = `${studentName} - ${term} ${academicYear} Fees`;

    const stkBody = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: "https://3692-102-68-78-245.ngrok-free.app/mpesa-callback",
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(stkBody),
      }
    );

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({ success: false, error: stkData.errorMessage || stkData.ResponseDescription || "STK push failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save PENDING record — callback will find this via checkout_request_id
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: insertError } = await supabase
      .from("mpesa_transactions")
      .insert({
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        student_id: studentId,
        student_fee_id: studentFeeId ?? null,
        fee_id: feeId ?? studentFeeId ?? null,
        amount: Math.ceil(amount),
        phone_number: phone,
        term: term,
        academic_year: academicYear,
        student_name: studentName,
        reg_no: regNo ?? null,
        status: "pending",
        created_at: new Date().toISOString(),
      });

    if (insertError) console.error("Failed to save pending mpesa_transaction:", insertError);

    return new Response(
      JSON.stringify({ success: true, checkoutRequestID: stkData.CheckoutRequestID, merchantRequestID: stkData.MerchantRequestID, customerMessage: stkData.CustomerMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("STK Push Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
