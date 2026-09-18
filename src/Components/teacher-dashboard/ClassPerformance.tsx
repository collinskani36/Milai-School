import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, LabelList,
} from "recharts";

// ---------- Design tokens ----------
const MAROON = "#7a1f2b";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";

// ---------- Types ----------
interface TrendPoint {
  label: string;
  term: number;
  assessmentDate: string;
  [seriesKey: string]: number | string;
}
interface TrendSeries {
  key: string;
  label: string;
  color: string;
  latestMean: number | null;
  trend: "improving" | "declining" | "stable" | "insufficient";
  trendDelta: number;
  bestAssessment: string;
  worstAssessment: string;
  assessmentCount: number;
}
interface ClassPerformanceData {
  assessment: string;
  mean: number;
}

interface ClassPerformanceProps {
  trendPoints: TrendPoint[];
  trendSeries: TrendSeries[];
  loadingTrend: boolean;
  classPerformanceData: ClassPerformanceData[];
  perfView: "trend" | "recent";
  setPerfView: (v: "trend" | "recent") => void;
  currentAcademicYear: string | null;
}

// ---------- Compact chip toggle ----------
function PillToggle<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all whitespace-nowrap leading-none border ${
              active
                ? "bg-[#7a1f2b] text-white border-[#7a1f2b] shadow-[0_1px_3px_-1px_rgba(122,31,43,0.4)]"
                : "bg-white/60 text-[#7a1f2b]/70 border-[#7a1f2b]/15 hover:text-[#7a1f2b] hover:border-[#7a1f2b]/30"
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`ml-0.5 text-[8px] font-medium ${
                  active ? "text-white/70" : "text-[#7a1f2b]/40"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Main ----------
export default function ClassPerformance({
  trendPoints,
  trendSeries,
  loadingTrend,
  classPerformanceData,
  perfView,
  setPerfView,
  currentAcademicYear,
}: ClassPerformanceProps) {
  const [classFilter, setClassFilter] = useState<string>("__all__");

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    trendSeries.forEach((s) => {
      const cls = s.label.split(" · ")[0];
      if (cls) set.add(cls);
    });
    return Array.from(set).sort();
  }, [trendSeries]);

  const filteredTrendSeries = useMemo(
    () =>
      classFilter === "__all__"
        ? trendSeries
        : trendSeries.filter((s) => s.label.startsWith(`${classFilter} · `)),
    [trendSeries, classFilter]
  );

  const filteredRecentData = useMemo(
    () =>
      classFilter === "__all__"
        ? classPerformanceData
        : classPerformanceData.filter((d) => d.assessment.includes(`(${classFilter}`)),
    [classPerformanceData, classFilter]
  );

  useEffect(() => {
    if (classFilter !== "__all__" && !uniqueClasses.includes(classFilter)) {
      setClassFilter("__all__");
    }
  }, [uniqueClasses, classFilter]);

  const hasTrend = trendPoints.length > 0 && filteredTrendSeries.length > 0;
  const hasRecent = filteredRecentData.length > 0;

  return (
    <Card
      className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden flex flex-col h-full"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <CardContent className="px-2.5 pt-2 pb-1.5 sm:px-4 sm:pt-3 sm:pb-2 flex-1 min-h-0 flex flex-col gap-1.5">
        {/* ── CONTROLS: single row, wrap if needed ── */}
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <PillToggle<"trend" | "recent">
            value={perfView}
            onChange={setPerfView}
            options={[
              { value: "trend", label: "Trend" },
              { value: "recent", label: "Recent" },
            ]}
          />

          {uniqueClasses.length > 1 && (
            <PillToggle<string>
              value={classFilter}
              onChange={setClassFilter}
              options={[
                {
                  value: "__all__",
                  label: "All",
                  count:
                    perfView === "trend"
                      ? trendSeries.length
                      : classPerformanceData.length,
                },
                ...uniqueClasses.map((cls) => ({
                  value: cls,
                  label: cls,
                  count:
                    perfView === "trend"
                      ? trendSeries.filter((s) => s.label.startsWith(`${cls} · `)).length
                      : classPerformanceData.filter((d) =>
                          d.assessment.includes(`(${cls}`)
                        ).length,
                })),
              ]}
            />
          )}
        </div>

        {/* ── CHART AREA ── */}
        <div className="flex-1 min-h-0">
          {perfView === "trend" ? (
            loadingTrend ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Loading trend data…
              </div>
            ) : hasTrend ? (
              <div className="w-full h-full overflow-x-auto">
                <div
                  style={{
                    minWidth: Math.max(trendPoints.length * 55, 300),
                    height: "100%",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendPoints}
                      margin={{ top: 6, right: 8, left: 0, bottom: 2 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={7}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 7 }}
                        axisLine={false}
                        tickLine={false}
                        height={44}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        domain={[0, 100]}
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={26}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid rgba(122,31,43,0.15)",
                          borderRadius: "10px",
                          fontSize: "11px",
                          padding: "8px",
                          boxShadow: CARD_SHADOW,
                        }}
                        formatter={(value: number, key: string) => {
                          const s = filteredTrendSeries.find((x) => x.key === key);
                          return [`${value}%`, s?.label ?? key];
                        }}
                      />
                      {filteredTrendSeries.map((s) => (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          stroke={s.color}
                          strokeWidth={2}
                          dot={{ fill: s.color, r: 3, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                {currentAcademicYear
                  ? `No published assessment data for ${currentAcademicYear} yet`
                  : "No assessment data available"}
              </div>
            )
          ) : hasRecent ? (
            <div className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredRecentData}
                  margin={{ top: 22, right: 8, left: 0, bottom: 2 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="assessment"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={8}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    tick={{ fontSize: 8 }}
                    axisLine={false}
                    tickLine={false}
                    height={48}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={26}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(122,31,43,0.06)" }}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid rgba(122,31,43,0.15)",
                      borderRadius: "10px",
                      fontSize: "12px",
                      boxShadow: CARD_SHADOW,
                    }}
                    formatter={(value: number) => [`${value}%`, "Mean"]}
                  />
                  <Bar dataKey="mean" fill={MAROON} radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="mean"
                      position="top"
                      formatter={(v: any) => `${v}%`}
                      style={{ fontSize: 10, fill: MAROON, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {currentAcademicYear
                ? `No assessments found for ${currentAcademicYear}`
                : "No recent assessments found"}
            </div>
          )}
        </div>

        {/* ── SUMMARY CHIPS (trend only) ── */}
        {perfView === "trend" && hasTrend && !loadingTrend && (
          <div className="shrink-0 -mx-2.5 px-2.5 sm:mx-0 sm:px-0 overflow-x-auto pt-1.5 pb-0.5">
            <div className="flex gap-1.5 items-center">
              {filteredTrendSeries.map((s) => {
                const trendIcon =
                  s.trend === "improving" ? "↑" :
                  s.trend === "declining" ? "↓" :
                  s.trend === "stable" ? "→" : "—";
                const trendColor =
                  s.trend === "improving" ? "text-green-600" :
                  s.trend === "declining" ? "text-red-500" :
                  s.trend === "stable" ? "text-blue-500" :
                  "text-muted-foreground";

                return (
                  <div
                    key={s.key}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-[#7a1f2b]/10 pl-1.5 pr-2.5 py-1"
                    style={{ borderLeftWidth: 4, borderLeftColor: s.color }}
                    title={s.label}
                  >
                    <span className="text-[10px] font-semibold text-[#3a1b1f] max-w-[110px] truncate">
                      {s.label}
                    </span>
                    <span className="text-[11px] font-bold text-[#3a1b1f] leading-none">
                      {s.latestMean !== null ? `${s.latestMean}%` : "—"}
                    </span>
                    <span className={`text-[10px] font-bold leading-none ${trendColor}`}>
                      {trendIcon}
                      {s.trend !== "insufficient"
                        ? `${s.trendDelta > 0 ? "+" : ""}${s.trendDelta}`
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}