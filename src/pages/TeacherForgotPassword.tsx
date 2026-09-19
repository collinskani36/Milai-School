// src/pages/TeacherForgotPassword.tsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function TeacherForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!email.trim()) {
        setError("Please enter your email address");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) throw resetError;

      setSuccess("A reset link has been sent to your email address.");
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

        .tfp-root {
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

        .tfp-card {
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
        .tfp-card.in { opacity: 1; transform: translateY(0); }

        .tfp-logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          margin: 0 auto 24px;
          display: block;
        }

        .tfp-title {
          font-size: 20px;
          font-weight: 700;
          color: #1c0d10;
          letter-spacing: -0.02em;
          text-align: center;
          margin-bottom: 4px;
        }
        .tfp-subtitle {
          font-size: 13px;
          color: #9b7a7f;
          text-align: center;
          font-weight: 400;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        .tfp-error {
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
        .tfp-success {
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

        .tfp-form { display: flex; flex-direction: column; gap: 12px; }

        .tfp-field { display: flex; flex-direction: column; gap: 5px; }
        .tfp-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #6b4b50;
          letter-spacing: 0.01em;
        }
        .tfp-input {
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
        }
        .tfp-input::placeholder { color: #c4a8ad; font-weight: 400; }
        .tfp-input:focus {
          border-color: #7a1f2b;
          box-shadow: 0 0 0 3px rgba(122,31,43,0.08);
          background: #fff;
        }

        .tfp-btn {
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
        .tfp-btn:active:not(:disabled) { background: #5c1620; transform: scale(0.98); }
        .tfp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .tfp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .tfp-back {
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: #7a1f2b;
          cursor: pointer;
          padding: 14px 0 0;
          transition: opacity 0.15s;
        }
        .tfp-back:active { opacity: 0.6; }

        .tfp-footer {
          text-align: center;
          font-size: 11px;
          color: #c4a8ad;
          margin-top: 28px;
        }

        @media (prefers-reduced-motion: reduce) {
          .tfp-card { transition: none; opacity: 1; transform: none; }
        }
      `}</style>

      <div className="tfp-root">
        <div className={`tfp-card${mounted ? " in" : ""}`}>

          <img className="tfp-logo" src="/logo.png" alt="Milai School" />

          <h1 className="tfp-title">Reset password</h1>
          <p className="tfp-subtitle">Enter your email and we'll send a reset link</p>

          {error && <div className="tfp-error" role="alert">{error}</div>}
          {success && <div className="tfp-success" role="status">{success}</div>}

          {!success && (
            <form className="tfp-form" onSubmit={handleReset} noValidate>
              <div className="tfp-field">
                <label className="tfp-label" htmlFor="tfp-email">Email address</label>
                <input
                  id="tfp-email"
                  ref={emailRef}
                  className="tfp-input"
                  type="email"
                  placeholder="you@milai.ac.ke"
                  value={email}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  spellCheck={false}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button className="tfp-btn" type="submit" disabled={loading}>
                {loading ? <><span className="tfp-spinner" /> Sending…</> : "Send reset link"}
              </button>
            </form>
          )}

          <p
            className="tfp-back"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/", { replace: true })}
            onKeyDown={(e) => e.key === "Enter" && navigate("/", { replace: true })}
          >
            Back to login
          </p>
        </div>

        <p className="tfp-footer">© 2026 Milai School</p>
      </div>
    </>
  );
}