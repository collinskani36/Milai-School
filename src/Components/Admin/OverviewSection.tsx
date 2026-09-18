
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Bell,
  ChevronRight,
  School,
  Calendar,
} from 'lucide-react';
import { Skeleton } from '@/Components/ui/skeleton';
import { Card, CardContent } from '@/Components/ui/card';
import { format } from 'date-fns';

// ---------- Design tokens (mirrors Teacher / Student dashboards) ----------
const MAROON = '#7a1f2b';
const MAROON_GRADIENT =
  'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const CARD_SHADOW = '0 6px 26px -18px rgba(122,31,43,0.22)';
const CARD_SHADOW_HOVER = '0 10px 40px -18px rgba(122,31,43,0.35)';
const HERO_SHADOW = '0 18px 40px -22px rgba(122,31,43,0.45)';

// ---------- Shared small components ----------
type SectionHeaderProps = {
  icon: React.ComponentType<any>;
  microLabel: string;
  title: string;
  description?: string;
};
const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  microLabel,
  title,
  description,
}) => {
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
      </div>
    </div>
  );
};

type StatCardProps = {
  icon: React.ComponentType<any>;
  title: string;
  value: React.ReactNode;
  onClick?: () => void;
};
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full h-full rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      style={{ boxShadow: CARD_SHADOW }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = CARD_SHADOW)}
    >
      <div className="p-3 sm:p-4 flex flex-col items-center justify-center text-center h-full">
        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-2"
          style={{
            background: MAROON_GRADIENT,
            boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)',
          }}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="text-xl sm:text-3xl font-bold text-[#3a1b1f] leading-none">
          {value}
        </div>
        <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-1.5">
          {title}
        </p>
      </div>
    </button>
  );
};

type PriorityPillProps = { priority?: string };
const PriorityPill: React.FC<PriorityPillProps> = ({ priority }) => {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    urgent: { bg: 'rgba(239,68,68,0.10)', fg: '#B91C1C', label: 'Urgent' },
    high: { bg: 'rgba(249,115,22,0.12)', fg: '#C2410C', label: 'High' },
    normal: { bg: 'rgba(122,31,43,0.08)', fg: '#7a1f2b', label: 'Normal' },
    low: { bg: 'rgba(107,114,128,0.12)', fg: '#4B5563', label: 'Low' },
  };
  const cfg = map[priority ?? 'normal'] || map.normal;
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
};

// ---------- Main component ----------
type OverviewSectionProps = {
  setActiveView?: (view: string) => void;
};

export default function OverviewSection({ setActiveView }: OverviewSectionProps) {
  // 🧠 Supabase Query Functions
  const fetchTable = async (table: string, limit?: number): Promise<any[]> => {
    let query: any = supabase.from(table).select('*');
    if (limit) query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  // 👩‍🎓 Students — count only
  const { data: studentCount = 0, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  // 👩‍🏫 Teachers — count only
  const { data: teacherCount = 0, isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('teachers')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  // 📚 Classes
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => fetchTable('classes'),
  });

  // 🧾 Subjects
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => fetchTable('subjects'),
  });

  // 🔔 Announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => fetchTable('announcements', 5),
  });

  const isLoading =
    loadingStudents || loadingTeachers || loadingClasses || loadingSubjects;

  // ---------- Loading skeleton (themed) ----------
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Skeleton
          className="h-24 sm:h-28 rounded-2xl"
          style={{ background: 'rgba(122,31,43,0.08)' }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className="h-28 sm:h-32 rounded-2xl"
              style={{ background: 'rgba(122,31,43,0.08)' }}
            />
          ))}
        </div>
        <Skeleton
          className="h-64 rounded-2xl"
          style={{ background: 'rgba(122,31,43,0.08)' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">
      {/* ── HERO ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5"
        style={{ background: MAROON_GRADIENT, boxShadow: HERO_SHADOW }}
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

        <div className="relative flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <School className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">
              Administration
            </p>
            <h1 className="text-base sm:text-xl font-bold text-white leading-tight truncate">
              School Overview
            </h1>
            <p className="text-[11px] sm:text-xs text-white/70 mt-1">
              Manage students, staff, classes and announcements
            </p>
          </div>
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Users}
          title="Students"
          value={studentCount}
          onClick={() => setActiveView && setActiveView('students')}
        />
        <StatCard
          icon={GraduationCap}
          title="Teachers"
          value={teacherCount}
          onClick={() => setActiveView && setActiveView('teachers')}
        />
        <StatCard
          icon={BookOpen}
          title="Classes"
          value={classes.length}
          onClick={() => setActiveView && setActiveView('classes')}
        />
        <StatCard
          icon={ClipboardList}
          title="Subjects"
          value={subjects.length}
          onClick={() => setActiveView && setActiveView('classes')}
        />
      </div>

      {/* ── ANNOUNCEMENTS ── */}
      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <SectionHeader
          icon={Bell}
          microLabel="Communication"
          title="Recent Announcements"
          description="Latest updates across the school"
        />
        <CardContent className="p-3 sm:p-4">
          {loadingAnnouncements ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl animate-pulse"
                  style={{ background: 'rgba(122,31,43,0.06)' }}
                />
              ))}
            </div>
          ) : announcements.length > 0 ? (
            <div className="space-y-2">
              {announcements.map((announcement: any) => (
                <div
                  key={announcement.id}
                  className="group p-3 sm:p-3.5 rounded-xl border border-[#7a1f2b]/10 hover:border-[#7a1f2b]/25 hover:bg-[#7a1f2b]/[0.03] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#3a1b1f] truncate">
                        {announcement.title}
                      </p>
                      {announcement.content && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                          {announcement.content.substring(0, 120)}
                          {announcement.content.length > 120 ? '…' : ''}
                        </p>
                      )}
                    </div>
                    <PriorityPill priority={announcement.priority} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {announcement.created_at
                      ? format(new Date(announcement.created_at), 'MMM d, yyyy')
                      : 'N/A'}
                  </p>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setActiveView && setActiveView('announcements')}
                className="w-full mt-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#7a1f2b] hover:bg-[#7a1f2b]/5 border border-[#7a1f2b]/15 transition-colors active:scale-[0.98]"
              >
                View all announcements
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="w-10 h-10 mx-auto mb-3 text-[#7a1f2b]/20" />
              <p className="text-sm text-muted-foreground">
                No announcements yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
