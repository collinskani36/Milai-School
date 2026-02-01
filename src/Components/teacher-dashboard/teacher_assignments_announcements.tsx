import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/Components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { FileText, MessageSquare, Plus, Upload, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ---------- Types ----------
interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  classes?: {
    id: string;
    name: string;
    grade_level: string;
    created_at: string;
  } | {
    id: string;
    name: string;
    grade_level: string;
    created_at: string;
  }[];
  subjects?: {
    id: string;
    name: string;
    code: string;
    created_at: string;
  } | {
    id: string;
    name: string;
    code: string;
    created_at: string;
  }[];
}

interface Assignment {
  id: string;
  title: string;
  subject_id: string;
  class_id: string;
  due_date: string;
  created_at: string;
  file_url: string | null;
  description: string | null;
  total_marks: number | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string | null;
  class_id: string;
  created_at: string;
  priority: string;
  expires_at: string | null;
  is_for_all_classes: boolean;
}

// Helper to normalize relation fields
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

interface TeacherAssignmentsAnnouncementsProps {
  teacherId: string | undefined;
  teacherClasses: TeacherClass[];
  isActive: boolean;
}

// ---------- Create Assignment Dialog ----------
const CreateAssignmentDialog: React.FC<{
  teacherClasses: TeacherClass[];
  onAssignmentCreated: () => void;
}> = ({ teacherClasses, onAssignmentCreated }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const resetForm = () => {
    setTitle("");
    setDueDate("");
    setDescription("");
    setSelectedClass("");
    setFile(null);
    setError(null);
  };

  const handleCreateAssignment = async () => {
    if (!title.trim() || !selectedClass || !dueDate) {
      setError("Please fill in all required fields");
      return;
    }

    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDateObj < today) {
      setError("Due date cannot be in the past");
      return;
    }

    if (title.trim().length > 200) {
      setError("Title must be less than 200 characters");
      return;
    }

    if (description.length > 5000) {
      setError("Description must be less than 5000 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedTeacherClass = teacherClasses.find(tc => tc.class_id === selectedClass);
      if (!selectedTeacherClass) {
        setError("Unauthorized: You don't have access to this class");
        setLoading(false);
        return;
      }

      let file_url = null;
      if (file) {
        const allowedTypes = [
          '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', 
          '.zip', '.ppt', '.pptx', '.xlsx', '.csv', '.txt'
        ];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
          setError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
          setLoading(false);
          return;
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
          setError("File size exceeds 10MB limit");
          setLoading(false);
          return;
        }

        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\s+/g, '_');
        
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const filePath = `assignments/${timestamp}_${randomString}_${sanitizedFileName}`;
        
        const { error: storageError } = await supabase.storage
          .from("assignments")
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (storageError) {
          console.error('Storage error:', storageError);
          throw new Error(`File upload failed: ${storageError.message}`);
        }
        
        const { data: urlData } = supabase.storage
          .from("assignments")
          .getPublicUrl(filePath);
        
        file_url = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("assignments").insert([{
        title: title.trim(),
        subject_id: selectedTeacherClass.subject_id,
        class_id: selectedClass,
        due_date: dueDate,
        description: description.trim(),
        created_at: new Date().toISOString(),
        file_url,
      }]);

      if (insertError) {
        console.error("Database insert error:", insertError);
        throw new Error(`Failed to create assignment: ${insertError.message}`);
      }

      resetForm();
      setOpen(false);
      onAssignmentCreated();
    } catch (err: any) {
      console.error("Error creating assignment:", err);
      setError("Failed to create assignment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 px-2 sm:h-9 sm:px-4 text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span>New Assignment</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 sm:space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Create Assignment</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create a new assignment for your class. Maximum file size: 10MB.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Class *</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent className="text-xs sm:text-sm max-h-[200px]">
                {teacherClasses.map(tc => (
                  <SelectItem 
                    value={tc.class_id} 
                    key={tc.class_id}
                    className="text-xs sm:text-sm"
                  >
                    {firstRel(tc.classes)?.name || tc.class_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Assignment title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">
              {title.length}/200 characters
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Description (optional)</label>
            <Textarea
              placeholder="Assignment description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px] text-xs sm:text-sm"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {description.length}/5000 characters
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Due Date *</label>
            <Input
              type="date"
              placeholder="Due date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">
              Attach File (optional)
              <span className="text-xs text-gray-500 ml-1 sm:ml-2">Max 10MB</span>
            </label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.ppt,.pptx,.xlsx,.csv,.txt"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  if (selectedFile.size > 10 * 1024 * 1024) {
                    setError("File size exceeds 10MB limit");
                    e.target.value = '';
                    setFile(null);
                  } else {
                    setError(null);
                    setFile(selectedFile);
                  }
                } else {
                  setFile(null);
                }
              }}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
            {file && (
              <div className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs sm:text-sm text-red-500 bg-red-50 p-2 sm:p-3 rounded border border-red-200">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreateAssignment}
            className="w-full h-9 sm:h-10 text-xs sm:text-sm"
            disabled={loading}
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {loading ? "Creating..." : "Create Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Create Announcement Dialog ----------
const CreateAnnouncementDialog: React.FC<{
  teacherClasses: TeacherClass[];
  onAnnouncementCreated: () => void;
}> = ({ teacherClasses, onAnnouncementCreated }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [announcementAttempts, setAnnouncementAttempts] = useState<number[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSelectedClass("");
    setError(null);
  };

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentAttempts = announcementAttempts.filter(time => time > oneMinuteAgo);
    setAnnouncementAttempts(recentAttempts);
    
    if (recentAttempts.length >= 10) {
      setIsRateLimited(true);
      return true;
    }
    return false;
  };

  const handleSendAnnouncement = async () => {
    if (checkRateLimit()) {
      setError("Rate limit exceeded. Please wait 1 minute before sending another announcement.");
      return;
    }

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    
    if (title.trim().length > 200) {
      setError("Title must be less than 200 characters");
      return;
    }
    
    if (!content.trim()) {
      setError("Content is required");
      return;
    }
    
    if (content.trim().length > 5000) {
      setError("Content must be less than 5000 characters");
      return;
    }
    
    if (!selectedClass) {
      setError("Class selection is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setAnnouncementAttempts(prev => [...prev, Date.now()]);
      const selectedTeacherClass = teacherClasses.find(tc => tc.class_id === selectedClass);
      if (!selectedTeacherClass) {
        setError("Unauthorized: You don't have access to this class");
        setLoading(false);
        return;
      }

      const sanitizedTitle = title.trim();
      const sanitizedContent = content.trim();

      const { error: insertError } = await supabase.from("announcements").insert([{
        title: sanitizedTitle,
        content: sanitizedContent,
        class_id: selectedClass,
        priority: 'normal',
        created_at: new Date().toISOString(),
        expires_at: null,
        is_for_all_classes: false,
      }]);

      if (insertError) {
        console.error("Database insert error:", insertError);
        if (insertError.code === '23502') {
          setError("Required field missing. Please fill in all required fields.");
        } else if (insertError.code === '23503') {
          setError("Invalid class reference. Please select a valid class.");
        } else if (insertError.code === '23514') {
          setError("Invalid data format. Please check your input.");
        } else {
          setError("Failed to send announcement. Please try again.");
        }
        throw insertError;
      }

      resetForm();
      setOpen(false);
      setIsRateLimited(false);
      onAnnouncementCreated();
    } catch (err: any) {
      if (!error) {
        setError("Failed to send announcement. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
        setIsRateLimited(false);
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isRateLimited} className="h-8 px-2 sm:h-9 sm:px-4 text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span>New Announcement</span>
          {isRateLimited && <span className="ml-1 sm:ml-2 text-xs">(Rate Limited)</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 sm:space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Create Announcement</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Send an announcement to your selected class.
            {isRateLimited && (
              <div className="text-amber-600 mt-1 text-xs sm:text-sm">
                Rate limited: Please wait before sending another announcement.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Class *</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent className="text-xs sm:text-sm max-h-[200px]">
                {teacherClasses.map(tc => (
                  <SelectItem 
                    value={tc.class_id} 
                    key={tc.class_id}
                    className="text-xs sm:text-sm"
                  >
                    {firstRel(tc.classes)?.name || tc.class_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Title *</label>
            <Input
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">
              {title.length}/200 characters
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1 block">Content *</label>
            <Textarea
              placeholder="Type your announcement here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] sm:min-h-[100px] text-xs sm:text-sm"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {content.length}/5000 characters
            </div>
          </div>

          {error && (
            <div className="text-xs sm:text-sm text-red-500 bg-red-50 p-2 sm:p-3 rounded border border-red-200">
              {error}
            </div>
          )}

          <Button 
            onClick={handleSendAnnouncement}
            className="w-full h-9 sm:h-10 text-xs sm:text-sm" 
            disabled={loading || isRateLimited}
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {loading ? "Sending..." : "Send Announcement"}
          </Button>
          
          {announcementAttempts.length > 0 && (
            <div className="text-xs text-gray-500 text-center">
              Announcements in last minute: {announcementAttempts.length}/10
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Main Component ----------
export default function TeacherAssignmentsAnnouncements({ 
  teacherId, 
  teacherClasses, 
  isActive 
}: TeacherAssignmentsAnnouncementsProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch data only when component is active (tab is selected)
  useEffect(() => {
    if (!isActive || !teacherClasses.length || !teacherId) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchAssignments(),
          fetchAnnouncements(),
        ]);
      } catch (error) {
        console.error("Error fetching assignments/announcements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isActive, teacherClasses, teacherId]);

  const fetchAssignments = useCallback(async () => {
    if (!teacherClasses.length || !teacherId) {
      setAssignments([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .in("class_id", classIds);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    }
  }, [teacherClasses, teacherId]);

  const fetchAnnouncements = useCallback(async () => {
    if (!teacherClasses.length || !teacherId) {
      setAnnouncements([]);
      return;
    }

    try {
      const classIds = teacherClasses.map(tc => tc.class_id).filter(Boolean);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .in("class_id", classIds);
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setAnnouncements([]);
    }
  }, [teacherClasses, teacherId]);

  const handleDeleteAssignment = async (id: string) => {
    if (!teacherId) return;
    
    try {
      const assignment = assignments.find(a => a.id === id);
      if (!assignment) {
        setError("Assignment not found");
        setAssignmentToDelete(null);
        return;
      }

      const teacherClassIds = teacherClasses.map(tc => tc.class_id);
      if (!teacherClassIds.includes(assignment.class_id)) {
        setError("Unauthorized: You don't have access to delete this assignment");
        setAssignmentToDelete(null);
        return;
      }

      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
      
      setAssignmentToDelete(null);
      await fetchAssignments();
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!teacherId) return;
    
    try {
      const announcement = announcements.find(a => a.id === id);
      if (!announcement) {
        setError("Announcement not found");
        setAnnouncementToDelete(null);
        return;
      }

      const teacherClassIds = teacherClasses.map(tc => tc.class_id);
      if (!teacherClassIds.includes(announcement.class_id)) {
        setError("Unauthorized: You don't have access to delete this announcement");
        setAnnouncementToDelete(null);
        return;
      }

      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      
      setAnnouncementToDelete(null);
      await fetchAnnouncements();
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete announcement");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Confirmation Dialogs */}
      <Dialog open={!!assignmentToDelete} onOpenChange={(open) => !open && setAssignmentToDelete(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete this assignment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 sm:mt-4">
            <Button 
              variant="outline" 
              onClick={() => setAssignmentToDelete(null)}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => assignmentToDelete && handleDeleteAssignment(assignmentToDelete)}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            >
              Delete Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!announcementToDelete} onOpenChange={(open) => !open && setAnnouncementToDelete(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete this announcement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 sm:mt-4">
            <Button 
              variant="outline" 
              onClick={() => setAnnouncementToDelete(null)}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => announcementToDelete && handleDeleteAnnouncement(announcementToDelete)}
              className="h-9 sm:h-10 text-xs sm:text-sm"
            >
              Delete Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="bg-destructive/15 text-destructive p-3 sm:p-4 rounded-lg flex justify-between items-center text-xs sm:text-sm">
          <span className="flex-1 mr-2">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 sm:h-8 sm:w-8 p-0">
            ×
          </Button>
        </div>
      )}

      {/* Assignments Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <div className="flex items-center">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <CardTitle className="text-base sm:text-lg">Assignment Management</CardTitle>
          </div>

          <CreateAssignmentDialog 
            teacherClasses={teacherClasses}
            onAssignmentCreated={fetchAssignments}
          />
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {assignments.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No assignments yet. Create your first assignment!
              </div>
            )}

            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1 truncate">{assignment.title}</h4>

                  {assignment.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2 line-clamp-2">
                      {assignment.description}
                    </p>
                  )}

                  <div className="flex items-center flex-wrap gap-x-2 sm:gap-x-4 gap-y-1 text-xs text-muted-foreground mb-1 sm:mb-2">
                    <span className="whitespace-nowrap">
                      Due: {assignment.due_date
                        ? new Date(assignment.due_date).toLocaleDateString()
                        : "N/A"}
                    </span>

                    <span className="whitespace-nowrap">
                      Created: {new Date(assignment.created_at).toLocaleDateString()}
                    </span>

                    {assignment.total_marks && (
                      <span className="whitespace-nowrap">Total Marks: {assignment.total_marks}</span>
                    )}
                  </div>

                  {assignment.file_url && (
                    <a
                      href={assignment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center truncate"
                    >
                      <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">Download Attached File</span>
                    </a>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAssignmentToDelete(assignment.id)}
                  title="Delete assignment"
                  className="h-7 w-7 sm:h-8 sm:w-8 ml-1 sm:ml-2 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Announcements Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <div className="flex items-center">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <CardTitle className="text-base sm:text-lg">Announcements</CardTitle>
          </div>
          
          <CreateAnnouncementDialog 
            teacherClasses={teacherClasses}
            onAnnouncementCreated={fetchAnnouncements}
          />
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {announcements.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No announcements yet. Create your first announcement!
              </div>
            )}
            {announcements.map((announcement) => (
              <div key={announcement.id} className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 flex-wrap">
                    <h4 className="font-semibold text-sm truncate">{announcement.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {firstRel(teacherClasses.find(tc => tc.class_id === announcement.class_id)?.classes)?.name || "Class"}
                    </Badge>
                    {announcement.priority !== 'normal' && (
                      <Badge variant={announcement.priority === 'high' ? 'destructive' : 'default'} className="text-xs">
                        {announcement.priority}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-foreground mb-1 sm:mb-2 line-clamp-2">{announcement.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(announcement.created_at).toLocaleString()}
                    {announcement.expires_at && ` • Expires: ${new Date(announcement.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAnnouncementToDelete(announcement.id)}
                  title="Delete announcement"
                  className="h-7 w-7 sm:h-8 sm:w-8 ml-1 sm:ml-2 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}