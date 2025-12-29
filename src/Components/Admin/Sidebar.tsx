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
  CreditCard, // Add this import for Fees
} from "lucide-react";
import { Button } from "@/Components/ui/button";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, view: "overview" },
  { name: "Students", icon: Users, view: "students" },
  { name: "Teachers", icon: GraduationCap, view: "teachers" },
  { name: "Classes & Subjects", icon: BookOpen, view: "classes" },
  { name: "Assessments", icon: ClipboardList, view: "assessments" },
  { name: "Assignments", icon: FileText, view: "assignments" },
  { name: "Attendance", icon: Calendar, view: "attendance" },
  { name: "Announcements", icon: Bell, view: "announcements" },
  { name: "Fees Management", icon: CreditCard, view: "fees" }, // Add this line
];

export default function Sidebar({ activeView, setActiveView, mobileOpen, setMobileOpen, handleLogout }: any) {
  const handleClick = (view: string) => {
    setActiveView(view);
    setMobileOpen(false); // close sidebar on mobile after click
  };

  return (
    <>
      {/* Overlay (for mobile) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-md transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-blue-700 tracking-wide">Admin Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden hover:bg-blue-50"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5 text-blue-700" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col p-3 space-y-1 overflow-y-auto h-full">
          {menuItems.map(({ name, icon: Icon, view }) => (
            <button
              key={view}
              onClick={() => handleClick(view)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === view
                  ? "bg-blue-100 text-blue-700 shadow-sm"
                  : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <Icon className="w-5 h-5" />
              {name}
            </button>
          ))}
          <div className="mt-auto px-3 py-4">
            <Button variant="ghost" className="w-full" onClick={() => handleLogout && handleLogout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </nav>
      </aside>
    </>
  );
}