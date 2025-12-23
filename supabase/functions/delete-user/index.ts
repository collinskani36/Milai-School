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
    const { studentId, userId } = await req.json()
    
    if (!studentId) {
      throw new Error('Student ID is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const result = {
      deletedStudents: 0,
      deletedProfiles: 0,
      deletedEnrollments: 0,
      authDeleted: false,
      warnings: [] as string[]
    }

    // 1. First delete enrollments (child records)
    const { error: enrollError, count: enrollCount } = await supabaseClient
      .from('enrollments')
      .delete()
      .eq('student_id', studentId)
      .select('*', { count: 'exact', head: true })

    if (enrollError) {
      result.warnings.push(`Enrollments deletion failed: ${enrollError.message}`)
    } else {
      result.deletedEnrollments = enrollCount || 0
    }

    // 2. Delete profiles (child records)
    const { error: profileError, count: profileCount } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('student_id', studentId)
      .select('*', { count: 'exact', head: true })

    if (profileError) {
      result.warnings.push(`Profiles deletion failed: ${profileError.message}`)
    } else {
      result.deletedProfiles = profileCount || 0
    }

    // 3. Delete the student record
    const { error: studentError, count: studentCount } = await supabaseClient
      .from('students')
      .delete()
      .eq('id', studentId)
      .select('*', { count: 'exact', head: true })

    if (studentError) {
      throw new Error(`Failed to delete student: ${studentError.message}`)
    } else {
      result.deletedStudents = studentCount || 0
    }

    // 4. Delete auth user if userId is provided
    if (userId) {
      const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId)
      if (authError) {
        result.warnings.push(`Auth user deletion failed: ${authError.message}`)
      } else {
        result.authDeleted = true
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        message: `Deleted student and ${result.deletedEnrollments} enrollment(s), ${result.deletedProfiles} profile(s)` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})