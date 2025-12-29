import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, ClipboardList, Upload, Loader2, AlertTriangle, Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import AssessmentResultsView from './AssessmentResultsView';

// --- Flexible CSV/TXT parser (handles commas or tabs, skips blanks) ---
const parseCSV = (content) => {
  const delimiter = content.includes('\t') ? '\t' : ',';
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter);
    const row = {};
    headers.forEach((header, i) => {
      const val = values[i] !== undefined ? values[i].trim() : '';
      row[header] = val;
    });
    return row;
  });

  return { headers, rows };
};

export default function AssessmentsSection() {
  const [viewingAssessment, setViewingAssessment] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploadData, setUploadData] = useState({ file: null, date: '', max_marks: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const queryClient = useQueryClient();

  // --- Queries ---
  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('assessments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // --- Mutations ---
  const createAssessmentMutation = useMutation<any, Error, any>({
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

  const deleteAssessmentMutation = useMutation<any, Error, any>({
    mutationFn: async (assessmentId: any) => {
      const { error: err1 } = await supabase.from('assessment_results').delete().eq('assessment_id', assessmentId);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('assessments').delete().eq('id', assessmentId);
      if (err2) throw err2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] });
    },
  });

  const bulkCreateResultsMutation = useMutation<any, Error, any[]>({
    mutationFn: async (rows: any[]) => {
      const { data: res, error } = await supabase.from('assessment_results').insert(rows);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] });
      setUploadTarget(null);
      setUploadData({ file: null, date: '', max_marks: '' });
      setIsProcessing(false);
      setUploadError(null);
    },
    onError: (error) => {
      setUploadError("Failed to upload results. Please check the data and try again.");
      setIsProcessing(false);
    }
  });

  // --- Upload ---
  const handleResultsUpload = async () => {
  if (!uploadData.file) return setUploadError("Please select a CSV file to upload.");
  setIsProcessing(true);
  setUploadError(null);

  try {
    const fileContent = await uploadData.file.text();
    const { headers, rows } = parseCSV(fileContent);

    if (rows.length === 0) throw new Error("CSV file appears empty or misformatted.");

    // Accept multiple possible column headers
    const fixedCols = [
      'assessment_title', 'Assessment_Title',
      'student_reg_no', 'Student_Reg_No', 'Reg_no', 'reg_no',
      'name', 'Name'
    ];

    // Identify subject columns dynamically
    const subjectCols = headers.filter(h => !fixedCols.includes(h?.trim()));

    if (subjectCols.length === 0) throw new Error("No subject columns found.");

    // Create lookup maps for faster matching
    const assessmentMap = new Map(assessments.map(a => [a.title?.trim().toLowerCase(), a.id]));
    const studentMap = new Map(
      students.map(s => [s.Reg_no?.trim().toLowerCase() || s.reg_no?.trim().toLowerCase(), s.id])
    );
    const subjectMap = new Map(subjects.map(s => [s.code?.trim().toLowerCase(), s.id]));

    const recordsToInsert = [];

    for (const row of rows) {
      const title = row['Assessment_Title']?.trim() || row['assessment_title']?.trim();
      const studentRegNo = row['Reg_no']?.trim() || row['Student_Reg_No']?.trim() || row['student_reg_no']?.trim();

      if (!title || !studentRegNo) continue;

      const assessment_id = assessmentMap.get(title.toLowerCase());
      const student_id = studentMap.get(studentRegNo.toLowerCase());
      if (!assessment_id || !student_id) continue;

      for (const subjectCol of subjectCols) {
        const scoreStr = row[subjectCol];
        if (!scoreStr) continue;

        const score = parseFloat(scoreStr);
        if (isNaN(score)) continue;

        const code = subjectCol.trim().toLowerCase();
        const subject_id = subjectMap.get(code);
        if (!subject_id) continue;

        recordsToInsert.push({
          assessment_id,
          student_id,
          subject_id,
          score,
          max_marks: parseInt(uploadData.max_marks) || 100,
          assessment_date: uploadData.date,
          updated_at: new Date(),
        });
      }
    }

    if (recordsToInsert.length === 0) throw new Error("No valid results found to upload. Please verify subject codes and student Reg_no.");

    await bulkCreateResultsMutation.mutateAsync(recordsToInsert);
  } catch (err) {
    console.error("Upload failed:", err);
    setUploadError(err.message || "Unexpected error during upload.");
  } finally {
    setIsProcessing(false);
    }
  };

  const getClassName = (classId) => classes.find(c => c.id === classId)?.name || 'N/A';
  const handleUploadInputChange = (field, value) => setUploadData(prev => ({ ...prev, [field]: value }));

  if (viewingAssessment)
    return <AssessmentResultsView assessment={viewingAssessment} onBack={() => setViewingAssessment(null)} />;

  return (
    <div className="space-y-6">
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
                  <TableHead>Class</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>{getClassName(a.class_id)}</TableCell>
                    <TableCell>{a.term}</TableCell>
                    <TableCell>{a.year}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setViewingAssessment(a)}>
                        <Eye className="w-4 h-4 mr-2" /> View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setUploadTarget(a);
                        setUploadError(null);
                        setUploadData({ file: null, date: '', max_marks: '' });
                      }}>
                        <Upload className="w-4 h-4 mr-2" /> Upload
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the assessment "${a.title}"? This will also delete all associated results.`)) {
                            deleteAssessmentMutation.mutate(a.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Assessment</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const entries = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
            const data: Record<string, any> = { ...entries };
            data.term = parseInt(String(entries.term));
            data.year = parseInt(String(entries.year));
            createAssessmentMutation.mutate(data);
          }}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Assessment Title</Label>
                <Input name="title" required placeholder="e.g., Grade 8 Exam 1" />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select name="class_id" required>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Term</Label>
                  <Input name="term" type="number" min="1" max="3" required />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input name="year" type="number" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={!!uploadTarget} onOpenChange={() => setUploadTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Results for {uploadTarget?.title}</DialogTitle>
            <DialogDescription>
              Example columns:<br />
              <strong>Assessment_Title, Student_Reg_No, Name, ENG_JS, MATH_JS, AGR_JS</strong><br />
              Supports commas or tabs. Optional subjects will be ignored safely.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={uploadData.date} onChange={(e) => handleUploadInputChange('date', e.target.value)} />
              </div>
              <div>
                <Label>Max Marks</Label>
                <Input type="number" placeholder="e.g. 100" value={uploadData.max_marks} onChange={(e) => handleUploadInputChange('max_marks', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>CSV File</Label>
              <Input type="file" accept=".csv,.txt" onChange={(e) => handleUploadInputChange('file', e.target.files[0])} />
            </div>
            {uploadError && (
              <div className="flex items-center p-3 text-sm text-red-800 rounded-lg bg-red-50">
                <AlertTriangle className="w-4 h-4 mr-2" />
                {uploadError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUploadTarget(null)}>Cancel</Button>
            <Button disabled={!uploadData.file || !uploadData.date || !uploadData.max_marks || isProcessing}
              onClick={handleResultsUpload}
              className="bg-green-600 hover:bg-green-700">
              {isProcessing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>) : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}