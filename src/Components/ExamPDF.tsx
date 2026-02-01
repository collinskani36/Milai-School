import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { getOrdinalSuffix, getPerformanceLevel, calculateKJSEAGrade } from '@/utils/assessmentUtils';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 'normal' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' },
  ],
});

// Define styles for PDF - REDUCED FONT SIZES TO FIT ONE PAGE
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#800000',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
  },
  logoContainer: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#800000',
    marginBottom: 2,
  },
  schoolTagline: {
    fontSize: 8,
    color: '#666666',
  },
  studentInfoContainer: {
    backgroundColor: '#f9f0f0',
    padding: 12,
    borderRadius: 5,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#800000',
    borderLeftStyle: 'solid',
  },
  studentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  studentInfoLabel: {
    fontSize: 9,
    color: '#333333',
    fontWeight: 'bold',
  },
  studentInfoValue: {
    fontSize: 9,
    color: '#000000',
  },
  examHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#800000',
    marginBottom: 8,
    textAlign: 'center',
  },
  examDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  examDetailsColumn: {
    width: '48%',
  },
  examDetail: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  examDetailLabel: {
    fontSize: 9,
    color: '#666666',
    width: 70,
    fontWeight: 'bold',
  },
  examDetailValue: {
    fontSize: 9,
    color: '#000000',
    flex: 1,
  },
  performanceSummary: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  performanceItem: {
    width: '32%',
    marginBottom: 10,
  },
  performanceLabel: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  performanceValue: {
    fontSize: 10,
    color: '#000000',
    fontWeight: 'bold',
  },
  subjectTable: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#800000',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    flex: 1,
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
    borderBottomColor: '#e0e0e0',
    borderBottomStyle: 'solid',
  },
  tableRowEven: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
    color: '#000000',
    textAlign: 'center',
  },
  gradeBadge: {
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 7,
    color: '#666666',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    color: '#666666',
  },
  noDataMessage: {
    fontSize: 9,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 15,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
});

interface ExamPDFProps {
  examRecord: any;
  profile: any;
  className: string;
  logoUrl: string;
}

const ExamPDF: React.FC<ExamPDFProps> = ({ examRecord, profile, className, logoUrl }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header with logo and school info */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {/* Use Image component only if logoUrl is a valid base64 or URL */}
          {logoUrl && (logoUrl.startsWith('data:') || logoUrl.startsWith('http')) ? (
            <Image src={logoUrl} style={styles.logo} />
          ) : (
            <Text style={styles.logo}>[LOGO]</Text>
          )}
        </View>
        <View style={styles.schoolInfo}>
          <Text style={styles.schoolName}>Milai School</Text>
          <Text style={styles.schoolTagline}>Academic Excellence Through Innovation</Text>
        </View>
      </View>

      {/* Student Information */}
      <View style={styles.studentInfoContainer}>
        <View style={styles.studentInfoRow}>
          <Text style={styles.studentInfoLabel}>Student Name:</Text>
          <Text style={styles.studentInfoValue}>{profile?.first_name || ''} {profile?.last_name || ''}</Text>
        </View>
        <View style={styles.studentInfoRow}>
          <Text style={styles.studentInfoLabel}>Student ID:</Text>
          <Text style={styles.studentInfoValue}>{profile?.reg_no || 'N/A'}</Text>
        </View>
        <View style={styles.studentInfoRow}>
          <Text style={styles.studentInfoLabel}>Class:</Text>
          <Text style={styles.studentInfoValue}>{className || 'N/A'}</Text>
        </View>
        <View style={styles.studentInfoRow}>
          <Text style={styles.studentInfoLabel}>Report Generated:</Text>
          <Text style={styles.studentInfoValue}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      {/* Exam Header */}
      <Text style={styles.examHeader}>{examRecord.title} - Result Report</Text>

      {/* Exam Details */}
      <View style={styles.examDetailsContainer}>
        <View style={styles.examDetailsColumn}>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Term:</Text>
            <Text style={styles.examDetailValue}>{examRecord.term}</Text>
          </View>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Year:</Text>
            <Text style={styles.examDetailValue}>{examRecord.year}</Text>
          </View>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Subject:</Text>
            <Text style={styles.examDetailValue}>{examRecord.subjects?.name || 'Overall'}</Text>
          </View>
        </View>
        <View style={styles.examDetailsColumn}>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Exam Date:</Text>
            <Text style={styles.examDetailValue}>
              {new Date(examRecord.assessment_date).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Total Marks:</Text>
            <Text style={styles.examDetailValue}>{examRecord.score} / {examRecord.total_score}</Text>
          </View>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Percentage:</Text>
            <Text style={styles.examDetailValue}>{examRecord.percentage}%</Text>
          </View>
        </View>
      </View>

      {/* Performance Summary - UPDATED: Removed Status field */}
      <View style={styles.performanceSummary}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#800000' }}>
          Performance Summary
        </Text>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Class Position</Text>
            <Text style={styles.performanceValue}>
              {examRecord.classPosition}{getOrdinalSuffix(examRecord.classPosition)}
            </Text>
          </View>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>KJSEA Level</Text>
            <Text style={styles.performanceValue}>{examRecord.grade}</Text>
          </View>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Performance</Text>
            <Text style={styles.performanceValue}>
              {getPerformanceLevel(examRecord.percentage)}
            </Text>
          </View>
          {/* Status field REMOVED as requested */}
        </View>
      </View>

      {/* Subject-wise Performance Table */}
      {examRecord.subjectBreakdown && examRecord.subjectBreakdown.length > 0 ? (
        <View style={styles.subjectTable}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#800000' }}>
            Subject-wise Performance
          </Text>
          
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Subject</Text>
            <Text style={styles.tableHeaderCell}>Score</Text>
            <Text style={styles.tableHeaderCell}>Total</Text>
            <Text style={styles.tableHeaderCell}>Percentage</Text>
            <Text style={styles.tableHeaderCell}>Grade</Text>
          </View>

          {/* Table Rows */}
          {examRecord.subjectBreakdown.map((subject: any, index: number) => (
            <View 
              key={index} 
              style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowEven
              ]}
            >
              <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'left' }]}>{subject.subject}</Text>
              <Text style={styles.tableCell}>{subject.score}</Text>
              <Text style={styles.tableCell}>{subject.total_score}</Text>
              <Text style={styles.tableCell}>{subject.percentage}%</Text>
              <View style={styles.tableCell}>
                <Text style={styles.gradeBadge}>{subject.grade.split(' ')[0]}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noDataMessage}>
          <Text>Detailed subject breakdown not available for this exam.</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Milai School - Academic Performance Report | This document is system generated and does not require signature.</Text>
      </View>
      <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
        `Page ${pageNumber} of ${totalPages}`
      )} fixed />
    </Page>
  </Document>
);

export default ExamPDF;