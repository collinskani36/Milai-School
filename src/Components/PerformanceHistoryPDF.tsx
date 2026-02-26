import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { getOrdinalSuffix, getPerformanceLevel, calculateKJSEAGrade } from '@/utils/assessmentUtils';

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 'normal' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#800000',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
  },
  logoContainer: { width: 38, height: 38, marginRight: 10 },
  logo: { width: '100%', height: '100%' },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 15, fontWeight: 'bold', color: '#800000', marginBottom: 2 },
  schoolTagline: { fontSize: 8, color: '#666666' },

  // ── Student info strip ───────────────────────────────────────────────────────
  studentStrip: {
    backgroundColor: '#f9f0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#800000',
    borderLeftStyle: 'solid',
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stripItem: { width: '50%', marginBottom: 3, flexDirection: 'row' },
  stripLabel: { fontSize: 8, fontWeight: 'bold', color: '#444444', width: 80 },
  stripValue: { fontSize: 8, color: '#000000', flex: 1 },

  // ── Report title ─────────────────────────────────────────────────────────────
  reportTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#800000',
    textAlign: 'center',
    marginBottom: 10,
  },

  // ── Summary stats row ────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    width: '23%',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#800000',
    borderTopStyle: 'solid',
  },
  statLabel: { fontSize: 7, color: '#666666', marginBottom: 3, textAlign: 'center' },
  statValue: { fontSize: 13, fontWeight: 'bold', color: '#800000' },

  // ── Main exams table ──────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#800000',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    borderBottomStyle: 'solid',
  },
  tableRowEven: { backgroundColor: '#faf8f8' },
  tableRowTop3: { backgroundColor: '#f0fff0' },
  tableCell: { fontSize: 8, color: '#222222', textAlign: 'center' },

  // Totals / averages row
  tableSummaryRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: '#f0e8e8',
    borderTopWidth: 1,
    borderTopColor: '#800000',
    borderTopStyle: 'solid',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  tableSummaryCell: { fontSize: 8, color: '#800000', fontWeight: 'bold', textAlign: 'center' },

  gradeBadgeEE: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#e8f5e9', color: '#2e7d32' },
  gradeBadgeME: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#e3f2fd', color: '#1565c0' },
  gradeBadgeAE: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#fff8e1', color: '#e65100' },
  gradeBadgeBE: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: '#fce4ec', color: '#b71c1c' },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 7,
    color: '#888888',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    color: '#aaaaaa',
  },
});

// ── Column widths (must sum to ~100%) ────────────────────────────────────────
const COL = {
  exam:     { flex: 2.2 },
  term:     { flex: 0.8 },
  date:     { flex: 1.2 },
  score:    { flex: 1.0 },
  pct:      { flex: 0.9 },
  grade:    { flex: 1.0 },
  position: { flex: 0.9 },
};

const gradeBadgeStyle = (grade: string) => {
  if (grade.startsWith('EE')) return styles.gradeBadgeEE;
  if (grade.startsWith('ME')) return styles.gradeBadgeME;
  if (grade.startsWith('AE')) return styles.gradeBadgeAE;
  return styles.gradeBadgeBE;
};

interface PerformanceHistoryPDFProps {
  performanceHistory: any[];
  profile: any;
  className: string;
  logoUrl: string;
}

