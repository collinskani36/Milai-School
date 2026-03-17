import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Download, X, Calendar } from "lucide-react";
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { Capacitor } from "@capacitor/core";

// ─── Capacitor helper (same pattern as Assessments.tsx) ───────────────────────

const isNative =
  Capacitor &&
  typeof Capacitor.isNativePlatform === "function" &&
  Capacitor.isNativePlatform();

function triggerPDFDownload(blob: Blob, fileName: string) {
  if (isNative) {
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Slot / day constants ─────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const WEEKDAY_SLOTS = [
  { id: 'p1',   label: 'Period 1', time: '8:00 – 8:40',   type: 'lesson' },
  { id: 'p2',   label: 'Period 2', time: '8:40 – 9:20',   type: 'lesson' },
  { id: 'p3',   label: 'Period 3', time: '9:20 – 10:00',  type: 'lesson' },
  { id: 'brk',  label: 'Break',    time: '10:00 – 10:30', type: 'break'  },
  { id: 'p4',   label: 'Period 4', time: '10:30 – 11:10', type: 'lesson' },
  { id: 'p5',   label: 'Period 5', time: '11:10 – 11:50', type: 'lesson' },
  { id: 'p6',   label: 'Period 6', time: '11:50 – 12:30', type: 'lesson' },
  { id: 'lnch', label: 'Lunch',    time: '12:30 – 1:10',  type: 'lunch'  },
  { id: 'p7',   label: 'Period 7', time: '1:10 – 1:50',   type: 'lesson' },
  { id: 'p8',   label: 'Period 8', time: '1:50 – 2:30',   type: 'lesson' },
];

const WEEKEND_SLOTS = [
  { id: 'ws1',  time: '6:00 – 7:00'   },
  { id: 'ws2',  time: '7:00 – 8:00'   },
  { id: 'ws3',  time: '8:00 – 9:00'   },
  { id: 'ws4',  time: '9:00 – 10:00'  },
  { id: 'ws5',  time: '10:00 – 11:00' },
  { id: 'ws6',  time: '11:00 – 12:00' },
  { id: 'ws7',  time: '12:00 – 1:00'  },
  { id: 'ws8',  time: '1:00 – 2:00'   },
  { id: 'ws9',  time: '2:00 – 3:00'   },
  { id: 'ws10', time: '3:00 – 4:00'   },
  { id: 'ws11', time: '4:00 – 5:00'   },
  { id: 'ws12', time: '5:00 – 6:00'   },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekdayCell {
  subjectId:   string;
  subjectName: string;
  subjectCode: string;
  teacherId:   string;
  teacherName: string;
}

interface WeekendCell {
  saturday: string;
  sunday:   string;
}

interface TimetableData {
  weekday: Record<string, Record<string, WeekdayCell | null>>;
  weekend: Record<string, WeekendCell>;
}

interface ClassTimetableViewerProps {
  isOpen:    boolean;
  onClose:   () => void;
  timetable: { className: string; term: number; academicYear: string; data: TimetableData } | null;
  teacherId: string;
}

// ─── PDF document (react-pdf/renderer) ───────────────────────────────────────
// Rendered server-side via dynamic import — same pattern as ExamPDF in Assessments.tsx

const pdfStyles = StyleSheet.create({
  page:        { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  title:       { fontSize: 13, fontWeight: "bold", textAlign: "center", marginBottom: 2 },
  subtitle:    { fontSize: 9, textAlign: "center", color: "#555", marginBottom: 10 },
  sectionHead: { fontSize: 9, fontWeight: "bold", marginBottom: 4, marginTop: 8, color: "#1a1a1a" },
  table:       { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 2 },
  headerRow:   { flexDirection: "row", backgroundColor: "#166534" },
  headerCell:  { color: "#fff", fontWeight: "bold", padding: "4 5", flex: 1, fontSize: 7 },
  headerCellNarrow: { color: "#fff", fontWeight: "bold", padding: "4 5", width: 54, fontSize: 7 },
  row:         { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  rowAlt:      { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  rowBreak:    { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", backgroundColor: "#fef9c3" },
  rowLunch:    { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", backgroundColor: "#eff6ff" },
  cell:        { padding: "3 5", flex: 1, fontSize: 7 },
  cellNarrow:  { padding: "3 5", width: 54, fontSize: 7 },
  cellMy:      { padding: "3 5", flex: 1, fontSize: 7, backgroundColor: "#7c2d12", color: "#fed7aa" },
  cellFixed:   { padding: "3 5", flex: 5, fontSize: 7, color: "#92400e", fontStyle: "italic" },
  legend:      { flexDirection: "row", gap: 12, marginTop: 6 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot:   { width: 7, height: 7, borderRadius: 2 },
  legendText:  { fontSize: 6.5, color: "#555" },
  footer:      { position: "absolute", bottom: 14, left: 24, right: 24, textAlign: "center", fontSize: 6.5, color: "#aaa" },
  weekendHeaderRow: { flexDirection: "row", backgroundColor: "#1e40af" },
  weekendHeaderCell: { color: "#fff", fontWeight: "bold", padding: "4 5", flex: 1, fontSize: 7 },
  weekendHeaderCellNarrow: { color: "#fff", fontWeight: "bold", padding: "4 5", width: 70, fontSize: 7 },
  weekendCell: { padding: "3 5", flex: 1, fontSize: 7 },
  weekendCellNarrow: { padding: "3 5", width: 70, fontSize: 7 },
});

function TimetablePDF({
  timetable,
  teacherId,
}: {
  timetable: { className: string; term: number; academicYear: string; data: TimetableData };
  teacherId: string;
}) {
  const { className, term, academicYear, data } = timetable;

  return (
    <Document>
      {/* ── Weekday page ── */}
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>{className} — Class Timetable</Text>
        <Text style={pdfStyles.subtitle}>Term {term} · {academicYear} · Weekday Schedule (Mon–Fri)</Text>

        <View style={pdfStyles.table}>
          {/* Header */}
          <View style={pdfStyles.headerRow}>
            <Text style={pdfStyles.headerCellNarrow}>Period</Text>
            <Text style={pdfStyles.headerCellNarrow}>Time</Text>
            {DAYS.map(d => <Text key={d} style={pdfStyles.headerCell}>{d}</Text>)}
          </View>

          {/* Rows */}
          {WEEKDAY_SLOTS.map((slot, idx) => {
            if (slot.type === 'break') {
              return (
                <View key={slot.id} style={pdfStyles.rowBreak}>
                  <Text style={pdfStyles.cellNarrow}>Break</Text>
                  <Text style={pdfStyles.cellNarrow}>{slot.time}</Text>
                  <Text style={pdfStyles.cellFixed}>— Break time —</Text>
                </View>
              );
            }
            if (slot.type === 'lunch') {
              return (
                <View key={slot.id} style={pdfStyles.rowLunch}>
                  <Text style={pdfStyles.cellNarrow}>Lunch</Text>
                  <Text style={pdfStyles.cellNarrow}>{slot.time}</Text>
                  <Text style={pdfStyles.cellFixed}>— Lunch break —</Text>
                </View>
              );
            }
            const rowStyle = idx % 2 === 0 ? pdfStyles.row : pdfStyles.rowAlt;
            return (
              <View key={slot.id} style={rowStyle}>
                <Text style={pdfStyles.cellNarrow}>{slot.label}</Text>
                <Text style={pdfStyles.cellNarrow}>{slot.time}</Text>
                {DAYS.map(day => {
                  const cell = data.weekday?.[slot.id]?.[day] ?? null;
                  const isMe = cell?.teacherId === teacherId;
                  return (
                    <Text key={day} style={isMe ? pdfStyles.cellMy : pdfStyles.cell}>
                      {cell
                        ? `${cell.subjectCode}\n${cell.teacherName.split(' ').slice(-1)[0]}${isMe ? '\n(You)' : ''}`
                        : ''}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={pdfStyles.legend}>
          <View style={pdfStyles.legendItem}>
            <View style={[pdfStyles.legendDot, { backgroundColor: '#7c2d12' }]} />
            <Text style={pdfStyles.legendText}>Your periods</Text>
          </View>
          <View style={pdfStyles.legendItem}>
            <View style={[pdfStyles.legendDot, { backgroundColor: '#f0fdf4', borderWidth: 0.5, borderColor: '#86efac' }]} />
            <Text style={pdfStyles.legendText}>Other teacher</Text>
          </View>
        </View>

        <Text style={pdfStyles.footer}>
          Generated by Milai School System · {new Date().toLocaleDateString()}
        </Text>
      </Page>

      {/* ── Weekend page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>{className} — Weekend Timetable (Boarding)</Text>
        <Text style={pdfStyles.subtitle}>Term {term} · {academicYear} · Saturday & Sunday</Text>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.weekendHeaderRow}>
            <Text style={pdfStyles.weekendHeaderCellNarrow}>Time</Text>
            <Text style={pdfStyles.weekendHeaderCell}>Saturday</Text>
            <Text style={pdfStyles.weekendHeaderCell}>Sunday</Text>
          </View>
          {WEEKEND_SLOTS.map((slot, idx) => {
            const cell = data.weekend?.[slot.id];
            const rowStyle = idx % 2 === 0 ? pdfStyles.row : pdfStyles.rowAlt;
            return (
              <View key={slot.id} style={rowStyle}>
                <Text style={pdfStyles.weekendCellNarrow}>{slot.time}</Text>
                <Text style={pdfStyles.weekendCell}>{cell?.saturday ?? ''}</Text>
                <Text style={pdfStyles.weekendCell}>{cell?.sunday   ?? ''}</Text>
              </View>
            );
          })}
        </View>

        <Text style={pdfStyles.footer}>
          Generated by Milai School System · {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClassTimetableViewer({
  isOpen, onClose, timetable, teacherId,
}: ClassTimetableViewerProps) {
  const [activeTab, setActiveTab] = React.useState<'weekday' | 'weekend'>('weekday');
  const [downloading, setDownloading]   = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ── Download PDF — same dynamic-import pattern as Assessments.tsx ──────────
  const handleDownloadPDF = useCallback(async () => {
    if (!timetable) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <TimetablePDF timetable={timetable} teacherId={teacherId} />
      ).toBlob();
      const fileName = `Timetable_${timetable.className.replace(/\s+/g, '_')}_Term${timetable.term}_${timetable.academicYear}.pdf`;
      triggerPDFDownload(blob, fileName);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setDownloadError("Failed to generate PDF. Please try again.");
      setTimeout(() => setDownloadError(null), 4000);
    } finally {
      setDownloading(false);
    }
  }, [timetable, teacherId]);

  if (!timetable) return null;

  const { data, className, term, academicYear } = timetable;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between px-5 py-3 border-b gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 text-green-600 shrink-0" />
            <DialogTitle className="text-sm sm:text-base font-semibold truncate">
              {className} — Term {term}, {academicYear}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 mr-2">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#7c2d12] inline-block opacity-80" />
                Your periods
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />
                Other teacher
              </span>
            </div>

            {/* Download button — same pattern as Assessments.tsx */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="h-8 text-xs gap-1.5"
            >
              {downloading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-gray-600" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Save PDF
                </>
              )}
            </Button>

            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Error banner */}
        {downloadError && (
          <div className="flex-shrink-0 mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
            <span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex-shrink-0 flex border-b bg-gray-50">
          {(['weekday', 'weekend'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab
                  ? 'border-green-600 text-green-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab === 'weekday' ? '📅 Mon – Fri' : '🏠 Weekend (Boarding)'}
            </button>
          ))}
        </div>

        {/* Scrollable table area */}
        <div className="flex-1 overflow-auto p-3 sm:p-4">

          {/* WEEKDAY TABLE */}
          {activeTab === 'weekday' && (
            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                    <th className="text-left px-4 py-3 text-xs font-semibold w-24 rounded-tl-xl">Period</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold w-28">Time</th>
                    {DAYS.map((day, i) => (
                      <th key={day} className={`text-center px-2 py-3 text-xs font-semibold ${i === 4 ? 'rounded-tr-xl' : ''}`}>
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{day.slice(0, 3)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAY_SLOTS.map((slot, idx) => {
                    if (slot.type === 'break') {
                      return (
                        <tr key={slot.id} className="bg-amber-50">
                          <td className="px-4 py-2">
                            <span className="text-xs font-bold text-amber-600">☕ Break</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">{slot.time}</td>
                          <td colSpan={5} className="px-3 py-2 text-center text-xs italic text-amber-400">
                            — Break time —
                          </td>
                        </tr>
                      );
                    }
                    if (slot.type === 'lunch') {
                      return (
                        <tr key={slot.id} className="bg-blue-50">
                          <td className="px-4 py-2">
                            <span className="text-xs font-bold text-blue-600">🍽 Lunch</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">{slot.time}</td>
                          <td colSpan={5} className="px-3 py-2 text-center text-xs italic text-blue-400">
                            — Lunch break —
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={slot.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <td className="px-4 py-1.5">
                          <span className="text-xs font-semibold text-gray-700">{slot.label}</span>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="text-xs text-gray-400 whitespace-nowrap">{slot.time}</span>
                        </td>
                        {DAYS.map(day => {
                          const cell: WeekdayCell | null = data.weekday?.[slot.id]?.[day] ?? null;
                          const isMyPeriod = cell?.teacherId === teacherId;

                          return (
                            <td key={day} className="px-1.5 py-1.5 align-top">
                              {cell ? (
                                <div className={`px-2 py-1.5 rounded text-xs min-h-[44px] flex flex-col justify-center
                                  ${isMyPeriod
                                    ? 'bg-[#7c2d12] border border-[#9a3412] text-white'
                                    : 'bg-green-50 border border-green-100 text-green-900'
                                  }`}
                                >
                                  <div className={`font-bold text-[11px] ${isMyPeriod ? 'text-orange-200' : 'text-green-800'}`}>
                                    {cell.subjectCode}
                                  </div>
                                  <div className={`text-[10px] truncate ${isMyPeriod ? 'text-orange-100' : 'text-green-600'}`}>
                                    {cell.teacherName.split(' ').slice(-1)[0]}
                                  </div>
                                  {isMyPeriod && (
                                    <div className="text-[9px] text-orange-200 mt-0.5 font-medium">You</div>
                                  )}
                                </div>
                              ) : (
                                <div className="px-2 py-1.5 rounded text-xs min-h-[44px] bg-gray-50 border border-dashed border-gray-100 flex items-center justify-center">
                                  <span className="text-gray-200">—</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* WEEKEND TABLE */}
          {activeTab === 'weekend' && (
            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
              <table className="w-full min-w-[400px] border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="text-left px-4 py-3 text-xs font-semibold w-32 rounded-tl-xl">Time</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold">Saturday</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold rounded-tr-xl">Sunday</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKEND_SLOTS.map((slot, idx) => {
                    const cell = data.weekend?.[slot.id];
                    return (
                      <tr key={slot.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <td className="px-4 py-2">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{slot.time}</span>
                        </td>
                        {(['saturday', 'sunday'] as const).map(dayKey => (
                          <td key={dayKey} className="px-3 py-1.5 text-center">
                            {cell?.[dayKey] ? (
                              <span className="text-xs text-blue-800 bg-blue-50 border border-blue-100 px-2 py-1 rounded">
                                {cell[dayKey]}
                              </span>
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Mobile legend */}
        <div className="sm:hidden flex-shrink-0 flex items-center justify-center gap-4 px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#7c2d12] inline-block opacity-80" />Your periods
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />Other teacher
          </span>
        </div>

      </DialogContent>
    </Dialog>
  );
}