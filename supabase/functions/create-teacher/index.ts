import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password, teacher_code, first_name, last_name, phone, is_admin } = await req.json();

    console.log("Request body:", { email, password, teacher_code, first_name, last_name, phone, is_admin });

    if (!teacher_code || !first_name || !last_name) {
      return jsonError("Teacher code, first name, and last name are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Step 1: Check if teacher already exists in teachers table ---
    const { data: existingTeacher, error: checkError } = await supabase
      .from("teachers")
      .select("teacher_code")
      .eq("teacher_code", teacher_code)
      .maybeSingle();

    if (checkError) return jsonError(`Check existing teacher failed: ${checkError.message}`);
    if (existingTeacher) return jsonError(`Teacher code '${teacher_code}' already exists`);

    const teacherEmail = email || `${teacher_code.toLowerCase()}@school.local`;

    // --- Step 2: Create auth user ---
    let authUserId: string;
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: teacherEmail,
        password: password || generateTempPassword(),
        email_confirm: true,
        user_metadata: { user_type: "teacher", teacher_code, first_name, last_name },
      });

      if (authError && authError.message.includes("already registered")) {
        console.log("Auth user already exists. Fetching existing user...");
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
          filter: { email: teacherEmail },
        });
        if (listError) return jsonError(`List existing users failed: ${listError.message}`);
        const existingUser = existingUsers?.users?.[0];
        if (!existingUser) return jsonError("Existing auth user not found");
        authUserId = existingUser.id;

        // Update metadata
        await supabase.auth.admin.updateUserById(authUserId, {
          user_metadata: { user_type: "teacher", teacher_code, first_name, last_name },
        });
        console.log("Existing auth user metadata updated:", authUserId);
      } else if (authError) {
        return jsonError(`Auth creation failed: ${authError.message}`);
      } else {
        authUserId = authData.user.id;
        console.log("New auth user created:", authUserId);
      }
    } catch (authEx: any) {
      return jsonError(`Auth exception: ${authEx.message}`);
    }

    // --- Step 3: Insert into teachers table ---
    console.log("Payload for teacher insert:", {
      auth_id: authUserId,
      teacher_code,
      first_name,
      last_name,
      email: teacherEmail,
      phone,
      is_admin,
    });

    const teacherData = await createTeacherRecord(
      supabase,
      authUserId,
      teacher_code,
      first_name,
      last_name,
      teacherEmail,
      phone,
      !!is_admin
    );

    console.log("Teacher inserted successfully:", teacherData);

    return new Response(
      JSON.stringify({ ok: true, user: { id: authUserId, email: teacherEmail }, teacher: teacherData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (ex: any) {
    console.error("Unexpected error:", ex);
    return jsonError(`Unexpected error: ${ex.message}`, 500);
  }
});

// --- Helper to insert teacher record ---
async function createTeacherRecord(
  supabaseClient: any,
  authId: string,
  teacher_code: string,
  first_name: string,
  last_name: string,
  email: string,
  phone: string | null,
  isAdmin: boolean
) {
  const payload = { auth_id: authId, teacher_code, first_name, last_name, email, phone: phone || null, is_admin: isAdmin };
  console.log("Inserting teacher record for auth ID:", authId);

  const { data, error } = await supabaseClient.from("teachers").insert([payload]).select().single();

  if (error) {
    console.error("Error inserting teacher record:", error);
    try { await supabaseClient.auth.admin.deleteUser(authId); } catch {}
    throw new Error(`Teacher record creation failed: ${error.message}`);
  }

  return data;
}

// --- Helper to generate temp password ---
function generateTempPassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 10; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
  return password + "!";
}

// --- JSON error helper ---
function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
