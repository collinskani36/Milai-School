import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { supabase } from "../lib/supabaseClient";
import { Bell, FileText, Download, Calendar } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  file_url: string | null;
  submitted: boolean;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  priority: string;
  expires_at: string | null;
  is_for_all_classes: boolean;
}

interface AssignmentAnnouncementProps {
  classId: string | null;
  isOpen?: boolean;
  isMobileTab?: boolean;
  onClose?: () => void;
}

type ImportMetaEnv = Record<string, unknown> & { env?: Record<string, string> };
const _meta = import.meta as unknown as ImportMetaEnv;

const ALLOWED_STORAGE_ORIGIN =
  _meta.env?.VITE_SUPABASE_STORAGE_ORIGIN ??
  (_meta.env?.VITE_SUPABASE_URL
    ? new URL(_meta.env.VITE_SUPABASE_URL).origin
    : "");

function isTrustedStorageUrl(url: string): boolean {
  if (!ALLOWED_STORAGE_ORIGIN) return true;
  try {
    return new URL(url).origin === ALLOWED_STORAGE_ORIGIN;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, filename?: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename || url.split("/").pop() || "download";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export default function AssignmentAnnouncement({
  classId,
  isOpen: _isOpen,
  isMobileTab: _isMobileTab,
  onClose: _onClose,
}: AssignmentAnnouncementProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const oneWeekAgo = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);

  const fetchAssignments = useCallback(
    async (signal: AbortSignal) => {
      if (!classId) return;

      setAssignmentsLoading(true);
      setAssignmentsError(null);

      try {
        const { data, error } = await supabase
          .from("assignments")
          .select("*")
          .eq("class_id", classId)
          .order("created_at", { ascending: false });

        if (signal.aborted) return;

        if (error) {
          console.error("Error fetching assignments:", error);
          setAssignmentsError("Failed to load assignments. Please try again.");
          setAssignments([]);
        } else {
          setAssignments(data || []);
        }
      } catch (err) {
        if (signal.aborted) return;
        console.error("Unexpected error fetching assignments:", err);
        setAssignmentsError("An unexpected error occurred.");
      } finally {
        if (!signal.aborted) setAssignmentsLoading(false);
      }
    },
    [classId]
  );

  const fetchAnnouncements = useCallback(
    async (signal: AbortSignal) => {
      if (!classId) return;

      setAnnouncementsLoading(true);
      setAnnouncementsError(null);

      try {
        const { data, error } = await supabase
          .from("announcements")
          .select(
            "id, title, content, class_id, created_at, priority, expires_at, is_for_all_classes"
          )
          .or(`class_id.eq.${classId},is_for_all_classes.eq.true`)
          .order("created_at", { ascending: false });

        if (signal.aborted) return;

        if (error) {
          console.error("Error fetching announcements:", error.message);
          setAnnouncementsError("Failed to load announcements. Please try again.");
          setAnnouncements([]);
        } else {
          setAnnouncements(data || []);
        }
      } catch (err) {
        if (signal.aborted) return;
        console.error("Unexpected error fetching announcements:", err);
        setAnnouncementsError("An unexpected error occurred.");
      } finally {
        if (!signal.aborted) setAnnouncementsLoading(false);
      }
    },
    [classId]
  );

  useEffect(() => {
    channelsRef.current.forEach((ch) => ch.unsubscribe());
    channelsRef.current = [];

    if (!classId) return;

    const controller = new AbortController();
    const { signal } = controller;

    fetchAssignments(signal);
    fetchAnnouncements(signal);

    const assignmentsCh = supabase
      .channel(`assignments-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "assignments",
          filter: `class_id=eq.${classId}`,
        },
        () => fetchAssignments(signal)
      )
      .subscribe();

    const announcementsCh = supabase
      .channel(`announcements-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
          filter: `class_id=eq.${classId}`,
        },
        () => fetchAnnouncements(signal)
      )
      .subscribe();

    channelsRef.current = [assignmentsCh, announcementsCh];

    return () => {
      controller.abort();
      channelsRef.current.forEach((ch) => ch.unsubscribe());
      channelsRef.current = [];
    };
  }, [classId, fetchAssignments, fetchAnnouncements]);

  const visibleAnnouncements = useMemo(
    () =>
      announcements.filter(
        (a) => !a.expires_at || new Date(a.expires_at) >= new Date()
      ),
    [announcements]
  );

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "low":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const isAssignmentDueSoon = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 3 && daysUntilDue > 0;
  };

  const isAssignmentOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <section
      className="rounded-2xl border border-maroon/10 bg-white overflow-hidden"
      style={{ boxShadow: "0 6px 26px -18px rgba(122,31,43,0.22)" }}
    >
      {/* ===== Premium gradient header ===== */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)" }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
        />
        <div className="relative px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.12] backdrop-blur-sm sm:h-11 sm:w-11">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Assignments &amp; Announcements
              </h2>
              <p className="text-[11px] text-white/55 sm:text-xs">
                Your class updates and assignment status in one place
              </p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
              <Bell className="h-3 w-3 opacity-75" />
              {visibleAnnouncements.length} announcement{visibleAnnouncements.length !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
              <FileText className="h-3 w-3 opacity-75" />
              {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ===== Content ===== */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* ===== Announcements ===== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-maroon/10 pb-2.5">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-maroon sm:text-base">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon/10">
                  <Bell className="h-3.5 w-3.5 text-maroon" />
                </span>
                Announcements
              </h3>
              <span className="rounded-full bg-maroon/[0.06] px-2.5 py-0.5 text-[10.5px] font-semibold text-maroon">
                {visibleAnnouncements.length}
              </span>
            </div>

            {announcementsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-maroon/[0.08] bg-white p-4">
                    <div className="h-3.5 w-2/3 rounded bg-maroon/[0.07]" />
                    <div className="mt-2.5 h-3 w-full rounded bg-maroon/[0.05]" />
                    <div className="mt-1.5 h-3 w-4/5 rounded bg-maroon/[0.05]" />
                  </div>
                ))}
              </div>
            ) : announcementsError ? (
              <Card className="rounded-2xl border border-red-200 shadow-none">
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
                    <Bell className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-sm text-red-600">{announcementsError}</p>
                </CardContent>
              </Card>
            ) : visibleAnnouncements.length === 0 ? (
              <Card className="rounded-2xl border border-maroon/10 shadow-none">
                <CardContent className="flex flex-col items-center gap-2 py-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon/[0.04]">
                    <Bell className="h-5 w-5 text-maroon/40" />
                  </div>
                  <p className="text-sm text-gray-500">No announcements yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {visibleAnnouncements.map((announcement) => {
                  const isNew = new Date(announcement.created_at) > oneWeekAgo;

                  return (
                    <div
                      key={announcement.id}
                      className="rounded-2xl border border-maroon/[0.09] bg-white p-4 transition-all duration-200 hover:border-maroon/25 hover:shadow-[0_8px_24px_-14px_rgba(122,31,43,0.28)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold tracking-tight text-gray-900 sm:text-[15px]">
                          {announcement.title}
                        </h4>
                        <div className="flex shrink-0 gap-1.5">
                          {isNew && (
                            <Badge className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                              New
                            </Badge>
                          )}
                          <Badge
                            className={`${getPriorityColor(announcement.priority)} text-[10px] font-semibold capitalize`}
                          >
                            {announcement.priority || "Normal"}
                          </Badge>
                        </div>
                      </div>

                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(announcement.created_at).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {announcement.expires_at && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="font-medium text-amber-600">
                              Expires {new Date(announcement.expires_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </p>

                      <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
                        {announcement.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== Assignments ===== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-maroon/10 pb-2.5">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-maroon sm:text-base">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon/10">
                  <FileText className="h-3.5 w-3.5 text-maroon" />
                </span>
                Assignments
              </h3>
              <span className="rounded-full bg-maroon/[0.06] px-2.5 py-0.5 text-[10.5px] font-semibold text-maroon">
                {assignments.length}
              </span>
            </div>

            {assignmentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-maroon/[0.08] bg-white p-4">
                    <div className="h-3.5 w-3/4 rounded bg-maroon/[0.07]" />
                    <div className="mt-2.5 h-3 w-1/2 rounded bg-maroon/[0.05]" />
                  </div>
                ))}
              </div>
            ) : assignmentsError ? (
              <Card className="rounded-2xl border border-red-200 shadow-none">
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
                    <FileText className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-sm text-red-600">{assignmentsError}</p>
                </CardContent>
              </Card>
            ) : assignments.length === 0 ? (
              <Card className="rounded-2xl border border-maroon/10 shadow-none">
                <CardContent className="flex flex-col items-center gap-2 py-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon/[0.04]">
                    <FileText className="h-5 w-5 text-maroon/40" />
                  </div>
                  <p className="text-sm text-gray-500">No assignments yet</p>
                  <p className="text-xs text-gray-400">
                    Assignments will appear here when your teacher uploads them
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {assignments.map((assignment) => {
                  const isNew = new Date(assignment.created_at) > oneWeekAgo;
                  const isDueSoon = isAssignmentDueSoon(assignment.due_date);
                  const isOverdue = isAssignmentOverdue(assignment.due_date);

                  const accent = isOverdue
                    ? "border-l-red-400"
                    : isDueSoon
                      ? "border-l-amber-400"
                      : "border-l-maroon/40";

                  return (
                    <div
                      key={assignment.id}
                      className={`rounded-2xl border border-maroon/[0.09] border-l-4 ${accent} bg-white p-4 transition-all duration-200 hover:border-maroon/25 hover:shadow-[0_8px_24px_-14px_rgba(122,31,43,0.28)]`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold tracking-tight text-gray-900 sm:text-[15px]">
                          {assignment.title}
                        </h4>
                        <div className="flex shrink-0 gap-1.5">
                          {isNew && (
                            <Badge className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                              New
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge className="border-red-200 bg-red-50 text-[10px] font-semibold text-red-700">
                              Overdue
                            </Badge>
                          )}
                          {isDueSoon && !isOverdue && (
                            <Badge className="border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-700">
                              Due Soon
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {assignment.due_date ? (
                          <span
                            className={
                              isOverdue
                                ? "font-medium text-red-600"
                                : isDueSoon
                                  ? "font-medium text-amber-600"
                                  : ""
                            }
                          >
                            Due{" "}
                            {new Date(assignment.due_date).toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : (
                          <span>No due date</span>
                        )}
                        <span className="text-gray-300">·</span>
                        <span>
                          Posted {new Date(assignment.created_at).toLocaleDateString()}
                        </span>
                      </p>

                      <div className="mt-3 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={
                            assignment.submitted
                              ? "border-emerald-200 bg-emerald-50 text-[10.5px] font-semibold text-emerald-700"
                              : "border-gray-200 bg-gray-50 text-[10.5px] font-semibold text-gray-600"
                          }
                        >
                          {assignment.submitted ? "Submitted" : "Not Submitted"}
                        </Badge>

                        {assignment.file_url && isTrustedStorageUrl(assignment.file_url) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex h-7 items-center gap-1.5 rounded-lg border-maroon/20 px-2.5 text-[11px] font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white"
                            onClick={() => downloadFile(assignment.file_url!, assignment.title)}
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== Footer summary ===== */}
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-maroon/10 pt-4 text-[11.5px] text-gray-400">
          <span className="font-medium text-gray-500">
            {visibleAnnouncements.length} announcement
            {visibleAnnouncements.length !== 1 ? "s" : ""}
          </span>
          <span className="text-gray-300">•</span>
          <span className="font-medium text-gray-500">
            {assignments.length} assignment
            {assignments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </section>
  );
}