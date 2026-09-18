import { useState, useEffect } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/Components/ui/dialog";
import {
  Edit, Save, Eye, EyeOff, User, Shield, Settings as SettingsIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─── Design tokens (mirrors TeacherDashboard) ────────────────────────────────
const MAROON = "#7a1f2b";
const MAROON_GRADIENT =
  "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";

interface Teacher {
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
  profile: Teacher | null;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  profile, isOpen, onClose, onProfileUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || "");
      setEmail(profile.email || "");
    } else {
      setPhone("");
      setEmail("");
    }
  }, [profile]);

  const resetForm = () => {
    setPhone(profile?.phone || "");
    setEmail(profile?.email || "");
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

  const updatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setMessage({ type: "error", text: "Phone number cannot be empty" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const { error: updateError } = await supabase
        .from('teachers')
        .update({ phone: phone.trim() })
        .eq('auth_id', user.id);
      if (updateError) throw updateError;
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

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user?.email === email.trim()) {
        setMessage({ type: "info", text: "This is already your current email." });
        setIsEditingEmail(false);
        return;
      }
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) throw authError;
      const { error: tableError } = await supabase
        .from('teachers')
        .update({ email: email.trim() })
        .eq('auth_id', user.id);
      if (tableError) throw tableError;
      setMessage({
        type: "success",
        text: "Email updated! Verification links sent to your old and new email.",
      });
      setIsEditingEmail(false);
      if (onProfileUpdate) onProfileUpdate();
    } catch (error: any) {
      console.error("Error updating email:", error);
      setMessage({ type: "error", text: error.message || "Failed to update email" });
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: "success", text: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      setMessage({ type: "error", text: "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  // ─── Themed input / label helpers ────────────────────────────────────────
  const labelCls =
    "text-[10px] uppercase tracking-[0.15em] font-semibold text-[#7a1f2b]/60";
  const inputCls =
    "mt-1 h-10 text-sm rounded-xl border-[#7a1f2b]/15 " +
    "focus-visible:ring-2 focus-visible:ring-[#7a1f2b]/30 focus-visible:border-[#7a1f2b]/40 " +
    "disabled:bg-[#7a1f2b]/[0.03] disabled:text-[#3a1b1f]/70 disabled:opacity-100";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-[600px] max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border-[#7a1f2b]/15"
        style={{ boxShadow: "0 24px 60px -30px rgba(122,31,43,0.45)" }}
      >
        {/* ── Themed header strip ── */}
        <div
          className="relative overflow-hidden px-4 sm:px-6 py-4 rounded-t-2xl"
          style={{ background: MAROON_GRADIENT }}
        >
          <div
            className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }}
          />
          <DialogHeader className="relative space-y-0 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                <SettingsIcon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
                  Account
                </p>
                <DialogTitle className="text-white font-bold text-base sm:text-lg leading-tight">
                  Teacher Settings
                </DialogTitle>
                <DialogDescription className="text-white/70 text-[11px] sm:text-xs mt-0.5 leading-snug">
                  Manage your profile information and security settings
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Tab chips (segmented maroon pills) ── */}
        <div className="px-4 sm:px-6 pt-3 pb-2">
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap leading-none border ${
                activeTab === "profile"
                  ? "bg-[#7a1f2b] text-white border-[#7a1f2b] shadow-[0_2px_6px_-2px_rgba(122,31,43,0.5)]"
                  : "bg-white text-[#7a1f2b]/70 border-[#7a1f2b]/15 hover:text-[#7a1f2b] hover:border-[#7a1f2b]/30"
              }`}
            >
              <User className="inline h-3 w-3 mr-1 -mt-0.5" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap leading-none border ${
                activeTab === "password"
                  ? "bg-[#7a1f2b] text-white border-[#7a1f2b] shadow-[0_2px_6px_-2px_rgba(122,31,43,0.5)]"
                  : "bg-white text-[#7a1f2b]/70 border-[#7a1f2b]/15 hover:text-[#7a1f2b] hover:border-[#7a1f2b]/30"
              }`}
            >
              <Shield className="inline h-3 w-3 mr-1 -mt-0.5" />
              Password
            </button>
          </div>
        </div>

        {/* ── Message banner ── */}
        {message && (
          <div className="px-4 sm:px-6 pt-1">
            <div
              className={`p-2.5 sm:p-3 rounded-xl text-xs sm:text-sm border ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border-green-200"
                  : message.type === "error"
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-[#7a1f2b]/[0.05] text-[#7a1f2b] border-[#7a1f2b]/15"
              }`}
            >
              {message.text}
            </div>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
            <Card
              className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-sm sm:text-base text-[#3a1b1f]">
                  Personal Information
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs">
                  Your basic profile information
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <Input value={profile.first_name} disabled className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <Input value={profile.last_name} disabled className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Teacher Code</label>
                  <Input value={profile.teacher_code} disabled className={inputCls} />
                </div>

                {/* Email */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Email Address</label>
                    {!isEditingEmail ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingEmail(true)}
                        className="h-7 px-2 text-[11px] rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={(e) => updateEmail(e)}
                          disabled={loading}
                          className="h-7 px-2 text-[11px] rounded-lg text-white"
                          style={{ background: MAROON_GRADIENT }}
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
                          className="h-7 px-2 text-[11px] rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
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
                      className={inputCls}
                    />
                  ) : (
                    <Input value={profile.email || "Not set"} disabled className={inputCls} />
                  )}
                </div>

                {/* Phone */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Phone Number</label>
                    {!isEditingPhone ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPhone(true)}
                        className="h-7 px-2 text-[11px] rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={(e) => updatePhone(e)}
                          disabled={loading}
                          className="h-7 px-2 text-[11px] rounded-lg text-white"
                          style={{ background: MAROON_GRADIENT }}
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
                          className="h-7 px-2 text-[11px] rounded-lg border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
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
                      className={inputCls}
                    />
                  ) : (
                    <Input value={profile.phone || "Not set"} disabled className={inputCls} />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card
              className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-sm sm:text-base text-[#3a1b1f]">
                  Account Information
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs">
                  Your account details and membership
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 space-y-2">
                {[
                  { label: "Account Type", value: profile.is_admin ? "Administrator" : "Teacher" },
                  { label: "Member Since", value: new Date(profile.created_at).toLocaleDateString() },
                  { label: "User ID", value: `${profile.first_name}.${profile.last_name}`, mono: true },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2 border-b border-[#7a1f2b]/5 last:border-0"
                  >
                    <span className="text-[11px] sm:text-xs text-muted-foreground">{row.label}</span>
                    <span className={`text-[11px] sm:text-xs font-semibold text-[#3a1b1f] ${row.mono ? "font-mono" : ""}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PASSWORD TAB ── */}
        {activeTab === "password" && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
            <Card
              className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-sm sm:text-base text-[#3a1b1f]">
                  Update Password
                </CardTitle>
                <CardDescription className="text-[11px] sm:text-xs">
                  Change your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 space-y-3 sm:space-y-4">
                {([
                  { label: "Current Password", value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword), ph: "Enter your current password" },
                  { label: "New Password", value: newPassword, setter: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword), ph: "Enter your new password" },
                  { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword), ph: "Confirm your new password" },
                ] as const).map((f) => (
                  <div key={f.label}>
                    <label className={`${labelCls} block mb-1.5`}>{f.label}</label>
                    <div className="relative">
                      <Input
                        type={f.show ? "text" : "password"}
                        value={f.value}
                        onChange={(e) => f.setter(e.target.value)}
                        placeholder={f.ph}
                        className={`${inputCls} mt-0 pr-10`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-2.5 hover:bg-transparent text-[#7a1f2b]/60 hover:text-[#7a1f2b]"
                        onClick={f.toggle}
                      >
                        {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={updatePassword}
                  disabled={loading}
                  className="w-full h-10 text-xs sm:text-sm font-semibold rounded-xl text-white border-0"
                  style={{ background: MAROON_GRADIENT, boxShadow: "0 8px 20px -10px rgba(122,31,43,0.55)" }}
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </Button>

                <div className="bg-[#7a1f2b]/[0.05] p-3 rounded-xl border border-[#7a1f2b]/15">
                  <h4 className="text-[11px] sm:text-xs font-semibold text-[#7a1f2b] mb-1.5 uppercase tracking-wide">
                    Password Requirements
                  </h4>
                  <ul className="text-[11px] sm:text-xs text-[#3a1b1f]/80 space-y-0.5">
                    <li>• At least 6 characters long</li>
                    <li>• Include uppercase and lowercase letters</li>
                    <li>• Include numbers and special characters for better security</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Safe bottom padding on mobile ── */}
        <div className="h-2 sm:h-3" />
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;