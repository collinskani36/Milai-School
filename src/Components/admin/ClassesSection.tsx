import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, BookOpen, Users, GraduationCap, User, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ClassesSection() {
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassDetailModal, setShowClassDetailModal] = useState(false);
  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
  const [showGradeLevelModal, setShowGradeLevelModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [optionalSubjects, setOptionalSubjects] = useState([]);
  const queryClient = useQueryClient();

  // Fetch classes with student counts
  const { data: classes, isLoading: loadingClasses, error: classesError } = useQuery({
    queryKey: ['classes-with-details'],
    queryFn: async () => {
      console.log('Fetching classes...');
      
      // Get all classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('grade_level', { ascending: true })
        .order('name', { ascending: true });

      if (classesError) {
        console.error('Error fetching classes:', classesError);
        throw classesError;
      }

      console.log('Raw classes data:', classesData);

      if (!classesData || classesData.length === 0) {
        return [];
      }

      // Get student counts for each class
      const classesWithCounts = await Promise.all(
        classesData.map(async (cls) => {
          const { count, error: countError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);

          if (countError) {
            console.error('Error counting students for class', cls.id, countError);
          }

          // Get assigned subjects for this class
          const { data: classSubjects, error: subjectsError } = await supabase
            .from('classes_subjects')
            .select(`
              subject_id,
              is_optional,
              subjects (
                id,
                name,
                code
              )
            `)
            .eq('class_id', cls.id);

          if (subjectsError) {
            console.error('Error fetching subjects for class', cls.id, subjectsError);
          }

          return {
            ...cls,
            studentCount: count || 0,
            subjects: classSubjects?.map(cs => ({
              ...cs.subjects,
              is_optional: cs.is_optional
            })).filter(Boolean) || []
          };
        })
      );

      console.log('Classes with counts:', classesWithCounts);
      return classesWithCounts;
    },
  });

  // Fetch all subjects
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      if (error) {
        console.error('Error fetching subjects:', error);
        throw error;
      }
      return data || [];
    },
  });

  // Fetch grade levels for the dropdown
  const { data: gradeLevels, isLoading: loadingGradeLevels } = useQuery({
    queryKey: ['gradeLevels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('grade', { ascending: true });
      if (error) {
        console.error('Error fetching grade levels:', error);
        throw error;
      }
      console.log('Fetched grade levels:', data);
      return data || [];
    },
  });

  // Get unique stages for dropdown (without duplicates)
  const uniqueStages = React.useMemo(() => {
    if (!gradeLevels) return [];
    const stages = [...new Set(gradeLevels.map(level => level.stage))];
    console.log('Unique stages:', stages);
    return stages;
  }, [gradeLevels]);

  // Fetch students for selected class
  const { data: classStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ['class-students', selectedClass?.id],
    queryFn: async () => {
      if (!selectedClass) return [];
      
      console.log('Fetching students for class:', selectedClass.id);
      
      // Get enrollments for this class with student details
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          students (
            id,
            Reg_no,
            first_name,
            last_name,
            profiles!inner (
              gender
            )
          )
        `)
        .eq('class_id', selectedClass.id);

      if (error) {
        console.error('Error fetching class students:', error);
        throw error;
      }

      console.log('Enrollments data:', enrollments);

      // Transform the data to get student details
      const students = enrollments?.map(enrollment => ({
        enrollmentId: enrollment.id,
        id: enrollment.students.id,
        reg_no: enrollment.students.Reg_no,
        first_name: enrollment.students.first_name,
        last_name: enrollment.students.last_name,
        gender: enrollment.students.profiles?.gender || '-'
      })) || [];

      console.log('Transformed students:', students);
      return students;
    },
    enabled: !!selectedClass,
  });

  // Fetch subjects assigned to selected class
  const { data: assignedSubjects } = useQuery({
    queryKey: ['assigned-subjects', selectedClass?.id],
    queryFn: async () => {
      if (!selectedClass) return [];
      
      const { data, error } = await supabase
        .from('classes_subjects')
        .select(`
          id,
          is_optional,
          subjects (
            id,
            name,
            code
          )
        `)
        .eq('class_id', selectedClass.id);

      if (error) {
        console.error('Error fetching assigned subjects:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!selectedClass,
  });

  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: async (data) => {
      const { data: res, error } = await supabase.from('classes').insert([data]);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
      setShowClassModal(false);
      setEditingClass(null);
    },
  });

  // Create grade level mutation
  const createGradeLevelMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Inserting grade level:', data);
      const { data: res, error } = await supabase.from('grade_levels').insert([data]).select();
      if (error) {
        console.error('Error inserting grade level:', error);
        throw error;
      }
      console.log('Grade level inserted:', res);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeLevels'] });
      setShowGradeLevelModal(false);
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      alert('Error creating grade level: ' + error.message);
    }
  });

  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('classes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
      setShowClassModal(false);
      setEditingClass(null);
    },
  });

  // Create subject mutation
  const createSubjectMutation = useMutation({
    mutationFn: async (data) => {
      const { data: res, error } = await supabase.from('subjects').insert([data]);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setShowSubjectModal(false);
      setEditingSubject(null);
    },
  });

  // Update subject mutation
  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('subjects').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setShowSubjectModal(false);
      setEditingSubject(null);
    },
  });

  // Assign subjects to class mutation - UPDATED to handle optional subjects
  const assignSubjectsMutation = useMutation({
    mutationFn: async ({ classId, subjects, optionalSubjects }) => {
      // First, remove existing subjects for this class
      const { error: deleteError } = await supabase
        .from('classes_subjects')
        .delete()
        .eq('class_id', classId);

      if (deleteError) throw deleteError;

      // Then insert new assignments with optional flag
      if (subjects.length > 0) {
        const assignments = subjects.map(subjectId => ({
          class_id: classId,
          subject_id: subjectId,
          is_optional: optionalSubjects.includes(subjectId)
        }));

        const { error: insertError } = await supabase
          .from('classes_subjects')
          .insert(assignments);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-subjects'] });
      setShowAssignSubjectModal(false);
      setSelectedSubjects([]);
      setOptionalSubjects([]);
    },
  });

  // Remove subject from class
  const removeSubjectMutation = useMutation({
    mutationFn: async (assignmentId) => {
      const { error } = await supabase
        .from('classes_subjects')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    },
  });

  // Remove student from class
  const removeStudentMutation = useMutation({
    mutationFn: async (enrollmentId) => {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      queryClient.invalidateQueries({ queryKey: ['classes-with-details'] });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes-with-details'] }),
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const deleteGradeLevelMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('grade_levels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gradeLevels'] }),
  });

  const handleClassSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      grade_level: formData.get('grade_level'),
    };

    if (editingClass) {
      updateClassMutation.mutate({ id: editingClass.id, data });
    } else {
      createClassMutation.mutate(data);
    }
  };

  const handleSubjectSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      code: formData.get('code'),
    };

    if (editingSubject) {
      updateSubjectMutation.mutate({ id: editingSubject.id, data });
    } else {
      createSubjectMutation.mutate(data);
    }
  };

  const handleGradeLevelSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      stage: formData.get('stage'),
      grade: formData.get('grade'),
    };

    console.log('Submitting grade level:', data);
    createGradeLevelMutation.mutate(data);
  };

  const handleClassClick = (cls) => {
    setSelectedClass(cls);
    setShowClassDetailModal(true);
  };

  const handleAssignSubjects = (cls) => {
    setSelectedClass(cls);
    // Pre-select currently assigned subjects and their optional status
    const currentSubjectIds = cls.subjects?.map(subject => subject.id) || [];
    const currentOptionalIds = cls.subjects
      ?.filter(subject => subject.is_optional)
      .map(subject => subject.id) || [];
    
    setSelectedSubjects(currentSubjectIds);
    setOptionalSubjects(currentOptionalIds);
    setShowAssignSubjectModal(true);
  };

  const handleSubjectSelection = (subjectId) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
    // Remove from optional if deselected
    if (!selectedSubjects.includes(subjectId)) {
      setOptionalSubjects(prev => prev.filter(id => id !== subjectId));
    }
  };

  const handleOptionalToggle = (subjectId) => {
    setOptionalSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleRemoveStudent = (enrollmentId, studentName) => {
    if (window.confirm(`Remove ${studentName} from this class?`)) {
      removeStudentMutation.mutate(enrollmentId);
    }
  };

  const handleRemoveSubject = (assignmentId, subjectName) => {
    if (window.confirm(`Remove ${subjectName} from this class?`)) {
      removeSubjectMutation.mutate(assignmentId);
    }
  };

  const handleDeleteGradeLevel = (gradeLevelId, stageName) => {
    if (window.confirm(`Are you sure you want to delete the grade level "${stageName}"? This will affect classes using this grade level.`)) {
      deleteGradeLevelMutation.mutate(gradeLevelId);
    }
  };

  // Get display name for grade level - now just returns the stage name without numbers
  const getGradeLevelDisplayName = (gradeLevel) => {
    return gradeLevel; // Just return the stage name as stored
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-600" />
            Classes & Subjects Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="classes">
            <TabsList className="mb-6">
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="grade-levels">Grade Levels</TabsTrigger>
            </TabsList>

            {/* CLASSES TAB */}
            <TabsContent value="classes" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Class Management</h3>
                  <p className="text-sm text-gray-600">Create and manage classes, assign subjects and view students</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowGradeLevelModal(true)}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Grade Level
                  </Button>
                  <Button onClick={() => {
                    setEditingClass(null);
                    setShowClassModal(true);
                  }} className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Class
                  </Button>
                </div>
              </div>
              
              {loadingClasses ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : classesError ? (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6">
                    <div className="text-center text-red-600">
                      <p className="font-semibold">Error loading classes</p>
                      <p className="text-sm mt-2">{classesError.message}</p>
                      <Button 
                        onClick={() => queryClient.refetchQueries({ queryKey: ['classes-with-details'] })}
                        className="mt-4"
                        variant="outline"
                      >
                        Retry
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : !classes || classes.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Classes Found</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first class</p>
                    <Button 
                      onClick={() => setShowClassModal(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Class
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(cls => (
                    <Card 
                      key={cls.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500"
                      onClick={() => handleClassClick(cls)}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {getGradeLevelDisplayName(cls.grade_level)}
                            </p>
                            
                            {/* Student Count */}
                            <div className="flex items-center gap-2 mt-3">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {cls.studentCount} students
                              </span>
                            </div>

                            {/* Assigned Subjects */}
                            <div className="flex items-center gap-2 mt-2">
                              <BookOpen className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {cls.subjects?.length || 0} subjects
                              </span>
                            </div>

                            {/* Subject Tags */}
                            {cls.subjects && cls.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {cls.subjects.slice(0, 3).map(subject => (
                                  <Badge 
                                    key={subject.id} 
                                    variant={subject.is_optional ? "outline" : "secondary"} 
                                    className={`text-xs ${subject.is_optional ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}`}
                                  >
                                    {subject.code}
                                    {subject.is_optional && ' (Optional)'}
                                  </Badge>
                                ))}
                                {cls.subjects.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{cls.subjects.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssignSubjects(cls);
                              }}
                              title="Assign Subjects"
                            >
                              <GraduationCap className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingClass(cls);
                                setShowClassModal(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete class ${cls.name}?`)) {
                                  deleteClassMutation.mutate(cls.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* SUBJECTS TAB */}
            <TabsContent value="subjects" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Subject Management</h3>
                  <p className="text-sm text-gray-600">Create and manage subjects across all classes</p>
                </div>
                <Button onClick={() => {
                  setEditingSubject(null);
                  setShowSubjectModal(true);
                }} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subject
                </Button>
              </div>

              {loadingSubjects ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !subjects || subjects.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Subjects Found</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first subject</p>
                    <Button 
                      onClick={() => setShowSubjectModal(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Subject
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map(subject => (
                    <Card key={subject.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{subject.name}</h4>
                            <p className="text-sm text-gray-500">Code: {subject.code}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingSubject(subject);
                                setShowSubjectModal(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                if (window.confirm(`Delete subject ${subject.name}?`)) {
                                  deleteSubjectMutation.mutate(subject.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* GRADE LEVELS TAB */}
            <TabsContent value="grade-levels" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Grade Level Management</h3>
                  <p className="text-sm text-gray-600">Manage grade levels and stages for your school</p>
                </div>
                <Button 
                  onClick={() => setShowGradeLevelModal(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Grade Level
                </Button>
              </div>

              {loadingGradeLevels ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !gradeLevels || gradeLevels.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Grade Levels Found</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first grade level</p>
                    <Button 
                      onClick={() => setShowGradeLevelModal(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Grade Level
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gradeLevels.map(level => (
                    <Card key={level.id} className="relative">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="text-center flex-1">
                            <h4 className="font-bold text-lg text-gray-900">{level.stage}</h4>
                            <p className="text-sm text-gray-500 mt-1">{level.grade}</p>
                            <div className="mt-4 text-xs text-gray-400">
                              Created: {new Date(level.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteGradeLevel(level.id, level.stage)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Class Modal */}
      <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleClassSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Class Name</Label>
                <Input 
                  id="name"
                  name="name" 
                  placeholder="e.g., PP1, PP2, PP3, 1A, 2B, etc." 
                  defaultValue={editingClass?.name}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade_level">Grade Level</Label>
                <Select name="grade_level" defaultValue={editingClass?.grade_level} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade level" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueStages.map(stage => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowClassModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                {editingClass ? 'Update' : 'Create'} Class
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Grade Level Modal */}
      <Dialog open={showGradeLevelModal} onOpenChange={setShowGradeLevelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Grade Level</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGradeLevelSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stage">Stage Name</Label>
                <Input 
                  id="stage"
                  name="stage" 
                  placeholder="e.g., Kindergarten, Lower Primary, Upper Primary, Junior Secondary" 
                  required 
                />
                <p className="text-sm text-gray-500">This will be displayed in the class overview and dropdown</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade Description</Label>
                <Input 
                  id="grade"
                  name="grade" 
                  placeholder="e.g., PP1-PP3, Grade 1-3, Grade 4-6, Form 1-3" 
                  required 
                />
                <p className="text-sm text-gray-500">This is for internal reference only</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowGradeLevelModal(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-green-600 hover:bg-green-700"
                disabled={createGradeLevelMutation.isPending}
              >
                {createGradeLevelMutation.isPending ? 'Creating...' : 'Create Grade Level'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subject Modal */}
      <Dialog open={showSubjectModal} onOpenChange={setShowSubjectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubjectSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input 
                  name="name" 
                  placeholder="e.g., Mathematics" 
                  defaultValue={editingSubject?.name}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Subject Code</Label>
                <Input 
                  name="code" 
                  placeholder="e.g., MATH" 
                  defaultValue={editingSubject?.code}
                  required 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSubjectModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                {editingSubject ? 'Update' : 'Create'} Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Subjects Modal - UPDATED with optional subjects */}
      <Dialog open={showAssignSubjectModal} onOpenChange={setShowAssignSubjectModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Assign Subjects to {selectedClass?.name}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Select subjects and mark optional ones for this class
            </p>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              {subjects?.map(subject => {
                const isSelected = selectedSubjects.includes(subject.id);
                const isOptional = optionalSubjects.includes(subject.id);
                
                return (
                  <div key={subject.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded border">
                    <div className="flex items-center space-x-3 flex-1">
                      <Checkbox
                        id={`subject-${subject.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleSubjectSelection(subject.id)}
                      />
                      <Label htmlFor={`subject-${subject.id}`} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{subject.name}</span>
                          <span className="text-sm text-gray-500 ml-4">{subject.code}</span>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`optional-${subject.id}`}
                        checked={isOptional}
                        onCheckedChange={() => handleOptionalToggle(subject.id)}
                        disabled={!isSelected}
                      />
                      <Label 
                        htmlFor={`optional-${subject.id}`} 
                        className={`text-sm ${!isSelected ? 'text-gray-400' : 'text-gray-700'}`}
                      >
                        Optional
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowAssignSubjectModal(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => assignSubjectsMutation.mutate({
                classId: selectedClass?.id,
                subjects: selectedSubjects,
                optionalSubjects: optionalSubjects
              })}
            >
              Assign Subjects
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Detail Modal - Shows Students List */}
      <Dialog open={showClassDetailModal} onOpenChange={setShowClassDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Class: {selectedClass?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Class Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Class Information
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAssignSubjects(selectedClass)}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Manage Subjects
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Grade Level</Label>
                    <p className="text-sm text-gray-600">{getGradeLevelDisplayName(selectedClass?.grade_level)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Student Count</Label>
                    <p className="text-sm text-gray-600">{selectedClass?.studentCount} students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Students List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Students in Class ({classStudents?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStudents ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                    ))}
                  </div>
                ) : classStudents && classStudents.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Registration No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map((student) => (
                          <TableRow key={student.enrollmentId}>
                            <TableCell className="font-mono font-medium">{student.reg_no}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{student.first_name} {student.last_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {student.gender}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveStudent(
                                  student.enrollmentId, 
                                  `${student.first_name} ${student.last_name}`
                                )}
                                title="Remove from class"
                              >
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No students enrolled in this class</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Subjects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assigned Subjects</CardTitle>
              </CardHeader>
              <CardContent>
                {assignedSubjects?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedSubjects.map((assignment) => (
                      <Card key={assignment.id} className="relative">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {assignment.subjects.name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Code: {assignment.subjects.code}
                              </p>
                              {assignment.is_optional && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs mt-1">
                                  Optional
                                </Badge>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleRemoveSubject(
                                assignment.id, 
                                assignment.subjects.name
                              )}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No subjects assigned to this class</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => handleAssignSubjects(selectedClass)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Assign Subjects
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}