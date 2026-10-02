// src/Components/Library/LibraryManager.tsx
// Shared upload manager. mode="admin": manage everything. mode="teacher": own books and past papers only.
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Card, CardContent } from '@/Components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { createPortal } from 'react-dom';
import {
  Library, BookOpen, Sparkles, Plus, Trash2, Pencil, ExternalLink, Paperclip,
  X, Loader2, AlertTriangle, Image as ImageIcon, FileUp, Search, FileText,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Design tokens (same as AssignmentsSection) ──────────────────────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};
const LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70';

// ─── Config ──────────────────────────────────────────────────────────────────
const BUCKET = 'library';
const MAX_FILE_BYTES = 50 * 1024 * 1024; // matches the bucket limit
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const NO_SUBJECT = 'none';
const LIBRARY_KEY = ['library', 'items'] as const;

type ItemType = 'book' | 'lesson' | 'revision';

const TYPE_META: Record<ItemType, {
  label: string; short: string; plural: string; accept: string; exts: string[]; hint: string; mime: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  book:     { label: 'Book',            short: 'Book',       plural: 'Books',       accept: '.pdf',       exts: ['.pdf'],          hint: 'PDF only',                     mime: 'application/pdf', icon: BookOpen },
  lesson:   { label: 'Animated lesson', short: 'Lesson',     plural: 'Lessons',     accept: '.html,.htm', exts: ['.html', '.htm'], hint: 'One self-contained HTML file', mime: 'text/html',       icon: Sparkles },
  revision: { label: 'Past paper',      short: 'Past paper', plural: 'Past papers', accept: '.pdf',       exts: ['.pdf'],          hint: 'PDF only',                     mime: 'application/pdf', icon: FileText },
};

interface LibraryItem {
  id: string;
  title: string;
  description: string | null;
  item_type: ItemType;
  grade_level: string;
  subject_id: string | null;
  file_url: string;
  file_path: string;
  cover_url: string | null;
  cover_path: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  subjects?: any;
}

interface FormState {
  title: string;
  description: string;
  item_type: ItemType;
  grade_level: string;
  subject_id: string;
}

const emptyForm = (type: ItemType): FormState => ({ title: '', description: '', item_type: type, grade_level: '', subject_id: NO_SUBJECT });

