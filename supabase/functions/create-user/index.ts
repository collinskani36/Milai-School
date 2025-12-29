// The function runs in Supabase Edge (Deno). For local TypeScript checks we
// suppress unresolved URL imports and provide a minimal Deno stub.
// @ts-ignore: URL import used in Deno runtime
import { serve } from "https://deno.land/std/http/server.ts";
// @ts-ignore: URL import used in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Minimal Deno global stub for editor type-checking
declare const Deno: any;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }), { status: 500, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const { email, password, reg_no, first_name, last_name, date_of_birth, gender, phone, class_id } = body;

    if (!email || !password || !reg_no || !first_name || !last_name) {
      return new Response(JSON.stringify({ error: "email, password, reg_no, first_name, and last_name are required" }), { status: 400, headers: corsHeaders });
    }

    // 1️⃣ Check if student Reg_no already exists
    const { data: existingStudent, error: dupErr } = await admin.from("students").select("id").eq("Reg_no", reg_no).maybeSingle();
    if (dupErr) throw dupErr;
    if (existingStudent) {
      return new Response(JSON.stringify({ error: "Student with this registration number already exists" }), { status: 409, headers: corsHeaders });
    }

    // 2️⃣ Create Auth user via Admin REST API with auto-confirm email
    let userId: string;
    let createdUserObj: any;
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password, email_confirm: true }) // ✅ Auto-confirm email
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.id) throw new Error(`Auth creation failed: ${JSON.stringify(json)}`);
      userId = json.id;
      createdUserObj = json;
    } catch (authErr) {
      console.error("Auth creation failed", authErr);
      return new Response(JSON.stringify({ error: "Auth creation failed", detail: String(authErr) }), { status: 500, headers: corsHeaders });
    }

    // 3️⃣ Insert into students table
    const { data: sRes, error: sErr } = await admin.from("students").insert([{ Reg_no: reg_no, first_name, last_name, auth_id: userId }]).select("*").single();
    if (sErr) {
      // Rollback Auth user
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } });
      throw sErr;
    }
    const studentId = sRes.id;

    // 4️⃣ Insert profile
    const { error: pErr } = await admin.from("profiles").insert([{
      student_id: studentId,
      reg_no,
      first_name,
      last_name,
      date_of_birth,
      gender,
      phone,
      email
    }]);
    if (pErr) {
      // Rollback Auth user and student
      await admin.from("students").delete().eq("id", studentId);
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } });
      throw pErr;
    }

    // 5️⃣ Optional enrollment
    if (class_id) {
      const { error: eErr } = await admin.from("enrollments").insert([{ student_id: studentId, class_id }]);
      if (eErr) {
        // Rollback everything
        await admin.from("profiles").delete().eq("student_id", studentId);
        await admin.from("students").delete().eq("id", studentId);
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } });
        throw eErr;
      }
    }

    return new Response(JSON.stringify({ ok: true, studentId, userId, user: createdUserObj }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("Function error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
