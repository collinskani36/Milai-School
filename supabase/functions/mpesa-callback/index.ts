import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa Callback:", JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      console.error("Invalid callback body:", body);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const isSuccess = ResultCode === 0;

    let mpesaAmount: number | null = null;
    let mpesaReceiptNumber: string | null = null;
    let transactionDate: string | null = null;
    let phoneNumber: string | null = null;

    if (isSuccess && CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Name === "Amount") mpesaAmount = item.Value;
        if (item.Name === "MpesaReceiptNumber") mpesaReceiptNumber = item.Value;
        if (item.Name === "TransactionDate") transactionDate = item.Value?.toString();
        if (item.Name === "PhoneNumber") phoneNumber = item.Value?.toString();
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find pending record
    const { data: txRow, error: txFetchError } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .single();

    if (txFetchError || !txRow) {
      console.error("mpesa_transaction not found for:", CheckoutRequestID, txFetchError);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update mpesa_transactions
    await supabase
      .from("mpesa_transactions")
      .update({
        status: isSuccess ? "completed" : "failed",
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_date: transactionDate,
        phone_number: phoneNumber ?? txRow.phone_number,
        raw_callback: body,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", CheckoutRequestID);

    // Insert into p_payments on success
    if (isSuccess) {
      const { error: paymentError } = await supabase
        .from("p_payments")
        .insert({
          student_id: txRow.student_id,
          fee_id: txRow.fee_id ?? null,
          student_fee_id: txRow.student_fee_id ?? null,
          amount_paid: mpesaAmount ?? txRow.amount,
          payment_date: new Date().toISOString(),
          payment_method: "mpesa",
          transaction_reference: mpesaReceiptNumber,
          reference_number: mpesaReceiptNumber,
          status: "completed",
          term: txRow.term,
          academic_year: txRow.academic_year,
          notes: `M-Pesa payment. Phone: ${phoneNumber ?? txRow.phone_number}`,
          inserted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (paymentError) {
        console.error("Failed to insert p_payments:", paymentError);
      } else {
        console.log(`p_payments created — Receipt: ${mpesaReceiptNumber}, Amount: ${mpesaAmount}`);
      }
    }

    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Callback error:", err);
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
