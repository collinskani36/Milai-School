import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Bell,
  TrendingUp,
} from 'lucide-react';
import StatsCard from './StatsCard';
import { Skeleton } from '@/Components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { format } from 'date-fns';

export default function OverviewSection({ setActiveView }) {
  // 🧠 Supabase Query Functions
  const fetchTable = async (table: string, limit?: number) => {
    let query = supabase.from(table).select('*');
    if (limit) query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  // 👩‍🎓 Students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => fetchTable('students'),
  });

  // 👩‍🏫 Teachers
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => fetchTable('teachers'),
  });

  // 📚 Classes
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => fetchTable('classes'),
  });

  // 🧾 Subjects
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => fetchTable('subjects'),
  });

  // 🔔 Announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => fetchTable('announcements', 5),
  });

  // 📈 Assessments
  const { data: assessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => fetchTable('assessments', 1),
  });

  const isLoading =
    loadingStudents || loadingTeachers || loadingClasses || loadingSubjects;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Students"
          value={students.length}
          icon={Users}
          color="bg-blue-500"
          trend={`${students.filter(
            (s) =>
              s.created_date &&
              new Date(s.created_at) >
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length} new this month`}
          onClick={() => setActiveView('students')}
        />
        <StatsCard
          title="Total Teachers"
          value={teachers.length}
          icon={GraduationCap}
          color="bg-purple-500"
          trend={`${teachers.filter((t) => t.is_admin).length} admins`}
          onClick={() => setActiveView('teachers')}
        />
        <StatsCard
          title="Active Classes"
          value={classes.length}
          icon={BookOpen}
          color="bg-green-500"
          onClick={() => setActiveView('classes')}
        />
        <StatsCard
          title="Subjects"
          value={subjects.length}
          icon={ClipboardList}
          color="bg-orange-500"
          onClick={() => setActiveView('classes')}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Recent Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">
                          {announcement.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {announcement.content?.substring(0, 80)}...
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          announcement.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : announcement.priority === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {announcement.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {announcement.created_date
                        ? format(new Date(announcement.created_at), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">No announcements yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Latest Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.length > 0 ? (
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                <p className="font-semibold text-gray-900">{assessments[0].title}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Term {assessments[0].term} • {assessments[0].year}
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  Uploaded{' '}
                  {assessments[0].created_date
                    ? format(new Date(assessments[0].created_at), 'MMM d, yyyy')
                    : 'N/A'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">No assessments yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
