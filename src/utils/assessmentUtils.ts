// Helper functions
export const getOrdinalSuffix = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export const getPerformanceLevel = (percentage: number) => {
  if (percentage >= 90) return "Exceptional";
  if (percentage >= 75) return "Excellent";
  if (percentage >= 58) return "Very Good";
  if (percentage >= 41) return "Good";
  if (percentage >= 31) return "Average";
  if (percentage >= 21) return "Below Average";
  if (percentage >= 11) return "Poor";
  return "Very Poor";
};

// Calculate KJSEA Achievement Level based on percentage
export const calculateKJSEAGrade = (percentage: number): string => {
  const perc = percentage * 100;
  if (perc >= 90) return "EE1 (Level 8)";
  if (perc >= 75) return "EE2 (Level 7)";
  if (perc >= 58) return "ME1 (Level 6)";
  if (perc >= 41) return "ME2 (Level 5)";
  if (perc >= 31) return "AE1 (Level 4)";
  if (perc >= 21) return "AE2 (Level 3)";
  if (perc >= 11) return "BE1 (Level 2)";
  return "BE2 (Level 1)";
};

// Get grade color for badges
export const getGradeColor = (grade: string) => {
  if (grade.includes("EE1")) return "bg-green-100 text-green-800 border-green-200";
  if (grade.includes("EE2")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (grade.includes("ME1")) return "bg-blue-100 text-blue-800 border-blue-200";
  if (grade.includes("ME2")) return "bg-cyan-100 text-cyan-800 border-cyan-200";
  if (grade.includes("AE1")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (grade.includes("AE2")) return "bg-orange-100 text-orange-800 border-orange-200";
  if (grade.includes("BE1")) return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

// Function to extract exam numbers with priority for Cat 1, 2, 3
export const extractExamNumber = (title: string) => {
  const lowerTitle = title.toLowerCase();
  const catMatch = lowerTitle.match(/cat\s*(\d+)/);
  if (catMatch) return parseInt(catMatch[1], 10);
  
  const catDotMatch = lowerTitle.match(/cat\.\s*(\d+)/);
  if (catDotMatch) return parseInt(catDotMatch[1], 10);
  
  const standaloneMatch = title.match(/(\d+)$/);
  if (standaloneMatch) return parseInt(standaloneMatch[1], 10);
  
  if (lowerTitle.includes('mid term') || lowerTitle.includes('mid-term')) return 10;
  if (lowerTitle.includes('end term') || lowerTitle.includes('end-term') || 
      lowerTitle.includes('final') || lowerTitle.includes('annual')) return 20;
  
  return Number.MAX_SAFE_INTEGER;
};

// Helper to normalize relation fields
export const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};

// Interfaces
export interface PerformanceRecord {
  id: string;
  title: string;
  term: string;
  year: number;
  assessment_date: string;
  subjects: {
    name: string;
  };
  score: number;
  total_score: number;
  percentage: number;
  grade: string;
  isEndYearExam?: boolean;
  subjectBreakdown?: any[];
  classPosition: number;
}

export interface SubjectAnalysisData {
  exam: string;
  score: number | null;
  date: string | null;
  subject_id: string | null;
}

export interface AssessmentsProps {
  studentId: string | null;
  classId: string | null;
  className: string | null;
  profile: any;
  isOpen: boolean;
  onClose: () => void;
}