import React, { useState, useEffect } from 'react';
import { Menu, Settings, Edit, Save, Eye, EyeOff, User, Mail, Phone } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/Components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

import Sidebar from '../Components/admin/Sidebar';
import OverviewSection from '../Components/admin/OverviewSection';
import StudentsSection from '../Components/admin/StudentsSection';
import TeachersSection from '../Components/admin/TeachersSection';
import ClassesSection from '../Components/admin/ClassesSection';
import AssessmentsSection from '../Components/admin/AssessmentsSection';
import AssignmentsSection from '../Components/admin/AssignmentsSection';
import AttendanceSection from '../Components/admin/AttendanceSection';
import AnnouncementsSection from '../Components/admin/AnnouncementsSection';
import AdminFees from '../Components/admin/Adminfees';

// Types for Admin Profile
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

// Settings Modal Component
interface SettingsModalProps {
  profile: AdminProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ profile, isOpen, onClose, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const resetForm = () => {
    setPhone(profile.phone || "");
    setEmail(profile.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsEditingPhone(false);
    setIsEditingEmail(false);
    setMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updatePhone = async () => {
    if (!phone.trim()) {
      setMessage({ type: "error", text: "Phone number cannot be empty" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ phone: phone.trim() })
        .eq('id', profile.id);

      if (error) throw error;

      setMessage({ type: "success", text: "Phone number updated successfully" });
      setIsEditingPhone(false);
      onProfileUpdate();
    } catch (error) {
      console.error("Error updating phone:", error);
      setMessage({ type: "error", text: "Failed to update phone number" });
    } finally {
      setLoading(false);
    }
  };

  const updateEmail = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }

    setLoading(true);
    try {
      // Update email in teachers table
      const { error: teacherError } = await supabase
        .from('teachers')
        .update({ email: email.trim() })
        .eq('id', profile.id);

      if (teacherError) throw teacherError;

      // Update email in auth
      const { error: authError } = await supabase.auth.updateUser({
        email: email.trim()
      });

      if (authError) throw authError;

      setMessage({ type: "success", text: "Email updated successfully. Please check your email for verification." });
      setIsEditingEmail(false);
      onProfileUpdate();
    } catch (error) {
      console.error("Error updating email:", error);
      setMessage({ type: "error", text: "Failed to update email" });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Please fill in all password fields" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters long" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: "success", text: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating password:", error);
      setMessage({ type: "error", text: "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admin Settings</DialogTitle>
          <DialogDescription>
            Manage your profile information and security settings
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-4 border-b">
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            Profile Information
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "password"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("password")}
          >
            Update Password
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>
                  Your basic profile information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <Input value={profile.first_name} disabled className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <Input value={profile.last_name} disabled className="mt-1" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Admin Code</label>
                  <Input value={profile.teacher_code} disabled className="mt-1" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                    {!isEditingEmail ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingEmail(true)}
                        className="h-8"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={updateEmail}
                          disabled={loading}
                          className="h-8"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingEmail(false);
                            setEmail(profile.email || "");
                          }}
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditingEmail ? (
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                    />
                  ) : (
                    <Input value={profile.email || "Not set"} disabled />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                    {!isEditingPhone ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPhone(true)}
                        className="h-8"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={updatePhone}
                          disabled={loading}
                          className="h-8"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingPhone(false);
                            setPhone(profile.phone || "");
                          }}
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditingPhone ? (
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <Input value={profile.phone || "Not set"} disabled />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Information</CardTitle>
                <CardDescription>
                  Your account details and membership
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account Type</span>
                  <span className="text-sm font-medium">
                    Administrator
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="text-sm font-medium">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User ID</span>
                  <span className="text-sm font-medium font-mono text-xs">
                    {profile.id.slice(0, 8)}...
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Update Password</CardTitle>
                <CardDescription>
                  Change your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Current Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={updatePassword}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </Button>

                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">Password Requirements</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• At least 6 characters long</li>
                    <li>• Include uppercase and lowercase letters</li>
                    <li>• Include numbers and special characters for better security</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Custom hook to fetch admin profile
const useAdminProfile = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error(userError?.message || "No user found");
        }

        const { data: admin, error: adminError } = await supabase
          .from('teachers')
          .select('*')
          .eq('auth_id', user.id)
          .eq('is_admin', true)
          .single();

        if (adminError) throw new Error(adminError.message);
        
        setProfile(admin);
      } catch (err) {
        console.error("Error fetching admin profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { profile, loading, error };
};

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  
  const { profile, loading: profileLoading, error: profileError } = useAdminProfile();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    } else {
      navigate('/login');
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: admin, error: adminError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', profile.id)
        .single();

      if (adminError) throw adminError;
      
      window.location.reload(); // Simple solution to refresh data
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return <OverviewSection setActiveView={setActiveView} />;
      case 'students':
        return <StudentsSection />;
      case 'teachers':
        return <TeachersSection />;
      case 'classes':
        return <ClassesSection />;
      case 'assessments':
        return <AssessmentsSection />;
      case 'assignments':
        return <AssignmentsSection />;
      case 'attendance':
        return <AttendanceSection />;
      case 'announcements':
        return <AnnouncementsSection />;
      case 'fees': // Added fees case
        return <AdminFees />;
      default:
        return <OverviewSection setActiveView={setActiveView} />;
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile || profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {profileError || "Admin profile not found"}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        handleLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </Button>
              <h1 className="text-xl font-bold">Admin Portal</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="text-sm text-gray-500">Administrator</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">
          {renderContent()}
        </main>

        {/* Settings Modal */}
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