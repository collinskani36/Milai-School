import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type StudentAuthProps = {
  onLogin?: (profile: any) => void;
};

export default function StudentAuth({ onLogin }: StudentAuthProps) {
  const [registration, setRegistration] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const regRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

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
      const reg = registration.trim().toUpperCase();
      const password = pin.trim();

      if (!reg || !password) {
        setError("Please enter your registration number and PIN");
        return;
      }

      const { data: profileData, error: lookupError } = await supabase
        .from("profiles")
        .select(`id, reg_no, guardian_email, student_id`)
        .eq("reg_no", reg)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!profileData) {
        setError("Invalid registration number or PIN");
        return;
      }

      const guardianEmail = profileData.guardian_email;
      if (!guardianEmail) {
        setError("Invalid registration number or PIN");
        return;
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: guardianEmail,
          password,
        });

      if (authError || !authData?.user) {
        setError("Invalid registration number or PIN");
        return;
      }

      if (typeof onLogin === "function") onLogin(profileData);
      navigate("/student-dashboard", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sa-root {
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

        .sa-card {
          width: 100%;
          max-width: 360px;
          background: #ffffff;
          border-radius: 20px;
          padding: 36px 28px 28px;
          display: flex;
          flex-direction: column;
          gap: 0;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .sa-card.in {
          opacity: 1;
          transform: translateY(0);
        }

        /* Logo */
        .sa-logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          margin: 0 auto 24px;
          display: block;
        }

        /* Heading */
        .sa-title {
          font-size: 20px;
          font-weight: 700;
          color: #1c0d10;
          letter-spacing: -0.02em;
          text-align: center;
          margin-bottom: 4px;
        }
        .sa-subtitle {
          font-size: 13px;
          color: #9b7a7f;
          text-align: center;
          font-weight: 400;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        /* Error */
        .sa-error {
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

        /* Fields */
        .sa-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sa-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .sa-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #6b4b50;
          letter-spacing: 0.01em;
        }
        .sa-input {
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
        .sa-input::placeholder { color: #c4a8ad; font-weight: 400; }
        .sa-input:focus {
          border-color: #7a1f2b;
          box-shadow: 0 0 0 3px rgba(122,31,43,0.08);
          background: #fff;
        }
        .sa-input.uc { text-transform: uppercase; letter-spacing: 0.04em; }

        /* Button */
        .sa-btn {
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
        .sa-btn:active:not(:disabled) {
          background: #5c1620;
          transform: scale(0.98);
        }
        .sa-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .sa-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Forgot */
        .sa-forgot {
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: #7a1f2b;
          cursor: pointer;
          padding: 14px 0 0;
          transition: opacity 0.15s;
        }
        .sa-forgot:active { opacity: 0.6; }

        /* Footer */
        .sa-footer {
          text-align: center;
          font-size: 11px;
          color: #c4a8ad;
          margin-top: 28px;
        }

        @media (prefers-reduced-motion: reduce) {
          .sa-card { transition: none; opacity: 1; transform: none; }
        }
      `}</style>

      <div className="sa-root">
        <div className={`sa-card${mounted ? " in" : ""}`}>

          <img className="sa-logo" src="/logo.png" alt="Milai School" />

          <h1 className="sa-title">Student Portal</h1>
          <p className="sa-subtitle">Sign in to access your account</p>

          {error && <div className="sa-error" role="alert">{error}</div>}

          <form className="sa-form" onSubmit={handleLogin} noValidate>
            <div className="sa-field">
              <label className="sa-label" htmlFor="sa-reg">Registration number</label>
              <input
                id="sa-reg"
                ref={regRef}
                className="sa-input uc"
                type="text"
               
                value={registration}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                onChange={(e) => setRegistration(e.target.value)}
                onFocus={() => scrollToInput(regRef)}
                required
              />
            </div>

            <div className="sa-field">
              <label className="sa-label" htmlFor="sa-pin">PIN</label>
              <input
                id="sa-pin"
                ref={pinRef}
                className="sa-input"
                type="password"
                
                value={pin}
                autoComplete="current-password"
                inputMode="numeric"
                onChange={(e) => setPin(e.target.value)}
                onFocus={() => scrollToInput(pinRef)}
                required
              />
            </div>

            <button className="sa-btn" type="submit" disabled={loading}>
              {loading ? <><span className="sa-spinner" /> Signing in…</> : "Sign in"}
            </button>
          </form>

          <p
            className="sa-forgot"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/forgot-password", { replace: true })}
onKeyDown={(e) => e.key === "Enter" && navigate("/forgot-password", { replace: true })}
          >
            Forgot PIN?
          </p>
        </div>

        <p className="sa-footer">© 2026 Milai School</p>
      </div>
    </>
  );
}