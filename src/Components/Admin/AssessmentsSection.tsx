import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
  Plus, ClipboardList, Loader2, AlertTriangle,
  Eye, Trash2, Users, Hash, BookOpen,
  CalendarDays, ChevronDown, ChevronRight, RefreshCw,
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
  id: string; academic_year: string; term: number; start_date: string; end_date: string;
}

interface AssessmentClass { id: string; name: string; grade_level: string | number; }
interface Assessment {
  id: string; title: string; class_id: string; term: number; year: number;
  category: 'summative' | 'formative' | 'portfolio' | null;
  max_marks: number | null; assessment_date: string | null; created_at: string;
  classes: AssessmentClass | null;
}

interface FormativeActivity {
  id: string; title: string; description: string | null;
  term: number; year: number; class_id: string; subject_id: string;
  strand_id: string | null; sub_strand_id: string | null; activity_date: string;
  teacher_id: string;
  classes:     { id: string; name: string; grade_level: string | number } | null;
  strands:     { id: string; name: string } | null;
  sub_strands: { id: string; name: string } | null;
  subjects:    { id: string; name: string } | null;
  teachers:    { id: string; first_name: string; last_name: string } | null;
}

interface ClassRow { id: string; name: string; grade_level: string | number; }

interface StatusEntry  { drafts: number; published: number; }
interface StatusResult { hasDrafts: boolean; isPublished: boolean; draftCount: number; }

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

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ id, draftLabel = 'drafts', getStatus, statusReady }: {
  id: string; draftLabel?: string;
  getStatus: (id: string) => StatusResult; statusReady: boolean;
}) {
  if (!statusReady) return <span className="inline-block h-5 w-20 rounded bg-gray-100 animate-pulse" />;
  const { hasDrafts, isPublished, draftCount } = getStatus(id);
  if (hasDrafts)   return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{draftCount} {draftLabel}</Badge>;
  if (isPublished) return <Badge variant="outline" className="bg-green-100 text-green-800">Published</Badge>;
  return <span className="text-muted-foreground text-sm">No results</span>;
}

function ActiveTermBanner({ term }: { term: ActiveTerm | null | undefined }) {
  if (term === undefined) return (
    <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-500 flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading active term…
    </div>
  );
  if (!term) return (
    <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      No active term found. Please activate a term in <strong>Academic Calendar</strong> before creating assessments.
    </div>
  );
  return (
    <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      <span className="text-blue-700">
        Active Term: <strong>Term {term.term}, {term.academic_year}</strong>
        <span className="ml-2 text-blue-500 font-normal">({fmtDate(term.start_date)} → {fmtDate(term.end_date)})</span>
      </span>
    </div>
  );
}

function FetchErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-10">
      <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-400" />
      <p className="font-medium text-gray-700">Failed to load assessments</p>
      <p className="text-sm text-gray-500 mt-1 mb-4">Check your connection and try again.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-4 h-4" /> Retry
      </Button>
    </div>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Summative row/card ───────────────────────────────────────────────────────

interface SummativeRowProps {
  a: Assessment; getClassName: (id: string) => string;
  getStatus: (id: string) => StatusResult; statusReady: boolean;
  onView: (a: Assessment) => void; onPublish: (id: string) => void;
  onDelete: (a: Assessment) => void; publishingId: string | null;
}

