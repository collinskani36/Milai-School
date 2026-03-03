
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAROON = "#800000";
const LIGHT_MAROON = "#f5e6e6";
const DARK_GRAY = "#1f2937";
const MID_GRAY = "#6b7280";
const LIGHT_GRAY = "#f9fafb";
const BORDER_GRAY = "#e5e7eb";

const levelColor = (level: string): string => {
  const l = (level || "").toUpperCase();
  if (l.startsWith("EE")) return "#15803d"; // green
  if (l.startsWith("ME")) return "#1d4ed8"; // blue
  if (l.startsWith("AE")) return "#b45309"; // amber
  if (l.startsWith("BE")) return "#b91c1c"; // red
  return MID_GRAY;
};

const levelLabel = (level: string): string => {
  const l = (level || "").toUpperCase();
  if (l === "EE" || l === "EE1") return "EE — Exceeds Expectation";
  if (l === "EE2") return "EE2 — Exceeds Expectation";
  if (l === "ME" || l === "ME1") return "ME — Meets Expectation";
  if (l === "ME2") return "ME2 — Meets Expectation";
  if (l === "AE" || l === "AE1") return "AE — Approaches Expectation";
  if (l === "AE2") return "AE2 — Approaches Expectation";
  if (l === "BE" || l === "BE1") return "BE — Below Expectation";
  if (l === "BE2") return "BE2 — Below Expectation";
  return level || "—";
};

// Derive a week label from an ISO date string
const weekLabel = (isoDate: string): string => {
  const d = new Date(isoDate);
  // ISO week Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
  return `Week of ${fmt(monday)} – ${fmt(friday)}`;
};

// Ordinal suffix
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DARK_GRAY,
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    backgroundColor: "#ffffff",
  },

  // ── Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: MAROON,
    paddingBottom: 12,
    marginBottom: 16,
  },
  logo: { width: 52, height: 52, marginRight: 14 },
  logoPlaceholder: {
    width: 52,
    height: 52,
    marginRight: 14,
    backgroundColor: LIGHT_MAROON,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoPlaceholderText: { color: MAROON, fontSize: 7, fontFamily: "Helvetica-Bold" },
  headerText: { flex: 1 },
  schoolName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: MAROON,
    marginBottom: 2,
  },
  reportTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: DARK_GRAY,
    marginBottom: 1,
  },
  reportSubtitle: { fontSize: 8, color: MID_GRAY },

  // ── Student info strip
  infoStrip: {
    flexDirection: "row",
    backgroundColor: LIGHT_MAROON,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    gap: 0,
  },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 7, color: MID_GRAY, marginBottom: 1 },
  infoValue: { fontFamily: "Helvetica-Bold", fontSize: 9, color: DARK_GRAY },

  // ── Section heading
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: MAROON,
    backgroundColor: LIGHT_MAROON,
    padding: "5 8",
    borderRadius: 3,
    marginBottom: 6,
    marginTop: 14,
  },

  // ── Attendance summary
  attendanceRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  attendanceBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER_GRAY,
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  attendanceNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: MAROON,
    marginBottom: 2,
  },
  attendanceLabel: { fontSize: 7, color: MID_GRAY, textAlign: "center" },

  // ── Table shared
  table: { width: "100%", marginBottom: 10 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: MAROON,
    borderRadius: 2,
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#ffffff",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_GRAY,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: LIGHT_GRAY },
  tableCell: { fontSize: 8, color: DARK_GRAY },
  tableCellCenter: { fontSize: 8, color: DARK_GRAY, textAlign: "center" },

  // ── Summative table column widths
  colSubject: { flex: 2.2, paddingRight: 4 },
  colCat: { flex: 1, textAlign: "center" },
  colAvg: { flex: 0.9, textAlign: "center" },
  colGrade: { flex: 0.9, textAlign: "center" },
  colPos: { flex: 0.8, textAlign: "center" },

  // ── Formative table column widths
  fColWeek: { flex: 1.6, paddingRight: 4 },
  fColActivity: { flex: 2.2, paddingRight: 4 },
  fColStrand: { flex: 1.6, paddingRight: 4 },
  fColLevel: { flex: 1.0, textAlign: "center" },
  fColRemarks: { flex: 2.0, paddingLeft: 4 },

  // ── Grade badge
  gradeBadge: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: "center",
  },
  gradeBadgeText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#ffffff",
  },

  // ── Totals row
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: LIGHT_MAROON,
    borderTopWidth: 1,
    borderTopColor: MAROON,
    marginTop: 1,
    borderRadius: 2,
  },

  // ── Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER_GRAY,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: MID_GRAY },

  // ── Page number
  pageNumber: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
    color: MID_GRAY,
  },

  // ── Week divider
  weekDivider: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: MAROON,
    backgroundColor: "#fef3f3",
    padding: "3 6",
    marginTop: 6,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: MAROON,
  },

  // ── Legend
  legendRow: { flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 7, color: MID_GRAY },

  // ── Empty state
  emptyState: {
    textAlign: "center",
    color: MID_GRAY,
    fontSize: 8,
    padding: 12,
    fontStyle: "italic",
  } as any,
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CatRecord {
  assessment_id: string;
  title: string; // e.g. "CAT 1 Term 1 2025"
  term: string | number;
  year: number;
  assessment_date: string;
  score: number;
  total_score: number;
  percentage: number;
  grade: string;
  classPosition: number | null;
  student_id: string;
  // subject breakdown fetched separately
  subjectBreakdown?: SubjectScore[];
}

