import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
  Plus, ClipboardList, Upload, Loader2, AlertTriangle,
  Eye, Trash2, Users, Hash, FileText, X, BookOpen, CalendarDays, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/Components/ui/tabs';
import AssessmentResultsView from './AssessmentResultsView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveTerm {
  id: string;
  academic_year: string;
  term: number;
  start_date: string;
  end_date: string;
}

type Category = 'summative' | 'formative' | 'portfolio';

// ─── CSV helper ───────────────────────────────────────────────────────────────

const parseCSV = (content: string) => {
  const delimiter = content.includes('\t') ? '\t' : ',';
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] !== undefined ? values[i].trim() : ''; });
    return row;
  });
  return { headers, rows };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const termBadgeColor = (term: number | string) => {
  const t = Number(term);
  if (t === 1) return 'bg-blue-100 text-blue-800';
  if (t === 2) return 'bg-green-100 text-green-800';
  if (t === 3) return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-800';
};

// ─── Sub-components (defined OUTSIDE parent to prevent re-creation on render) ─

function CategoryBadge({ category }: { category: Category }) {
  const styles: Record<Category, string> = {
    summative: 'bg-purple-100 text-purple-800 border-purple-200',
    formative:  'bg-teal-100 text-teal-800 border-teal-200',
    portfolio:  'bg-orange-100 text-orange-800 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold capitalize ${styles[category] ?? 'bg-gray-100 text-gray-800'}`}>
      {category}
    </span>
  );
}

function ActiveTermBanner({ term }: { term: ActiveTerm | null | undefined }) {
  if (term === undefined) {
    return (
      <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading active term…
      </div>
    );
  }
  if (!term) {
    return (
      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        No active term found. Please activate a term in <strong>Academic Calendar</strong> before creating assessments.
      </div>
    );
  }
  return (
    <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      <span className="text-blue-700">
        Active Term: <strong>Term {term.term}, {term.academic_year}</strong>
        <span className="ml-2 text-blue-500 font-normal">
          ({fmtDate(term.start_date)} → {fmtDate(term.end_date)})
        </span>
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10 text-gray-400">
      <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-30" />
      <p className="font-medium text-gray-500">No assessments yet</p>
      <p className="text-sm mt-1">Click <strong>Create Assessment</strong> above to add one.</p>
    </div>
  );
}

function EmptyFormativeState() {
  return (
    <div className="text-center py-10 text-gray-400">
      <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
      <p className="font-medium text-gray-500">No formative assessments yet</p>
      <p className="text-sm mt-1">These appear here when teachers record class activities.</p>
    </div>
  );
}

// ─── Typed props for row/card sub-components ──────────────────────────────────

interface RowProps {
  a: any;
  getClassName: (id: string) => string;
  getStatus: (id: string) => { hasDrafts: boolean; isPublished: boolean; draftCount: number };
  onView: (a: any) => void;
  onUpload: (a: any) => void;
  onPublish: (id: string) => void;
  onDelete: (a: any) => void;
  publishingId: string | null;
}

function StatusBadge({
  id,
  draftLabel = 'drafts',
  getStatus,
}: {
  id: string;
  draftLabel?: string;
  getStatus: (id: string) => { hasDrafts: boolean; isPublished: boolean; draftCount: number };
}) {
  const { hasDrafts, isPublished, draftCount } = getStatus(id);
  if (hasDrafts)   return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{draftCount} {draftLabel}</Badge>;
  if (isPublished) return <Badge variant="outline" className="bg-green-100 text-green-800">Published</Badge>;
  return <span className="text-muted-foreground text-sm">No results</span>;
}

