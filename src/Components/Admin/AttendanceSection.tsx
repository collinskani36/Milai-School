import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Calendar, RefreshCcw, Eye, ChevronDown, ChevronUp, AlertTriangle, BookOpen, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Label } from "@/Components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { Badge } from "@/Components/ui/badge";
import { format, startOfWeek, endOfWeek, parseISO, isWithinInterval, isBefore, isAfter } from "date-fns";

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
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function weeksBetween(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) /
      (1000 * 60 * 60 * 24 * 7)
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

  // ── Fetch active academic term ────────────────────────────────────────────
  const { data: activeTerm = null } = useQuery<AcademicTerm | null>({
    queryKey: ["active-term"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_calendar")
        .select("*")
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
      const { data, error } = await supabase.from("classes").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch students ────────────────────────────────────────────────────────
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch enrollments ─────────────────────────────────────────────────────
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ── Compute students in selected class ────────────────────────────────────
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const enrolledIds = enrollments
      .filter((e: any) => e.class_id === selectedClassId)
      .map((e: any) => e.student_id);
    return students.filter((s: any) => enrolledIds.includes(s.id));
  }, [selectedClassId, students, enrollments]);

  // ── Initialize attendance defaults ────────────────────────────────────────
  useEffect(() => {
    if (classStudents.length > 0) {
      const defaults = classStudents.reduce((acc: any, s: any) => {
        acc[s.id] = {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
        };
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
      [studentId]: {
        ...prev[studentId],
        [day]: !prev[studentId][day],
      },
    }));
  };

  // ── Load existing attendance for selected week ────────────────────────────
  const handleLoadWeek = async () => {
    if (!selectedClassId) return;
    setIsLoadingWeek(true);

    const weekStart = format(
      startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );
    const weekEnd = format(
      endOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("class_id", selectedClassId)
      .gte("week_start", weekStart)
      .lte("week_end", weekEnd);

    if (error) {
      console.error("Error loading attendance:", error);
      alert("Failed to load week attendance.");
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
      alert("Attendance loaded for this week!");
    } else {
      alert("No attendance data found for this week — starting fresh.");
    }

    setIsLoadingWeek(false);
  };

  // ── Fetch filled weeks for the selected class ─────────────────────────────
  const handleViewFilledWeeks = async () => {
    if (!selectedClassId) {
      alert("Please select a class first.");
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
        alert("Failed to load filled weeks.");
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
    setTimeout(() => {
      handleLoadWeek();
    }, 100);
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
        .upsert(records, {
          onConflict: "student_id,week_start,week_end,class_id",
        });

      if (error) {
        console.error("Error saving attendance:", error);
        alert("Failed to save attendance. " + error.message);
      } else {
        alert("Attendance saved successfully!");
        if (showFilledWeeks) {
          handleViewFilledWeeks();
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred while saving attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Academic Term Context Banner ──────────────────────────────────── */}
      {activeTerm ? (
        <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
              </span>
              <BookOpen className="h-4 w-4 text-teal-600" />
              <div>
                <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">
                  Active Academic Term
                </p>
                <p className="font-bold text-gray-900">
                  Term {activeTerm.term} — {activeTerm.academic_year}
                </p>
              </div>
              <div className="h-4 w-px bg-teal-200" />
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="h-3.5 w-3.5 text-teal-500" />
                {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}
              </div>
              <Badge className="ml-auto bg-teal-100 text-teal-800 border-teal-200">
                {weeksBetween(activeTerm.start_date, activeTerm.end_date)} weeks
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">No Active Term</p>
              <p className="text-xs text-amber-700">
                No academic term is currently active. Go to <strong>Settings → Academic Calendar</strong> to configure and activate a term.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Attendance Card ──────────────────────────────────────────── */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-600" />
            Weekly Attendance
          </CardTitle>
          <p className="text-sm text-gray-500">
            Select a class and mark attendance for each day of the week.
          </p>
        </CardHeader>

        <CardContent>
          {/* Class & Week Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Week Start
                {activeTerm && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
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
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleLoadWeek}
                disabled={isLoadingWeek || !selectedClassId}
              >
                <RefreshCcw className="w-4 h-4" />
                {isLoadingWeek ? "Loading..." : "Load Week"}
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleViewFilledWeeks}
                disabled={isLoadingFilledWeeks || !selectedClassId}
              >
                <Eye className="w-4 h-4" />
                {isLoadingFilledWeeks ? "Loading..." : "View Filled Weeks"}
                {showFilledWeeks ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* ── Week Outside Term Warning ───────────────────────────────── */}
          {weekStatus.status !== "inside" && weekStatus.message && (
            <div
              className={`flex items-start gap-3 px-4 py-3 rounded-lg mb-4 text-sm border ${
                weekStatus.status === "no-term"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-orange-50 border-orange-200 text-orange-800"
              }`}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{weekStatus.message}</p>
            </div>
          )}

          {/* ── Filled Weeks Section ────────────────────────────────────── */}
          {showFilledWeeks && (
            <Card className="mb-6 border-l-4 border-l-teal-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-teal-600" />
                  Filled Weeks for{" "}
                  {classes.find((c: any) => c.id === selectedClassId)?.name}
                  {activeTerm && (
                    <Badge variant="outline" className="ml-2 text-xs font-normal">
                      Term {activeTerm.term} · {activeTerm.academic_year}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filledWeeks.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No attendance records found for this class.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filledWeeks.map((week: any, index: number) => {
                      // Tag whether this filled week is within the active term
                      const ws = getWeekStatus(week.week_start, activeTerm);
                      return (
                        <div
                          key={`${week.week_start}-${week.week_end}`}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleLoadSpecificWeek(week.week_start)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                Week {filledWeeks.length - index}
                              </p>
                              {ws.status === "outside" && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">
                                  Outside term
                                </Badge>
                              )}
                              {ws.status === "inside" && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-200">
                                  In term
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {format(parseISO(week.week_start), "MMM dd, yyyy")} -{" "}
                              {format(parseISO(week.week_end), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              Created:{" "}
                              {format(parseISO(week.created_at), "MMM dd, yyyy")}
                            </p>
                            <Button variant="ghost" size="sm" className="mt-1">
                              Load
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Students Attendance Table ───────────────────────────────── */}
          {selectedClassId && (
            <>
              {classStudents.length === 0 ? (
                <p className="text-gray-500 text-center py-6">
                  No students in this class.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2">Student</th>
                        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                          <th key={day} className="p-2 text-center">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((student: any) => (
                        <tr key={student.id} className="border-t">
                          <td className="p-2 font-medium">
                            {student.first_name} {student.last_name}
                          </td>
                          {[
                            "monday",
                            "tuesday",
                            "wednesday",
                            "thursday",
                            "friday",
                          ].map((day) => (
                            <td key={day} className="text-center p-2">
                              <input
                                type="checkbox"
                                checked={
                                  studentAttendance[student.id]?.[day] ?? true
                                }
                                onChange={() =>
                                  handleCheckboxChange(student.id, day)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── Save Button ─────────────────────────────────────────────── */}
          {selectedClassId && classStudents.length > 0 && (
            <div className="pt-6 text-right">
              <Button
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isSubmitting ? "Saving..." : "Save Weekly Attendance"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}