import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { User, TrendingUp, TrendingDown, Minus, Target, BookOpen, Calendar, Phone, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useState, useRef } from "react";

// ---------- KJSEA Achievement Levels (2025) ----------
const KJSEA_LEVELS = [
  { label: "EE1 (L8)", min: 90, max: 100, color: "#10B981", description: "Exceptional" },
  { label: "EE2 (L7)", min: 75, max: 89, color: "#22C55E", description: "Excellent" },
  { label: "ME1 (L6)", min: 58, max: 74, color: "#3B82F6", description: "Very Good" },
  { label: "ME2 (L5)", min: 41, max: 57, color: "#8B5CF6", description: "Good" },
  { label: "AE1 (L4)", min: 31, max: 40, color: "#F59E0B", description: "Average" },
  { label: "AE2 (L3)", min: 21, max: 30, color: "#F97316", description: "Below Average" },
  { label: "BE1 (L2)", min: 11, max: 20, color: "#EF4444", description: "Poor" },
  { label: "BE2 (L1)", min: 0, max: 10, color: "#6B7280", description: "Very Poor" },
] as const;

// Calculate KJSEA grade based on percentage
const calculateKJSEAGrade = (percentage: number): string => {
  const level = KJSEA_LEVELS.find(level => percentage >= level.min && percentage <= level.max);
  return level ? level.label : "BE2 (L1)";
};

// ---------- Types ----------
interface StudentAssessment {
  id: string;
  title: string;
  score: number;
  max_marks: number;
  percentage: number;
  assessment_date: string;
  subject: string;
  term: number;
  year: number;
}

interface Student {
  id: string;
  Reg_no: string;
  first_name: string;
  last_name: string;
  created_at: string;
  auth_id: string | null;
  enrollments?: {
    class_id: string;
    classes: {
      name: string;
      grade_level: string;
    } | {
      name: string;
      grade_level: string;
    }[];
  }[];
  profiles?: {
    email: string;
    phone: string;
    date_of_birth: string;
    guardian_name: string;
    guardian_phone: string;
  } | {
    email: string;
    phone: string;
    date_of_birth: string;
    guardian_name: string;
    guardian_phone: string;
  }[];
  class?: string;
}

interface StudentPerformanceDetail {
  student: Student;
  assessments: StudentAssessment[];
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
  subjectAverages: { subject: string; average: number }[];
  gradeDistribution: { grade: string; count: number }[];
  recentTrend: number;
}

// ---------- StudentPerformanceDetailView Component ----------
interface StudentPerformanceDetailViewProps {
  performanceDetail: StudentPerformanceDetail;
}