function SummativeRow({ a, getClassName, getStatus, statusReady, onView, onPublish, onDelete, publishingId }: SummativeRowProps) {
  const { hasDrafts, isPublished } = getStatus(a.id);
  const busy = publishingId === a.id;
  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="font-medium">{a.title}</div>
        {a.assessment_date && <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(a.assessment_date)}</div>}
      </TableCell>
      <TableCell><Badge className={termBadgeColor(a.term)}>Term {a.term}</Badge></TableCell>
      <TableCell>{a.year}-{a.year + 1}</TableCell>
      <TableCell>{a.max_marks ?? 100}</TableCell>
      <TableCell><StatusBadge id={a.id} getStatus={getStatus} statusReady={statusReady} /></TableCell>
      <TableCell>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8" onClick={() => onView(a)}><Eye className="w-3 h-3 mr-1" />View</Button>
          <Button variant="outline" size="sm" className="h-8 text-green-600 hover:bg-green-50"
            onClick={() => onPublish(a.id)} disabled={!statusReady || !hasDrafts || busy}>
            {busy ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-red-600 hover:bg-red-50" onClick={() => onDelete(a)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SummativeMobileCard({ a, getClassName, getStatus, statusReady, onView, onPublish, onDelete, publishingId }: SummativeRowProps) {
  const { hasDrafts, isPublished } = getStatus(a.id);
  const busy = publishingId === a.id;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-medium text-base mb-1 truncate">{a.title}</div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><Users className="w-3 h-3" />{a.classes?.name ?? getClassName(a.class_id)}</div>
          {a.assessment_date && <div className="flex items-center gap-1 text-xs text-blue-600"><CalendarDays className="w-3 h-3" />{fmtDate(a.assessment_date)}</div>}
        </div>
        <Badge className={`${termBadgeColor(a.term)} text-xs`}>Term {a.term}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-1"><Hash className="w-3 h-3 text-gray-400" />{a.year}-{a.year + 1}</div>
        <div>Max: <strong>{a.max_marks ?? 100}</strong></div>
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        <StatusBadge id={a.id} getStatus={getStatus} statusReady={statusReady} />
        <Button variant="outline" size="sm" className="h-7 text-xs text-green-600"
          onClick={() => onPublish(a.id)} disabled={!statusReady || !hasDrafts || busy}>
          {busy ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 pt-3">
        <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => onView(a)}><Eye className="w-3 h-3 mr-1" />View</Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 text-red-600 hover:bg-red-50" onClick={() => onDelete(a)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
      </div>
    </Card>
  );
}

// ─── Formative inline results panel ──────────────────────────────────────────

const LEVEL_STYLES: Record<string, string> = {
  EE: 'bg-green-100 text-green-800 border-green-300',
  ME: 'bg-blue-100 text-blue-800 border-blue-300',
  AE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  BE: 'bg-red-100 text-red-800 border-red-300',
};

function FormativeResultsPanel({ fa }: { fa: FormativeActivity }) {
  const [results, setResults] = useState<{
    student_id: string; performance_level: string | null; is_absent: boolean;
    students: { Reg_no: string; first_name: string; last_name: string } | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setErr(null);
    supabase
      .from('formative_results')
      .select('student_id, performance_level, is_absent, students(Reg_no, first_name, last_name)')
      .eq('formative_activity_id', fa.id)
      .order('student_id')
      .then(({ data, error }) => {
        if (error) { setErr('Failed to load results.'); setLoading(false); return; }
        setResults((data ?? []) as typeof results);
        setLoading(false);
      });
  }, [fa.id]);

  return (
    <div className="bg-teal-50/40 border-t border-teal-100 px-4 py-3 space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span><span className="font-medium">Date:</span> {fmtDate(fa.activity_date)}</span>
        <span><span className="font-medium">Term:</span> {fa.term} · {fa.year}-{fa.year + 1}</span>
        {fa.strands?.name && (
          <span><span className="font-medium">Strand:</span> {fa.strands.name}{fa.sub_strands?.name && <> › {fa.sub_strands.name}</>}</span>
        )}
        {fa.subjects?.name && <span><span className="font-medium">Subject:</span> {fa.subjects.name}</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="h-4 w-4 animate-spin" />Loading results…</div>
      ) : err ? (
        <div className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{err}</div>
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No results recorded yet.</p>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto rounded border border-teal-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-teal-50">
                  <TableHead className="py-2 text-xs">Reg No</TableHead>
                  <TableHead className="py-2 text-xs">Student Name</TableHead>
                  <TableHead className="py-2 text-xs">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.student_id} className={r.is_absent ? "opacity-50" : ""}>
                    <TableCell className="py-2 font-mono text-xs">{r.students?.Reg_no ?? "—"}</TableCell>
                    <TableCell className="py-2 text-sm">{r.students ? `${r.students.first_name} ${r.students.last_name}` : "—"}</TableCell>
                    <TableCell className="py-2">
                      {r.is_absent ? (
                        <span className="text-xs text-gray-400 italic">Absent</span>
                      ) : r.performance_level ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold ${LEVEL_STYLES[r.performance_level] ?? "bg-gray-100 text-gray-700"}`}>{r.performance_level}</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="sm:hidden space-y-1.5">
            {results.map(r => (
              <div key={r.student_id} className={`flex items-center justify-between p-2 rounded bg-white border border-teal-100 ${r.is_absent ? "opacity-50" : ""}`}>
                <div>
                  <div className="text-xs font-mono text-gray-500">{r.students?.Reg_no}</div>
                  <div className="text-sm font-medium">{r.students ? `${r.students.first_name} ${r.students.last_name}` : "—"}</div>
                </div>
                {r.is_absent ? <span className="text-xs text-gray-400 italic">Absent</span>
                  : r.performance_level ? <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold ${LEVEL_STYLES[r.performance_level] ?? "bg-gray-100 text-gray-700"}`}>{r.performance_level}</span>
                  : <span className="text-xs text-gray-400">—</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">{results.filter(r => !r.is_absent).length} result{results.length !== 1 ? "s" : ""} · {results.filter(r => r.is_absent).length} absent</p>
        </>
      )}
    </div>
  );
}

