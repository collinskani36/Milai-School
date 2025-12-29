import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Textarea } from "@/Components/ui/textarea";
import { Save, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/Components/ui/checkbox";

export default function FeeStructureForm({ fee, onSave, onCancel, isLoading }) {
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);

  // ✅ FIXED — Properly initialize formData
  const [formData, setFormData] = useState({
    name: fee?.name || "",
    amount: fee?.amount || "",
    term: fee?.term || "Term 1",
    academic_year: fee?.academic_year || "2024-2025",
    category: fee?.category || "Mandatory",
    student_type: fee?.student_type || "Day Scholar",
    description: fee?.description || ""
  });

  // Load classes + selected classes when editing
  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from("classes").select("*");
      if (data) setClasses(data);

      if (fee?.classes) {
        setSelectedClasses(fee.classes.map(c => c.class_id));
      }
    };

    fetchClasses();
  }, [fee]);

  // ✅ ENSURE student_type loads correctly when editing
  useEffect(() => {
    if (fee) {
      setFormData(prev => ({
        ...prev,
        student_type: fee.student_type || "Day Scholar"
      }));
    }
  }, [fee]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      amount: Number(formData.amount),
      student_type: formData.student_type
    };

    if (selectedClasses.length > 0) {
      submitData.classes = selectedClasses;
    }

    console.log("SUBMITTING FEE DATA:", submitData);

    onSave(submitData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleClass = (id) => {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-gray-100">
        <CardTitle className="text-xl font-semibold text-gray-900">
          {fee ? "Edit Fee Structure" : "Add New Fee"}
        </CardTitle>
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
                onChange={(e) => handleChange("name", e.target.value)}
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
                onChange={(e) => handleChange("amount", e.target.value)}
                required
              />
            </div>

            {/* Term */}
            <div className="space-y-2">
              <Label>Term</Label>
              <Select
                value={formData.term}
                onValueChange={(value) => handleChange("term", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1">Term 1</SelectItem>
                  <SelectItem value="Term 2">Term 2</SelectItem>
                  <SelectItem value="Term 3">Term 3</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Academic Year */}
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select
                value={formData.academic_year}
                onValueChange={(value) => handleChange("academic_year", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>
                  <SelectItem value="2025-2026">2025-2026</SelectItem>
                  <SelectItem value="2026-2027">2026-2027</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mandatory">Mandatory</SelectItem>
                  <SelectItem value="Optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Student Type */}
            <div className="space-y-2">
              <Label>Student Type</Label>
              <Select
                value={formData.student_type}
                onValueChange={(value) => handleChange("student_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day Scholar">Day Scholar</SelectItem>
                  <SelectItem value="Boarding">Boarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Class Multiselect */}
          <div className="space-y-2">
            <Label>Applicable Classes</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className="flex items-center gap-2 border p-2 rounded-md cursor-pointer"
                >
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
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              {fee ? "Update Fee" : "Add Fee"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
