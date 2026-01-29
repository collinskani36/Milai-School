import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    // Deep Midnight Gradient Background
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] p-4 md:p-8">
      
      {/* Header - Glassmorphism with deep border */}
      <nav className="bg-slate-900/40 backdrop-blur-xl border-b border-white/5 rounded-2xl max-w-7xl mx-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Fredan Academy Portal</h1>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-20 md:py-28">
        <div className="text-center">
          <div className="w-24 h-24 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/5 animate-pulse" />
            <GraduationCap className="h-12 w-12 text-blue-400" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tighter">
            Welcome to <span className="bg-gradient-to-b from-blue-400 to-blue-700 bg-clip-text text-transparent">Fredan Academy</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Your gateway to academic excellence. Access your courses, track progress, and stay connected with your educational community.
          </p>

          {/* Sign In Cards - High Depth Design */}
          <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto mb-16 md:grid-cols-2 md:mb-24">
            
            {/* FIXED: Navigates to /login to stop flicker */}
            <Card 
              className="group bg-slate-900/50 border-white/5 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all duration-500 cursor-pointer overflow-hidden relative" 
              onClick={() => navigate("/login")} 
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="text-center pb-6">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-500">
                  <Users className="h-10 w-10 text-blue-400 group-hover:text-white" />
                </div>
                <CardTitle className="text-3xl font-bold text-white">Student Portal</CardTitle>
                <CardDescription className="text-slate-400 text-lg">
                  Access assignments, grades, and academic progress
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-xl shadow-lg shadow-blue-900/20">
                  Student Sign In
                </Button>
              </CardContent>
            </Card>

            {/* FIXED: Navigates to /teacher-login to stop flicker */}
            <Card 
              className="group bg-slate-900/50 border-white/5 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all duration-500 cursor-pointer overflow-hidden relative" 
              onClick={() => navigate("/teacher-login")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="text-center pb-6">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-500">
                  <BookOpen className="h-10 w-10 text-blue-400 group-hover:text-white" />
                </div>
                <CardTitle className="text-3xl font-bold text-white">Teacher Portal</CardTitle>
                <CardDescription className="text-slate-400 text-lg">
                  Manage classes, assignments, and student progress
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-xl shadow-lg shadow-blue-900/20">
                  Teacher Sign In
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 gap-12 max-w-5xl mx-auto md:grid-cols-3">
            <div className="text-center group">
              <div className="w-14 h-14 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Award className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Track Progress</h3>
              <p className="text-slate-500 leading-relaxed">Monitor academic performance with detailed analytics and insights</p>
            </div>
            
            <div className="text-center group">
              <div className="w-14 h-14 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Users className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Stay Connected</h3>
              <p className="text-slate-500 leading-relaxed">Seamless communication between students, teachers, and parents</p>
            </div>
            
            <div className="text-center group">
              <div className="w-14 h-14 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/20 transition-colors">
                <BookOpen className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Manage Learning</h3>
              <p className="text-slate-500 leading-relaxed">Organize assignments, resources, and schedules efficiently</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 font-medium">&copy; 2026 Fredan Academy Portal. All rights reserved.</p>
          <p className="mt-2 text-sm text-slate-600 uppercase tracking-widest">Empowering education through technology</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;