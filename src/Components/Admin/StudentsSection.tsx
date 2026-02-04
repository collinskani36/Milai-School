import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/Components/ui/input';
import { Plus, Search, Pencil, Trash2, UserPlus, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Skeleton } from '@/Components/ui/skeleton';

export default function StudentsSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  // Add sort state
  const [sortConfig, setSortConfig] = useState({ key: 'reg_no', direction: 'asc' });

  // State for form values
  const [formData, setFormData] = useState({
    reg_no: '',
    first_name: '',
    last_name: '',
    gender: '',
    class_id: '',
    phone: '',
    date_of_birth: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    password: '',
    student_type: 'Day Scholar' // Default to 'Day Scholar'
  });

  // helper: convert camelCase keys to snake_case
  const camelToSnake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();

  const normalizeFormKeys = (obj: Record<string, any>) => {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach((k) => {
      const nk = k.includes('_') ? k : camelToSnake(k);
      out[nk] = obj[k];
    });
    return out;
  };

  // Handle sort
  const handleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const { data: students, isLoading, refetch } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          auth_id,
          created_at,
          profiles (
            id,
            student_id,
            reg_no,
            first_name,
            last_name,
            date_of_birth,
            gender,
            phone,
            email,
            guardian_name,
            guardian_phone,
            student_type,
            guardian_email,
            created_at,
            updated_at
          ),
          enrollments (
            id,
            class_id
          )
        `);
      if (error) throw error;
      const rows = data || [];
      return rows.map((r) => {
        const normalized: any = { ...r };
        if (r.profiles && Array.isArray(r.profiles) && r.profiles.length > 0) {
          normalized.profile = r.profiles[0];
        } else {
          normalized.profile = {
            reg_no: '',
            first_name: '',
            last_name: '',
            date_of_birth: null,
            gender: '',
            phone: '',
            email: '',
            guardian_name: '',
            guardian_phone: '',
            guardian_email: '',
            student_type: 'Day Scholar',
          };
        }
        normalized.enrollment = r.enrollments && r.enrollments.length > 0 ? r.enrollments[0] : null;
        return normalized;
      });
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

  // Sort and filter students
  const filteredStudents = (students || [])
  .filter((student) => {
    if (!student || !student.profile) return false; // skip invalid entries
    const p = student.profile;
    return `${p.first_name || ''} ${p.last_name || ''} ${p.reg_no || ''} ${p.email || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  })
  .sort((a, b) => {
    const aValue = a.profile?.[sortConfig.key] || '';
    const bValue = b.profile?.[sortConfig.key] || '';
    if (sortConfig.direction === 'asc') {
      return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
    } else {
      return bValue.localeCompare(aValue, undefined, { numeric: true, sensitivity: 'base' });
    }
  });

  const createMutation = useMutation<any, any, Record<string, any>, unknown>({
    mutationFn: async (data) => {
      const constructedEmail = `${data.reg_no}@school.local`;
      const { class_id, reg_no, first_name, last_name, date_of_birth, gender, phone, password, student_type, guardian_email } = data;
      const payload = {
        email: guardian_email, // Changed from constructedEmail to guardian_email
        password,
        reg_no,
        first_name,
        last_name,
        date_of_birth,
        gender,
        phone,
        guardian_email, // Added guardian_email to payload
        class_id,
        student_type
      };
      const res = await supabase.functions.invoke('create-user', {
        body: JSON.stringify(payload)
      });
      let parsed = res.data ?? null;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
        }
      }
      if (parsed && (parsed.ok === true || parsed.ok === "true" || parsed.ok == 1 || !!parsed.ok)) {
        setCreationSuccess("Student was successfully created!");
        return parsed;
      }
      throw new Error('Edge function failed to create user. (actual ok value: ' + JSON.stringify(parsed?.ok) + ')');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowAddModal(false);
      setEditingStudent(null);
      setFormData({
        reg_no: '',
        first_name: '',
        last_name: '',
        gender: '',
        class_id: '',
        phone: '',
        date_of_birth: '',
        guardian_name: '',
        guardian_phone: '',
        guardian_email: '',
        password: '',
        student_type: 'Day Scholar'
      });
      toast({
        title: 'Student created',
        description: 'The student was added successfully.'
      });
      setCreationSuccess("Student was successfully created!");
      setTimeout(() => setCreationSuccess(null), 3500);
    },
    onError: (err: any) => {
      console.error('Create student error', err);
      const message = String(err?.message || err);
      setFormError(message);
      toast({
        title: 'Create failed',
        description: message
      });
    },
  });

  const updateMutation = useMutation<any, any, Record<string, any>>({
    mutationFn: async (data) => {
      if (!editingStudent) throw new Error('No student selected for editing');
      const updates = [];
      // Update profiles table if (editingStudent.profile?.id)
      if (editingStudent.profile?.id) {
        const profileUpdate = supabase
          .from('profiles')
          .update({
            reg_no: data.reg_no,
            first_name: data.first_name,
            last_name: data.last_name,
            gender: data.gender,
            date_of_birth: data.date_of_birth,
            phone: data.phone,
            guardian_name: data.guardian_name,
            guardian_phone: data.guardian_phone,
            guardian_email: data.guardian_email, // Added guardian_email update
            student_type: data.student_type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStudent.profile.id);
        updates.push(profileUpdate);
      }
      // Update enrollments table if class_id changed and enrollment exists
      if (data.class_id && editingStudent.enrollment?.id) {
        const enrollmentUpdate = supabase
          .from('enrollments')
          .update({
            class_id: data.class_id,
          })
          .eq('id', editingStudent.enrollment.id);
        updates.push(enrollmentUpdate);
      }
      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) throw result.error;
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowAddModal(false);
      setEditingStudent(null);
      setFormData({
        reg_no: '',
        first_name: '',
        last_name: '',
        gender: '',
        class_id: '',
        phone: '',
        date_of_birth: '',
        guardian_name: '',
        guardian_phone: '',
        guardian_email: '',
        password: '',
        student_type: 'Day Scholar'
      });
      toast({
        title: 'Student updated',
        description: 'The student was updated successfully.'
      });
    },
    onError: (err: any) => {
      console.error('Update student error', err);
      const message = String(err?.message || err);
      setFormError(message);
      toast({
        title: 'Update failed',
        description: message,
        variant: 'destructive'
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation<any, any, { studentId: string; authId?: string }>({
    mutationFn: async ({ studentId, authId }: { studentId: string; authId?: string }) => {
      const payload = { studentId, userId: authId };
      const res = await supabase.functions.invoke('delete-user', {
        body: JSON.stringify(payload)
      });
      if (res.error) {
        throw new Error(`Failed to invoke delete function: ${res.error.message}`);
      }
      const data = res.data;
      if (!data || !data.success) {
        throw new Error(data?.error || 'Delete operation failed');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Student deleted successfully',
        description: data.message || 'Student has been removed from the system',
      });
    },
    onError: (err: any) => {
      console.error('Delete student error', err);
      toast({
        title: 'Delete failed',
        description: err.message,
        variant: 'destructive'
      });
    },
  });

  // Normalize mutation loading flags (react-query v5 typings differ)
  const isDeleting = Boolean((deleteMutation as any)?.isLoading ?? (deleteMutation as any)?.status === 'loading');
  const isCreatingOrUpdating = Boolean(
    ((createMutation as any)?.isLoading ?? (createMutation as any)?.status === 'loading') ||
    ((updateMutation as any)?.isLoading ?? (updateMutation as any)?.status === 'loading')
  );

  // Add confirmation for delete
  const handleDelete = (student: any) => {
    if (window.confirm(`Are you sure you want to delete ${student.profile?.first_name} ${student.profile?.last_name}? This action cannot be undone.`)) {
      deleteMutation.mutate({ studentId: student.id, authId: student.auth_id });
    }
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Reset form when opening for new student
  const handleAddNew = () => {
    setEditingStudent(null);
    setFormData({
      reg_no: '',
      first_name: '',
      last_name: '',
      gender: '',
      class_id: '',
      phone: '',
      date_of_birth: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_email: '',
      password: '',
      student_type: 'Day Scholar'
    });
    setShowAddModal(true);
  };

  // Set form data when editing
  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      reg_no: student.profile?.reg_no || '',
      first_name: student.profile?.first_name || '',
      last_name: student.profile?.last_name || '',
      gender: student.profile?.gender || '',
      class_id: student.enrollment?.class_id || '',
      phone: student.profile?.phone || '',
      date_of_birth: student.profile?.date_of_birth || '',
      guardian_name: student.profile?.guardian_name || '',
      guardian_phone: student.profile?.guardian_phone || '',
      guardian_email: student.profile?.guardian_email || '',
      student_type: student.profile?.student_type || 'Day Scholar',
      password: ''
    });
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setCreationSuccess(null);
    const data = normalizeFormKeys(formData);
    // Validate required fields
    if (!data.reg_no || String(data.reg_no).trim() === '') {
      setFormError('Registration number is required');
      return;
    }
    data.reg_no = String(data.reg_no).trim();
    
    // Validate guardian_email for new students
    if (!editingStudent && (!data.guardian_email || String(data.guardian_email).trim() === '')) {
      setFormError('Guardian email is required for password recovery');
      return;
    }
    
    // Validate guardian_email format if provided
    if (data.guardian_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.guardian_email.trim())) {
        setFormError('Please enter a valid guardian email address');
        return;
      }
      data.guardian_email = String(data.guardian_email).trim();
    }

    // Validate phone if provided
    const phone = data.phone ? String(data.phone).trim() : '';
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 7) {
        setFormError('Please enter a valid phone number');
        return;
      }
      data.phone = phone;
    }
    // Validate date of birth if provided
    const dob = data.date_of_birth ? String(data.date_of_birth).trim() : '';
    if (dob) {
      const d = new Date(dob);
      if (isNaN(d.getTime())) {
        setFormError('Invalid date of birth');
        return;
      }
      const now = new Date();
      if (d > now) {
        setFormError('Date of birth cannot be in the future');
        return;
      }
      if (d.getFullYear() < 1900) {
        setFormError('Please provide a valid year of birth');
        return;
      }
      data.date_of_birth = dob;
    }
    if (editingStudent) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setShowAddModal(open);
    if (!open) {
      setEditingStudent(null);
      setFormError(null);
      setFormData({
        reg_no: '',
        first_name: '',
        last_name: '',
        gender: '',
        class_id: '',
        phone: '',
        date_of_birth: '',
        guardian_name: '',
        guardian_phone: '',
        guardian_email: '',
        password: '',
        student_type: 'Day Scholar'
      });
    }
  };

  // Sort indicator component
  const SortIndicator: React.FC<{ columnKey: string }> = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 inline ml-1" /> : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

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
              <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              <span className="text-lg sm:text-2xl">Students</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <Input 
                  placeholder="Search students..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-9 sm:pl-10 text-sm sm:text-base h-10"
                />
              </div>
              <Button 
                onClick={handleAddNew} 
                className="bg-blue-600 hover:bg-blue-700 h-10 sm:h-auto"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Add Student</span>
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
                {filteredStudents.map((student) => (
                  <Card key={student.id} className="p-4 shadow-xs">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-base">
                          {`${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.profile?.reg_no}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.profile?.student_type === 'Boarding' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {student.profile?.student_type || 'Day Scholar'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Gender:</span>
                        <span className="ml-1">{student.profile?.gender}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <span className="ml-1 truncate block">{student.profile?.email || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEdit(student)}
                        className="h-8 px-2"
                      >
                        <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="ml-1 text-xs">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(student)} 
                        disabled={isDeleting}
                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="ml-1 text-xs">Delete</span>
                      </Button>
                    </div>
                  </Card>
                ))}
                
                {filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No students found</p>
                    <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
              
              {/* Table view for medium screens and up */}
              <div className="hidden sm:block overflow-x-auto -mx-2 sm:mx-0">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-gray-50 py-3" onClick={() => handleSort('reg_no')}>
                        <div className="flex items-center">
                          Reg No
                          <SortIndicator columnKey="reg_no" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 py-3" onClick={() => handleSort('first_name')}>
                        <div className="flex items-center">
                          Name
                          <SortIndicator columnKey="first_name" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 py-3" onClick={() => handleSort('gender')}>
                        <div className="flex items-center">
                          Gender
                          <SortIndicator columnKey="gender" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 py-3" onClick={() => handleSort('student_type')}>
                        <div className="flex items-center">
                          Student Type
                          <SortIndicator columnKey="student_type" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 py-3" onClick={() => handleSort('email')}>
                        <div className="flex items-center">
                          Email
                          <SortIndicator columnKey="email" />
                        </div>
                      </TableHead>
                      <TableHead className="py-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium py-3">{student.profile?.reg_no}</TableCell>
                        <TableCell className="py-3">{`${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`}</TableCell>
                        <TableCell className="py-3">{student.profile?.gender}</TableCell>
                        <TableCell className="py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            student.profile?.student_type === 'Boarding' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {student.profile?.student_type || 'Day Scholar'}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 truncate max-w-[200px]">{student.profile?.email}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(student)} className="h-8 w-8 p-0">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(student)} disabled={isDeleting} className="h-8 w-8 p-0">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No students found</p>
                    <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={showAddModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="reg_no" className="text-sm sm:text-base">Registration Number</Label>
                <Input 
                  id="reg_no" 
                  name="reg_no" 
                  value={formData.reg_no} 
                  onChange={(e) => handleInputChange('reg_no', e.target.value)} 
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-sm sm:text-base">First Name</Label>
                <Input 
                  id="first_name" 
                  name="first_name" 
                  value={formData.first_name} 
                  onChange={(e) => handleInputChange('first_name', e.target.value)} 
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-sm sm:text-base">Last Name</Label>
                <Input 
                  id="last_name" 
                  name="last_name" 
                  value={formData.last_name} 
                  onChange={(e) => handleInputChange('last_name', e.target.value)} 
                  required 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm sm:text-base">Gender</Label>
                <Select 
                  name="gender" 
                  value={formData.gender} 
                  onValueChange={(value) => handleInputChange('gender', value)} 
                  required
                >
                  <SelectTrigger id="gender" className="h-10 sm:h-auto text-sm sm:text-base">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class_id" className="text-sm sm:text-base">Class</Label>
                <Select 
                  name="class_id" 
                  value={formData.class_id} 
                  onValueChange={(value) => handleInputChange('class_id', value)} 
                  required
                >
                  <SelectTrigger id="class_id" className="h-10 sm:h-auto text-sm sm:text-base">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="student_type" className="text-sm sm:text-base">Student Type</Label>
                <Select 
                  name="student_type" 
                  value={formData.student_type} 
                  onValueChange={(value) => handleInputChange('student_type', value)}
                >
                  <SelectTrigger id="student_type" className="h-10 sm:h-auto text-sm sm:text-base">
                    <SelectValue placeholder="Select student type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Day Scholar">Day Scholar</SelectItem>
                    <SelectItem value="Boarding">Boarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* guardian_email field - full width on mobile */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guardian_email" className="text-sm sm:text-base">
                  Guardian Email {!editingStudent && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="guardian_email"
                  name="guardian_email"
                  type="email"
                  value={formData.guardian_email}
                  onChange={(e) => handleInputChange('guardian_email', e.target.value)}
                  required={!editingStudent}
                  placeholder="guardian@example.com"
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
                <p className="text-xs text-gray-500">
                  Used for password recovery. Students can still login with registration number.
                </p>
              </div>
              
              {!editingStudent && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="password" className="text-sm sm:text-base">Password (optional)</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    value={formData.password} 
                    onChange={(e) => handleInputChange('password', e.target.value)} 
                    placeholder="Set a password or leave blank" 
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm sm:text-base">Phone</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={(e) => handleInputChange('phone', e.target.value)} 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth" className="text-sm sm:text-base">Date of Birth</Label>
                <Input 
                  id="date_of_birth" 
                  name="date_of_birth" 
                  type="date" 
                  value={formData.date_of_birth} 
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)} 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_name" className="text-sm sm:text-base">Guardian Name</Label>
                <Input 
                  id="guardian_name" 
                  name="guardian_name" 
                  value={formData.guardian_name} 
                  onChange={(e) => handleInputChange('guardian_name', e.target.value)} 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_phone" className="text-sm sm:text-base">Guardian Phone</Label>
                <Input 
                  id="guardian_phone" 
                  name="guardian_phone" 
                  value={formData.guardian_phone} 
                  onChange={(e) => handleInputChange('guardian_phone', e.target.value)} 
                  className="h-10 sm:h-auto text-sm sm:text-base"
                />
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
                  className="bg-blue-600 hover:bg-blue-700 h-10 sm:h-auto w-full sm:w-auto order-1 sm:order-2" 
                  loading={isCreatingOrUpdating} 
                  disabled={isCreatingOrUpdating}
                >
                  {editingStudent ? 'Update' : 'Create'} Student
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}