const PerformanceHistoryPDF: React.FC<PerformanceHistoryPDFProps> = ({
  performanceHistory,
  profile,
  className,
  logoUrl,
}) => {
  const total      = performanceHistory.length;
  const avgPct     = total > 0 ? Math.round(performanceHistory.reduce((s, r) => s + r.percentage, 0) / total) : 0;
  const bestPos    = total > 0 ? Math.min(...performanceHistory.map(r => r.classPosition).filter(Boolean)) : null;
  const excellentN = performanceHistory.filter(r => r.grade?.startsWith('EE')).length;

  const reportPeriod = total > 0
    ? `${performanceHistory[performanceHistory.length - 1].year} – ${performanceHistory[0].year}`
    : 'N/A';

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── School header ── */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {logoUrl && (logoUrl.startsWith('data:') || logoUrl.startsWith('http')) ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text>[LOGO]</Text>
            )}
          </View>
          <View style={styles.schoolInfo}>
            <Text style={styles.schoolName}>Milai School</Text>
            <Text style={styles.schoolTagline}>Academic Excellence Through Innovation</Text>
          </View>
        </View>

        {/* ── Report title ── */}
        <Text style={styles.reportTitle}>Academic Performance History Report</Text>

        {/* ── Student info strip ── */}
        <View style={styles.studentStrip}>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Student Name:</Text>
            <Text style={styles.stripValue}>{profile?.first_name || ''} {profile?.last_name || ''}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Student ID:</Text>
            <Text style={styles.stripValue}>{profile?.reg_no || 'N/A'}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Class:</Text>
            <Text style={styles.stripValue}>{className || 'N/A'}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Report Period:</Text>
            <Text style={styles.stripValue}>{reportPeriod}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Generated:</Text>
            <Text style={styles.stripValue}>{new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Total Exams:</Text>
            <Text style={styles.stripValue}>{total}</Text>
          </View>
        </View>

        {/* ── Summary stat boxes ── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Exams Tracked</Text>
            <Text style={styles.statValue}>{total}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Average Score</Text>
            <Text style={styles.statValue}>{avgPct}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Best Position</Text>
            <Text style={styles.statValue}>
              {bestPos != null ? `${bestPos}${getOrdinalSuffix(bestPos)}` : 'N/A'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Excellent (EE)</Text>
            <Text style={styles.statValue}>{excellentN}</Text>
          </View>
        </View>

        {/* ── All exams table ── */}
        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, COL.exam,     { textAlign: 'left' }]}>Exam</Text>
          <Text style={[styles.tableHeaderCell, COL.term                            ]}>Term</Text>
          <Text style={[styles.tableHeaderCell, COL.date                            ]}>Date</Text>
          <Text style={[styles.tableHeaderCell, COL.score                           ]}>Score</Text>
          <Text style={[styles.tableHeaderCell, COL.pct                             ]}>%</Text>
          <Text style={[styles.tableHeaderCell, COL.grade                           ]}>Grade</Text>
          <Text style={[styles.tableHeaderCell, COL.position                        ]}>Position</Text>
        </View>

        {/* Table rows — all exams, no page break per exam */}
        {performanceHistory.map((record: any, index: number) => {
          const isTop3 = record.classPosition != null && record.classPosition <= 3;
          const rowStyle = isTop3
            ? styles.tableRowTop3
            : index % 2 === 0
            ? styles.tableRowEven
            : {};
          const gradeLabel = (record.grade || '').split(' ')[0];

          return (
            <View key={index} style={[styles.tableRow, rowStyle]}>
              <Text style={[styles.tableCell, COL.exam, { textAlign: 'left' }]}>
                {record.title}
              </Text>
              <Text style={[styles.tableCell, COL.term]}>
                T{record.term} {record.year}
              </Text>
              <Text style={[styles.tableCell, COL.date]}>
                {record.assessment_date
                  ? new Date(record.assessment_date).toLocaleDateString()
                  : '—'}
              </Text>
              <Text style={[styles.tableCell, COL.score]}>
                {record.score}/{record.total_score}
              </Text>
              <Text style={[styles.tableCell, COL.pct]}>
                {typeof record.percentage === 'number'
                  ? `${record.percentage.toFixed(1)}%`
                  : '—'}
              </Text>
              <View style={[COL.grade, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={gradeBadgeStyle(gradeLabel)}>{gradeLabel}</Text>
              </View>
              <Text style={[styles.tableCell, COL.position]}>
                {record.classPosition != null
                  ? `${record.classPosition}${getOrdinalSuffix(record.classPosition)}`
                  : '—'}
              </Text>
            </View>
          );
        })}

        {/* Summary / averages row */}
        <View style={styles.tableSummaryRow}>
          <Text style={[styles.tableSummaryCell, COL.exam, { textAlign: 'left' }]}>
            AVERAGE / BEST
          </Text>
          <Text style={[styles.tableSummaryCell, COL.term]}>—</Text>
          <Text style={[styles.tableSummaryCell, COL.date]}>—</Text>
          <Text style={[styles.tableSummaryCell, COL.score]}>—</Text>
          <Text style={[styles.tableSummaryCell, COL.pct]}>{avgPct}%</Text>
          <Text style={[styles.tableSummaryCell, COL.grade]}>—</Text>
          <Text style={[styles.tableSummaryCell, COL.position]}>
            {bestPos != null ? `${bestPos}${getOrdinalSuffix(bestPos)}` : '—'}
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text>
            Milai School — Academic Performance History | System generated. Does not require a signature.
          </Text>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default PerformanceHistoryPDF;