interface LibraryManagerProps {
  mode?: 'admin' | 'teacher';
  teacherId?: string | null;   // teacher mode: the logged-in teacher's id
  teacherClasses?: any[];      // teacher mode: rows from teacher_classes (with classes + subjects)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : (rel as T);
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const hasExt = (name: string, exts: string[]) => exts.some((e) => name.toLowerCase().endsWith(e));

async function uploadToBucket(file: File, folder: string, contentType: string) {
  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const path = `${folder}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

// ─── Small UI pieces ─────────────────────────────────────────────────────────
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
          {description && <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">{description}</p>}
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

function FilePicker({
  id, accept, file, onChange, placeholder, icon: Icon,
}: {
  id: string; accept: string; file: File | null; onChange: (f: File | null) => void;
  placeholder: string; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="file"
        accept={accept}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div
        className={`flex items-center gap-2 h-10 rounded-xl border border-dashed px-3 text-xs transition-colors ${
          file
            ? 'border-[#7a1f2b]/30 text-[#7a1f2b]'
            : 'border-[#7a1f2b]/20 text-muted-foreground hover:border-[#7a1f2b]/40 hover:bg-[#7a1f2b]/[0.03]'
        }`}
        style={file ? { background: 'rgba(122,31,43,0.05)' } : undefined}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate flex-1">{file ? file.name : placeholder}</span>
        {file && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(null);
              const inp = document.getElementById(id) as HTMLInputElement | null;
              if (inp) inp.value = '';
            }}
            className="w-5 h-5 rounded-md text-[#7a1f2b]/50 hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 z-20 relative"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Self-contained modal (portal to <body>, fixed to the real visible viewport).
// Used instead of the shared Dialog so nothing in ui/dialog can clip the footer.
function ModalShell({
  open, onClose, maxWidth = 'sm:max-w-lg', children,
}: { open: boolean; onClose: () => void; maxWidth?: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-6 bg-black/50"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${maxWidth} max-h-full flex flex-col bg-white rounded-2xl border border-[#7a1f2b]/15 overflow-hidden shadow-2xl`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function LibraryManager({ mode = 'admin', teacherId: teacherIdProp = null, teacherClasses = [] }: LibraryManagerProps) {
  const queryClient = useQueryClient();
  const isTeacher = mode === 'teacher';
  const allowedTypes: ItemType[] = isTeacher ? ['book', 'revision'] : ['book', 'lesson', 'revision'];
  const defaultType: ItemType = isTeacher ? 'revision' : 'book';

  // list filters
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // add / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(defaultType));
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // delete confirm
  const [deleting, setDeleting] = useState<LibraryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  // Teachers only manage their own uploads; admins see everything
  const { data: fetchedTeacherId } = useQuery({
    queryKey: ['library', 'teacher-id'],
    staleTime: Infinity,
    enabled: !teacherIdProp,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('teachers').select('id').eq('auth_id', user.id).maybeSingle();
      return data?.id ?? null;
    },
  });
  const teacherId = teacherIdProp ?? fetchedTeacherId ?? null;

  const { data: items = [], isLoading } = useQuery({
    queryKey: [...LIBRARY_KEY, 'manager', mode, teacherId],
    enabled: !isTeacher || !!teacherId,
    queryFn: async () => {
      let query = supabase
        .from('library_items')
        .select(`
          id, title, description, item_type, grade_level, subject_id,
          file_url, file_path, cover_url, cover_path, file_size, created_at,
          uploaded_by, uploaded_by_name,
          subjects ( name, code )
        `)
        .order('created_at', { ascending: false });
      if (isTeacher) query = query.eq('uploaded_by', teacherId as string);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LibraryItem[];
    },
  });

  // Same keys as AssignmentsSection so the cache is shared
  const { data: subjects = [] } = useQuery({
    queryKey: queryKeys.assignments.subjects,
    enabled: !isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, name, code');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: queryKeys.assignments.classes,
    enabled: !isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Teacher mode: the only (grade, subject) combinations they may upload for
  const pairs = useMemo(() => {
    const map = new Map<string, { value: string; grade: string; subjectId: string; label: string }>();
    teacherClasses.forEach((tc: any) => {
      const cls = firstRel<any>(tc.classes);
      const sub = firstRel<any>(tc.subjects);
      if (!cls?.grade_level || !sub?.id) return;
      const value = `${cls.grade_level}|${sub.id}`;
      if (!map.has(value)) map.set(value, { value, grade: cls.grade_level, subjectId: sub.id, label: `${cls.grade_level} · ${sub.name}` });
    });
    return Array.from(map.values()).sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }));
  }, [teacherClasses]);

  // When editing, keep the item's current pair selectable even if the teacher no longer teaches it
  const pairOptions = useMemo(() => {
    if (editing?.subject_id) {
      const value = `${editing.grade_level}|${editing.subject_id}`;
      if (!pairs.some((p) => p.value === value)) {
        const name = firstRel<any>(editing.subjects)?.name ?? 'Subject';
        return [...pairs, { value, grade: editing.grade_level, subjectId: editing.subject_id, label: `${editing.grade_level} · ${name}` }];
      }
    }
    return pairs;
  }, [pairs, editing]);

