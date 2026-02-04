import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, ClipboardList, Upload, Loader2, AlertTriangle, Eye, Trash2, Users, Calendar, Hash, FileText, X } from 'lucide-react';
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
import { Badge } from '@/Components/ui/badge';
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
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          classes (id, name, grade_level)
        `)
        .order('created_at', { ascending: false });
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

  // Helper function to get term badge color
  const getTermBadgeColor = (term) => {
    switch (term) {
      case 'Term 1': return 'bg-blue-100 text-blue-800';
      case 'Term 2': return 'bg-green-100 text-green-800';
      case 'Term 3': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (viewingAssessment)
    return <AssessmentResultsView assessment={viewingAssessment} onBack={() => setViewingAssessment(null)} />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              <span className="text-lg sm:text-2xl">Assessments</span>
            </CardTitle>
            <Button 
              onClick={() => setShowAddModal(true)} 
              className="bg-orange-600 hover:bg-orange-700 h-10 sm:h-auto"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Create Assessment</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6">
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {assessments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>No assessments found</p>
                <p className="text-sm text-gray-400 mt-1">Create your first assessment</p>
              </div>
            ) : (
              assessments.map((a) => (
                <Card key={a.id} className="p-4 shadow-xs">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-base mb-1 truncate">{a.title}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Users className="w-3 h-3" />
                        {a.classes?.name || getClassName(a.class_id)}
                      </div>
                    </div>
                    <Badge className={`${getTermBadgeColor(a.term)} text-xs`}>
                      {a.term}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3 text-gray-500" />
                      <span>Year: {a.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>Grade {a.classes?.grade_level || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setViewingAssessment(a)}
                      className="h-8 flex-1 min-w-[80px]"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setUploadTarget(a);
                        setUploadError(null);
                        setUploadData({ file: null, date: '', max_marks: '' });
                      }}
                      className="h-8 flex-1 min-w-[80px]"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Upload
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete the assessment "${a.title}"? This will also delete all associated results.`)) {
                          deleteAssessmentMutation.mutate(a.id);
                        }
                      }}
                      className="h-8 flex-1 min-w-[80px] text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto -mx-2 sm:mx-0">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">Title</TableHead>
                  <TableHead className="py-3">Class</TableHead>
                  <TableHead className="py-3">Term</TableHead>
                  <TableHead className="py-3">Year</TableHead>
                  <TableHead className="py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium py-3">{a.title}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span>{a.classes?.name || getClassName(a.class_id)}</span>
                        <span className="text-xs text-gray-500">Grade {a.classes?.grade_level || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge className={`${getTermBadgeColor(a.term)}`}>
                        {a.term}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">{a.year}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setViewingAssessment(a)}
                          className="h-8"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setUploadTarget(a);
                            setUploadError(null);
                            setUploadData({ file: null, date: '', max_marks: '' });
                          }}
                          className="h-8"
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          Upload
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete the assessment "${a.title}"? This will also delete all associated results.`)) {
                              deleteAssessmentMutation.mutate(a.id);
                            }
                          }}
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {assessments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>No assessments found</p>
                <p className="text-sm text-gray-400 mt-1">Create your first assessment</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Assessment Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              Create New Assessment
            </DialogTitle>
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
            <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm sm:text-base">Assessment Title *</Label>
                <Input 
                  id="title"
                  name="title" 
                  required 
                  placeholder="e.g., Grade 8 Exam 1" 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="class_id" className="text-sm sm:text-base">Class *</Label>
                <Select name="class_id" required>
                  <SelectTrigger id="class_id" className="h-10 sm:h-auto text-sm sm:text-base">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} (Grade {cls.grade_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="term" className="text-sm sm:text-base">Term *</Label>
                  <Input 
                    id="term"
                    name="term" 
                    type="number" 
                    min="1" 
                    max="3" 
                    required 
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="year" className="text-sm sm:text-base">Year *</Label>
                  <Input 
                    id="year"
                    name="year" 
                    type="number" 
                    required 
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-6 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddModal(false)}
                className="h-10 sm:h-auto w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-600 hover:bg-orange-700 h-10 sm:h-auto w-full sm:w-auto order-1 sm:order-2"
              >
                Create Assessment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Results Dialog */}
      <Dialog open={!!uploadTarget} onOpenChange={() => setUploadTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-lg sm:text-xl">
                  Upload Results for {uploadTarget?.title}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm mt-2">
                  Example columns:<br />
                  <strong>Assessment_Title, Student_Reg_No, Name, ENG_JS, MATH_JS, AGR_JS</strong><br />
                  Supports commas or tabs. Optional subjects will be ignored safely.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setUploadTarget(null)}
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="py-2 sm:py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="upload-date" className="text-sm sm:text-base">Date *</Label>
                <Input 
                  id="upload-date"
                  type="date" 
                  value={uploadData.date} 
                  onChange={(e) => handleUploadInputChange('date', e.target.value)} 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max-marks" className="text-sm sm:text-base">Max Marks *</Label>
                <Input 
                  id="max-marks"
                  type="number" 
                  placeholder="e.g. 100" 
                  value={uploadData.max_marks} 
                  onChange={(e) => handleUploadInputChange('max_marks', e.target.value)}
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="csv-file" className="text-sm sm:text-base">CSV File *</Label>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <Input 
                  id="csv-file"
                  type="file" 
                  accept=".csv,.txt" 
                  onChange={(e) => handleUploadInputChange('file', e.target.files[0])} 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: CSV or TXT with comma or tab delimiters
              </p>
            </div>
            
            {uploadError && (
              <div className="flex items-start p-3 text-sm text-red-800 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{uploadError}</div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-6 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setUploadTarget(null)}
              className="h-10 sm:h-auto w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button 
              disabled={!uploadData.file || !uploadData.date || !uploadData.max_marks || isProcessing}
              onClick={handleResultsUpload}
              className="bg-green-600 hover:bg-green-700 h-10 sm:h-auto w-full sm:w-auto order-1 sm:order-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Results
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}