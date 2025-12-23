import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      email, 
      password, 
      teacher_code, 
      first_name, 
      last_name, 
      phone, 
      is_admin
    } = await req.json()
    
    if (!teacher_code || !first_name || !last_name) {
      throw new Error('Teacher code, first name, and last name are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use provided email or generate one from teacher code
    const teacherEmail = email || `${teacher_code}@school.local`

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: teacherEmail,
      password: password || 'tempPassword123',
      email_confirm: true,
      user_metadata: {
        user_type: 'teacher',
        teacher_code,
        first_name,
        last_name
      }
    })

    if (authError) {
      // If user already exists, try to get the existing user
      if (authError.message.includes('already registered')) {
        const { data: existingUser } = await supabaseClient.auth.admin.listUsers()
        const user = existingUser.users.find(u => u.email === teacherEmail)
        
        if (user) {
          // Update user metadata for existing user
          await supabaseClient.auth.admin.updateUserById(user.id, {
            user_metadata: {
              user_type: 'teacher',
              teacher_code,
              first_name,
              last_name
            }
          })
          
          // Continue with teacher creation using existing user ID
          const teacherData = await createTeacherRecord(
            supabaseClient,
            user.id,
            teacher_code,
            first_name,
            last_name,
            teacherEmail,
            phone,
            is_admin
          )
          
          return new Response(
            JSON.stringify({ 
              ok: true, 
              user: user,
              teacher: teacherData,
              message: 'Teacher created successfully with existing auth user'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
      }
      throw new Error(`Auth creation failed: ${authError.message}`)
    }

    const user = authData.user

    // 2. Create teacher record
    const teacherData = await createTeacherRecord(
      supabaseClient,
      user.id,
      teacher_code,
      first_name,
      last_name,
      teacherEmail,
      phone,
      is_admin
    )

    return new Response(
      JSON.stringify({ 
        ok: true, 
        user: user,
        teacher: teacherData,
        message: 'Teacher created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Helper function to create teacher record
async function createTeacherRecord(
  supabaseClient: any,
  authId: string,
  teacher_code: string,
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  is_admin: boolean
) {
  const teacherPayload = {
    auth_id: authId,
    teacher_code,
    first_name,
    last_name,
    email,
    phone,
    is_admin: is_admin || false
  }

  const { data: teacherData, error: teacherError } = await supabaseClient
    .from('teachers')
    .insert([teacherPayload])
    .select()
    .single()

  if (teacherError) {
    // If teacher record creation fails, delete the auth user we just created
    await supabaseClient.auth.admin.deleteUser(authId)
    throw new Error(`Teacher record creation failed: ${teacherError.message}`)
  }

  return teacherData
}