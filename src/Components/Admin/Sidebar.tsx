// src/Components/Admin/Sidebar.jsx
import React from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  FileText,
  Calendar,
  Bell,
  LogOut,
  X,
  CreditCard,
  CalendarDays,
  Clock,
  School,
  Settings,
} from "lucide-react";
import { Button } from "@/Components/ui/button";

// ---------- Design tokens ----------
const DARK_BG = "#1a0810";
const ACTIVE_BG = "rgba(122,31,43,0.50)";
const ACTIVE_ACCENT = "#f4a0ad";

const groups = [
  {
    label: "Main",
    items: [
      { name: "Dashboard",        icon: LayoutDashboard, view: "overview" },
      { name: "Students",         icon: Users,           view: "students" },
      { name: "Teachers & staff", icon: GraduationCap,   view: "teachers" },
      { name: "Classes & subjects",icon: BookOpen,       view: "classes" },
    ],
  },
  {
    label: "Academics",
    items: [
      { name: "Academic calendar", icon: CalendarDays, view: "academic-calendar" },
      { name: "Timetable",         icon: Clock,        view: "timetable" },
      { name: "Assessments",       icon: ClipboardList,view: "assessments" },
      { name: "Assignments",       icon: FileText,     view: "assignments" },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Attendance",     icon: Calendar,  view: "attendance" },
      { name: "Announcements",  icon: Bell,      view: "announcements" },
      { name: "Fees management",icon: CreditCard,view: "fees" },
    ],
  },
];

export default function Sidebar({
  activeView,
  setActiveView,
  mobileOpen,
  setMobileOpen,
  handleLogout,
  profile,
}: any) {
  const handleClick = (view: string) => {
    setActiveView(view);
    setMobileOpen(false);
  };

  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase()
    : "A";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[220px] flex flex-col transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out`}
        style={{ background: DARK_BG }}
      >
        {/* ── Brand ── */}
        <div
          className="flex items-center justify-between px-4 py-3.5 shrink-0"
          style={{
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
            paddingTop: "max(0.875rem, env(safe-area-inset-top))",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#7a1f2b" }}
            >
              <School className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-[13px] leading-tight truncate">
                Milai School
              </p>
              <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.30)" }}>
                Admin portal
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden w-7 h-7 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              <p
                className="px-2 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                {group.label}
              </p>
              {group.items.map(({ name, icon: Icon, view }) => {
                const isActive = activeView === view;
                return (
                  <button
                    key={view}
                    onClick={() => handleClick(view)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors duration-150 active:scale-[0.98]"
                    style={
                      isActive
                        ? { background: ACTIVE_BG, color: "#fff" }
                        : { color: "rgba(255,255,255,0.48)" }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Icon
                      className="shrink-0"
                      style={{
                        width: 15,
                        height: 15,
                        color: isActive ? ACTIVE_ACCENT : "rgba(255,255,255,0.35)",
                      }}
                    />
                    <span className="truncate">{name}</span>
                    {isActive && (
                      <span
                        className="ml-auto w-1 h-1 rounded-full shrink-0"
                        style={{ background: ACTIVE_ACCENT }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div
          className="px-2 shrink-0"
          style={{
            borderTop: "0.5px solid rgba(255,255,255,0.07)",
            paddingTop: 10,
            paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Profile row */}
          <div className="flex items-center gap-2.5 px-2.5 py-2 mb-0.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold text-white"
              style={{ background: "#7a1f2b" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium leading-tight truncate" style={{ color: "rgba(255,255,255,0.70)" }}>
                {profile ? `${profile.first_name} ${profile.last_name}` : "Admin"}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.28)" }}>
                Administrator
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => handleLogout && handleLogout()}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors active:scale-[0.98]"
            style={{ color: "rgba(255,255,255,0.38)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(185,28,28,0.15)";
              (e.currentTarget as HTMLElement).style.color = "#fca5a5";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.38)";
            }}
          >
            <LogOut style={{ width: 15, height: 15 }} className="shrink-0" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}