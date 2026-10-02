// src/Components/Library/StudentLibrary.tsx
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/Components/ui/input';
import { BookOpen, Sparkles, FileText, Download, Search, Library as LibraryIcon, Loader2, AlertTriangle } from 'lucide-react';
import LibraryViewer, { LibraryViewerItem, downloadLibraryItem } from './LibraryViewer';

const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 100%)';

type Shelf = 'lesson' | 'book' | 'revision';

const SHELF_ICON = { lesson: Sparkles, book: BookOpen, revision: FileText } as const;
const SHELF_NOUN = { lesson: 'lessons', book: 'books', revision: 'past papers' } as const;

interface Item extends LibraryViewerItem {
  description: string | null;
  grade_level: string;
  cover_url: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by_name: string | null;
  subjects?: any;
}

const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : (rel as T);
};

const byGrade = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function StudentLibrary({ classId, hideHero = false }: { classId: string | null; hideHero?: boolean }) {
  const [shelf, setShelf] = useState<Shelf>('lesson');
  const [gradeChoice, setGradeChoice] = useState<string | null>(null); // null = follow the student's own grade
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Item | null>(null);

  // The student's own grade (used as the default filter; everything stays open to all grades)
  const { data: myGrade } = useQuery({
    queryKey: ['library', 'my-grade', classId],
    enabled: !!classId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('grade_level').eq('id', classId as string).maybeSingle();
      return (data?.grade_level as string | undefined) ?? null;
    },
  });

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['library', 'items', 'student'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library_items')
        .select('id, title, description, item_type, grade_level, file_url, cover_url, file_size, created_at, uploaded_by_name, subjects ( name )')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Item[];
    },
  });

  const grades = useMemo(() => {
    const set = new Set<string>(items.map((i) => i.grade_level));
    if (myGrade) set.add(myGrade);
    return Array.from(set).sort(byGrade);
  }, [items, myGrade]);

  const activeGrade = gradeChoice ?? myGrade ?? 'all';

  const counts = useMemo(() => ({
    lesson: items.filter((i) => i.item_type === 'lesson').length,
    book: items.filter((i) => i.item_type === 'book').length,
    revision: items.filter((i) => i.item_type === 'revision').length,
  }), [items]);

  // Items on the chosen shelf, filtered, grouped by grade
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((i) =>
      i.item_type === shelf &&
      (activeGrade === 'all' || i.grade_level === activeGrade) &&
      (!q || i.title.toLowerCase().includes(q)),
    );
    const map = new Map<string, Item[]>();
    filtered.forEach((i) => map.set(i.grade_level, [...(map.get(i.grade_level) ?? []), i]));
    // Past papers read best grouped by subject within each grade; everything else stays newest first
    if (shelf === 'revision') {
      const subjectOf = (i: Item) => firstRel<any>(i.subjects)?.name ?? '';
      map.forEach((list) =>
        list.sort((a, b) => subjectOf(a).localeCompare(subjectOf(b)) || +new Date(b.created_at) - +new Date(a.created_at)),
      );
    }
    return Array.from(map.entries()).sort(([a], [b]) => byGrade(a, b));
  }, [items, shelf, activeGrade, search]);

  const chipClass = (active: boolean) =>
    `shrink-0 h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors active:scale-95 ${
      active ? 'text-white border-transparent' : 'text-[#7a1f2b] border-[#7a1f2b]/20 bg-white'
    }`;

  return (
    <div className="space-y-4">
      {/* Hero */}
      {!hideHero && (
      <div className="relative overflow-hidden rounded-2xl px-4 py-4 text-white" style={{ background: MAROON_GRADIENT, boxShadow: '0 6px 24px -10px rgba(122,31,43,0.35)' }}>
        <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <LibraryIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">Learning Resources</p>
            <h2 className="text-lg font-bold leading-tight">Library</h2>
            <p className="text-[11px] text-white/70">Books, past papers and animated lessons, open to every grade</p>
          </div>
        </div>
      </div>
      )}

      {/* Shelf switch */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white border border-[#7a1f2b]/12">
        {([['lesson', 'Lessons', Sparkles], ['book', 'Books', BookOpen], ['revision', 'Revision', FileText]] as const).map(([id, label, Icon]) => {
          const active = shelf === id;
          return (
            <button
              key={id}
              onClick={() => setShelf(id)}
              className={`h-10 rounded-xl text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors active:scale-[0.98] ${
                active ? 'text-white' : 'text-[#7a1f2b]'
              }`}
              style={active ? { background: MAROON } : undefined}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-[#7a1f2b]/8'}`}>{counts[id]}</span>
            </button>
          );
        })}
      </div>

      {/* Grade chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setGradeChoice('all')} className={chipClass(activeGrade === 'all')} style={activeGrade === 'all' ? { background: MAROON } : undefined}>
          All grades
        </button>
        {grades.map((g) => (
          <button key={g} onClick={() => setGradeChoice(g)} className={chipClass(activeGrade === g)} style={activeGrade === g ? { background: MAROON } : undefined}>
            {g}{g === myGrade ? ' · Mine' : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a1f2b]/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${SHELF_NOUN[shelf]}…`}
          className="h-11 pl-10 rounded-xl border-[#7a1f2b]/15 bg-white focus-visible:ring-[#7a1f2b]/30"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-14 flex flex-col items-center gap-2 text-[#7a1f2b]/70">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-xs">Loading library…</p>
        </div>
      ) : isError ? (
        <div className="py-12 text-center px-4">
          <AlertTriangle className="w-8 h-8 mx-auto text-[#7a1f2b]/40" />
          <p className="text-sm text-[#3a1b1f] mt-2">Could not load the library.</p>
          <button onClick={() => refetch()} className="mt-3 h-10 px-5 rounded-xl text-white text-sm font-semibold active:scale-95" style={{ background: MAROON }}>
            Try again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-12 text-center px-4">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(122,31,43,0.06)' }}>
            {React.createElement(SHELF_ICON[shelf], { className: 'w-7 h-7 text-[#7a1f2b]/40' })}
          </div>
          <p className="font-semibold text-[#3a1b1f]">
            {search ? 'Nothing matches your search' : `No ${SHELF_NOUN[shelf]} here yet`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeGrade !== 'all' ? 'Try “All grades” to browse everything.' : 'Check back soon — new material is added regularly.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([grade, list]) => (
            <section key={grade}>
              <div className="flex items-center gap-2 mb-2.5">
                <h3 className="text-sm font-bold text-[#3a1b1f]">{grade}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7a1f2b]/8 text-[#7a1f2b]">{list.length}</span>
                <div className="flex-1 h-px bg-[#7a1f2b]/10" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {list.map((item) => (
                  <ItemCard key={item.id} item={item} onOpen={() => setViewing(item)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {viewing && <LibraryViewer item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const Icon = SHELF_ICON[item.item_type];
  const subject = firstRel<any>(item.subjects);
  const meta = [subject?.name, formatBytes(item.file_size)].filter(Boolean).join(' · ');
  const actionLabel = item.item_type === 'lesson' ? 'Start' : item.item_type === 'book' ? 'Read' : 'Open';

  return (
    <div className="rounded-2xl bg-white border border-[#7a1f2b]/12 overflow-hidden flex flex-col" style={{ boxShadow: '0 6px 20px -14px rgba(122,31,43,0.3)' }}>
      <button onClick={onOpen} className="relative block w-full aspect-[4/3] active:opacity-90" aria-label={`Open ${item.title}`}>
        {item.cover_url ? (
          <img src={item.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: MAROON_GRADIENT }}>
            <Icon className="w-9 h-9 text-white/80" />
          </div>
        )}
      </button>

      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        <p className="text-[13px] font-semibold text-[#3a1b1f] leading-snug line-clamp-2">{item.title}</p>
        {meta && <p className="text-[10px] text-muted-foreground truncate">{meta}</p>}
        {item.uploaded_by_name && (
          <p className="text-[10px] text-[#7a1f2b]/70 truncate">By {item.uploaded_by_name}</p>
        )}

        <div className="mt-auto pt-1 flex gap-1.5">
          <button
            onClick={onOpen}
            className="flex-1 h-9 rounded-xl text-white text-xs font-semibold active:scale-95"
            style={{ background: MAROON }}
          >
            {actionLabel}
          </button>
          <button
            onClick={() => downloadLibraryItem(item)}
            aria-label="Download"
            className="w-9 h-9 rounded-xl border border-[#7a1f2b]/20 text-[#7a1f2b] flex items-center justify-center active:scale-95"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}