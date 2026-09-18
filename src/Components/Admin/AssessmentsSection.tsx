// src/Components/Admin/AssessmentsSection.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
  Plus, ClipboardList, Loader2, AlertTriangle,
  Eye, Trash2, Users, Hash, BookOpen,
  CalendarDays, ChevronDown, ChevronRight, RefreshCw, X,
} from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
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

// ─── Design tokens (mirrors every other Admin section) ───────────────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};

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
  if (t === 1) return 'bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15';
  if (t === 2) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (t === 3) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return 'bg-gray-100 text-gray-700 border border-gray-200';
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, microLabel, title, description, right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; description?: string; right?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden px-4 sm:px-5 py-3.5" style={{ background: MAROON_GRADIENT }}>
      <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
      <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)' }} />
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">{microLabel}</p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{title}</h3>
          {description && (
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">{description}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

function DialogHero({
  icon: Icon, microLabel, title, subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden shrink-0" style={{ background: MAROON_GRADIENT }}>
      <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
      <div className="relative px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">{microLabel}</p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ id, draftLabel = 'drafts', getStatus, statusReady }: {
  id: string; draftLabel?: string;
  getStatus: (id: string) => StatusResult; statusReady: boolean;
}) {
  if (!statusReady) {
    return <span className="inline-block h-5 w-20 rounded-full animate-pulse" style={{ background: 'rgba(122,31,43,0.08)' }} />;
  }
  const { hasDrafts, isPublished, draftCount } = getStatus(id);
  if (hasDrafts) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        {draftCount} {draftLabel}
      </span>
    );
  }
  if (isPublished) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        Published
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">No results</span>;
}

function ActiveTermBanner({ term }: { term: ActiveTerm | null | undefined }) {
  if (term === undefined) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2 border border-[#7a1f2b]/10 bg-white"
        style={{ boxShadow: CARD_SHADOW }}>
        <Loader2 className="h-4 w-4 animate-spin text-[#7a1f2b]" />
        Loading active term…
      </div>
    );
  }
  if (!term) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2 border border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          No active term found. Please activate a term in <strong>Academic Calendar</strong> before creating assessments.
        </span>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl px-4 py-3 text-white"
      style={{ background: MAROON_GRADIENT, boxShadow: '0 12px 30px -20px rgba(122,31,43,0.45)' }}>
      <div className="absolute -top-16 -right-8 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
      <div className="relative flex items-center gap-3 flex-wrap">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
        <span className="text-sm">
          Active Term: <strong>Term {term.term}, {term.academic_year}</strong>
          <span className="ml-2 text-white/70 font-normal text-xs">
            ({fmtDate(term.start_date)} → {fmtDate(term.end_date)})
          </span>
        </span>
      </div>
    </div>
  );
}

function FetchErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(245,158,11,0.10)' }}>
        <AlertTriangle className="w-6 h-6 text-amber-500" />
      </div>
      <p className="font-semibold text-[#3a1b1f]">Failed to load assessments</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Check your connection and try again.</p>
      <Button variant="outline" size="sm" onClick={onRetry}
        className="gap-2 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
        <RefreshCw className="w-4 h-4" /> Retry
      </Button>
    </div>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(122,31,43,0.06)' }} />
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
    <TableRow className="border-b border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.03] transition-colors">
      <TableCell className="py-3">
        <div className="font-medium text-[#3a1b1f]">{a.title}</div>
        {a.assessment_date && (
          <div className="text-xs text-[#7a1f2b]/70 mt-0.5 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />{fmtDate(a.assessment_date)}
          </div>
        )}
      </TableCell>
      <TableCell><Badge className={termBadgeColor(a.term)}>Term {a.term}</Badge></TableCell>
      <TableCell className="text-sm text-[#3a1b1f]/80">{a.year}-{a.year + 1}</TableCell>
      <TableCell className="text-sm text-[#3a1b1f]/80">{a.max_marks ?? 100}</TableCell>
      <TableCell><StatusBadge id={a.id} getStatus={getStatus} statusReady={statusReady} /></TableCell>
      <TableCell>
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]"
            onClick={() => onView(a)}>
            <Eye className="w-3 h-3 mr-1" />View
          </Button>
          <Button variant="outline" size="sm"
            className="h-8 rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-[0.98]"
            onClick={() => onPublish(a.id)} disabled={!statusReady || !hasDrafts || busy}>
            {busy ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm"
            className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98]"
            onClick={() => onDelete(a)}>
            <Trash2 className="w-3 h-3 mr-1" />Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SummativeMobileCard({ a, getClassName, getStatus, statusReady, onView, onPublish, onDelete, publishingId }: SummativeRowProps) {
  const { hasDrafts, isPublished } = getStatus(a.id);
  const busy = publishingId === a.id;
  return (
    <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-3.5" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-[#3a1b1f] mb-1 truncate">{a.title}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 truncate">
            <Users className="w-3 h-3 shrink-0" />
            {a.classes?.name ?? getClassName(a.class_id)}
          </div>
          {a.assessment_date && (
            <div className="flex items-center gap-1 text-[11px] text-[#7a1f2b]/70">
              <CalendarDays className="w-3 h-3" />{fmtDate(a.assessment_date)}
            </div>
          )}
        </div>
        <Badge className={`${termBadgeColor(a.term)} text-[10px] shrink-0`}>Term {a.term}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="flex items-center gap-1 text-[#3a1b1f]/80">
          <Hash className="w-3 h-3 text-[#7a1f2b]/40" />{a.year}-{a.year + 1}
        </div>
        <div className="text-[#3a1b1f]/80">Max: <strong className="text-[#7a1f2b]">{a.max_marks ?? 100}</strong></div>
      </div>
      <div className="flex items-center justify-between border-t border-[#7a1f2b]/8 pt-2.5">
        <StatusBadge id={a.id} getStatus={getStatus} statusReady={statusReady} />
        <Button variant="outline" size="sm"
          className="h-7 text-[11px] rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-[0.98]"
          onClick={() => onPublish(a.id)} disabled={!statusReady || !hasDrafts || busy}>
          {busy ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 pt-3">
        <Button variant="outline" size="sm"
          className="h-9 flex-1 rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]"
          onClick={() => onView(a)}>
          <Eye className="w-3 h-3 mr-1" />View
        </Button>
        <Button variant="outline" size="sm"
          className="h-9 flex-1 rounded-lg border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98]"
          onClick={() => onDelete(a)}>
          <Trash2 className="w-3 h-3 mr-1" />Delete
        </Button>
      </div>
    </Card>
  );
}

// ─── Formative inline results panel ──────────────────────────────────────────
const LEVEL_STYLES: Record<string, string> = {
  EE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ME: 'bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/20',
  AE: 'bg-amber-50 text-amber-700 border-amber-200',
  BE: 'bg-red-50 text-red-700 border-red-200',
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
        setResults(
          (data ?? []).map(row => ({
            ...row,
            students: Array.isArray(row.students) ? (row.students[0] ?? null) : row.students,
          })) as typeof results,
        );
        setLoading(false);
      });
  }, [fa.id]);

  return (
    <div className="border-t border-[#7a1f2b]/10 px-4 py-3 space-y-3"
      style={{ background: 'rgba(122,31,43,0.03)' }}>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span><span className="font-semibold text-[#7a1f2b]/70">Date:</span> {fmtDate(fa.activity_date)}</span>
        <span><span className="font-semibold text-[#7a1f2b]/70">Term:</span> {fa.term} · {fa.year}-{fa.year + 1}</span>
        {fa.strands?.name && (
          <span>
            <span className="font-semibold text-[#7a1f2b]/70">Strand:</span> {fa.strands.name}
            {fa.sub_strands?.name && <> › {fa.sub_strands.name}</>}
          </span>
        )}
        {fa.subjects?.name && (
          <span><span className="font-semibold text-[#7a1f2b]/70">Subject:</span> {fa.subjects.name}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#7a1f2b]" />Loading results…
        </div>
      ) : err ? (
        <div className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{err}</div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No results recorded yet.</p>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#7a1f2b]/10 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                  <TableHead className="py-2 text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Reg No</TableHead>
                  <TableHead className="py-2 text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Student Name</TableHead>
                  <TableHead className="py-2 text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.student_id} className={`border-b border-[#7a1f2b]/5 ${r.is_absent ? "opacity-50" : ""}`}>
                    <TableCell className="py-2 font-mono text-xs text-[#3a1b1f]">{r.students?.Reg_no ?? "—"}</TableCell>
                    <TableCell className="py-2 text-sm text-[#3a1b1f]">
                      {r.students ? `${r.students.first_name} ${r.students.last_name}` : "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      {r.is_absent ? (
                        <span className="text-[11px] text-muted-foreground italic">Absent</span>
                      ) : r.performance_level ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${LEVEL_STYLES[r.performance_level] ?? "bg-gray-100 text-gray-700"}`}>
                          {r.performance_level}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="sm:hidden space-y-1.5">
            {results.map(r => (
              <div key={r.student_id}
                className={`flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#7a1f2b]/10 ${r.is_absent ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-muted-foreground">{r.students?.Reg_no}</div>
                  <div className="text-sm font-medium text-[#3a1b1f] truncate">
                    {r.students ? `${r.students.first_name} ${r.students.last_name}` : "—"}
                  </div>
                </div>
                {r.is_absent ? <span className="text-[11px] text-muted-foreground italic shrink-0">Absent</span>
                  : r.performance_level ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold shrink-0 ${LEVEL_STYLES[r.performance_level] ?? "bg-gray-100 text-gray-700"}`}>{r.performance_level}</span>
                  : <span className="text-xs text-muted-foreground shrink-0">—</span>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-[#7a1f2b]">{results.filter(r => !r.is_absent).length}</span> result{results.length !== 1 ? "s" : ""} · {results.filter(r => r.is_absent).length} absent
          </p>
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
    <TableRow className={`border-b border-[#7a1f2b]/5 transition-colors ${isExpanded ? 'bg-[#7a1f2b]/[0.04]' : 'hover:bg-[#7a1f2b]/[0.02]'}`}>
      <TableCell className="py-3 pl-10">
        <div className="font-medium text-[#3a1b1f]">{fa.title}</div>
        {fa.description && <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-xs">{fa.description}</div>}
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">{fmtDate(fa.activity_date)}</div>
        {fa.sub_strands?.name && <div className="text-[11px] text-[#7a1f2b]/70 mt-0.5">↳ {fa.sub_strands.name}</div>}
      </TableCell>
      <TableCell><Badge className={termBadgeColor(fa.term)}>Term {fa.term}</Badge></TableCell>
      <TableCell className="text-sm text-[#3a1b1f]/80">{fa.year}-{fa.year + 1}</TableCell>
      <TableCell>
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Published
        </span>
      </TableCell>
      <TableCell>
        <Button variant="outline" size="sm"
          className={`h-8 rounded-lg active:scale-[0.98] ${
            isExpanded
              ? 'border-[#7a1f2b]/40 text-[#7a1f2b]'
              : 'border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]'
          }`}
          style={isExpanded ? { background: 'rgba(122,31,43,0.06)' } : undefined}
          onClick={() => onView(fa)}>
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
    <Card
      className={`rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden ${isExpanded ? 'rounded-b-none' : ''}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex justify-between items-start p-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#3a1b1f] truncate">{fa.title}</div>
          {fa.sub_strands?.name && <div className="text-[11px] text-[#7a1f2b]/70">↳ {fa.sub_strands.name}</div>}
          {fa.description && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{fa.description}</div>}
          <div className="text-[11px] text-muted-foreground/70 mt-0.5">{fmtDate(fa.activity_date)}</div>
          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1.5">
            Published
          </span>
        </div>
        <Button variant="outline" size="sm"
          className={`h-8 ml-2 shrink-0 rounded-lg active:scale-[0.98] ${
            isExpanded
              ? 'border-[#7a1f2b]/40 text-[#7a1f2b]'
              : 'border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]'
          }`}
          style={isExpanded ? { background: 'rgba(122,31,43,0.06)' } : undefined}
          onClick={() => onView(fa)}>
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
        return (data ?? []).map(row => ({
          ...row,
          classes: Array.isArray(row.classes) ? (row.classes[0] ?? null) : row.classes,
        })) as Assessment[];
      },
    });

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
        return (data ?? []).map(row => ({
          ...row,
          classes:     Array.isArray(row.classes)     ? (row.classes[0]     ?? null) : row.classes,
          strands:     Array.isArray(row.strands)     ? (row.strands[0]     ?? null) : row.strands,
          sub_strands: Array.isArray(row.sub_strands) ? (row.sub_strands[0] ?? null) : row.sub_strands,
          subjects:    Array.isArray(row.subjects)    ? (row.subjects[0]    ?? null) : row.subjects,
          teachers:    Array.isArray(row.teachers)    ? (row.teachers[0]    ?? null) : row.teachers,
        })) as FormativeActivity[];
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

  // ── Summative status map — lazy per-class loading ──────────────────────────
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

  const refreshStatusForClass = useCallback((assessmentId: string, allAssessments: Assessment[]) => {
    const a = allAssessments.find(x => x.id === assessmentId);
    if (!a) return;
    const ids = allAssessments.filter(x => x.class_id === a.class_id).map(x => x.id);
    setLoadedClassIds(prev => { const n = new Set(prev); n.delete(a.class_id); return n; });
    setResultStatusMap(prev => { const n = { ...prev }; ids.forEach(id => { delete n[id]; }); return n; });
    void fetchStatusForClass(a.class_id, ids);
  }, [fetchStatusForClass]);

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

  const toggleSummClass = (classId: string, classAsmIds: string[]) => {
    setExpandedSummClasses(prev => {
      const n = new Set(prev);
      if (n.has(classId)) {
        n.delete(classId);
      } else {
        n.add(classId);
        if (!loadedClassIds.has(classId) && !loadingClassIds.has(classId)) {
          void fetchStatusForClass(classId, classAsmIds);
        }
      }
      return n;
    });
  };

  const toggleFormClass = (id: string) =>
    setExpandedFormClasses(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const toggleSubject = (key: string) =>
    setExpandedSubjects(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleStrand = (key: string) =>
    setExpandedStrands(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

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
      setResultStatusMap(prev => {
        const e = prev[assessmentId]; if (!e) return prev;
        return { ...prev, [assessmentId]: { drafts: 0, published: e.published + e.drafts } };
      });
      refreshStatusForClass(assessmentId, assessments);
      setPublishError(null); setPublishingId(null);
    },
    onError: (err: Error) => { setPublishError(err.message || 'Failed to publish.'); setPublishingId(null); },
  });
  const publishRef = useRef(publishMutation);
  publishRef.current = publishMutation;

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
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      <ActiveTermBanner term={termLoading ? undefined : activeTerm} />

      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={ClipboardList}
          microLabel="Assessment"
          title="Assessments"
          description="Manage summative exams and review formative activities across classes"
          right={
            <button
              onClick={() => { setShowAddModal(true); setFormError(null); }}
              disabled={!activeTerm}
              title={!activeTerm ? 'Activate a term first' : undefined}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-white text-xs font-medium border border-white/20 bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" /> Create Assessment
            </button>
          }
        />

        <div className="sm:hidden p-3 border-b border-[#7a1f2b]/10 bg-[#fdfbfb]">
          <Button
            onClick={() => { setShowAddModal(true); setFormError(null); }}
            disabled={!activeTerm}
            className="w-full h-10 rounded-xl text-white border-0 active:scale-[0.98] disabled:opacity-40"
            style={activeTerm ? GRADIENT_BTN_STYLE : undefined}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create Assessment
          </Button>
        </div>

        <CardContent className="p-3 sm:p-5">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'summative' | 'formative')}>
            <TabsList className="mb-4 w-full sm:w-auto rounded-xl bg-[#7a1f2b]/5 p-1 h-auto">
              <TabsTrigger
                value="summative"
                className="flex-1 sm:flex-none rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#7a1f2b] data-[state=active]:shadow-sm text-xs sm:text-sm py-2"
              >
                Exams / Summative
                <Badge className="ml-2 bg-[#7a1f2b]/10 text-[#7a1f2b] border-[#7a1f2b]/20 text-[10px]">{assessments.length}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="formative"
                className="flex-1 sm:flex-none rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#7a1f2b] data-[state=active]:shadow-sm text-xs sm:text-sm py-2"
              >
                Formative Activities
                <Badge className="ml-2 bg-[#7a1f2b]/10 text-[#7a1f2b] border-[#7a1f2b]/20 text-[10px]">{formativeActivities.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ══════════════ SUMMATIVE TAB ══════════════ */}
            <TabsContent value="summative">
              {assessmentsError ? (
                <FetchErrorState onRetry={() => void refetchAssessments()} />
              ) : assessmentsLoading ? (
                <SkeletonRows count={3} />
              ) : Object.keys(summativeByClass).length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(122,31,43,0.06)' }}>
                    <ClipboardList className="w-6 h-6 text-[#7a1f2b]/40" />
                  </div>
                  <p className="font-semibold text-[#3a1b1f]">No assessments yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click <strong className="text-[#7a1f2b]">Create Assessment</strong> above to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(summativeByClass).map(([classId, group]) => {
                    const isOpen        = expandedSummClasses.has(classId);
                    const classAsmIds   = group.items.map(a => a.id);
                    const statusLoading = isClassStatusLoading(classId);
                    return (
                      <div key={classId}
                        className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden"
                        style={{ boxShadow: CARD_SHADOW }}>
                        <button
                          className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-3 text-left transition-colors active:scale-[0.995] ${
                            isOpen ? 'text-white' : 'hover:bg-[#7a1f2b]/[0.04]'
                          }`}
                          style={isOpen ? { background: MAROON_GRADIENT } : undefined}
                          onClick={() => toggleSummClass(classId, classAsmIds)}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-white/15 border border-white/20' : ''}`}
                              style={!isOpen ? { background: 'rgba(122,31,43,0.08)' } : undefined}
                            >
                              <Users className={`h-4 w-4 ${isOpen ? 'text-white' : 'text-[#7a1f2b]'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className={`font-semibold text-sm truncate ${isOpen ? 'text-white' : 'text-[#3a1b1f]'}`}>
                                {group.className}
                              </div>
                              {group.gradeLevel && (
                                <div className={`text-[10px] uppercase tracking-wider ${isOpen ? 'text-white/70' : 'text-muted-foreground'}`}>
                                  Grade {group.gradeLevel}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
                                isOpen
                                  ? 'bg-white/20 text-white border border-white/15'
                                  : 'bg-[#7a1f2b]/10 text-[#7a1f2b] border border-[#7a1f2b]/20'
                              }`}
                            >
                              {group.items.length}
                            </span>
                          </div>
                          {isOpen
                            ? <ChevronDown className="h-4 w-4 text-white/80 shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-[#7a1f2b]/40 shrink-0" />}
                        </button>

                        {isOpen && (
                          statusLoading ? (
                            <div className="px-4 py-3 bg-white"><SkeletonRows count={group.items.length} /></div>
                          ) : (
                            <>
                              <div className="sm:hidden divide-y divide-[#7a1f2b]/5 bg-[#fdfbfb] p-2.5 space-y-2.5">
                                {group.items.map(a => (
                                  <SummativeMobileCard key={a.id} a={a} getClassName={getClassName} getStatus={getStatus}
                                    statusReady={!statusLoading} onView={handleView} onPublish={handlePublish}
                                    onDelete={confirmDelete} publishingId={publishingId} />
                                ))}
                              </div>
                              <div className="hidden sm:block overflow-x-auto bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                                      <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Title / Date</TableHead>
                                      <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Term</TableHead>
                                      <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Academic Year</TableHead>
                                      <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Max Marks</TableHead>
                                      <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Status</TableHead>
                                      <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Actions</TableHead>
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

            {/* ══════════════ FORMATIVE TAB ══════════════ */}
            <TabsContent value="formative">
              <div className="mb-3 rounded-xl px-3 py-2.5 text-xs text-[#7a1f2b] leading-relaxed border border-[#7a1f2b]/15 flex items-start gap-2"
                style={{ background: 'rgba(122,31,43,0.04)' }}>
                <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Formative activities are recorded by teachers. Grouped by class, then subject, then strand.</span>
              </div>

              {formativeError ? (
                <FetchErrorState onRetry={() => void refetchFormative()} />
              ) : formativeLoading ? (
                <SkeletonRows count={2} />
              ) : Object.keys(formativeByClass).length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(122,31,43,0.06)' }}>
                    <BookOpen className="w-6 h-6 text-[#7a1f2b]/40" />
                  </div>
                  <p className="font-semibold text-[#3a1b1f]">No formative activities yet</p>
                  <p className="text-sm text-muted-foreground mt-1">These appear here when teachers record class activities.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(formativeByClass).map(([classId, classGroup]) => {
                    const isClassOpen = expandedFormClasses.has(classId);
                    const totalItems  = Object.values(classGroup.subjects)
                      .flatMap(sg => Object.values(sg.strands))
                      .reduce((s, g) => s + g.items.length, 0);
                    return (
                      <div key={classId}
                        className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden"
                        style={{ boxShadow: CARD_SHADOW }}>

                        {/* Class header */}
                        <button
                          className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-3 text-left transition-colors active:scale-[0.995] ${
                            isClassOpen ? 'text-white' : 'hover:bg-[#7a1f2b]/[0.04]'
                          }`}
                          style={isClassOpen ? { background: MAROON_GRADIENT } : undefined}
                          onClick={() => toggleFormClass(classId)}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isClassOpen ? 'bg-white/15 border border-white/20' : ''}`}
                              style={!isClassOpen ? { background: 'rgba(122,31,43,0.08)' } : undefined}
                            >
                              <Users className={`h-4 w-4 ${isClassOpen ? 'text-white' : 'text-[#7a1f2b]'}`} />
                            </div>
                            <div className="min-w-0">
                              <div className={`font-semibold text-sm truncate ${isClassOpen ? 'text-white' : 'text-[#3a1b1f]'}`}>
                                {classGroup.className}
                              </div>
                              {classGroup.gradeLevel && (
                                <div className={`text-[10px] uppercase tracking-wider ${isClassOpen ? 'text-white/70' : 'text-muted-foreground'}`}>
                                  Grade {classGroup.gradeLevel}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
                                isClassOpen
                                  ? 'bg-white/20 text-white border border-white/15'
                                  : 'bg-[#7a1f2b]/10 text-[#7a1f2b] border border-[#7a1f2b]/20'
                              }`}
                            >
                              {totalItems}
                            </span>
                          </div>
                          {isClassOpen
                            ? <ChevronDown className="h-4 w-4 text-white/80 shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-[#7a1f2b]/40 shrink-0" />}
                        </button>

                        {isClassOpen && (
                          <div className="bg-white divide-y divide-[#7a1f2b]/8">
                            {Object.entries(classGroup.subjects).map(([subjectId, subjectGroup]) => {
                              const subjKey     = `${classId}__subj__${subjectId}`;
                              const isSubjOpen  = expandedSubjects.has(subjKey);
                              const subjTotal   = Object.values(subjectGroup.strands).reduce((s, g) => s + g.items.length, 0);
                              return (
                                <div key={subjectId}>

                                  {/* Subject sub-header */}
                                  <button
                                    className={`w-full flex items-center justify-between px-5 py-2.5 text-left transition-colors active:scale-[0.995] ${
                                      isSubjOpen ? 'bg-[#7a1f2b]/[0.05]' : 'bg-[#fdfbfb] hover:bg-[#7a1f2b]/[0.03]'
                                    }`}
                                    onClick={() => toggleSubject(subjKey)}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <ClipboardList className="h-3.5 w-3.5 text-[#7a1f2b] shrink-0" />
                                      <span className="text-sm font-semibold text-[#3a1b1f] truncate">{subjectGroup.subjectName}</span>
                                      <span className="text-[11px] text-muted-foreground shrink-0">
                                        {subjTotal} activit{subjTotal !== 1 ? 'ies' : 'y'}
                                      </span>
                                    </div>
                                    {isSubjOpen
                                      ? <ChevronDown className="h-3.5 w-3.5 text-[#7a1f2b]/60 shrink-0" />
                                      : <ChevronRight className="h-3.5 w-3.5 text-[#7a1f2b]/40 shrink-0" />}
                                  </button>

                                  {isSubjOpen && (
                                    <div className="divide-y divide-[#7a1f2b]/5">
                                      {Object.entries(subjectGroup.strands).map(([strandKey, strandGroup]) => {
                                        const expandKey    = `${classId}__${subjectId}__${strandKey}`;
                                        const isStrandOpen = expandedStrands.has(expandKey);
                                        return (
                                          <div key={strandKey}>

                                            {/* Strand sub-header */}
                                            <button
                                              className={`w-full flex items-center justify-between px-8 py-2 text-left transition-colors active:scale-[0.995] ${
                                                isStrandOpen ? 'bg-[#7a1f2b]/[0.03]' : 'bg-white hover:bg-[#7a1f2b]/[0.02]'
                                              }`}
                                              onClick={() => toggleStrand(expandKey)}>
                                              <div className="flex items-center gap-2 min-w-0">
                                                <BookOpen className="h-3 w-3 text-[#7a1f2b]/50 shrink-0" />
                                                <span className="text-xs font-medium text-[#3a1b1f]/80 truncate">{strandGroup.strandName}</span>
                                                <span className="text-[11px] text-muted-foreground shrink-0">
                                                  {strandGroup.items.length} item{strandGroup.items.length !== 1 ? 's' : ''}
                                                </span>
                                              </div>
                                              {isStrandOpen
                                                ? <ChevronDown className="h-3 w-3 text-[#7a1f2b]/40 shrink-0" />
                                                : <ChevronRight className="h-3 w-3 text-[#7a1f2b]/30 shrink-0" />}
                                            </button>

                                            {isStrandOpen && (
                                              <>
                                                <div className="sm:hidden space-y-2 px-3 py-3 bg-[#fdfbfb]">
                                                  {strandGroup.items.map(fa => (
                                                    <FormativeActivityCard key={fa.id} fa={fa}
                                                      isExpanded={expandedActivityIds.has(fa.id)}
                                                      onView={handleViewFormative} />
                                                  ))}
                                                </div>
                                                <div className="hidden sm:block">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                                                        <TableHead className="pl-10 text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Title / Date</TableHead>
                                                        <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Term</TableHead>
                                                        <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Year</TableHead>
                                                        <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Status</TableHead>
                                                        <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Actions</TableHead>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
          <DialogHero
            icon={Plus}
            microLabel="New Assessment"
            title="Create New Assessment"
            subtitle={activeTerm
              ? `Locked to Term ${activeTerm.term}, ${activeTerm.academic_year}`
              : 'No active term found'}
          />
          <form onSubmit={handleCreateSubmit} className="p-4 sm:p-5">
            <div className="space-y-4 py-1">
              {activeTerm && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-[#7a1f2b]/15"
                  style={{ background: 'rgba(122,31,43,0.04)' }}>
                  <CalendarDays className="h-4 w-4 shrink-0 text-[#7a1f2b]" />
                  <span className="text-xs text-[#7a1f2b]">
                    <strong>Term {activeTerm.term}</strong> · {activeTerm.academic_year} · {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}
                  </span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Assessment Title *
                </Label>
                <Input id="title" name="title" required placeholder="e.g. CAT 1, Mid Term, End Term"
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class_id" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Class *
                </Label>
                <Select name="class_id" required>
                  <SelectTrigger id="class_id" className="h-10 rounded-xl border-[#7a1f2b]/15">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
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
                <Label htmlFor="assessment_date" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Assessment Date *
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                    Applied to all student results
                  </span>
                </Label>
                <Input id="assessment_date" name="assessment_date" type="date" required
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
                  min={activeTerm?.start_date} max={activeTerm?.end_date} />
                {activeTerm && (
                  <p className="text-[11px] text-muted-foreground">
                    Must fall within: {fmtDate(activeTerm.start_date)} → {fmtDate(activeTerm.end_date)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_marks" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Max Marks *
                </Label>
                <Input id="max_marks" name="max_marks" type="number" required defaultValue="100" min="1"
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
            </div>
            {formError && (
              <div className="mt-3 rounded-xl p-3 bg-red-50 text-red-700 text-sm flex items-start gap-2 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button type="submit" disabled={createAssessmentMutation.isPending || !activeTerm}
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98] disabled:opacity-40"
                style={activeTerm ? GRADIENT_BTN_STYLE : undefined}>
                {createAssessmentMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create Assessment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════ Delete Confirmation Dialog ════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              Delete Assessment
            </DialogTitle>
            <DialogDescription className="pt-2 text-[#3a1b1f]/80">
              Are you sure you want to delete <strong className="text-[#3a1b1f]">"{deleteTarget?.title}"</strong>?
              <span className="block mt-1.5 text-red-600 font-medium text-xs">
                This will permanently delete all associated results and cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#7a1f2b]/10 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}
              className="rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl active:scale-[0.98] border-0"
              disabled={deleteAssessmentMutation.isPending}
              onClick={() => { if (!deleteTarget) return; deleteAssessmentMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }}>
              {deleteAssessmentMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
                : <><Trash2 className="w-4 h-4 mr-2" />Yes, Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ Publish error toast ════════ */}
      {publishError && (
        <div
          className="fixed bottom-4 right-4 max-w-sm rounded-2xl border border-red-200 bg-red-50 px-4 py-3 z-50 flex items-start gap-2"
          style={{ boxShadow: '0 18px 40px -18px rgba(220,38,38,0.35)' }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <span className="text-sm text-red-700 flex-1">{publishError}</span>
          <button onClick={() => setPublishError(null)}
            className="w-6 h-6 rounded-lg text-red-500/60 hover:text-red-600 hover:bg-red-100/60 flex items-center justify-center transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}