// src/Components/Admin/AnnouncementsSection.tsx
import { supabase } from '@/lib/supabaseClient';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, Bell, Trash2, Users, Calendar, AlertTriangle, Megaphone, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/Components/ui/dialog';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import { format } from 'date-fns';

// ─── Design tokens (mirrors every other Admin section) ───────────────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
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

// ─── Priority pill ────────────────────────────────────────────────────────────
function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; fg: string; border: string; label: string }> = {
    urgent: { bg: 'rgba(239,68,68,0.10)',  fg: '#B91C1C', border: 'rgba(239,68,68,0.25)',  label: 'Urgent' },
    high:   { bg: 'rgba(249,115,22,0.12)', fg: '#C2410C', border: 'rgba(249,115,22,0.25)', label: 'High' },
    normal: { bg: 'rgba(122,31,43,0.08)',  fg: '#7a1f2b', border: 'rgba(122,31,43,0.20)',  label: 'Normal' },
    low:    { bg: 'rgba(107,114,128,0.12)',fg: '#4B5563', border: 'rgba(107,114,128,0.25)',label: 'Low' },
  };
  const cfg = map[priority] || map.normal;
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border shrink-0"
      style={{ background: cfg.bg, color: cfg.fg, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnnouncementsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [classId, setClassId] = useState('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const queryClient = useQueryClient();

  // === Fetch Announcements ===
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // === Fetch Classes ===
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) throw error;
      return data;
    },
  });

  // === Create Announcement ===
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { title, content, expires_at } = data;

      const announcementData = {
        title: title.trim(),
        content: content?.trim() || '',
        priority,
        class_id: classId === 'all' ? null : classId,
        is_for_all_classes: classId === 'all',
        expires_at: expires_at || null,
      };

      const { error } = await supabase.from('announcements').insert([announcementData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setShowAddModal(false);
      setPriority('normal');
      setClassId('all');
      setFormError(null);
    },
    onError: (error: any) => {
      console.error('Error creating announcement:', error);
      setFormError(error?.message || 'Failed to create announcement. Check your fields.');
    },
  });

  // === Delete Announcement ===
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setDeleteTarget(null);
    },
  });

  // === Handle Form Submit ===
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    createMutation.mutate(data);
  };

  // ✅ Get class name for display
  const getClassName = (announcement: any) => {
    if (announcement.is_for_all_classes || !announcement.class_id) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          All Classes
        </span>
      );
    }
    const cls = classes.find((c: any) => c.id === announcement.class_id);
    return cls ? cls.name : 'Unknown Class';
  };

  const handleCloseForm = () => {
    setShowAddModal(false);
    setPriority('normal');
    setClassId('all');
    setFormError(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">

      {/* ══════════ MAIN CARD ══════════ */}
      <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <SectionHeader
          icon={Bell}
          microLabel="Communication"
          title="Announcements Management"
          description="Publish updates and notices to students, teachers, and classes"
          right={
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-white text-xs font-medium border border-white/20 bg-white/15 hover:bg-white/25 transition-colors active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" /> New Announcement
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
            <Plus className="w-4 h-4 mr-1.5" /> New Announcement
          </Button>
        </div>

        <CardContent className="p-3 sm:p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'rgba(122,31,43,0.06)' }} />
              ))}
            </div>
          ) : announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((a: any) => (
                <Card
                  key={a.id}
                  className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden hover:-translate-y-0.5 transition-all"
                  style={{ boxShadow: CARD_SHADOW }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW_HOVER}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW}
                >
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(122,31,43,0.08)' }}>
                            <Megaphone className="w-4 h-4 text-[#7a1f2b]" />
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-[#3a1b1f] truncate">
                            {a.title}
                          </h3>
                          <PriorityPill priority={a.priority} />
                          {(a.is_for_all_classes || !a.class_id) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border border-[#7a1f2b]/20 text-[#7a1f2b]"
                              style={{ background: 'rgba(122,31,43,0.05)' }}>
                              <Users className="w-3 h-3" />
                              All Classes
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        {a.content && (
                          <p className="text-sm text-[#3a1b1f]/80 mb-3 leading-relaxed whitespace-pre-wrap break-words">
                            {a.content}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                          {a.created_at && (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(a.created_at), 'MMM d, yyyy • h:mm a')}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            Target: {getClassName(a)}
                          </span>
                          {a.expires_at && (
                            <span className="inline-flex items-center gap-1.5 text-amber-700">
                              <AlertTriangle className="w-3 h-3" />
                              Expires: {format(new Date(a.expires_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(a)}
                        disabled={deleteMutation.isPending}
                        className="w-9 h-9 rounded-lg text-red-500/70 hover:text-red-600 hover:bg-red-50 active:scale-95 flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(122,31,43,0.06)' }}>
                <Bell className="w-7 h-7 text-[#7a1f2b]/40" />
              </div>
              <p className="font-semibold text-[#3a1b1f]">No announcements yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click <strong className="text-[#7a1f2b]">New Announcement</strong> to publish your first one.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════ Add Modal ══════════ */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) handleCloseForm(); else setShowAddModal(true); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
          <DialogHero
            icon={Megaphone}
            microLabel="New Notice"
            title="Create New Announcement"
            subtitle="Sent to all classes by default"
          />
          <form onSubmit={handleSubmit} className="p-4 sm:p-5">
            <div className="grid gap-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Title *
                </Label>
                <Input id="title" name="title" placeholder="Announcement title" required
                  className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Content *
                </Label>
                <Textarea id="content" name="content" placeholder="Announcement details…" rows={4} required
                  className="rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30 resize-none" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Priority
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Target Class
                </Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        All Classes
                      </div>
                    </SelectItem>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expires_at" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">
                  Expiration Date <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="expires_at" name="expires_at" type="date"
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
              <Button type="button" variant="outline" onClick={handleCloseForm}
                className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}
                className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
                style={GRADIENT_BTN_STYLE}>
                {createMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                  : <><Plus className="w-4 h-4 mr-1.5" />Create Announcement</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════════ Delete Confirmation ══════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md max-w-[95vw] p-4 sm:p-6 rounded-2xl border-[#7a1f2b]/15">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              Delete Announcement
            </DialogTitle>
            <DialogDescription className="pt-2 text-[#3a1b1f]/80">
              Are you sure you want to delete{' '}
              <strong className="text-[#3a1b1f]">"{deleteTarget?.title}"</strong>?
              <span className="block mt-1.5 text-red-600 font-medium text-xs">
                This action cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#7a1f2b]/10 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}
              className="rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl active:scale-[0.98] border-0"
              disabled={deleteMutation.isPending}
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}>
              {deleteMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
                : <><Trash2 className="w-4 h-4 mr-2" /> Yes, Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}