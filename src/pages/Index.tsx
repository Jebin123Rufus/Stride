import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { LandingPage } from "@/components/LandingPage";
import { Onboarding } from "@/components/Onboarding";
import { Dashboard } from "@/components/Dashboard";
import { SkillRoadmaps } from "@/components/SkillRoadmaps";
import { LearningModule } from "@/components/LearningModule";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type View = "landing" | "onboarding" | "dashboard" | "roadmaps" | "learning";

interface LearningState {
  skillName: string;
  topic: any;
  subtopic: any;
  roadmap: any;
}

const Index = () => {
  const { user, loading } = useAuthContext();
  const [view, setView] = useState<View>("landing");
  const [profile, setProfile] = useState<any>(null);
  const [selectedPath, setSelectedPath] = useState<any>(null);
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      checkUserProfile();
    } else if (!user && !loading) {
      setView("landing");
    }
  }, [user, loading]);

  const checkUserProfile = async () => {
    if (!user) return;
    
    setIsCheckingProfile(true);
    
    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setProfile(profileData);

      if (!profileData || !profileData.onboarding_completed) {
        setView("onboarding");
      } else {
        // Check if user has selected a path
        const { data: paths } = await supabase
          .from("learning_paths")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_selected", true);

        if (paths && paths.length > 0) {
          const path = paths[0];
          setSelectedPath({
            id: path.id,
            type: path.path_type,
            title: path.title,
            description: path.description || "",
            skills: (path.skills as any) || [],
            estimatedDuration: path.estimated_duration || "",
            marketDemand: "high",
            salaryImpact: "",
          });
          setView("roadmaps");
        } else {
          setView("dashboard");
        }
      }
    } catch (error) {
      console.error("Error checking profile:", error);
      setView("onboarding");
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleOnboardingComplete = () => {
    setView("dashboard");
  };

  const handleSelectPath = (path: any) => {
    setSelectedPath(path);
    setView("roadmaps");
  };

  const handleOpenLearning = (skillName: string, topic: any, subtopic: any, roadmap: any) => {
    setLearningState({ skillName, topic, subtopic, roadmap });
    setView("learning");
  };

  const handleNavigateSubtopic = (subtopic: any) => {
    if (learningState) {
      setLearningState({ ...learningState, subtopic });
    }
  };

  if (loading || isCheckingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  switch (view) {
    case "landing":
      return <LandingPage />;
    
    case "onboarding":
      return <Onboarding onComplete={handleOnboardingComplete} />;
    
    case "dashboard":
      return <Dashboard onSelectPath={handleSelectPath} />;
    
    case "roadmaps":
      return selectedPath ? (
        <SkillRoadmaps
          selectedPath={selectedPath}
          onBack={() => setView("dashboard")}
          onOpenLearning={handleOpenLearning}
        />
      ) : (
        <Dashboard onSelectPath={handleSelectPath} />
      );
    
    case "learning":
      return learningState ? (
        <LearningModule
          skillName={learningState.skillName}
          topic={learningState.topic}
          subtopic={learningState.subtopic}
          roadmap={learningState.roadmap}
          dreamJob={profile?.dream_job || ""}
          onBack={() => setView("roadmaps")}
          onNavigate={handleNavigateSubtopic}
        />
      ) : (
        <SkillRoadmaps
          selectedPath={selectedPath}
          onBack={() => setView("dashboard")}
          onOpenLearning={handleOpenLearning}
        />
      );
    
    default:
      return <LandingPage />;
  }
};

export default Index;
