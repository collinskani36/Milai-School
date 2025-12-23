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
    const { teacherId, userId } = await req.json()
    
    if (!teacherId) {
      throw new Error('Teacher ID is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const result = {
      deletedTeachers: 0,
      deletedTeacherClasses: 0,
      authDeleted: false,
      warnings: [] as string[]
    }

    // 1. First delete teacher_classes assignments
    const { error: classError, count: classCount } = await supabaseClient
      .from('teacher_classes')
      .delete()
      .eq('teacher_id', teacherId)
      .select('*', { count: 'exact', head: true })

    if (classError) {
      result.warnings.push(`Teacher classes deletion failed: ${classError.message}`)
    } else {
      result.deletedTeacherClasses = classCount || 0
    }

    // 2. Delete the teacher record
    const { error: teacherError, count: teacherCount } = await supabaseClient
      .from('teachers')
      .delete()
      .eq('id', teacherId)
      .select('*', { count: 'exact', head: true })

    if (teacherError) {
      throw new Error(`Failed to delete teacher: ${teacherError.message}`)
    } else {
      result.deletedTeachers = teacherCount || 0
    }

    // 3. Delete auth user if userId is provided
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
        message: `Deleted teacher and ${result.deletedTeacherClasses} class assignment(s)` 
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