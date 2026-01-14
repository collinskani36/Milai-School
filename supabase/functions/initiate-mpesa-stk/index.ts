// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

serve(async (req) => {
  try {
    const { amount, phone, admission_number } = await req.json();

    if (!amount || !phone || !admission_number) {
      return new Response(
        JSON.stringify({ error: "Missing amount, phone, or admission_number" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Load environment variables
    const shortcode = Deno.env.get("MPESA_SHORTCODE") || "174379";
    const passkey = Deno.env.get("MPESA_PASSKEY") || 
      "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL") || "";
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");

    if (!consumerKey || !consumerSecret || !callbackUrl) {
      return new Response(
        JSON.stringify({ error: "Missing MPESA credentials or callback URL" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 1: Generate OAuth Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      method: "GET",
      headers: { "Authorization": `Basic ${auth}` }
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to get OAuth token", details: tokenData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const accessToken = tokenData.access_token;

    // STEP 2: Generate Timestamp & Password
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const password = btoa(shortcode + passkey + timestamp);

    // STEP 3: Prepare STK Push payload
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,        // customer phone
      PartyB: shortcode,    // receiving shortcode
      PhoneNumber: phone,   // same as PartyA
      CallBackURL: callbackUrl,
      AccountReference: admission_number,
      TransactionDesc: "School Fees Payment"
    };

    // STEP 4: Call M-Pesa STK Push API
    const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stkPayload)
    });

    const stkData = await stkRes.json();

    return new Response(
      JSON.stringify({ success: true, stk_response: stkData }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error in initiate-mpesa-stk:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
