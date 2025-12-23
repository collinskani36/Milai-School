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
 * 🔹 Fetch Teacher Classes
 */
export function useTeacherClasses(teacherId: string | undefined) {
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    if (!teacherId) return;

    let cancelled = false;

    const fetchClasses = async () => {
      const { data, error } = await supabase
        .from("teacher_class_subjects")
        .select(`
          id,
          class_id,
          subject_id,
          classes (id, name),
          subjects (id, name)
        `)
        .eq("teacher_id", teacherId);

      if (error) {
        console.error("Teacher classes error:", error);
        return;
      }
      if (!cancelled) setClasses(data);
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
      if (!cancelled) setAssignments(data);
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
      if (!cancelled) setAnnouncements(data);
    };

    fetchAnnouncements();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return announcements;
}

/**
 * 🔹 Fetch Class Performance (example: average scores per class)
 */
export function useClassPerformance(classId: string | undefined) {
  const [performance, setPerformance] = useState<any[]>([]);

  useEffect(() => {
    if (!classId) return;

    let cancelled = false;

    const fetchPerformance = async () => {
      const { data, error } = await supabase
        .from("exam_results")
        .select(`
          id,
          score,
          student_ref,
          exam_id,
          students (first_name, last_name),
          subjects (name)
        `)
        .eq("class_id", classId);

      if (error) {
        console.error("Class performance error:", error);
        return;
      }
      if (!cancelled) setPerformance(data);
    };

    fetchPerformance();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  return performance;
}
