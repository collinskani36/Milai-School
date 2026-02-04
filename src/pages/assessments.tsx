// assessments.tsx
// Polyfill Buffer for Expo / React Native
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}



import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle } from "@/Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { BookOpen, TrendingUp, Calendar, FileText, Download, BarChart3, User, Mail, Phone, ShieldAlert, ChevronLeft, ChevronRight, Maximize2, Minimize2, ArrowLeft, ArrowRight } from "lucide-react";
import { PDFDownloadLink } from '@react-pdf/renderer';

// Import helper functions and types
import {
  getOrdinalSuffix,
  getPerformanceLevel,
  calculateKJSEAGrade,
  getGradeColor,
  extractExamNumber,
  firstRel,
  PerformanceRecord,
  SubjectAnalysisData,
  AssessmentsProps
} from "@/utils/assessmentUtils";

// IMPORTANT: Remove lazy loading for PDF components and import them directly
// This fixes the "Uncaught undefined" error with flushSyncCallbacks
import ExamPDF from '@/Components/ExamPDF';
import PerformanceHistoryPDF from '@/Components/PerformanceHistoryPDF';

// Simple loading component for PDF rendering
const PDFLoadingFallback = () => (
  <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-maroon"></div>
);

// Custom hooks for data fetching
const usePerformanceData = (studentId: string | null, classId: string | null) => {
  const [data, setData] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !classId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: rankingsData, error } = await supabase
          .from("student_rankings")
          .select("*")
          .eq("student_id", studentId)
          .eq("class_id", classId)
          .order("assessment_date", { ascending: false });

        if (!error && rankingsData) {
          const performanceData = await processPerformanceData(rankingsData, studentId);
          setData(performanceData);
        }
      } catch (err) {
        console.error("Error fetching performance data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, classId]);

  return { data, loading };
};

const processPerformanceData = async (rankingsData: any[], studentId: string) => {
  const performanceData: PerformanceRecord[] = [];
  
  for (const ranking of rankingsData) {
    const subjectData = await fetchSubjectBreakdown(studentId, ranking.assessment_id);
    const isEndYearExam = /end year|final|annual|year end/i.test(ranking.exam_title);

    performanceData.push({
      id: `${ranking.assessment_id}-${studentId}`,
      title: ranking.exam_title,
      term: ranking.term?.toString() || "Unknown Term",
      year: ranking.year || new Date().getFullYear(),
      assessment_date: ranking.assessment_date || new Date().toISOString(),
      subjects: { name: isEndYearExam ? "Overall" : "Multiple Subjects" },
      score: ranking.total_attained,
      total_score: ranking.total_possible,
      percentage: ranking.percentage,
      grade: calculateKJSEAGrade(ranking.percentage / 100),
      isEndYearExam,
      subjectBreakdown: isEndYearExam ? null : subjectData,
      classPosition: ranking.class_position
    });
  }

  return performanceData.sort((a, b) => 
    new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime()
  ).slice(0, 10);
};

const fetchSubjectBreakdown = async (studentId: string, assessmentId: string) => {
  const { data: subjectData } = await supabase
    .from("assessment_results")
    .select("score, max_marks, subjects(name)")
    .eq("student_id", studentId)
    .eq("assessment_id", assessmentId);

  return subjectData?.map(record => ({
    subject: Array.isArray(record.subjects) ? record.subjects[0]?.name : record.subjects?.name,
    score: record.score,
    total_score: record.max_marks || 100,
    percentage: Math.round((record.score / (record.max_marks || 100)) * 100),
    grade: calculateKJSEAGrade(record.score / (record.max_marks || 100))
  })) || [];
};

// Components
const AssessmentTable = React.memo(({ pivotData, exams, onSubjectClick, scrollLeft, scrollRight }: any) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <p className="text-xs sm:text-sm text-gray-600">
        Showing {pivotData.length - 2} subjects • {exams.length} exams
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={scrollLeft} className="h-8 w-8 p-0" title="Scroll left">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={scrollRight} className="h-8 w-8 p-0" title="Scroll right">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div className="relative overflow-hidden rounded-lg border">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <Table className="min-w-full border-collapse">
          <TableHeader className="bg-maroon-50">
            <TableRow>
              <TableHead className="font-semibold text-gray-900 text-xs sm:text-sm px-3 py-2 sticky left-0 bg-maroon-50 z-20 border-r border-gray-200 min-w-[120px] sm:min-w-[150px]">
                Subject
              </TableHead>
              {exams.map((exam: any) => (
                <TableHead key={exam.id} className="font-semibold text-gray-900 text-xs sm:text-sm px-3 py-2 border-r border-gray-200 min-w-[100px] sm:min-w-[120px]">
                  <div className="whitespace-normal break-words">{exam.title}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pivotData.map((row: any, rowIndex: number) => (
              <TableRow
                key={rowIndex}
                className={row.subject === "Totals" ? "font-bold bg-gray-50" : row.subject === "Position" ? "font-bold bg-gray-100" : "hover:bg-gray-50 cursor-pointer"}
                onClick={() => row.subject !== "Totals" && row.subject !== "Position" && onSubjectClick(row.subject)}
              >
                <TableCell className={`${row.subject === "Totals" || row.subject === "Position" ? "font-bold text-gray-900" : "font-medium text-gray-700"} text-xs sm:text-sm px-3 py-2 sticky left-0 z-10 bg-white border-r border-gray-200 min-w-[120px] sm:min-w-[150px]`}>
                  <div className="whitespace-normal break-words">{row.subject}</div>
                </TableCell>
                {exams.map((exam: any) => (
                  <TableCell key={exam.id} className={`${row.subject === "Totals" || row.subject === "Position" ? "font-bold text-gray-900" : "text-gray-700"} text-xs sm:text-sm px-3 py-2 border-r border-gray-200 min-w-[100px] sm:min-w-[120px]`}>
                    <div className="whitespace-normal break-words">{row.exams[exam.title] ?? "-"}</div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {exams.length > 3 && (
        <div className="flex justify-center items-center p-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ArrowLeft className="h-3 w-3" />
            <span>Swipe or use buttons to view more exams</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  </div>
));

const PerformanceCard = React.memo(({ record, profile, className, logoUrl }: any) => (
  <Card className="border border-gray-200 shadow-sm">
    <CardContent className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 text-sm">{record.title}</h3>
            {record.isEndYearExam && (
              <Badge className="bg-blue-100 text-blue-800 text-xs border-blue-200">Yearly Exam</Badge>
            )}
          </div>
          <div className="flex items-center text-xs text-gray-500 mb-2">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(record.assessment_date).toLocaleDateString()} • {record.term} {record.year}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Subject</div>
          <div className="font-medium text-sm">{record.subjects.name}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Score</div>
          <div className="font-medium text-sm">{record.score}/{record.total_score}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Percentage</div>
          <Badge variant="secondary" className="text-xs font-medium">{record.percentage}%</Badge>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Position</div>
          <Badge className={`${
            record.classPosition === 1 ? "bg-green-100 text-green-800" :
            record.classPosition === 2 ? "bg-yellow-100 text-yellow-800" :
            record.classPosition === 3 ? "bg-orange-100 text-orange-800" :
            "bg-gray-100 text-gray-800"
          } text-xs font-medium`}>
            {record.classPosition}
          </Badge>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
        <Badge variant="outline" className={`${getGradeColor(record.grade)} text-xs`}>
          {record.grade.split(" ")[0]}
        </Badge>
        <PDFDownloadLink
          document={<ExamPDF examRecord={record} profile={profile} className={className} logoUrl={logoUrl} />}
          fileName={`Milai_School_${record.title.replace(/\s+/g, '_')}_${profile?.reg_no || 'result'}.pdf`}
        >
          {({ loading }) => (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex items-center gap-1" disabled={loading}>
              {loading ? (
                <PDFLoadingFallback />
              ) : (
                <>
                  <Download className="h-3 w-3" />
                  <span className="hidden xs:inline">PDF</span>
                </>
              )}
            </Button>
          )}
        </PDFDownloadLink>
      </div>
    </CardContent>
  </Card>
));

const PerformanceTableRow = React.memo(({ record, profile, className, logoUrl }: any) => (
  <TableRow className="hover:bg-gray-50">
    <TableCell className="font-medium text-xs sm:text-sm">
      <div>{record.title}</div>
      <div className="text-xs text-gray-500 mt-1">{new Date(record.assessment_date).toLocaleDateString()}</div>
    </TableCell>
    <TableCell className="text-xs sm:text-sm">
      <div>{record.subjects.name}</div>
      <div className="text-xs text-gray-500 mt-1">{record.term} {record.year}</div>
    </TableCell>
    <TableCell className="text-xs sm:text-sm">{record.score} / {record.total_score}</TableCell>
    <TableCell>
      <Badge variant="secondary" className="text-xs">{record.percentage}%</Badge>
      <div className="mt-1">
        <Badge variant="outline" className={`${getGradeColor(record.grade)} text-xs`}>
          {record.grade.split(" ")[0]}
        </Badge>
      </div>
    </TableCell>
    <TableCell>
      <Badge className={`${
        record.classPosition === 1 ? "bg-green-100 text-green-800" :
        record.classPosition === 2 ? "bg-yellow-100 text-yellow-800" :
        record.classPosition === 3 ? "bg-orange-100 text-orange-800" :
        "bg-gray-100 text-gray-800"
      } text-xs`}>
        {record.classPosition}
      </Badge>
    </TableCell>
    <TableCell>
      <PDFDownloadLink
        document={<ExamPDF examRecord={record} profile={profile} className={className} logoUrl={logoUrl} />}
        fileName={`Milai_School_${record.title.replace(/\s+/g, '_')}_${profile?.reg_no || 'result'}.pdf`}
      >
        {({ loading }) => (
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Download PDF" disabled={loading}>
            {loading ? (
              <PDFLoadingFallback />
            ) : (
              <Download className="h-3 w-3" />
            )}
          </Button>
        )}
      </PDFDownloadLink>
    </TableCell>
  </TableRow>
));

const SubjectAnalysisDialog = React.memo(({ selectedSubject, onClose, subjectAnalysis, teacherInfo, analysisLoading, revealedContact, showWarning, contactLoading, onContactReveal, onToggleFullscreen, isFullscreen, subjectDialogRef }: any) => {
  const insights = useMemo(() => {
    const validData = subjectAnalysis.filter((d: any) => d.score !== null && d.date)
      .sort((a: any, b: any) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
    
    if (validData.length < 2) return null;

    const recentExams = validData.slice(0, 3);
    const scores = recentExams.map((d: any) => d.score!);
    const latestScore = scores[0];
    const previousScore = scores[1];
    const trend = latestScore > previousScore ? "improving" : latestScore < previousScore ? "declining" : "stable";
    const averageScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);

    let trendStrength = "moderate";
    if (recentExams.length >= 3) {
      const firstScore = scores[2];
      const overallChange = latestScore - firstScore;
      if (Math.abs(overallChange) >= 15) trendStrength = "significant";
      else if (Math.abs(overallChange) >= 5) trendStrength = "moderate";
      else trendStrength = "minimal";
    }

    return { trend, trendStrength, averageScore, latestScore, previousScore, examsAnalyzed: recentExams.length };
  }, [subjectAnalysis]);

  return (
    <Dialog open={!!selectedSubject} onOpenChange={onClose}>
      <DialogContent ref={subjectDialogRef} className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-white to-maroon/5 border-maroon/20 p-3 sm:p-4 md:p-6">
        <DialogHeader className="border-b border-maroon/10 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <DialogTitle className="flex items-center text-lg sm:text-xl md:text-2xl font-bold text-maroon">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 mr-2 sm:mr-3 text-maroon" />
                {selectedSubject} Performance Analysis
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm md:text-base text-gray-600">
                Detailed performance insights and trend analysis for {selectedSubject}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onToggleFullscreen} className="ml-2 h-8 w-8 p-0" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="lg:col-span-1 bg-white shadow-sm">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center">
                <User className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Subject Teacher
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {analysisLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : teacherInfo ? (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="font-bold text-base sm:text-lg">{teacherInfo.first_name} {teacherInfo.last_name}</p>
                    <Badge variant="outline" className="mt-1 text-xs">Lead Instructor</Badge>
                  </div>
                  <div className="pt-2 border-t">
                    {revealedContact ? (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center text-xs sm:text-sm text-gray-600">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-maroon flex-shrink-0" />
                          <span className="truncate">{revealedContact.email}</span>
                        </div>
                        <div className="flex items-center text-xs sm:text-sm text-gray-600">
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-maroon flex-shrink-0" />
                          <span className="truncate">{revealedContact.phone}</span>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={onContactReveal}>
                        <ShieldAlert className="h-3 w-3 mr-2 flex-shrink-0" />
                        View Contact (Parents Only)
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground italic">Teacher info not assigned</p>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {analysisLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-maroon mx-auto mb-3 sm:mb-4"></div>
                <p className="text-gray-600 text-sm sm:text-base">Loading detailed analysis...</p>
              </div>
            ) : subjectAnalysis.length > 0 && insights ? (
              <>
                <Card className="bg-white border-maroon/20 shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                    <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" />
                      Performance Insights
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-600">
                      Based on analysis of last {insights.examsAnalyzed} exams in {selectedSubject}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2 sm:space-y-3">
                        <h4 className="font-semibold text-gray-900 border-b pb-2 text-xs sm:text-sm">Trend Analysis</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700 text-xs sm:text-sm">Current Trend:</span>
                            <Badge className={`${
                              insights.trend === 'improving' ? 'bg-green-100 text-green-800 border-green-200' : 
                              insights.trend === 'declining' ? 'bg-red-100 text-red-800 border-red-200' : 
                              'bg-blue-100 text-blue-800 border-blue-200'
                            } text-xs`}>
                              {insights.trend === 'improving' ? '📈 Improving' : insights.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700 text-xs sm:text-sm">Trend Strength:</span>
                            <span className="font-semibold capitalize text-gray-900 text-xs sm:text-sm">{insights.trendStrength}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        <h4 className="font-semibold text-gray-900 border-b pb-2 text-xs sm:text-sm">Performance Metrics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700 text-xs sm:text-sm">Latest Score:</span>
                            <span className={`font-bold text-base sm:text-lg ${
                              insights.latestScore >= 90 ? 'text-green-600' :
                              insights.latestScore >= 75 ? 'text-emerald-600' :
                              insights.latestScore >= 58 ? 'text-blue-600' :
                              insights.latestScore >= 41 ? 'text-cyan-600' :
                              insights.latestScore >= 31 ? 'text-yellow-600' :
                              insights.latestScore >= 21 ? 'text-orange-600' :
                              insights.latestScore >= 11 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {insights.latestScore}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700 text-xs sm:text-sm">Average Score:</span>
                            <span className="font-semibold text-gray-900 text-xs sm:text-sm">{insights.averageScore}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-maroon/20 shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-maroon/5 to-transparent border-b border-maroon/10 px-3 sm:px-6 py-3">
                    <CardTitle className="flex items-center text-sm sm:text-base text-gray-900">
                      <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-maroon" />
                      Performance Progression
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-600">
                      Your score trend across all exams in {selectedSubject}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-6">
                    <div className="h-[250px] sm:h-[300px] md:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                          data={subjectAnalysis
                            .filter((d: any) => d.score !== null && d.score !== undefined)
                            .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                          }
                          margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
                          <XAxis dataKey="exam" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 10 }} stroke="#9ca3af" interval={0} />
                          <YAxis domain={['dataMin - 15', 'dataMax + 15']} tick={{ fontSize: 9 }} stroke="#9ca3af" tickFormatter={(value) => `${value}%`} width={25} tickCount={6} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "white", 
                              border: "1px solid #80000020",
                              borderRadius: "6px",
                              boxShadow: "0 2px 4px -1px rgb(0 0 0 / 0.1)",
                              fontSize: "11px",
                              padding: "8px"
                            }}
                            formatter={(value: number) => [`${value}%`, 'Score']}
                            labelFormatter={(label) => `Exam: ${label}`}
                          />
                          <Line type="monotone" dataKey="score" stroke="#800000" strokeWidth={2} dot={{ r: 3, fill: "#800000", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5, fill: "#800000", stroke: "#fff", strokeWidth: 2 }} name="Score" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-white border-maroon/20 text-center py-8">
                <CardContent>
                  <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2">No Exam Data Available</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">No assessment data found for {selectedSubject}.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 mt-4">
          <Button variant="default" onClick={onClose} className="w-full bg-maroon hover:bg-maroon/90">Close Analysis</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default function Assessments({ studentId, classId, className, profile, isOpen, onClose }: AssessmentsProps) {
  // State
  const [assessments, setAssessments] = useState<any[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [studentRankings, setStudentRankings] = useState<any[]>([]);
  const [subjectAnalysis, setSubjectAnalysis] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [revealedContact, setRevealedContact] = useState<{email: string, phone: string} | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const subjectDialogRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const { data: performanceHistory, loading: performanceLoading } = usePerformanceData(studentId, classId);

  // Effects
  useEffect(() => {
    if (isOpen && studentId && classId) {
      fetchAssessmentsData();
      fetchStudentRankings();
      loadLogoAsBase64();
    }
  }, [isOpen, studentId, classId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Functions
  const loadLogoAsBase64 = async () => {
    try {
      const response = await fetch('/logo.png');
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } else {
        setLogoUrl('');
      }
    } catch (error) {
      setLogoUrl('');
    }
  };

  const fetchAssessmentsData = async () => {
    if (!studentId || !classId) return;
    
    setAssessmentsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const { data: assessmentsData } = await supabase
        .from("assessment_results")
        .select(`id, student_id, score, max_marks, assessment_date, assessments(id, title, term, year, class_id), subjects(id, name)`)
        .eq("student_id", studentId)
        .eq("assessments.class_id", classId)
        .in("assessments.year", [currentYear, currentYear - 1])
        .order("assessment_date", { ascending: false });

      const processedData = (assessmentsData || []).map((item: any) => ({
        ...item,
        assessments: Array.isArray(item.assessments) ? (item.assessments[0] || undefined) : item.assessments,
        subjects: Array.isArray(item.subjects) ? (item.subjects[0] || undefined) : item.subjects,
        percentage: item.max_marks > 0 ? (item.score / item.max_marks) * 100 : 0
      }));
      
      setAssessments(processedData);
    } catch (err) {
      console.error("Error fetching assessments:", err);
    } finally {
      setAssessmentsLoading(false);
    }
  };

  const fetchStudentRankings = async () => {
    if (!studentId || !classId) return;
    
    try {
      const { data } = await supabase
        .from("student_rankings")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .order("assessment_date", { ascending: false });

      setStudentRankings(data || []);
    } catch (err) {
      console.error("Error fetching student rankings:", err);
    }
  };

  const fetchTeacherContact = async () => {
    if (!teacherInfo?.teacher_id) return;
    
    setContactLoading(true);
    try {
      const { data } = await supabase
        .from("student_teacher_info")
        .select("email, phone")
        .eq("teacher_id", teacherInfo.teacher_id)
        .single();

      setRevealedContact(data);
      setShowWarning(false);
    } catch (err) {
      console.error("Error fetching contact:", err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleSubjectClick = async (subjectName: string) => {
    setSelectedSubject(subjectName);
    setAnalysisLoading(true);
    setRevealedContact(null);

    const examTitles = exams.map((e: any) => e.title);
    const subjectAssessments = assessments.filter((a: any) => a.subjects?.name === subjectName && a.student_id === studentId);
    
    const subjectAnalysisData = examTitles.map((examTitle: string) => {
      const found = subjectAssessments.find((a: any) => a.assessments?.title === examTitle);
      return {
        exam: examTitle,
        score: found ? found.score : null,
        date: found ? found.assessment_date : null,
        subject_id: found ? found.subjects?.id : null,
      };
    });
    setSubjectAnalysis(subjectAnalysisData);

    let teacher = null;
    const subjectId = subjectAnalysisData.find((sa: any) => sa.subject_id)?.subject_id;
    if (subjectId && classId) {
      const { data: tcData } = await supabase
        .from("teacher_classes")
        .select("teacher_id")
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .single();

      if (tcData?.teacher_id) {
        const { data } = await supabase
          .from("student_teacher_info")
          .select("teacher_id, first_name, last_name")
          .eq("teacher_id", tcData.teacher_id)
          .single();
        if (data) teacher = data;
      }
    }
    setTeacherInfo(teacher);
    setAnalysisLoading(false);
  };

  const getPerformanceInsights = useCallback(() => {
    if (!performanceHistory || performanceHistory.length < 2) return null;

    const recentPerformance = performanceHistory.slice(0, 6);
    const latestScore = recentPerformance[0].percentage;
    const previousScore = recentPerformance[1].percentage;
    const averageScore = Math.round(recentPerformance.reduce((sum: number, record: any) => sum + record.percentage, 0) / recentPerformance.length);
    const topPositions = recentPerformance.filter((record: any) => record.classPosition <= 3).length;
    const trend = latestScore > previousScore ? "improving" : latestScore < previousScore ? "declining" : "stable";
    
    let performanceLevel = "";
    if (averageScore >= 90) performanceLevel = "Exceptional (EE1)";
    else if (averageScore >= 75) performanceLevel = "Excellent (EE2)";
    else if (averageScore >= 58) performanceLevel = "Very Good (ME1)";
    else if (averageScore >= 41) performanceLevel = "Good (ME2)";
    else if (averageScore >= 31) performanceLevel = "Average (AE1)";
    else if (averageScore >= 21) performanceLevel = "Below Average (AE2)";
    else if (averageScore >= 11) performanceLevel = "Poor (BE1)";
    else performanceLevel = "Very Poor (BE2)";

    return { trend, performanceLevel, averageScore, topPositions, latestScore, previousScore };
  }, [performanceHistory]);

  // Memoized values
  const exams = useMemo(() => {
    const examTitleSet = new Set<string>();
    assessments.forEach((a: any) => {
      if (a.assessments?.title) examTitleSet.add(a.assessments.title);
    });
    
    return Array.from(examTitleSet)
      .sort((a, b) => {
        const numA = extractExamNumber(a);
        const numB = extractExamNumber(b);
        return numA !== numB ? numA - numB : a.localeCompare(b);
      })
      .map(title => ({ id: title, title }));
  }, [assessments]);

  const pivotData = useMemo(() => {
    if (!assessments.length || !studentId || !studentRankings.length) return [];

    const examTitles = exams.map((e: any) => e.title);
    const grouped: Record<string, any> = {};
    
    assessments.forEach((a: any) => {
      if (String(a.student_id) !== String(studentId)) return;
      const subject = a.subjects?.name || "Unknown Subject";
      const examTitle = a.assessments?.title || "Untitled Exam";
      
      if (!grouped[subject]) grouped[subject] = { subject, exams: {} };
      grouped[subject].exams[examTitle] = a.score !== null ? Number(a.score) : "-";
    });
    
    const rows = Object.values(grouped).map((row: any) => ({
      subject: row.subject,
      exams: examTitles.reduce((acc: Record<string, any>, title: string) => {
        acc[title] = row.exams[title] ?? "-";
        return acc;
      }, {}),
    }));

    const rankingMap: Record<string, any> = {};
    studentRankings.forEach((r: any) => {
      if (r.exam_title) {
        rankingMap[r.exam_title] = {
          total_attained: r.total_attained,
          total_possible: r.total_possible,
          class_position: r.class_position
        };
      }
    });

    const totals: Record<string, any> = {};
    const positions: Record<string, any> = {};

    examTitles.forEach((title: string) => {
      if (rankingMap[title]) {
        totals[title] = `${rankingMap[title].total_attained}/${rankingMap[title].total_possible}`;
        positions[title] = rankingMap[title].class_position;
      } else {
        totals[title] = "-";
        positions[title] = "-";
      }
    });

    return [
      ...rows,
      { subject: "Totals", exams: totals },
      { subject: "Position", exams: positions }
    ];
  }, [assessments, studentId, exams, studentRankings]);

  const performanceInsights = useMemo(() => getPerformanceInsights(), [getPerformanceInsights]);

  // Event handlers
  const scrollLeft = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: -(scrollContainerRef.current.clientWidth * 0.8), behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: scrollContainerRef.current.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!subjectDialogRef.current) return;
    
    if (!document.fullscreenElement) {
      subjectDialogRef.current.requestFullscreen().catch(err => console.error(`Error enabling fullscreen: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Render
  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6">
        <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <DialogTitle className="flex items-center text-lg sm:text-xl lg:text-2xl text-maroon">
                <BookOpen className="h-5 w-5 lg:h-6 lg:w-6 mr-2" />
                Assessments & Performance
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">View your assessment results and performance history</DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="mt-2 sm:mt-0">Close</Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="assessments" className="w-full">
          <TabsList className="grid w-full grid-cols-2 p-1 h-auto">
            <TabsTrigger value="assessments" className="text-xs sm:text-sm py-2">Assessments</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm py-2">Performance History</TabsTrigger>
          </TabsList>

          <TabsContent value="assessments" className="space-y-4 mt-4">
            {assessmentsLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-maroon mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm sm:text-base">Loading assessment results...</p>
              </div>
            ) : pivotData.length > 0 ? (
              <>
                <AssessmentTable pivotData={pivotData} exams={exams} onSubjectClick={handleSubjectClick} scrollLeft={scrollLeft} scrollRight={scrollRight} />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <div className="bg-blue-100 p-1 rounded-full mt-0.5"><BookOpen className="h-4 w-4 text-blue-600" /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">How to use this table on mobile:</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li className="flex items-start"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span><span>Swipe horizontally to view all exams</span></li>
                        <li className="flex items-start"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span><span>Subject column stays fixed for reference</span></li>
                        <li className="flex items-start"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span><span>Tap on any subject row for detailed analysis</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No assessment results found.</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">Assessments will appear here when they are published.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6 mt-4">
            {performanceLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-maroon mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm sm:text-base">Loading performance history...</p>
              </div>
            ) : !performanceHistory?.length ? (
              <div className="text-center py-8 sm:py-12">
                <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No performance records found</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="border-l-4 border-l-maroon"><CardContent className="p-3 sm:p-4 text-center"><div className="text-xl sm:text-2xl font-bold text-maroon">{performanceHistory.length}</div><p className="text-xs sm:text-sm text-gray-600 mt-1">Exams Tracked</p></CardContent></Card>
                  <Card className="border-l-4 border-l-blue-500"><CardContent className="p-3 sm:p-4 text-center"><div className="text-xl sm:text-2xl font-bold text-blue-600">{Math.round(performanceHistory.reduce((sum: number, record: any) => sum + record.percentage, 0) / performanceHistory.length)}%</div><p className="text-xs sm:text-sm text-gray-600 mt-1">Avg Score</p></CardContent></Card>
                  <Card className="border-l-4 border-l-purple-500"><CardContent className="p-3 sm:p-4 text-center"><div className="text-xl sm:text-2xl font-bold text-purple-600">{performanceHistory.filter((record: any) => record.grade.includes("EE1") || record.grade.includes("EE2")).length}</div><p className="text-xs sm:text-sm text-gray-600 mt-1">Excellent</p></CardContent></Card>
                  <Card className="border-l-4 border-l-orange-500"><CardContent className="p-3 sm:p-4 text-center"><div className="text-xl sm:text-2xl font-bold text-orange-600">{Math.min(...performanceHistory.map((r: any) => r.classPosition))}</div><p className="text-xs sm:text-sm text-gray-600 mt-1">Best Position</p></CardContent></Card>
                </div>

                {performanceInsights && (
                  <Card className="bg-maroon/5">
                    <CardHeader className="px-4 sm:px-6"><CardTitle className="text-sm sm:text-base">Performance Insights</CardTitle></CardHeader>
                    <CardContent className="px-4 sm:px-6">
                      <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                        <p><span className="font-medium">Trend: </span>Your performance is <span className={performanceInsights.trend === 'improving' ? 'text-green-600 font-medium' : performanceInsights.trend === 'declining' ? 'text-red-600 font-medium' : 'text-blue-600 font-medium'}>{performanceInsights.trend}</span></p>
                        <p><span className="font-medium">Overall Level: </span><span className="capitalize">{performanceInsights.performanceLevel}</span></p>
                        <p><span className="font-medium">Achievements: </span>{performanceInsights.topPositions} top 3 class positions in recent exams</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="hidden md:block overflow-x-auto rounded-lg border">
                  <div className="min-w-[600px]">
                    <Table>
                      <TableHeader className="bg-maroon-50">
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Exam</TableHead><TableHead className="text-xs sm:text-sm">Subject</TableHead><TableHead className="text-xs sm:text-sm">Score</TableHead><TableHead className="text-xs sm:text-sm">%</TableHead><TableHead className="text-xs sm:text-sm">Position</TableHead><TableHead className="text-xs sm:text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceHistory.slice(0, 6).map((record: any) => (
                          <PerformanceTableRow key={record.id} record={record} profile={profile} className={className} logoUrl={logoUrl} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="md:hidden space-y-4">
                  {performanceHistory.slice(0, 6).map((record: any) => (
                    <PerformanceCard key={record.id} record={record} profile={profile} className={className} logoUrl={logoUrl} />
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <PDFDownloadLink
                    document={<PerformanceHistoryPDF performanceHistory={performanceHistory} profile={profile} className={className || ''} logoUrl={logoUrl} />}
                    fileName={`Milai_School_Performance_History_${profile?.reg_no || 'student'}.pdf`}
                  >
                    {({ loading }) => (
                      <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs" disabled={loading}>
                        {loading ? (
                          <>
                            <PDFLoadingFallback />
                            <span className="hidden sm:inline">Generating PDF...</span>
                            <span className="sm:hidden">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Download All Exams PDF</span>
                            <span className="sm:hidden">All PDF</span>
                          </>
                        )}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <SubjectAnalysisDialog
          selectedSubject={selectedSubject}
          onClose={() => setSelectedSubject(null)}
          subjectAnalysis={subjectAnalysis}
          teacherInfo={teacherInfo}
          analysisLoading={analysisLoading}
          revealedContact={revealedContact}
          showWarning={showWarning}
          contactLoading={contactLoading}
          onContactReveal={() => setShowWarning(true)}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          subjectDialogRef={subjectDialogRef}
        />

        <Dialog open={showWarning} onOpenChange={setShowWarning}>
          <DialogContent className="sm:max-w-[425px] max-w-[95vw] mx-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600 text-sm sm:text-base">
                <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
                Security Policy Warning
              </DialogTitle>
              <DialogDescription className="py-3 text-xs sm:text-sm">
                Teacher contact details are shared exclusively for parental communication regarding student welfare. 
                <br /><br />
                <span className="text-red-600 font-bold">Unauthorized use or sharing of this information by students is a violation of school policy.</span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" onClick={() => setShowWarning(false)} className="text-xs sm:text-sm">Cancel</Button>
              <Button className="bg-maroon hover:bg-maroon/90 text-xs sm:text-sm" onClick={fetchTeacherContact} disabled={contactLoading}>
                {contactLoading ? "Verifying..." : "I am a Parent, I Accept"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}