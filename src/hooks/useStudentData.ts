// src/hooks/useStudentData.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// ─── Term helpers ────────────────────────────────────────────────────────────
// Kenya CBC calendar:
//   Term 1 → Jan–Apr   (months 1–4)
//   Term 2 → May–Aug   (months 5–8)
//   Term 3 → Sep–Nov   (months 9–11)

function getCurrentTermAndYear(): { term: number; year: number } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();
  const term = month <= 4 ? 1 : month <= 8 ? 2 : 3;
  return { term, year };
}

/**
 * Returns the approximate start/end dates for the current term so we can
 * filter attendance records (which are date-ranged, not term-numbered).
 */
function getCurrentTermDateRange(): { start: string; end: string } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let start: string;
  let end: string;

  if (month <= 4) {
    start = `${year}-01-01`;
    end   = `${year}-04-30`;
  } else if (month <= 8) {
    start = `${year}-05-01`;
    end   = `${year}-08-31`;
  } else {
    start = `${year}-09-01`;
    end   = `${year}-11-30`;
  }

  return { start, end };
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Fetch functions (pure async — easy to test independently) ───────────────

async function fetchStudentProfile(studentId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", studentId)
    .single();

  if (error) throw error;
  return data;
}

async function fetchStudentAssessments(studentId: string) {
  const { term, year } = getCurrentTermAndYear();

  const { data, error } = await supabase
    .from("assessment_results")
    .select(
      `
      id,
      score,
      status,
      performance_level,
      teacher_remarks,
      is_absent,
      assessment_date,
      subjects ( id, name, code ),
      assessments (
        id,
        title,
        term,
        year,
        category,
        max_marks,
        assessment_date
      )
    `
    )
    .eq("student_id", studentId)
    .eq("assessments.term", term)
    .eq("assessments.year", year)
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

async function fetchStudentAssignments(classId: string) {
  const { start, end } = getCurrentTermDateRange();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      title,
      description,
      due_date,
      total_marks,
      file_url,
      subjects ( id, name, code )
    `
    )
    .eq("class_id", classId)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

async function fetchStudentAnnouncements(classId?: string) {
  let query = supabase
    .from("announcements")
    .select(
      "id, title, content, priority, created_at, expires_at, class_id, is_for_all_classes"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (classId) {
    query = query.or(`is_for_all_classes.eq.true,class_id.eq.${classId}`);
  } else {
    query = query.eq("is_for_all_classes", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function fetchStudentAttendance(studentId: string) {
  const { start, end } = getCurrentTermDateRange();

  const { data, error } = await supabase
    .from("attendance")
    .select(
      "id, status, week_start, week_end, monday, tuesday, wednesday, thursday, friday"
    )
    .eq("student_id", studentId)
    .gte("week_start", start)
    .lte("week_end", end)
    .order("week_start", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Student profile — single row, cached for 10 minutes.
 * Profile data is stable; no need to refetch often.
 */
export function useStudentProfile(studentId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentProfile", studentId],
    queryFn:  () => fetchStudentProfile(studentId),
    enabled:  !!studentId,
    staleTime: 1000 * 60 * 10, // 10 min — profile data rarely changes
  });

  return { data: data ?? null, loading: isLoading, error };
}

/**
 * Assessment results for the current term only.
 * Cached for 5 minutes; stale after since scores can be updated by teachers.
 */
export function useStudentAssessments(studentId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentAssessments", studentId],
    queryFn:  () => fetchStudentAssessments(studentId),
    enabled:  !!studentId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * Assignments for the student's class this term.
 * Cached for 5 minutes.
 */
export function useStudentAssignments(classId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentAssignments", classId],
    queryFn:  () => fetchStudentAssignments(classId),
    enabled:  !!classId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * Announcements — school-wide or class-specific, latest 20.
 * Short stale time (2 min) since announcements are time-sensitive.
 */
export function useStudentAnnouncements(classId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentAnnouncements", classId ?? "all"],
    queryFn:  () => fetchStudentAnnouncements(classId),
    staleTime: 1000 * 60 * 2, // 2 min — announcements change more frequently
  });

  return { data: data ?? [], loading: isLoading, error };
}

/**
 * Attendance records for the current term only (~13 weeks max).
 * Cached for 5 minutes.
 */
export function useStudentAttendance(studentId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentAttendance", studentId],
    queryFn:  () => fetchStudentAttendance(studentId),
    enabled:  !!studentId,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  return { data: data ?? [], loading: isLoading, error };
}