import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * 🔹 Fetch Teacher Profile
 */
export function useTeacherProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("auth_id", userId)
        .single();

      if (error) {
        console.error("Teacher profile error:", error);
        return;
      }
      if (!cancelled) setProfile(data);
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return profile;
}

/**
 * 🔹 Fetch Teacher Classes (UPDATED to match original TeacherDashboard)
 */
export function useTeacherClasses(teacherId: string | undefined) {
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    if (!teacherId) return;

    let cancelled = false;

    const fetchClasses = async () => {
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

      if (error) {
        console.error("Teacher classes error:", error);
        return;
      }
      if (!cancelled) setClasses(data || []);
    };

    fetchClasses();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return classes;
}

/**
 * 🔹 Fetch Teacher Assignments
 */
export function useTeacherAssignments(teacherId: string | undefined) {
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    if (!teacherId) return;

    let cancelled = false;

    const fetchAssignments = async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("teacher_id", teacherId);

      if (error) {
        console.error("Teacher assignments error:", error);
        return;
      }
      if (!cancelled) setAssignments(data || []);
    };

    fetchAssignments();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return assignments;
}

/**
 * 🔹 Fetch Teacher Announcements
 */
export function useTeacherAnnouncements(teacherId: string | undefined) {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    if (!teacherId) return;

    let cancelled = false;

    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("teacher_id", teacherId);

      if (error) {
        console.error("Teacher announcements error:", error);
        return;
      }
      if (!cancelled) setAnnouncements(data || []);
    };

    fetchAnnouncements();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return announcements;
}

/**
 * 🔹 Fetch Class Performance (FIXED: proper filtering via joined table)
 */
export function useClassPerformance(classId: string | undefined) {
  const [performance, setPerformance] = useState<any[]>([]);

  useEffect(() => {
    if (!classId) {
      setPerformance([]);
      return;
    }

    let cancelled = false;

    const fetchPerformance = async () => {
      try {
        // First, get assessments for this class
        const { data: assessments, error: assessmentsError } = await supabase
          .from("assessments")
          .select("id")
          .eq("class_id", classId);

        if (assessmentsError) {
          console.error("Assessments fetch error:", assessmentsError);
          return;
        }

        if (!assessments || assessments.length === 0) {
          setPerformance([]);
          return;
        }

        const assessmentIds = assessments.map(a => a.id);

        // Then get results for these assessments
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
          .limit(100); // Limit results for performance

        if (error) {
          console.error("Class performance error:", error);
          return;
        }
        if (!cancelled) setPerformance(data || []);
      } catch (error) {
        console.error("Error fetching class performance:", error);
      }
    };

    fetchPerformance();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  return performance;
}

/**
 * NEW: 🔹 Fetch Students by Class IDs
 */
export function useStudentsByClassIds(classIds: string[] | undefined) {
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    if (!classIds || classIds.length === 0) {
      setStudents([]);
      return;
    }

    let cancelled = false;

    const fetchStudents = async () => {
      try {
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

        if (!enrollments || enrollments.length === 0) {
          setStudents([]);
          return;
        }

        const studentIds = enrollments.map(e => e.student_id);
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

        const studentsWithEnrollments = studentsData?.map(student => {
          const studentEnrollments = enrollments.filter(e => e.student_id === student.id);
          return {
            ...student,
            enrollments: studentEnrollments
          };
        }) || [];

        if (!cancelled) setStudents(studentsWithEnrollments);
      } catch (error) {
        console.error("Error fetching students:", error);
        if (!cancelled) setStudents([]);
      }
    };

    fetchStudents();
    return () => {
      cancelled = true;
    };
  }, [classIds]);

  return students;
}