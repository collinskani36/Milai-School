// src/Components/Admin/AttendanceSection.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import {
  Calendar, RefreshCcw, Eye, ChevronDown, ChevronUp, AlertTriangle,
  BookOpen, Clock, Users, Loader2, Check, X, CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/Components/ui/card";
import { Label } from "@/Components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/Components/ui/select";
import { Badge } from "@/Components/ui/badge";
import { useToast } from "@/Components/ui/use-toast";
import { format, startOfWeek, endOfWeek, parseISO, isBefore, isAfter, differenceInCalendarWeeks } from "date-fns";

// ─── Design tokens (mirrors every other Admin section) ───────────────────────
const MAROON = "#7a1f2b";
const MAROON_GRADIENT = "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";
const CARD_SHADOW_HOVER = "0 10px 40px -18px rgba(122,31,43,0.35)";
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: "0 8px 18px -10px rgba(122,31,43,0.5)",
};
const TABLE_HEAD_STYLE: React.CSSProperties = { background: MAROON_GRADIENT };

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcademicTerm {
  id: string;
  academic_year: string;
  term: number;
  term_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: "upcoming" | "active" | "closed";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function weeksBetween(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );
}

function getWeekStatus(
  weekDateStr: string,
  activeTerm: AcademicTerm | null
): { status: "inside" | "outside" | "no-term"; message: string } {
  if (!activeTerm) {
    return {
      status: "no-term",
      message: "No active term found. Please configure an academic term in Settings.",
    };
  }

  const weekStart = startOfWeek(new Date(weekDateStr), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(weekDateStr), { weekStartsOn: 1 });
  const termStart = parseISO(activeTerm.start_date);
  const termEnd = parseISO(activeTerm.end_date);

  const weekStartInTerm =
    !isBefore(weekStart, termStart) && !isAfter(weekStart, termEnd);
  const weekEndInTerm =
    !isBefore(weekEnd, termStart) && !isAfter(weekEnd, termEnd);

  if (weekStartInTerm && weekEndInTerm) {
    return { status: "inside", message: "" };
  }

  return {
    status: "outside",
    message: `Selected week is outside Term ${activeTerm.term} (${fmtDate(
      activeTerm.start_date
    )} – ${fmtDate(activeTerm.end_date)}). Attendance can still be saved.`,
  };
}

function getTermWeekNumber(weekDateStr: string, activeTerm: AcademicTerm | null): number | null {
  if (!activeTerm) return null;
  const weekStart = startOfWeek(new Date(weekDateStr), { weekStartsOn: 1 });
  const termStart = startOfWeek(parseISO(activeTerm.start_date), { weekStartsOn: 1 });
  const termEnd = parseISO(activeTerm.end_date);
  if (isBefore(weekStart, termStart) || isAfter(weekStart, termEnd)) return null;
  return differenceInCalendarWeeks(weekStart, termStart, { weekStartsOn: 1 }) + 1;
}

