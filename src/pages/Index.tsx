import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-[#0f172a] bg-[radial-gradient(circle_at_20%_30%,_var(--tw-gradient-stops))] from-blue-900 via-[#0f172a] to-[#0c1a2f] p-3 md:p-6 overflow-hidden">

      {/* Header */}
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/5 rounded-2xl w-full max-w-7xl mb-2 md:mb-4">
        <div className="flex justify-center items-center h-14 md:h-16">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-white">Fredan Academy Portal</h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-start items-center text-center w-full">

        {/* Hero */}
        <div className="flex flex-col items-center space-y-1 md:space-y-2 mt-2 md:mt-4">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-400/10 border border-blue-400/20 rounded-full flex items-center justify-center relative mb-1 md:mb-2">
            <div className="absolute inset-0 rounded-full bg-blue-400/5 animate-ping" />
            <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-blue-300" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-snug md:leading-snug">
            Welcome to <span className="bg-gradient-to-r from-blue-300 via-blue-200 to-blue-400 bg-clip-text text-transparent">Fredan Academy</span>
          </h1>
          <p className="text-xs md:text-base text-blue-100/70 font-medium leading-snug max-w-xs md:max-w-xl mt-1 md:mt-2">
            Your gateway to academic excellence. Access courses, track progress, and stay connected.
          </p>
        </div>

        {/* Sign In Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 w-full max-w-2xl mt-3 md:mt-5">

          {/* Student Card */}
          <Card 
            className="group bg-slate-900/50 border-white/5 hover:border-blue-400/50 hover:bg-slate-900/80 transition-all duration-500 cursor-pointer overflow-hidden relative" 
            onClick={() => navigate("/login")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="text-center py-2 md:py-3">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-3 group-hover:scale-105 group-hover:bg-blue-500 transition-all duration-500">
                <Users className="h-5 w-5 md:h-7 md:w-7 text-blue-400 group-hover:text-white" />
              </div>
              <CardTitle className="text-lg md:text-xl font-bold text-white">Student Portal</CardTitle>
              <CardDescription className="text-slate-400 text-xs md:text-sm">
                Access assignments, grades, and academic progress
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-2 md:pb-3">
              <Button size="lg" className="w-full bg-blue-500 hover:bg-blue-400 text-blue-950 font-black h-10 md:h-11 rounded-xl shadow-lg shadow-blue-500/20">
                Student Sign In
              </Button>
            </CardContent>
          </Card>

          {/* Teacher Card */}
          <Card 
            className="group bg-slate-900/50 border-white/5 hover:border-blue-400/50 hover:bg-slate-900/80 transition-all duration-500 cursor-pointer overflow-hidden relative" 
            onClick={() => navigate("/teacher-login")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="text-center py-2 md:py-3">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-3 group-hover:scale-105 group-hover:bg-blue-500 transition-all duration-500">
                <BookOpen className="h-5 w-5 md:h-7 md:w-7 text-blue-400 group-hover:text-white" />
              </div>
              <CardTitle className="text-lg md:text-xl font-bold text-white">Teacher Portal</CardTitle>
              <CardDescription className="text-slate-400 text-xs md:text-sm">
                Manage classes, assignments, and student progress
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-2 md:pb-3">
              <Button size="lg" className="w-full bg-blue-500 hover:bg-blue-400 text-blue-950 font-black h-10 md:h-11 rounded-xl shadow-lg shadow-blue-500/20">
                Teacher Sign In
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features - Swipeable */}
        <div className="mt-2 md:mt-4 w-full max-w-2xl overflow-x-auto no-scrollbar">
          <div className="flex space-x-2 md:space-x-3 py-1 md:py-2">

            {/* Track Progress */}
            <div className="flex-shrink-0 w-40 md:w-48 bg-slate-900/50 rounded-2xl p-2 md:p-3 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-1 md:mb-2">
                <Award className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
              </div>
              <h3 className="text-sm md:text-lg font-bold text-white mb-1">Track Progress</h3>
              <p className="text-xs md:text-sm text-slate-500 leading-snug md:leading-relaxed">Monitor academic performance with analytics and insights</p>
            </div>

            {/* Stay Connected */}
            <div className="flex-shrink-0 w-40 md:w-48 bg-slate-900/50 rounded-2xl p-2 md:p-3 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-1 md:mb-2">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
              </div>
              <h3 className="text-sm md:text-lg font-bold text-white mb-1">Stay Connected</h3>
              <p className="text-xs md:text-sm text-slate-500 leading-snug md:leading-relaxed">Seamless communication between students, teachers, and parents</p>
            </div>

            {/* Manage Learning */}
            <div className="flex-shrink-0 w-40 md:w-48 bg-slate-900/50 rounded-2xl p-2 md:p-3 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-1 md:mb-2">
                <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
              </div>
              <h3 className="text-sm md:text-lg font-bold text-white mb-1">Manage Learning</h3>
              <p className="text-xs md:text-sm text-slate-500 leading-snug md:leading-relaxed">Organize assignments, resources, and schedules efficiently</p>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-2 md:py-4 w-full">
        <div className="text-center px-4">
          <p className="text-slate-400 font-medium text-xs md:text-sm">&copy; 2026 Fredan Academy Portal. All rights reserved.</p>
          <p className="mt-1 text-[10px] md:text-sm text-slate-600 uppercase tracking-widest">Empowering education through technology</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