export interface SubjectScore {
  subject: string;
  code?: string;
  score: number;
  max_marks: number;
  percentage: number;
  grade: string;
}

export interface FormativeRecord {
  id: string;
  assessment_date: string;
  title: string; // activity name from assessments.title
  strand?: string;
  sub_strand?: string;
  performance_level: string;
  teacher_remarks?: string;
  is_absent?: boolean;
  subject?: string;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  attendanceRate: number;
}

export interface TermReportPDFProps {
  term: string | number;
  year: number;
  cats: CatRecord[]; // exactly the 3 (or more) CAT summative records
  // subjectBreakdowns: keyed by assessment_id
  subjectBreakdowns: Record<string, SubjectScore[]>;
  formativeRecords: FormativeRecord[];
  attendance: AttendanceSummary | null;
  profile: {
    first_name: string;
    last_name: string;
    reg_no?: string;
    email?: string;
  };
  className: string;
  logoUrl?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Header = ({
  logoUrl,
  term,
  year,
}: {
  logoUrl?: string;
  term: string | number;
  year: number;
}) => (
  <View style={s.header}>
    {logoUrl ? (
      <Image style={s.logo} src={logoUrl} />
    ) : (
      <View style={s.logoPlaceholder}>
        <Text style={s.logoPlaceholderText}>SCHOOL{"\n"}LOGO</Text>
      </View>
    )}
    <View style={s.headerText}>
      <Text style={s.schoolName}>Milai School</Text>
      <Text style={s.reportTitle}>
        End of Term {term} — {year} Academic Report
      </Text>
      <Text style={s.reportSubtitle}>
        Competency Based Curriculum (CBC) Student Report Card
      </Text>
    </View>
  </View>
);

const StudentInfoStrip = ({
  profile,
  className,
  term,
  year,
}: {
  profile: TermReportPDFProps["profile"];
  className: string;
  term: string | number;
  year: number;
}) => (
  <View style={s.infoStrip}>
    <View style={s.infoCol}>
      <Text style={s.infoLabel}>STUDENT NAME</Text>
      <Text style={s.infoValue}>
        {profile.first_name} {profile.last_name}
      </Text>
    </View>
    <View style={s.infoCol}>
      <Text style={s.infoLabel}>ADMISSION NO.</Text>
      <Text style={s.infoValue}>{profile.reg_no || "—"}</Text>
    </View>
    <View style={s.infoCol}>
      <Text style={s.infoLabel}>CLASS</Text>
      <Text style={s.infoValue}>{className}</Text>
    </View>
    <View style={s.infoCol}>
      <Text style={s.infoLabel}>TERM / YEAR</Text>
      <Text style={s.infoValue}>
        Term {term} / {year}
      </Text>
    </View>
  </View>
);

const AttendanceSection = ({
  attendance,
}: {
  attendance: AttendanceSummary | null;
}) => {
  if (!attendance) return null;
  const rate = attendance.attendanceRate.toFixed(1);
  const absent = attendance.totalDays - attendance.presentDays;
  return (
    <>
      <Text style={s.sectionHeading}>ATTENDANCE SUMMARY</Text>
      <View style={s.attendanceRow}>
        <View style={s.attendanceBox}>
          <Text style={s.attendanceNumber}>{attendance.totalDays}</Text>
          <Text style={s.attendanceLabel}>Total School Days</Text>
        </View>
        <View style={s.attendanceBox}>
          <Text style={s.attendanceNumber}>{attendance.presentDays}</Text>
          <Text style={s.attendanceLabel}>Days Present</Text>
        </View>
        <View style={s.attendanceBox}>
          <Text style={s.attendanceNumber}>{absent}</Text>
          <Text style={s.attendanceLabel}>Days Absent</Text>
        </View>
        <View
          style={[
            s.attendanceBox,
            {
              borderColor:
                Number(rate) >= 80 ? "#15803d" : Number(rate) >= 60 ? "#b45309" : "#b91c1c",
              borderWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              s.attendanceNumber,
              {
                color:
                  Number(rate) >= 80
                    ? "#15803d"
                    : Number(rate) >= 60
                    ? "#b45309"
                    : "#b91c1c",
              },
            ]}
          >
            {rate}%
          </Text>
          <Text style={s.attendanceLabel}>Attendance Rate</Text>
        </View>
      </View>
    </>
  );
};

// Summative table — subjects as rows, CAT 1/2/3 as columns
const SummativeTable = ({
  cats,
  subjectBreakdowns,
}: {
  cats: CatRecord[];
  subjectBreakdowns: Record<string, SubjectScore[]>;
}) => {
  // Sort cats by title so CAT 1 < CAT 2 < CAT 3
  const sorted = [...cats].sort((a, b) => {
    const numA = parseInt((a.title.match(/CAT\s*(\d)/i) || [])[1] || "0");
    const numB = parseInt((b.title.match(/CAT\s*(\d)/i) || [])[1] || "0");
    return numA - numB;
  });

  // Collect all unique subjects across all CATs
  const subjectSet = new Set<string>();
  sorted.forEach((cat) => {
    const bd = subjectBreakdowns[cat.assessment_id] || [];
    bd.forEach((s) => subjectSet.add(s.subject));
  });
  const subjects = Array.from(subjectSet).sort();

  if (subjects.length === 0) {
    return <Text style={s.emptyState}>No subject breakdown available.</Text>;
  }

  // Build a lookup: subject → catIndex → SubjectScore
  const lookup: Record<string, Record<number, SubjectScore>> = {};
  subjects.forEach((sub) => (lookup[sub] = {}));
  sorted.forEach((cat, idx) => {
    const bd = subjectBreakdowns[cat.assessment_id] || [];
    bd.forEach((row) => {
      if (lookup[row.subject]) lookup[row.subject][idx] = row;
    });
  });

  const catLabels = sorted.map((c) => {
    const m = c.title.match(/CAT\s*(\d)/i);
    return m ? `CAT ${m[1]}` : c.title;
  });

  return (
    <View style={s.table}>
      {/* Header */}
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, s.colSubject]}>SUBJECT</Text>
        {catLabels.map((label, i) => (
          <Text key={i} style={[s.tableHeaderCell, s.colCat]}>
            {label}
          </Text>
        ))}
        <Text style={[s.tableHeaderCell, s.colAvg]}>AVG %</Text>
        <Text style={[s.tableHeaderCell, s.colGrade]}>GRADE</Text>
      </View>

      {/* Subject rows */}
      {subjects.map((subject, rowIdx) => {
        const scores = sorted.map((_, i) => lookup[subject][i]);
        const validScores = scores.filter(Boolean);
        const avgPct =
          validScores.length > 0
            ? Math.round(
                validScores.reduce((sum, s) => sum + (s?.percentage || 0), 0) /
                  validScores.length
              )
            : null;

        // Derive grade from avgPct
        let grade = "—";
        if (avgPct !== null) {
          if (avgPct >= 90) grade = "EE1";
          else if (avgPct >= 75) grade = "EE2";
          else if (avgPct >= 58) grade = "ME1";
          else if (avgPct >= 41) grade = "ME2";
          else if (avgPct >= 31) grade = "AE1";
          else if (avgPct >= 21) grade = "AE2";
          else if (avgPct >= 11) grade = "BE1";
          else grade = "BE2";
        }

        const gradeColor = levelColor(grade.replace(/[12]$/, ""));

        return (
          <View
            key={subject}
            style={[s.tableRow, rowIdx % 2 === 1 ? s.tableRowAlt : {}]}
          >
            <Text style={[s.tableCell, s.colSubject]}>{subject}</Text>
            {scores.map((sc, i) => (
              <Text key={i} style={[s.tableCellCenter, s.colCat]}>
                {sc
                  ? sc.score !== undefined
                    ? `${sc.score}/${sc.max_marks}`
                    : "—"
                  : "—"}
              </Text>
            ))}
            <Text style={[s.tableCellCenter, s.colAvg]}>
              {avgPct !== null ? `${avgPct}%` : "—"}
            </Text>
            <View style={[s.colGrade, { alignItems: "center" }]}>
              <View style={[s.gradeBadge, { backgroundColor: gradeColor }]}>
                <Text style={s.gradeBadgeText}>{grade}</Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Totals row */}
      <View style={s.totalsRow}>
        <Text
          style={[
            s.tableCell,
            s.colSubject,
            { fontFamily: "Helvetica-Bold" },
          ]}
        >
          TOTAL
        </Text>
        {sorted.map((cat, i) => {
          const bd = subjectBreakdowns[cat.assessment_id] || [];
          const total = bd.reduce((sum, r) => sum + (r.score || 0), 0);
          const possible = bd.reduce((sum, r) => sum + (r.max_marks || 0), 0);
          return (
            <Text
              key={i}
              style={[
                s.tableCellCenter,
                s.colCat,
                { fontFamily: "Helvetica-Bold" },
              ]}
            >
              {possible > 0 ? `${total}/${possible}` : "—"}
            </Text>
          );
        })}
        <Text
          style={[
            s.tableCellCenter,
            s.colAvg,
            { fontFamily: "Helvetica-Bold" },
          ]}
        >
          —
        </Text>
        <Text style={[s.tableCellCenter, s.colGrade]}> </Text>
      </View>

      {/* Class positions row */}
      <View style={[s.tableRow, { backgroundColor: "#fef3f3" }]}>
        <Text
          style={[
            s.tableCell,
            s.colSubject,
            { fontFamily: "Helvetica-Bold", color: MAROON },
          ]}
        >
          CLASS POSITION
        </Text>
        {sorted.map((cat, i) => (
          <Text
            key={i}
            style={[
              s.tableCellCenter,
              s.colCat,
              { fontFamily: "Helvetica-Bold", color: MAROON },
            ]}
          >
            {cat.classPosition !== null && cat.classPosition !== undefined
              ? ordinal(cat.classPosition)
              : "—"}
          </Text>
        ))}
        <Text style={[s.tableCellCenter, s.colAvg]}> </Text>
        <Text style={[s.tableCellCenter, s.colGrade]}> </Text>
      </View>
    </View>
  );
};

// Formative table — grouped by week (chronological)
const FormativeSection = ({
  formativeRecords,
}: {
  formativeRecords: FormativeRecord[];
}) => {
  if (!formativeRecords.length) {
    return (
      <>
        <Text style={s.sectionHeading}>FORMATIVE ASSESSMENT RECORD</Text>
        <Text style={s.emptyState}>
          No formative assessment records for this term.
        </Text>
      </>
    );
  }

  // Group by week (Monday date string as key)
  const getWeekKey = (isoDate: string): string => {
    const d = new Date(isoDate);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString().split("T")[0];
  };

  const weekMap = new Map<
    string,
    { label: string; records: FormativeRecord[] }
  >();
  const sorted = [...formativeRecords].sort(
    (a, b) =>
      new Date(a.assessment_date).getTime() -
      new Date(b.assessment_date).getTime()
  );

  sorted.forEach((rec) => {
    const key = getWeekKey(rec.assessment_date);
    if (!weekMap.has(key)) {
      weekMap.set(key, { label: weekLabel(rec.assessment_date), records: [] });
    }
    weekMap.get(key)!.records.push(rec);
  });

  const weeks = Array.from(weekMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <>
      <Text style={s.sectionHeading}>FORMATIVE ASSESSMENT RECORD</Text>
      <Text
        style={{
          fontSize: 7,
          color: MID_GRAY,
          marginBottom: 6,
          fontStyle: "italic",
        }}
      >
        Performance levels: EE = Exceeds Expectation · ME = Meets Expectation ·
        AE = Approaches Expectation · BE = Below Expectation
      </Text>

      {/* Table header */}
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, s.fColActivity]}>ACTIVITY</Text>
        <Text style={[s.tableHeaderCell, s.fColStrand]}>STRAND</Text>
        <Text style={[s.tableHeaderCell, s.fColStrand]}>SUB-STRAND</Text>
        <Text style={[s.tableHeaderCell, s.fColLevel]}>LEVEL</Text>
        <Text style={[s.tableHeaderCell, s.fColRemarks]}>REMARKS</Text>
      </View>

      {weeks.map(([weekKey, { label, records }]) => (
        <View key={weekKey}>
          {/* Week divider */}
          <Text style={s.weekDivider}>{label}</Text>

          {records.map((rec, rowIdx) => {
            const color = rec.is_absent
              ? MID_GRAY
              : levelColor(rec.performance_level || "");
            return (
              <View
                key={rec.id}
                style={[
                  s.tableRow,
                  rowIdx % 2 === 1 ? s.tableRowAlt : {},
                  { alignItems: "flex-start" },
                ]}
              >
                <Text style={[s.tableCell, s.fColActivity]}>
                  {rec.title}
                  {rec.subject ? `\n(${rec.subject})` : ""}
                </Text>
                <Text style={[s.tableCell, s.fColStrand]}>
                  {rec.strand || "—"}
                </Text>
                <Text style={[s.tableCell, s.fColStrand]}>
                  {rec.sub_strand || "—"}
                </Text>
                <View style={[s.fColLevel, { alignItems: "center" }]}>
                  {rec.is_absent ? (
                    <View
                      style={[s.gradeBadge, { backgroundColor: MID_GRAY }]}
                    >
                      <Text style={s.gradeBadgeText}>ABS</Text>
                    </View>
                  ) : rec.performance_level ? (
                    <View
                      style={[s.gradeBadge, { backgroundColor: color }]}
                    >
                      <Text style={s.gradeBadgeText}>
                        {rec.performance_level}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.tableCellCenter}>—</Text>
                  )}
                </View>
                <Text style={[s.tableCell, s.fColRemarks]}>
                  {rec.teacher_remarks || "—"}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={s.legendRow}>
        {[
          { label: "EE — Exceeds Expectation", color: "#15803d" },
          { label: "ME — Meets Expectation", color: "#1d4ed8" },
          { label: "AE — Approaches Expectation", color: "#b45309" },
          { label: "BE — Below Expectation", color: "#b91c1c" },
        ].map(({ label, color }) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );
};

// ─── Main Document ─────────────────────────────────────────────────────────────

const TermReportPDF: React.FC<TermReportPDFProps> = ({
  term,
  year,
  cats,
  subjectBreakdowns,
  formativeRecords,
  attendance,
  profile,
  className,
  logoUrl,
}) => {
  const now = new Date().toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Document
      title={`Term ${term} ${year} Report — ${profile.first_name} ${profile.last_name}`}
      author="Milai School"
      subject="End of Term Report Card"
    >
      {/* ── Page 1: Student info + attendance + summative results ── */}
      <Page size="A4" style={s.page}>
        <Header logoUrl={logoUrl} term={term} year={year} />
        <StudentInfoStrip
          profile={profile}
          className={className}
          term={term}
          year={year}
        />
        <AttendanceSection attendance={attendance} />

        <Text style={s.sectionHeading}>SUMMATIVE ASSESSMENT RESULTS (CAT 1, 2 &amp; 3)</Text>
        <Text
          style={{
            fontSize: 7,
            color: MID_GRAY,
            marginBottom: 6,
            fontStyle: "italic",
          }}
        >
          Scores shown per CAT and subject. Average percentage and overall grade
          computed across all CATs.
        </Text>
        <SummativeTable cats={cats} subjectBreakdowns={subjectBreakdowns} />

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Generated: {now} · Milai School CBC Report
          </Text>
          <Text style={s.footerText}>
            Student: {profile.first_name} {profile.last_name} ·{" "}
            {profile.reg_no}
          </Text>
        </View>
        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* ── Page 2+: Formative assessment record ── */}
      <Page size="A4" style={s.page}>
        <Header logoUrl={logoUrl} term={term} year={year} />
        <StudentInfoStrip
          profile={profile}
          className={className}
          term={term}
          year={year}
        />
        <FormativeSection formativeRecords={formativeRecords} />

        <View style={s.footer}>
          <Text style={s.footerText}>
            Generated: {now} · Milai School CBC Report
          </Text>
          <Text style={s.footerText}>
            Student: {profile.first_name} {profile.last_name} ·{" "}
            {profile.reg_no}
          </Text>
        </View>
        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

export default TermReportPDF;