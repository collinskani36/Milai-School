// src/Components/StudentSettingsModal.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/Components/ui/input';
import {
  Settings, X, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const MAROON = '#7a1f2b';
const MAROON_GRADIENT = 'linear-gradient(135deg, #7a1f2b 0%, #5f1620 100%)';
const BORDER = 'rgba(122,31,43,0.12)';
const CARD_SHADOW = '0 6px 24px -14px rgba(122,31,43,0.28)';

interface Props {
  open: boolean;
  onClose: () => void;
  profile: { first_name: string; last_name: string; reg_no: string; guardian_email?: string | null };
  classLabel?: string | null;
}

export default function StudentSettingsModal({ open, onClose, profile, classLabel }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fresh form every time it opens
  useEffect(() => {
    if (!open) return;
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
    setMessage(null);
  }, [open]);

  const handleClose = () => { if (!loading) onClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < 6) return setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
    if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'The two passwords do not match.' });

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Could not update your password. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase();
  const rows: [string, string][] = [
    ['Student ID', profile.reg_no],
    ['Class', classLabel || '—'],
    ['Guardian email', profile.guardian_email?.trim() || '—'],
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-6 bg-black/40 backdrop-blur-[2px]"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full sm:max-w-md max-h-full flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#fdfbfb', border: `0.5px solid ${BORDER}`, boxShadow: '0 24px 60px -16px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden text-white" style={{ background: MAROON_GRADIENT }}>
          <div className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)' }} />
          <div className="relative flex items-center gap-3 px-4 py-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">Account</p>
              <h3 className="text-base font-bold leading-tight">Settings</h3>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close settings"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/12 border border-white/20 hover:bg-white/25 active:scale-95 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
          {/* Profile card */}
          <div className="rounded-2xl bg-white overflow-hidden" style={{ border: `0.5px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <div className="flex items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
                style={{ background: MAROON_GRADIENT }}>
                {initials || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#3a1b1f] leading-tight truncate">{profile.first_name} {profile.last_name}</p>
                <p className="text-[11px] text-[#9b7a7f] mt-0.5">Student</p>
              </div>
            </div>
            <div className="border-t" style={{ borderColor: 'rgba(122,31,43,0.08)' }}>
              {rows.map(([label, value], i) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                  style={i > 0 ? { borderTop: '0.5px solid rgba(122,31,43,0.08)' } : undefined}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9b7a7f]">{label}</span>
                  <span className={`text-[#3a1b1f] text-right truncate min-w-0 ${label === 'Student ID' ? 'font-mono' : ''}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Password card */}
          <form onSubmit={handleSubmit} className="rounded-2xl bg-white overflow-hidden" style={{ border: `0.5px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: 'rgba(122,31,43,0.08)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(122,31,43,0.08)' }}>
                <ShieldCheck className="w-4 h-4" style={{ color: MAROON }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#3a1b1f] leading-tight">Change password</p>
                <p className="text-[11px] text-[#9b7a7f]">At least 6 characters</p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {message && (
                <div
                  className={`rounded-xl p-3 text-sm border flex items-start gap-2 ${
                    message.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {message.type === 'success'
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{message.text}</span>
                </div>
              )}

              <PasswordField
                id="settings-new-password"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                visible={showNew}
                toggle={() => setShowNew((v) => !v)}
                disabled={loading}
                autoComplete="new-password"
              />
              <PasswordField
                id="settings-confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirm}
                toggle={() => setShowConfirm((v) => !v)}
                disabled={loading}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full h-11 rounded-xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-opacity disabled:opacity-50"
                style={{ background: MAROON_GRADIENT, boxShadow: '0 8px 18px -10px rgba(122,31,43,0.5)' }}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                  : <><ShieldCheck className="w-4 h-4" /> Update password</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PasswordField({
  id, label, value, onChange, visible, toggle, disabled, autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  visible: boolean; toggle: () => void; disabled?: boolean; autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-[#7a1f2b]/70">{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          className="h-11 pr-11 rounded-xl border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#7a1f2b]/50 hover:bg-[#7a1f2b]/8 active:scale-95"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}