// ─── Formative row/card ───────────────────────────────────────────────────────

function FormativeActivityRow({ fa, isExpanded, onView }: {
  fa: FormativeActivity; isExpanded: boolean; onView: (fa: FormativeActivity) => void;
}) {
  return (
    <TableRow className={isExpanded ? "bg-teal-50/30" : ""}>
      <TableCell className="py-3 pl-10">
        <div className="font-medium">{fa.title}</div>
        {fa.description && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{fa.description}</div>}
        <div className="text-xs text-gray-400 mt-0.5">{fmtDate(fa.activity_date)}</div>
        {fa.sub_strands?.name && <div className="text-xs text-teal-600 mt-0.5">↳ {fa.sub_strands.name}</div>}
      </TableCell>
      <TableCell><Badge className={termBadgeColor(fa.term)}>Term {fa.term}</Badge></TableCell>
      <TableCell>{fa.year}-{fa.year + 1}</TableCell>
      <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Published</Badge></TableCell>
      <TableCell>
        <Button variant="outline" size="sm" className={`h-8 ${isExpanded ? "bg-teal-50 border-teal-300 text-teal-700" : ""}`} onClick={() => onView(fa)}>
          {isExpanded ? <><ChevronDown className="w-3 h-3 mr-1" />Hide</> : <><Eye className="w-3 h-3 mr-1" />View</>}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function FormativeActivityCard({ fa, isExpanded, onView }: {
  fa: FormativeActivity; isExpanded: boolean; onView: (fa: FormativeActivity) => void;
}) {
  return (
    <Card className={`border-l-4 border-l-teal-400 ${isExpanded ? "rounded-b-none" : ""}`}>
      <div className="flex justify-between items-start p-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{fa.title}</div>
          {fa.sub_strands?.name && <div className="text-xs text-teal-600">↳ {fa.sub_strands.name}</div>}
          {fa.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{fa.description}</div>}
          <div className="text-xs text-gray-400 mt-0.5">{fmtDate(fa.activity_date)}</div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs mt-1">Published</Badge>
        </div>
        <Button variant="outline" size="sm" className={`h-8 ml-2 shrink-0 ${isExpanded ? "bg-teal-50 border-teal-300 text-teal-700" : ""}`} onClick={() => onView(fa)}>
          {isExpanded ? <><ChevronDown className="w-3 h-3 mr-1" />Hide</> : <><Eye className="w-3 h-3 mr-1" />View</>}
        </Button>
      </div>
      {isExpanded && <FormativeResultsPanel fa={fa} />}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssessmentsSection() {
  const [viewingAssessment,       setViewingAssessment]       = useState<Assessment | null>(null);
  const [showAddModal,            setShowAddModal]            = useState(false);
  const [publishError,            setPublishError]            = useState<string | null>(null);
  const [activeTab,               setActiveTab]               = useState<'summative' | 'formative'>('summative');
  const [formError,               setFormError]               = useState<string | null>(null);
  const [expandedSummClasses,     setExpandedSummClasses]     = useState<Set<string>>(new Set());
  const [expandedFormClasses,     setExpandedFormClasses]     = useState<Set<string>>(new Set());
  const [expandedStrands,         setExpandedStrands]         = useState<Set<string>>(new Set());
  const [publishingId,            setPublishingId]            = useState<string | null>(null);
  const [deleteTarget,            setDeleteTarget]            = useState<Assessment | null>(null);
  const [expandedActivityIds,     setExpandedActivityIds]     = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // ── Active Term ────────────────────────────────────────────────────────────
  const { data: activeTerm, isLoading: termLoading } = useQuery<ActiveTerm | null>({
    queryKey: ['activeTerm'],
    refetchOnMount: true, refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_calendar')
        .select('id, academic_year, term, start_date, end_date').eq('is_current', true).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  // ── Summative assessments ──────────────────────────────────────────────────
  const { data: assessments = [], isLoading: assessmentsLoading, isError: assessmentsError, refetch: refetchAssessments } =
    useQuery<Assessment[]>({
      queryKey: ['assessments'],
      refetchOnMount: true, refetchOnWindowFocus: false, retry: 2,
      retryDelay: (a) => Math.min(1000 * 2 ** a, 10000),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('assessments')
          .select('id, title, class_id, term, year, category, max_marks, assessment_date, created_at, classes(id, name, grade_level)')
          .eq('category', 'summative')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as Assessment[];
      },
    });

  // ── Formative activities (from new table) ─────────────────────────────────
  const { data: formativeActivities = [], isLoading: formativeLoading, isError: formativeError, refetch: refetchFormative } =
    useQuery<FormativeActivity[]>({
      queryKey: ['formativeActivities'],
      refetchOnMount: true, refetchOnWindowFocus: false, retry: 2,
      retryDelay: (a) => Math.min(1000 * 2 ** a, 10000),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('formative_activities')
          .select(`
            id, title, description, term, year, class_id, subject_id,
            strand_id, sub_strand_id, activity_date, teacher_id,
            classes(id, name, grade_level),
            strands(id, name),
            sub_strands(id, name),
            subjects(id, name),
            teachers(id, first_name, last_name)
          `)
          .order('activity_date', { ascending: false });
        if (error) throw error;
        return (data ?? []) as FormativeActivity[];
      },
    });

  const { data: classes = [] } = useQuery<ClassRow[]>({
    queryKey: ['classes'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  // ── Summative status map — lazy per-class loading ─────────────────────────
  // Status is only fetched when a class row is expanded for the first time.
  // Uses the approach from the working file: Set refs + loadedClassIds tracking
  // so re-expanding a class never double-fetches.

  const [resultStatusMap, setResultStatusMap] = useState<Record<string, StatusEntry>>({});
  const [loadedClassIds,  setLoadedClassIds]  = useState<Set<string>>(new Set());
  const [loadingClassIds, setLoadingClassIds] = useState<Set<string>>(new Set());

  const fetchStatusForClass = useCallback(async (classId: string, assessmentIds: string[]) => {
    if (!assessmentIds.length) return;
    setLoadingClassIds(prev => new Set(prev).add(classId));

    const { data, error } = await supabase
      .from('assessment_results')
      .select('assessment_id, status')
      .in('assessment_id', assessmentIds);

    if (error) {
      console.error('Error fetching result statuses for class:', classId, error);
    } else {
      setResultStatusMap(prev => {
        const next = { ...prev };
        // Seed all IDs with zero first so assessments with no results
        // show "No results" rather than staying as a skeleton indefinitely.
        assessmentIds.forEach(id => { if (!next[id]) next[id] = { drafts: 0, published: 0 }; });
        (data ?? []).forEach(r => {
          if (!next[r.assessment_id]) next[r.assessment_id] = { drafts: 0, published: 0 };
          if (r.status === 'draft')          next[r.assessment_id].drafts++;
          else if (r.status === 'published') next[r.assessment_id].published++;
        });
        return next;
      });
      setLoadedClassIds(prev => new Set(prev).add(classId));
    }

    setLoadingClassIds(prev => { const n = new Set(prev); n.delete(classId); return n; });
  }, []);

  // After publish, refresh only that assessment's class.
  const refreshStatusForClass = useCallback((assessmentId: string, allAssessments: Assessment[]) => {
    const a = allAssessments.find(x => x.id === assessmentId);
    if (!a) return;
    const ids = allAssessments.filter(x => x.class_id === a.class_id).map(x => x.id);
    setLoadedClassIds(prev => { const n = new Set(prev); n.delete(a.class_id); return n; });
    setResultStatusMap(prev => { const n = { ...prev }; ids.forEach(id => { delete n[id]; }); return n; });
    void fetchStatusForClass(a.class_id, ids);
  }, [fetchStatusForClass]);

  // When returning from detail view, refresh that assessment's class.
  const prevViewingRef = useRef<Assessment | null>(null);
  useEffect(() => {
    const prev = prevViewingRef.current;
    prevViewingRef.current = viewingAssessment;
    if (prev && !viewingAssessment) refreshStatusForClass(prev.id, assessments);
  }, [viewingAssessment, assessments, refreshStatusForClass]);

  const getStatus = useCallback((id: string): StatusResult => {
    const e = resultStatusMap[id];
    if (!e) return { hasDrafts: false, isPublished: false, draftCount: 0 };
    return { hasDrafts: e.drafts > 0, isPublished: e.drafts === 0 && e.published > 0, draftCount: e.drafts };
  }, [resultStatusMap]);

  const isClassStatusLoading = useCallback((classId: string) =>
    loadingClassIds.has(classId) && !loadedClassIds.has(classId),
  [loadingClassIds, loadedClassIds]);

  const summativeByClass: Record<string, { className: string; gradeLevel: string; items: Assessment[] }> = {};
  assessments.forEach(a => {
    const cls = classes.find(c => c.id === a.class_id);
    const cn  = a.classes?.name ?? cls?.name ?? 'Unknown Class';
    const gl  = String(a.classes?.grade_level ?? cls?.grade_level ?? '');
    if (!summativeByClass[a.class_id]) summativeByClass[a.class_id] = { className: cn, gradeLevel: gl, items: [] };
    summativeByClass[a.class_id].items.push(a);
  });

  // ── Formative: grouped by class → subject → strand ───────────────────────
  // Structure: classId → { className, gradeLevel,
  //   subjects: { subjectId → { subjectName,
  //     strands: { strandKey → { strandName, items[] } } } } }

  type StrandGroup  = { strandName: string; items: FormativeActivity[] };
  type SubjectGroup = { subjectName: string; strands: Record<string, StrandGroup> };
  type ClassGroup   = { className: string; gradeLevel: string; subjects: Record<string, SubjectGroup> };
  const formativeByClass: Record<string, ClassGroup> = {};

  formativeActivities.forEach(fa => {
    const cls = classes.find(c => c.id === fa.class_id);
    const cn  = fa.classes?.name ?? cls?.name ?? 'Unknown Class';
    const gl  = String(fa.classes?.grade_level ?? cls?.grade_level ?? '');

    if (!formativeByClass[fa.class_id])
      formativeByClass[fa.class_id] = { className: cn, gradeLevel: gl, subjects: {} };

    const subjectKey  = fa.subject_id;
    const subjectName = fa.subjects?.name ?? 'Unknown Subject';
    if (!formativeByClass[fa.class_id].subjects[subjectKey])
      formativeByClass[fa.class_id].subjects[subjectKey] = { subjectName, strands: {} };

    const strandKey  = fa.strands?.id  ?? '__none__';
    const strandName = fa.strands?.name ?? 'No Strand';
    if (!formativeByClass[fa.class_id].subjects[subjectKey].strands[strandKey])
      formativeByClass[fa.class_id].subjects[subjectKey].strands[strandKey] = { strandName, items: [] };

    formativeByClass[fa.class_id].subjects[subjectKey].strands[strandKey].items.push(fa);
  });

  // ── Toggle helpers ─────────────────────────────────────────────────────────

  const toggleSummClass = (classId: string, classAsmIds: string[]) => {
    setExpandedSummClasses(prev => {
      const n = new Set(prev);
      if (n.has(classId)) {
        n.delete(classId);
      } else {
        n.add(classId);
        // Lazy-fetch status on first expand only
        if (!loadedClassIds.has(classId) && !loadingClassIds.has(classId)) {
          void fetchStatusForClass(classId, classAsmIds);
        }
      }
      return n;
    });
  };

  const toggleFormClass = (id: string) =>
    setExpandedFormClasses(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Subject expand key = `${classId}__subj__${subjectId}`
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const toggleSubject = (key: string) =>
    setExpandedSubjects(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleStrand = (key: string) =>
    setExpandedStrands(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createAssessmentMutation = useMutation<void, Error,
    Omit<Assessment, 'id' | 'created_at' | 'classes'>>({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('assessments').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assessments'] }); setShowAddModal(false); setFormError(null); },
    onError: (err) => setFormError(err.message),
  });

  const deleteAssessmentMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error: e1 } = await supabase.from('assessment_results').delete().eq('assessment_id', id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('assessments').delete().eq('id', id);
      if (e2) throw e2;
    },
    onSuccess: (_, id) => {
      setResultStatusMap(prev => { const n = { ...prev }; delete n[id]; return n; });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      const { error, data } = await supabase.from('assessment_results')
        .update({ status: 'published' }).eq('assessment_id', assessmentId).eq('status', 'draft').select();
      if (error) throw error;
      return { assessmentId, count: data?.length ?? 0 };
    },
    onMutate: (id: string) => setPublishingId(id),
    onSuccess: ({ assessmentId }: { assessmentId: string; count: number }) => {
      // Optimistic update — flip drafts→published immediately in local map
      setResultStatusMap(prev => {
        const e = prev[assessmentId]; if (!e) return prev;
        return { ...prev, [assessmentId]: { drafts: 0, published: e.published + e.drafts } };
      });
      // Also clear the class cache so re-expanding re-fetches fresh data
      refreshStatusForClass(assessmentId, assessments);
      setPublishError(null); setPublishingId(null);
    },
    onError: (err: Error) => { setPublishError(err.message || 'Failed to publish.'); setPublishingId(null); },
  });
  const publishRef = useRef(publishMutation);
  publishRef.current = publishMutation;

  // ── Summative: grouped by class ───────────────────────────────────────────

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(null);
    if (!activeTerm) { setFormError('No active term. Activate a term in Academic Calendar first.'); return; }
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!raw.assessment_date) { setFormError('Please set the assessment date.'); return; }
    if (raw.assessment_date < activeTerm.start_date || raw.assessment_date > activeTerm.end_date) {
      setFormError(`Date must be within ${fmtDate(activeTerm.start_date)} – ${fmtDate(activeTerm.end_date)}.`);
      return;
    }
    createAssessmentMutation.mutate({
      title: raw.title.trim(), class_id: raw.class_id,
      term: activeTerm.term, year: parseInt(activeTerm.academic_year.split('-')[0]),
      category: 'summative', max_marks: parseInt(raw.max_marks) || 100,
      assessment_date: raw.assessment_date,
    });
  };

  const getClassName  = useCallback((id: string) => classes.find(c => c.id === id)?.name ?? 'N/A', [classes]);
  const handleView    = useCallback((a: Assessment) => setViewingAssessment(a), []);
  const handlePublish = useCallback((id: string) => publishRef.current.mutate(id), []);
  const confirmDelete = useCallback((a: Assessment) => setDeleteTarget(a), []);

  const handleViewFormative = useCallback((fa: FormativeActivity) => {
    setExpandedActivityIds(prev => {
      const n = new Set(prev);
      n.has(fa.id) ? n.delete(fa.id) : n.add(fa.id);
      return n;
    });
  }, []);

  if (viewingAssessment)
    return <AssessmentResultsView assessment={viewingAssessment} onBack={() => setViewingAssessment(null)} />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      <ActiveTermBanner term={termLoading ? undefined : activeTerm} />

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" /> Assessments
            </CardTitle>
            <Button onClick={() => { setShowAddModal(true); setFormError(null); }} disabled={!activeTerm}
              title={!activeTerm ? 'Activate a term first' : undefined}
              className="bg-orange-600 hover:bg-orange-700 h-10 sm:h-auto" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Create Assessment</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'summative' | 'formative')}>
            <TabsList className="mb-4">
              <TabsTrigger value="summative">
                Exams / Summative
                <Badge className="ml-2 bg-purple-100 text-purple-800 border-purple-200 text-xs">{assessments.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="formative">
                Formative Activities
                <Badge className="ml-2 bg-teal-100 text-teal-800 border-teal-200 text-xs">{formativeActivities.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Summative: class → assessments ──────────────────────────── */}
            <TabsContent value="summative">
              {assessmentsError ? (
                <FetchErrorState onRetry={() => void refetchAssessments()} />
              ) : assessmentsLoading ? (
                <SkeletonRows count={3} />
              ) : Object.keys(summativeByClass).length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-gray-500">No assessments yet</p>
                  <p className="text-sm mt-1">Click <strong>Create Assessment</strong> above to add one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(summativeByClass).map(([classId, group]) => {
                    const isOpen        = expandedSummClasses.has(classId);
                    const classAsmIds   = group.items.map(a => a.id);
                    const statusLoading = isClassStatusLoading(classId);
                    return (
                      <div key={classId} className="border rounded-lg overflow-hidden">
                        <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          onClick={() => toggleSummClass(classId, classAsmIds)}>
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="font-semibold text-sm">{group.className}</span>
                            {group.gradeLevel && <span className="text-xs text-gray-500">Grade {group.gradeLevel}</span>}
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                              {group.items.length} assessment{group.items.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />}
                        </button>
                        {isOpen && (
                          statusLoading ? (
                            <div className="px-4 py-2 bg-white"><SkeletonRows count={group.items.length} /></div>
                          ) : (
                            <>
                              <div className="sm:hidden divide-y bg-white">
                                {group.items.map(a => (
                                  <div key={a.id} className="p-3">
                                    <SummativeMobileCard a={a} getClassName={getClassName} getStatus={getStatus}
                                      statusReady={!statusLoading} onView={handleView} onPublish={handlePublish}
                                      onDelete={confirmDelete} publishingId={publishingId} />
                                  </div>
                                ))}
                              </div>
                              <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                      <TableHead>Title / Date</TableHead><TableHead>Term</TableHead>
                                      <TableHead>Academic Year</TableHead><TableHead>Max Marks</TableHead>
                                      <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.items.map(a => (
                                      <SummativeRow key={a.id} a={a} getClassName={getClassName} getStatus={getStatus}
                                        statusReady={!statusLoading} onView={handleView} onPublish={handlePublish}
                                        onDelete={confirmDelete} publishingId={publishingId} />
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Formative: class → subject → strand → activities ─────────── */}
            <TabsContent value="formative">
              <div className="mb-3 p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-start gap-2">
                <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                Formative activities are recorded by teachers. Grouped by class, then subject, then strand.
              </div>

              {formativeError ? (
                <FetchErrorState onRetry={() => void refetchFormative()} />
              ) : formativeLoading ? (
                <SkeletonRows count={2} />
              ) : Object.keys(formativeByClass).length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-gray-500">No formative activities yet</p>
                  <p className="text-sm mt-1">These appear here when teachers record class activities.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(formativeByClass).map(([classId, classGroup]) => {
                    const isClassOpen = expandedFormClasses.has(classId);
                    const totalItems  = Object.values(classGroup.subjects)
                      .flatMap(sg => Object.values(sg.strands))
                      .reduce((s, g) => s + g.items.length, 0);
                    return (
                      <div key={classId} className="border rounded-lg overflow-hidden">

                        {/* ── Class header ── */}
                        <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          onClick={() => toggleFormClass(classId)}>
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-teal-600 shrink-0" />
                            <span className="font-semibold text-sm">{classGroup.className}</span>
                            {classGroup.gradeLevel && <span className="text-xs text-gray-500">Grade {classGroup.gradeLevel}</span>}
                            <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
                              {totalItems} activit{totalItems !== 1 ? 'ies' : 'y'}
                            </Badge>
                          </div>
                          {isClassOpen ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />}
                        </button>

                        {isClassOpen && (
                          <div className="bg-white divide-y">
                            {Object.entries(classGroup.subjects).map(([subjectId, subjectGroup]) => {
                              const subjKey     = `${classId}__subj__${subjectId}`;
                              const isSubjOpen  = expandedSubjects.has(subjKey);
                              const subjTotal   = Object.values(subjectGroup.strands).reduce((s, g) => s + g.items.length, 0);
                              return (
                                <div key={subjectId}>

                                  {/* ── Subject sub-header ── */}
                                  <button className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                                    onClick={() => toggleSubject(subjKey)}>
                                    <div className="flex items-center gap-2">
                                      <ClipboardList className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                      <span className="text-sm font-semibold text-gray-800">{subjectGroup.subjectName}</span>
                                      <span className="text-xs text-gray-400">{subjTotal} activit{subjTotal !== 1 ? 'ies' : 'y'}</span>
                                    </div>
                                    {isSubjOpen ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                                  </button>

                                  {isSubjOpen && (
                                    <div className="divide-y">
                                      {Object.entries(subjectGroup.strands).map(([strandKey, strandGroup]) => {
                                        const expandKey    = `${classId}__${subjectId}__${strandKey}`;
                                        const isStrandOpen = expandedStrands.has(expandKey);
                                        return (
                                          <div key={strandKey}>

                                            {/* ── Strand sub-header ── */}
                                            <button className="w-full flex items-center justify-between px-8 py-2 bg-white hover:bg-gray-50 transition-colors text-left"
                                              onClick={() => toggleStrand(expandKey)}>
                                              <div className="flex items-center gap-2">
                                                <BookOpen className="h-3 w-3 text-teal-400 shrink-0" />
                                                <span className="text-xs font-medium text-gray-600">{strandGroup.strandName}</span>
                                                <span className="text-xs text-gray-400">{strandGroup.items.length} item{strandGroup.items.length !== 1 ? 's' : ''}</span>
                                              </div>
                                              {isStrandOpen ? <ChevronDown className="h-3 w-3 text-gray-300 shrink-0" /> : <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />}
                                            </button>

                                            {/* ── Activity rows ── */}
                                            {isStrandOpen && (
                                              <>
                                                <div className="sm:hidden space-y-2 px-4 py-3">
                                                  {strandGroup.items.map(fa => (
                                                    <FormativeActivityCard key={fa.id} fa={fa}
                                                    isExpanded={expandedActivityIds.has(fa.id)}
                                                    onView={handleViewFormative} />
                                                  ))}
                                                </div>
                                                <div className="hidden sm:block">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow className="bg-gray-50/20">
                                                        <TableHead className="pl-10">Title / Date</TableHead>
                                                        <TableHead>Term</TableHead>
                                                        <TableHead>Year</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Actions</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {strandGroup.items.map(fa => (
                                                        <React.Fragment key={fa.id}>
                                                          <FormativeActivityRow fa={fa}
                                                            isExpanded={expandedActivityIds.has(fa.id)}
                                                            onView={handleViewFormative} />
                                                          {expandedActivityIds.has(fa.id) && (
                                                            <TableRow>
                                                              <TableCell colSpan={5} className="p-0">
                                                                <FormativeResultsPanel fa={fa} />
                                                              </TableCell>
                                                            </TableRow>
                                                          )}
                                                        </React.Fragment>
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
                                </div>
                              );
                            })}
                          </div>
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
              {activeTerm ? <>Locked to active term: <strong>Term {activeTerm.term}, {activeTerm.academic_year}</strong>.</> : 'No active term found.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-2">
              {activeTerm && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                  <CalendarDays className="h-4 w-4 shrink-0 text-blue-500" />
                  <span><strong>Term {activeTerm.term}</strong> · {activeTerm.academic_year} · {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}</span>
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
                    {classes.map(cls => (
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
                {activeTerm && <p className="text-xs text-muted-foreground">Must fall within: {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_marks">Max Marks *</Label>
                <Input id="max_marks" name="max_marks" type="number" required defaultValue="100" min="1" className="h-10" />
              </div>
            </div>
            {formError && <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{formError}</div>}
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" disabled={createAssessmentMutation.isPending || !activeTerm} className="bg-orange-600 hover:bg-orange-700">
                {createAssessmentMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create Assessment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ Delete Confirmation Dialog ════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" />Delete Assessment</DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>?
              <span className="block mt-1 text-red-600 font-medium">This will permanently delete all associated results and cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={deleteAssessmentMutation.isPending}
              onClick={() => { if (!deleteTarget) return; deleteAssessmentMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }}>
              {deleteAssessmentMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4 mr-2" />Yes, Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ Publish error toast ════════ */}
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