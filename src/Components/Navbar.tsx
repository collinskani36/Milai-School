import { Button } from "@/Components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  showLogout?: boolean;
  handleLogout?: () => void;
  /** Small line under the title, e.g. "Teacher Dashboard" */
  subtitle?: string;
  /** Shown to the left of the logout button on larger screens */
  userName?: string;
}

export function Navbar({
  showLogout = false,
  handleLogout,
  subtitle,
  userName,
}: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="shrink-0 bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-card/95 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16 gap-3">
          <div
            className="flex items-center space-x-3 cursor-pointer min-w-0"
            onClick={() => navigate("/")}
          >
            <img
              src="/logo.png"
              alt="Milai School logo"
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-foreground leading-tight truncate">
                Milai School Portal
              </h1>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {userName && (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {userName}
              </span>
            )}
            {showLogout && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}