// hooks/useActiveTerm.ts
// Drop this file in your hooks/ folder (or wherever you keep custom hooks).
// It fetches the currently active term from the academic_calendar table
// and exposes it for use across Fee Management components.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface ActiveTerm {
  id: string;
  academic_year: string;
  term: number;
  term_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: 'upcoming' | 'active' | 'closed';
}

/**
 * Returns the currently active academic term, or null if none is set.
 * Data is cached for 5 minutes — activate_term RPC invalidates this
 * automatically if you add `queryClient.invalidateQueries({ queryKey: ['activeTerm'] })`
 * to AcademicCalendar's handleActivate success handler.
 */
export function useActiveTerm() {
  return useQuery<ActiveTerm | null>({
    queryKey: ['activeTerm'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_calendar')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();          // returns null (not error) when no row matches

      if (error) throw error;
      return (data as ActiveTerm) ?? null;
    },
  });
}

/**
 * Converts an ActiveTerm into the string format the fee system uses.
 * e.g.  { term: 2, academic_year: "2024-2025" }  →  "Term 2"
 */
export function termLabel(term: ActiveTerm | null | undefined): string {
  if (!term) return '';
  return `Term ${term.term}`;
}