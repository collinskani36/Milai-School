import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ClipboardList, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export default function AssessmentsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: assessments } = useQuery({
    queryKey: ['assessments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('assessments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*');
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
      const { data: res, error } = await supabase.from('assessments').insert([data]);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setShowAddModal(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
  const formData = new FormData(e.target);
  const entries = Array.from(formData.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : '']);
  const data = Object.fromEntries(entries) as Record<string, string>;
  (data as any).total_marks = parseFloat(data.total_marks as string);
  (data as any).year = parseInt(data.year as string);
  createMutation.mutate(data as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={async () => {
          setShowRaw(v => !v);
          if (!showRaw) {
            const { data, error } = await supabase.from('assessments').select('*').order('created_at', { ascending: false });
            if (error) {
              console.error('Debug fetch assessments error', error);
              setRawRows([]);
            } else {
              setRawRows(data || []);
            }
          }
        }}>{showRaw ? 'Hide raw rows' : 'Show raw assessments'}</Button>
      </div>
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-orange-600" />
              Assessments Management
            </CardTitle>
            <Button onClick={() => setShowAddModal(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Assessment
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
                  <TableHead>Term</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Total Marks</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">{assessment.title}</TableCell>
                    <TableCell>{assessment.subject_id}</TableCell>
                    <TableCell>{assessment.class_id}</TableCell>
                    <TableCell>{assessment.term}</TableCell>
                    <TableCell>{assessment.year}</TableCell>
                    <TableCell>{assessment.total_marks}</TableCell>
                    <TableCell>
                      {assessment.assessment_date 
                        ? format(new Date(assessment.assessment_date), 'MMM d, yyyy')
                        : '-'}
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
            <DialogTitle>Create New Assessment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Assessment Title</Label>
                <Input name="title" placeholder="e.g., Mid-Term Exam" required />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select name="subject_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
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
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Term</Label>
                  <Select name="term" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Term 1">Term 1</SelectItem>
                      <SelectItem value="Term 2">Term 2</SelectItem>
                      <SelectItem value="Term 3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input name="year" type="number" placeholder="2024" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Total Marks</Label>
                <Input name="total_marks" type="number" placeholder="100" required />
              </div>
              <div className="space-y-2">
                <Label>Assessment Date</Label>
                <Input name="assessment_date" type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Create Assessment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}