const StudentPerformanceDetailView: React.FC<StudentPerformanceDetailViewProps> = ({
  performanceDetail
}) => {
  const {
    student,
    assessments,
    averageScore,
    trend,
    subjectAverages,
    gradeDistribution,
    recentTrend
  } = performanceDetail;

  const studentClass = student.class || 'No Class';
  const [chartScrollIndex, setChartScrollIndex] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Prepare performance data for the chart with better mobile formatting
  const performanceOverTime = assessments.map(assessment => ({
    name: assessment.title.length > 20 ? assessment.title.substring(0, 20) + '...' : assessment.title,
    fullName: assessment.title,
    score: assessment.percentage,
    date: new Date(assessment.assessment_date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    fullDate: new Date(assessment.assessment_date).toLocaleDateString(),
    subject: assessment.subject
  })).reverse();

  const subjectPerformanceData = subjectAverages.map(subject => ({
    subject: subject.subject.length > 10 ? subject.subject.substring(0, 10) + '...' : subject.subject,
    fullSubject: subject.subject,
    average: subject.average,
    fill: KJSEA_LEVELS.find(l => subject.average >= l.min && subject.average <= l.max)?.color || "#6B7280"
  }));

  // Calculate visible assessments for mobile view (show 4 at a time)
  const visibleAssessments = assessments.slice(0, 4);

  const getPerformanceInsights = () => {
    const insights = [];
    
    const kjseaLevel = KJSEA_LEVELS.find(level => averageScore >= level.min && averageScore <= level.max);
    
    if (kjseaLevel) {
      insights.push({
        icon: <Target className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5" style={{ color: kjseaLevel.color }} />,
        title: `${kjseaLevel.description} Performance (${kjseaLevel.label})`,
        description: `Student achieves ${kjseaLevel.description} level. ${averageScore >= 58 ? 'Maintain current strategies.' : 'Consider targeted interventions.'}`
      });
    }

    if (trend === 'improving') {
      insights.push({
        icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5" />,
        title: "Positive Momentum",
        description: `Performance is improving by approximately ${Math.abs(recentTrend)} points. Current teaching strategies are effective - maintain this approach.`
      });
    } else if (trend === 'declining') {
      insights.push({
        icon: <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mt-0.5" />,
        title: "Declining Performance",
        description: `Scores have decreased by approximately ${Math.abs(recentTrend)} points. Review recent topics and consider additional support.`
      });
    } else {
      insights.push({
        icon: <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 mt-0.5" />,
        title: "Stable Performance",
        description: "Performance remains consistent. Focus on gradual improvement through targeted practice and feedback."
      });
    }

    if (subjectAverages.length > 0) {
      const strongestSubject = subjectAverages.reduce((prev, current) => 
        prev.average > current.average ? prev : current
      );
      const weakestSubject = subjectAverages.reduce((prev, current) => 
        prev.average < current.average ? prev : current
      );

      if (subjectAverages.length >= 2 && strongestSubject.average - weakestSubject.average > 15) {
        insights.push({
          icon: <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5" />,
          title: "Significant Subject Variation",
          description: `Strong in ${strongestSubject.subject} (${strongestSubject.average}%) but needs support in ${weakestSubject.subject} (${weakestSubject.average}%). Consider cross-subject learning strategies.`
        });
      }
    }

    if (assessments.length < 3) {
      insights.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mt-0.5" />,
        title: "Limited Assessment Data",
        description: "Only a few assessments available. More data needed for accurate trend analysis and performance insights."
      });
    }

    if (insights.length === 0) {
      insights.push({
        icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />,
        title: "New Student Analysis",
        description: "This student is new to the system. As assessments are completed, more detailed insights will become available."
      });
    }

    return insights;
  };

  const insights = getPerformanceInsights();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Student Header Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-2xl font-bold truncate">
                  {student.first_name} {student.last_name}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {student.Reg_no} • {studentClass}
                </p>
                {student.profiles?.[0]?.guardian_phone && (
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Guardian: {student.profiles[0].guardian_phone}
                  </p>
                )}
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold text-primary">{averageScore}%</div>
              <div className="flex items-center justify-center sm:justify-end space-x-1 sm:space-x-2 mt-1">
                <div className={trend === 'improving' ? 'text-green-600' : trend === 'declining' ? 'text-red-600' : 'text-yellow-600'}>
                  {trend === 'improving' ? <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" /> : 
                   trend === 'declining' ? <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" /> : 
                   <Minus className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <span className="text-xs sm:text-sm capitalize">{trend}</span>
                {recentTrend !== 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({recentTrend > 0 ? '+' : ''}{recentTrend})
                  </span>
                )}
              </div>
              <Badge 
                className="mt-1 sm:mt-2 text-xs sm:text-sm"
                style={{ 
                  backgroundColor: KJSEA_LEVELS.find(l => averageScore >= l.min && averageScore <= l.max)?.color || "#6B7280",
                  color: "white"
                }}
              >
                {calculateKJSEAGrade(averageScore)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Charts Grid - Optimized for mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Performance Trend Chart - Mobile optimized */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Performance Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Last {assessments.length} assessments</CardDescription>
              </div>
              {performanceOverTime.length > 4 && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setChartScrollIndex(prev => Math.max(0, prev - 1))}
                    disabled={chartScrollIndex === 0}
                    className="p-1 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setChartScrollIndex(prev => Math.min(performanceOverTime.length - 4, prev + 1))}
                    disabled={chartScrollIndex >= performanceOverTime.length - 4}
                    className="p-1 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {performanceOverTime.length > 0 ? (
              <div className="w-full h-[200px] sm:h-[250px] md:h-[300px]" ref={chartContainerRef}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={performanceOverTime.slice(chartScrollIndex, chartScrollIndex + 4)}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tick={{fontSize: 10}}
                      axisLine={false}
                      tickLine={false}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      fontSize={10}
                      tick={{fontSize: 10}}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                      tickCount={6}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: '12px',
                        padding: '8px',
                        maxWidth: '200px'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Score']}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload;
                          return `${data.fullName} (${data.fullDate})`;
                        }
                        return label;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {performanceOverTime.length > 4 && (
                  <div className="text-center mt-2 text-xs text-muted-foreground">
                    Showing {chartScrollIndex + 1}-{Math.min(chartScrollIndex + 4, performanceOverTime.length)} of {performanceOverTime.length} assessments
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[200px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No assessment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subject Performance Chart - Mobile optimized */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Subject Performance</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Average scores by subject</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {subjectPerformanceData.length > 0 ? (
              <div className="w-full h-[200px] sm:h-[250px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={subjectPerformanceData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="subject" 
                      stroke="hsl(var(--muted-foreground))"
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      fontSize={10}
                      tick={{fontSize: 10}}
                      interval={0}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      fontSize={10}
                      tick={{fontSize: 10}}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: '12px',
                        padding: '8px',
                        maxWidth: '200px'
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        const fullSubject = props.payload?.fullSubject || props.payload?.subject;
                        return [`${value}%`, fullSubject];
                      }}
                    />
                    <Bar 
                      dataKey="average" 
                      radius={[4, 4, 0, 0]}
                    >
                      {subjectPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] sm:h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No subject data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Assessments Table - Mobile optimized */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Recent Assessments</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Last {assessments.length} exam results</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 pt-0">
          <div className="overflow-x-auto">
            <div className="min-w-[300px] sm:min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Assessment</TableHead>
                    <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden sm:table-cell">Subject</TableHead>
                    <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">Date</TableHead>
                    <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden xs:table-cell">Score</TableHead>
                    <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs">%</TableHead>
                    <TableHead className="py-2 px-2 sm:py-3 sm:px-4 text-xs hidden sm:table-cell">Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAssessments.map((assessment) => {
                    const grade = calculateKJSEAGrade(assessment.percentage);
                    const level = KJSEA_LEVELS.find(l => l.label === grade);
                    
                    return (
                      <TableRow key={assessment.id}>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[150px]">
                          {assessment.title}
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{assessment.subject}</Badge>
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                          {new Date(assessment.assessment_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm hidden xs:table-cell">
                          {assessment.score}/{assessment.max_marks}
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 sm:w-12 bg-secondary rounded-full h-2">
                              <div 
                                className="h-2 rounded-full"
                                style={{ 
                                  width: `${Math.min(assessment.percentage, 100)}%`,
                                  backgroundColor: level?.color || "#6B7280"
                                }}
                              />
                            </div>
                            <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{assessment.percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">
                          <Badge 
                            style={{ backgroundColor: level?.color }}
                            className="text-white text-xs"
                          >
                            {grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {assessments.length === 0 && (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
              No assessment records found for this student
            </div>
          )}
          
          {assessments.length > 4 && (
            <div className="text-center py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing 4 of {assessments.length} assessments. View all in full table.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KJSEA Grade Distribution - Mobile optimized */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">KJSEA Grade Distribution</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Performance across Kenyan Achievement Levels</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-1 sm:gap-2 md:gap-4">
            {KJSEA_LEVELS.map((level, index) => {
              const count = gradeDistribution.find(gd => gd.grade === level.label)?.count || 0;
              return (
                <div key={level.label} className="text-center p-1 sm:p-2 md:p-4 rounded-lg border">
                  <div 
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mx-auto mb-1 text-white font-bold text-xs"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.label.split(' ')[0]}
                  </div>
                  <div className="text-sm sm:text-base md:text-lg font-bold">{count}</div>
                  <div className="text-[10px] xs:text-xs text-muted-foreground truncate hidden sm:block">{level.description}</div>
                  <div className="text-[10px] mt-0.5">L{level.label.split('(')[1].replace(')', '')}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Tap on a level to see details. EE = Exceptional, ME = Merit, AE = Average, BE = Below Average
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Performance Insights</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Key observations and recommendations</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3 sm:space-y-4">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base">{insight.title}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentPerformanceDetailView;