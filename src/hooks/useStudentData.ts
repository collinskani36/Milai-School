// src/hooks/useStudentData.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ✅ Profile hook
export function useStudentProfile(studentId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!studentId) return;
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .single();

      if (error) setError(error);
      else setData(data);
      setLoading(false);
    };
    fetchData();
  }, [studentId]);

  return { data, loading, error };
}

// ✅ Assessments hook
export function useStudentAssessments(studentId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!studentId) return;
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("student_id", studentId);

      if (error) setError(error);
      else setData(data || []);
      setLoading(false);
    };
    fetchData();
  }, [studentId]);

  return { data, loading, error };
}

// ✅ Assignments hook
export function useStudentAssignments(studentId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!studentId) return;
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("student_id", studentId);

      if (error) setError(error);
      else setData(data || []);
      setLoading(false);
    };
    fetchData();
  }, [studentId]);

  return { data, loading, error };
}

// ✅ Announcements hook
export function useStudentAnnouncements() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) setError(error);
      else setData(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  return { data, loading, error };
}

// ✅ Attendance hook
export function useStudentAttendance(studentId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!studentId) return;
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId);

      if (error) setError(error);
      else setData(data || []);
      setLoading(false);
    };
    fetchData();
  }, [studentId]);

  return { data, loading, error };
}
