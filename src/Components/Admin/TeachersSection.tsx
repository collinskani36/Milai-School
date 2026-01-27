import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/Components/ui/input';
import { Plus, Search, Pencil, Trash2, Shield, BookOpen, Users, X } from 'lucide-react';
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
  // In the createMutation
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

    // 1. Check if HTTP-level error occurred
    if (res.error) {
      throw new Error(`Failed to create teacher: ${res.error.message}`);
    }

    // 2. Parse response properly
    let result;
    if (typeof res.data === 'string') {
      result = JSON.parse(res.data);
    } else if (res.data instanceof ArrayBuffer) {
      const text = new TextDecoder().decode(res.data);
      result = JSON.parse(text);
    } else {
      result = res.data;
    }

    // 3. Check function-level error
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
      return <span className="text-gray-500">No assignments</span>;
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
                {classInfo.name} ({classInfo.grade_level})
              </div>
              <div className="flex flex-wrap gap-1">
                {subjects.map(subject => (
                  <div key={subject.assignment_id || subject.id} className="flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs">
                    <BookOpen className="w-3 h-3" />
                    {subject.code} - {subject.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1"
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
    <div className="space-y-6">
      {creationSuccess && (
        <div className="w-full bg-green-100 text-green-700 rounded px-4 py-2 mb-2 text-center font-medium">
          {creationSuccess}
        </div>
      )}
      
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-600" />
              Teachers Management
            </CardTitle>
            <Button onClick={handleAddNew} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Teacher
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by name, teacher code, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">{teacher.teacher_code}</TableCell>
                      <TableCell>{`${teacher.first_name} ${teacher.last_name}`}</TableCell>
                      <TableCell>{teacher.email || '-'}</TableCell>
                      <TableCell>{teacher.phone || '-'}</TableCell>
                      <TableCell className="max-w-md">
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
                      <TableCell>
                        {teacher.is_admin ? (
                          <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">Teacher</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(teacher)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(teacher)}
                            disabled={isDeleting}
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
                <p className="text-center py-8 text-gray-500">No teachers found</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Teacher Modal */}
      <Dialog open={showAddModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teacher_code">Teacher Code *</Label>
                <Input 
                  id="teacher_code"
                  value={formData.teacher_code}
                  onChange={(e) => handleInputChange('teacher_code', e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input 
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input 
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Optional - will auto-generate if empty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>

              {!editingTeacher && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password (optional)</Label>
                  <Input 
                    id="password"
                    type="password" 
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Set a password or leave blank for auto-generate"
                  />
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_admin"
                  checked={formData.is_admin}
                  onCheckedChange={(checked) => handleInputChange('is_admin', checked)}
                />
                <Label htmlFor="is_admin">Grant Admin Access</Label>
              </div>
            </div>
            <DialogFooter>
              {formError && (
                <div className="text-sm text-red-600 mr-auto">{formError}</div>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700"
                disabled={isSaving}
              >
                {isSaving ? 'Loading...' : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={handleAssignmentModalChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Add Assignment for {selectedTeacher?.first_name} {selectedTeacher?.last_name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignmentSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="assignment_class_id">Class *</Label>
                <Select 
                  value={assignmentForm.class_id}
                  onValueChange={(value) => handleAssignmentChange('class_id', value)}
                  required
                >
                  <SelectTrigger id="assignment_class_id">
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
                <Label htmlFor="assignment_subjects">Subjects *</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {subjects.map((subject) => (
                      <div key={subject.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subject-${subject.id}`}
                          checked={assignmentForm.subject_ids?.includes(subject.id) || false}
                          onCheckedChange={() => handleSubjectToggle(subject.id)}
                        />
                        <Label 
                          htmlFor={`subject-${subject.id}`}
                          className="text-sm cursor-pointer flex-1"
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
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAssignmentModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700"
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