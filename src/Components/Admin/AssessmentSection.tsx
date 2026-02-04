import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, ClipboardList, Upload, Calendar, Hash, BookOpen, Users, Award, Eye, EyeOff } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { format } from 'date-fns';
import { Badge } from '@/Components/ui/badge';

export default function AssessmentsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: assessments } = useQuery({
    queryKey: ['assessments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          subjects (id, name, code),
          classes (id, name, grade_level)
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

  // Helper function to get term badge color
  const getTermBadgeColor = (term: string) => {
    switch (term) {
      case 'Term 1': return 'bg-blue-100 text-blue-800';
      case 'Term 2': return 'bg-green-100 text-green-800';
      case 'Term 3': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Raw Data Toggle Button */}
      <div className="flex justify-end">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={async () => {
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
          }}
          className="h-9 sm:h-10"
        >
          {showRaw ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              Hide Raw Data
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Show Raw Data
            </>
          )}
        </Button>
      </div>

      {/* Raw Data Display */}
      {showRaw && rawRows.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl font-bold">
              Raw Assessments Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto text-xs sm:text-sm">
              <pre className="bg-gray-50 p-3 sm:p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(rawRows, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Assessments Card */}
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
          <div className="sm:hidden space-y-4">
            {assessments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>No assessments found</p>
                <p className="text-sm text-gray-400 mt-1">Create your first assessment</p>
              </div>
            ) : (
              assessments.map((assessment) => (
                <Card key={assessment.id} className="p-4 shadow-xs">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-base mb-1">{assessment.title}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <BookOpen className="w-3 h-3" />
                        {assessment.subjects?.name || assessment.subject_id}
                      </div>
                    </div>
                    <Badge className={`${getTermBadgeColor(assessment.term)} text-xs`}>
                      {assessment.term}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-gray-500" />
                      <span>{assessment.classes?.name || assessment.class_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3 text-gray-500" />
                      <span>Year: {assessment.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-3 h-3 text-gray-500" />
                      <span>{assessment.total_marks} marks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>
                        {assessment.assessment_date 
                          ? format(new Date(assessment.assessment_date), 'MMM d, yyyy')
                          : 'No date'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    <div className="flex justify-between">
                      <span>Subject Code:</span>
                      <span className="font-medium">{assessment.subjects?.code || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Grade Level:</span>
                      <span className="font-medium">{assessment.classes?.grade_level || 'N/A'}</span>
                    </div>
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
                  <TableHead className="py-3">Subject</TableHead>
                  <TableHead className="py-3">Class</TableHead>
                  <TableHead className="py-3">Term</TableHead>
                  <TableHead className="py-3">Year</TableHead>
                  <TableHead className="py-3">Total Marks</TableHead>
                  <TableHead className="py-3">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium py-3">{assessment.title}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span>{assessment.subjects?.name || assessment.subject_id}</span>
                        <span className="text-xs text-gray-500">{assessment.subjects?.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span>{assessment.classes?.name || assessment.class_id}</span>
                        <span className="text-xs text-gray-500">Grade {assessment.classes?.grade_level}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge className={`${getTermBadgeColor(assessment.term)}`}>
                        {assessment.term}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">{assessment.year}</TableCell>
                    <TableCell className="py-3 font-medium">{assessment.total_marks}</TableCell>
                    <TableCell className="py-3">
                      {assessment.assessment_date 
                        ? format(new Date(assessment.assessment_date), 'MMM d, yyyy')
                        : '-'}
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

      {/* Create Assessment Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              Create New Assessment
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm sm:text-base">Assessment Title *</Label>
                <Input 
                  id="title"
                  name="title" 
                  placeholder="e.g., Mid-Term Exam" 
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject_id" className="text-sm sm:text-base">Subject *</Label>
                  <Select name="subject_id" required>
                    <SelectTrigger id="subject_id" className="h-10 sm:h-auto text-sm sm:text-base">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="term" className="text-sm sm:text-base">Term *</Label>
                  <Select name="term" required>
                    <SelectTrigger id="term" className="h-10 sm:h-auto text-sm sm:text-base">
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
                  <Label htmlFor="year" className="text-sm sm:text-base">Year *</Label>
                  <Input 
                    id="year"
                    name="year" 
                    type="number" 
                    placeholder="2024" 
                    required 
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_marks" className="text-sm sm:text-base">Total Marks *</Label>
                  <Input 
                    id="total_marks"
                    name="total_marks" 
                    type="number" 
                    placeholder="100" 
                    required 
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assessment_date" className="text-sm sm:text-base">Assessment Date</Label>
                  <Input 
                    id="assessment_date"
                    name="assessment_date" 
                    type="date" 
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
    </div>
  );
}