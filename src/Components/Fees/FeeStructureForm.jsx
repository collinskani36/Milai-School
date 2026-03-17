import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Textarea } from "@/Components/ui/textarea";
import { Save, X, CalendarDays, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/Components/ui/checkbox";
import { Badge } from "@/Components/ui/badge";
import { useActiveTerm, termLabel } from "@/hooks/useActiveTerm";

export default function FeeStructureForm({ fee, onSave, onCancel, isLoading }) {
  const { data: activeTerm, isLoading: termLoading } = useActiveTerm();

  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);

  // Resolve initial term/year: editing → use existing values; creating → use active term
  const initialTerm = fee?.term ?? (activeTerm ? termLabel(activeTerm) : 'Term 1');
  const initialYear = fee?.academic_year ?? activeTerm?.academic_year ?? '2024-2025';

  const [formData, setFormData] = useState({
    name:          fee?.name          || '',
    amount:        fee?.amount        || '',
    term:          initialTerm,
    academic_year: initialYear,
    category:      fee?.category      || 'Mandatory',
    student_type:  fee?.student_type  || 'Day Scholar',
    description:   fee?.description   || '',
  });

  // Once activeTerm loads, back-fill term/year IF we're in create mode and
  // the user hasn't already changed those fields manually.
  useEffect(() => {
    if (!fee && activeTerm) {
      setFormData(prev => ({
        ...prev,
        term:          termLabel(activeTerm),
        academic_year: activeTerm.academic_year,
      }));
    }
  }, [activeTerm, fee]);

  // When switching to edit mode, ensure student_type is correct
  useEffect(() => {
    if (fee) {
      setFormData(prev => ({
        ...prev,
        student_type:  fee.student_type  ?? 'Day Scholar',
        term:          fee.term          ?? prev.term,
        academic_year: fee.academic_year ?? prev.academic_year,
      }));
    }
  }, [fee]);

  // Load classes list and pre-select classes when editing
  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from('classes').select('*');
      if (data) setClasses(data);
      if (fee?.classes) {
        setSelectedClasses(fee.classes.map(c => (typeof c === 'string' ? c : c.class_id)));
      }
    };
    fetchClasses();
  }, [fee]);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      amount: Number(formData.amount),
    };
    if (selectedClasses.length > 0) submitData.classes = selectedClasses;
    onSave(submitData);
  };

  const toggleClass = (id) =>
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  // Whether term/year controls are locked to the active term (create mode only)
  const lockedToActiveTerm = !fee && !!activeTerm;

  // Dynamic year options — always include the active term's year so it's selectable
  const yearOptions = Array.from(new Set([
    '2024-2025', '2025-2026', '2026-2027',
    ...(activeTerm ? [activeTerm.academic_year] : []),
  ])).sort();

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-900">
            {fee ? 'Edit Fee Structure' : 'Add New Fee'}
          </CardTitle>

          {/* Active term indicator */}
          {termLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading term…
            </div>
          ) : activeTerm ? (
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <CalendarDays className="w-3.5 h-3.5" />
              Active: {termLabel(activeTerm)}, {activeTerm.academic_year}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
              ⚠ No active term set
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Fee Name */}
            <div className="space-y-2">
              <Label>Fee Name</Label>
              <Input
                placeholder="e.g., Tuition Fee"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                required
              />
            </div>

            {/* Term */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Term</Label>
                {lockedToActiveTerm && (
                  <span className="text-[10px] text-blue-500 font-medium">Auto-filled from calendar</span>
                )}
              </div>
              {lockedToActiveTerm ? (
                /* Read-only pill when locked to active term */
                <div className="flex h-10 w-full items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-800 font-medium gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  {formData.term}
                  <span className="ml-auto text-xs text-blue-400 font-normal">locked</span>
                </div>
              ) : (
                <Select value={formData.term} onValueChange={(v) => handleChange('term', v)}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                    <SelectItem value="Annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Academic Year */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Academic Year</Label>
                {lockedToActiveTerm && (
                  <span className="text-[10px] text-blue-500 font-medium">Auto-filled from calendar</span>
                )}
              </div>
              {lockedToActiveTerm ? (
                <div className="flex h-10 w-full items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-blue-800 font-medium gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  {formData.academic_year}
                  <span className="ml-auto text-xs text-blue-400 font-normal">locked</span>
                </div>
              ) : (
                <Select value={formData.academic_year} onValueChange={(v) => handleChange('academic_year', v)}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mandatory">Mandatory</SelectItem>
                  <SelectItem value="Optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Student Type */}
            <div className="space-y-2">
              <Label>Student Type</Label>
              <Select value={formData.student_type} onValueChange={(v) => handleChange('student_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select student type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day Scholar">Day Scholar</SelectItem>
                  <SelectItem value="Boarding">Boarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* No active term warning — shown in create mode only */}
          {!fee && !termLoading && !activeTerm && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <CalendarDays className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                No active academic term is set. Please go to{' '}
                <strong>Academic Calendar</strong> and activate a term before creating
                fee structures, or select term and year manually below.
              </span>
            </div>
          )}

          {/* Class Multiselect */}
          <div className="space-y-2">
            <Label>Applicable Classes</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {classes.map((cls) => (
                <label key={cls.id} className="flex items-center gap-2 border p-2 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                  <Checkbox
                    checked={selectedClasses.includes(cls.id)}
                    onCheckedChange={() => toggleClass(cls.id)}
                  />
                  {cls.name}
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Fee description..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4 mr-2" />{fee ? 'Update Fee' : 'Add Fee'}</>
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}