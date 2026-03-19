// src/hooks/useTeacherData.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// ─── Fetch functions ──────────────────────────────────────────────────────────

async function fetchTeacherProfile(userId: string) {
  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("auth_id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function fetchTeacherClasses(teacherId: string) {
  const { data, error } = await supabase
    .from("teacher_classes")
    .select(`
      id,
      teacher_id,
      class_id,
      subject_id,
      created_at,
      classes (
        id,
        name,
        grade_level,
        created_at
      ),
      subjects (
        id,
        name,
        code,
        created_at
      )
    `)
    .eq("teacher_id", teacherId);

  if (error) throw error;
  return data ?? [];
}

async function fetchTeacherAssignments(teacherId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("teacher_id", teacherId);

  if (error) throw error;
  return data ?? [];
}

async function fetchTeacherAnnouncements(teacherId: string) {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("teacher_id", teacherId);

  if (error) throw error;
  return data ?? [];
}

async function fetchClassPerformance(classId: string) {
  // Step 1: get all assessment IDs for this class
  const { data: assessments, error: assessmentsError } = await supabase
    .from("assessments")
    .select("id")
    .eq("class_id", classId);

  if (assessmentsError) throw assessmentsError;
  if (!assessments || assessments.length === 0) return [];

  const assessmentIds = assessments.map((a) => a.id);

  // Step 2: fetch results for those assessments
  const { data, error } = await supabase
    .from("assessment_results")
    .select(`
      id,
      score,
      student_id,
      assessment_date,
      max_marks,
      subject_id,
      assessments (
        id,
        title,
        term,
        year,
        class_id,
        created_at
      ),
      subjects (
        name
      )
    `)
    .in("assessment_id", assessmentIds)
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

async function fetchStudentsByClassIds(classIds: string[]) {
  // Step 1: get enrollments for all class IDs
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select(`
      student_id,
      class_id,
      classes (
        name,
        grade_level
      )
    `)
    .in("class_id", classIds);

  if (enrollError) throw enrollError;
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.student_id);

  // Step 2: fetch the actual student records
  const { data: studentsData, error: studentsError } = await supabase
    .from("students")
    .select(`
      id,
      Reg_no,
      first_name,
      last_name,
      created_at,
      auth_id,
      profiles (*)
    `)
    .in("id", studentIds);

  if (studentsError) throw studentsError;

  // Attach enrollment info (class name, grade) to each student
  return (studentsData ?? []).map((student) => ({
    ...student,
    enrollments: enrollments.filter((e) => e.student_id === student.id),
  }));
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Teacher profile — looked up by Supabase auth UID.
 * Cached 10 min; profile data is stable.
 */
export function useTeacherProfile(userId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey:  ["teacherProfile", userId],
    queryFn:   () => fetchTeacherProfile(userId!),
    enabled:   !!userId,
    staleTime: 1000 * 60 * 10, // 10 min
  });

  return { data: data ?? null, loading: isLoading, error };
}

/**
 * All classes (+ subjects) assigned to a teacher.
 * Cached 10 min; class assignments change rarely.
 */
export function useTeacherClasses(teacherId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey:  ["teacherClasses", teacherId],
    queryFn:   () => fetchTeacherClasses(teacherId!),
    enabled:   !!teacherId,
    staleTime: 1000 * 60 * 10, // 10 min
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * Assignments created by this teacher.
 * Cached 5 min; teachers update assignments regularly.
 */
export function useTeacherAssignments(teacherId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey:  ["teacherAssignments", teacherId],
    queryFn:   () => fetchTeacherAssignments(teacherId!),
    enabled:   !!teacherId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * Announcements posted by this teacher.
 * Short stale time (2 min) — announcements are time-sensitive.
 */
export function useTeacherAnnouncements(teacherId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey:  ["teacherAnnouncements", teacherId],
    queryFn:   () => fetchTeacherAnnouncements(teacherId!),
    enabled:   !!teacherId,
    staleTime: 1000 * 60 * 2, // 2 min
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * Assessment results for an entire class.
 * Two-step fetch: assessments → results (avoids unbounded join).
 * Cached 5 min.
 */
export function useClassPerformance(classId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey:  ["classPerformance", classId],
    queryFn:   () => fetchClassPerformance(classId!),
    enabled:   !!classId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * All students enrolled across a set of class IDs.
 * Two-step fetch: enrollments → student profiles.
 * Cached 10 min; enrolment changes are infrequent.
 *
 * Pass a stable array reference (e.g. from useMemo) to avoid
 * spurious refetches — the query key is JSON-serialised for comparison.
 */
export function useStudentsByClassIds(classIds: string[] | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey:  ["studentsByClassIds", classIds ?? []],
    queryFn:   () => fetchStudentsByClassIds(classIds!),
    enabled:   !!classIds && classIds.length > 0,
    staleTime: 1000 * 60 * 10, // 10 min
  });

  return { data: data ?? [], loading: isLoading, error };
}