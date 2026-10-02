import { useState } from "react";
import type { ComponentProps } from "react";
import { Card } from "@/Components/ui/card";
import { TrendingUp } from "lucide-react";
import ClassPerformance from "./ClassPerformance";
import KJSEAGradeDistribution from "./KJSEAGradeDistribution";

// ─── Design tokens (same as the rest of the teacher dashboard) ───────────────
const MAROON = "#7a1f2b";
const MAROON_GRADIENT =
  "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";

// Props are borrowed from the two panels so the types never drift apart
type Props =
  Omit<ComponentProps<typeof ClassPerformance>, "perfView" | "setPerfView" | "embedded"> &
  Omit<ComponentProps<typeof KJSEAGradeDistribution>, "embedded">;

type View = "trend" | "recent" | "grades";

const VIEWS: { value: View; label: string }[] = [
  { value: "trend", label: "Trend" },
  { value: "recent", label: "Recent" },
  { value: "grades", label: "KJSEA Grades" },
];

export default function PerformanceAnalytics({
  trendPoints,
  trendSeries,
  loadingTrend,
  classPerformanceData,
  currentAcademicYear,
  termGradeDistributions,
  currentTerm,
}: Props) {
  const [view, setView] = useState<View>("trend");

  return (
    <Card
      className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden flex flex-col h-full"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* Header */}
      <div
        className="relative overflow-hidden px-4 sm:px-5 py-3.5 shrink-0"
        style={{ background: MAROON_GRADIENT }}
      >
        <div
          className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }}
        />
        <div className="relative flex items-start gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
              Insights
            </p>
            <h3 className="text-white font-bold text-sm sm:text-base leading-tight">
              Performance Analytics
            </h3>
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">
              {currentAcademicYear
                ? `Assessment means and KJSEA grades — ${currentAcademicYear}`
                : "Assessment means and KJSEA grades"}
            </p>
          </div>
        </div>
      </div>

      {/* View switch */}
      <div className="shrink-0 px-3 sm:px-5 pt-3 pb-1">
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-[#7a1f2b]/12 bg-[#fdfbfb]"
          role="tablist"
        >
          {VIEWS.map((v) => {
            const active = view === v.value;
            return (
              <button
                key={v.value}
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.value)}
                className={`h-8 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                  active ? "text-white" : "text-[#7a1f2b]/80 hover:bg-[#7a1f2b]/5"
                }`}
                style={active ? { background: MAROON } : undefined}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active panel fills the rest of the card */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "grades" ? (
          <KJSEAGradeDistribution
            embedded
            termGradeDistributions={termGradeDistributions}
            currentTerm={currentTerm}
            currentAcademicYear={currentAcademicYear}
          />
        ) : (
          <ClassPerformance
            embedded
            trendPoints={trendPoints}
            trendSeries={trendSeries}
            loadingTrend={loadingTrend}
            classPerformanceData={classPerformanceData}
            perfView={view}
            setPerfView={() => {}}
            currentAcademicYear={currentAcademicYear}
          />
        )}
      </div>
    </Card>
  );
}