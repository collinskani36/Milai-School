// src/Components/Library/TeacherLibrary.tsx
import React, { useState } from 'react';
import { Library, Upload } from 'lucide-react';
import StudentLibrary from './StudentLibrary';
import LibraryManager from './LibraryManager';

const MAROON = '#7a1f2b';

interface Props {
  teacherId: string;
  teacherClasses: any[]; // rows from teacher_classes (with classes + subjects)
}

export default function TeacherLibrary({ teacherId, teacherClasses }: Props) {
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');

  const tabs = [
    { id: 'browse', label: 'Browse', icon: Library },
    { id: 'mine', label: 'My uploads', icon: Upload },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="inline-flex p-1 gap-1 rounded-xl bg-white border border-[#7a1f2b]/15">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                active ? 'text-white' : 'text-[#7a1f2b] hover:bg-[#7a1f2b]/5'
              }`}
              style={active ? { background: MAROON } : undefined}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'browse' ? (
        // classId null: no "own grade" default for teachers, they start on All grades
        <StudentLibrary classId={null} hideHero />
      ) : (
        <LibraryManager mode="teacher" teacherId={teacherId} teacherClasses={teacherClasses} />
      )}
    </div>
  );
}