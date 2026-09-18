// src/Components/Admin/StudentsSection.jsx
import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/Components/ui/input';
import {
  Plus, Search, Pencil, Trash2, UserPlus,
  Upload, X, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import { Skeleton } from '@/Components/ui/skeleton';

// ─── Design tokens (mirrors Teacher / Student / Admin dashboards) ─────────────

const MAROON = '#7a1f2b';
const MAROON_GRADIENT =
  'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
const HERO_SHADOW = '0 18px 40px -22px rgba(122,31,43,0.45)';

// ─── Shared SectionHeader (matches Teacher dashboard) ────────────────────────

function SectionHeader({
  icon: Icon, microLabel, title, description, right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden px-4 sm:px-5 py-3.5"
      style={{ background: MAROON_GRADIENT }}
    >
      <div
        className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)',
        }}
      />
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
            {microLabel}
          </p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">
            {title}
          </h3>
          {description && (
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">
              {description}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BulkRow = {
  reg_no: string;
  first_name: string;
  last_name: string;
  gender: string;
  class_id: string;
  student_type: string;
  guardian_email: string;
  password: string;
  phone: string;
  date_of_birth: string;
  guardian_name: string;
  guardian_phone: string;
};

type RowStatus = 'idle' | 'loading' | 'success' | 'error';
type BulkRowState = BulkRow & { status: RowStatus; error: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const BULK_COLUMNS: {
  key: keyof BulkRow;
  label: string;
  width: string;
  required?: boolean;
  type?: string;
}[] = [
  { key: 'reg_no',         label: 'Reg No',         width: '90px',  required: true },
  { key: 'first_name',     label: 'First Name',     width: '110px', required: true },
  { key: 'last_name',      label: 'Last Name',      width: '110px', required: true },
  { key: 'gender',         label: 'Gender',         width: '90px',  required: true },
  { key: 'class_id',       label: 'Class',          width: '100px', required: true },
  { key: 'student_type',   label: 'Type',           width: '105px' },
  { key: 'guardian_email', label: 'Guardian Email', width: '170px', required: true, type: 'email' },
  { key: 'password',       label: 'Password',       width: '110px', type: 'password' },
  { key: 'phone',          label: 'Phone',          width: '110px' },
  { key: 'date_of_birth',  label: 'DOB',            width: '120px', type: 'date' },
  { key: 'guardian_name',  label: 'Guardian',       width: '120px' },
  { key: 'guardian_phone', label: 'Guard. Phone',   width: '120px' },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const TYPE_OPTIONS   = ['Day Scholar', 'Boarding'];

function emptyRow(): BulkRowState {
  return {
    reg_no: '', first_name: '', last_name: '', gender: '',
    class_id: '', student_type: 'Day Scholar', guardian_email: '',
    password: '', phone: '', date_of_birth: '', guardian_name: '',
    guardian_phone: '', status: 'idle', error: '',
  };
}

// ─── Bulk Add Modal ───────────────────────────────────────────────────────────

function BulkAddModal({
  open, onClose, classes, onAllDone,
}: {
  open: boolean;
  onClose: () => void;
  classes: { id: string; name: string }[];
  onAllDone: () => void;
}) {
  const INITIAL_ROWS = 10;
  const [rows, setRows]             = useState<BulkRowState[]>(() => Array.from({ length: INITIAL_ROWS }, emptyRow));
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const cellRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[][]>([]);
  const { toast } = useToast();
  const colCount  = BULK_COLUMNS.length;

  const getRef = (r: number, c: number) => {
    if (!cellRefs.current[r]) cellRefs.current[r] = [];
    return (el: HTMLInputElement | HTMLSelectElement | null) => { cellRefs.current[r][c] = el; };
  };

  const focusCell = useCallback((r: number, c: number) => {
    const el = cellRefs.current[r]?.[c];
    if (el) { el.focus(); if ((el as HTMLInputElement).select) (el as HTMLInputElement).select(); }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < colCount) {
        focusCell(rowIdx, nextCol);
      } else {
        const nextRow = rowIdx + 1;
        if (nextRow >= rows.length) { setRows(prev => [...prev, emptyRow()]); setTimeout(() => focusCell(nextRow, 0), 30); }
        else focusCell(nextRow, 0);
      }
    } else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value?.length) {
      e.preventDefault(); if (colIdx + 1 < colCount) focusCell(rowIdx, colIdx + 1);
    } else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) {
      e.preventDefault(); if (colIdx - 1 >= 0) focusCell(rowIdx, colIdx - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = rowIdx + 1;
      if (nextRow >= rows.length) { setRows(prev => [...prev, emptyRow()]); setTimeout(() => focusCell(nextRow, colIdx), 30); }
      else focusCell(nextRow, colIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); if (rowIdx - 1 >= 0) focusCell(rowIdx - 1, colIdx);
    }
  };

  const updateCell = (rowIdx: number, key: keyof BulkRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [key]: value, status: 'idle', error: '' } : r));
  };

  const addRow = () => { setRows(prev => [...prev, emptyRow()]); setTimeout(() => focusCell(rows.length, 0), 30); };
  const removeRow = (i: number) => { if (rows.length === 1) return; setRows(prev => prev.filter((_, idx) => idx !== i)); };
  const clearAll = () => { setRows(Array.from({ length: INITIAL_ROWS }, emptyRow)); setGlobalError(''); setTimeout(() => focusCell(0, 0), 30); };

  const validateRow = (row: BulkRow): string => {
    if (!row.reg_no.trim()) return 'Reg No required';
    if (!row.first_name.trim()) return 'First name required';
    if (!row.last_name.trim()) return 'Last name required';
    if (!row.gender) return 'Gender required';
    if (!row.class_id) return 'Class required';
    if (!row.guardian_email.trim()) return 'Guardian email required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.guardian_email.trim())) return 'Invalid guardian email';
    if (row.phone && row.phone.replace(/\D/g, '').length < 7) return 'Invalid phone';
    if (row.date_of_birth) {
      const d = new Date(row.date_of_birth);
      if (isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900) return 'Invalid DOB';
    }
    return '';
  };

  const filledRows = rows.filter(r => r.reg_no.trim() || r.first_name.trim() || r.last_name.trim());

  const handleSubmit = async () => {
    setGlobalError('');
    if (filledRows.length === 0) { setGlobalError('Please fill in at least one student row.'); return; }
    let hasErrors = false;
    setRows(prev => prev.map(r => {
      if (!r.reg_no.trim() && !r.first_name.trim() && !r.last_name.trim()) return r;
      const err = validateRow(r);
      if (err) hasErrors = true;
      return { ...r, error: err, status: err ? 'error' : r.status };
    }));
    if (hasErrors) { setGlobalError('Fix the highlighted errors before submitting.'); return; }

    setSubmitting(true);
    let successCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.reg_no.trim() && !r.first_name.trim() && !r.last_name.trim()) continue;
      setRows(prev => prev.map((row, idx) => idx === i ? { ...row, status: 'loading' } : row));
      try {
        const payload = {
          email: r.guardian_email.trim(), password: r.password || undefined,
          reg_no: r.reg_no.trim(), first_name: r.first_name.trim(), last_name: r.last_name.trim(),
          gender: r.gender, phone: r.phone, guardian_email: r.guardian_email.trim(),
          guardian_name: r.guardian_name, guardian_phone: r.guardian_phone,
          date_of_birth: r.date_of_birth || undefined, class_id: r.class_id,
          student_type: r.student_type || 'Day Scholar',
        };
        const res = await supabase.functions.invoke('create-user', { body: JSON.stringify(payload) });
        let parsed = res.data ?? null;
        if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (_) {} }
        if (parsed && !!parsed.ok) {
          successCount++;
          setRows(prev => prev.map((row, idx) => idx === i ? { ...row, status: 'success', error: '' } : row));
        } else {
          throw new Error(parsed?.error || 'Edge function returned ok=false');
        }
      } catch (err: any) {
        setRows(prev => prev.map((row, idx) => idx === i ? { ...row, status: 'error', error: err.message || 'Failed' } : row));
      }
    }

    setSubmitting(false);
    toast({ title: 'Bulk import done', description: `${successCount} student${successCount !== 1 ? 's' : ''} imported successfully.` });
    if (successCount > 0) onAllDone();
  };

  const handleClose = () => { if (!submitting) { clearAll(); onClose(); } };

  const renderCell = (row: BulkRowState, rowIdx: number, col: typeof BULK_COLUMNS[0], colIdx: number) => {
    const value = row[col.key] ?? '';
    const isSelect = col.key === 'gender' || col.key === 'student_type' || col.key === 'class_id';
    const disabled = submitting || row.status === 'success';
    const baseClass = `h-8 text-xs rounded-none border-0 border-r border-b border-[#7a1f2b]/10 bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#7a1f2b] focus:z-10 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${row.status === 'error' ? 'bg-red-50' : row.status === 'success' ? 'bg-green-50' : ''}`;

    if (isSelect) {
      const displayOptions = col.key === 'class_id'
        ? classes.map(c => ({ value: c.id, label: c.name }))
        : col.key === 'gender'
        ? GENDER_OPTIONS.map(o => ({ value: o, label: o }))
        : TYPE_OPTIONS.map(o => ({ value: o, label: o }));
      return (
        <select
          ref={getRef(rowIdx, colIdx) as any} value={value} disabled={disabled}
          onChange={e => updateCell(rowIdx, col.key, e.target.value)}
          onKeyDown={e => handleKeyDown(e as any, rowIdx, colIdx)}
          className={`${baseClass} w-full appearance-none`} style={{ width: col.width }}
          title={col.key === 'class_id' ? classes.find(c => c.id === value)?.name : value}
        >
          <option value="">--</option>
          {displayOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      );
    }
    return (
      <input
        ref={getRef(rowIdx, colIdx) as any} type={col.type || 'text'} value={value}
        disabled={disabled} onChange={e => updateCell(rowIdx, col.key, e.target.value)}
        onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
        className={`${baseClass} w-full`} style={{ width: col.width }} autoComplete="off"
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[98vw] w-full max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
        {/* ── Gradient header (safe-area aware) ── */}
        <div
          className="relative overflow-hidden shrink-0"
          style={{ background: MAROON_GRADIENT }}
        >
          <div
            className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)',
            }}
          />
          <div className="relative px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                  Bulk Import
                </p>
                <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">
                  Bulk Add Students
                </h3>
                <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 truncate">
                  Use <kbd className="bg-white/15 px-1 rounded text-[10px] text-white">Enter</kbd> / <kbd className="bg-white/15 px-1 rounded text-[10px] text-white">↑↓←→</kbd> to navigate
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-white/70 hidden sm:inline">
                {filledRows.length} filled
              </span>
              <button
                onClick={clearAll}
                disabled={submitting}
                className="text-[11px] font-medium text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>

        {/* ── Table area ── */}
        <div className="overflow-auto flex-1 min-h-0 bg-white">
          <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', minWidth: '1400px' }}>
            <thead className="sticky top-0 z-20 border-b-2 border-[#7a1f2b]/20" style={{ background: 'rgba(122,31,43,0.05)' }}>
              <tr>
                <th className="w-8 text-center text-[#7a1f2b]/50 font-normal border-r border-[#7a1f2b]/10 py-1.5" style={{ background: 'rgba(122,31,43,0.05)' }}>#</th>
                {BULK_COLUMNS.map(col => (
                  <th key={col.key} className="text-left font-medium text-[#7a1f2b]/80 border-r border-[#7a1f2b]/10 py-1.5 px-2 whitespace-nowrap" style={{ width: col.width, minWidth: col.width, background: 'rgba(122,31,43,0.05)' }}>
                    {col.label}{col.required && <span className="text-red-400 ml-0.5">*</span>}
                  </th>
                ))}
                <th className="w-16 border-r border-[#7a1f2b]/10" style={{ background: 'rgba(122,31,43,0.05)' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const isEmpty = !row.reg_no && !row.first_name && !row.last_name;
                return (
                  <tr key={rowIdx} className={`border-b border-[#7a1f2b]/10 hover:bg-[#7a1f2b]/[0.03] transition-colors ${row.status === 'success' ? 'bg-green-50' : row.status === 'error' ? 'bg-red-50' : isEmpty ? 'bg-[#fdfbfb]' : 'bg-white'}`}>
                    <td className="text-center text-[#7a1f2b]/40 font-mono text-[10px] border-r border-[#7a1f2b]/10 align-middle select-none" style={{ width: '32px' }}>
                      {row.status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-[#7a1f2b]" />
                        : row.status === 'success' ? <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" />
                        : row.status === 'error' ? <span title={row.error}><AlertCircle className="w-3 h-3 text-red-500 mx-auto" /></span>
                        : rowIdx + 1}
                    </td>
                    {BULK_COLUMNS.map((col, colIdx) => (
                      <td key={col.key} className="p-0 border-r border-[#7a1f2b]/10 align-middle" style={{ width: col.width, minWidth: col.width }} title={row.error || undefined}>
                        {renderCell(row, rowIdx, col, colIdx)}
                      </td>
                    ))}
                    <td className="text-center border-r border-[#7a1f2b]/10 align-middle" style={{ width: '48px' }}>
                      <button onClick={() => removeRow(rowIdx)} disabled={submitting || rows.length === 1} className="text-[#7a1f2b]/30 hover:text-red-400 disabled:opacity-30 p-1" title="Remove row">
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div
          className="px-4 sm:px-5 py-3 border-t border-[#7a1f2b]/10 shrink-0 flex items-center justify-between gap-3"
          style={{ background: 'rgba(122,31,43,0.03)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={submitting} className="h-8 text-xs gap-1 border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              <Plus className="w-3.5 h-3.5" />Add row
            </Button>
            {globalError && <span className="text-xs text-red-600 flex items-center gap-1 truncate"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{globalError}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={submitting} className="h-8 text-xs border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">Cancel</Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || filledRows.length === 0}
              className="h-8 text-xs text-white gap-1 active:scale-[0.98] border-0"
              style={{ background: MAROON_GRADIENT, boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)' }}
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import {filledRows.length > 0 ? `${filledRows.length}` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Class Strip ──────────────────────────────────────────────────────────────

function ClassStrip({
  cls,
  isExpanded,
  onToggle,
  searchTerm,
  onView,
  onEdit,
  onDelete,
  isDeleting,
}: {
  cls: { id: string; name: string; grade_level: string };
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm: string;
  onView: (student: any) => void;
  onEdit: (student: any) => void;
  onDelete: (student: any) => void;
  isDeleting: boolean;
}) {
  const { data: students, isLoading } = useQuery({
    queryKey: ['class-students-list', cls.id],
    enabled: isExpanded,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: enrollments, error: eErr } = await supabase
        .from('enrollments')
        .select('id, student_id')
        .eq('class_id', cls.id);
      if (eErr) throw eErr;
      if (!enrollments || enrollments.length === 0) return [];

      const studentIds = enrollments.map((e: any) => e.student_id);

      const [studentsRes, profilesRes] = await Promise.all([
        supabase.from('students').select('id, Reg_no, first_name, last_name, auth_id, created_at').in('id', studentIds),
        supabase.from('profiles').select('id, student_id, reg_no, first_name, last_name, date_of_birth, gender, phone, email, guardian_name, guardian_phone, student_type, guardian_email').in('student_id', studentIds),
      ]);
      if (studentsRes.error) throw studentsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const studentMap: Record<string, any> = {};
      (studentsRes.data || []).forEach((s: any) => { studentMap[s.id] = s; });

      const profileMap: Record<string, any> = {};
      (profilesRes.data || []).forEach((p: any) => { if (p.student_id) profileMap[p.student_id] = p; });

      return enrollments.map((e: any) => {
        const student = studentMap[e.student_id] ?? null;
        const profile = profileMap[e.student_id] ?? null;
        return {
          id:         student?.id ?? e.student_id,
          auth_id:    student?.auth_id,
          created_at: student?.created_at,
          profile: profile ?? {
            reg_no: student?.Reg_no ?? '', first_name: student?.first_name ?? '',
            last_name: student?.last_name ?? '', date_of_birth: null,
            gender: '', phone: '', email: '', guardian_name: '',
            guardian_phone: '', guardian_email: '', student_type: 'Day Scholar',
          },
          enrollment: { id: e.id, class_id: cls.id },
          classInfo: cls,
        };
      });
    },
  });

  const filtered = (students || []).filter(s => {
    if (!searchTerm.trim()) return true;
    return `${s.profile?.first_name || ''} ${s.profile?.last_name || ''} ${s.profile?.reg_no || ''}`
      .toLowerCase().includes(searchTerm.toLowerCase());
  });

  const count = students?.length ?? 0;

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[#7a1f2b]/10 bg-white transition-shadow"
      style={{ boxShadow: isExpanded ? CARD_SHADOW_HOVER : CARD_SHADOW }}
    >
      {/* ── Strip header ── */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-3 text-left transition-colors active:scale-[0.995] ${
          isExpanded ? 'text-white' : 'hover:bg-[#7a1f2b]/[0.04]'
        }`}
        style={isExpanded ? { background: MAROON_GRADIENT } : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isExpanded ? 'bg-white/15 backdrop-blur-md border border-white/20' : ''
            }`}
            style={!isExpanded ? { background: 'rgba(122,31,43,0.08)' } : undefined}
          >
            <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${isExpanded ? 'rotate-90 text-white' : 'text-[#7a1f2b]/70'}`} />
          </div>
          <div className="min-w-0">
            <div className={`font-semibold text-sm truncate ${isExpanded ? 'text-white' : 'text-[#3a1b1f]'}`}>{cls.name}</div>
            <div className={`text-[11px] mt-0.5 ${isExpanded ? 'text-white/70' : 'text-muted-foreground'}`}>{cls.grade_level}</div>
          </div>
        </div>
        {isExpanded && (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/20 text-white shrink-0 border border-white/15">
            {isLoading ? '…' : `${count} student${count !== 1 ? 's' : ''}`}
          </span>
        )}
      </button>

      {/* ── Expandable student list ── */}
      {isExpanded && (
        <div className="border-t border-[#7a1f2b]/10 bg-[#fdfbfb]">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton
                  key={i}
                  className="h-10 w-full rounded-lg"
                  style={{ background: 'rgba(122,31,43,0.06)' }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchTerm ? 'No students match your search' : 'No students enrolled in this class'}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                      <TableHead className="py-2 pl-6 text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Reg No</TableHead>
                      <TableHead className="py-2 text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Name</TableHead>
                      <TableHead className="py-2 text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Gender</TableHead>
                      <TableHead className="py-2 text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Type</TableHead>
                      <TableHead className="py-2 w-[80px] text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(student => (
                      <TableRow
                        key={student.id}
                        className="cursor-pointer hover:bg-[#7a1f2b]/[0.04] border-b border-[#7a1f2b]/5 transition-colors"
                        onClick={() => onView(student)}
                      >
                        <TableCell className="font-mono font-medium py-2.5 pl-6 text-sm text-[#3a1b1f]">{student.profile?.reg_no}</TableCell>
                        <TableCell className="py-2.5 text-sm text-[#3a1b1f]">{student.profile?.first_name} {student.profile?.last_name}</TableCell>
                        <TableCell className="py-2.5 text-sm text-muted-foreground">{student.profile?.gender}</TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${student.profile?.student_type === 'Boarding' ? 'bg-[#7a1f2b]/10 text-[#7a1f2b]' : 'bg-emerald-50 text-emerald-700'}`}>
                            {student.profile?.student_type || 'Day Scholar'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#7a1f2b]/5 active:scale-95" onClick={() => onEdit(student)}>
                              <Pencil className="w-3.5 h-3.5 text-[#7a1f2b]/70" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 active:scale-95" disabled={isDeleting} onClick={() => onDelete(student)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500/80" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[#7a1f2b]/5 bg-white">
                {filtered.map(student => (
                  <div
                    key={student.id}
                    className="p-3.5 flex items-center justify-between hover:bg-[#7a1f2b]/[0.03] active:bg-[#7a1f2b]/[0.06] cursor-pointer transition-colors"
                    onClick={() => onView(student)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: MAROON_GRADIENT, boxShadow: '0 6px 14px -8px rgba(122,31,43,0.5)' }}
                      >
                        {student.profile?.first_name?.[0]}{student.profile?.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-[#3a1b1f] truncate">{student.profile?.first_name} {student.profile?.last_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{student.profile?.reg_no} · {student.profile?.gender}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-[#7a1f2b]/5 active:scale-95" onClick={() => onEdit(student)}>
                        <Pencil className="w-3.5 h-3.5 text-[#7a1f2b]/70" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-red-50 active:scale-95" disabled={isDeleting} onClick={() => onDelete(student)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500/80" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentsSection() {
  const [searchTerm, setSearchTerm]           = useState('');
  const [showAddModal, setShowAddModal]       = useState(false);
  const [showBulkModal, setShowBulkModal]     = useState(false);
  const [editingStudent, setEditingStudent]   = useState<any>(null);
  const [viewingStudent, setViewingStudent]   = useState<any>(null);
  const [formError, setFormError]             = useState<string | null>(null);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [formData, setFormData] = useState({
    reg_no: '', first_name: '', last_name: '', gender: '',
    class_id: '', phone: '', date_of_birth: '',
    guardian_name: '', guardian_phone: '', guardian_email: '',
    password: '', student_type: 'Day Scholar',
  });

  const camelToSnake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();
  const normalizeFormKeys = (obj: Record<string, any>) => {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach(k => { out[k.includes('_') ? k : camelToSnake(k)] = obj[k]; });
    return out;
  };

  const resetForm = () => {
    setFormData({ reg_no: '', first_name: '', last_name: '', gender: '', class_id: '', phone: '', date_of_birth: '', guardian_name: '', guardian_phone: '', guardian_email: '', password: '', student_type: 'Day Scholar' });
    setFormError(null);
  };

  const { data: classes, isLoading: loadingClasses } = useQuery({
    queryKey: ['classes-with-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level');
      if (error) throw error;

      const stageBucket = (gl: string): number => {
        const l = (gl || '').toLowerCase().trim();
        if (l.startsWith('pp') || l.startsWith('pre') || l.startsWith('nursery') || l.startsWith('baby') || l.startsWith('pg')) return 0;
        if (l.startsWith('grade') || l.startsWith('std') || l.startsWith('standard') || l.startsWith('class')) return 1;
        if (l.startsWith('form') || l.startsWith('jss') || l.startsWith('senior')) return 2;
        return 3;
      };
      const numOf = (gl: string): number => {
        const m = (gl || '').match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      };

      return [...(data || [])].sort((a, b) => {
        const bucketDiff = stageBucket(a.grade_level) - stageBucket(b.grade_level);
        if (bucketDiff !== 0) return bucketDiff;
        const numDiff = numOf(a.grade_level) - numOf(b.grade_level);
        if (numDiff !== 0) return numDiff;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    },
  });

  const isSearching = searchTerm.trim().length > 0;

  const { data: searchResults, isLoading: loadingSearch } = useQuery({
    queryKey: ['student-search', searchTerm.trim()],
    enabled: isSearching,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const term = searchTerm.trim();
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, student_id, reg_no, first_name, last_name, date_of_birth, gender, phone, email, guardian_name, guardian_phone, student_type, guardian_email')
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,reg_no.ilike.%${term}%`);
      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) return [];

      const studentIds = profiles.map((p: any) => p.student_id).filter(Boolean);
      if (studentIds.length === 0) return [];

      const [enrollRes, studentRes] = await Promise.all([
        supabase.from('enrollments').select('id, student_id, class_id').in('student_id', studentIds),
        supabase.from('students').select('id, auth_id, created_at').in('id', studentIds),
      ]);

      const enrollMap: Record<string, any> = {};
      (enrollRes.data || []).forEach((e: any) => { enrollMap[e.student_id] = e; });
      const studentMap: Record<string, any> = {};
      (studentRes.data || []).forEach((s: any) => { studentMap[s.id] = s; });

      const classIds = [...new Set((enrollRes.data || []).map((e: any) => e.class_id).filter(Boolean))];
      let classMap: Record<string, any> = {};
      if (classIds.length > 0) {
        const { data: clsData } = await supabase.from('classes').select('id, name, grade_level').in('id', classIds);
        (clsData || []).forEach((c: any) => { classMap[c.id] = c; });
      }

      return profiles.map((profile: any) => {
        const enroll = enrollMap[profile.student_id];
        const student = studentMap[profile.student_id];
        const cls = enroll ? classMap[enroll.class_id] : null;
        return {
          id: profile.student_id,
          auth_id: student?.auth_id,
          created_at: student?.created_at,
          profile,
          enrollment: enroll ? { id: enroll.id, class_id: enroll.class_id } : null,
          classInfo: cls ?? null,
        };
      });
    },
  });

  const createMutation = useMutation<any, any, Record<string, any>>({
    mutationFn: async data => {
      const payload = {
        email: data.guardian_email, password: data.password,
        reg_no: data.reg_no, first_name: data.first_name, last_name: data.last_name,
        date_of_birth: data.date_of_birth, gender: data.gender, phone: data.phone,
        guardian_email: data.guardian_email, guardian_name: data.guardian_name,
        guardian_phone: data.guardian_phone, class_id: data.class_id,
        student_type: data.student_type,
      };
      const res = await supabase.functions.invoke('create-user', { body: JSON.stringify(payload) });
      let parsed = res.data ?? null;
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (_) {} }
      if (parsed && !!parsed.ok) return parsed;
      throw new Error('Edge function failed to create user.');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-students-list', variables.class_id] });
      setShowAddModal(false); setEditingStudent(null); resetForm();
      setCreationSuccess('Student was successfully created!');
      setTimeout(() => setCreationSuccess(null), 3500);
      toast({ title: 'Student created', description: 'The student was added successfully.' });
    },
    onError: (err: any) => {
      const msg = String(err?.message || err);
      setFormError(msg);
      toast({ title: 'Create failed', description: msg });
    },
  });

  const updateMutation = useMutation<any, any, Record<string, any>>({
    mutationFn: async data => {
      if (!editingStudent) throw new Error('No student selected for editing');
      const ops: Promise<any>[] = [];
      if (editingStudent.profile?.id) {
        ops.push(
          Promise.resolve(
            supabase.from('profiles').update({
              reg_no: data.reg_no, first_name: data.first_name, last_name: data.last_name,
              gender: data.gender, date_of_birth: data.date_of_birth || null, phone: data.phone,
              guardian_name: data.guardian_name, guardian_phone: data.guardian_phone,
              guardian_email: data.guardian_email, student_type: data.student_type,
              updated_at: new Date().toISOString(),
            }).eq('id', editingStudent.profile.id)
          )
        );
      }
      if (data.class_id && editingStudent.enrollment?.id) {
        ops.push(
          Promise.resolve(
            supabase.from('enrollments').update({ class_id: data.class_id }).eq('id', editingStudent.enrollment.id)
          )
        );
      }
      const results = await Promise.all(ops);
      for (const r of results) { if (r.error) throw r.error; }
      return { newClassId: data.class_id, oldClassId: editingStudent.enrollment?.class_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['class-students-list', result.oldClassId] });
      if (result.newClassId !== result.oldClassId) {
        queryClient.invalidateQueries({ queryKey: ['class-students-list', result.newClassId] });
      }
      setShowAddModal(false); setEditingStudent(null); resetForm();
      toast({ title: 'Student updated', description: 'The student was updated successfully.' });
    },
    onError: (err: any) => {
      const msg = String(err?.message || err);
      setFormError(msg);
      toast({ title: 'Update failed', description: msg, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation<any, any, { studentId: string; authId?: string; classId?: string }>({
    mutationFn: async ({ studentId, authId }) => {
      const res = await supabase.functions.invoke('delete-user', { body: JSON.stringify({ studentId, userId: authId }) });
      if (res.error) throw new Error(`Failed to invoke delete function: ${res.error.message}`);
      if (!res.data?.success) throw new Error(res.data?.error || 'Delete operation failed');
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-students-list', variables.classId] });
      toast({ title: 'Student deleted', description: data.message || 'Student has been removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const isDeleting           = deleteMutation.isPending;
  const isCreatingOrUpdating = createMutation.isPending || updateMutation.isPending;

  const handleInputChange = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleAddNew = () => { setEditingStudent(null); resetForm(); setShowAddModal(true); };

  const handleEdit = (student: any) => {
    setEditingStudent(student);
    setFormData({
      reg_no: student.profile?.reg_no || '', first_name: student.profile?.first_name || '',
      last_name: student.profile?.last_name || '', gender: student.profile?.gender || '',
      class_id: student.enrollment?.class_id || '', phone: student.profile?.phone || '',
      date_of_birth: student.profile?.date_of_birth || '', guardian_name: student.profile?.guardian_name || '',
      guardian_phone: student.profile?.guardian_phone || '', guardian_email: student.profile?.guardian_email || '',
      student_type: student.profile?.student_type || 'Day Scholar', password: '',
    });
    setShowAddModal(true);
  };

  const handleDelete = (student: any) => {
    if (window.confirm(`Are you sure you want to delete ${student.profile?.first_name} ${student.profile?.last_name}? This cannot be undone.`)) {
      deleteMutation.mutate({
        studentId: student.id,
        authId: student.auth_id,
        classId: student.enrollment?.class_id,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(null); setCreationSuccess(null);
    const data = normalizeFormKeys(formData);
    if (!String(data.reg_no || '').trim()) { setFormError('Registration number is required'); return; }
    data.reg_no = String(data.reg_no).trim();
    if (!editingStudent && !String(data.guardian_email || '').trim()) { setFormError('Guardian email is required'); return; }
    if (data.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.guardian_email).trim())) { setFormError('Please enter a valid guardian email'); return; }
    if (data.guardian_email) data.guardian_email = String(data.guardian_email).trim();
    if (data.phone && String(data.phone).replace(/\D/g, '').length < 7) { setFormError('Please enter a valid phone number'); return; }
    if (data.date_of_birth) {
      const d = new Date(data.date_of_birth);
      if (isNaN(d.getTime())) { setFormError('Invalid date of birth'); return; }
      if (d > new Date()) { setFormError('Date of birth cannot be in the future'); return; }
    }
    if (editingStudent) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const handleOpenChange = (open: boolean) => {
    setShowAddModal(open);
    if (!open) { setEditingStudent(null); resetForm(); }
  };

  const handleToggleClass = (classId: string) => {
    setExpandedClassId(prev => prev === classId ? null : classId);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">
      {creationSuccess && (
        <div
          className="w-full rounded-xl px-4 py-3 text-sm font-medium text-center border flex items-center justify-center gap-2"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderColor: 'rgba(16,185,129,0.25)',
            color: '#047857',
          }}
        >
          <CheckCircle2 className="w-4 h-4" />
          {creationSuccess}
        </div>
      )}

      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        {/* ── Themed header ── */}
        <SectionHeader
          icon={Users}
          microLabel="Administration"
          title="Students"
          description="Manage enrollment, profiles and class assignments"
        />

        {/* ── Toolbar ── */}
        <div className="p-3 sm:p-4 border-b border-[#7a1f2b]/10 bg-[#fdfbfb]">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a1f2b]/40 w-4 h-4" />
              <Input
                placeholder="Search students by name or reg no…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 text-sm h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 focus-visible:border-[#7a1f2b]/40 bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-[#7a1f2b]/40 hover:text-[#7a1f2b] hover:bg-[#7a1f2b]/5 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2.5">
              <Button
                onClick={() => setShowBulkModal(true)}
                variant="outline"
                className="flex-1 sm:flex-none h-10 rounded-xl border-[#7a1f2b]/25 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b] active:scale-[0.98]"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Bulk Add</span>
                <span className="sm:hidden">Bulk</span>
              </Button>
              <Button
                onClick={handleAddNew}
                className="flex-1 sm:flex-none h-10 rounded-xl text-white border-0 active:scale-[0.98]"
                size="sm"
                style={{ background: MAROON_GRADIENT, boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)' }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Add Student</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
          {/* ── Search mode ── */}
          {isSearching ? (
            <div className="space-y-1.5">
              {loadingSearch ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton
                      key={i}
                      className="h-14 rounded-xl"
                      style={{ background: 'rgba(122,31,43,0.06)' }}
                    />
                  ))}
                </div>
              ) : !searchResults || searchResults.length === 0 ? (
                <div className="text-center py-10">
                  <Search className="w-10 h-10 mx-auto mb-2 text-[#7a1f2b]/15" />
                  <p className="text-sm text-muted-foreground">No students found for &ldquo;{searchTerm}&rdquo;</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchTerm}&rdquo;
                  </p>
                  {searchResults.map((student: any) => (
                    <button
                      key={student.id}
                      onClick={() => setViewingStudent(student)}
                      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-[#7a1f2b]/10 hover:border-[#7a1f2b]/30 hover:bg-[#7a1f2b]/[0.03] active:scale-[0.99] transition-all text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: MAROON_GRADIENT, boxShadow: '0 6px 14px -8px rgba(122,31,43,0.5)' }}
                        >
                          {student.profile?.first_name?.[0]}{student.profile?.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-[#3a1b1f] group-hover:text-[#7a1f2b] transition-colors truncate">
                            {student.profile?.first_name} {student.profile?.last_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {student.profile?.reg_no} · {student.classInfo?.name || 'Unassigned'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#7a1f2b]/30 group-hover:text-[#7a1f2b] transition-colors shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : loadingClasses ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map(i => (
                <Skeleton
                  key={i}
                  className="h-14 rounded-2xl"
                  style={{ background: 'rgba(122,31,43,0.06)' }}
                />
              ))}
            </div>
          ) : !classes || classes.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-[#7a1f2b]/15" />
              <p className="font-semibold text-[#3a1b1f]">No classes found</p>
              <p className="text-sm mt-1 text-muted-foreground">Create classes first, then add students.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(classes as any[]).map(cls => (
                <ClassStrip
                  key={cls.id}
                  cls={cls}
                  isExpanded={expandedClassId === cls.id}
                  onToggle={() => handleToggleClass(cls.id)}
                  searchTerm=""
                  onView={setViewingStudent}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Modal ── */}
      <Dialog open={showAddModal} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
          {/* Gradient header */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{ background: MAROON_GRADIENT }}
          >
            <div
              className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)',
              }}
            />
            <div className="relative px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                {editingStudent ? <Pencil className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> : <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                  {editingStudent ? 'Update Record' : 'New Enrollment'}
                </p>
                <h3 className="text-white font-bold text-sm sm:text-base leading-tight">
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </h3>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="reg_no" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Registration Number</Label>
                <Input id="reg_no" value={formData.reg_no} onChange={e => handleInputChange('reg_no', e.target.value)} required className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">First Name</Label>
                <Input id="first_name" value={formData.first_name} onChange={e => handleInputChange('first_name', e.target.value)} required className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Last Name</Label>
                <Input id="last_name" value={formData.last_name} onChange={e => handleInputChange('last_name', e.target.value)} required className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Gender</Label>
                <Select value={formData.gender} onValueChange={v => handleInputChange('gender', v)} required>
                  <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Class</Label>
                <Select value={formData.class_id} onValueChange={v => handleInputChange('class_id', v)} required>
                  <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {(classes || []).map((cls: any) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Student Type</Label>
                <Select value={formData.student_type} onValueChange={v => handleInputChange('student_type', v)}>
                  <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Day Scholar">Day Scholar</SelectItem>
                    <SelectItem value="Boarding">Boarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guardian_email" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Guardian Email {!editingStudent && <span className="text-red-500">*</span>}
                </Label>
                <Input id="guardian_email" type="email" value={formData.guardian_email} onChange={e => handleInputChange('guardian_email', e.target.value)} required={!editingStudent} placeholder="guardian@example.com" className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                <p className="text-[11px] text-muted-foreground">Used for password recovery. Students can still login with registration number.</p>
              </div>
              {!editingStudent && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Password (optional)</Label>
                  <Input id="password" type="password" value={formData.password} onChange={e => handleInputChange('password', e.target.value)} placeholder="Set a password or leave blank" className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Date of Birth</Label>
                <Input id="date_of_birth" type="date" value={formData.date_of_birth} onChange={e => handleInputChange('date_of_birth', e.target.value)} className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_name" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Guardian Name</Label>
                <Input id="guardian_name" value={formData.guardian_name} onChange={e => handleInputChange('guardian_name', e.target.value)} className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_phone" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Guardian Phone</Label>
                <Input id="guardian_phone" value={formData.guardian_phone} onChange={e => handleInputChange('guardian_phone', e.target.value)} className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
              {formError && <div className="text-sm text-red-600 mr-auto w-full sm:w-auto flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{formError}</div>}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="h-10 w-full sm:w-auto order-2 sm:order-1 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">Cancel</Button>
                <Button
                  type="submit"
                  className="h-10 w-full sm:w-auto order-1 sm:order-2 rounded-xl text-white border-0 active:scale-[0.98]"
                  disabled={isCreatingOrUpdating}
                  style={{ background: MAROON_GRADIENT, boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)' }}
                >
                  {isCreatingOrUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingStudent ? 'Update' : 'Create'} Student
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Add Modal ── */}
      <BulkAddModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        classes={classes || []}
        onAllDone={() => {
          if (expandedClassId) {
            queryClient.invalidateQueries({ queryKey: ['class-students-list', expandedClassId] });
          }
        }}
      />

      {/* ── Student Detail Modal ── */}
      {viewingStudent && (
        <Dialog open={!!viewingStudent} onOpenChange={() => setViewingStudent(null)}>
          <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
            {/* Gradient hero */}
            <div
              className="relative overflow-hidden px-5 pt-5 pb-6 text-white"
              style={{ background: MAROON_GRADIENT }}
            >
              <div
                className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)',
                }}
              />
              <div
                className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)',
                }}
              />
              <div className="relative flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-bold text-white">
                  {viewingStudent.profile?.first_name?.[0]}{viewingStudent.profile?.last_name?.[0]}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-white border border-white/25 hover:bg-white/15 active:scale-95 text-xs gap-1.5 rounded-lg" onClick={() => { setViewingStudent(null); handleEdit(viewingStudent); }}>
                    <Pencil className="w-3.5 h-3.5" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-white border border-white/25 hover:bg-red-500/30 active:scale-95 text-xs gap-1.5 rounded-lg" disabled={isDeleting} onClick={() => { setViewingStudent(null); handleDelete(viewingStudent); }}>
                    <Trash2 className="w-3.5 h-3.5" />Delete
                  </Button>
                </div>
              </div>
              <div className="relative">
                <h2 className="text-lg font-bold leading-tight">{viewingStudent.profile?.first_name} {viewingStudent.profile?.last_name}</h2>
                <p className="text-white/70 text-sm mt-0.5 font-mono">{viewingStudent.profile?.reg_no}</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-1 bg-white">
              {([
                { label: 'Class',          value: viewingStudent.classInfo?.name || '—' },
                { label: 'Gender',         value: viewingStudent.profile?.gender || '—' },
                { label: 'Student Type',   value: viewingStudent.profile?.student_type || 'Day Scholar' },
                { label: 'Date of Birth',  value: viewingStudent.profile?.date_of_birth ? new Date(viewingStudent.profile.date_of_birth).toLocaleDateString() : '—' },
                { label: 'Phone',          value: viewingStudent.profile?.phone || '—' },
                { label: 'Guardian',       value: viewingStudent.profile?.guardian_name || '—' },
                { label: 'Guardian Phone', value: viewingStudent.profile?.guardian_phone || '—' },
                { label: 'Guardian Email', value: viewingStudent.profile?.guardian_email || '—' },
              ] as { label: string; value: string }[]).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-[#7a1f2b]/8 last:border-0">
                  <span className="text-[11px] font-semibold text-[#7a1f2b]/60 uppercase tracking-wider w-32 shrink-0">{label}</span>
                  <span className="text-sm text-[#3a1b1f] text-right truncate">{value}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}