import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { format } from 'date-fns';

export default function AssignmentsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          total_marks,
          file_url,
          created_at,
          subjects (
            name,
            code
          ),
          classes (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, name, code');
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: res, error } = await supabase.from('assignments').insert([data]);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setShowAddModal(false);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const filePath = `${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from('assignments')
        .upload(filePath, file);
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from('assignments').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const entries = Array.from(formData.entries()).map(([k, v]) => [
      k,
      typeof v === 'string' ? v : '',
    ]);
    const data = Object.fromEntries(entries) as Record<string, string>;
    const fileInput = e.target.querySelector('input[type="file"]');
    if (fileInput.files[0]) {
      const file_url = await handleFileUpload({ target: fileInput });
      data.file_url = file_url;
    }

    if (data.total_marks) {
      (data as any).total_marks = parseFloat(data.total_marks as string);
    }

    createMutation.mutate(data as any);
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Assignments Management
            </CardTitle>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Assignment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total Marks</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.title}</TableCell>

                    {/* ✅ Show subject name and code together */}
                    <TableCell>
                      {assignment.subjects
                        ? `${assignment.subjects.name} - ${assignment.subjects.code || 'N/A'}`
                        : 'N/A'}
                    </TableCell>

                    <TableCell>{assignment.classes?.name || 'N/A'}</TableCell>

                    <TableCell>
                      {assignment.due_date
                        ? format(new Date(assignment.due_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>

                    <TableCell>{assignment.total_marks || '-'}</TableCell>

                    <TableCell>
                      {assignment.file_url ? (
                        <a
                          href={assignment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Assignment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Assignment Title</Label>
                <Input name="title" placeholder="e.g., Chapter 3 Homework" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" placeholder="Assignment details..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select name="subject_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} - {subject.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select name="class_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
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
                <Label>Due Date</Label>
                <Input name="due_date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Total Marks</Label>
                <Input name="total_marks" type="number" placeholder="100" />
              </div>
              <div className="space-y-2">
                <Label>Attachment (Optional)</Label>
                <Input type="file" accept=".pdf,.doc,.docx" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={uploadingFile}
              >
                {uploadingFile ? 'Uploading...' : 'Create Assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
