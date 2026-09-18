import { useState } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Target } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ─── Design tokens (mirrors TeacherDashboard) ────────────────────────────────
const MAROON = "#7a1f2b";
const MAROON_GRADIENT =
  "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GradeDistribution { grade: string; count: number; color: string; }
interface TermGradeDistribution { term: number; data: GradeDistribution[]; }

interface KJSEAGradeDistributionProps {
  termGradeDistributions: TermGradeDistribution[];
  currentTerm: number | null;
  currentAcademicYear: string | null;
}

// ─── Section header (matches dashboard) ──────────────────────────────────────
function SectionHeader({
  icon: Icon, microLabel, title, description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  microLabel: string; title: string; description?: string;
}) {
  return (
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
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
            {microLabel}
          </p>
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{title}</h3>
          {description && (
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compact pill toggle ─────────────────────────────────────────────────────
function PillToggle<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap leading-none border sm:px-3 sm:text-xs ${
              active
                ? "bg-[#7a1f2b] text-white border-[#7a1f2b] shadow-[0_1px_3px_-1px_rgba(122,31,43,0.4)]"
                : "bg-white/60 text-[#7a1f2b]/70 border-[#7a1f2b]/15 hover:text-[#7a1f2b] hover:border-[#7a1f2b]/30"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Single term pie block (fills the column height) ─────────────────────────
function TermPie({
  term, data, showLabel,
}: {
  term: number;
  data: GradeDistribution[];
  showLabel: boolean;
}) {
  const visible = data.filter((e) => e.count > 0);
  const total = data.reduce((s, e) => s + e.count, 0);

  return (
    <div className="flex flex-col h-full min-h-0 items-center">
      {showLabel && (
        <p
          className="text-xs sm:text-sm font-semibold mb-1 shrink-0"
          style={{ color: MAROON }}
        >
          Term {term}
        </p>
      )}

      {/* Chart fills the remaining column height */}
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="78%"
              paddingAngle={2}
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                value,
                String(name).replace(/ \(L\d+\)/, ""),
              ]}
              contentStyle={{
                fontSize: "11px",
                backgroundColor: "#fff",
                border: "1px solid rgba(122,31,43,0.15)",
                borderRadius: "10px",
                boxShadow: CARD_SHADOW,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend pinned below chart */}
      <div className="shrink-0 flex flex-wrap justify-center gap-x-2 gap-y-1 mt-1.5 border-t border-[#7a1f2b]/10 w-full pt-1.5">
        {visible.length === 0 ? (
          <span className="text-[10px] text-muted-foreground">
            No published results
          </span>
        ) : (
          visible.map((entry, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap">
                {entry.grade.replace(/ \(L\d+\)/, "")}:{" "}
                <span className="font-semibold text-foreground">{entry.count}</span>
              </span>
            </div>
          ))
        )}
        {total > 0 && (
          <span className="text-[9px] sm:text-[10px] text-[#7a1f2b]/60 font-medium ml-1">
            · {total} results
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KJSEAGradeDistribution({
  termGradeDistributions,
  currentTerm,
  currentAcademicYear,
}: KJSEAGradeDistributionProps) {
  const [gradeView, setGradeView] = useState<"current" | "all">("current");

  // Resolve which term to show for "current" view
  const displayTerm = (() => {
    if (
      currentTerm &&
      termGradeDistributions.some((t) => t.term === currentTerm)
    ) {
      return currentTerm;
    }
    return termGradeDistributions[termGradeDistributions.length - 1]?.term ?? null;
  })();

  const visibleTerms =
    gradeView === "current"
      ? termGradeDistributions.filter((t) => t.term === displayTerm)
      : termGradeDistributions;

  const hasData = termGradeDistributions.length > 0;

  return (
    <Card
      className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden flex flex-col h-full"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <SectionHeader
        icon={Target}
        microLabel="Analytics"
        title="KJSEA Grade Distribution"
        description={
          currentAcademicYear
            ? `Kenyan Achievement Levels — ${currentAcademicYear}`
            : "Across all assessments"
        }
      />

      <CardContent className="flex-1 min-h-0 flex flex-col p-3 sm:p-5 gap-2">
        {hasData ? (
          <>
            {/* ── Toggle row ── */}
            <div className="shrink-0">
              <PillToggle<"current" | "all">
                value={gradeView}
                onChange={setGradeView}
                options={[
                  {
                    value: "current",
                    label: displayTerm ? `Term ${displayTerm}` : "Current",
                  },
                  { value: "all", label: "All Terms" },
                ]}
              />
            </div>

            {/* ── Terms area: current = full width; all = horizontal scroll ── */}
            {gradeView === "current" ? (
              <div className="flex-1 min-h-0 -mx-1 px-1">
                {visibleTerms.map((tgd) => (
                  <div key={tgd.term} className="h-full">
                    <TermPie term={tgd.term} data={tgd.data} showLabel={false} />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden -mx-3 px-3 sm:-mx-5 sm:px-5 pb-1"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="flex gap-3 h-full">
                  {visibleTerms.map((tgd) => (
                    <div
                      key={tgd.term}
                      className="shrink-0 w-[220px] sm:w-[260px] md:w-[280px] h-full flex flex-col rounded-xl border border-[#7a1f2b]/10 p-2 sm:p-3"
                    >
                      <TermPie term={tgd.term} data={tgd.data} showLabel />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {currentAcademicYear
              ? `No published grade data for ${currentAcademicYear} yet`
              : "No grade data available"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}