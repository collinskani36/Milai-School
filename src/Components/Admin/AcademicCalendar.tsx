import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Zap, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/Components/ui/dialog';
import { Badge } from '@/Components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

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

function StatusBadge({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  if (isCurrent) return <Badge className="bg-green-100 text-green-800 border-green-200">● Active</Badge>;
  if (status === 'closed') return <Badge variant="secondary">Closed</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Upcoming</Badge>;
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

  // Auto-dismiss messages
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Academic Calendar</h2>
            <p className="text-sm text-gray-500">Set term dates and manage the active term for the school year</p>
          </div>
        </div>
        <Button onClick={() => openCreate()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Term
        </Button>
      </div>

      {/* Active Term Banner */}
      {currentTerm && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Currently Active</p>
                <p className="font-bold text-gray-900">Term {currentTerm.term}, {currentTerm.academic_year}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-600">{fmtDate(currentTerm.start_date)} → {fmtDate(currentTerm.end_date)}</p>
              {currentTerm.term === 3 && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 ml-auto">
                  🎓 Term 3 — Student Promotion available in Classes
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {error && <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 text-sm">⚠ {error}</div>}
      {success && <div className="p-3 rounded-md bg-green-50 text-green-800 border border-green-200 text-sm">✓ {success}</div>}

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">Loading calendar…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <CalendarDays className="h-12 w-12 text-gray-300" />
            <p className="text-gray-500 font-medium">No terms configured yet</p>
            <p className="text-gray-400 text-sm">Click <strong>Add Term</strong> to set up your first term.</p>
            <Button variant="outline" onClick={() => openCreate()} className="mt-2"><Plus className="h-4 w-4 mr-2" />Add First Term</Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([year, yearTerms]) => (
            <div key={year} className="space-y-3">
              {/* Year heading */}
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-gray-800">Academic Year {year}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{yearTerms.length}/3 terms configured</span>
              </div>

              {/* 3-column term cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TERMS.map((termNum) => {
                  const t = yearTerms.find((x) => x.term === termNum);

                  if (!t) {
                    return (
                      <Card key={termNum} className="border-dashed border-gray-200 bg-gray-50">
                        <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
                          <p className="text-sm font-medium text-gray-400">Term {termNum}</p>
                          <p className="text-xs text-gray-300">Not configured</p>
                          <Button variant="ghost" size="sm" className="mt-1 text-primary" onClick={() => openCreate(year, termNum)}>
                            <Plus className="h-3 w-3 mr-1" /> Configure
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={t.id} className={`transition-all ${t.is_current ? 'border-blue-300 shadow-md ring-1 ring-blue-200' : 'hover:shadow-sm'}`}>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Term {t.term}</CardTitle>
                          <StatusBadge status={t.status} isCurrent={t.is_current} />
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Start</span>
                            <span className="font-medium">{fmtDate(t.start_date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">End</span>
                            <span className="font-medium">{fmtDate(t.end_date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Duration</span>
                            <span className="font-medium">{weeksBetween(t.start_date, t.end_date)} weeks</span>
                          </div>
                        </div>

                        {t.term === 3 && t.status === 'closed' && (
                          <div className="text-xs bg-emerald-50 text-emerald-700 rounded px-2 py-1.5 text-center font-medium">
                            🎓 Promotion ready — go to Classes
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          {!t.is_current && t.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1 h-8 text-xs"
                              onClick={() => handleActivate(t)}
                              disabled={activating === t.id}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              {activating === t.id ? 'Activating…' : 'Activate'}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!t.is_current && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteConfirm(t)}>
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
      <Dialog open={showForm} onOpenChange={cancelForm}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Term' : 'Add New Term'}</DialogTitle>
            <DialogDescription>Set the academic year, term number, and date range.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Academic Year</label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.academic_year}
                  onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                  disabled={!!editItem}
                >
                  {generateAcademicYears().map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Term</label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: Number(e.target.value) })}
                  disabled={!!editItem}
                >
                  {TERMS.map((t) => <option key={t} value={t}>Term {t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">End Date</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>

            {form.start_date && form.end_date && form.end_date > form.start_date && (
              <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
                📆 Duration: {weeksBetween(form.start_date, form.end_date)} weeks
              </p>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={cancelForm} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update Term' : 'Create Term'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Term</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>Term {deleteConfirm?.term}, {deleteConfirm?.academic_year}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}