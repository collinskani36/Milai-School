// src/Components/Library/LibraryViewer.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { ChevronLeft, Download, Loader2, AlertTriangle, ExternalLink, BookOpen } from 'lucide-react';

export interface LibraryViewerItem {
  id: string;
  title: string;
  item_type: 'book' | 'lesson';
  file_url: string;
}

// ─── Download helper (shared with the Library screen) ────────────────────────
// Supabase adds "Content-Disposition: attachment" when ?download=<name> is present,
// so the browser saves a real file (a .html lesson then opens fine in Chrome).
// '_system' hands the link to the phone's browser instead of the in-app WebView.
export function downloadLibraryItem(item: LibraryViewerItem) {
  const ext = item.item_type === 'book' ? '.pdf' : '.html';
  const name = `${item.title.replace(/[^\w\- ]+/g, '').trim() || 'milai-library'}${ext}`;
  const sep = item.file_url.includes('?') ? '&' : '?';
  window.open(`${item.file_url}${sep}download=${encodeURIComponent(name)}`, '_system');
}

// ─── Viewer ──────────────────────────────────────────────────────────────────
export default function LibraryViewer({
  item, onClose,
}: { item: LibraryViewerItem; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Android hardware back button closes the viewer instead of leaving the app
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let cancelled = false;
    CapacitorApp.addListener('backButton', () => closeRef.current())
      .then((h) => { if (cancelled) h.remove(); else handle = h; })
      .catch(() => { /* not running inside Capacitor (plain browser) */ });
    return () => { cancelled = true; handle?.remove(); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div
        className="shrink-0 text-white"
        style={{
          background: 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 100%)',
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: '0 2px 14px rgba(122,31,43,0.3)',
        }}
      >
        <div className="flex items-center gap-2 px-3 h-14">
          <button
            onClick={onClose}
            aria-label="Back to library"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/12 border border-white/15 active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="flex-1 min-w-0 truncate text-sm font-semibold">{item.title}</p>
          <button
            onClick={() => downloadLibraryItem(item)}
            aria-label="Download"
            className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold bg-white/12 border border-white/15 active:scale-95 shrink-0"
          >
            <Download className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 bg-[#fdfbfb]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {item.item_type === 'lesson' ? <LessonFrame item={item} /> : <BookPlaceholder item={item} />}
      </div>
    </div>,
    document.body,
  );
}

// ─── Animated lesson: fetched as text and shown in a sandboxed iframe ────────
function LessonFrame({ item }: { item: LibraryViewerItem }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setHtml(null);
    setError(null);
    try {
      const res = await fetch(item.file_url);
      if (!res.ok) throw new Error(`Could not load the lesson (${res.status}).`);
      setHtml(await res.text());
    } catch (e: any) {
      setError(e?.message || 'Could not load the lesson. Check your internet connection.');
    }
  }, [item.file_url]);

  useEffect(() => { load(); }, [load, attempt]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
        <AlertTriangle className="w-8 h-8 text-[#7a1f2b]/50" />
        <p className="text-sm text-[#3a1b1f]">{error}</p>
        <button
          onClick={() => setAttempt((n) => n + 1)}
          className="h-10 px-5 rounded-xl text-white text-sm font-semibold active:scale-95"
          style={{ background: '#7a1f2b' }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (html === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-[#7a1f2b]/70">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Loading lesson…</p>
      </div>
    );
  }

  return (
    <iframe
      title={item.title}
      srcDoc={html}
      sandbox="allow-scripts allow-forms"
      className="w-full h-full border-0 bg-white"
    />
  );
}

// ─── Books: temporary until the in-app PDF reader is added ───────────────────
function BookPlaceholder({ item }: { item: LibraryViewerItem }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(122,31,43,0.07)' }}>
        <BookOpen className="w-6 h-6 text-[#7a1f2b]/60" />
      </div>
      <p className="text-sm font-semibold text-[#3a1b1f]">{item.title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        The in-app PDF reader is coming next. For now you can open the book in your browser.
      </p>
      <button
        onClick={() => window.open(item.file_url, '_system')}
        className="h-10 px-5 rounded-xl text-white text-sm font-semibold inline-flex items-center gap-2 active:scale-95"
        style={{ background: '#7a1f2b' }}
      >
        <ExternalLink className="w-4 h-4" /> Open book
      </button>
    </div>
  );
}
