// src/lib/queryKeys.ts
// Namespaced React Query keys. Each section owns its own keys so two sections
// can never share a cache entry with different data shapes.

export const queryKeys = {
  classes: {
    withDetails: ['admin', 'classes', 'with-details'] as const,
    subjects: ['admin', 'classes', 'subjects'] as const,
    gradeLevels: ['admin', 'classes', 'grade-levels'] as const,
    currentTerm: ['admin', 'classes', 'current-term'] as const,
  },
  students: {
    classList: ['admin', 'students', 'class-list'] as const,
  },
  assignments: {
    list: ['admin', 'assignments', 'list'] as const,
    subjects: ['admin', 'assignments', 'subjects'] as const,
    classes: ['admin', 'assignments', 'classes'] as const,
  },
  overview: {
    classes: ['admin', 'overview', 'classes'] as const,
    subjects: ['admin', 'overview', 'subjects'] as const,
    announcements: ['admin', 'overview', 'announcements'] as const,
  },
  timetable: {
    currentTerm: ['admin', 'timetable', 'current-term'] as const,
  },
};