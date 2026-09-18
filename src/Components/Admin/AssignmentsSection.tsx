// src/Components/Admin/AssignmentsSection.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, FileText, Paperclip, ExternalLink, Calendar, AlertTriangle, Loader2, FileUp, X } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { format } from 'date-fns';

// ─── Design tokens (mirrors every other Admin section) ───────────────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
};
const TABLE_HEAD_STYLE: React.CSSProperties = { background: MAROON_GRADIENT };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : (rel as T);
};

// ─── Shared SectionHeader ─────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssignmentsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          total_marks,
          file_url,
          created_at,
          subjects ( name, code ),
          classes ( name )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, name, code');
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) throw error;
      return data || [];
    },
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: res, error } = await supabase.from('assignments').insert([data]);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setShowAddModal(false);
      setFormError(null);
      setSelectedFileName(null);
    },
    onError: (err: any) => {
      console.error('Error creating assignment:', err);
      setFormError(err?.message || 'Failed to create assignment.');
    },
  });

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const filePath = `${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from('assignments')
        .upload(filePath, file);
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from('assignments').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.target);
    const entries = Array.from(formData.entries()).map(([k, v]) => [
      k,
      typeof v === 'string' ? v : '',
    ]);
    const data = Object.fromEntries(entries) as Record<string, any>;
    const fileInput = e.target.querySelector('input[type="file"]');
    if (fileInput.files[0]) {
      const file_url = await handleFileUpload({ target: fileInput });
      data.file_url = file_url;
    }

    if (data.total_marks) {
      (data as any).total_marks = parseFloat(data.total_marks as string);
    }

    createMutation.mutate(data as any);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormError(null);
    setSelectedFileName(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      {/* ══════════ MAIN CARD ══════════ */}
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={FileText}
          microLabel="Classroom"
          title="Assignments Management"
          description="Create and track assignments across subjects and classes"
          right={
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-white text-xs font-medium border border-white/20 bg-white/15 hover:bg-white/25 transition-colors active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" /> Create Assignment
            </button>
          }
        />

        {/* Mobile action row */}
        <div className="sm:hidden p-3 border-b border-[#7a1f2b]/10 bg-[#fdfbfb]">
          <Button
            onClick={() => setShowAddModal(true)}
            className="w-full h-10 rounded-xl text-white border-0 active:scale-[0.98]"
            style={GRADIENT_BTN_STYLE}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create Assignment
          </Button>
        </div>

        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(122,31,43,0.06)' }}>
                <FileText className="w-7 h-7 text-[#7a1f2b]/40" />
              </div>
              <p className="font-semibold text-[#3a1b1f]">No assignments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click <strong className="text-[#7a1f2b]">Create Assignment</strong> to add your first one.
              </p>
            </div>
          ) : (
            <>
              {/* ── Desktop table ── */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10" style={TABLE_HEAD_STYLE}>
                      <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Title</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Subject</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Class</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3">Due Date</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-center">Total Marks</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-white/90 font-semibold py-3 text-right">Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment: any) => {
                      const subject = firstRel(assignment.subjects);
                      const cls     = firstRel(assignment.classes);
                      return (
                        <TableRow key={assignment.id}
                          className="border-b border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.03] transition-colors">
                          <TableCell className="font-medium text-[#3a1b1f]">{assignment.title}</TableCell>
                          <TableCell className="text-sm text-[#3a1b1f]/80">
                            {subject ? (
                              <span>
                                {subject.name}
                                {subject.code && (
                                  <span className="ml-2 text-[10px] font-mono text-[#7a1f2b]/70 bg-[#7a1f2b]/8 px-1.5 py-0.5 rounded">
                                    {subject.code}
                                  </span>
                                )}
                              </span>
                            ) : <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-[#3a1b1f]/80">
                            {cls?.name || <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-[#3a1b1f]/80">
                            {assignment.due_date ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-[#7a1f2b]/50" />
                                {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                              </span>
                            ) : <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {assignment.total_marks ? (
                              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15">
                                {assignment.total_marks}
                              </span>
                            ) : <span className="text-muted-foreground/60">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {assignment.file_url ? (
                              <a
                                href={assignment.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7a1f2b] hover:text-[#5f1620] hover:bg-[#7a1f2b]/5 px-2 py-1 rounded-lg transition-colors"
                              >
                                <Paperclip className="w-3 h-3" />
                                View
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : <span className="text-muted-foreground/60 text-xs">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="sm:hidden divide-y divide-[#7a1f2b]/5">
                {assignments.map((assignment: any) => {
                  const subject = firstRel(assignment.subjects);
                  const cls     = firstRel(assignment.classes);
                  return (
                    <div key={assignment.id} className="p-3.5">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={GRADIENT_BTN_STYLE}>
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-[#3a1b1f] truncate">{assignment.title}</div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                            {subject && (
                              <span className="truncate">
                                {subject.name}
                                {subject.code && <span className="ml-1 font-mono opacity-70">{subject.code}</span>}
                              </span>
                            )}
                            {cls?.name && <><span className="opacity-40">·</span><span className="truncate">{cls.name}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground ml-12">
                        {assignment.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due {format(new Date(assignment.due_date), 'MMM d')}
                          </span>
                        )}
                        {assignment.total_marks && (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b] border border-[#7a1f2b]/15">
                            {assignment.total_marks} marks
                          </span>
                        )}
                      </div>
                      {assignment.file_url && (
                        <div className="ml-12 mt-2">
                          <a
                            href={assignment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7a1f2b] hover:bg-[#7a1f2b]/5 px-2 py-1 rounded-lg border border-[#7a1f2b]/20 transition-colors active:scale-[0.98]"
                          >
                            <Paperclip className="w-3 h-3" /> View Attachment
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ══════════ Add Modal ══════════ */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) handleCloseModal(); else setShowAddModal(true); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
          <DialogHero
            icon={FileUp}
            microLabel="New Assignment"
            title="Create New Assignment"
            subtitle="Attach files, set a due date, and target a class"
          />
          <form onSubmit={handleSubmit} className="p-4 sm:p-5">
            <div className="grid gap-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Assignment Title *
                </Label>
                <Input id="title" name="title" placeholder="e.g., Chapter 3 Homework" required
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Description
                </Label>
                <Textarea id="description" name="description" placeholder="Assignment details…" rows={3}
                  className="rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                    Subject *
                  </Label>
                  <Select name="subject_id" required>
                    <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject: any) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} - {subject.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                    Class *
                  </Label>
                  <Select name="class_id" required>
                    <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="due_date" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                    Due Date *
                  </Label>
                  <Input id="due_date" name="due_date" type="date" required
                    className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="total_marks" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                    Total Marks
                  </Label>
                  <Input id="total_marks" name="total_marks" type="number" placeholder="100"
                    className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="file" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Attachment <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">(optional · PDF, DOC, DOCX)</span>
                </Label>
                <div className="relative">
                  <input
                    id="file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? null)}
                  />
                  <div className={`flex items-center gap-2 h-10 rounded-xl border border-dashed px-3 text-xs transition-colors ${
                    selectedFileName
                      ? 'border-[#7a1f2b]/30 text-[#7a1f2b]'
                      : 'border-[#7a1f2b]/20 text-muted-foreground hover:border-[#7a1f2b]/40 hover:bg-[#7a1f2b]/[0.03]'
                  }`}
                    style={selectedFileName ? { background: 'rgba(122,31,43,0.05)' } : undefined}>
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1">
                      {selectedFileName || 'Click to choose a file…'}
                    </span>
                    {selectedFileName && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFileName(null);
                          const inp = document.getElementById('file') as HTMLInputElement | null;
                          if (inp) inp.value = '';
                        }}
                        className="w-5 h-5 rounded-md text-[#7a1f2b]/50 hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 z-20 relative"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="mt-3 rounded-xl p-3 bg-red-50 text-red-700 text-sm flex items-start gap-2 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
              <Button type="button" variant="outline" onClick={handleCloseModal}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button type="submit" disabled={uploadingFile || createMutation.isPending}
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
                style={GRADIENT_BTN_STYLE}>
                {uploadingFile
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                  : createMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                  : <><Plus className="w-4 h-4 mr-1.5" />Create Assignment</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}