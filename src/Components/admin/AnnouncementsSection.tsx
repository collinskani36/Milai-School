import { supabase } from '@/lib/supabaseClient';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, Bell, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select';
import { Badge } from '@/Components/ui/badge';
import { format } from 'date-fns';

export default function AnnouncementsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [classId, setClassId] = useState('all'); // ✅ Default to 'all' classes
  const queryClient = useQueryClient();

  // === Fetch Announcements ===
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // === Fetch Classes ===
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) throw error;
      return data;
    },
  });

  // === Create Announcement ===
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { title, content, expires_at } = data;

      // ✅ Single announcement record with is_for_all_classes flag
      const announcementData = {
        title: title.trim(),
        content: content?.trim() || '',
        priority,
        class_id: classId === 'all' ? null : classId, // null means all classes
        is_for_all_classes: classId === 'all', // ✅ New flag to mark all-classes announcements
        expires_at: expires_at || null,
      };

      const { error } = await supabase.from('announcements').insert([announcementData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      setShowAddModal(false);
      // ✅ Reset form state
      setPriority('normal');
      setClassId('all');
    },
    onError: (error) => {
      console.error('Error creating announcement:', error);
      alert('Failed to create announcement. Check your fields.');
    },
  });

  // === Delete Announcement ===
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(['announcements']),
  });

  // === Handle Form Submit ===
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    createMutation.mutate(data);
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      low: 'bg-gray-500 text-white',
    };
    return <Badge className={styles[priority] || ''}>{priority}</Badge>;
  };

  // ✅ Get class name for display - enhanced to show "All Classes" with icon
  const getClassName = (announcement: any) => {
    if (announcement.is_for_all_classes || !announcement.class_id) {
      return (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>All Classes</span>
        </div>
      );
    }
    const cls = classes.find(c => c.id === announcement.class_id);
    return cls ? cls.name : 'Unknown Class';
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-pink-600" />
              Announcements Management
            </CardTitle>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-pink-600 hover:bg-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500">Loading...</p>
            ) : announcements.length > 0 ? (
              announcements.map((a) => (
                <Card key={a.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {a.title}
                          </h3>
                          {getPriorityBadge(a.priority)}
                          {/* ✅ Show "All Classes" badge for visibility */}
                          {(a.is_for_all_classes || !a.class_id) && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              All Classes
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">{a.content}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {a.created_at && (
                            <span>
                              {format(new Date(a.created_at), 'MMM d, yyyy • h:mm a')}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            Target: {getClassName(a)}
                          </span>
                          {a.expires_at && (
                            <span>
                              Expires:{' '}
                              {format(new Date(a.expires_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(a.id)}
                        disabled={deleteMutation.isLoading}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center py-8 text-gray-500">No announcements yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* === Add Modal === */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Announcement</DialogTitle>
            <DialogDescription>
              Fill out the details below and click "Create" to publish your announcement.
              By default, announcements are sent to all classes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="title" placeholder="Announcement title" required />
              </div>

              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea name="content" placeholder="Announcement details..." rows={4} required />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* ✅ "All Classes" option preselected */}
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        All Classes
                      </div>
                    </SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Expiration Date (Optional)</Label>
                <Input name="expires_at" type="date" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowAddModal(false);
                // ✅ Reset to default values when canceling
                setPriority('normal');
                setClassId('all');
              }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-pink-600 hover:bg-pink-700"
                disabled={createMutation.isLoading}
              >
                {createMutation.isLoading ? 'Creating...' : 'Create Announcement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}