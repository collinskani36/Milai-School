// ---------- KJSEA Achievement Levels (2025) ----------
export const KJSEA_LEVELS = [
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
export const calculateKJSEAGrade = (percentage: number): string => {
  const level = KJSEA_LEVELS.find(level => percentage >= level.min && percentage <= level.max);
  return level ? level.label : "BE2 (L1)";
};

// Helper to normalize relation fields returned by Supabase (may be object or single-item array)
export const firstRel = <T,>(rel?: T | T[] | null): T | undefined => {
  if (!rel) return undefined;
  return Array.isArray(rel) ? (rel.length > 0 ? rel[0] : undefined) : rel as T;
};
