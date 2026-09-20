// src/Components/Admin/ClassesSection/ClassPerformanceTab.tsx
//
// Class Performance — active term default, per-class → per-subject drill-down.
// Subject card shows CAT 3 average prominently + teacher + student count.
// Clicking a subject card reveals CAT 1, CAT 2, CAT 3 averages side-by-side.

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  ChevronDown, ChevronRight, Users, BookOpen,
  TrendingUp, RefreshCw, AlertTriangle, User, BarChart2,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select';

// ─── Design tokens ────────────────────────────────────────────────────────────
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW     = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HV  = '0 10px 40px -18px rgba(122,31,43,0.35)';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ActiveTerm {
  id: string; academic_year: string; term: number;
  start_date: string; end_date: string;
}
interface ClassRow { id: string; name: string; grade_level: string | number; }

interface RawResult {
  student_id: string;
  score: number;
  is_absent: boolean;
  subject_id: string;
  assessments: {
    id: string; title: string; class_id: string;
    term: number; year: number; max_marks: number;
  } | null;
  subjects: { id: string; name: string } | null;
}

interface RawTeacherClass {
  class_id: string; subject_id: string;
  teachers: { id: string; first_name: string; last_name: string; teacher_code: string } | null;
}

interface TermOption { term: number; year: number; label: string; }

type CatKey = 'cat1' | 'cat2' | 'cat3' | 'other';

interface CatAvg { avg: number | null; count: number; }

interface SubjectPerf {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  teacherCode: string;
  studentCount: number;
  cats: Record<CatKey, CatAvg>;
  cat3Avg: number | null;
  overallAvg: number | null;
}

interface ClassPerf {
  classId: string;
  className: string;
  gradeLevel: string;
  subjects: SubjectPerf[];
  overallAvg: number | null;
}

// ─── Pagination helper ────────────────────────────────────────────────────────
// Supabase/PostgREST caps every response at 1000 rows by default. This loop
// keeps requesting 1000-row pages until a short page comes back.
async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const MAX_PAGES = 200; // 200k rows hard safety cap
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ─── Queries ──────────────────────────────────────────────────────────────────
async function fetchResultsForTerm(term: number, year: number): Promise<RawResult[]> {
  const rows = await fetchAllPages<any>((from, to) =>
    supabase
      .from('assessment_results')
      .select(`
        student_id,
        score,
        is_absent,
        subject_id,
        assessments!inner ( id, title, class_id, term, year, max_marks, category ),
        subjects ( id, name )
      `)
      .eq('status', 'published')
      .eq('assessments.term', term)
      .eq('assessments.year', year)
      .eq('assessments.category', 'summative')
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows.map(r => ({
    student_id: r.student_id,
    score: r.score,
    is_absent: r.is_absent,
    subject_id: r.subject_id,
    assessments: Array.isArray(r.assessments) ? (r.assessments[0] ?? null) : r.assessments,
    subjects:    Array.isArray(r.subjects)    ? (r.subjects[0]    ?? null) : r.subjects,
  }));
}

async function fetchTermOptions(): Promise<TermOption[]> {
  const rows = await fetchAllPages<{ term: number; year: number }>((from, to) =>
    supabase
      .from('assessments')
      .select('term, year')
      .eq('category', 'summative')
      .order('year', { ascending: false })
      .order('term', { ascending: false })
      .order('id',   { ascending: true })
      .range(from, to),
  );
  const seen = new Set<string>();
  const opts: TermOption[] = [];
  rows.forEach(r => {
    const key = `${r.term}_${r.year}`;
    if (seen.has(key)) return;
    seen.add(key);
    opts.push({ term: r.term, year: r.year, label: `Term ${r.term} · ${r.year}/${r.year + 1}` });
  });
  return opts;
}

async function fetchTeacherClasses(): Promise<RawTeacherClass[]> {
  const rows = await fetchAllPages<any>((from, to) =>
    supabase
      .from('teacher_classes')
      .select(`class_id, subject_id, teachers ( id, first_name, last_name, teacher_code )`)
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows.map(r => ({
    class_id:   r.class_id,
    subject_id: r.subject_id,
    teachers:   Array.isArray(r.teachers) ? (r.teachers[0] ?? null) : r.teachers,
  }));
}

// ─── CAT detection ────────────────────────────────────────────────────────────
function detectCat(title: string | null | undefined): CatKey {
  if (!title) return 'other';
  const t = title.toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.includes('cat 3') || t.includes('cat3') || /cat.*3/.test(t) || /\b3$/.test(t)) return 'cat3';
  if (t.includes('cat 2') || t.includes('cat2') || /cat.*2/.test(t) || /\b2$/.test(t)) return 'cat2';
  if (t.includes('cat 1') || t.includes('cat1') || /cat.*1/.test(t) || /\b1$/.test(t)) return 'cat1';
  return 'other';
}

// ─── Band helpers ─────────────────────────────────────────────────────────────
function pctToBand(pct: number): 'EE' | 'ME' | 'AE' | 'BE' {
  if (pct >= 80) return 'EE';
  if (pct >= 60) return 'ME';
  if (pct >= 40) return 'AE';
  return 'BE';
}

const BAND_STYLES: Record<string, { badge: string; bar: string; text: string }> = {
  EE: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',      bar: 'bg-emerald-400', text: 'text-emerald-600' },
  ME: { badge: 'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/20',      bar: 'bg-[#7a1f2b]',   text: 'text-[#7a1f2b]'   },
  AE: { badge: 'bg-amber-50 text-amber-700 border-amber-200',            bar: 'bg-amber-400',   text: 'text-amber-600'   },
  BE: { badge: 'bg-red-50 text-red-700 border-red-200',                  bar: 'bg-red-400',     text: 'text-red-600'     },
};

const CAT_COLORS: Record<CatKey, string> = {
  cat1:  'text-sky-700 bg-sky-50 border-sky-200',
  cat2:  'text-violet-700 bg-violet-50 border-violet-200',
  cat3:  'text-[#7a1f2b] bg-[#7a1f2b]/8 border-[#7a1f2b]/20',
  other: 'text-gray-600 bg-gray-50 border-gray-200',
};

const CAT_BG: Record<CatKey, string> = {
  cat1:  'bg-sky-50 border-sky-100',
  cat2:  'bg-violet-50 border-violet-100',
  cat3:  'bg-[#7a1f2b]/5 border-[#7a1f2b]/10',
  other: 'bg-gray-50 border-gray-100',
};

// ─── ScoreBar / BandBadge ─────────────────────────────────────────────────────
function ScoreBar({ pct, band }: { pct: number; band: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${BAND_STYLES[band]?.bar ?? 'bg-gray-400'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function BandBadge({ band }: { band: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${BAND_STYLES[band]?.badge ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {band}
    </span>
  );
}

// ─── CAT breakdown (three panels) ─────────────────────────────────────────────
function CatBreakdown({ cats }: { cats: Record<CatKey, CatAvg> }) {
  const keys: CatKey[] = ['cat1', 'cat2', 'cat3'];
  return (
    <div className="mt-3 pt-3 border-t border-[#7a1f2b]/8 grid grid-cols-3 gap-2">
      {keys.map(k => {
        const c    = cats[k];
        const has  = c.avg !== null;
        const band = has ? pctToBand(c.avg!) : null;
        return (
          <div key={k}
            className={`rounded-xl border px-2.5 py-2.5 flex flex-col items-center gap-1.5 ${
              has ? CAT_BG[k] : 'bg-gray-50 border-gray-100'
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${CAT_COLORS[k]}`}>
              {k === 'cat1' ? 'CAT 1' : k === 'cat2' ? 'CAT 2' : 'CAT 3'}
            </span>
            {has ? (
              <>
                <span className={`text-xl font-extrabold leading-none ${BAND_STYLES[band!]?.text ?? 'text-gray-700'}`}>
                  {c.avg!.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-foreground leading-none">
                  {c.count} student{c.count !== 1 ? 's' : ''}
                </span>
                {band && <BandBadge band={band} />}
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground italic mt-1 text-center leading-tight">
                No data yet
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Subject card ─────────────────────────────────────────────────────────────
function SubjectPerfCard({ sp }: { sp: SubjectPerf }) {
  const [expanded, setExpanded] = useState(false);
  const displayAvg = sp.cat3Avg ?? sp.overallAvg;
  const band       = displayAvg !== null ? pctToBand(displayAvg) : null;

  return (
    <div
      className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden transition-shadow duration-200"
      style={{ boxShadow: expanded ? CARD_SHADOW_HV : CARD_SHADOW }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex flex-col gap-2.5 hover:bg-[#7a1f2b]/[0.02] active:scale-[0.998] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(122,31,43,0.08)' }}>
              <BookOpen className="w-4 h-4 text-[#7a1f2b]" />
            </div>
            <span className="font-semibold text-sm text-[#3a1b1f] leading-tight truncate">
              {sp.subjectName}
            </span>
          </div>

          {displayAvg !== null ? (
            <div className="shrink-0 flex flex-col items-end gap-0.5">
              <span className="text-[10px] text-muted-foreground font-medium leading-none">
                {sp.cat3Avg !== null ? 'CAT 3 avg' : 'avg'}
              </span>
              <span className={`text-xl font-extrabold leading-none ${BAND_STYLES[band!]?.text ?? 'text-gray-700'}`}>
                {displayAvg.toFixed(1)}%
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground italic shrink-0 mt-1">No results</span>
          )}
        </div>

        {displayAvg !== null && band && <ScoreBar pct={displayAvg} band={band} />}

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-md bg-[#7a1f2b]/8 flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-[#7a1f2b]" />
              </div>
              {sp.teacherName
                ? <span className="text-[11px] text-[#3a1b1f] font-medium truncate">{sp.teacherName}</span>
                : <span className="text-[11px] text-muted-foreground italic">Unassigned</span>
              }
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{sp.studentCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 text-[10px] text-[#7a1f2b]/60 font-medium shrink-0">
            <BarChart2 className="w-3 h-3" />
            <span className="ml-0.5">{expanded ? 'Hide' : 'All CATs'}</span>
            {expanded
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <CatBreakdown cats={sp.cats} />
        </div>
      )}
    </div>
  );
}

// ─── Class accordion ──────────────────────────────────────────────────────────
function ClassPerfCard({ cp }: { cp: ClassPerf }) {
  const [open, setOpen] = useState(false);
  const band = cp.overallAvg !== null ? pctToBand(cp.overallAvg) : null;

  return (
    <div
      className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden transition-shadow duration-200"
      style={{ boxShadow: open ? CARD_SHADOW_HV : CARD_SHADOW }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors active:scale-[0.998] ${
          open ? '' : 'hover:bg-[#7a1f2b]/[0.03]'
        }`}
        style={open ? { background: MAROON_GRADIENT } : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              open ? 'bg-white/15 border border-white/20' : ''
            }`}
            style={!open ? { background: 'rgba(122,31,43,0.08)' } : undefined}
          >
            <Users className={`h-4 w-4 ${open ? 'text-white' : 'text-[#7a1f2b]'}`} />
          </div>
          <div className="min-w-0">
            <p className={`font-semibold text-sm truncate ${open ? 'text-white' : 'text-[#3a1b1f]'}`}>
              {cp.className}
            </p>
            {cp.gradeLevel && (
              <p className={`text-[10px] ${open ? 'text-white/70' : 'text-muted-foreground'}`}>
                Grade {cp.gradeLevel}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-3">
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
            open
              ? 'bg-white/20 text-white border-white/15'
              : 'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/15'
          }`}>
            {cp.subjects.length} subject{cp.subjects.length !== 1 ? 's' : ''}
          </span>

          {cp.overallAvg !== null && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              open
                ? 'bg-white/15 text-white border-white/20'
                : band ? BAND_STYLES[band].badge : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
              {cp.overallAvg.toFixed(1)}%
            </span>
          )}

          {open
            ? <ChevronDown className="w-4 h-4 text-white/80 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-[#7a1f2b]/50 shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="p-3 sm:p-4 bg-[#fdfbfb] border-t border-[#7a1f2b]/8">
          {cp.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">
              No published results for this class yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {cp.subjects.map(sp => (
                <SubjectPerfCard key={sp.subjectId} sp={sp} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ termLabel }: { termLabel: string }) {
  return (
    <div className="text-center py-14">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(122,31,43,0.06)' }}>
        <TrendingUp className="w-6 h-6 text-[#7a1f2b]/40" />
      </div>
      <p className="font-semibold text-[#3a1b1f]">No published results for {termLabel}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
        Publish assessment results in the Summative tab to see class performance here.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface ClassPerformanceTabProps {
  activeTerm: ActiveTerm | null | undefined;
  classes:    ClassRow[];
}

export default function ClassPerformanceTab({ activeTerm, classes }: ClassPerformanceTabProps) {
  const activeYear = activeTerm
    ? parseInt(activeTerm.academic_year.split('-')[0], 10)
    : null;

  const [filterTerm, setFilterTerm] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);

  // Tracks which active-term we've already synced to, so we don't clobber a
  // user's manual term selection, but we DO re-sync if the active term changes.
  const lastAppliedActiveId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTerm || activeYear === null) return;
    if (lastAppliedActiveId.current === activeTerm.id) return;
    lastAppliedActiveId.current = activeTerm.id;
    setFilterTerm(activeTerm.term);
    setFilterYear(activeYear);
  }, [activeTerm, activeYear]);

  const filterReady = filterTerm !== null && filterYear !== null;

  // ── 1. Published results for the selected term (server-side filtered) ──────
  const {
    data: rawResults = [],
    isLoading: resultsLoading,
    isError: resultsError,
    refetch: refetchResults,
  } = useQuery<RawResult[]>({
    queryKey: ['classPerf_results', filterTerm, filterYear],
    enabled: filterReady,
    staleTime: 30_000,
    queryFn: () => fetchResultsForTerm(filterTerm!, filterYear!),
  });

  // ── 2. Available term options (small table, cheap) ─────────────────────────
  const { data: termOptions = [] } = useQuery<TermOption[]>({
    queryKey: ['classPerf_termOptions'],
    staleTime: 5 * 60 * 1000,
    queryFn: fetchTermOptions,
  });

  // ── 3. Teacher assignments ────────────────────────────────────────────────
  const { data: rawTeacherClasses = [] } = useQuery<RawTeacherClass[]>({
    queryKey: ['classPerf_teacherClasses'],
    staleTime: 5 * 60 * 1000,
    queryFn: fetchTeacherClasses,
  });

  // ── 4. Teacher lookup: "classId_subjectId" → { name, code } ───────────────
  const teacherLookup = useMemo(() => {
    const map = new Map<string, { name: string; code: string }>();
    rawTeacherClasses.forEach(tc => {
      if (!tc.teachers) return;
      const key = `${tc.class_id}_${tc.subject_id}`;
      if (!map.has(key)) {
        map.set(key, {
          name: `${tc.teachers.first_name} ${tc.teachers.last_name}`.trim(),
          code: tc.teachers.teacher_code,
        });
      }
    });
    return map;
  }, [rawTeacherClasses]);

  // ── 5. Compute class performance from the pre-filtered rows ───────────────
  const classPerformance: ClassPerf[] = useMemo(() => {
    // Rows are already term-scoped and published-only. Just drop absents and
    // anything missing the joined assessment.
    const filtered = rawResults.filter(r => r.assessments && !r.is_absent);

    const byClass      = new Map<string, Map<string, Map<CatKey, number[]>>>();
    const subjectNames = new Map<string, string>();
    const studentSets  = new Map<string, Set<string>>(); // `${classId}__${subjectId}`

    filtered.forEach(r => {
      if (!r.assessments) return;

      const classId   = r.assessments.class_id;
      const subjectId = r.subject_id;
      const catKey    = detectCat(r.assessments.title);
      const maxMarks  = r.assessments.max_marks;
      const pct       = maxMarks > 0 ? (r.score / maxMarks) * 100 : 0;

      if (r.subjects) subjectNames.set(r.subjects.id, r.subjects.name);

      // Distinct student tracking per (class, subject) — this is the
      // "number of students taking the subject in that class".
      const sKey = `${classId}__${subjectId}`;
      if (!studentSets.has(sKey)) studentSets.set(sKey, new Set());
      studentSets.get(sKey)!.add(r.student_id);

      if (!byClass.has(classId)) byClass.set(classId, new Map());
      const bySub = byClass.get(classId)!;
      if (!bySub.has(subjectId)) bySub.set(subjectId, new Map());
      const byCat = bySub.get(subjectId)!;
      if (!byCat.has(catKey)) byCat.set(catKey, []);
      byCat.get(catKey)!.push(pct);
    });

    const result: ClassPerf[] = [];

    byClass.forEach((bySub, classId) => {
      const cls = classes.find(c => c.id === classId);
      if (!cls) return;

      const subjects: SubjectPerf[] = [];

      bySub.forEach((byCat, subjectId) => {
        const makeCatAvg = (k: CatKey): CatAvg => {
          const scores = byCat.get(k) ?? [];
          if (scores.length === 0) return { avg: null, count: 0 };
          return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
        };

        const cats: Record<CatKey, CatAvg> = {
          cat1:  makeCatAvg('cat1'),
          cat2:  makeCatAvg('cat2'),
          cat3:  makeCatAvg('cat3'),
          other: makeCatAvg('other'),
        };

        const studentCount = studentSets.get(`${classId}__${subjectId}`)?.size ?? 0;

        const availAvgs = (['cat1', 'cat2', 'cat3'] as CatKey[])
          .map(k => cats[k].avg)
          .filter((a): a is number => a !== null);
        const overallAvg = availAvgs.length
          ? availAvgs.reduce((a, b) => a + b, 0) / availAvgs.length
          : null;

        const teacher = teacherLookup.get(`${classId}_${subjectId}`);

        subjects.push({
          subjectId,
          subjectName:  subjectNames.get(subjectId) ?? `(Unknown — id: ${subjectId.slice(0, 8)})`,
          teacherName:  teacher?.name ?? '',
          teacherCode:  teacher?.code ?? '',
          studentCount,
          cats,
          cat3Avg:    cats.cat3.avg,
          overallAvg,
        });
      });

      subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      const classAvgs = subjects
        .map(s => s.cat3Avg ?? s.overallAvg)
        .filter((a): a is number => a !== null);
      const overallAvg = classAvgs.length
        ? classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length
        : null;

      result.push({
        classId,
        className:  cls.name,
        gradeLevel: String(cls.grade_level ?? ''),
        subjects,
        overallAvg,
      });
    });

    return result.sort((a, b) => a.className.localeCompare(b.className));
  }, [rawResults, classes, teacherLookup]);

  // ── Derived labels ────────────────────────────────────────────────────────
  const currentTermLabel = activeTerm
    ? `Term ${activeTerm.term} · ${activeTerm.academic_year}`
    : 'current term';

  const isCurrentTerm =
    filterTerm === (activeTerm?.term ?? null) &&
    filterYear === activeYear;

  const selectedLabel = termOptions.find(
    o => o.term === filterTerm && o.year === filterYear
  )?.label ?? currentTermLabel;

  const prevTermOptions = termOptions.filter(
    o => !(o.term === activeTerm?.term && o.year === activeYear)
  );

  // Show the spinner until the filter has been synced AND the query resolved.
  const pending = !filterReady || resultsLoading;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Term filter bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {activeTerm && (
          <button
            onClick={() => {
              setFilterTerm(activeTerm.term);
              setFilterYear(activeYear);
            }}
            className={`h-9 px-3 rounded-xl border text-xs font-semibold transition-colors active:scale-[0.97] ${
              isCurrentTerm
                ? 'border-[#7a1f2b]/30 text-[#7a1f2b] bg-[#7a1f2b]/8'
                : 'border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5'
            }`}
          >
            {isCurrentTerm && <span className="mr-1 text-[8px]">●</span>}
            {currentTermLabel}
          </button>
        )}

        {prevTermOptions.length > 0 && (
          <Select
            value={!isCurrentTerm && filterTerm !== null && filterYear !== null
              ? `${filterTerm}_${filterYear}`
              : '__placeholder__'}
            onValueChange={val => {
              if (val === '__placeholder__') return;
              const [t, y] = val.split('_').map(Number);
              setFilterTerm(t);
              setFilterYear(y);
            }}
          >
            <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-xl border-[#7a1f2b]/15 text-xs">
              <SelectValue placeholder="Previous terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__placeholder__" disabled>Previous terms</SelectItem>
              {prevTermOptions.map(opt => (
                <SelectItem key={`${opt.term}_${opt.year}`} value={`${opt.term}_${opt.year}`}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!pending && classPerformance.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {classPerformance.length} class{classPerformance.length !== 1 ? 'es' : ''} with results
          </span>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {pending ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl animate-pulse"
              style={{ background: 'rgba(122,31,43,0.06)' }} />
          ))}
        </div>

      ) : resultsError ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.10)' }}>
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <p className="font-semibold text-[#3a1b1f]">Failed to load performance data</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Check your connection and try again.</p>
          <Button variant="outline" size="sm"
            onClick={() => void refetchResults()}
            className="gap-2 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>

      ) : classPerformance.length === 0 ? (
        <EmptyState termLabel={selectedLabel} />

      ) : (
        <div className="space-y-2.5">
          {classPerformance.map(cp => (
            <ClassPerfCard key={cp.classId} cp={cp} />
          ))}
        </div>
      )}
    </div>
  );
}