import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Calendar, RefreshCcw, Eye, ChevronDown, ChevronUp } from "lucide-react";
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
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";

export default function AttendanceSection() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [studentAttendance, setStudentAttendance] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [showFilledWeeks, setShowFilledWeeks] = useState(false);
  const [filledWeeks, setFilledWeeks] = useState([]);
  const [isLoadingFilledWeeks, setIsLoadingFilledWeeks] = useState(false);

  // ✅ Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ✅ Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ✅ Fetch enrollments
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ✅ Compute students in selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const enrolledIds = enrollments
      .filter((e) => e.class_id === selectedClassId)
      .map((e) => e.student_id);
    return students.filter((s) => enrolledIds.includes(s.id));
  }, [selectedClassId, students, enrollments]);

  // ✅ Initialize attendance with all days = true
  useEffect(() => {
    if (classStudents.length > 0) {
      const defaults = classStudents.reduce((acc, s) => {
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

  // ✅ Handle checkbox toggle
  const handleCheckboxChange = (studentId, day) => {
    setStudentAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [day]: !prev[studentId][day],
      },
    }));
  };

  // ✅ Load existing attendance for selected week
  const handleLoadWeek = async () => {
    if (!selectedClassId) return;
    setIsLoadingWeek(true);

    const weekStart = format(startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(new Date(attendanceDate), { weekStartsOn: 1 }), "yyyy-MM-dd");

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
      const existing = data.reduce((acc, record) => {
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

  // ✅ Fetch filled weeks for the selected class
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
        // Get unique weeks
        const uniqueWeeks = data.reduce((acc, record) => {
          const weekKey = `${record.week_start}-${record.week_end}`;
          if (!acc.find(w => `${w.week_start}-${w.week_end}` === weekKey)) {
            acc.push(record);
          }
          return acc;
        }, []);
        
        setFilledWeeks(uniqueWeeks);
      }
    }

    setIsLoadingFilledWeeks(false);
  };

  // ✅ Load a specific week when clicked from the filled weeks list
  const handleLoadSpecificWeek = (weekStart) => {
    setAttendanceDate(weekStart);
    // Wait a moment for state to update, then load the week
    setTimeout(() => {
      handleLoadWeek();
    }, 100);
  };

  // ✅ Save attendance (insert or update existing)
  const handleSubmitAttendance = async () => {
  if (!selectedClassId || classStudents.length === 0) return;

  setIsSubmitting(true);

  try {
    const weekStart = startOfWeek(new Date(attendanceDate), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(attendanceDate), { weekStartsOn: 1 });

    const records = classStudents.map((student) => ({
      id: crypto.randomUUID(), // add this if `id` is NOT auto-generated
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
      alert("Failed to save attendance. " + error.message);
    } else {
      alert("Attendance saved successfully!");
      // Refresh filled weeks list if it's open
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


  return (
    <div className="space-y-6">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Week Start</Label>
              <Input
                type="date"
                value={attendanceDate}
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
                {showFilledWeeks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Filled Weeks Section */}
          {showFilledWeeks && (
            <Card className="mb-6 border-l-4 border-l-teal-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-teal-600" />
                  Filled Weeks for {classes.find(c => c.id === selectedClassId)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filledWeeks.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No attendance records found for this class.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filledWeeks.map((week, index) => (
                      <div
                        key={`${week.week_start}-${week.week_end}`}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleLoadSpecificWeek(week.week_start)}
                      >
                        <div>
                          <p className="font-medium">
                            Week {filledWeeks.length - index}
                          </p>
                          <p className="text-sm text-gray-600">
                            {format(parseISO(week.week_start), "MMM dd, yyyy")} - {format(parseISO(week.week_end), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            Created: {format(parseISO(week.created_at), "MMM dd, yyyy")}
                          </p>
                          <Button variant="ghost" size="sm" className="mt-1">
                            Load
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Students List */}
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
                          <th key={day} className="p-2 text-center">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((student) => (
                        <tr key={student.id} className="border-t">
                          <td className="p-2 font-medium">
                            {student.first_name} {student.last_name}
                          </td>
                          {["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => (
                            <td key={day} className="text-center p-2">
                              <input
                                type="checkbox"
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
              )}
            </>
          )}

          {/* Save Button */}
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