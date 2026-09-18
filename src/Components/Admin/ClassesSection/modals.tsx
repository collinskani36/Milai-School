// src/Components/Admin/ClassesSection/modals.tsx
import React from 'react';
import {
  BookOpen, Users, GraduationCap, Plus, Pencil, Trash2,
  X, CheckSquare, Square, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Card, CardContent } from '@/Components/ui/card';
import { Checkbox } from '@/Components/ui/checkbox';
import { Badge } from '@/Components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/Components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import {
  SectionErrorBoundary, DialogHero, GRADIENT_BTN_STYLE, CARD_SHADOW,
  type ClassRecord, type SubjectRecord, type StudentInClass,
  type AssignedSubjectRow, type AcademicTerm,
  type PromotionStatus, type DbPromotionStatus, type PromotionDecision,
} from './shared';

// ═════════════════════════════════════════════════════════════════════════════
// 1. ClassModal
// ═════════════════════════════════════════════════════════════════════════════
export function ClassModal({
  open, onClose, editingClass, uniqueStages, onSubmit,
}: {
  open: boolean; onClose: () => void; editingClass: ClassRecord | null;
  uniqueStages: string[]; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
        <DialogHero
          icon={editingClass ? Pencil : Plus}
          microLabel={editingClass ? 'Update' : 'New'}
          title={editingClass ? 'Edit Class' : 'Add New Class'}
        />
        <form onSubmit={onSubmit} className="p-4 sm:p-5">
          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Class Name</Label>
              <Input id="name" name="name" placeholder="e.g., Form 1A, Grade 2B"
                defaultValue={editingClass?.name} required
                className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade_level" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Grade Level</Label>
              <Select name="grade_level" defaultValue={editingClass?.grade_level} required>
                <SelectTrigger className="h-10 rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select grade level" /></SelectTrigger>
                <SelectContent>
                  {uniqueStages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
            <Button type="button" variant="outline" onClick={onClose}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button type="submit" className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
              {editingClass ? 'Update' : 'Create'} Class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. GradeLevelModal
// ═════════════════════════════════════════════════════════════════════════════
export function GradeLevelModal({
  open, onClose, onSubmit, isCreating,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; isCreating: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
        <DialogHero icon={GraduationCap} microLabel="New" title="Add New Grade Level" />
        <form onSubmit={onSubmit} className="p-4 sm:p-5">
          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="stage" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Stage Name</Label>
              <Input id="stage" name="stage" placeholder="e.g., Kindergarten, Lower Primary" required
                className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              <p className="text-[11px] text-muted-foreground">Displayed in class overview and dropdowns</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade" className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Grade Description</Label>
              <Input id="grade" name="grade" placeholder="e.g., PP1-PP3, Grade 1-3" required
                className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
              <p className="text-[11px] text-muted-foreground">For internal reference only</p>
            </div>
          </div>
          <DialogFooter className="flex gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
            <Button type="button" variant="outline" onClick={onClose}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button type="submit" className="h-10 rounded-xl text-white border-0 active:scale-[0.98]"
              style={GRADIENT_BTN_STYLE} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create Grade Level'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. SubjectModal
// ═════════════════════════════════════════════════════════════════════════════
export function SubjectModal({
  open, onClose, editingSubject, onSubmit,
}: {
  open: boolean; onClose: () => void; editingSubject: SubjectRecord | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
        <DialogHero
          icon={editingSubject ? Pencil : Plus}
          microLabel={editingSubject ? 'Update' : 'New'}
          title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
        />
        <form onSubmit={onSubmit} className="p-4 sm:p-5">
          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Subject Name</Label>
              <Input name="name" placeholder="e.g., Mathematics" defaultValue={editingSubject?.name} required
                className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">Subject Code</Label>
              <Input name="code" placeholder="e.g., MATH" defaultValue={editingSubject?.code} required
                className="h-10 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" />
            </div>
          </div>
          <DialogFooter className="flex gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
            <Button type="button" variant="outline" onClick={onClose}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button type="submit" className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
              {editingSubject ? 'Update' : 'Create'} Subject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. AssignSubjectsModal
// ═════════════════════════════════════════════════════════════════════════════
export function AssignSubjectsModal({
  open, onClose, selectedClass, subjects,
  selectedSubjects, optionalSubjects, onSubjectSelection, onOptionalToggle, onSubmit,
}: {
  open: boolean; onClose: () => void; selectedClass: ClassRecord | null;
  subjects: SubjectRecord[]; selectedSubjects: string[]; optionalSubjects: string[];
  onSubjectSelection: (id: string) => void; onOptionalToggle: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
        <DialogHero
          icon={BookOpen}
          microLabel="Curriculum"
          title="Assign Subjects"
          subtitle={selectedClass?.name}
        />
        <div className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground mb-3">Select subjects and mark optional ones for this class</p>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-[#7a1f2b]/10">
            <div className="grid grid-cols-1 divide-y divide-[#7a1f2b]/8">
              {subjects.map((subject) => {
                const isSelected = selectedSubjects.includes(subject.id);
                const isOptional = optionalSubjects.includes(subject.id);
                return (
                  <div key={subject.id} className="flex items-center justify-between p-3 hover:bg-[#7a1f2b]/[0.03]">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Checkbox id={`s-${subject.id}`} checked={isSelected}
                        onCheckedChange={() => onSubjectSelection(subject.id)} />
                      <Label htmlFor={`s-${subject.id}`} className="flex-1 cursor-pointer min-w-0">
                        <div className="flex justify-between items-center gap-3">
                          <span className="font-medium text-[#3a1b1f] truncate">{subject.name}</span>
                          <span className="text-[11px] font-mono text-muted-foreground bg-[#7a1f2b]/8 px-1.5 py-0.5 rounded shrink-0">
                            {subject.code}
                          </span>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 ml-4 shrink-0">
                      <Checkbox id={`o-${subject.id}`} checked={isOptional}
                        onCheckedChange={() => onOptionalToggle(subject.id)} disabled={!isSelected} />
                      <Label htmlFor={`o-${subject.id}`}
                        className={`text-sm ${!isSelected ? 'text-muted-foreground/50' : 'text-[#3a1b1f]'}`}>
                        Optional
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="flex gap-3 pt-4 mt-4 border-t border-[#7a1f2b]/10">
            <Button type="button" variant="outline" onClick={onClose}
              className="h-10 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit}
              className="h-10 rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}>
              Assign Subjects
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ClassDetailModal
// ═════════════════════════════════════════════════════════════════════════════
export function ClassDetailModal({
  open, onClose, selectedClass, classStudents, loadingStudents,
  assignedSubjects, onRemoveStudent, onRemoveSubject, onAssignSubjects, onPromote,
}: {
  open: boolean; onClose: () => void; selectedClass: ClassRecord | null;
  classStudents: StudentInClass[] | undefined; loadingStudents: boolean;
  assignedSubjects: AssignedSubjectRow[] | undefined;
  onRemoveStudent: (enrollmentId: string, name: string) => void;
  onRemoveSubject: (assignmentId: string, name: string) => void;
  onAssignSubjects: () => void;
  onPromote: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border-[#7a1f2b]/15">
        <DialogHero
          icon={BookOpen}
          microLabel="Class Detail"
          title={selectedClass?.name ?? ''}
          subtitle={selectedClass?.grade_level}
        />
        <div className="p-4 sm:p-5 space-y-4 bg-[#fdfbfb]">
          {/* Class Information */}
          <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h4 className="font-semibold text-[#3a1b1f] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#7a1f2b]" /> Class Information
                  </h4>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm"
                    className="h-9 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-[0.98]"
                    onClick={onPromote}
                    disabled={(selectedClass?.studentCount ?? 0) === 0}>
                    <GraduationCap className="w-4 h-4 mr-1.5" />Promote / Transfer
                  </Button>
                  <Button variant="outline" size="sm"
                    className="h-9 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]"
                    onClick={onAssignSubjects}>
                    <BookOpen className="w-4 h-4 mr-1.5" />Manage Subjects
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Grade Level</Label>
                  <p className="text-sm text-[#3a1b1f] mt-0.5">{selectedClass?.grade_level}</p>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Student Count</Label>
                  <p className="text-sm text-[#3a1b1f] mt-0.5">{selectedClass?.studentCount} students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students */}
          <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
            <CardContent className="p-4">
              <h4 className="font-semibold text-[#3a1b1f] flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[#7a1f2b]" /> Students in Class ({classStudents?.length ?? 0})
              </h4>
              {loadingStudents ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(122,31,43,0.06)' }} />
                  ))}
                </div>
              ) : classStudents && classStudents.length > 0 ? (
                <div className="rounded-xl border border-[#7a1f2b]/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                        <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Reg No</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Name</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Gender</TableHead>
                        <TableHead className="w-[100px] text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classStudents.map((student) => (
                        <TableRow key={student.enrollmentId}
                          className="border-b border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.03] transition-colors">
                          <TableCell className="font-mono text-sm font-medium text-[#7a1f2b]/80">{student.reg_no}</TableCell>
                          <TableCell className="text-[#3a1b1f] font-medium">{student.first_name} {student.last_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize border-[#7a1f2b]/15 text-[#7a1f2b]">{student.gender}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 active:scale-95"
                              onClick={() => onRemoveStudent(student.enrollmentId, `${student.first_name} ${student.last_name}`)}
                              title="Remove from class">
                              <X className="w-4 h-4 text-red-500/80" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto mb-3 text-[#7a1f2b]/15" />
                  <p className="text-sm text-muted-foreground">No students enrolled in this class</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Subjects */}
          <Card className="rounded-2xl border border-[#7a1f2b]/10 bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
            <CardContent className="p-4">
              <h4 className="font-semibold text-[#3a1b1f] flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-[#7a1f2b]" /> Assigned Subjects
              </h4>
              {assignedSubjects && assignedSubjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assignedSubjects.map((assignment) => (
                    <div key={assignment.id}
                      className="rounded-xl border border-[#7a1f2b]/10 bg-[#fdfbfb] p-3 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-[#3a1b1f] truncate">{assignment.subjects?.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">Code: {assignment.subjects?.code}</p>
                        {assignment.is_optional && (
                          <Badge className="bg-[#7a1f2b]/10 text-[#7a1f2b] border-[#7a1f2b]/20 text-[10px] mt-1.5">Optional</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 active:scale-95 shrink-0"
                        onClick={() => onRemoveSubject(assignment.id, assignment.subjects?.name ?? '')}>
                        <X className="w-3.5 h-3.5 text-red-500/80" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 text-[#7a1f2b]/15" />
                  <p className="text-sm text-muted-foreground">No subjects assigned to this class</p>
                  <Button variant="outline" className="mt-4 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]"
                    onClick={onAssignSubjects}>
                    <Plus className="w-4 h-4 mr-1.5" />Assign Subjects
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. PromotionModal
// ═════════════════════════════════════════════════════════════════════════════
export function PromotionModal({
  open, onClose, promotionClass, otherClasses, currentTerm,
  promotionStudents, loadingStudents, onComplete,
}: {
  open: boolean;
  onClose: () => void;
  promotionClass: ClassRecord | null;
  otherClasses: ClassRecord[];
  currentTerm: AcademicTerm | null;
  promotionStudents: StudentInClass[] | undefined;
  loadingStudents: boolean;
  onComplete: () => void;
}) {
  const [decisions, setDecisions] = React.useState<Record<string, PromotionDecision>>({});
  const [selectedForBulk, setSelectedForBulk] = React.useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = React.useState<PromotionStatus>('promoted');
  const [bulkToClassId, setBulkToClassId] = React.useState('');
  const [runningPromotion, setRunningPromotion] = React.useState(false);
  const [promotionDone, setPromotionDone] = React.useState(false);
  const [promotionResult, setPromotionResult] = React.useState<Record<PromotionStatus, number> | null>(null);
  const [promotionError, setPromotionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDecisions({});
    setSelectedForBulk([]);
    setBulkStatus('promoted');
    setBulkToClassId('');
    setPromotionDone(false);
    setPromotionResult(null);
    setPromotionError(null);
  }, [open, promotionClass?.id]);

  React.useEffect(() => {
    if (!open || !promotionStudents?.length || !promotionClass?.id) return;
    setDecisions((prev) => {
      const next = { ...prev };
      promotionStudents.forEach((s) => {
        if (!next[s.id]) {
          next[s.id] = {
            studentId: s.id,
            enrollmentId: s.enrollmentId,
            studentName: `${s.first_name} ${s.last_name}`,
            status: 'promoted',
            toClassId: '',
            transferSchool: '',
          };
        }
      });
      const currentStudentIds = new Set(promotionStudents.map((s) => s.id));
      Object.keys(next).forEach((id) => { if (!currentStudentIds.has(id)) delete next[id]; });
      return next;
    });
  }, [open, promotionStudents, promotionClass?.id]);

  const setStudentDecision = (studentId: string, update: Partial<PromotionDecision>) => {
    setDecisions((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...update } }));
  };

  const allSelected = !!(promotionStudents?.length && selectedForBulk.length === promotionStudents.length);
  const toggleSelectAll = () => {
    if (!promotionStudents) return;
    setSelectedForBulk(allSelected ? [] : promotionStudents.map((s) => s.id));
  };
  const toggleSelectOne = (studentId: string) => {
    setSelectedForBulk((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };
  const applyBulkAction = () => {
    if (selectedForBulk.length === 0) return;
    setDecisions((prev) => {
      const next = { ...prev };
      selectedForBulk.forEach((id) => {
        next[id] = {
          ...next[id],
          status: bulkStatus,
          toClassId: bulkStatus === 'promoted' ? bulkToClassId : '',
          transferSchool: '',
        };
      });
      return next;
    });
    setSelectedForBulk([]);
    setBulkToClassId('');
  };

  const invalidDecisions = Object.values(decisions).filter(
    (d) => d?.status === 'promoted' && !d.toClassId
  );
  const promoCounts: Record<PromotionStatus, number> = { promoted: 0, retained: 0, graduated: 0, transferred: 0 };
  Object.values(decisions).forEach((d) => { if (d) promoCounts[d.status]++; });

  const runPromotion = async () => {
    if (!promotionClass) return;
    if (invalidDecisions.length > 0) {
      setPromotionError(`${invalidDecisions.length} student(s) marked "Promote" have no destination class selected.`);
      return;
    }
    setRunningPromotion(true);
    setPromotionError(null);

    const year = currentTerm?.academic_year ?? String(new Date().getFullYear());
    const toDbStatus = (s: PromotionStatus): DbPromotionStatus => (s === 'transferred' ? 'withdrawn' : s);

    const promotionRows = Object.values(decisions).map((d) => ({
      student_id: d.studentId,
      from_class_id: promotionClass.id,
      to_class_id: d.status === 'promoted' ? d.toClassId : null,
      academic_year: year,
      status: toDbStatus(d.status),
      notes: d.status === 'transferred'
        ? `Transfer to: ${d.transferSchool?.trim() || 'Unknown school'}`
        : undefined,
    }));

    const { error: promoErr } = await supabase
      .from('student_promotions')
      .upsert(promotionRows, { onConflict: 'student_id,academic_year' });

    if (promoErr) {
      setPromotionError(promoErr.message);
      setRunningPromotion(false);
      return;
    }

    const promoted = Object.values(decisions).filter((d) => d.status === 'promoted');
    await Promise.all(
      promoted.map((d) =>
        supabase.from('enrollments').update({ class_id: d.toClassId }).eq('student_id', d.studentId)
      )
    );

    const toRemove = Object.values(decisions).filter(
      (d) => d.status === 'transferred' || d.status === 'graduated'
    );
    if (toRemove.length > 0) {
      await supabase.from('enrollments').delete().in('student_id', toRemove.map((d) => d.studentId));
    }

    const counts: Record<PromotionStatus, number> = { promoted: 0, retained: 0, graduated: 0, transferred: 0 };
    Object.values(decisions).forEach((d) => counts[d.status]++);

    setPromotionResult(counts);
    setRunningPromotion(false);
    setPromotionDone(true);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0 overflow-hidden rounded-2xl border-[#7a1f2b]/15">
        <DialogHero
          icon={GraduationCap}
          microLabel="End of Year"
          title={`Promote / Transfer — ${promotionClass?.name ?? ''}`}
          subtitle={currentTerm
            ? `Term ${currentTerm.term}, ${currentTerm.academic_year}`
            : 'No active term — current calendar year will be recorded'}
        />

        {promotionDone && promotionResult ? (
          <div className="flex flex-col items-center py-10 gap-5 px-5">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'rgba(122,31,43,0.08)' }}>🎉</div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#3a1b1f]">Promotion Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1">All decisions saved and enrollments updated.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-md">
              {([
                { key: 'promoted',    label: 'Promoted',    color: 'text-blue-600' },
                { key: 'retained',    label: 'Retained',    color: 'text-amber-600' },
                { key: 'graduated',   label: 'Graduated',   color: 'text-emerald-600' },
                { key: 'transferred', label: 'Transferred', color: 'text-red-600' },
              ] as { key: PromotionStatus; label: string; color: string }[]).map(({ key, label, color }) => (
                <div key={key} className="text-center bg-[#fdfbfb] rounded-xl p-3 border border-[#7a1f2b]/10">
                  <p className={`text-2xl font-bold ${color}`}>{promotionResult[key]}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]"
                onClick={onClose}>Close</Button>
              <Button className="rounded-xl text-white border-0 active:scale-[0.98]" style={GRADIENT_BTN_STYLE}
                onClick={() => { setPromotionDone(false); setPromotionResult(null); }}>
                Run Again / Correct
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4 bg-white">
            <div className="rounded-xl px-3 py-2 text-xs text-[#7a1f2b] leading-relaxed border border-[#7a1f2b]/15"
              style={{ background: 'rgba(122,31,43,0.04)' }}>
              <strong>⬆ Promote</strong> — move to another class &nbsp;·&nbsp;
              <strong>↺ Retain</strong> — stays in same class &nbsp;·&nbsp;
              <strong>🎓 Graduate</strong> — leaves school, removed from rolls &nbsp;·&nbsp;
              <strong>🚌 Transfer</strong> — moving to another school
            </div>

            <div className="rounded-xl p-3 border border-[#7a1f2b]/10 bg-[#fdfbfb] flex items-center gap-3 flex-wrap">
              <button onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-sm text-[#3a1b1f] hover:text-[#7a1f2b] font-medium active:scale-[0.98]">
                {allSelected ? <CheckSquare className="h-4 w-4 text-[#7a1f2b]" /> : <Square className="h-4 w-4 text-[#7a1f2b]/40" />}
                {allSelected ? 'Deselect All' : `Select All (${promotionStudents?.length ?? 0})`}
              </button>

              {selectedForBulk.length > 0 && (
                <>
                  <span className="text-[#7a1f2b]/20">|</span>
                  <span className="text-xs text-muted-foreground font-medium">{selectedForBulk.length} selected</span>
                  <span className="text-[#7a1f2b]/20">|</span>
                  <span className="text-xs text-[#3a1b1f] font-medium">Apply to selected:</span>
                  <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as PromotionStatus)}>
                    <SelectTrigger className="h-8 w-36 text-xs rounded-lg border-[#7a1f2b]/15"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promoted">⬆ Promote</SelectItem>
                      <SelectItem value="retained">↺ Retain</SelectItem>
                      <SelectItem value="graduated">🎓 Graduate</SelectItem>
                      <SelectItem value="transferred">🚌 Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  {bulkStatus === 'promoted' && (
                    <Select value={bulkToClassId} onValueChange={setBulkToClassId}>
                      <SelectTrigger className="h-8 w-48 text-xs rounded-lg border-[#7a1f2b]/15">
                        <SelectValue placeholder="Select destination class" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherClasses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm"
                    className="h-8 text-xs rounded-lg text-white border-0 active:scale-[0.98]"
                    style={GRADIENT_BTN_STYLE}
                    onClick={applyBulkAction}
                    disabled={bulkStatus === 'promoted' && !bulkToClassId}>
                    Apply to {selectedForBulk.length} student{selectedForBulk.length !== 1 ? 's' : ''}
                  </Button>
                </>
              )}

              <div className="ml-auto flex gap-3 text-xs font-medium">
                <span className="text-blue-600">{promoCounts.promoted} promote</span>
                <span className="text-amber-600">{promoCounts.retained} retain</span>
                <span className="text-red-600">{promoCounts.transferred} transfer</span>
                <span className="text-emerald-600">{promoCounts.graduated} graduate</span>
              </div>
            </div>

            <SectionErrorBoundary fallback="Error rendering student list — please close and retry">
              {loadingStudents ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(122,31,43,0.06)' }} />
                  ))}
                </div>
              ) : !promotionStudents || promotionStudents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No students enrolled in this class.</div>
              ) : (
                <div className="rounded-xl border border-[#7a1f2b]/10 overflow-hidden">
                  <div className="max-h-[380px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b border-[#7a1f2b]/10">
                          <TableHead className="w-10" />
                          <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Student</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Reg No</TableHead>
                          <TableHead className="w-48 text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Decision</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider text-[#7a1f2b]/60 font-semibold">Destination / Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promotionStudents.map((student) => {
                          const d: PromotionDecision = decisions[student.id] ?? {
                            studentId: student.id, enrollmentId: student.enrollmentId,
                            studentName: `${student.first_name} ${student.last_name}`,
                            status: 'promoted', toClassId: '', transferSchool: '',
                          };
                          const isSelected = selectedForBulk.includes(student.id);
                          return (
                            <TableRow key={student.id}
                              className={`border-b border-[#7a1f2b]/5 transition-colors ${isSelected ? 'bg-[#7a1f2b]/[0.04]' : 'hover:bg-[#7a1f2b]/[0.02]'}`}>
                              <TableCell>
                                <button onClick={() => toggleSelectOne(student.id)} className="active:scale-90">
                                  {isSelected
                                    ? <CheckSquare className="h-4 w-4 text-[#7a1f2b]" />
                                    : <Square className="h-4 w-4 text-[#7a1f2b]/30 hover:text-[#7a1f2b]/60" />}
                                </button>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                    style={GRADIENT_BTN_STYLE}>
                                    {(student.first_name?.[0] ?? '') + (student.last_name?.[0] ?? '')}
                                  </div>
                                  <span className="font-medium text-sm text-[#3a1b1f]">
                                    {student.first_name} {student.last_name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{student.reg_no}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {([
                                    { s: 'promoted',    emoji: '⬆', title: 'Promote' },
                                    { s: 'retained',    emoji: '↺', title: 'Retain' },
                                    { s: 'graduated',   emoji: '🎓', title: 'Graduate' },
                                    { s: 'transferred', emoji: '🚌', title: 'Transfer' },
                                  ] as { s: PromotionStatus; emoji: string; title: string }[]).map(({ s, emoji, title }) => (
                                    <button key={s} title={title}
                                      onClick={() => setStudentDecision(student.id, { status: s, toClassId: '', transferSchool: '' })}
                                      className={`text-xs px-2 py-1 rounded-lg border transition-all font-medium active:scale-95 ${
                                        d.status === s
                                          ? 'border-transparent text-white shadow-sm'
                                          : 'border-[#7a1f2b]/15 text-[#7a1f2b]/60 hover:border-[#7a1f2b]/40 hover:text-[#7a1f2b] bg-white'
                                      }`}
                                      style={d.status === s ? GRADIENT_BTN_STYLE : undefined}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                {d.status === 'promoted' && (
                                  <select
                                    className={`text-xs border rounded-lg px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-[#7a1f2b]/30 ${
                                      !d.toClassId ? 'border-red-300' : 'border-[#7a1f2b]/15'
                                    }`}
                                    value={d.toClassId ?? ''}
                                    onChange={(e) => setStudentDecision(student.id, { toClassId: e.target.value })}
                                  >
                                    <option value="">— Select class —</option>
                                    {otherClasses.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name} ({c.grade_level})</option>
                                    ))}
                                  </select>
                                )}
                                {d.status === 'transferred' && (
                                  <Input className="text-xs h-8 rounded-lg border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
                                    placeholder="School name (optional)"
                                    value={d.transferSchool ?? ''}
                                    onChange={(e) => setStudentDecision(student.id, { transferSchool: e.target.value })} />
                                )}
                                {d.status === 'retained' && (
                                  <span className="text-xs text-amber-600">Stays in {promotionClass?.name}</span>
                                )}
                                {d.status === 'graduated' && (
                                  <span className="text-xs text-emerald-600">Removed from rolls</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </SectionErrorBoundary>

            {promotionError && (
              <div className="p-3 rounded-xl text-sm text-red-700 flex items-center gap-2 border border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 shrink-0" />{promotionError}
              </div>
            )}
            {invalidDecisions.length > 0 && (
              <div className="p-3 rounded-xl text-xs text-amber-700 border border-amber-200 bg-amber-50">
                ⚠ {invalidDecisions.length} student(s) marked &quot;Promote&quot; still need a destination class.
              </div>
            )}

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-3 border-t border-[#7a1f2b]/10">
              <Button variant="outline" onClick={onClose} disabled={runningPromotion}
                className="rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 active:scale-[0.98]">
                Cancel
              </Button>
              <Button
                className="rounded-xl text-white border-0 active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700"
                onClick={runPromotion}
                disabled={runningPromotion || loadingStudents || !promotionStudents?.length || invalidDecisions.length > 0}
              >
                {runningPromotion ? 'Processing…' : `Confirm & Apply (${promotionStudents?.length ?? 0} students)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════ END OF FILE — you should see this line ══════════════════