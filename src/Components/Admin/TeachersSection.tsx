import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/Components/ui/input';
import { Plus, Search, Pencil, Trash2, Shield, BookOpen, Users, X, Phone, Mail, User, Hash } from 'lucide-react';
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
import { Checkbox } from '@/Components/ui/checkbox';
import { Badge } from '@/Components/ui/badge';
import { Skeleton } from '@/Components/ui/skeleton';

interface Teacher {
  id: string;
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  auth_id?: string;
  assignments?: Record<string, any>;
}

interface FormData {
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  password: string;
}

interface AssignmentForm {
  class_id: string;
  subject_ids: string[];
}

export default function TeachersSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    teacher_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_admin: false,
    password: ''
  });

  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    class_id: '',
    subject_ids: []
  });

  // Fetch classes and subjects
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .order('grade_level', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, code, name')
        .order('code', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch teachers with their assignments
  const { data: teachers, isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false });

      if (teachersError) throw teachersError;

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('teacher_classes')
        .select(`
          id,
          teacher_id,
          class_id,
          subject_id,
          classes ( id, name, grade_level ),
          subjects ( id, code, name )
        `);

      if (assignmentsError) throw assignmentsError;

      const assignmentsByTeacher: Record<string, any> = {};
      assignmentsData?.forEach(assignment => {
        if (!assignmentsByTeacher[assignment.teacher_id]) {
          assignmentsByTeacher[assignment.teacher_id] = {};
        }
        if (!assignmentsByTeacher[assignment.teacher_id][assignment.class_id]) {
          assignmentsByTeacher[assignment.teacher_id][assignment.class_id] = {
            class: assignment.classes,
            subjects: []
          };
        }
        assignmentsByTeacher[assignment.teacher_id][assignment.class_id].subjects.push({
          id: assignment.subject_id,
          assignment_id: assignment.id,
          ...assignment.subjects
        });
      });

      return teachersData?.map(teacher => ({
        ...teacher,
        assignments: assignmentsByTeacher[teacher.id] || {}
      })) || [];
    },
  });

  // Create teacher with edge function
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        email: data.email,
        password: data.password,
        teacher_code: data.teacher_code,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        is_admin: data.is_admin,
      };

      const res = await supabase.functions.invoke('create-teacher', { body: payload });

      if (res.error) {
        throw new Error(`Failed to create teacher: ${res.error.message}`);
      }

      let result;
      if (typeof res.data === 'string') {
        result = JSON.parse(res.data);
      } else if (res.data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(res.data);
        result = JSON.parse(text);
      } else {
        result = res.data;
      }

      if (!result?.ok) {
        throw new Error(result?.error || 'Create operation failed');
      }

      return result;
    },

    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowAddModal(false);
      setEditingTeacher(null);
      resetForm();

      let message = "Teacher was successfully created!";
      if (!formData.password) message += " A temporary password was auto-generated.";

      setCreationSuccess(message);
      setTimeout(() => setCreationSuccess(null), 3500);

      toast({
        title: 'Teacher created',
        description: 'The teacher was added successfully.',
        variant: 'default'
      });
    },

    onError: (err: Error) => {
      setFormError(err.message);
      toast({
        title: 'Create failed',
        description: err.message,
        variant: 'destructive'
      });
    },
  });

  // Update teacher basic info
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!editingTeacher) throw new Error('No teacher selected for editing');

      const { error } = await supabase
        .from('teachers')
        .update({
          teacher_code: data.teacher_code,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          is_admin: data.is_admin,
        })
        .eq('id', editingTeacher.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowAddModal(false);
      setEditingTeacher(null);
      resetForm();
      toast({ 
        title: 'Teacher updated', 
        description: 'The teacher was updated successfully.' 
      });
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast({ 
        title: 'Update failed', 
        description: err.message,
        variant: 'destructive'
      });
    },
  });

  // Add assignments mutation
  const addAssignmentsMutation = useMutation({
    mutationFn: async ({ teacherId, classId, subjectIds }: { 
      teacherId: string; 
      classId: string; 
      subjectIds: string[] 
    }) => {
      if (!teacherId || !classId || !subjectIds.length) {
        throw new Error('Teacher, class, and at least one subject are required');
      }

      const assignments = subjectIds.map(subjectId => ({
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId
      }));

      const { data, error } = await supabase
        .from('teacher_classes')
        .insert(assignments)
        .select(`
          id,
          teacher_id,
          class_id,
          subject_id,
          classes ( id, name, grade_level ),
          subjects ( id, code, name )
        `);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This teacher is already assigned to one of these subjects in this class');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setShowAssignmentModal(false);
      setAssignmentForm({ class_id: '', subject_ids: [] });
      setSelectedTeacher(null);
      toast({ 
        title: 'Assignments added', 
        description: 'Class and subject assignments added successfully.' 
      });
    },
    onError: (err: Error) => {
      toast({ 
        title: 'Assignment failed', 
        description: err.message,
        variant: 'destructive'
      });
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('teacher_classes')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ 
        title: 'Assignment removed', 
        description: 'Class/subject assignment removed successfully.' 
      });
    },
    onError: (err: Error) => {
      toast({ 
        title: 'Remove failed', 
        description: err.message,
        variant: 'destructive'
      });
    },
  });

  // Delete teacher with edge function
  const deleteMutation = useMutation({
    mutationFn: async ({ teacherId, authId }: { teacherId: string; authId?: string }) => {
      const payload = { teacherId, userId: authId };
      const res = await supabase.functions.invoke('delete-teacher', { 
        body: JSON.stringify(payload) 
      });
      
      if (res.error) {
        throw new Error(`Failed to delete teacher: ${res.error.message}`);
      }

      const data = res.data;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Delete operation failed');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({
        title: 'Teacher deleted successfully',
        description: data.message || 'Teacher has been removed from the system',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Delete failed',
        description: err.message,
        variant: 'destructive'
      });
    },
  });

  // Compatibility flags for mutation loading state (react-query v4 vs v5 typings)
  const isDeleting = (() => {
    const m: any = deleteMutation as any;
    return Boolean(m?.isLoading ?? m?.status === 'loading');
  })();

  const isSaving = (() => {
    const a: any = createMutation as any;
    const b: any = updateMutation as any;
    return Boolean((a?.isLoading ?? a?.status === 'loading') || (b?.isLoading ?? b?.status === 'loading'));
  })();

  const isAddingAssignments = (() => {
    const m: any = addAssignmentsMutation as any;
    return Boolean(m?.isLoading ?? m?.status === 'loading');
  })();

  // Helper functions
  const resetForm = () => {
    setFormData({
      teacher_code: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      is_admin: false,
      password: ''
    });
    setFormError(null);
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAssignmentChange = (field: keyof AssignmentForm, value: any) => {
    setAssignmentForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubjectToggle = (subjectId: string) => {
    setAssignmentForm(prev => {
      const currentSubjects = prev.subject_ids || [];
      const isSelected = currentSubjects.includes(subjectId);
      
      return {
        ...prev,
        subject_ids: isSelected 
          ? currentSubjects.filter(id => id !== subjectId)
          : [...currentSubjects, subjectId]
      };
    });
  };

  const handleAddNew = () => {
    setEditingTeacher(null);
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      teacher_code: teacher.teacher_code || '',
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      is_admin: teacher.is_admin || false,
      password: ''
    });
    setShowAddModal(true);
  };

  const handleAddAssignment = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setAssignmentForm({ class_id: '', subject_ids: [] });
    setShowAssignmentModal(true);
  };

  const handleRemoveAssignment = (assignmentId: string, teacherName: string, className: string, subjectName: string) => {
    if (window.confirm(`Remove ${teacherName} from teaching ${subjectName} in ${className}?`)) {
      removeAssignmentMutation.mutate(assignmentId);
    }
  };

  const handleDelete = (teacher: Teacher) => {
    if (window.confirm(`Are you sure you want to delete ${teacher.first_name} ${teacher.last_name}? This will also remove all their class assignments. This action cannot be undone.`)) {
      deleteMutation.mutate({ 
        teacherId: teacher.id, 
        authId: teacher.auth_id 
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreationSuccess(null);
    
    // Validate required fields
    const requiredFields: (keyof FormData)[] = ['teacher_code', 'first_name', 'last_name'];
    const missingField = requiredFields.find(field => !formData[field]?.toString().trim());
    
    if (missingField) {
      setFormError(`${missingField.replace('_', ' ')} is required`);
      return;
    }

    if (editingTeacher) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    if (!assignmentForm.class_id || !assignmentForm.subject_ids.length) {
      toast({
        title: 'Missing information',
        description: 'Please select both a class and at least one subject',
        variant: 'destructive'
      });
      return;
    }

    addAssignmentsMutation.mutate({
      teacherId: selectedTeacher.id,
      classId: assignmentForm.class_id,
      subjectIds: assignmentForm.subject_ids
    });
  };

  const handleOpenChange = (open: boolean) => {
    setShowAddModal(open);
    if (!open) {
      setEditingTeacher(null);
      resetForm();
    }
  };

  const handleAssignmentModalChange = (open: boolean) => {
    setShowAssignmentModal(open);
    if (!open) {
      setSelectedTeacher(null);
      setAssignmentForm({ class_id: '', subject_ids: [] });
    }
  };

  // Render teacher assignments
  const renderTeacherAssignments = (teacher: Teacher) => {
    const assignments = teacher.assignments || {};
    const classIds = Object.keys(assignments);

    if (classIds.length === 0) {
      return <span className="text-gray-500 text-sm">No assignments</span>;
    }

    return (
      <div className="space-y-2">
        {classIds.map(classId => {
          const classInfo = assignments[classId]?.class;
          const subjects = assignments[classId]?.subjects || [];
          
          if (!classInfo) return null;
          
          return (
            <div key={classId} className="border rounded-lg p-3 bg-gray-50">
              <div className="font-medium text-sm flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span className="truncate">{classInfo.name} ({classInfo.grade_level})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {subjects.map(subject => (
                  <div key={subject.assignment_id || subject.id} className="flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs">
                    <BookOpen className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[80px] sm:max-w-none">{subject.code}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 flex-shrink-0"
                      onClick={() => handleRemoveAssignment(
                        subject.assignment_id,
                        `${teacher.first_name} ${teacher.last_name}`,
                        classInfo.name,
                        subject.name
                      )}
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const filteredTeachers = teachers?.filter(teacher =>
    `${teacher.first_name} ${teacher.last_name} ${teacher.teacher_code} ${teacher.email || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {creationSuccess && (
        <div className="w-full bg-green-100 text-green-700 rounded px-4 py-2 mb-2 text-center font-medium text-sm sm:text-base">
          {creationSuccess}
        </div>
      )}
      
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              <span className="text-lg sm:text-2xl">Teachers</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <Input
                  placeholder="Search teachers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 sm:pl-10 text-sm sm:text-base h-10"
                />
              </div>
              <Button 
                onClick={handleAddNew} 
                className="bg-purple-600 hover:bg-purple-700 h-10 sm:h-auto"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Add Teacher</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 sm:h-16" />)}
            </div>
          ) : (
            <div className="overflow-hidden">
              {/* Mobile-friendly card view for small screens */}
              <div className="sm:hidden space-y-3">
                {filteredTeachers.map((teacher) => (
                  <Card key={teacher.id} className="p-4 shadow-xs">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-base flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          {`${teacher.first_name} ${teacher.last_name}`}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <Hash className="w-3 h-3" />
                          {teacher.teacher_code}
                        </div>
                      </div>
                      {teacher.is_admin ? (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">Admin</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Teacher</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm mb-3">
                      {teacher.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          <span className="truncate">{teacher.email}</span>
                        </div>
                      )}
                      {teacher.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          <span>{teacher.phone}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <div className="font-medium text-sm mb-2">Assignments:</div>
                      <div className="max-h-32 overflow-y-auto">
                        {renderTeacherAssignments(teacher)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between gap-2 pt-3 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAddAssignment(teacher)}
                        className="h-8 px-2 text-xs flex-1"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Assign
                      </Button>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(teacher)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(teacher)} 
                          disabled={isDeleting}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {filteredTeachers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No teachers found</p>
                    <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
              
              {/* Table view for medium screens and up */}
              <div className="hidden sm:block overflow-x-auto -mx-2 sm:mx-0">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-3">Teacher Code</TableHead>
                      <TableHead className="py-3">Name</TableHead>
                      <TableHead className="py-3">Email</TableHead>
                      <TableHead className="py-3">Phone</TableHead>
                      <TableHead className="py-3">Assignments</TableHead>
                      <TableHead className="py-3">Role</TableHead>
                      <TableHead className="py-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium py-3">{teacher.teacher_code}</TableCell>
                        <TableCell className="py-3">{`${teacher.first_name} ${teacher.last_name}`}</TableCell>
                        <TableCell className="py-3 truncate max-w-[180px]">{teacher.email || '-'}</TableCell>
                        <TableCell className="py-3">{teacher.phone || '-'}</TableCell>
                        <TableCell className="py-3 max-w-md">
                          <div className="space-y-2">
                            {renderTeacherAssignments(teacher)}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddAssignment(teacher)}
                              className="mt-2"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Assignment
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {teacher.is_admin ? (
                            <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                          ) : (
                            <Badge variant="secondary">Teacher</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(teacher)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(teacher)}
                              disabled={isDeleting}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredTeachers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No teachers found</p>
                    <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Teacher Modal */}
      <Dialog open={showAddModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="teacher_code" className="text-sm sm:text-base">Teacher Code *</Label>
                <Input 
                  id="teacher_code"
                  value={formData.teacher_code}
                  onChange={(e) => handleInputChange('teacher_code', e.target.value)}
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-sm sm:text-base">First Name *</Label>
                <Input 
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-sm sm:text-base">Last Name *</Label>
                <Input 
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Optional - will auto-generate if empty"
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm sm:text-base">Phone</Label>
                <Input 
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>

              {!editingTeacher && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="password" className="text-sm sm:text-base">Password (optional)</Label>
                  <Input 
                    id="password"
                    type="password" 
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Set a password or leave blank for auto-generate"
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                  <p className="text-xs text-gray-500">
                    If left blank, a temporary password will be auto-generated and can be reset later.
                  </p>
                </div>
              )}
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="is_admin"
                  checked={formData.is_admin}
                  onCheckedChange={(checked) => handleInputChange('is_admin', checked)}
                />
                <Label htmlFor="is_admin" className="text-sm sm:text-base cursor-pointer">
                  Grant Admin Access
                </Label>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-6 border-t">
              {formError && (
                <div className="text-sm text-red-600 mr-auto text-left w-full sm:w-auto">{formError}</div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
                  className="bg-purple-600 hover:bg-purple-700 h-10 sm:h-auto w-full sm:w-auto order-1 sm:order-2"
                  disabled={isSaving}
                >
                  {isSaving ? 'Loading...' : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={handleAssignmentModalChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              Add Assignment for {selectedTeacher?.first_name} {selectedTeacher?.last_name}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAssignmentSubmit}>
            <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="assignment_class_id" className="text-sm sm:text-base">Class *</Label>
                <Select 
                  value={assignmentForm.class_id}
                  onValueChange={(value) => handleAssignmentChange('class_id', value)}
                  required
                >
                  <SelectTrigger id="assignment_class_id" className="h-10 sm:h-auto text-sm sm:text-base">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} ({cls.grade_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assignment_subjects" className="text-sm sm:text-base">Subjects *</Label>
                <div className="border rounded-lg p-3 sm:p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subjects.map((subject) => (
                      <div key={subject.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subject-${subject.id}`}
                          checked={assignmentForm.subject_ids?.includes(subject.id) || false}
                          onCheckedChange={() => handleSubjectToggle(subject.id)}
                          className="flex-shrink-0"
                        />
                        <Label 
                          htmlFor={`subject-${subject.id}`}
                          className="text-sm cursor-pointer flex-1 truncate"
                          title={`${subject.code} - ${subject.name}`}
                        >
                          {subject.code} - {subject.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {assignmentForm.subject_ids?.length || 0} subjects
                </p>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-6 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAssignmentModal(false)}
                className="h-10 sm:h-auto w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 h-10 sm:h-auto w-full sm:w-auto order-1 sm:order-2"
                disabled={isAddingAssignments}
              >
                {isAddingAssignments ? 'Adding...' : 'Add Assignments'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}