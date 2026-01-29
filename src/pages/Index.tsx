import { Button } from "@/Components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const isAppMode =
    typeof window !== "undefined" &&
    (window as any).__APP_MODE__ === true;

  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8">
      {/* Header */}
      <nav className="bg-slate-900/40 backdrop-blur-xl border-b border-white/5 rounded-2xl max-w-7xl mx-auto">
        <div className="flex justify-center items-center h-20">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Fredan Academy Portal
            </h1>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto py-20 text-center">
        <h1 className="text-5xl font-extrabold text-white mb-6">
          Welcome to{" "}
          <span className="text-blue-400">Fredan Academy</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto mb-16">
          Access your courses, track progress, and stay connected with your
          educational community.
        </p>

        {/* Login cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          <Card onClick={() => navigate("/login")} className="cursor-pointer">
            <CardHeader className="text-center">
              <Users className="mx-auto text-blue-400 h-10 w-10 mb-4" />
              <CardTitle className="text-white">Student Portal</CardTitle>
              <CardDescription>
                Assignments, grades & progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Student Sign In</Button>
            </CardContent>
          </Card>

          <Card
            onClick={() => navigate("/teacher-login")}
            className="cursor-pointer"
          >
            <CardHeader className="text-center">
              <BookOpen className="mx-auto text-blue-400 h-10 w-10 mb-4" />
              <CardTitle className="text-white">Teacher Portal</CardTitle>
              <CardDescription>
                Manage classes & students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Teacher Sign In</Button>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        {isAppMode ? (
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-6">
            {[ 
              { icon: Award, title: "Track Progress", text: "Detailed academic analytics" },
              { icon: Users, title: "Stay Connected", text: "Students, teachers & parents" },
              { icon: BookOpen, title: "Manage Learning", text: "Assignments & schedules" },
            ].map((item, i) => (
              <div
                key={i}
                className="min-w-[80%] snap-center bg-slate-900/60 border border-white/5 rounded-2xl p-6"
              >
                <item.icon className="text-blue-400 h-8 w-8 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <Feature icon={Award} title="Track Progress" />
            <Feature icon={Users} title="Stay Connected" />
            <Feature icon={BookOpen} title="Manage Learning" />
          </div>
        )}
      </div>
    </div>
  );
};

const Feature = ({
  icon: Icon,
  title,
}: {
  icon: any;
  title: string;
}) => (
  <div className="text-center">
    <Icon className="mx-auto text-blue-400 h-8 w-8 mb-4" />
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-500">
      Designed for modern academic workflows
    </p>
  </div>
);

export default Index;
