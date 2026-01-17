import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-hero-bg to-accent/10 p-4 md:p-8">
      {/* Header */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Milai School Portal</h1>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-0 sm:px-4 lg:px-8 py-16 md:py-20">
        <div className="text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
            <GraduationCap className="h-12 w-12 text-primary" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 md:mb-6">
            Welcome to <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Milai School</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-full sm:max-w-2xl mx-auto px-2">
            Your gateway to academic excellence. Access your courses, track progress, and stay connected with your educational community.
          </p>

          {/* Sign In Cards */}
          <div className="grid grid-cols-1 gap-6 max-w-full mx-auto sm:max-w-4xl mb-12 md:grid-cols-2 md:gap-8 md:mb-16">
            <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-1 p-4 md:p-6" onClick={() => navigate("/student-dashboard")}>
              <CardHeader className="text-center pb-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Student Portal</CardTitle>
                <CardDescription className="text-base">
                  Access assignments, grades, and academic progress
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button size="lg" className="w-full py-2 px-4 group-hover:bg-primary/90">
                  Student Sign In
                </Button>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-1 p-4 md:p-6" onClick={() => navigate("/teacher-dashboard")}>
              <CardHeader className="text-center pb-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Teacher Portal</CardTitle>
                <CardDescription className="text-base">
                  Manage classes, assignments, and student progress
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button size="lg" className="w-full py-2 px-4 group-hover:bg-primary/90">
                  Teacher Sign In
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 gap-6 max-w-full mx-auto sm:max-w-5xl md:grid-cols-3 md:gap-8">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Award className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Track Progress</h3>
              <p className="text-muted-foreground">Monitor academic performance with detailed analytics and insights</p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-info/10 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Users className="h-6 w-6 text-info" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Stay Connected</h3>
              <p className="text-muted-foreground">Seamless communication between students, teachers, and parents</p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-warning/10 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <BookOpen className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Manage Learning</h3>
              <p className="text-muted-foreground">Organize assignments, resources, and schedules efficiently</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card/50 border-t border-border mt-20">
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8 py-6 md:py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2025 Milai School Portal. All rights reserved.</p>
            <p className="mt-2 text-sm">Empowering education through technology</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
