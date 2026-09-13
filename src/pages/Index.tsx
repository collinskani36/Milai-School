import { GraduationCap, Users, BookOpen, ChartBar, FileText, Award, Calendar, Edit, DollarSign, Currency, CurrencyIcon, LucideDollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const MAROON = "#7a1f2b";

type Portal = "student" | "teacher";

const Index = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<Portal>("student");
  const [sliding, setSliding] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("right");

  const switchPortal = (to: Portal) => {
    if (to === active || sliding) return;
    const goRight = to === "teacher";
    setDirection(goRight ? "right" : "left");
    setSliding(true);
    setTimeout(() => {
      setActive(to);
      setSliding(false);
    }, 280);
  };

  const studentContent = (
    <div className="portal-card" key="student">
      <div className="card-head">
        <div className="card-icon">
          <Users size={22} color="#fff" />
        </div>
        <div>
          <h3 className="card-title">Student portal</h3>
          <p className="card-desc">Access assignments, view grades, and track your academic progress.</p>
        </div>
      </div>
      <div className="feature-row">
        <div className="feat-chip"><ChartBar size={16} color={MAROON} /><span>Track progress</span></div>
        <div className="feat-chip"><FileText size={16} color={MAROON} /><span>Assignments</span></div>
        <div className="feat-chip"><Award size={16} color={MAROON} /><span>Grades</span></div>
      </div>
      <button className="signin-btn" onClick={() => navigate("/login")}>
        Sign in as student
      </button>
    </div>
  );

  const teacherContent = (
    <div className="portal-card" key="teacher">
      <div className="card-head">
        <div className="card-icon">
          <BookOpen size={22} color="#fff" />
        </div>
        <div>
          <h3 className="card-title">Teacher portal</h3>
          <p className="card-desc">Manage classes, set assignments, and monitor student performance.</p>
        </div>
      </div>
      <div className="feature-row">
        <div className="feat-chip"><Users size={16} color={MAROON} /><span>Students</span></div>
        <div className="feat-chip"><Edit size={16} color={MAROON} /><span>Assignments</span></div>
        <div className="feat-chip"><Calendar size={16} color={MAROON} /><span>Schedule</span></div>
      </div>
      <button className="signin-btn" onClick={() => navigate("/teacher-login")}>
        Sign in as teacher
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #fdfbfb;
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* ── MOBILE ── */
        .mob-nav {
          background: ${MAROON};
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .mob-nav-icon {
          width: 28px; height: 28px;
          border-radius: 7px;
          background: rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
        }
        .mob-nav-title {
          font-size: 15px; font-weight: 600; color: #fff;
          letter-spacing: -0.01em;
        }

        .mob-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-evenly;
          padding: 20px 24px;
          gap: 0;
        }

        .mob-hero { text-align: center; }
        .mob-icon-ring {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: rgba(122,31,43,0.1);
          border: 1.5px solid rgba(122,31,43,0.2);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px;
        }
        .mob-heading {
          font-size: 22px; font-weight: 700;
          color: #3a1b1f; line-height: 1.25;
          letter-spacing: -0.02em;
        }
        .mob-heading span { color: ${MAROON}; }
        .mob-sub {
          font-size: 13px; color: #6b4b50;
          margin-top: 6px; line-height: 1.5;
        }

        /* Toggle */
        .toggle-wrap { width: 100%; }
        .toggle-pill {
          display: flex;
          background: ${MAROON};
          border-radius: 999px;
          padding: 4px;
          width: 100%;
        }
        .toggle-btn {
          flex: 1;
          padding: 9px 12px;
          font-size: 13px; font-weight: 600;
          border-radius: 999px;
          border: none; cursor: pointer;
          transition: background 0.22s, color 0.22s;
          color: rgba(255,255,255,0.75);
          background: transparent;
        }
        .toggle-btn.active {
          background: #fff;
          color: ${MAROON};
        }
        .toggle-btn:not(.active):hover {
          color: #fff;
        }

        /* Portal card slide */
        .card-viewport {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
        .portal-card {
          background: #fff;
          border: 0.5px solid rgba(122,31,43,0.18);
          border-radius: 14px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
          width: 100%;
        }
        .portal-card.slide-out-left  { animation: slideOutLeft  0.28s ease forwards; }
        .portal-card.slide-out-right { animation: slideOutRight 0.28s ease forwards; }
        .portal-card.slide-in-right  { animation: slideInRight  0.28s ease forwards; }
        .portal-card.slide-in-left   { animation: slideInLeft   0.28s ease forwards; }

        @keyframes slideOutLeft  { to { transform: translateX(-110%); opacity: 0; } }
        @keyframes slideOutRight { to { transform: translateX( 110%); opacity: 0; } }
        @keyframes slideInRight  { from { transform: translateX( 110%); opacity: 0; } }
        @keyframes slideInLeft   { from { transform: translateX(-110%); opacity: 0; } }

        .card-head { display: flex; align-items: flex-start; gap: 12px; }
        .card-icon {
          width: 40px; height: 40px; flex-shrink: 0;
          border-radius: 10px;
          background: ${MAROON};
          display: flex; align-items: center; justify-content: center;
        }
        .card-title { font-size: 15px; font-weight: 600; color: #3a1b1f; }
        .card-desc  { font-size: 12px; color: #6b4b50; margin-top: 3px; line-height: 1.45; }

        .feature-row { display: flex; gap: 6px; }
        .feat-chip {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          background: #faf6f6;
          border: 0.5px solid rgba(122,31,43,0.12);
          border-radius: 8px;
          padding: 8px 4px;
          font-size: 10px; color: #6b4b50;
        }

        .signin-btn {
          width: 100%;
          background: ${MAROON};
          color: #fff;
          border: none; border-radius: 10px;
          padding: 11px;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          transition: background 0.18s;
          letter-spacing: 0.01em;
        }
        .signin-btn:hover { background: #6a1a24; }

        .mob-footer {
          font-size: 10px; color: #9b7a7f; text-align: center;
        }

        /* ── DESKTOP ── */
        .desk-layout {
          display: none;
          flex: 1;
          min-height: 0;
        }
        .desk-left {
          width: 45%;
          background: ${MAROON};
          display: flex; flex-direction: column;
          justify-content: space-between;
          padding: 40px 36px;
        }
        .desk-brand {
          display: flex; align-items: center; gap: 10px; margin-bottom: 32px;
        }
        .desk-brand-icon {
          width: 34px; height: 34px;
          border-radius: 9px;
          background: rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
        }
        .desk-brand-name {
          font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9);
          letter-spacing: -0.01em;
        }
        .desk-headline {
          font-size: 34px; font-weight: 700;
          color: #fff; line-height: 1.2;
          letter-spacing: -0.03em;
        }
        .desk-headline span { color: rgba(255,255,255,0.45); }
        .desk-tagline {
          font-size: 13px; color: rgba(255,255,255,0.6);
          margin-top: 16px; line-height: 1.65; max-width: 280px;
        }
        .desk-footer {
          font-size: 11px; color: rgba(255,255,255,0.3);
        }

        .desk-right {
          flex: 1;
          background: #fdfbfb;
          display: flex; flex-direction: column;
          padding: 40px 36px;
          gap: 20px;
        }
        .desk-right-label {
          font-size: 11px; font-weight: 600;
          color: #9b7a7f; letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .desk-card-viewport {
          flex: 1; position: relative; overflow: hidden;
        }
        .desk-portal-card {
          position: absolute; inset: 0;
          background: #fff;
          border: 0.5px solid rgba(122,31,43,0.15);
          border-radius: 16px;
          padding: 24px;
          display: flex; flex-direction: column; gap: 18px;
        }
        .desk-portal-card.slide-out-left  { animation: slideOutLeft  0.28s ease forwards; }
        .desk-portal-card.slide-out-right { animation: slideOutRight 0.28s ease forwards; }
        .desk-portal-card.slide-in-right  { animation: slideInRight  0.28s ease forwards; }
        .desk-portal-card.slide-in-left   { animation: slideInLeft   0.28s ease forwards; }
        .desk-card-icon {
          width: 48px; height: 48px;
          border-radius: 12px; background: ${MAROON};
          display: flex; align-items: center; justify-content: center;
        }
        .desk-card-title {
          font-size: 18px; font-weight: 700; color: #3a1b1f;
          letter-spacing: -0.02em; margin-top: 4px;
        }
        .desk-card-desc {
          font-size: 13px; color: #6b4b50; line-height: 1.6;
        }
        .desk-feature-row { display: flex; gap: 8px; }
        .desk-feat-chip {
          flex: 1;
          background: #faf6f6;
          border: 0.5px solid rgba(122,31,43,0.12);
          border-radius: 10px;
          padding: 10px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          font-size: 11px; color: #6b4b50;
        }
        .desk-signin-btn {
          width: 100%; margin-top: auto;
          background: ${MAROON}; color: #fff;
          border: none; border-radius: 12px;
          padding: 14px;
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          transition: background 0.18s;
          letter-spacing: 0.01em;
        }
        .desk-signin-btn:hover { background: #6a1a24; }

        @media (min-width: 768px) {
          .mob-nav, .mob-body, .mob-footer-wrap { display: none; }
          .desk-layout { display: flex; }
          .page { max-height: 100dvh; }
        }

        @media (prefers-reduced-motion: reduce) {
          .portal-card, .desk-portal-card { animation: none !important; }
        }
      `}</style>

      <div className="page">

        {/* ── MOBILE NAV ── */}
        <nav className="mob-nav">
          <div className="mob-nav-icon">
            <GraduationCap size={16} color="#fff" />
          </div>
          <span className="mob-nav-title">Milai School Portal</span>
        </nav>

        {/* ── MOBILE BODY ── */}
        <main className="mob-body">

          {/* Hero */}
          <div className="mob-hero">
            <div className="mob-icon-ring">
              <GraduationCap size={28} color={MAROON} />
            </div>
            <h1 className="mob-heading">
              Welcome to <span>Milai School</span>
            </h1>
            <p className="mob-sub">Academic excellence, powered by technology</p>
          </div>

          {/* Toggle */}
          <div className="toggle-wrap">
            <div className="toggle-pill">
              <button
                className={`toggle-btn${active === "student" ? " active" : ""}`}
                onClick={() => switchPortal("student")}
              >
                Student
              </button>
              <button
                className={`toggle-btn${active === "teacher" ? " active" : ""}`}
                onClick={() => switchPortal("teacher")}
              >
                Teacher
              </button>
            </div>
          </div>

          {/* Card viewport */}
          <div className="card-viewport">
            <div
              className={`portal-card${
                sliding
                  ? direction === "right"
                    ? " slide-out-left"
                    : " slide-out-right"
                  : ""
              }`}
            >
              {active === "student" ? studentContent : teacherContent}
            </div>
          </div>

          {/* Footer */}
          <p className="mob-footer">© 2026 Milai School · Empowering education</p>
        </main>

        {/* ── DESKTOP ── */}
        <div className="desk-layout">

          {/* Left brand panel */}
          <div className="desk-left">
            <div>
              <div className="desk-brand">
                <div className="desk-brand-icon">
                  <GraduationCap size={18} color="#fff" />
                </div>
                <span className="desk-brand-name">Milai School Portal</span>
              </div>
              <h1 className="desk-headline">
                Shaping minds.<br /><span>Building futures.</span>
              </h1>
              <p className="desk-tagline">
                Your gateway to academic excellence — access courses, track progress, and stay connected.
              </p>
            </div>
            <p className="desk-footer">© 2026 Milai School · All rights reserved</p>
          </div>

          {/* Right portal panel */}
          <div className="desk-right">
            <p className="desk-right-label">Sign in to your portal</p>

            {/* Toggle */}
            <div className="toggle-pill">
              <button
                className={`toggle-btn${active === "student" ? " active" : ""}`}
                onClick={() => switchPortal("student")}
              >
                Student
              </button>
              <button
                className={`toggle-btn${active === "teacher" ? " active" : ""}`}
                onClick={() => switchPortal("teacher")}
              >
                Teacher
              </button>
            </div>

            {/* Card */}
            <div className="desk-card-viewport">
              <div
                className={`desk-portal-card${
                  sliding
                    ? direction === "right"
                      ? " slide-out-left"
                      : " slide-out-right"
                    : ""
                }`}
              >
                {active === "student" ? (
                  <>
                    <div>
                      <div className="desk-card-icon"><Users size={24} color="#fff" /></div>
                      <h2 className="desk-card-title">Student portal</h2>
                      <p className="desk-card-desc">
                        Access assignments, view grades, and track your academic progress in one place.
                      </p>
                    </div>
                    <div className="desk-feature-row">
                      <div className="desk-feat-chip"><ChartBar size={18} color={MAROON} /><span>Track progress</span></div>
                      <div className="desk-feat-chip"><FileText size={18} color={MAROON} /><span>Assignments</span></div>
                      <div className="desk-feat-chip"><Award size={18} color={MAROON} /><span>Grades</span></div>
                      <div className="desk-feat-chip"><LucideDollarSign size={18} color={MAROON} /><span>Fees</span></div>
                    </div>
                    <button className="desk-signin-btn" onClick={() => navigate("/login")}>
                      Sign in as student
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="desk-card-icon"><BookOpen size={24} color="#fff" /></div>
                      <h2 className="desk-card-title">Teacher portal</h2>
                      <p className="desk-card-desc">
                        Manage classes, set assignments, and monitor student performance with ease.
                      </p>
                    </div>
                    <div className="desk-feature-row">
                      <div className="desk-feat-chip"><Users size={18} color={MAROON} /><span>Students</span></div>
                      <div className="desk-feat-chip"><Edit size={18} color={MAROON} /><span>Assignments</span></div>
                      <div className="desk-feat-chip"><Calendar size={18} color={MAROON} /><span>Schedule</span></div>
                    </div>
                    <button className="desk-signin-btn" onClick={() => navigate("/teacher-login")}>
                      Sign in as teacher
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

export default Index;