import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

type TeacherAuthProps = {
  onLogin?: (profile: any) => void;
};

export default function TeacherAuth({ onLogin }: TeacherAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const scrollToInput = (ref: React.RefObject<HTMLInputElement>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error || !data?.user) {
        setError(error?.message || "Invalid email or password");
        return;
      }

      const { data: teacherRecord, error: teacherError } = await supabase
        .from("teachers")
        .select("id, first_name, last_name, is_admin, auth_id")
        .eq("auth_id", data.user.id)
        .single();

      if (teacherError || !teacherRecord) {
        await supabase.auth.signOut();
        setError("Access denied. This account is not registered as a teacher.");
        return;
      }

      onLogin?.(teacherRecord);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ta-root {
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

        .ta-card {
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
        .ta-card.in {
          opacity: 1;
          transform: translateY(0);
        }

        .ta-logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          margin: 0 auto 24px;
          display: block;
        }

        .ta-title {
          font-size: 20px;
          font-weight: 700;
          color: #1c0d10;
          letter-spacing: -0.02em;
          text-align: center;
          margin-bottom: 4px;
        }
        .ta-subtitle {
          font-size: 13px;
          color: #9b7a7f;
          text-align: center;
          font-weight: 400;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        .ta-error {
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

        .ta-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ta-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ta-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #6b4b50;
          letter-spacing: 0.01em;
        }
        .ta-input {
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
        .ta-input::placeholder { color: #c4a8ad; font-weight: 400; }
        .ta-input:focus {
          border-color: #7a1f2b;
          box-shadow: 0 0 0 3px rgba(122,31,43,0.08);
          background: #fff;
        }

        .ta-btn {
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
        .ta-btn:active:not(:disabled) {
          background: #5c1620;
          transform: scale(0.98);
        }
        .ta-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .ta-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ta-forgot {
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: #7a1f2b;
          cursor: pointer;
          padding: 14px 0 0;
          transition: opacity 0.15s;
        }
        .ta-forgot:active { opacity: 0.6; }

        .ta-footer {
          text-align: center;
          font-size: 11px;
          color: #c4a8ad;
          margin-top: 28px;
        }

        @media (prefers-reduced-motion: reduce) {
          .ta-card { transition: none; opacity: 1; transform: none; }
        }
      `}</style>

      <div className="ta-root">
        <div className={`ta-card${mounted ? " in" : ""}`}>

          <img className="ta-logo" src="/logo.png" alt="Milai School" />

          <h1 className="ta-title">Teacher Portal</h1>
          <p className="ta-subtitle">Sign in to your dashboard</p>

          {error && <div className="ta-error" role="alert">{error}</div>}

          <form className="ta-form" onSubmit={handleLogin} noValidate>
            <div className="ta-field">
              <label className="ta-label" htmlFor="ta-email">Email address</label>
              <input
                id="ta-email"
                ref={emailRef}
                className="ta-input"
                type="email"
                placeholder="you@milai.ac.ke"
                value={email}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                spellCheck={false}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => scrollToInput(emailRef)}
                required
              />
            </div>

            <div className="ta-field">
              <label className="ta-label" htmlFor="ta-password">Password</label>
              <input
                id="ta-password"
                ref={passwordRef}
                className="ta-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => scrollToInput(passwordRef)}
                required
              />
            </div>

            <button className="ta-btn" type="submit" disabled={loading}>
              {loading ? <><span className="ta-spinner" /> Signing in…</> : "Sign in"}
            </button>
          </form>

          <p
            className="ta-forgot"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/teacher-forgot-password", { replace: true })}
onKeyDown={(e) => e.key === "Enter" && navigate("/teacher-forgot-password", { replace: true })}
          >
            Forgot password?
          </p>
        </div>

        <p className="ta-footer">© 2026 Milai School</p>
      </div>
    </>
  );
}