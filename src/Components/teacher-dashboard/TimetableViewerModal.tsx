import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Download, X } from "lucide-react";
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

interface TimetableViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  title?: string;
}

const pdfDocCache = new Map<string, pdfjs.PDFDocumentProxy>();

export default function TimetableViewerModal({ isOpen, onClose, fileUrl, title }: TimetableViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [rendering, setRendering] = useState(false);
  // KEY FIX: a render trigger counter — incrementing it forces renderPage to re-run
  // even when pdfDocument hasn't changed (e.g. on reopen with cached doc)
  const [renderTrigger, setRenderTrigger] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const isRenderingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(1);
      setError(null);
      return;
    }

    if (!fileUrl) return;

    const loadPdf = async () => {
      setError(null);

      if (pdfDocCache.has(fileUrl)) {
        const cached = pdfDocCache.get(fileUrl)!;
        setPdfDocument(cached);
        setTotalPages(cached.numPages);
        setCurrentPage(1);
        // Cached doc won't trigger the pdfDocument useEffect below
        // so we manually bump the render trigger to force a render
        setRenderTrigger(t => t + 1);
        return;
      }

      setLoading(true);
      setPdfDocument(null);
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF (${response.status}). Try downloading instead.`);
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        pdfDocCache.set(fileUrl, pdf);
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        // Also trigger render here for consistency
        setRenderTrigger(t => t + 1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [isOpen, fileUrl]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocument || !canvasRef.current || !containerRef.current) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }

    if (isRenderingRef.current) return;

    isRenderingRef.current = true;
    setRendering(true);
    try {
      const page = await pdfDocument.getPage(pageNum);

      const containerWidth = containerRef.current.clientWidth - 16;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / unscaledViewport.width, 2.0);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.scale(dpr, dpr);

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Full render error:', err?.name, err?.message, err);
        setError(`Failed to render page: ${err?.message || err?.name || 'unknown error'}`);
      }
    } finally {
      isRenderingRef.current = false;
      setRendering(false);
    }
  }, [pdfDocument]);

  // renderTrigger is included so this fires both when doc changes AND when we manually bump it
  useEffect(() => {
    if (pdfDocument && isOpen) renderPage(currentPage);
  }, [pdfDocument, currentPage, renderPage, renderTrigger, isOpen]);

  useEffect(() => {
    if (!pdfDocument) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderPage(currentPage), 150);
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [pdfDocument, currentPage, renderPage]);

  const handleDownload = () => {
    if (!fileUrl) return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = title ? `${title}.pdf` : 'timetable.pdf';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="
          w-full max-w-full h-[100dvh] rounded-none p-0
          sm:max-w-4xl sm:h-[90vh] sm:rounded-lg sm:p-0
          flex flex-col overflow-hidden
        "
      >
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b gap-2">
          <DialogTitle className="text-sm sm:text-base font-semibold truncate flex-1 min-w-0">
            {title || 'Timetable'}
          </DialogTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!fileUrl}
              className="flex items-center gap-1.5 text-xs h-8"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Download</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {pdfDocument && !error && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || rendering}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || rendering}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div ref={containerRef} className="flex-1 overflow-auto flex flex-col items-center bg-muted/20 p-2">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading timetable…</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
              <div className="text-destructive text-sm">{error}</div>
              <p className="text-xs text-muted-foreground">Your browser may not support inline PDF viewing.</p>
              <Button onClick={handleDownload} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Timetable Instead
              </Button>
            </div>
          )}

          {!loading && !error && pdfDocument && (
            <div className="relative">
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <canvas ref={canvasRef} className="shadow-md rounded" />
            </div>
          )}

          {!loading && !error && !pdfDocument && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No PDF loaded
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}