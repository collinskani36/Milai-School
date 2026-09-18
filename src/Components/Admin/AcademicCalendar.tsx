// src/Components/Admin/AcademicCalendar.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, Plus, Zap, Pencil, Trash2, ChevronRight, X, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

// ─── Design tokens (mirrors Teacher / Student / Admin sections) ──────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcademicTerm {
  id: string;
  academic_year: string;
  term: number;
  term_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: 'upcoming' | 'active' | 'closed';
  created_at: string;
}

interface TermForm {
  academic_year: string;
  term: number;
  start_date: string;
  end_date: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TERMS = [1, 2, 3] as const;

function generateAcademicYears(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => `${current - 1 + i}-${current + i}`);
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function weeksBetween(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 7));
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
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

function StatusBadge({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  if (isCurrent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        Active
      </span>
    );
  }
  if (status === 'closed') {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b]/60">
        Closed
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      Upcoming
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AcademicCalendar() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<AcademicTerm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AcademicTerm | null>(null);

  const currentYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const emptyForm: TermForm = { academic_year: currentYear, term: 1, start_date: '', end_date: '' };
  const [form, setForm] = useState<TermForm>(emptyForm);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTerms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('academic_calendar')
      .select('*')
      .order('academic_year', { ascending: false })
      .order('term', { ascending: true });

    if (error) setError(error.message);
    else setTerms(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(null); setError(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  function openCreate(presetYear?: string, presetTerm?: number) {
    setEditItem(null);
    setForm({ ...emptyForm, academic_year: presetYear || currentYear, term: presetTerm || 1 });
    setShowForm(true);
  }

  function openEdit(item: AcademicTerm) {
    setEditItem(item);
    setForm({ academic_year: item.academic_year, term: item.term, start_date: item.start_date, end_date: item.end_date });
    setShowForm(true);
  }

  function cancelForm() { setShowForm(false); setEditItem(null); setForm(emptyForm); }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.start_date || !form.end_date) { setError('Please fill in both date fields.'); return; }
    if (form.end_date <= form.start_date) { setError('End date must be after start date.'); return; }

    setSaving(true);
    setError(null);

    const payload = { academic_year: form.academic_year, term: Number(form.term), start_date: form.start_date, end_date: form.end_date };

    const result = editItem
      ? await supabase.from('academic_calendar').update(payload).eq('id', editItem.id)
      : await supabase.from('academic_calendar').insert([{ ...payload, status: 'upcoming', is_current: false }]);

    if (result.error) { setError(result.error.message); }
    else { setSuccess(editItem ? 'Term updated successfully.' : 'Term created successfully.'); cancelForm(); fetchTerms(); }
    setSaving(false);
  }

  // ── Activate ───────────────────────────────────────────────────────────────
  async function handleActivate(item: AcademicTerm) {
    setActivating(item.id);
    const { error } = await supabase.rpc('activate_term', { p_calendar_id: item.id });
    if (error) setError(error.message);
    else { setSuccess(`Term ${item.term}, ${item.academic_year} is now active!`); fetchTerms(); }
    setActivating(null);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(item: AcademicTerm) {
    if (item.is_current) { setError('Cannot delete the currently active term.'); return; }
    const { error } = await supabase.from('academic_calendar').delete().eq('id', item.id);
    if (error) setError(error.message);
    else { setSuccess('Term deleted.'); fetchTerms(); }
    setDeleteConfirm(null);
  }

  // ── Group by year ──────────────────────────────────────────────────────────
  const grouped = terms.reduce<Record<string, AcademicTerm[]>>((acc, t) => {
    acc[t.academic_year] = acc[t.academic_year] || [];
    acc[t.academic_year].push(t);
    return acc;
  }, {});

  const currentTerm = terms.find((t) => t.is_current);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      {/* ── Page header card ── */}
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={CalendarDays}
          microLabel="Schedule"
          title="Academic Calendar"
          description="Set term dates and manage the active term for the school year"
          right={
            <button
              onClick={() => openCreate()}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-white text-xs font-medium active:scale-[0.98] border border-white/20 bg-white/15 hover:bg-white/25 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Term
            </button>
          }
        />
        {/* Mobile-only action row (bigger touch target) */}
        <div className="sm:hidden p-3 border-b border-[#7a1f2b]/10 bg-[#fdfbfb]">
          <Button
            onClick={() => openCreate()}
            className="w-full h-10 rounded-xl text-white border-0 active:scale-[0.98]"
            style={GRADIENT_BTN_STYLE}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Term
          </Button>
        </div>
      </Card>

      {/* ── Active Term Banner ── */}
      {currentTerm && (
        <div
          className="relative overflow-hidden rounded-2xl p-4 text-white"
          style={{ background: MAROON_GRADIENT, boxShadow: '0 18px 40px -22px rgba(122,31,43,0.45)' }}
        >
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)' }} />
          <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)' }} />

          <div className="relative flex items-center gap-3 flex-wrap">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                Currently Active
              </p>
              <p className="text-white font-bold text-base leading-tight">
                Term {currentTerm.term}, {currentTerm.academic_year}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
            <p className="text-sm text-white/80">
              {fmtDate(currentTerm.start_date)} → {fmtDate(currentTerm.end_date)}
            </p>
            {currentTerm.term === 3 && (
              <span className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-50 flex items-center gap-1.5">
                🎓 Term 3 — Student Promotion available in Classes
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      {error && (
        <div className="rounded-xl p-3 text-sm border border-red-200 bg-red-50 text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl p-3 text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Calendar grid ── */}
      {loading ? (
        <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white" style={{ boxShadow: CARD_SHADOW }}>
          <CardContent className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 mx-auto border-2"
                style={{ borderColor: 'rgba(122,31,43,0.15)', borderBottomColor: MAROON }} />
              <p className="mt-3 text-sm text-[#6b4b50] font-medium">Loading calendar…</p>
            </div>
          </CardContent>
        </Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-[#7a1f2b]/20 bg-white" style={{ boxShadow: CARD_SHADOW }}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(122,31,43,0.06)' }}>
              <CalendarDays className="h-6 w-6 text-[#7a1f2b]/40" />
            </div>
            <p className="text-[#3a1b1f] font-semibold">No terms configured yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Click <strong>Add Term</strong> to set up your first term
            </p>
            <Button
              onClick={() => openCreate()}
              className="mt-2 h-10 rounded-xl text-white border-0 active:scale-[0.98]"
              style={GRADIENT_BTN_STYLE}
            >
              <Plus className="h-4 w-4 mr-1.5" />Add First Term
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([year, yearTerms]) => (
            <div key={year} className="space-y-3">
              {/* Year heading */}
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#7a1f2b]/10">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(122,31,43,0.08)' }}>
                    <CalendarDays className="h-3.5 w-3.5 text-[#7a1f2b]" />
                  </div>
                  <h3 className="font-semibold text-[#3a1b1f] truncate">
                    Academic Year <span className="text-[#7a1f2b]">{year}</span>
                  </h3>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold bg-[#7a1f2b]/8 px-2.5 py-1 rounded-full shrink-0">
                  {yearTerms.length}/3 terms
                </span>
              </div>

              {/* 3-column term cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {TERMS.map((termNum) => {
                  const t = yearTerms.find((x) => x.term === termNum);

                  if (!t) {
                    return (
                      <button
                        key={termNum}
                        type="button"
                        onClick={() => openCreate(year, termNum)}
                        className="rounded-2xl border border-dashed border-[#7a1f2b]/20 bg-[#fdfbfb] hover:bg-[#7a1f2b]/[0.03] hover:border-[#7a1f2b]/40 active:scale-[0.98] transition-all"
                      >
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(122,31,43,0.06)' }}>
                            <Plus className="h-4 w-4 text-[#7a1f2b]/60" />
                          </div>
                          <p className="text-sm font-semibold text-[#3a1b1f]">Term {termNum}</p>
                          <p className="text-xs text-muted-foreground">Not configured · Tap to add</p>
                        </div>
                      </button>
                    );
                  }

                  const isActive = t.is_current;

                  return (
                    <Card
                      key={t.id}
                      className={`rounded-2xl bg-white overflow-hidden transition-all ${
                        isActive ? 'border-2 border-[#7a1f2b]/40' : 'border border-[#7a1f2b]/10 hover:-translate-y-0.5'
                      }`}
                      style={{
                        boxShadow: isActive ? '0 12px 32px -18px rgba(122,31,43,0.5)' : CARD_SHADOW,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW;
                      }}
                    >
                      {/* Header strip */}
                      <div className={`px-4 py-3 flex items-center justify-between gap-2 border-b ${
                        isActive ? 'border-[#7a1f2b]/15' : 'border-[#7a1f2b]/8'
                      }`}
                        style={isActive ? { background: 'rgba(122,31,43,0.04)' } : undefined}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={GRADIENT_BTN_STYLE}
                          >
                            T{t.term}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#3a1b1f] leading-tight truncate">
                              Term {t.term}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {year}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={t.status} isCurrent={t.is_current} />
                      </div>

                      {/* Body */}
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Start</span>
                            <span className="text-[#3a1b1f] font-medium">{fmtDate(t.start_date)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">End</span>
                            <span className="text-[#3a1b1f] font-medium">{fmtDate(t.end_date)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-[#7a1f2b]/5">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Duration</span>
                            <span className="text-[#7a1f2b] font-bold text-sm">
                              {weeksBetween(t.start_date, t.end_date)} <span className="text-[11px] font-medium opacity-70">weeks</span>
                            </span>
                          </div>
                        </div>

                        {t.term === 3 && t.status === 'closed' && (
                          <div className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-2 text-center font-medium">
                            🎓 Promotion ready — go to Classes
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1">
                          {!t.is_current && t.status !== 'closed' && (
                            <Button
                              size="sm"
                              className="flex-1 h-9 text-xs rounded-xl text-white border-0 active:scale-[0.98]"
                              style={GRADIENT_BTN_STYLE}
                              onClick={() => handleActivate(t)}
                              disabled={activating === t.id}
                            >
                              <Zap className="h-3.5 w-3.5 mr-1" />
                              {activating === t.id ? 'Activating…' : 'Activate'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 rounded-lg hover:bg-[#7a1f2b]/5 active:scale-95 shrink-0"
                            onClick={() => openEdit(t)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#7a1f2b]/70" />
                          </Button>
                          {!t.is_current && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 active:scale-95 shrink-0"
                              onClick={() => setDeleteConfirm(t)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
      )}

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 transition-opacity ${
          showForm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!showForm}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={cancelForm} />
        <div
          className={`relative w-full sm:max-w-[520px] max-h-[92vh] flex flex-col bg-white rounded-2xl border border-[#7a1f2b]/15 overflow-hidden transition-transform duration-200 ${
            showForm ? 'scale-100' : 'scale-95'
          }`}
          style={{ boxShadow: '0 24px 60px -24px rgba(122,31,43,0.45)' }}
          role="dialog"
          aria-modal="true"
        >
          <DialogHero
            icon={editItem ? Pencil : Plus}
            microLabel={editItem ? 'Update' : 'New'}
            title={editItem ? 'Edit Term' : 'Add New Term'}
            subtitle="Set academic year, term number and date range"
          />
          <button
            onClick={cancelForm}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#fdfbfb]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">
                    Academic Year
                  </label>
                  <select
                    className="w-full h-10 rounded-xl border border-[#7a1f2b]/15 px-3 text-sm bg-white text-[#3a1b1f] focus:outline-none focus:ring-2 focus:ring-[#7a1f2b]/30 disabled:opacity-60"
                    value={form.academic_year}
                    onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                    disabled={!!editItem}
                  >
                    {generateAcademicYears().map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">
                    Term
                  </label>
                  <select
                    className="w-full h-10 rounded-xl border border-[#7a1f2b]/15 px-3 text-sm bg-white text-[#3a1b1f] focus:outline-none focus:ring-2 focus:ring-[#7a1f2b]/30 disabled:opacity-60"
                    value={form.term}
                    onChange={(e) => setForm({ ...form, term: Number(e.target.value) })}
                    disabled={!!editItem}
                  >
                    {TERMS.map((t) => <option key={t} value={t}>Term {t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
                  />
                </div>
              </div>

              {form.start_date && form.end_date && form.end_date > form.start_date && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-[#7a1f2b]/15"
                  style={{ background: 'rgba(122,31,43,0.04)' }}>
                  <span className="text-base">📆</span>
                  <span className="text-xs text-[#7a1f2b] font-medium">
                    Duration: <strong>{weeksBetween(form.start_date, form.end_date)} weeks</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-[#7a1f2b]/10 bg-white">
            <Button
              variant="outline"
              onClick={cancelForm}
              disabled={saving}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
              style={GRADIENT_BTN_STYLE}
            >
              {saving ? 'Saving…' : editItem ? 'Update Term' : 'Create Term'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 transition-opacity ${
          deleteConfirm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!deleteConfirm}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDeleteConfirm(null)} />
        <div
          className={`relative w-full sm:max-w-[420px] bg-white rounded-2xl border border-[#7a1f2b]/15 overflow-hidden transition-transform duration-200 ${
            deleteConfirm ? 'scale-100' : 'scale-95'
          }`}
          style={{ boxShadow: '0 24px 60px -24px rgba(122,31,43,0.45)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#3a1b1f]">Delete Term</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-snug">
                  Are you sure you want to delete{' '}
                  <strong className="text-[#3a1b1f]">
                    Term {deleteConfirm?.term}, {deleteConfirm?.academic_year}
                  </strong>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#7a1f2b]/10">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white border-0 active:scale-[0.98]"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}