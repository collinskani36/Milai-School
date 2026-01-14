// Supabase Edge Function (Deno) - Create Student using Guardian Email as Auth Email

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonError("Missing Supabase env vars");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const body = await req.json();

    const {
      reg_no,
      first_name,
      last_name,
      gender,
      date_of_birth,
      phone,
      class_id,
      student_type = "Day Scholar",
      guardian_name,
      guardian_phone,
      guardian_email,
      password,
    } = body;

    if (!reg_no || !first_name || !last_name || !guardian_email)
      return jsonError("reg_no, first_name, last_name, and guardian_email are required");

    // 1️⃣ Check duplicate registration number
    const { data: existing } = await admin
      .from("students")
      .select("id")
      .eq("Reg_no", reg_no)
      .maybeSingle();

    if (existing) return jsonError("Student with this registration number already exists");

    // 2️⃣ Create Supabase Auth user using guardian email
    const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: guardian_email,
        password: password || "ChangeMe123!",
        email_confirm: true,
        user_metadata: {
          role: "student",
          reg_no,
          first_name,
          last_name,
        },
      }),
    });

    const authUser = await authResp.json();
    if (!authResp.ok || !authUser?.id) return jsonError("Auth user creation failed", authUser);
    const authUserId = authUser.id;

    // 3️⃣ Insert into students table
    const { data: student, error: studentErr } = await admin
      .from("students")
      .insert([{ Reg_no: reg_no, first_name, last_name, auth_id: authUserId }])
      .select("id")
      .single();

    if (studentErr) {
      await deleteAuthUser(SUPABASE_URL, SERVICE_ROLE_KEY, authUserId);
      return jsonError("Student insert failed", studentErr.message);
    }

    const studentId = student.id;

    // 4️⃣ Insert into profiles table
    const { error: profileErr } = await admin.from("profiles").insert([
      {
        student_id: studentId,
        reg_no,
        first_name,
        last_name,
        gender,
        date_of_birth,
        phone,
        email: `${reg_no}@school.local`, // MASKED email for profile
        guardian_email, // REAL email used for auth
        guardian_name: guardian_name || "",
        guardian_phone: guardian_phone || "",
        student_type,
      },
    ]);

    if (profileErr) {
      await admin.from("students").delete().eq("id", studentId);
      await deleteAuthUser(SUPABASE_URL, SERVICE_ROLE_KEY, authUserId);
      return jsonError("Profile creation failed", profileErr.message);
    }

    // 5️⃣ Optional enrollment
    if (class_id) {
      await admin.from("enrollments").insert([{ student_id: studentId, class_id }]);
    }

    return new Response(JSON.stringify({ ok: true, student_id: studentId, auth_user_id: authUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Internal server error", String(err));
  }
});

function jsonError(message: string, detail?: any) {
  return new Response(JSON.stringify({ ok: false, error: message, detail }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteAuthUser(url: string, key: string, userId: string) {
  await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
}
