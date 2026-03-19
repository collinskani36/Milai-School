// assignment_announcement.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/Components/ui/dialog";
import { supabase } from "../lib/supabaseClient";
import { Bell, FileText, Download, Calendar } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Allowed storage origin for file downloads (set via env var)
// Falls back to the Supabase project URL so nothing breaks if not configured.
// ---------------------------------------------------------------------------
const ALLOWED_STORAGE_ORIGIN =
  (import.meta as Record<string, unknown> & { env?: Record<string, string> })
    .env?.VITE_SUPABASE_STORAGE_ORIGIN ??
  ((import.meta as Record<string, unknown> & { env?: Record<string, string> })
    .env?.VITE_SUPABASE_URL
    ? new URL(
        (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env!
          .VITE_SUPABASE_URL
      ).origin
    : "");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true only when `url` originates from our trusted storage host.
 * Prevents open-redirect / stored-XSS via database-supplied URLs.
 */
function isTrustedStorageUrl(url: string): boolean {
  if (!ALLOWED_STORAGE_ORIGIN) return true; // env not configured — allow (dev mode)
  try {
    return new URL(url).origin === ALLOWED_STORAGE_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Triggers a browser download for a given URL by fetching the blob and
 * creating a temporary <a> element.  Falls back to window.open if the
 * fetch fails (e.g. CORS-restricted bucket).
 */
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
    // Graceful fallback — opens in tab if blob-download is blocked
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssignmentAnnouncement({
  classId,
  isOpen,
  onClose,
}: AssignmentAnnouncementProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  // Keep refs to active channels so we can always unsubscribe them,
  // even if classId changes while the dialog is still open.
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  // ---------------------------------------------------------------------------
  // Stable date boundary — avoids recomputing inside every render / map call
  // ---------------------------------------------------------------------------
  const oneWeekAgo = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    // Recompute once per open so "New" badges reflect the current session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen]
  );

  // ---------------------------------------------------------------------------
  // Fetch helpers — accept an AbortSignal so stale responses are discarded
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Effect: fetch + realtime subscriptions
  // Runs whenever isOpen or classId changes.
  // Always tears down previous channels before setting up new ones.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Tear down any existing channels (handles classId changes mid-open)
    channelsRef.current.forEach((ch) => ch.unsubscribe());
    channelsRef.current = [];

    if (!isOpen || !classId) return;

    // AbortController to cancel in-flight fetches on cleanup
    const controller = new AbortController();
    const { signal } = controller;

    fetchAssignments(signal);
    fetchAnnouncements(signal);

    // Unique channel names per class prevent slot collisions when multiple
    // class dialogs are open simultaneously or the component remounts rapidly.
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
  }, [isOpen, classId, fetchAssignments, fetchAnnouncements]);

  // ---------------------------------------------------------------------------
  // Derived data — filter expired announcements before rendering
  // ---------------------------------------------------------------------------

  const visibleAnnouncements = useMemo(
    () =>
      announcements.filter(
        (a) => !a.expires_at || new Date(a.expires_at) >= new Date()
      ),
    [announcements]
  );

  // ---------------------------------------------------------------------------
  // Pure helpers
  // ---------------------------------------------------------------------------

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl lg:text-2xl text-maroon">
            <Bell className="h-5 w-5 lg:h-6 lg:w-6 mr-2 lg:mr-3" />
            Assignments &amp; Announcements
          </DialogTitle>
          <DialogDescription>
            View your class assignments and important announcements
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ---------------------------------------------------------------- */}
          {/* Announcements Section                                            */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Bell className="h-5 w-5 mr-2 text-maroon" />
              Announcements ({visibleAnnouncements.length})
            </h3>

            {announcementsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto mb-4" />
                <p className="text-gray-600">Loading announcements...</p>
              </div>
            ) : announcementsError ? (
              <Card className="text-center py-8 border-red-200">
                <CardContent>
                  <Bell className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600 text-sm">{announcementsError}</p>
                </CardContent>
              </Card>
            ) : visibleAnnouncements.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No announcements yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {visibleAnnouncements.map((announcement) => {
                  const isNew =
                    new Date(announcement.created_at) > oneWeekAgo;

                  return (
                    <Card
                      key={announcement.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">
                            {announcement.title}
                          </CardTitle>
                          <div className="flex gap-2">
                            {isNew && (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                New
                              </Badge>
                            )}
                            <Badge
                              className={
                                getPriorityColor(announcement.priority) +
                                " text-xs"
                              }
                            >
                              {announcement.priority || "Normal"}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription className="text-xs">
                          {new Date(announcement.created_at).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                          {announcement.expires_at && (
                            <span className="text-amber-600 ml-2">
                              • Expires:{" "}
                              {new Date(
                                announcement.expires_at
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          {announcement.content}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Assignments Section                                              */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <FileText className="h-5 w-5 mr-2 text-maroon" />
              Assignments ({assignments.length})
            </h3>

            {assignmentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto mb-4" />
                <p className="text-gray-600">Loading assignments...</p>
              </div>
            ) : assignmentsError ? (
              <Card className="text-center py-8 border-red-200">
                <CardContent>
                  <FileText className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600 text-sm">{assignmentsError}</p>
                </CardContent>
              </Card>
            ) : assignments.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No assignments yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Assignments will appear here when your teacher uploads them
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {assignments.map((assignment) => {
                  const isNew =
                    new Date(assignment.created_at) > oneWeekAgo;
                  const isDueSoon = isAssignmentDueSoon(assignment.due_date);
                  const isOverdue = isAssignmentOverdue(assignment.due_date);

                  return (
                    <Card
                      key={assignment.id}
                      className={`hover:shadow-md transition-shadow ${
                        isOverdue
                          ? "border-red-300"
                          : isDueSoon
                          ? "border-amber-300"
                          : ""
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">
                            {assignment.title}
                          </CardTitle>
                          <div className="flex gap-2">
                            {isNew && (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                New
                              </Badge>
                            )}
                            {isOverdue && (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                Overdue
                              </Badge>
                            )}
                            {isDueSoon && !isOverdue && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                Due Soon
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardDescription className="flex items-center text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {assignment.due_date ? (
                            <span
                              className={
                                isOverdue
                                  ? "text-red-600"
                                  : isDueSoon
                                  ? "text-amber-600"
                                  : ""
                              }
                            >
                              Due:{" "}
                              {new Date(
                                assignment.due_date
                              ).toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          ) : (
                            <span>No due date</span>
                          )}
                          <span className="mx-2">•</span>
                          <span>
                            Posted:{" "}
                            {new Date(
                              assignment.created_at
                            ).toLocaleDateString()}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="flex justify-between items-center">
                          <Badge
                            variant={
                              assignment.submitted ? "default" : "outline"
                            }
                            className={
                              assignment.submitted
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-gray-100 text-gray-800 border-gray-200"
                            }
                          >
                            {assignment.submitted
                              ? "Submitted"
                              : "Not Submitted"}
                          </Badge>

                          {assignment.file_url &&
                            isTrustedStorageUrl(assignment.file_url) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1 text-maroon hover:text-maroon/80 hover:bg-maroon/10"
                                onClick={() =>
                                  downloadFile(
                                    assignment.file_url!,
                                    assignment.title
                                  )
                                }
                              >
                                <Download className="h-3 w-3" />
                                <span className="text-xs">Download</span>
                              </Button>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {visibleAnnouncements.length} announcement
              {visibleAnnouncements.length !== 1 ? "s" : ""} •{" "}
              {assignments.length} assignment
              {assignments.length !== 1 ? "s" : ""}
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}