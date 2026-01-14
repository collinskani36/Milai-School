import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

serve(async (req) => {
  try {
    const { amount, admission_number, reference, bank_account, narration, term, academic_year } = await req.json();

    console.debug("Incoming payment payload:", { amount, admission_number, reference, bank_account, narration, term, academic_year });

    if (!amount || !admission_number) {
      return new Response(JSON.stringify({ error: "Missing amount or admission_number" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Supabase URL or service key missing" }), { status: 500 });
    }

    // Step 1: Lookup student
    const studentRes = await fetch(`${supabaseUrl}/rest/v1/students?Reg_no=eq.${admission_number}&select=id,first_name,last_name,Reg_no`, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    const students = await studentRes.json();
    console.debug("Found students:", students);

    const student = students[0];
    if (!student) {
      console.debug("Student not found, saving to unmatched_bank_payments");
      await fetch(`${supabaseUrl}/rest/v1/unmatched_bank_payments`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify([{
          admission_number,
          amount,
          reference,
          bank_account: bank_account ?? null,
          narration: narration ?? null,
          recorded_at: new Date().toISOString(),
          status: "unmatched"
        }])
      });

      return new Response(JSON.stringify({
        status: "unmatched",
        message: "Payment stored in unmatched table (student not found)"
      }), { status: 200 });
    }

    // Step 2: Determine term and academic_year (if not provided, find current term)
    let currentTerm = term;
    let currentYear = academic_year;
    
    // If term/year not provided, find the most recent term with outstanding balance
    if (!currentTerm || !currentYear) {
      const studentFeesRes = await fetch(
        `${supabaseUrl}/rest/v1/student_fees?student_id=eq.${student.id}&outstanding_balance=gt.0&order=academic_year.desc,term.desc&limit=1`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          }
        }
      );
      
      const studentFees = await studentFeesRes.json();
      if (studentFees.length > 0) {
        currentTerm = studentFees[0].term;
        currentYear = studentFees[0].academic_year;
        console.debug("Found current term from student_fees:", { currentTerm, currentYear });
      } else {
        // Fallback to most recent term
        const recentFeesRes = await fetch(
          `${supabaseUrl}/rest/v1/student_fees?student_id=eq.${student.id}&order=academic_year.desc,term.desc&limit=1`,
          {
            method: "GET",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            }
          }
        );
        
        const recentFees = await recentFeesRes.json();
        if (recentFees.length > 0) {
          currentTerm = recentFees[0].term;
          currentYear = recentFees[0].academic_year;
        } else {
          // Default to current term/year
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          
          // Simple term determination based on month
          if (month >= 1 && month <= 4) currentTerm = "Term 1";
          else if (month >= 5 && month <= 8) currentTerm = "Term 2";
          else currentTerm = "Term 3";
          
          currentYear = `${year}-${year + 1}`;
        }
      }
    }

    console.debug("Using term/year:", { currentTerm, currentYear });

    // Step 3: Lookup student_fees for this student
    const studentFeeRes = await fetch(`${supabaseUrl}/rest/v1/student_fees?student_id=eq.${student.id}&term=eq.${currentTerm}&academic_year=eq.${currentYear}`, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    const studentFees = await studentFeeRes.json();
    console.debug("Found student_fees:", studentFees);

    const studentFee = studentFees[0];
    if (!studentFee) {
      console.debug("Student fee not found, saving to unmatched_bank_payments");
      await fetch(`${supabaseUrl}/rest/v1/unmatched_bank_payments`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify([{
          admission_number,
          amount,
          reference,
          bank_account: bank_account ?? null,
          narration: narration ?? null,
          recorded_at: new Date().toISOString(),
          status: "unmatched_fee",
          student_id: student.id
        }])
      });

      return new Response(JSON.stringify({
        status: "unmatched",
        message: "Payment stored in unmatched table (student_fees not found for this term/year)"
      }), { status: 200 });
    }

    // Step 4: Check for duplicate transaction reference
    if (reference) {
      const duplicateCheckRes = await fetch(`${supabaseUrl}/rest/v1/p_payments?transaction_reference=eq.${reference}`, {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });

      const existingPayments = await duplicateCheckRes.json();
      if (existingPayments && existingPayments.length > 0) {
        console.debug("Duplicate transaction reference found:", reference);
        return new Response(JSON.stringify({
          error: "Duplicate transaction reference",
          message: "A payment with this reference already exists"
        }), { status: 409 });
      }
    }

    // Step 5: Insert payment into p_payments - Database triggers will handle credit system
    console.debug("Inserting payment into p_payments", {
      student_id: student.id,
      fee_id: studentFee.id,
      amount_paid: amount,
      payment_method: "kcb_bank",
      transaction_reference: reference,
      status: "completed",
      notes: narration ? `KCB Bank: ${narration}` : "KCB Bank Fee Deposit",
      payment_date: new Date().toISOString(),
      term: currentTerm,
      academic_year: currentYear,
      // Add bank account info for reference
      reference_number: `${bank_account ? `Acc: ${bank_account} - ` : ""}${reference || 'N/A'}`
    });

    const paymentRes = await fetch(`${supabaseUrl}/rest/v1/p_payments`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify([{
        student_id: student.id,
        fee_id: studentFee.id,
        amount_paid: parseFloat(amount),
        payment_method: "kcb_bank",
        transaction_reference: reference,
        status: "completed",
        notes: narration ? `KCB Bank: ${narration}` : "KCB Bank Fee Deposit",
        payment_date: new Date().toISOString(),
        term: currentTerm,
        academic_year: currentYear,
        reference_number: `${bank_account ? `Acc: ${bank_account} - ` : ""}${reference || 'N/A'}`
      }])
    });

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error("Payment insert failed:", errorText);
      throw new Error(`Payment insert failed: ${errorText}`);
    }

    const paymentData = await paymentRes.json();
    console.debug("Payment insert response:", paymentData);

    // Step 6: Update the student_fees table (triggers should handle this, but we can also update manually)
    // The triggers should handle this automatically, but we can verify or update if needed
    
    // Get updated student fee info
    const updatedFeeRes = await fetch(`${supabaseUrl}/rest/v1/student_fees?id=eq.${studentFee.id}`, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    const updatedFee = await updatedFeeRes.json();
    
    return new Response(JSON.stringify({
      success: true,
      message: "Payment recorded successfully",
      student: `${student.first_name} ${student.last_name}`,
      admission_number: student.Reg_no,
      fee_id: studentFee.id,
      term: currentTerm,
      academic_year: currentYear,
      payment: paymentData[0],
      updated_balance: updatedFee[0]?.outstanding_balance || 0,
      credit_carried: updatedFee[0]?.credit_carried || 0,
      note: "Database triggers will automatically handle credit calculations for overpayments"
    }), { 
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    console.error("Error in KCB payment function:", err);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: err.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});