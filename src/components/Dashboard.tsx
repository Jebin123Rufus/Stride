import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Target,
  Rocket,
  Clock,
  TrendingUp,
  DollarSign,
  Check,
  ArrowRight,
  Loader2,
  ChevronRight,
  LogOut,
  BookOpen,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Skill {
  name: string;
  priority: "high" | "medium" | "low";
  estimatedHours: number;
}

interface LearningPath {
  id?: string;
  type: string;
  title: string;
  description: string;
  skills: Skill[];
  estimatedDuration: string;
  marketDemand: string;
  salaryImpact: string;
  is_selected?: boolean;
}

interface DashboardProps {
  onSelectPath: (path: LearningPath) => void;
}

export function Dashboard({ onSelectPath }: DashboardProps) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  
  const { user, signOut } = useAuthContext();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile(profileData);

      // Fetch existing learning paths
      const { data: pathsData } = await supabase
        .from("learning_paths")
        .select("*")
        .eq("user_id", user.id);

      if (pathsData && pathsData.length > 0) {
        const pathOrder = ["easier", "recommended", "professional"];
        const formattedPaths = pathsData
          .map((p) => ({
            id: p.id,
            type: p.path_type,
            title: p.title,
            description: p.description || "",
            skills: (p.skills as any) || [],
            estimatedDuration: p.estimated_duration || "",
            marketDemand: "high",
            salaryImpact: "",
            is_selected: p.is_selected,
          }))
          .sort((a, b) => pathOrder.indexOf(a.type) - pathOrder.indexOf(b.type));
        
        setPaths(formattedPaths);
        
        // Find if any is already selected in DB
        let selected = formattedPaths.find((p) => p.is_selected);
        
        // If none is selected in DB (first time load), default to recommended
        if (!selected) {
          selected = formattedPaths.find(p => p.type === 'recommended') || formattedPaths[0];
        }
        
        if (selected) {
          setSelectedPath(selected);
        }
        
        console.log("Loaded paths from DB:", pathsData.length);
      } else {
        // Generate new paths
        console.log("Generating fresh AI paths...");
        await generatePaths(profileData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (isFullWipe = false) => {
    const msg = isFullWipe 
      ? "This will delete ALL your progress, skills, and roadmaps. Continue?" 
      : "This will delete your current paths so you can choose a new Goal/Skills. Continue?";
    
    if (!confirm(msg)) return;
    
    try {
      // Always delete paths and roadmaps
      await supabase.from('learning_paths').delete().eq('user_id', user!.id);
      await supabase.from('skill_roadmaps').delete().eq('user_id', user!.id);
      await supabase.from('topic_progress').delete().eq('user_id', user!.id);
      
      if (isFullWipe) {
        await supabase.from('user_skills').delete().eq('user_id', user!.id);
        await supabase.from('profiles').delete().eq('user_id', user!.id);
      } else {
        // Reset onboarding flag so they go back to Step 1/2/3
        await supabase.from('profiles').update({ onboarding_completed: false }).eq('user_id', user!.id);
      }
      
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    }
  };

  const generatePaths = async (profileData: any) => {
    if (!user || !profileData?.dream_job) return;

    setIsGenerating(true);

    try {
      // Get user skills
      const { data: skillsData } = await supabase
        .from("user_skills")
        .select("skill_name")
        .eq("user_id", user.id);

      const currentSkills = skillsData?.map((s) => s.skill_name) || [];

      const response = await supabase.functions.invoke("generate-learning-paths", {
        body: {
          dreamJob: profileData.dream_job,
          currentSkills,
          mock: false, // Set to true for quick debug
        },
      });

      if (response.error) throw response.error;
      if (!response.data || !response.data.paths) {
        console.error("Malformed response or API Error:", JSON.stringify(response.data, null, 2));
        throw new Error("AI returned an invalid response format. Please try again.");
      }

      const generatedPaths = response.data.paths;

      // Save paths to database
      const pathsToInsert = generatedPaths.map((p: any) => ({
        user_id: user.id,
        path_type: p.type,
        title: p.title,
        description: p.description,
        skills: p.skills,
        estimated_duration: p.estimatedDuration,
      }));

      const { data: insertedPaths, error: insertError } = await supabase
        .from("learning_paths")
        .insert(pathsToInsert)
        .select();

      if (insertError) throw insertError;

      const pathOrder = ["easier", "recommended", "professional"];
      const formattedPaths = insertedPaths
        .map((p: any) => ({
          id: p.id,
          type: p.path_type,
          title: p.title,
          description: p.description || "",
          skills: p.skills || [],
          estimatedDuration: p.estimated_duration || "",
          marketDemand: generatedPaths.find((gp: any) => gp.type === p.path_type)?.marketDemand || "high",
          salaryImpact: generatedPaths.find((gp: any) => gp.type === p.path_type)?.salaryImpact || "",
        }))
        .sort((a, b) => pathOrder.indexOf(a.type) - pathOrder.indexOf(b.type));

      setPaths(formattedPaths);
      
      // Auto-select recommended path immediately after generation
      const recommended = formattedPaths.find(p => p.type === 'recommended') || formattedPaths[0];
      if (recommended) {
        setSelectedPath(recommended);
      }
    } catch (error: any) {
      console.error("Error generating paths:", error);
      
      // Try to get more detailed info from the error object
      const context = error?.context;
      if (context) {
        console.log("Error Context:", context);
        try {
          const body = await context.json();
          console.log("Error JSON body:", body);
        } catch (e) {
          // Body might not be JSON
        }
      }

      toast({
        title: "Error generating paths",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectPath = async (path: LearningPath) => {
    if (!user || !path.id) return;

    try {
      // Deselect all paths first
      await supabase
        .from("learning_paths")
        .update({ is_selected: false })
        .eq("user_id", user.id);

      // Select the chosen path
      await supabase
        .from("learning_paths")
        .update({ is_selected: true })
        .eq("id", path.id);

      setSelectedPath(path);
      onSelectPath(path);
    } catch (error) {
      console.error("Error selecting path:", error);
    }
  };

  const getPathIcon = (type: string) => {
    switch (type) {
      case "recommended":
        return Target;
      case "easier":
        return BookOpen;
      case "professional":
        return Rocket;
      default:
        return Target;
    }
  };

  const getPathGradient = (type: string) => {
    switch (type) {
      case "recommended":
        return "from-primary to-primary/80";
      case "easier":
        return "from-success to-success/80";
      case "professional":
        return "from-warning to-warning/80";
      default:
        return "from-primary to-primary/80";
    }
  };

  if (isLoading || isGenerating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {isGenerating ? "Generating Your Learning Paths" : "Loading..."}
          </h2>
          <p className="text-muted-foreground">
            {isGenerating ? "AI is analyzing market trends and your skill gap..." : "Please wait..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 h-20 flex items-center">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center group cursor-pointer relative">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Stride Logo" 
                className="absolute h-32 w-auto max-w-[200%] object-contain transition-transform group-hover:scale-105" 
              />
            </div>
            <span className="text-4xl md:text-5xl font-black italic tracking-tighter text-primary drop-shadow-md leading-none ml-6">
              STRIDE
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground hidden xl:inline">
              Welcome, {profile?.full_name || "Learner"}
            </span>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleReset(false)}
                className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                title="Choose a new career goal or update your skills"
              >
                <Target className="w-4 h-4" />
                Change Goal
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleReset(true)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors gap-2"
                title="Wipe all data and start completely fresh"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Wipe Data</span>
              </Button>

              <div className="h-4 w-[1px] bg-border mx-1" />

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={signOut}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold mb-4">
              Your Path to{" "}
              <span className="text-gradient-primary">{profile?.dream_job}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We've analyzed your skills and market trends to create three personalized
              learning paths. Choose the one that fits your goals.
            </p>
          </motion.div>
        </div>

        {/* Learning Paths */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {paths.map((path, index) => {
            const Icon = getPathIcon(path.type);
            const isSelected = selectedPath?.id === path.id;

            return (
              <motion.div
                key={path.id || path.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`relative overflow-hidden p-6 h-full cursor-pointer transition-all hover:shadow-lg ${
                    isSelected ? "ring-2 ring-primary shadow-glow" : ""
                  }`}
                  onClick={() => handleSelectPath(path)}
                >
                  {/* Gradient header */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getPathGradient(
                      path.type
                    )}`}
                  />

                  {/* Path type badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getPathGradient(
                        path.type
                      )} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <Badge
                      variant={
                        path.type === "recommended"
                          ? "default"
                          : path.type === "easier"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {path.type.charAt(0).toUpperCase() + path.type.slice(1)}
                    </Badge>
                  </div>

                  <h3 className="text-xl font-semibold mb-2">{path.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{path.description}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-2 text-sm mb-4">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span>{path.marketDemand} demand</span>
                  </div>

                  {/* Skills preview */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Skills you'll learn:</h4>
                    <div className="flex flex-wrap gap-1">
                      {path.skills.slice(0, 4).map((skill) => (
                        <Badge key={skill.name} variant="secondary" className="text-xs">
                          {skill.name}
                        </Badge>
                      ))}
                      {path.skills.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{path.skills.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Select button */}
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    className="w-full mt-auto"
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      <>
                        Select Path
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Continue button */}
        {selectedPath && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Button
              variant="hero"
              size="xl"
              onClick={() => onSelectPath(selectedPath)}
            >
              Continue to Roadmaps
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