function SummativeRow({ a, getClassName, getStatus, onView, onUpload, onPublish, onDelete, publishingId }: RowProps) {
  const { hasDrafts, isPublished } = getStatus(a.id);
  const isPublishingThis = publishingId === a.id;
  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="font-medium">{a.title}</div>
        {a.assessment_date && (
          <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> {fmtDate(a.assessment_date)}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3">
        <div>{a.classes?.name ?? getClassName(a.class_id)}</div>
        <div className="text-xs text-gray-500">Grade {a.classes?.grade_level ?? 'N/A'}</div>
      </TableCell>
      <TableCell className="py-3"><Badge className={termBadgeColor(a.term)}>Term {a.term}</Badge></TableCell>
      <TableCell className="py-3">{a.year}-{a.year + 1}</TableCell>
      <TableCell className="py-3">{a.max_marks ?? 100}</TableCell>
      <TableCell className="py-3"><StatusBadge id={a.id} getStatus={getStatus} /></TableCell>
      <TableCell className="py-3">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8" onClick={() => onView(a)}>
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onUpload(a)}>
            <Upload className="w-3 h-3 mr-1" /> Upload
          </Button>
          <Button
            variant="outline" size="sm" className="h-8 text-green-600 hover:bg-green-50"
            onClick={() => onPublish(a.id)}
            disabled={!hasDrafts || isPublishingThis}
          >
            {isPublishingThis ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-red-600 hover:bg-red-50" onClick={() => onDelete(a)}>
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function FormativeRow({ a, getStatus, onView }: Pick<RowProps, 'a' | 'getStatus' | 'onView'>) {
  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{a.title}</span>
          <CategoryBadge category={a.category} />
        </div>
        {a.strands && (
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {a.strands?.name}{a.sub_strands && <> › {a.sub_strands?.name}</>}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3"><Badge className={termBadgeColor(a.term)}>Term {a.term}</Badge></TableCell>
      <TableCell className="py-3">{a.year}-{a.year + 1}</TableCell>
      <TableCell className="py-3"><StatusBadge id={a.id} draftLabel="entries" getStatus={getStatus} /></TableCell>
      <TableCell className="py-3">
        <Button variant="outline" size="sm" className="h-8" onClick={() => onView(a)}>
          <Eye className="w-3 h-3 mr-1" /> View
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SummativeMobileCard({ a, getClassName, getStatus, onView, onUpload, onPublish, onDelete, publishingId }: RowProps) {
  const { hasDrafts, isPublished, draftCount } = getStatus(a.id);
  const isPublishingThis = publishingId === a.id;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium text-base mb-1 truncate">{a.title}</div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Users className="w-3 h-3" /> {a.classes?.name ?? getClassName(a.class_id)}
          </div>
          {a.assessment_date && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <CalendarDays className="w-3 h-3" /> {fmtDate(a.assessment_date)}
            </div>
          )}
        </div>
        <Badge className={`${termBadgeColor(a.term)} text-xs`}>Term {a.term}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-1"><Hash className="w-3 h-3 text-gray-400" /> Academic Year: {a.year}-{a.year + 1}</div>
        <div>Max: <strong>{a.max_marks ?? 100}</strong></div>
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        <div>
          {hasDrafts
            ? <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">{draftCount} draft(s)</Badge>
            : isPublished
            ? <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">Published</Badge>
            : <span className="text-xs text-muted-foreground">No results</span>}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs text-green-600"
          onClick={() => onPublish(a.id)} disabled={!hasDrafts || isPublishingThis}>
          {isPublishingThis ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 pt-3">
        <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => onView(a)}>
          <Eye className="w-3 h-3 mr-1" /> View
        </Button>
        <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => onUpload(a)}>
          <Upload className="w-3 h-3 mr-1" /> Upload
        </Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 text-red-600 hover:bg-red-50" onClick={() => onDelete(a)}>
          <Trash2 className="w-3 h-3 mr-1" /> Delete
        </Button>
      </div>
    </Card>
  );
}

function FormativeMobileCard({ a, getStatus, onView }: Pick<RowProps, 'a' | 'getStatus' | 'onView'>) {
  const { hasDrafts, isPublished, draftCount } = getStatus(a.id);
  return (
    <Card className="p-4 border-l-4 border-l-teal-400">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{a.title}</span>
            <CategoryBadge category={a.category} />
          </div>
        </div>
        <Badge className={`${termBadgeColor(a.term)} text-xs`}>Term {a.term}</Badge>
      </div>
      <div className="flex items-center justify-between border-t pt-2 mt-2">
        <div>
          {hasDrafts
            ? <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">{draftCount} entries</Badge>
            : isPublished
            ? <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">Published</Badge>
            : <span className="text-xs text-muted-foreground">No entries</span>}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onView(a)}>
          <Eye className="w-3 h-3 mr-1" /> View
        </Button>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssessmentsSection() {
  const [viewingAssessment, setViewingAssessment] = useState<any>(null);
  const [showAddModal, setShowAddModal]           = useState(false);
  const [uploadTarget, setUploadTarget]           = useState<any>(null);
  const [uploadFile, setUploadFile]               = useState<File | null>(null);
  const [isProcessing, setIsProcessing]           = useState(false);
  const [uploadError, setUploadError]             = useState<string | null>(null);
  const [publishError, setPublishError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]                 = useState<'summative' | 'formative'>('summative');
  const [formError, setFormError]                 = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses]     = useState<Set<string>>(new Set());
  const [publishingId, setPublishingId]           = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget]           = useState<any>(null);

  const queryClient = useQueryClient();

  // ── Active Term ────────────────────────────────────────────────────────────

  const { data: activeTerm, isLoading: termLoading } = useQuery<ActiveTerm | null>({
    queryKey: ['activeTerm'],
    // FIX: No staleTime — always considered stale so it refetches on every mount.
    // This ensures the banner is accurate when switching tabs or after logout.
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_calendar')
        .select('id, academic_year, term, start_date, end_date')
        .eq('is_current', true)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  // ── Data Queries ───────────────────────────────────────────────────────────

  const { data: assessments = [], isLoading: assessmentsLoading } = useQuery({
    queryKey: ['assessments'],
    // FIX: Removed staleTime entirely. React Query defaults to staleTime: 0,
    // meaning data is always refetched on component mount. This is the root cause
    // of the "no assessments" bug — with staleTime: 2min, remounting after a tab
    // switch served a now-empty cache without triggering a refetch, so assessments
    // appeared blank until the stale window expired.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          classes(id, name, grade_level),
          strands(id, name, code),
          sub_strands(id, name, code)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    staleTime: 10 * 60 * 1000, // 10 min — classes genuinely change infrequently
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Students & subjects are ONLY fetched when the upload modal is open — saves reads.
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    staleTime: 10 * 60 * 1000,
    enabled: !!uploadTarget,
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    staleTime: 10 * 60 * 1000,
    enabled: !!uploadTarget,
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Result status map ──────────────────────────────────────────────────────
  // Kept as useState + useCallback — useQuery caused a race condition where the
  // cache returned empty {} before assessments resolved, making all badges show
  // "No results". The manual fetch below is triggered reactively off assessments.

  const [resultStatusMap, setResultStatusMap] = useState<Record<string, { drafts: number; published: number }>>({});
  // FIX: Track whether we've done at least one successful fetch so we can show
  // a loading skeleton rather than "No results" on first mount.
  const [statusMapLoading, setStatusMapLoading] = useState(true);

  const fetchResultStatusMap = useCallback(async () => {
    let allData: { assessment_id: string; status: string }[] = [];
    let start = 0;
    const limit = 1000;
    const maxPages = 5; // cap at 5 000 rows — protects free-tier quota
    let page = 0;

    while (page < maxPages) {
      const { data, error } = await supabase
        .from('assessment_results')
        .select('assessment_id, status')
        .range(start, start + limit - 1);
      if (error) { console.error('Error fetching result statuses:', error); break; }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < limit) break;
      start += limit;
      page++;
    }

    const map: Record<string, { drafts: number; published: number }> = {};
    allData.forEach(r => {
      if (!map[r.assessment_id]) map[r.assessment_id] = { drafts: 0, published: 0 };
      if (r.status === 'draft') map[r.assessment_id].drafts++;
      else if (r.status === 'published') map[r.assessment_id].published++;
    });
    setResultStatusMap(map);
    setStatusMapLoading(false);
  }, []);

  // FIX: Run fetchResultStatusMap whenever the assessments list changes (including
  // on first mount after a tab switch). Previously gated on assessments.length > 0,
  // which meant an empty-cache remount never triggered the fetch, leaving the map
  // stale/empty. We now run it unconditionally once assessments have finished loading.
  useEffect(() => {
    if (!assessmentsLoading) {
      fetchResultStatusMap();
    }
  }, [assessmentsLoading, fetchResultStatusMap]);

  // Refresh status map when returning from the results detail view.
  useEffect(() => {
    if (!viewingAssessment) {
      fetchResultStatusMap();
    }
  }, [viewingAssessment, fetchResultStatusMap]);

  // ── Status helper ──────────────────────────────────────────────────────────

  const getStatus = useCallback((assessmentId: string) => {
    const entry = resultStatusMap[assessmentId];
    if (!entry) return { hasDrafts: false, isPublished: false, draftCount: 0 };
    return {
      hasDrafts:   entry.drafts > 0,
      isPublished: entry.drafts === 0 && entry.published > 0,
      draftCount:  entry.drafts,
    };
  }, [resultStatusMap]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const summativeAssessments = assessments.filter((a: any) => a.category === 'summative' || !a.category);
  const formativeAssessments  = assessments.filter((a: any) => a.category === 'formative' || a.category === 'portfolio');

  // Group formative by class
  const formativeByClass: Record<string, { className: string; gradeLevel: string; items: any[] }> = {};
  formativeAssessments.forEach((a: any) => {
    const classId    = a.class_id;
    const className  = a.classes?.name ?? (classes as any[]).find(c => c.id === classId)?.name ?? 'Unknown Class';
    const gradeLevel = a.classes?.grade_level ?? (classes as any[]).find(c => c.id === classId)?.grade_level ?? '';
    if (!formativeByClass[classId]) formativeByClass[classId] = { className, gradeLevel, items: [] };
    formativeByClass[classId].items.push(a);
  });

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      next.has(classId) ? next.delete(classId) : next.add(classId);
      return next;
    });
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createAssessmentMutation = useMutation<any, Error, any>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from('assessments').insert([payload]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setShowAddModal(false);
      setFormError(null);
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteAssessmentMutation = useMutation<any, Error, string>({
    mutationFn: async (assessmentId) => {
      const { error: e1 } = await supabase.from('assessment_results').delete().eq('assessment_id', assessmentId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('assessments').delete().eq('id', assessmentId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] });
      fetchResultStatusMap();
    },
  });

  const bulkCreateResultsMutation = useMutation<any, Error, any[]>({
    mutationFn: async (rows) => {
      const { data, error } = await supabase
        .from('assessment_results')
        .insert(rows.map(r => ({ ...r, status: 'published' })));
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] });
      fetchResultStatusMap();
      setUploadTarget(null);
      setUploadFile(null);
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
      return { assessmentId, count: data?.length ?? 0 };
    },
    onMutate: (assessmentId) => {
      setPublishingId(assessmentId);
    },
    onSuccess: ({ assessmentId }) => {
      // Optimistically update local map — no need to wait for a full refetch.
      setResultStatusMap(prev => {
        const entry = prev[assessmentId];
        if (!entry) return prev;
        return { ...prev, [assessmentId]: { drafts: 0, published: entry.published + entry.drafts } };
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setPublishError(null);
      setPublishingId(null);
    },
    onError: (err: any) => {
      setPublishError(err.message || 'Failed to publish. Please try again.');
      setPublishingId(null);
    },
  });

  // ── Create form submit ─────────────────────────────────────────────────────

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!activeTerm) { setFormError('No active term. Please activate a term in Academic Calendar first.'); return; }

    const fd  = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries()) as Record<string, string>;

    if (!raw.assessment_date) { setFormError('Please set the assessment date.'); return; }
    if (raw.assessment_date < activeTerm.start_date || raw.assessment_date > activeTerm.end_date) {
      setFormError(`Date must be within the active term window (${fmtDate(activeTerm.start_date)} – ${fmtDate(activeTerm.end_date)}).`);
      return;
    }

    const termYear = parseInt(activeTerm.academic_year.split('-')[0]);
    createAssessmentMutation.mutate({
      title:           raw.title.trim(),
      class_id:        raw.class_id,
      term:            activeTerm.term,
      year:            termYear,
      category:        'summative',
      max_marks:       parseInt(raw.max_marks) || 100,
      assessment_date: raw.assessment_date,
    });
  };

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleResultsUpload = async () => {
    if (!uploadFile) { setUploadError('Please select a CSV file.'); return; }
    const assessmentDate = uploadTarget?.assessment_date;
    if (!assessmentDate) { setUploadError('This assessment has no date. Delete and recreate it with a date.'); return; }

    setIsProcessing(true);
    setUploadError(null);

    try {
      const { headers, rows } = parseCSV(await uploadFile.text());
      if (!rows.length) throw new Error('CSV appears empty or misformatted.');

      const FIXED_COLS = new Set(['assessment_title','Assessment_Title','student_reg_no','Student_Reg_No','Reg_no','reg_no','name','Name']);
      const subjectCols = headers.filter(h => !FIXED_COLS.has(h.trim()));
      if (!subjectCols.length) throw new Error('No subject columns found.');

      const assessmentMap = new Map(assessments.map((a: any) => [a.title?.trim().toLowerCase(), a.id]));
      const studentMap    = new Map(students.map((s: any)  => [(s.Reg_no ?? s.reg_no)?.trim().toLowerCase(), s.id]));
      const subjectMap    = new Map(subjects.map((s: any)  => [s.code?.trim().toLowerCase(), s.id]));

      const records: any[] = [];
      for (const row of rows) {
        const title        = (row['Assessment_Title'] ?? row['assessment_title'])?.trim();
        const studentRegNo = (row['Reg_no'] ?? row['Student_Reg_No'] ?? row['student_reg_no'])?.trim();
        if (!title || !studentRegNo) continue;
        const assessment_id = assessmentMap.get(title.toLowerCase());
        const student_id    = studentMap.get(studentRegNo.toLowerCase());
        if (!assessment_id || !student_id) continue;
        for (const col of subjectCols) {
          const score = parseFloat(row[col]);
          if (isNaN(score)) continue;
          const subject_id = subjectMap.get(col.trim().toLowerCase());
          if (!subject_id) continue;
          records.push({ assessment_id, student_id, subject_id, score, assessment_date: assessmentDate, updated_at: new Date().toISOString() });
        }
      }

      if (!records.length) throw new Error('No valid results found. Check subject codes and Reg_no values.');
      await bulkCreateResultsMutation.mutateAsync(records);
    } catch (err: any) {
      setUploadError(err.message || 'Unexpected error during upload.');
      setIsProcessing(false);
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const getClassName = useCallback(
    (classId: string) => (classes as any[]).find(c => c.id === classId)?.name ?? 'N/A',
    [classes]
  );

  const handleView    = useCallback((a: any) => setViewingAssessment(a), []);
  const handleUpload  = useCallback((a: any) => { setUploadTarget(a); setUploadFile(null); setUploadError(null); }, []);
  const handlePublish = useCallback((id: string) => publishMutation.mutate(id), []);
  const confirmDelete = useCallback((a: any) => setDeleteTarget(a), []);

  // ── Early-return: viewing results ──────────────────────────────────────────

  if (viewingAssessment)
    return (
      <AssessmentResultsView
        assessment={viewingAssessment}
        onBack={() => setViewingAssessment(null)}
      />
    );

  // ── Render ─────────────────────────────────────────────────────────────────

  // FIX: Show a loading state while assessments are being fetched on mount.
  // Previously, an empty assessments array during the loading window caused
  // the EmptyState component to flash briefly, which was confusing.
  const isInitialLoad = assessmentsLoading || statusMapLoading;

  return (
    <div className="space-y-4 sm:space-y-6">

      <ActiveTermBanner term={termLoading ? undefined : activeTerm} />

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              Assessments
            </CardTitle>
            <Button
              onClick={() => { setShowAddModal(true); setFormError(null); }}
              disabled={!activeTerm}
              title={!activeTerm ? 'Activate a term first' : undefined}
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
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
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

            {/* ── Summative tab ─────────────────────────────────────────────── */}
            <TabsContent value="summative">
              {isInitialLoad ? (
                // FIX: Skeleton loader prevents the empty-state flash on mount/remount.
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="sm:hidden space-y-3">
                    {summativeAssessments.length === 0
                      ? <EmptyState />
                      : summativeAssessments.map((a: any) => (
                        <SummativeMobileCard
                          key={a.id} a={a}
                          getClassName={getClassName} getStatus={getStatus}
                          onView={handleView} onUpload={handleUpload}
                          onPublish={handlePublish} onDelete={confirmDelete}
                          publishingId={publishingId}
                        />
                      ))}
                  </div>
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title / Date</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead>Academic Year</TableHead>
                          <TableHead>Max Marks</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summativeAssessments.map((a: any) => (
                          <SummativeRow
                            key={a.id} a={a}
                            getClassName={getClassName} getStatus={getStatus}
                            onView={handleView} onUpload={handleUpload}
                            onPublish={handlePublish} onDelete={confirmDelete}
                            publishingId={publishingId}
                          />
                        ))}
                      </TableBody>
                    </Table>
                    {summativeAssessments.length === 0 && <EmptyState />}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Formative tab — grouped by class ──────────────────────────── */}
            <TabsContent value="formative">
              <div className="mb-3 p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-start gap-2">
                <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                Formative and portfolio assessments are created and managed by teachers. Grouped by class below.
              </div>

              {isInitialLoad ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : Object.keys(formativeByClass).length === 0 ? (
                <EmptyFormativeState />
              ) : (
                <div className="space-y-2">
                  {Object.entries(formativeByClass).map(([classId, group]) => {
                    const isExpanded = expandedClasses.has(classId);
                    return (
                      <div key={classId} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          onClick={() => toggleClass(classId)}
                        >
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-teal-600 shrink-0" />
                            <span className="font-semibold text-sm">{group.className}</span>
                            {group.gradeLevel && (
                              <span className="text-xs text-gray-500">Grade {group.gradeLevel}</span>
                            )}
                            <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
                              {group.items.length} assessment{group.items.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />}
                        </button>

                        {isExpanded && (
                          <>
                            <div className="sm:hidden divide-y bg-white">
                              {group.items.map((a: any) => (
                                <div key={a.id} className="p-3">
                                  <FormativeMobileCard a={a} getStatus={getStatus} onView={handleView} />
                                </div>
                              ))}
                            </div>
                            <div className="hidden sm:block">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50/50">
                                    <TableHead>Title</TableHead>
                                    <TableHead>Term</TableHead>
                                    <TableHead>Academic Year</TableHead>
                                    <TableHead>Entries</TableHead>
                                    <TableHead>Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((a: any) => (
                                    <FormativeRow key={a.id} a={a} getStatus={getStatus} onView={handleView} />
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ════════ Create Assessment Dialog ════════ */}
      <Dialog open={showAddModal} onOpenChange={open => { setShowAddModal(open); if (!open) { createAssessmentMutation.reset(); setFormError(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle>Create New Assessment</DialogTitle>
            <DialogDescription>
              {activeTerm
                ? <>Locked to active term: <strong>Term {activeTerm.term}, {activeTerm.academic_year}</strong>.</>
                : 'No active term found.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-2">
              {activeTerm && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                  <CalendarDays className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    <strong>Term {activeTerm.term}</strong> · {activeTerm.academic_year} ·{' '}
                    {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}
                  </span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="title">Assessment Title *</Label>
                <Input id="title" name="title" required placeholder="e.g. CAT 1, Mid Term, End Term" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class_id">Class *</Label>
                <Select name="class_id" required>
                  <SelectTrigger id="class_id" className="h-10"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {(classes as any[]).map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}{cls.grade_level ? ` — Grade ${cls.grade_level}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assessment_date">
                  Assessment Date *
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Applied to all student results</span>
                </Label>
                <Input id="assessment_date" name="assessment_date" type="date" required className="h-10"
                  min={activeTerm?.start_date} max={activeTerm?.end_date} />
                {activeTerm && (
                  <p className="text-xs text-muted-foreground">
                    Must fall within: {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_marks">Max Marks *</Label>
                <Input id="max_marks" name="max_marks" type="number" required defaultValue="100" min="1" className="h-10" />
              </div>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" disabled={createAssessmentMutation.isPending || !activeTerm} className="bg-orange-600 hover:bg-orange-700">
                {createAssessmentMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : 'Create Assessment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ Upload Results Dialog ════════ */}
      <Dialog open={!!uploadTarget} onOpenChange={() => { setUploadTarget(null); setUploadFile(null); setUploadError(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>Upload Results — {uploadTarget?.title}</DialogTitle>
                <DialogDescription className="mt-2 space-y-1">
                  {uploadTarget?.assessment_date ? (
                    <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Assessment date: {fmtDate(uploadTarget.assessment_date)} — applied to all results automatically
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      No assessment date set — please delete and recreate this assessment.
                    </span>
                  )}
                  <span className="block text-xs mt-1">
                    CSV columns: <strong>Assessment_Title, Student_Reg_No, Name, ENG_JS, MATH_JS …</strong>
                    <span className="ml-2 text-yellow-600">Results are published immediately on upload.</span>
                  </span>
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                onClick={() => { setUploadTarget(null); setUploadFile(null); setUploadError(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">CSV File *</Label>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <Input id="csv-file" type="file" accept=".csv,.txt" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              </div>
              <p className="text-xs text-muted-foreground">Comma or tab delimited. No date column needed — date is taken from the assessment.</p>
            </div>
            {uploadError && (
              <div className="flex items-start gap-2 p-3 text-sm text-red-800 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {uploadError}
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setUploadTarget(null); setUploadFile(null); setUploadError(null); }}>Cancel</Button>
            <Button disabled={!uploadFile || isProcessing || !uploadTarget?.assessment_date} onClick={handleResultsUpload} className="bg-green-600 hover:bg-green-700">
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : <><Upload className="w-4 h-4 mr-2" /> Upload & Publish</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ Delete Confirmation Dialog ════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Delete Assessment
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>?
              <span className="block mt-1 text-red-600 font-medium">
                This will permanently delete all associated results and cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteAssessmentMutation.isPending}
              onClick={() => {
                deleteAssessmentMutation.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteAssessmentMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
                : <><Trash2 className="w-4 h-4 mr-2" /> Yes, Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish error toast */}
      {publishError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 max-w-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{publishError}</span>
            <button onClick={() => setPublishError(null)} className="ml-auto">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}