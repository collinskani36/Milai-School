// assignment_announcement.tsx
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/Components/ui/dialog";
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
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignmentAnnouncement({
  classId,
  isOpen,
  onClose
}: AssignmentAnnouncementProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // Fetch data ONLY when component is opened
  useEffect(() => {
    if (isOpen && classId) {
      fetchAssignments();
      fetchAnnouncements();
      
      // Set up real-time subscriptions
      const setupSubscriptions = () => {
        const assignmentsSubscription = supabase
          .channel('assignments-changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'assignments',
              filter: `class_id=eq.${classId}`,
            },
            () => {
              fetchAssignments();
            }
          )
          .subscribe();

        const announcementsSubscription = supabase
          .channel('announcements-changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'announcements',
              filter: `class_id=eq.${classId}`,
            },
            () => {
              fetchAnnouncements();
            }
          )
          .subscribe();

        return () => {
          assignmentsSubscription.unsubscribe();
          announcementsSubscription.unsubscribe();
        };
      };

      const cleanup = setupSubscriptions();
      return cleanup;
    }
  }, [isOpen, classId]);

  const fetchAssignments = async () => {
    if (!classId) return;
    
    setAssignmentsLoading(true);
    try {
      const { data: assignmentsData, error } = await supabase
        .from("assignments")
        .select("*")
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching assignments:", error);
        setAssignments([]);
      } else {
        setAssignments(assignmentsData || []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    if (!classId) return;
    
    setAnnouncementsLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, class_id, created_at, priority, expires_at, is_for_all_classes")
        .or(`class_id.eq.${classId},is_for_all_classes.eq.true`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching announcements:", error.message);
        setAnnouncements([]);
      } else {
        setAnnouncements(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching announcements:", err);
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isAssignmentDueSoon = (dueDate: string | null) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 3 && daysUntilDue > 0;
  };

  const isAssignmentOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="max-w-[95vw] lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl lg:text-2xl text-maroon">
            <Bell className="h-5 w-5 lg:h-6 lg:w-6 mr-2 lg:mr-3" />
            Assignments & Announcements
          </DialogTitle>
          <DialogDescription>
            View your class assignments and important announcements
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Announcements Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Bell className="h-5 w-5 mr-2 text-maroon" />
              Announcements ({announcements.length})
            </h3>
            
            {announcementsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto mb-4"></div>
                <p className="text-gray-600">Loading announcements...</p>
              </div>
            ) : announcements.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No announcements yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {announcements.slice(0, 10).map((announcement) => {
                  const isNew = new Date(announcement.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                  const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();
                  
                  if (isExpired) return null;

                  return (
                    <Card key={announcement.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{announcement.title}</CardTitle>
                          <div className="flex gap-2">
                            {isNew && (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                New
                              </Badge>
                            )}
                            <Badge className={getPriorityColor(announcement.priority) + " text-xs"}>
                              {announcement.priority || "Normal"}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription className="text-xs">
                          {new Date(announcement.created_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                          {announcement.expires_at && (
                            <span className="text-amber-600 ml-2">
                              • Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">{announcement.content}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assignments Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <FileText className="h-5 w-5 mr-2 text-maroon" />
              Assignments ({assignments.length})
            </h3>
            
            {assignmentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon mx-auto mb-4"></div>
                <p className="text-gray-600">Loading assignments...</p>
              </div>
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
                {assignments.slice(0, 10).map((assignment) => {
                  const isNew = new Date(assignment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                  const isDueSoon = isAssignmentDueSoon(assignment.due_date);
                  const isOverdue = isAssignmentOverdue(assignment.due_date);
                  
                  return (
                    <Card key={assignment.id} className={`hover:shadow-md transition-shadow ${
                      isOverdue ? 'border-red-300' : isDueSoon ? 'border-amber-300' : ''
                    }`}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{assignment.title}</CardTitle>
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
                            <span className={isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : ''}>
                              Due: {new Date(assignment.due_date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span>No due date</span>
                          )}
                          <span className="mx-2">•</span>
                          <span>Posted: {new Date(assignment.created_at).toLocaleDateString()}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="flex justify-between items-center">
                          <Badge variant={assignment.submitted ? "default" : "outline"} className={
                            assignment.submitted 
                              ? "bg-green-100 text-green-800 border-green-200" 
                              : "bg-gray-100 text-gray-800 border-gray-200"
                          }>
                            {assignment.submitted ? "Submitted" : "Not Submitted"}
                          </Badge>
                          
                          {assignment.file_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex items-center gap-1 text-maroon hover:text-maroon/80 hover:bg-maroon/10"
                              onClick={() => window.open(assignment.file_url!, '_blank')}
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
              Showing {Math.min(10, announcements.length)} of {announcements.length} announcements • 
              {Math.min(10, assignments.length)} of {assignments.length} assignments
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