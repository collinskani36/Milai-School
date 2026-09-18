// src/Pages/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Menu, Settings, Edit, Save, Eye, EyeOff, GraduationCap, X, User } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

import Sidebar from '../Components/Admin/Sidebar';
import OverviewSection from '../Components/Admin/OverviewSection';
import StudentsSection from '../Components/Admin/StudentsSection';
import TeachersSection from '../Components/Admin/TeachersSection';
import ClassesSection from '../Components/Admin/ClassesSection/index';
import AssessmentsSection from '../Components/Admin/AssessmentsSection';
import AssignmentsSection from '../Components/Admin/AssignmentsSection';
import AttendanceSection from '../Components/Admin/AttendanceSection';
import AnnouncementsSection from '../Components/Admin/AnnouncementsSection';
import AdminFees from '../Components/Admin/Adminfees';
import AcademicCalendar from '../Components/Admin/AcademicCalendar';
import TimetableSection from "../Components/Admin/Timetablesection";

// ─── Design tokens ────────────────────────────────────────────────────────────
const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)';
const GRADIENT_BTN_STYLE: React.CSSProperties = {
  background: MAROON_GRADIENT,
  boxShadow: '0 6px 16px -8px rgba(122,31,43,0.5)',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminProfile {
  id: string;
  auth_id: string;
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  is_admin: boolean;
}

interface SettingsModalProps {
  profile: AdminProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Modal
// ─────────────────────────────────────────────────────────────────────────────
const SettingsModal: React.FC<SettingsModalProps> = ({
  profile, isOpen, onClose, onProfileUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [phone, setPhone] = useState(profile.phone || '');
  const [email, setEmail] = useState(profile.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const resetForm = () => {
    setPhone(profile.phone || '');
    setEmail(profile.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsEditingPhone(false);
    setIsEditingEmail(false);
    setMessage(null);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const updatePhone = async () => {
    if (!phone.trim()) { setMessage({ type: 'error', text: 'Phone number cannot be empty' }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('teachers').update({ phone: phone.trim() }).eq('id', profile.id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Phone number updated successfully' });
      setIsEditingPhone(false);
      onProfileUpdate();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update phone number' });
    } finally { setLoading(false); }
  };

  const updateEmail = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' }); return;
    }
    setLoading(true);
    try {
      const { error: teacherError } = await supabase.from('teachers').update({ email: email.trim() }).eq('id', profile.id);
      if (teacherError) throw teacherError;
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) throw authError;
      setMessage({ type: 'success', text: 'Email updated. Check your email for verification.' });
      setIsEditingEmail(false);
      onProfileUpdate();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update email' });
    } finally { setLoading(false); }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all password fields' }); return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' }); return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' }); return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally { setLoading(false); }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 transition-opacity ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      <div
        className={`relative w-full sm:max-w-[580px] max-h-[92vh] flex flex-col bg-white rounded-2xl border overflow-hidden transition-transform duration-200 ${
          isOpen ? 'scale-100' : 'scale-95'
        }`}
        style={{ borderColor: 'rgba(122,31,43,0.12)', boxShadow: '0 24px 60px -16px rgba(0,0,0,0.25)' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(122,31,43,0.10)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(122,31,43,0.08)' }}
            >
              <Settings className="h-3.5 w-3.5" style={{ color: MAROON }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1a0810]">Admin settings</h3>
              <p className="text-[11px] text-gray-400">Manage your profile and security</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0" style={{ borderColor: 'rgba(122,31,43,0.08)' }}>
          {(['profile', 'password'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'text-[#7a1f2b]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full"
                  style={{ background: MAROON }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#faf8f8]">
          {message && (
            <div
              className={`rounded-xl p-3 text-sm border flex items-start gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <span className="shrink-0 mt-0.5">{message.type === 'success' ? '✓' : '⚠'}</span>
              <span>{message.text}</span>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-3">
              {/* Personal info */}
              <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: 'rgba(122,31,43,0.10)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(122,31,43,0.08)' }}>
                  <p className="text-xs font-semibold text-[#1a0810]">Personal information</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium block mb-1.5">First name</label>
                      <Input value={profile.first_name} disabled className="h-9 rounded-lg border-gray-200 bg-gray-50 text-[#1a0810] disabled:opacity-80" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium block mb-1.5">Last name</label>
                      <Input value={profile.last_name} disabled className="h-9 rounded-lg border-gray-200 bg-gray-50 text-[#1a0810] disabled:opacity-80" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 font-medium block mb-1.5">Admin code</label>
                    <Input value={profile.teacher_code} disabled className="h-9 rounded-lg border-gray-200 bg-gray-50 font-mono text-[#1a0810] disabled:opacity-80" />
                  </div>

                  {/* Email */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] text-gray-400 font-medium">Email address</label>
                      {!isEditingEmail ? (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingEmail(true)}
                          className="h-6 text-[11px] rounded-md border-gray-200 text-gray-500 hover:text-[#7a1f2b] hover:border-[#7a1f2b]/30 active:scale-95">
                          <Edit className="h-3 w-3 mr-1" />Edit
                        </Button>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={updateEmail} disabled={loading}
                            className="h-6 text-[11px] rounded-md text-white border-0 active:scale-95" style={GRADIENT_BTN_STYLE}>
                            <Save className="h-3 w-3 mr-1" />Save
                          </Button>
                          <Button variant="outline" size="sm"
                            onClick={() => { setIsEditingEmail(false); setEmail(profile.email || ''); }}
                            className="h-6 text-[11px] rounded-md border-gray-200 text-gray-500 active:scale-95">
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    {isEditingEmail ? (
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="h-9 rounded-lg border-gray-200 focus-visible:ring-[#7a1f2b]/25" />
                    ) : (
                      <Input value={profile.email || 'Not set'} disabled className="h-9 rounded-lg border-gray-200 bg-gray-50 text-[#1a0810] disabled:opacity-80" />
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] text-gray-400 font-medium">Phone number</label>
                      {!isEditingPhone ? (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingPhone(true)}
                          className="h-6 text-[11px] rounded-md border-gray-200 text-gray-500 hover:text-[#7a1f2b] hover:border-[#7a1f2b]/30 active:scale-95">
                          <Edit className="h-3 w-3 mr-1" />Edit
                        </Button>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={updatePhone} disabled={loading}
                            className="h-6 text-[11px] rounded-md text-white border-0 active:scale-95" style={GRADIENT_BTN_STYLE}>
                            <Save className="h-3 w-3 mr-1" />Save
                          </Button>
                          <Button variant="outline" size="sm"
                            onClick={() => { setIsEditingPhone(false); setPhone(profile.phone || ''); }}
                            className="h-6 text-[11px] rounded-md border-gray-200 text-gray-500 active:scale-95">
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    {isEditingPhone ? (
                      <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter your phone number"
                        className="h-9 rounded-lg border-gray-200 focus-visible:ring-[#7a1f2b]/25" />
                    ) : (
                      <Input value={profile.phone || 'Not set'} disabled className="h-9 rounded-lg border-gray-200 bg-gray-50 text-[#1a0810] disabled:opacity-80" />
                    )}
                  </div>
                </div>
              </div>

              {/* Account details */}
              <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: 'rgba(122,31,43,0.10)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(122,31,43,0.08)' }}>
                  <p className="text-xs font-semibold text-[#1a0810]">Account details</p>
                </div>
                <div className="p-4 space-y-0">
                  {[
                    { label: 'Account type', value: 'Administrator' },
                    { label: 'Member since', value: new Date(profile.created_at).toLocaleDateString() },
                    { label: 'User ID', value: `${profile.id.slice(0, 8)}…`, mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex justify-between items-center py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                      <span className="text-[11px] text-gray-400">{label}</span>
                      <span className={`text-sm text-[#1a0810] ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: 'rgba(122,31,43,0.10)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(122,31,43,0.08)' }}>
                <p className="text-xs font-semibold text-[#1a0810]">Update your password</p>
              </div>
              <div className="p-4 space-y-4">
                {[
                  { label: 'Current password', value: currentPassword, set: setCurrentPassword, show: showCurrentPassword, setShow: setShowCurrentPassword, placeholder: 'Enter your current password' },
                  { label: 'New password', value: newPassword, set: setNewPassword, show: showNewPassword, setShow: setShowNewPassword, placeholder: 'Enter your new password' },
                  { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, setShow: setShowConfirmPassword, placeholder: 'Confirm your new password' },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-[11px] text-gray-400 font-medium block mb-1.5">{f.label}</label>
                    <div className="relative">
                      <Input
                        type={f.show ? 'text' : 'password'}
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        placeholder={f.placeholder}
                        className="h-9 rounded-lg border-gray-200 focus-visible:ring-[#7a1f2b]/25 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => f.setShow(!f.show)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {f.show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={updatePassword}
                  disabled={loading}
                  className="w-full h-9 rounded-lg text-white border-0 active:scale-[0.98] text-sm"
                  style={GRADIENT_BTN_STYLE}
                >
                  {loading ? 'Updating…' : 'Update password'}
                </Button>

                <div className="rounded-lg p-3 border" style={{ background: 'rgba(122,31,43,0.03)', borderColor: 'rgba(122,31,43,0.10)' }}>
                  <p className="text-[11px] font-semibold text-[#7a1f2b] mb-1.5">Password requirements</p>
                  <ul className="text-[11px] text-gray-400 space-y-0.5 leading-relaxed">
                    <li>• At least 6 characters long</li>
                    <li>• Mix of uppercase and lowercase letters</li>
                    <li>• Include numbers and special characters</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom hook — fetch Admin profile
// ─────────────────────────────────────────────────────────────────────────────
const useAdminProfile = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error(userError?.message || 'No user found');

        const { data: Admin, error: AdminError } = await supabase
          .from('teachers')
          .select('*')
          .eq('auth_id', user.id)
          .eq('is_admin', true)
          .single();

        if (AdminError) throw new Error(AdminError.message);
        setProfile(Admin);
      } catch (err) {
        console.error('Error fetching Admin profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  return { profile, loading, error };
};

// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeView, setActiveView] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();

  const { profile, loading: profileLoading, error: profileError } = useAdminProfile();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error.message);
    else navigate('/');
  };

  const refreshProfile = async () => {
    if (!profile?.id) return;
    try {
      const { data: Admin, error: AdminError } = await supabase
        .from('teachers').select('*').eq('id', profile.id).single();
      if (AdminError) throw AdminError;
      window.location.reload();
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'overview':           return <OverviewSection setActiveView={setActiveView} />;
      case 'students':           return <StudentsSection />;
      case 'teachers':           return <TeachersSection />;
      case 'classes':            return <ClassesSection />;
      case 'academic-calendar':  return <AcademicCalendar />;
      case 'timetable':          return <TimetableSection />;
      case 'assessments':        return <AssessmentsSection />;
      case 'assignments':        return <AssignmentsSection />;
      case 'attendance':         return <AttendanceSection />;
      case 'announcements':      return <AnnouncementsSection />;
      case 'fees':               return <AdminFees />;
      default:                   return <OverviewSection setActiveView={setActiveView} />;
    }
  };

  // ── Loading state ──
  if (profileLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#faf8f8] flex items-center justify-center">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 mx-auto border-2"
            style={{ borderColor: 'rgba(122,31,43,0.12)', borderBottomColor: MAROON }}
          />
          <p className="mt-3 text-sm text-gray-400 font-medium">Loading admin portal…</p>
        </div>
      </div>
    );
  }

  // ── Error / no profile ──
  if (!profile || profileError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#faf8f8] px-4">
        <div
          className="max-w-sm w-full text-center bg-white rounded-2xl border p-6"
          style={{ borderColor: 'rgba(122,31,43,0.10)', boxShadow: '0 8px 32px -12px rgba(0,0,0,0.12)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-3">
            <User className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-[#7a1f2b] font-semibold text-sm">{profileError || 'Admin profile not found'}</p>
          <Button
            onClick={() => navigate('/')}
            className="mt-4 h-9 rounded-lg text-white border-0 active:scale-[0.98] text-sm"
            style={GRADIENT_BTN_STYLE}
          >
            Return to login
          </Button>
        </div>
      </div>
    );
  }

  const viewLabel: Record<string, string> = {
    overview: 'Dashboard',
    students: 'Students',
    teachers: 'Teachers & staff',
    classes: 'Classes & subjects',
    'academic-calendar': 'Academic calendar',
    timetable: 'Timetable',
    assessments: 'Assessments',
    assignments: 'Assignments',
    attendance: 'Attendance',
    announcements: 'Announcements',
    fees: 'Fees management',
  };

  return (
    <div className="h-[100dvh] sm:h-screen bg-[#faf8f8] flex overflow-hidden">
      {/* Sidebar — receives profile so it can show initials / name */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        handleLogout={handleLogout}
        profile={profile}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Mobile header ── */}
        <header
          className="md:hidden shrink-0 z-40 bg-white border-b"
          style={{ borderColor: 'rgba(0,0,0,0.07)', paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors active:scale-95 shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#1a0810] leading-tight truncate">
                  {viewLabel[activeView] || 'Dashboard'}
                </p>
                <p className="text-[10px] text-gray-400 leading-tight">Milai School</p>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors active:scale-95 shrink-0"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Desktop header ── */}
        <header
          className="hidden md:flex shrink-0 z-40 bg-white border-b items-center justify-between px-6"
          style={{ borderColor: 'rgba(0,0,0,0.07)', height: 48 }}
        >
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-[#1a0810]">{viewLabel[activeView] || 'Dashboard'}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-gray-400">
              {profile.first_name} {profile.last_name}
            </span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-gray-200 text-gray-500 text-[12px] font-medium hover:bg-gray-50 hover:text-gray-700 transition-colors active:scale-95"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-6">
            {renderContent()}
          </div>
        </main>

        {/* Settings modal */}
        {profile && (
          <SettingsModal
            profile={profile}
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onProfileUpdate={refreshProfile}
          />
        )}
      </div>
    </div>
  );
}