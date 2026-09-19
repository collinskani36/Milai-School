// src/pages/StudentForgotPassword.tsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function StudentForgotPassword() {
  const [registration, setRegistration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const regRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const reg = registration.trim().toUpperCase();

      if (!reg) {
        setError("Please enter your registration number");
        return;
      }

      const { data: profileData, error: lookupError } = await supabase
        .from("profiles")
        .select("guardian_email")
        .eq("reg_no", reg)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!profileData?.guardian_email) {
        // Generic message — avoids leaking whether the reg number exists
        setSuccess("If that registration number is on file, a reset link has been sent to the guardian's email.");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        profileData.guardian_email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) throw resetError;

      setSuccess("A reset link has been sent to the guardian's email address.");
    } catch {
      setError("Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sfp-root {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f5f1f1;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          padding: max(env(safe-area-inset-top, 0px), 24px) 24px max(env(safe-area-inset-bottom, 0px), 24px);
          -webkit-tap-highlight-color: transparent;
        }

        .sfp-card {
          width: 100%;
          max-width: 360px;
          background: #ffffff;
          border-radius: 20px;
          padding: 36px 28px 28px;
          display: flex;
          flex-direction: column;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .sfp-card.in { opacity: 1; transform: translateY(0); }

        .sfp-logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          margin: 0 auto 24px;
          display: block;
        }

        .sfp-title {
          font-size: 20px;
          font-weight: 700;
          color: #1c0d10;
          letter-spacing: -0.02em;
          text-align: center;
          margin-bottom: 4px;
        }
        .sfp-subtitle {
          font-size: 13px;
          color: #9b7a7f;
          text-align: center;
          font-weight: 400;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        .sfp-error {
          font-size: 12.5px;
          color: #7a1f2b;
          background: #fdf3f4;
          border: 1px solid #f0d5d8;
          border-radius: 8px;
          padding: 9px 12px;
          margin-bottom: 16px;
          line-height: 1.45;
          font-weight: 500;
        }
        .sfp-success {
          font-size: 12.5px;
          color: #1a5c2a;
          background: #f0faf3;
          border: 1px solid #c3e6cb;
          border-radius: 8px;
          padding: 9px 12px;
          margin-bottom: 16px;
          line-height: 1.45;
          font-weight: 500;
        }

        .sfp-form { display: flex; flex-direction: column; gap: 12px; }

        .sfp-field { display: flex; flex-direction: column; gap: 5px; }
        .sfp-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #6b4b50;
          letter-spacing: 0.01em;
        }
        .sfp-input {
          height: 46px;
          padding: 0 14px;
          background: #faf7f7;
          border: 1px solid #e8dfe0;
          border-radius: 10px;
          font-size: 14.5px;
          font-weight: 500;
          color: #1c0d10;
          font-family: inherit;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
          -webkit-appearance: none;
          user-select: text;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sfp-input::placeholder { color: #c4a8ad; font-weight: 400; text-transform: none; letter-spacing: 0; }
        .sfp-input:focus {
          border-color: #7a1f2b;
          box-shadow: 0 0 0 3px rgba(122,31,43,0.08);
          background: #fff;
        }

        .sfp-btn {
          height: 48px;
          width: 100%;
          margin-top: 8px;
          background: #7a1f2b;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 0.01em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.15s, transform 0.1s;
          -webkit-appearance: none;
        }
        .sfp-btn:active:not(:disabled) { background: #5c1620; transform: scale(0.98); }
        .sfp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .sfp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .sfp-back {
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: #7a1f2b;
          cursor: pointer;
          padding: 14px 0 0;
          transition: opacity 0.15s;
        }
        .sfp-back:active { opacity: 0.6; }

        .sfp-footer {
          text-align: center;
          font-size: 11px;
          color: #c4a8ad;
          margin-top: 28px;
        }

        @media (prefers-reduced-motion: reduce) {
          .sfp-card { transition: none; opacity: 1; transform: none; }
        }
      `}</style>

      <div className="sfp-root">
        <div className={`sfp-card${mounted ? " in" : ""}`}>

          <img className="sfp-logo" src="/logo.png" alt="Milai School" />

          <h1 className="sfp-title">Reset PIN</h1>
          <p className="sfp-subtitle">Enter your registration number and we'll send a reset link to the guardian's email</p>

          {error && <div className="sfp-error" role="alert">{error}</div>}
          {success && <div className="sfp-success" role="status">{success}</div>}

          {!success && (
            <form className="sfp-form" onSubmit={handleReset} noValidate>
              <div className="sfp-field">
                <label className="sfp-label" htmlFor="sfp-reg">Registration number</label>
                <input
                  id="sfp-reg"
                  ref={regRef}
                  className="sfp-input"
                  type="text"
                  placeholder="MIL-2024-001"
                  value={registration}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setRegistration(e.target.value)}
                  required
                />
              </div>

              <button className="sfp-btn" type="submit" disabled={loading}>
                {loading ? <><span className="sfp-spinner" /> Sending…</> : "Send reset link"}
              </button>
            </form>
          )}

          <p
            className="sfp-back"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/login", { replace: true })}
            onKeyDown={(e) => e.key === "Enter" && navigate("/login", { replace: true })}
          >
            Back to sign in
          </p>
        </div>

        <p className="sfp-footer">© 2026 Milai School</p>
      </div>
    </>
  );
}