  const grades = useMemo(() => {
    const source: string[] = isTeacher
      ? pairs.map((p) => p.grade)
      : (classes as any[]).map((c) => c.grade_level).filter(Boolean);
    return Array.from(new Set(source)).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
  }, [isTeacher, pairs, classes]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) =>
      (typeFilter === 'all' || it.item_type === typeFilter) &&
      (gradeFilter === 'all' || it.grade_level === gradeFilter) &&
      (!q || it.title.toLowerCase().includes(q)),
    );
  }, [items, typeFilter, gradeFilter, search]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const subject_id = form.subject_id === NO_SUBJECT ? null : form.subject_id;

      // Edit: details only, files are not replaced
      if (editing) {
        const { error } = await supabase
          .from('library_items')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            grade_level: form.grade_level,
            subject_id,
          })
          .eq('id', editing.id);
        if (error) throw error;
        return;
      }

      // Create
      const meta = TYPE_META[form.item_type];
      if (!file) throw new Error(`Please choose a ${meta.label.toLowerCase()} file.`);
      if (!hasExt(file.name, meta.exts)) throw new Error(`${meta.label} files must be ${meta.hint.toLowerCase()}.`);
      if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 50 MB. Please compress it and try again.');
      if (coverFile && coverFile.size > MAX_COVER_BYTES) throw new Error('Cover image must be under 5 MB.');

      const uploadedPaths: string[] = [];
      try {
        const main = await uploadToBucket(file, `${form.item_type}s`, meta.mime);
        uploadedPaths.push(main.path);

        let cover: { path: string; url: string } | null = null;
        if (coverFile) {
          cover = await uploadToBucket(coverFile, 'covers', coverFile.type || 'image/jpeg');
          uploadedPaths.push(cover.path);
        }

        const { error } = await supabase.from('library_items').insert([{
          title: form.title.trim(),
          description: form.description.trim() || null,
          item_type: form.item_type,
          grade_level: form.grade_level,
          subject_id,
          file_url: main.url,
          file_path: main.path,
          cover_url: cover?.url ?? null,
          cover_path: cover?.path ?? null,
          file_size: file.size,
          uploaded_by: teacherId ?? null,
        }]);
        if (error) throw error;
      } catch (err) {
        // Don't leave orphaned files behind if the upload or insert failed
        if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
      closeModal();
    },
    onError: (err: any) => {
      console.error('Library save failed:', err);
      setFormError(err?.message || 'Something went wrong. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: LibraryItem) => {
      const { error } = await supabase.from('library_items').delete().eq('id', item.id);
      if (error) throw error;
      const paths = [item.file_path, item.cover_path].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: any) => setDeleteError(err?.message || 'Failed to delete this item.'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(defaultType), grade_level: !isTeacher && gradeFilter !== 'all' ? gradeFilter : '' });
    setFile(null);
    setCoverFile(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (item: LibraryItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? '',
      item_type: item.item_type,
      grade_level: item.grade_level,
      subject_id: item.subject_id ?? NO_SUBJECT,
    });
    setFile(null);
    setCoverFile(null);
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormError(null);
    setFile(null);
    setCoverFile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim()) return setFormError('Please enter a title.');
    if (!form.grade_level) return setFormError(isTeacher ? 'Please choose a class and subject.' : 'Please choose a grade.');
    if ((isTeacher || form.item_type === 'revision') && form.subject_id === NO_SUBJECT) {
      return setFormError(isTeacher ? 'Please choose a class and subject.' : 'Past papers need a subject.');
    }
    saveMutation.mutate();
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const typeMeta = TYPE_META[form.item_type];
  const saving = saveMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={Library}
          microLabel={isTeacher ? 'My Uploads' : 'Learning Resources'}
          title={isTeacher ? 'My Library Uploads' : 'Library Management'}
          description={`${isTeacher ? 'Upload books and past papers for your subjects' : 'Upload books, past papers and animated lessons for every student'}${items.length ? ` · ${items.length} item${items.length === 1 ? '' : 's'}` : ''}`}
          right={
            <button
              onClick={openCreate}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-white text-xs font-medium border border-white/20 bg-white/15 hover:bg-white/25 transition-colors active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" /> Add to Library
            </button>
          }
        />

        {/* Mobile action row */}
        <div className="sm:hidden p-3 border-b border-[#7a1f2b]/10 bg-[#fdfbfb]">
          <Button onClick={openCreate} className="w-full h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
            <Plus className="w-4 h-4 mr-1.5" /> Add to Library
          </Button>
        </div>

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-[#7a1f2b]/10 space-y-3">
          <div className="flex flex-wrap gap-2">
            {([['all', 'All'], ...allowedTypes.map((t) => [t, TYPE_META[t].plural])] as [string, string][]).map(([val, label]) => {
              const active = typeFilter === val;
              return (
                <button
                  key={val}
                  onClick={() => setTypeFilter(val as 'all' | ItemType)}
                  className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
                    active ? 'text-white border-transparent' : 'text-[#7a1f2b] border-[#7a1f2b]/20 hover:bg-[#7a1f2b]/5'
                  }`}
                  style={active ? { background: MAROON } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7a1f2b]/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title…"
                className="h-10 pl-9 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
              />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 px-4 text-sm text-muted-foreground">Loading library…</div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(122,31,43,0.06)' }}>
                <Library className="w-7 h-7 text-[#7a1f2b]/40" />
              </div>
              <p className="font-semibold text-[#3a1b1f]">{items.length === 0 ? 'The library is empty' : 'Nothing matches those filters'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {items.length === 0
                  ? <>Click <strong className="text-[#7a1f2b]">Add to Library</strong> to upload your first item.</>
                  : 'Try a different type, grade, or search.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#7a1f2b]/5">
              {visibleItems.map((item) => {
                const meta = TYPE_META[item.item_type];
                const TypeIcon = meta.icon;
                const subject = firstRel<any>(item.subjects);
                return (
                  <div key={item.id} className="p-3 sm:p-4 flex items-start gap-3 hover:bg-[#7a1f2b]/[0.02] transition-colors">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="w-11 h-14 sm:w-12 sm:h-16 rounded-lg object-cover border border-[#7a1f2b]/10 shrink-0" />
                    ) : (
                      <div className="w-11 h-14 sm:w-12 sm:h-16 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(122,31,43,0.07)' }}>
                        <TypeIcon className="w-5 h-5 text-[#7a1f2b]/60" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[#3a1b1f] leading-snug break-words">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15">
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{item.grade_level}</span>
                        {subject?.name && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{subject.name}</span>
                        )}
                        {!isTeacher && item.uploaded_by_name && (
                          <span className="text-[10px] text-muted-foreground">by {item.uploaded_by_name}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {[formatBytes(item.file_size), format(new Date(item.created_at), 'MMM d, yyyy')].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.item_type !== 'lesson' && (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open file"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a1f2b]/70 hover:bg-[#7a1f2b]/8 active:scale-95"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => openEdit(item)}
                        aria-label="Edit"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a1f2b]/70 hover:bg-[#7a1f2b]/8 active:scale-95"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setDeleteError(null); setDeleting(item); }}
                        aria-label="Delete"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/80 hover:bg-red-50 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════ Add / Edit modal ══════════ */}
      <ModalShell open={showModal} onClose={() => { if (!saving) closeModal(); }} maxWidth="sm:max-w-lg">
          <DialogHero
            icon={FileUp}
            microLabel={editing ? 'Edit Item' : 'New Library Item'}
            title={editing ? 'Edit Library Item' : 'Add to Library'}
            subtitle={editing ? 'Update the details. To change the file, delete and re-upload.' : 'Visible to every student, whatever their class'}
          />
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
            <div className="grid gap-4 py-1">
              {/* Type */}
              <div className="space-y-1.5">
                <Label className={LABEL_CLASS}>Type *</Label>
                <div className={`grid gap-2 ${allowedTypes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {allowedTypes.map((t) => {
                    const m = TYPE_META[t];
                    const Icon = m.icon;
                    const active = form.item_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={!!editing}
                        onClick={() => { setField('item_type', t); setFile(null); }}
                        className={`h-11 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 ${
                          active ? 'text-white border-transparent' : 'text-[#7a1f2b] border-[#7a1f2b]/20 hover:bg-[#7a1f2b]/5'
                        }`}
                        style={active ? { background: MAROON } : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" /> {m.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lib-title" className={LABEL_CLASS}>Title *</Label>
                <Input
                  id="lib-title"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder={form.item_type === 'book' ? 'e.g., Grade 6 Mathematics Activities' : form.item_type === 'revision' ? 'e.g., Mathematics End of Term 2 Paper' : 'e.g., The Water Cycle'}
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lib-desc" className={LABEL_CLASS}>Description</Label>
                <Textarea
                  id="lib-desc"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="What will students learn from this?"
                  rows={3}
                  className="rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 resize-none"
                />
              </div>

              {isTeacher ? (
                <div className="space-y-1.5">
                  <Label className={LABEL_CLASS}>Class &amp; subject *</Label>
                  <Select
                    value={form.grade_level && form.subject_id !== NO_SUBJECT ? `${form.grade_level}|${form.subject_id}` : ''}
                    onValueChange={(v) => {
                      const p = pairOptions.find((x) => x.value === v);
                      if (p) setForm((f) => ({ ...f, grade_level: p.grade, subject_id: p.subjectId }));
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                      <SelectValue placeholder="Choose what you teach" />
                    </SelectTrigger>
                    <SelectContent>
                      {pairOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {pairOptions.length === 0 && (
                    <p className="text-[11px] text-red-600">No classes are assigned to you yet, so you can't upload.</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={LABEL_CLASS}>Grade *</Label>
                    <Select value={form.grade_level} onValueChange={(v) => setField('grade_level', v)}>
                      <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={LABEL_CLASS}>Subject{form.item_type === 'revision' ? ' *' : ''}</Label>
                    <Select value={form.subject_id} onValueChange={(v) => setField('subject_id', v)}>
                      <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SUBJECT}>No subject</SelectItem>
                        {(subjects as any[]).map((sbj) => (
                          <SelectItem key={sbj.id} value={sbj.id}>{sbj.name}{sbj.code ? ` - ${sbj.code}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Files: only when creating */}
              {!editing && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="lib-file" className={LABEL_CLASS}>
                      File * <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">({typeMeta.hint} · max 50 MB)</span>
                    </Label>
                    <FilePicker
                      key={form.item_type}
                      id="lib-file"
                      accept={typeMeta.accept}
                      file={file}
                      onChange={setFile}
                      placeholder="Click to choose a file…"
                      icon={Paperclip}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lib-cover" className={LABEL_CLASS}>
                      Cover image <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">(optional · PNG or JPG)</span>
                    </Label>
                    <FilePicker
                      id="lib-cover"
                      accept=".png,.jpg,.jpeg,.webp"
                      file={coverFile}
                      onChange={setCoverFile}
                      placeholder="Click to choose a cover…"
                      icon={ImageIcon}
                    />
                  </div>
                </>
              )}
            </div>

            {formError && (
              <div className="mt-3 rounded-xl p-3 bg-red-50 text-red-700 text-sm flex items-start gap-2 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row sm:justify-end gap-3 p-4 sm:p-5 border-t border-[#7a1f2b]/10 bg-white">
              <Button type="button" variant="outline" onClick={closeModal}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button type="submit" disabled={saving}
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{editing ? 'Saving…' : 'Uploading…'}</>
                  : editing
                  ? 'Save Changes'
                  : <><Plus className="w-4 h-4 mr-1.5" />Add to Library</>}
              </Button>
            </div>
          </form>
      </ModalShell>

      {/* ══════════ Delete confirm ══════════ */}
      <ModalShell open={!!deleting} onClose={() => { if (!deleteMutation.isPending) setDeleting(null); }} maxWidth="sm:max-w-md">
          <DialogHero icon={Trash2} microLabel="Delete" title="Remove from Library?" subtitle={deleting?.title} />
          <div className="p-4 sm:p-5 space-y-3">
            <p className="text-sm text-[#3a1b1f]/80">
              This permanently removes the item and its file. Students will no longer see it.
            </p>
            {deleteError && (
              <div className="rounded-xl p-3 bg-red-50 text-red-700 text-sm flex items-start gap-2 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5">
                Cancel
              </Button>
              <Button type="button" disabled={deleteMutation.isPending}
                onClick={() => deleting && deleteMutation.mutate(deleting)}
                className="h-10 rounded-xl text-white border-0 bg-red-600 hover:bg-red-700 active:scale-[0.98]">
                {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : 'Delete'}
              </Button>
            </div>
          </div>
      </ModalShell>
    </div>
  );
}