// ─── Shared SectionHeader ─────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, microLabel, title, description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; description?: string;
}) {
  return (
    <div className="relative overflow-hidden px-4 sm:px-5 py-3.5" style={{ background: MAROON_GRADIENT }}>
      <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }} />
      <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }} />
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">{microLabel}</p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{title}</h3>
          {description && (
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Custom maroon checkbox ───────────────────────────────────────────────────
function MaroonCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all active:scale-90 mx-auto ${
        checked
          ? "text-white border-transparent"
          : "border-[#7a1f2b]/30 bg-white hover:border-[#7a1f2b]/60"
      }`}
      style={checked ? GRADIENT_BTN_STYLE : undefined}
    >
      {checked ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AttendanceSection() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [studentAttendance, setStudentAttendance] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [showFilledWeeks, setShowFilledWeeks] = useState(false);
  const [filledWeeks, setFilledWeeks] = useState<any[]>([]);
  const [isLoadingFilledWeeks, setIsLoadingFilledWeeks] = useState(false);
  const { toast } = useToast();

  // ── Fetch active academic term ────────────────────────────────────────────
  const { data: activeTerm = null } = useQuery<AcademicTerm | null>({
    queryKey: ["active-term"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_calendar")
        .select("id, academic_year, term, term_name, start_date, end_date, is_current, status")
        .eq("is_current", true)
        .single();
      if (error) return null;
      return data as AcademicTerm;
    },
  });

  // ── Fetch classes ─────────────────────────────────────────────────────────
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name");
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch only the students enrolled in the selected class ────────────────
  const { data: classStudents = [] } = useQuery({
    queryKey: ["class-students", selectedClassId],
    enabled: !!selectedClassId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, students!inner(id, first_name, last_name)")
        .eq("class_id", selectedClassId);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.students);
    },
  });

  // ── Initialize attendance defaults ────────────────────────────────────────
  useEffect(() => {
    if (classStudents.length > 0) {
      const defaults = classStudents.reduce((acc: any, s: any) => {
        acc[s.id] = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true };
        return acc;
      }, {});
      setStudentAttendance(defaults);
    }
  }, [classStudents]);

  // ── Week status relative to active term ───────────────────────────────────
  const weekStatus = useMemo(
    () => getWeekStatus(attendanceDate, activeTerm),
    [attendanceDate, activeTerm]
  );

  // ── Handle checkbox toggle ────────────────────────────────────────────────
  const handleCheckboxChange = (studentId: string, day: string) => {
    setStudentAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [day]: !prev[studentId][day] },
    }));
  };

  // ── Load existing attendance for selected week ────────────────────────────
  const handleLoadWeek = async () => {
    if (!selectedClassId) return;
    setIsLoadingWeek(true);

    const weekStart = format(startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, monday, tuesday, wednesday, thursday, friday")
      .eq("class_id", selectedClassId)
      .gte("week_start", weekStart)
      .lte("week_end", weekEnd);

    if (error) {
      console.error("Error loading attendance:", error);
      toast({
        variant: "destructive",
        title: "Failed to load attendance",
        description: error.message,
      });
    } else if (data.length > 0) {
      const existing = data.reduce((acc: any, record: any) => {
        acc[record.student_id] = {
          monday: record.monday ?? true,
          tuesday: record.tuesday ?? true,
          wednesday: record.wednesday ?? true,
          thursday: record.thursday ?? true,
          friday: record.friday ?? true,
        };
        return acc;
      }, {});
      setStudentAttendance(existing);
      const weekNum = getTermWeekNumber(attendanceDate, activeTerm);
      toast({
        title: weekNum ? `Week ${weekNum} loaded` : "Attendance loaded",
        description: weekNum
          ? `Term ${activeTerm?.term} · ${activeTerm?.academic_year}`
          : `Week of ${format(startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }), "MMM d, yyyy")}`,
      });
    } else {
      toast({
        title: "No data for this week",
        description: "No existing records found — starting fresh.",
      });
    }

    setIsLoadingWeek(false);
  };

  // ── Fetch filled weeks for the selected class ─────────────────────────────
  const handleViewFilledWeeks = async () => {
    if (!selectedClassId) {
      toast({
        variant: "destructive",
        title: "No class selected",
        description: "Please select a class before viewing filled weeks.",
      });
      return;
    }

    setIsLoadingFilledWeeks(true);
    setShowFilledWeeks(!showFilledWeeks);

    if (!showFilledWeeks) {
      const { data, error } = await supabase
        .from("attendance")
        .select("week_start, week_end, created_at")
        .eq("class_id", selectedClassId)
        .order("week_start", { ascending: false });

      if (error) {
        console.error("Error fetching filled weeks:", error);
        toast({
          variant: "destructive",
          title: "Failed to load filled weeks",
          description: error.message,
        });
      } else {
        const uniqueWeeks = data.reduce((acc: any[], record: any) => {
          const weekKey = `${record.week_start}-${record.week_end}`;
          if (!acc.find((w) => `${w.week_start}-${w.week_end}` === weekKey)) {
            acc.push(record);
          }
          return acc;
        }, []);
        setFilledWeeks(uniqueWeeks);
      }
    }

    setIsLoadingFilledWeeks(false);
  };

  // ── Load a specific week from the filled weeks list ───────────────────────
  const handleLoadSpecificWeek = (weekStart: string) => {
    setAttendanceDate(weekStart);
    setTimeout(() => { handleLoadWeek(); }, 100);
  };

  // ── Save attendance ───────────────────────────────────────────────────────
  const handleSubmitAttendance = async () => {
    if (!selectedClassId || classStudents.length === 0) return;

    setIsSubmitting(true);

    try {
      const weekStart = startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(attendanceDate), { weekStartsOn: 1 });

      const records = classStudents.map((student: any) => ({
        id: crypto.randomUUID(),
        student_id: student.id,
        class_id: selectedClassId,
        week_start: format(weekStart, "yyyy-MM-dd"),
        week_end: format(weekEnd, "yyyy-MM-dd"),
        monday: studentAttendance[student.id]?.monday ?? false,
        tuesday: studentAttendance[student.id]?.tuesday ?? false,
        wednesday: studentAttendance[student.id]?.wednesday ?? false,
        thursday: studentAttendance[student.id]?.thursday ?? false,
        friday: studentAttendance[student.id]?.friday ?? false,
        status: studentAttendance[student.id]?.status ?? "present",
        created_at: new Date().toISOString(),
      }));

      console.log("Saving attendance records:", records);

      const { error } = await supabase
        .from("attendance")
        .upsert(records, { onConflict: "student_id,week_start,week_end,class_id" });

      if (error) {
        console.error("Error saving attendance:", error);
        toast({
          variant: "destructive",
          title: "Failed to save attendance",
          description: error.message,
        });
      } else {
        const weekNum = getTermWeekNumber(attendanceDate, activeTerm);
        toast({
          title: weekNum ? `Week ${weekNum} saved successfully ✓` : "Attendance saved successfully ✓",
          description: weekNum
            ? `Term ${activeTerm?.term} · ${activeTerm?.academic_year}`
            : `Week of ${format(startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }), "MMM d, yyyy")}`,
        });
        if (showFilledWeeks) { handleViewFilledWeeks(); }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        variant: "destructive",
        title: "Unexpected error",
        description: "Something went wrong while saving attendance.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      {/* ══════════ ACTIVE TERM BANNER ══════════ */}
      {activeTerm ? (
        <div
          className="relative overflow-hidden rounded-2xl p-4 text-white"
          style={{ background: MAROON_GRADIENT, boxShadow: "0 18px 40px -22px rgba(122,31,43,0.45)" }}
        >
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)" }} />
          <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)" }} />

          <div className="relative flex items-center gap-3 flex-wrap">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
            <BookOpen className="h-4 w-4 text-white/80 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                Active Academic Term
              </p>
              <p className="text-white font-bold text-sm sm:text-base leading-tight">
                Term {activeTerm.term} — {activeTerm.academic_year}
              </p>
            </div>
            <div className="h-5 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-xs text-white/80">
              <Clock className="h-3.5 w-3.5" />
              {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}
            </div>
            <span className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white/90 shrink-0">
              {weeksBetween(activeTerm.start_date, activeTerm.end_date)} weeks
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 flex items-start gap-3 border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">No Active Term</p>
            <p className="text-xs text-amber-700 mt-0.5">
              No academic term is currently active. Go to <strong>Settings → Academic Calendar</strong> to configure and activate a term.
            </p>
          </div>
        </div>
      )}

      {/* ══════════ MAIN CARD ══════════ */}
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={Calendar}
          microLabel="Schedule"
          title="Weekly Attendance"
          description="Select a class and mark attendance for each day of the week"
        />

        <CardContent className="p-3 sm:p-5">

          {/* ══════════ Selector bar ══════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 sm:p-4 rounded-2xl border border-[#7a1f2b]/10 bg-[#fdfbfb] mb-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">
                Select Class
              </Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15 bg-white">
                  <SelectValue placeholder="Choose a class…" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">
                Week Start
                {activeTerm && (
                  <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                    (Term {activeTerm.term}: {fmtDate(activeTerm.start_date)} – {fmtDate(activeTerm.end_date)})
                  </span>
                )}
              </Label>
              <Input
                type="date"
                value={attendanceDate}
                min={activeTerm?.start_date}
                max={activeTerm?.end_date}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Actions</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handleLoadWeek}
                  disabled={isLoadingWeek || !selectedClassId}
                  className="flex-1 min-w-[110px] h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98] text-xs gap-1.5"
                >
                  {isLoadingWeek
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
                    : <><RefreshCcw className="w-3.5 h-3.5" /> Load Week</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleViewFilledWeeks}
                  disabled={isLoadingFilledWeeks || !selectedClassId}
                  className="flex-1 min-w-[130px] h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98] text-xs gap-1.5"
                >
                  {isLoadingFilledWeeks
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
                    : <><Eye className="w-3.5 h-3.5" /> Filled Weeks</>}
                  {showFilledWeeks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* ══════════ Week Status Warning ══════════ */}
          {weekStatus.status !== "inside" && weekStatus.message && (
            <div
              className={`flex items-start gap-3 rounded-xl p-3.5 mb-4 text-sm border ${
                weekStatus.status === "no-term"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-orange-50 border-orange-200 text-orange-800"
              }`}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="leading-relaxed">{weekStatus.message}</p>
            </div>
          )}

          {/* ══════════ Filled Weeks Panel ══════════ */}
          {showFilledWeeks && (
            <div className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden mb-4" style={{ boxShadow: CARD_SHADOW }}>
              <div className="relative overflow-hidden px-4 py-3 border-b border-[#7a1f2b]/10"
                style={{ background: "rgba(122,31,43,0.04)" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Eye className="w-4 h-4 text-[#7a1f2b]" />
                  <h4 className="font-semibold text-sm text-[#3a1b1f]">
                    Filled Weeks for {classes.find((c: any) => c.id === selectedClassId)?.name ?? "…"}
                  </h4>
                  {activeTerm && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15 ml-1">
                      Term {activeTerm.term} · {activeTerm.academic_year}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                {filledWeeks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No attendance records found for this class.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {filledWeeks.map((week: any, index: number) => {
                      const ws = getWeekStatus(week.week_start, activeTerm);
                      return (
                        <button
                          key={`${week.week_start}-${week.week_end}`}
                          className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-[#7a1f2b]/10 hover:border-[#7a1f2b]/30 hover:bg-[#7a1f2b]/[0.03] active:scale-[0.99] transition-all"
                          onClick={() => handleLoadSpecificWeek(week.week_start)}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-[#3a1b1f]">
                                Week {filledWeeks.length - index}
                              </p>
                              {ws.status === "outside" && (
                                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Outside term
                                </span>
                              )}
                              {ws.status === "inside" && (
                                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  In term
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {format(parseISO(week.week_start), "MMM dd, yyyy")} →{" "}
                              {format(parseISO(week.week_end), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-[10px] text-muted-foreground">
                              Created {format(parseISO(week.created_at), "MMM dd, yyyy")}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7a1f2b] mt-1">
                              Load <ChevronUp className="w-3 h-3 rotate-90" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ Students Attendance Table ══════════ */}
          {selectedClassId && (
            <>
              {classStudents.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: "rgba(122,31,43,0.06)" }}>
                    <Users className="w-6 h-6 text-[#7a1f2b]/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">No students in this class.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#7a1f2b]/10 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse">
                      <thead>
                        <tr style={TABLE_HEAD_STYLE} className="text-white">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider rounded-tl-xl">
                            Student
                          </th>
                          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, i) => (
                            <th
                              key={day}
                              className={`text-center px-2 py-3 text-[11px] font-semibold uppercase tracking-wider w-16 ${
                                i === 4 ? "rounded-tr-xl" : ""
                              }`}
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student: any, idx: number) => (
                          <tr
                            key={student.id}
                            className={`border-b border-[#7a1f2b]/5 transition-colors ${
                              idx % 2 === 0 ? "bg-white" : "bg-[#fdfbfb]"
                            } hover:bg-[#7a1f2b]/[0.03]`}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                  style={GRADIENT_BTN_STYLE}
                                >
                                  {(student.first_name?.[0] ?? "") + (student.last_name?.[0] ?? "")}
                                </div>
                                <span className="font-medium text-sm text-[#3a1b1f] truncate">
                                  {student.first_name} {student.last_name}
                                </span>
                              </div>
                            </td>
                            {["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => (
                              <td key={day} className="text-center py-2">
                                <MaroonCheckbox
                                  checked={studentAttendance[student.id]?.[day] ?? true}
                                  onChange={() => handleCheckboxChange(student.id, day)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════ Save ══════════ */}
          {selectedClassId && classStudents.length > 0 && (
            <div className="pt-4 flex justify-end">
              <Button
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98] min-w-[200px]"
                style={GRADIENT_BTN_STYLE}
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                  : <><Check className="w-4 h-4 mr-2" />Save Weekly Attendance</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}