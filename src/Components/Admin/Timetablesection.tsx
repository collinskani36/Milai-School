import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Badge } from '@/Components/ui/badge';
import { Label } from '@/Components/ui/label';
import {
  Calendar, Save, Eye, Pencil, BookOpen, Clock,
  ChevronDown, Check, AlertTriangle, Users,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const WEEKDAY_SLOTS = [
  { id: 'p1',   label: 'Period 1', time: '8:00 – 8:40',   type: 'lesson' },
  { id: 'p2',   label: 'Period 2', time: '8:40 – 9:20',   type: 'lesson' },
  { id: 'p3',   label: 'Period 3', time: '9:20 – 10:00',  type: 'lesson' },
  { id: 'brk',  label: 'Break',    time: '10:00 – 10:30', type: 'break'  },
  { id: 'p4',   label: 'Period 4', time: '10:30 – 11:10', type: 'lesson' },
  { id: 'p5',   label: 'Period 5', time: '11:10 – 11:50', type: 'lesson' },
  { id: 'p6',   label: 'Period 6', time: '11:50 – 12:30', type: 'lesson' },
  { id: 'lnch', label: 'Lunch',    time: '12:30 – 1:10',  type: 'lunch'  },
  { id: 'p7',   label: 'Period 7', time: '1:10 – 1:50',   type: 'lesson' },
  { id: 'p8',   label: 'Period 8', time: '1:50 – 2:30',   type: 'lesson' },
];

const DEFAULT_WEEKEND_SLOTS = [
  { id: 'ws1',  time: '6:00 – 7:00'   },
  { id: 'ws2',  time: '7:00 – 8:00'   },
  { id: 'ws3',  time: '8:00 – 9:00'   },
  { id: 'ws4',  time: '9:00 – 10:00'  },
  { id: 'ws5',  time: '10:00 – 11:00' },
  { id: 'ws6',  time: '11:00 – 12:00' },
  { id: 'ws7',  time: '12:00 – 1:00'  },
  { id: 'ws8',  time: '1:00 – 2:00'   },
  { id: 'ws9',  time: '2:00 – 3:00'   },
  { id: 'ws10', time: '3:00 – 4:00'   },
  { id: 'ws11', time: '4:00 – 5:00'   },
  { id: 'ws12', time: '5:00 – 6:00'   },
];

interface WeekdayCell {
  subjectId:   string;
  subjectName: string;
  subjectCode: string;
  teacherId:   string;
  teacherName: string;
}

interface WeekendCell {
  saturday: string;
  sunday:   string;
}

interface TimetableData {
  weekday: Record<string, Record<string, WeekdayCell | null>>;
  weekend: Record<string, WeekendCell>;
}

function emptyTimetable(): TimetableData {
  const weekday: TimetableData['weekday'] = {};
  WEEKDAY_SLOTS.filter(s => s.type === 'lesson').forEach(slot => {
    weekday[slot.id] = {};
    DAYS.forEach(day => { weekday[slot.id][day] = null; });
  });
  const weekend: TimetableData['weekend'] = {};
  DEFAULT_WEEKEND_SLOTS.forEach(s => { weekend[s.id] = { saturday: '', sunday: '' }; });
  return { weekday, weekend };
}

interface CellEditorProps {
  value:    WeekdayCell | null;
  options:  { subjectId: string; subjectName: string; subjectCode: string; teacherId: string; teacherName: string }[];
  onChange: (val: WeekdayCell | null) => void;
}

function CellEditor({ value, options, onChange }: CellEditorProps) {
  const [open, setOpen] = useState(false);
  const selectedKey = value ? `${value.subjectId}::${value.teacherId}` : '';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left px-2 py-1.5 rounded text-xs border transition-all min-h-[48px] leading-tight
          ${value
            ? 'bg-green-50 border-green-200 text-green-900 hover:bg-green-100'
            : 'bg-gray-50 border-dashed border-gray-200 text-gray-400 hover:border-green-300 hover:bg-green-50/40'
          }`}
      >
        {value ? (
          <div>
            <div className="font-semibold text-green-800">{value.subjectCode}</div>
            <div className="text-green-600 truncate">{value.teacherName.split(' ').slice(-1)[0]}</div>
          </div>
        ) : (
          <span className="flex items-center gap-1">
            <span className="text-gray-300 text-lg leading-none">+</span> assign
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b flex items-center gap-2"
            >
              <span className="text-red-300">✕</span> Clear
            </button>
            {options.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 italic">
                No teacher assignments found for this class. Assign teachers first in the Teachers section.
              </div>
            ) : (
              options.map(opt => {
                const key = `${opt.subjectId}::${opt.teacherId}`;
                const isSelected = key === selectedKey;
                return (
                  <button
                    key={key}
                    onClick={() => { onChange(opt); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-green-50 flex items-center justify-between gap-2
                      ${isSelected ? 'bg-green-50 text-green-800 font-semibold' : 'text-gray-700'}`}
                  >
                    <div>
                      <div className="font-medium">{opt.subjectName}</div>
                      <div className="text-gray-400">{opt.teacherName}</div>
                    </div>
                    {isSelected && <Check className="w-3 h-3 text-green-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TimetableSection() {
  const queryClient = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTerm, setSelectedTerm]       = useState<string>('');
  // ── FIX: start empty, auto-filled from active term to prevent academic_year mismatches ──
  const [selectedYear, setSelectedYear]       = useState<string>('');
  const [mode, setMode]                       = useState<'edit' | 'view'>('edit');
  const [activeTab, setActiveTab]             = useState<'weekday' | 'weekend'>('weekday');
  const [timetable, setTimetable]             = useState<TimetableData>(emptyTimetable());
  const [isDirty, setIsDirty]                 = useState(false);
  const [saveSuccess, setSaveSuccess]         = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .order('grade_level').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: async () => {
      const { data } = await supabase
        .from('academic_calendar')
        .select('term, academic_year')
        .eq('is_current', true)
        .maybeSingle();
      return data;
    },
  });

  // ── FIX: Auto-fill year from active term so admin can't type a mismatched value ──
  React.useEffect(() => {
    if (currentTerm?.academic_year && !selectedYear) {
      setSelectedYear(currentTerm.academic_year);
    }
  }, [currentTerm]);

  const { data: classAssignments } = useQuery({
    queryKey: ['class-assignments', selectedClassId],
    enabled: !!selectedClassId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_class_subjects')
        .select('*')
        .eq('class_id', selectedClassId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        subjectId:   row.subject_id,
        subjectName: row.subject_name,
        subjectCode: row.subject_code,
        teacherId:   row.teacher_id,
        teacherName: row.teacher_name,
      }));
    },
  });

  const { data: savedTimetable, isLoading: loadingSaved } = useQuery({
    queryKey: ['class-timetable', selectedClassId, selectedTerm, selectedYear],
    enabled: !!selectedClassId && !!selectedTerm && !!selectedYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_timetables')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('term', parseInt(selectedTerm))
        .eq('academic_year', selectedYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── FIX: onSuccess was removed in React Query v5 — use useEffect instead ──
  // This watches savedTimetable and populates the grid whenever it changes.
  React.useEffect(() => {
    if (loadingSaved) return; // wait until the query finishes
    if (savedTimetable?.timetable_data) {
      const empty = emptyTimetable();
      setTimetable({
        weekday: { ...empty.weekday, ...savedTimetable.timetable_data.weekday },
        weekend: { ...empty.weekend, ...savedTimetable.timetable_data.weekend },
      });
    } else if (savedTimetable === null) {
      // Query ran and found nothing — reset to blank
      setTimetable(emptyTimetable());
    }
    setIsDirty(false);
  }, [savedTimetable, loadingSaved]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('class_timetables')
        .upsert({
          class_id:       selectedClassId,
          term:           parseInt(selectedTerm),
          academic_year:  selectedYear,
          timetable_data: timetable,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'class_id,term,academic_year' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-timetable', selectedClassId, selectedTerm, selectedYear] });
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const updateWeekdayCell = (slotId: string, day: string, val: WeekdayCell | null) => {
    setTimetable(prev => ({
      ...prev,
      weekday: { ...prev.weekday, [slotId]: { ...prev.weekday[slotId], [day]: val } },
    }));
    setIsDirty(true);
  };

  const updateWeekendCell = (slotId: string, dayKey: 'saturday' | 'sunday', val: string) => {
    setTimetable(prev => ({
      ...prev,
      weekend: { ...prev.weekend, [slotId]: { ...prev.weekend[slotId], [dayKey]: val } },
    }));
    setIsDirty(true);
  };

  const selectedClass = useMemo(
    () => classes?.find((c: any) => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  const canEdit = !!selectedClassId && !!selectedTerm && !!selectedYear;

  const filledCells = useMemo(() => {
    let count = 0;
    WEEKDAY_SLOTS.filter(s => s.type === 'lesson').forEach(slot => {
      DAYS.forEach(day => { if (timetable.weekday[slot.id]?.[day]) count++; });
    });
    return count;
  }, [timetable]);

  const totalCells = WEEKDAY_SLOTS.filter(s => s.type === 'lesson').length * DAYS.length;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-600" />
            Timetable Builder
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Build and manage class timetables per term. Changes are saved to the database — no file uploads needed.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">

          {/* Selector bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl border">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</Label>
              <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setIsDirty(false); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select class…" />
                </SelectTrigger>
                <SelectContent>
                  {(classes || []).map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} <span className="text-gray-400 text-xs ml-1">({cls.grade_level})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Term
                {currentTerm && (
                  <span className="ml-2 text-green-600 normal-case font-normal">
                    (Current: Term {currentTerm.term})
                  </span>
                )}
              </Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select term…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Academic Year — auto-filled from active term, still manually editable */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Academic Year
                {currentTerm?.academic_year && (
                  <span className="ml-2 text-green-600 normal-case font-normal">
                    (Active: {currentTerm.academic_year})
                  </span>
                )}
              </Label>
              <Input
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                placeholder="e.g. 2026-2027"
                className="bg-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode(m => m === 'edit' ? 'view' : 'edit')}
                  disabled={!canEdit}
                >
                  {mode === 'edit'
                    ? <><Eye className="w-3.5 h-3.5 mr-1.5" />Preview</>
                    : <><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</>
                  }
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 transition-all ${saveSuccess ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-green-600 hover:bg-green-700'}`}
                  disabled={!canEdit || !isDirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending
                    ? 'Saving…'
                    : saveSuccess
                      ? <><Check className="w-3.5 h-3.5 mr-1" />Saved!</>
                      : <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>
                  }
                </Button>
              </div>
            </div>
          </div>

          {/* Status bar */}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              {loadingSaved ? (
                <span className="animate-pulse text-gray-400">Loading timetable…</span>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {filledCells}/{totalCells} weekday periods filled
                  </span>
                  {isDirty && (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                      Unsaved changes
                    </Badge>
                  )}
                  {!isDirty && savedTimetable && (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      ✓ Saved
                    </Badge>
                  )}
                  {classAssignments?.length === 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      No teacher assignments found for this class
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}

          {/* Placeholder */}
          {!canEdit && (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Select a class, term and academic year to get started</p>
              </CardContent>
            </Card>
          )}

          {/* Timetable tabs */}
          {canEdit && !loadingSaved && (
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="weekday">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />Weekday (Mon–Fri)
                </TabsTrigger>
                <TabsTrigger value="weekend">
                  <Users className="w-3.5 h-3.5 mr-1.5" />Weekend (Boarding)
                </TabsTrigger>
              </TabsList>

              {/* WEEKDAY TAB */}
              <TabsContent value="weekday" className="mt-4">
                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                  <table className="w-full min-w-[700px] border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                        <th className="text-left px-4 py-3 text-xs font-semibold w-28 rounded-tl-xl">Period</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold w-28">Time</th>
                        {DAYS.map((day, i) => (
                          <th key={day} className={`text-center px-2 py-3 text-xs font-semibold ${i === 4 ? 'rounded-tr-xl' : ''}`}>
                            <span className="hidden sm:inline">{day}</span>
                            <span className="sm:hidden">{SHORT_DAYS[i]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEKDAY_SLOTS.map((slot, idx) => {
                        const isBreak = slot.type === 'break';
                        const isLunch = slot.type === 'lunch';
                        const isFixed = isBreak || isLunch;

                        if (isFixed) {
                          return (
                            <tr key={slot.id} className={isBreak ? 'bg-amber-50' : 'bg-blue-50'}>
                              <td className="px-4 py-2">
                                <span className={`text-xs font-bold ${isBreak ? 'text-amber-600' : 'text-blue-600'}`}>
                                  {isBreak ? '☕ Break' : '🍽 Lunch'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-gray-400">{slot.time}</span>
                              </td>
                              <td colSpan={5} className="px-3 py-2 text-center">
                                <span className={`text-xs italic ${isBreak ? 'text-amber-400' : 'text-blue-400'}`}>
                                  {isBreak ? '— Break time —' : '— Lunch break —'}
                                </span>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={slot.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                            <td className="px-4 py-2">
                              <span className="text-xs font-semibold text-gray-700">{slot.label}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-gray-400 whitespace-nowrap">{slot.time}</span>
                            </td>
                            {DAYS.map(day => (
                              <td key={day} className="px-1.5 py-1.5 align-top">
                                {mode === 'edit' ? (
                                  <CellEditor
                                    value={timetable.weekday[slot.id]?.[day] ?? null}
                                    options={classAssignments || []}
                                    onChange={val => updateWeekdayCell(slot.id, day, val)}
                                  />
                                ) : (
                                  <div className={`px-2 py-1.5 rounded text-xs min-h-[48px] flex flex-col justify-center
                                    ${timetable.weekday[slot.id]?.[day]
                                      ? 'bg-green-50 border border-green-100'
                                      : 'bg-gray-50 border border-dashed border-gray-100'
                                    }`}
                                  >
                                    {timetable.weekday[slot.id]?.[day] ? (
                                      <>
                                        <div className="font-semibold text-green-800">
                                          {timetable.weekday[slot.id][day]!.subjectCode}
                                        </div>
                                        <div className="text-green-600 truncate">
                                          {timetable.weekday[slot.id][day]!.teacherName.split(' ').slice(-1)[0]}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-gray-300 text-center w-full">—</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {mode === 'edit' && (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" />
                      Assigned
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-gray-50 border border-dashed border-gray-200 inline-block" />
                      Empty — click to assign
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-50 border border-amber-100 inline-block" />
                      Break / Lunch (fixed)
                    </span>
                  </div>
                )}
              </TabsContent>

              {/* WEEKEND TAB */}
              <TabsContent value="weekend" className="mt-4">
                <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  🏠 Weekend timetable is for <strong>boarding students</strong>. Type any activity freely — games, preps, meals, church, etc.
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                  <table className="w-full min-w-[400px] border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        <th className="text-left px-4 py-3 text-xs font-semibold w-32 rounded-tl-xl">Time</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold">Saturday</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold rounded-tr-xl">Sunday</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEFAULT_WEEKEND_SLOTS.map((slot, idx) => (
                        <tr key={slot.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                          <td className="px-4 py-2">
                            <span className="text-xs text-gray-500 whitespace-nowrap">{slot.time}</span>
                          </td>
                          {(['saturday', 'sunday'] as const).map(dayKey => (
                            <td key={dayKey} className="px-2 py-1.5">
                              {mode === 'edit' ? (
                                <Input
                                  value={timetable.weekend[slot.id]?.[dayKey] ?? ''}
                                  onChange={e => updateWeekendCell(slot.id, dayKey, e.target.value)}
                                  placeholder="e.g. Games, Prep, Meals…"
                                  className="h-8 text-xs bg-white"
                                />
                              ) : (
                                <div className={`px-2 py-1.5 rounded text-xs min-h-[32px] flex items-center
                                  ${timetable.weekend[slot.id]?.[dayKey]
                                    ? 'bg-blue-50 border border-blue-100 text-blue-800'
                                    : 'text-gray-300'
                                  }`}
                                >
                                  {timetable.weekend[slot.id]?.[dayKey] || '—'}
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Save error */}
          {saveMutation.isError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Failed to save: {(saveMutation.error as any)?.message}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}