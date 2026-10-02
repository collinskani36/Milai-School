// src/Components/Library/PdfReader.tsx
// In-app PDF reader (pdf.js). Loaded lazily by LibraryViewer so the ~1 MB library
// is only downloaded when a student actually opens a book.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { Loader2, AlertTriangle, ExternalLink, Minus, Plus } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2, 3];
const SIDE_PADDING = 8;          // px each side of the page column
const MAX_CANVAS_PIXELS = 4_000_000; // keeps memory sane on low-end phones

interface Props {
  url: string;
  onOpenExternal: () => void;
}

export default function PdfReader({ url, onOpenExternal }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<number | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [current, setCurrent] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [ratio, setRatio] = useState(1.414); // page height / width, refined once loaded

  const zoom = ZOOM_STEPS[zoomIndex];

  // ── Load the document ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    setProgress(0);
    setCurrent(1);

    const task = pdfjsLib.getDocument({ url });
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (!cancelled && total) setProgress(Math.min(99, Math.round((loaded / total) * 100)));
    };

    task.promise
      .then(async (doc) => {
        const first = await doc.getPage(1);
        if (cancelled) return;
        const vp = first.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        setPdf(doc);
      })
      .catch((e: any) => {
        if (cancelled) return;
        console.error('PDF load failed:', e);
        setError(
          e?.name === 'PasswordException'
            ? 'This PDF is password protected.'
            : 'Could not load this book. Check your internet connection and try again.',
        );
      });

    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url, attempt]);

  // ── Track the visible width ────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf, error]);

  // ── Keep the reading position when zooming ─────────────────────────────────
  const changeZoom = (delta: number) => {
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, zoomIndex + delta));
    if (next === zoomIndex) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight > 0) zoomAnchor.current = el.scrollTop / el.scrollHeight;
    setZoomIndex(next);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && zoomAnchor.current !== null) {
      el.scrollTop = zoomAnchor.current * el.scrollHeight;
      zoomAnchor.current = null;
    }
  }, [zoomIndex]);

  // ── States ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
        <AlertTriangle className="w-8 h-8 text-[#7a1f2b]/50" />
        <p className="text-sm text-[#3a1b1f] max-w-xs">{error}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="h-10 px-5 rounded-xl text-white text-sm font-semibold active:scale-95"
            style={{ background: '#7a1f2b' }}
          >
            Try again
          </button>
          <button
            onClick={onOpenExternal}
            className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 border border-[#7a1f2b]/25 text-[#7a1f2b] active:scale-95"
          >
            <ExternalLink className="w-4 h-4" /> Browser
          </button>
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-[#7a1f2b]/70">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Opening book… {progress > 0 ? `${progress}%` : ''}</p>
      </div>
    );
  }

  const pageWidth = Math.max(0, containerWidth - SIDE_PADDING * 2) * zoom;
  const contentWidth = Math.max(containerWidth, pageWidth + SIDE_PADDING * 2);

  return (
    <div className="relative h-full">
      <div ref={scrollRef} className="h-full overflow-auto overscroll-contain bg-[#ece7e8]">
        <div className="flex flex-col items-center py-2" style={{ width: contentWidth }}>
          {Array.from({ length: pdf.numPages }, (_, i) => (
            <PdfPage
              key={i + 1}
              pdf={pdf}
              pageNumber={i + 1}
              width={pageWidth}
              ratio={ratio}
              rootRef={scrollRef}
              onVisible={setCurrent}
            />
          ))}
        </div>
      </div>

      {/* Floating controls */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 h-11 rounded-full text-white"
        style={{ bottom: 14, background: 'rgba(40,12,16,0.82)', backdropFilter: 'blur(6px)', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)' }}
      >
        <button
          onClick={() => changeZoom(-1)}
          disabled={zoomIndex === 0}
          aria-label="Zoom out"
          className="w-9 h-9 rounded-full flex items-center justify-center active:bg-white/15 disabled:opacity-30"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="min-w-[44px] text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => changeZoom(1)}
          disabled={zoomIndex === ZOOM_STEPS.length - 1}
          aria-label="Zoom in"
          className="w-9 h-9 rounded-full flex items-center justify-center active:bg-white/15 disabled:opacity-30"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/25 mx-1" />
        <span className="px-2 text-xs font-semibold tabular-nums">{current} / {pdf.numPages}</span>
      </div>
    </div>
  );
}

// ─── One page: rendered only while near the viewport, cleared when far away ──
function PdfPage({
  pdf, pageNumber, width, ratio, rootRef, onVisible,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  ratio: number;
  rootRef: React.RefObject<HTMLDivElement>;
  onVisible: (page: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [pageRatio, setPageRatio] = useState(ratio);

  // Use the document's ratio for pages that haven't rendered yet
  useEffect(() => { setPageRatio(ratio); }, [ratio]);

  // Observer 1: is this page within ~2 screens of the viewport? (render / free memory)
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: rootRef.current, rootMargin: '200% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  // Observer 2: is this the page the reader is looking at? (page counter)
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(pageNumber); },
      { root: rootRef.current, threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef, pageNumber, onVisible]);

  // Draw / clear the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!near || width <= 0) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    let cancelled = false;
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | undefined;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      const cssScale = width / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      let viewport = page.getViewport({ scale: cssScale * dpr });
      const pixels = viewport.width * viewport.height;
      if (pixels > MAX_CANVAS_PIXELS) {
        viewport = page.getViewport({ scale: cssScale * dpr * Math.sqrt(MAX_CANVAS_PIXELS / pixels) });
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${(width * base.height) / base.width}px`;
      setPageRatio(base.height / base.width);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
    })().catch((e: any) => {
      if (e?.name !== 'RenderingCancelledException') console.warn(`PDF page ${pageNumber} failed:`, e);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [near, width, pdf, pageNumber]);

  return (
    <div
      ref={holderRef}
      data-page={pageNumber}
      className="relative bg-white mb-2 shrink-0"
      style={{ width, height: width * pageRatio, boxShadow: '0 2px 10px -4px rgba(0,0,0,0.25)' }}
    >
      <canvas ref={canvasRef} className="block" />
      {!near && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-[#7a1f2b]/30 font-semibold select-none">
          {pageNumber}
        </span>
      )}
    </div>
  );
}