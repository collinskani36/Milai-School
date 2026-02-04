import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#f6f2f2] via-[#fdfbfb] to-[#f3eded] p-3 md:p-6 overflow-hidden">

      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-xl border border-[#7a1f2b]/10 rounded-2xl w-full max-w-7xl mb-2 md:mb-4 shadow-sm">
        <div className="flex justify-center items-center h-14 md:h-16">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-[#7a1f2b] rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-[#3a1b1f]">
              Milai School Portal
            </h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-start items-center text-center w-full">

        {/* Hero */}
        <div className="flex flex-col items-center space-y-1 md:space-y-2 mt-2 md:mt-4">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-[#7a1f2b]/10 border border-[#7a1f2b]/20 rounded-full flex items-center justify-center relative mb-1 md:mb-2">
            <div className="absolute inset-0 rounded-full bg-[#7a1f2b]/5 animate-ping" />
            <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-[#7a1f2b]" />
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-[#3a1b1f] tracking-tight leading-snug md:leading-snug">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-[#7a1f2b] via-[#9b2c3a] to-[#7a1f2b] bg-clip-text text-transparent">
              Milai School
            </span>
          </h1>

          <p className="text-xs md:text-base text-[#6b4b50] font-medium leading-snug max-w-xs md:max-w-xl mt-1 md:mt-2">
            Your gateway to academic excellence. Access courses, track progress, and stay connected.
          </p>
        </div>

        {/* Sign In Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 w-full max-w-2xl mt-3 md:mt-5">

          {/* Student Card */}
          <Card
            className="group bg-white border border-[#7a1f2b]/10 hover:border-[#7a1f2b]/30 transition-all duration-500 cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md"
            onClick={() => navigate("/login")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#7a1f2b]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="text-center py-2 md:py-3">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-[#f6f2f2] rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-3 group-hover:scale-105 group-hover:bg-[#7a1f2b] transition-all duration-500">
                <Users className="h-5 w-5 md:h-7 md:w-7 text-[#7a1f2b] group-hover:text-white" />
              </div>
              <CardTitle className="text-lg md:text-xl font-bold text-[#3a1b1f]">
                Student Portal
              </CardTitle>
              <CardDescription className="text-[#6b4b50] text-xs md:text-sm">
                Access assignments, grades, and academic progress
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-2 md:pb-3">
              <Button
                size="lg"
                className="w-full bg-[#7a1f2b] hover:bg-[#6a1a24] text-white font-black h-10 md:h-11 rounded-xl shadow-md"
              >
                Student Sign In
              </Button>
            </CardContent>
          </Card>

          {/* Teacher Card */}
          <Card
            className="group bg-white border border-[#7a1f2b]/10 hover:border-[#7a1f2b]/30 transition-all duration-500 cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md"
            onClick={() => navigate("/teacher-login")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#7a1f2b]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="text-center py-2 md:py-3">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-[#f6f2f2] rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-3 group-hover:scale-105 group-hover:bg-[#7a1f2b] transition-all duration-500">
                <BookOpen className="h-5 w-5 md:h-7 md:w-7 text-[#7a1f2b] group-hover:text-white" />
              </div>
              <CardTitle className="text-lg md:text-xl font-bold text-[#3a1b1f]">
                Teacher Portal
              </CardTitle>
              <CardDescription className="text-[#6b4b50] text-xs md:text-sm">
                Manage classes, assignments, and student progress
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-2 md:pb-3">
              <Button
                size="lg"
                className="w-full bg-[#7a1f2b] hover:bg-[#6a1a24] text-white font-black h-10 md:h-11 rounded-xl shadow-md"
              >
                Teacher Sign In
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-2 md:mt-4 w-full max-w-2xl overflow-x-auto no-scrollbar">
          <div className="flex space-x-2 md:space-x-3 py-1 md:py-2">

            {[
              { icon: Award, title: "Track Progress", desc: "Monitor academic performance with analytics and insights" },
              { icon: Users, title: "Stay Connected", desc: "Seamless communication between students, teachers, and parents" },
              { icon: BookOpen, title: "Manage Learning", desc: "Organize assignments, resources, and schedules efficiently" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex-shrink-0 w-40 md:w-48 bg-white rounded-2xl p-2 md:p-3 text-center border border-[#7a1f2b]/10 shadow-sm">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[#7a1f2b]/10 border border-[#7a1f2b]/20 rounded-2xl flex items-center justify-center mx-auto mb-1 md:mb-2">
                  <Icon className="h-5 w-5 md:h-6 md:w-6 text-[#7a1f2b]" />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-[#3a1b1f] mb-1">{title}</h3>
                <p className="text-xs md:text-sm text-[#6b4b50] leading-snug md:leading-relaxed">{desc}</p>
              </div>
            ))}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#7a1f2b]/10 py-2 md:py-4 w-full bg-white/70">
        <div className="text-center px-4">
          <p className="text-[#6b4b50] font-medium text-xs md:text-sm">
            &copy; 2026 Milai School Portal. All rights reserved.
          </p>
          <p className="mt-1 text-[10px] md:text-sm text-[#9b7a7f] uppercase tracking-widest">
            Empowering education through technology
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
