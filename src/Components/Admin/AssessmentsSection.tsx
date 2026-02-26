import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
  Plus, ClipboardList, Upload, Loader2, AlertTriangle,
  Eye, Trash2, Users, Calendar, Hash, FileText, X, BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/Components/ui/tabs';
import AssessmentResultsView from './AssessmentResultsView';

// ─── CSV helper ───────────────────────────────────────────────────────────────

const parseCSV = (content) => {
  const delimiter = content.includes('\t') ? '\t' : ',';
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] !== undefined ? values[i].trim() : '';
    });
    return row;
  });
  return { headers, rows };
};

// ─── Category Badge ───────────────────────────────────────────────────────────

type Category = 'summative' | 'formative' | 'portfolio';

function CategoryBadge({ category }: { category: Category }) {
  const styles: Record<Category, string> = {
    summative: 'bg-purple-100 text-purple-800 border-purple-200',
    formative:  'bg-teal-100 text-teal-800 border-teal-200',
    portfolio:  'bg-orange-100 text-orange-800 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold capitalize ${styles[category] || 'bg-gray-100 text-gray-800'}`}>
      {category}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssessmentsSection() {
  const [viewingAssessment, setViewingAssessment] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploadData, setUploadData] = useState({ file: null, date: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<Record<string, { subjects: string[]; count: number }>>({});
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedAssessments, setPublishedAssessments] = useState<Set<string>>(new Set());

  // Create form: strand/sub-strand cascading
  const [createClassId, setCreateClassId]       = useState('');
  const [createCategory, setCreateCategory]     = useState<Category>('summative');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedStrandId, setSelectedStrandId]   = useState('');
  const [availableStrands, setAvailableStrands]   = useState<any[]>([]);
  const [availableSubStrands, setAvailableSubStrands] = useState<any[]>([]);

  // Tab: 'summative' or 'formative'
  const [activeTab, setActiveTab] = useState<'summative' | 'formative'>('summative');

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          classes ( id, name, grade_level ),
          strands ( id, name, code ),
          sub_strands ( id, name, code )
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

  // Strands for selected subject
  useEffect(() => {
    if (!selectedSubjectId) { setAvailableStrands([]); setSelectedStrandId(''); return; }
    supabase.from('strands').select('*').eq('subject_id', selectedSubjectId)
      .then(({ data }) => setAvailableStrands(data || []));
  }, [selectedSubjectId]);

  // Sub-strands for selected strand
  useEffect(() => {
    if (!selectedStrandId) { setAvailableSubStrands([]); return; }
    supabase.from('sub_strands').select('*').eq('strand_id', selectedStrandId)
      .then(({ data }) => setAvailableSubStrands(data || []));
  }, [selectedStrandId]);

  // Draft counts
  useEffect(() => {
    if (!assessments.length) return;
    supabase.from('assessment_results').select('assessment_id, subject_id').eq('status', 'draft')
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Record<string, { subjects: Set<string>; count: number }> = {};
        data.forEach(r => {
          if (!map[r.assessment_id]) map[r.assessment_id] = { subjects: new Set(), count: 0 };
          map[r.assessment_id].subjects.add(r.subject_id);
          map[r.assessment_id].count++;
        });
        const final: Record<string, { subjects: string[]; count: number }> = {};
        Object.keys(map).forEach(k => {
          final[k] = { subjects: Array.from(map[k].subjects), count: map[k].count };
        });
        setDraftData(final);
      });
  }, [assessments]);

  // Derived lists
  const summativeAssessments = assessments.filter(a => a.category === 'summative' || !a.category);
  const formativeAssessments  = assessments.filter(a => a.category === 'formative' || a.category === 'portfolio');

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createAssessmentMutation = useMutation<any, Error, any>({
    mutationFn: async (data) => {
      const { data: res, error } = await supabase.from('assessments').insert([data]);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setShowAddModal(false);
      setCreateClassId('');
      setCreateCategory('summative');
      setSelectedSubjectId('');
      setSelectedStrandId('');
    },
  });

  const deleteAssessmentMutation = useMutation<any, Error, any>({
    mutationFn: async (assessmentId) => {
      const { error: e1 } = await supabase.from('assessment_results').delete().eq('assessment_id', assessmentId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('assessments').delete().eq('id', assessmentId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] });
    },
  });

  const bulkCreateResultsMutation = useMutation<any, Error, any[]>({
    mutationFn: async (rows) => {
      const rowsWithStatus = rows.map(row => ({ ...row, status: 'published' }));
      const { data: res, error } = await supabase.from('assessment_results').insert(rowsWithStatus);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] });
      setUploadTarget(null);
      setUploadData({ file: null, date: '' });
      setIsProcessing(false);
      setUploadError(null);
    },
    onError: () => {
      setUploadError('Failed to upload results. Please check the data and try again.');
      setIsProcessing(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      const { error, data } = await supabase
        .from('assessment_results')
        .update({ status: 'published' })
        .eq('assessment_id', assessmentId)
        .eq('status', 'draft')
        .select();
      if (error) throw error;
      return { assessmentId, count: data?.length || 0 };
    },
    onSuccess: ({ assessmentId }) => {
      setPublishedAssessments(prev => new Set(prev).add(assessmentId));
      setDraftData(prev => { const n = { ...prev }; delete n[assessmentId]; return n; });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setPublishError(null);
    },
    onError: (error: any) => {
      setPublishError(error.message || 'Failed to publish. Please try again.');
    },
  });

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleResultsUpload = async () => {
    if (!uploadData.file) return setUploadError('Please select a CSV file.');
    setIsProcessing(true);
    setUploadError(null);
    try {
      const fileContent = await uploadData.file.text();
      const { headers, rows } = parseCSV(fileContent);
      if (rows.length === 0) throw new Error('CSV file appears empty or misformatted.');

      const fixedCols = ['assessment_title','Assessment_Title','student_reg_no','Student_Reg_No','Reg_no','reg_no','name','Name'];
      const subjectCols = headers.filter(h => !fixedCols.includes(h?.trim()));
      if (subjectCols.length === 0) throw new Error('No subject columns found.');

      const assessmentMap = new Map(assessments.map(a => [a.title?.trim().toLowerCase(), a.id]));
      const studentMap    = new Map(students.map(s => [s.Reg_no?.trim().toLowerCase() || s.reg_no?.trim().toLowerCase(), s.id]));
      const subjectMap    = new Map(subjects.map(s => [s.code?.trim().toLowerCase(), s.id]));

      const recordsToInsert: any[] = [];
      for (const row of rows) {
        const title = row['Assessment_Title']?.trim() || row['assessment_title']?.trim();
        const studentRegNo = row['Reg_no']?.trim() || row['Student_Reg_No']?.trim() || row['student_reg_no']?.trim();
        if (!title || !studentRegNo) continue;

        const assessment_id = assessmentMap.get(title.toLowerCase());
        const student_id    = studentMap.get(studentRegNo.toLowerCase());
        if (!assessment_id || !student_id) continue;

        for (const col of subjectCols) {
          const scoreStr = row[col];
          if (!scoreStr) continue;
          const score = parseFloat(scoreStr);
          if (isNaN(score)) continue;
          const subject_id = subjectMap.get(col.trim().toLowerCase());
          if (!subject_id) continue;
          recordsToInsert.push({ assessment_id, student_id, subject_id, score, assessment_date: uploadData.date, updated_at: new Date() });
        }
      }

      if (!recordsToInsert.length) throw new Error('No valid results found. Verify subject codes and Reg_no.');
      await bulkCreateResultsMutation.mutateAsync(recordsToInsert);
    } catch (err: any) {
      setUploadError(err.message || 'Unexpected error during upload.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Form submit ────────────────────────────────────────────────────────────

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd   = new FormData(form);
    const raw  = Object.fromEntries(fd.entries()) as Record<string, any>;

    const payload: Record<string, any> = {
      title:    raw.title,
      class_id: raw.class_id,
      term:     parseInt(raw.term),
      year:     parseInt(raw.year),
      category: raw.category || 'summative',
      max_marks: parseInt(raw.max_marks) || 100,
    };

    if (raw.assessment_date) payload.assessment_date = raw.assessment_date;

    // Optional strand/sub-strand (only relevant if user picked them)
    if (selectedSubjectId)  payload.subject_id    = selectedSubjectId;
    if (selectedStrandId)   payload.strand_id     = selectedStrandId;
    if (raw.sub_strand_id && raw.sub_strand_id !== '__none__') payload.sub_strand_id = raw.sub_strand_id;

    createAssessmentMutation.mutate(payload);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getClassName = (classId) => classes.find(c => c.id === classId)?.name || 'N/A';

  const getTermBadgeColor = (term) => {
    switch (typeof term === 'number' ? `Term ${term}` : term) {
      case 'Term 1': return 'bg-blue-100 text-blue-800';
      case 'Term 2': return 'bg-green-100 text-green-800';
      case 'Term 3': return 'bg-purple-100 text-purple-800';
      default:       return 'bg-gray-100 text-gray-800';
    }
  };

  const confirmDelete = (a) => {
    if (window.confirm(`Delete "${a.title}"? This will also delete all results.`)) {
      deleteAssessmentMutation.mutate(a.id);
    }
  };

  // ── Row renderers ──────────────────────────────────────────────────────────

  const renderDraftStatus = (a) => {
    const hasDrafts  = draftData[a.id]?.count > 0;
    const isPublished = publishedAssessments.has(a.id) || (!hasDrafts && !(a.id in draftData));
    return { hasDrafts, isPublished };
  };

  // Summative table row
  const SummativeRow = ({ a }) => {
    const { hasDrafts, isPublished } = renderDraftStatus(a);
    return (
      <TableRow>
        <TableCell className="font-medium py-3">
          <div>{a.title}</div>
          {a.strands && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> {a.strands?.name}
              {a.sub_strands && <> › {a.sub_strands?.name}</>}
            </div>
          )}
        </TableCell>
        <TableCell className="py-3">
          <div>{a.classes?.name || getClassName(a.class_id)}</div>
          <div className="text-xs text-gray-500">Grade {a.classes?.grade_level || 'N/A'}</div>
        </TableCell>
        <TableCell className="py-3">
          <Badge className={getTermBadgeColor(a.term)}>
            {typeof a.term === 'number' ? `Term ${a.term}` : a.term}
          </Badge>
        </TableCell>
        <TableCell className="py-3">{a.year}</TableCell>
        <TableCell className="py-3">{a.max_marks ?? 100}</TableCell>
        <TableCell className="py-3">
          {hasDrafts ? (
            <div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{draftData[a.id].count} drafts</Badge>
              <div className="text-xs mt-1 text-muted-foreground">{draftData[a.id].subjects.length} subject(s)</div>
            </div>
          ) : isPublished ? (
            <Badge variant="outline" className="bg-green-100 text-green-800">Published</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No results</span>
          )}
        </TableCell>
        <TableCell className="py-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewingAssessment(a)} className="h-8">
              <Eye className="w-3 h-3 mr-1" /> View
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setUploadTarget(a); setUploadError(null); setUploadData({ file: null, date: '' }); }} className="h-8">
              <Upload className="w-3 h-3 mr-1" /> Upload
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => publishMutation.mutate(a.id)}
              disabled={!hasDrafts || publishMutation.isPending || isPublished}
              className={`h-8 ${isPublished ? 'text-green-600' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
            >
              {publishMutation.isPending && publishMutation.variables === a.id ? 'Publishing...' : isPublished ? 'Published' : 'Publish'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => confirmDelete(a)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Formative table row — read-only, no publish/upload
  const FormativeRow = ({ a }) => {
    const { hasDrafts, isPublished } = renderDraftStatus(a);
    return (
      <TableRow>
        <TableCell className="font-medium py-3">
          <div className="flex items-center gap-2">
            {a.title}
            <CategoryBadge category={a.category} />
          </div>
          {a.strands && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> {a.strands?.name}
              {a.sub_strands && <> › {a.sub_strands?.name}</>}
            </div>
          )}
        </TableCell>
        <TableCell className="py-3">
          <div>{a.classes?.name || getClassName(a.class_id)}</div>
          <div className="text-xs text-gray-500">Grade {a.classes?.grade_level || 'N/A'}</div>
        </TableCell>
        <TableCell className="py-3">
          <Badge className={getTermBadgeColor(a.term)}>
            {typeof a.term === 'number' ? `Term ${a.term}` : a.term}
          </Badge>
        </TableCell>
        <TableCell className="py-3">{a.year}</TableCell>
        <TableCell className="py-3">
          {hasDrafts ? (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{draftData[a.id].count} entries</Badge>
          ) : isPublished ? (
            <Badge variant="outline" className="bg-green-100 text-green-800">Published</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No entries</span>
          )}
        </TableCell>
        <TableCell className="py-3">
          {/* Read-only: admin can only view */}
          <Button variant="outline" size="sm" onClick={() => setViewingAssessment(a)} className="h-8">
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  // Mobile card — summative
  const SummativeMobileCard = ({ a }) => {
    const { hasDrafts, isPublished } = renderDraftStatus(a);
    return (
      <Card className="p-4 shadow-xs">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="font-medium text-base mb-1 truncate">{a.title}</div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Users className="w-3 h-3" /> {a.classes?.name || getClassName(a.class_id)}
            </div>
            {a.strands && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {a.strands?.name}
              </div>
            )}
          </div>
          <Badge className={`${getTermBadgeColor(a.term)} text-xs`}>
            {typeof a.term === 'number' ? `Term ${a.term}` : a.term}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div className="flex items-center gap-2"><Hash className="w-3 h-3 text-gray-500" /><span>Year: {a.year}</span></div>
          <div className="flex items-center gap-2"><Calendar className="w-3 h-3 text-gray-500" /><span>Grade {a.classes?.grade_level || 'N/A'}</span></div>
          <div className="flex items-center gap-2 col-span-2"><span className="text-muted-foreground">Max marks:</span><strong>{a.max_marks ?? 100}</strong></div>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs border-t pt-2">
          <div>
            {hasDrafts ? (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{draftData[a.id].count} draft(s)</Badge>
            ) : isPublished ? (
              <Badge variant="outline" className="bg-green-100 text-green-800">Published</Badge>
            ) : (
              <span className="text-muted-foreground">No drafts</span>
            )}
          </div>
          <Button variant="outline" size="sm"
            onClick={() => publishMutation.mutate(a.id)}
            disabled={!hasDrafts || publishMutation.isPending || isPublished}
            className={`h-7 text-xs ${isPublished ? 'text-green-600' : 'text-green-600'}`}
          >
            {publishMutation.isPending && publishMutation.variables === a.id ? 'Publishing...' : isPublished ? 'Published' : 'Publish'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-3">
          <Button variant="outline" size="sm" onClick={() => setViewingAssessment(a)} className="h-8 flex-1 min-w-[80px]">
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setUploadTarget(a); setUploadError(null); setUploadData({ file: null, date: '' }); }} className="h-8 flex-1 min-w-[80px]">
            <Upload className="w-3 h-3 mr-1" /> Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => confirmDelete(a)} className="h-8 flex-1 min-w-[80px] text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </div>
      </Card>
    );
  };

  // Mobile card — formative (read-only)
  const FormativeMobileCard = ({ a }) => {
    const { hasDrafts, isPublished } = renderDraftStatus(a);
    return (
      <Card className="p-4 shadow-xs border-l-4 border-l-teal-400">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-base truncate">{a.title}</span>
              <CategoryBadge category={a.category} />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="w-3 h-3" /> {a.classes?.name || getClassName(a.class_id)}
            </div>
            {a.strands && (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {a.strands?.name}
                {a.sub_strands && <> › {a.sub_strands?.name}</>}
              </div>
            )}
          </div>
          <Badge className={`${getTermBadgeColor(a.term)} text-xs`}>
            {typeof a.term === 'number' ? `Term ${a.term}` : a.term}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs border-t pt-2 mt-2">
          <div>
            {hasDrafts ? (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{draftData[a.id].count} entries</Badge>
            ) : isPublished ? (
              <Badge variant="outline" className="bg-green-100 text-green-800">Published</Badge>
            ) : (
              <span className="text-muted-foreground">No entries</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setViewingAssessment(a)} className="h-7 text-xs">
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
        </div>
      </Card>
    );
  };

  // ── Early return: viewing results ──────────────────────────────────────────

  if (viewingAssessment)
    return <AssessmentResultsView assessment={viewingAssessment} onBack={() => setViewingAssessment(null)} />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              <span className="text-lg sm:text-2xl">Assessments</span>
            </CardTitle>
            <Button onClick={() => setShowAddModal(true)} className="bg-orange-600 hover:bg-orange-700 h-10 sm:h-auto" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Create Assessment</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="summative">
                Exams / Summative
                <Badge className="ml-2 bg-purple-100 text-purple-800 border-purple-200 text-xs">{summativeAssessments.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="formative">
                Formative / Portfolio
                <Badge className="ml-2 bg-teal-100 text-teal-800 border-teal-200 text-xs">{formativeAssessments.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Summative tab ── */}
            <TabsContent value="summative">
              {/* Mobile */}
              <div className="sm:hidden space-y-3">
                {summativeAssessments.length === 0 ? (
                  <EmptyState />
                ) : summativeAssessments.map(a => <SummativeMobileCard key={a.id} a={a} />)}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Max Marks</TableHead>
                      <TableHead>Drafts</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summativeAssessments.map(a => <SummativeRow key={a.id} a={a} />)}
                  </TableBody>
                </Table>
                {summativeAssessments.length === 0 && <EmptyState />}
              </div>
            </TabsContent>

            {/* ── Formative / Portfolio tab ── */}
            <TabsContent value="formative">
              <div className="mb-3 p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-start gap-2">
                <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Formative and portfolio assessments are created and managed by teachers. You can view entries but cannot edit them.</span>
              </div>
              {/* Mobile */}
              <div className="sm:hidden space-y-3">
                {formativeAssessments.length === 0 ? (
                  <EmptyFormativeState />
                ) : formativeAssessments.map(a => <FormativeMobileCard key={a.id} a={a} />)}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formativeAssessments.map(a => <FormativeRow key={a.id} a={a} />)}
                  </TableBody>
                </Table>
                {formativeAssessments.length === 0 && <EmptyFormativeState />}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Create Assessment Dialog ── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">Create New Assessment</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Create a summative exam. Teachers manage their own formative and portfolio assessments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="grid gap-3 sm:gap-4 py-2">

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Assessment Title *</Label>
                <Input id="title" name="title" required placeholder="e.g., End Term 1 Maths Exam" />
              </div>

              {/* Category and Max Marks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select name="category" required defaultValue="summative" onValueChange={(v) => setCreateCategory(v as Category)}>
                    <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summative">Summative (Exam)</SelectItem>
                      <SelectItem value="formative">Formative (Activity)</SelectItem>
                      <SelectItem value="portfolio">Portfolio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_marks">Max Marks *</Label>
                  <Input id="max_marks" name="max_marks" type="number" defaultValue="100" required min="1" />
                </div>
              </div>

              {/* Class */}
              <div className="space-y-2">
                <Label htmlFor="class_id">Class *</Label>
                <Select name="class_id" required onValueChange={setCreateClassId}>
                  <SelectTrigger id="class_id"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name} (Grade {cls.grade_level})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Strand / Sub-strand (optional) — requires subject selection for filtering */}
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Strand (optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="filter_subject" className="text-xs">Filter by Subject</Label>
                    <Select onValueChange={setSelectedSubjectId}>
                      <SelectTrigger id="filter_subject"><SelectValue placeholder="Subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="strand_id" className="text-xs">Strand</Label>
                    <Select name="strand_id" disabled={!selectedSubjectId} onValueChange={setSelectedStrandId}>
                      <SelectTrigger id="strand_id"><SelectValue placeholder="Strand" /></SelectTrigger>
                      <SelectContent>
                        {availableStrands.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub_strand_id" className="text-xs">Sub-strand</Label>
                    <Select name="sub_strand_id" disabled={!selectedStrandId}>
                      <SelectTrigger id="sub_strand_id"><SelectValue placeholder="Sub-strand" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {availableSubStrands.map(ss => (
                          <SelectItem key={ss.id} value={ss.id}>{ss.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Term and Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="term">Term *</Label>
                  <Input id="term" name="term" type="number" min="1" max="3" required placeholder="1, 2, or 3" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input id="year" name="year" type="number" required defaultValue={new Date().getFullYear()} />
                </div>
              </div>

              {/* Optional date */}
              <div className="space-y-2">
                <Label htmlFor="assessment_date">Assessment Date (optional)</Label>
                <Input id="assessment_date" name="assessment_date" type="date" />
              </div>
            </div>

            {createAssessmentMutation.isError && (
              <div className="mt-2 p-2 rounded bg-red-50 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Failed to create assessment. Please try again.
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" disabled={createAssessmentMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                {createAssessmentMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Assessment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Upload Results Dialog ── */}
      <Dialog open={!!uploadTarget} onOpenChange={() => setUploadTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-lg sm:text-xl">Upload Results — {uploadTarget?.title}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm mt-2">
                  Example columns:<br />
                  <strong>Assessment_Title, Student_Reg_No, Name, ENG_JS, MATH_JS, AGR_JS</strong><br />
                  Supports commas or tabs. Max marks are read from the assessment record.
                  <span className="block mt-1 text-yellow-600">Uploaded results are published immediately.</span>
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setUploadTarget(null)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-date">Date *</Label>
              <Input id="upload-date" type="date" value={uploadData.date} onChange={(e) => setUploadData(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File *</Label>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500 shrink-0" />
                <Input id="csv-file" type="file" accept=".csv,.txt" onChange={(e) => setUploadData(p => ({ ...p, file: e.target.files[0] }))} />
              </div>
              <p className="text-xs text-gray-500">Supported: CSV or TXT, comma or tab delimited</p>
            </div>
            {uploadError && (
              <div className="flex items-start p-3 text-sm text-red-800 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                {uploadError}
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setUploadTarget(null)}>Cancel</Button>
            <Button disabled={!uploadData.file || !uploadData.date || isProcessing} onClick={handleResultsUpload} className="bg-green-600 hover:bg-green-700">
              {isProcessing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                : <><Upload className="w-4 h-4 mr-2" /> Upload & Publish</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Publish error toast ── */}
      {publishError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 max-w-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="text-sm">{publishError}</span>
            <button onClick={() => setPublishError(null)} className="ml-4">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-8 text-gray-500">
      <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
      <p>No assessments found</p>
      <p className="text-sm text-gray-400 mt-1">Create your first assessment</p>
    </div>
  );
}

function EmptyFormativeState() {
  return (
    <div className="text-center py-8 text-gray-500">
      <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-2" />
      <p>No formative assessments yet</p>
      <p className="text-sm text-gray-400 mt-1">These will appear here when teachers record class activities</p>
    </div>
  );
}