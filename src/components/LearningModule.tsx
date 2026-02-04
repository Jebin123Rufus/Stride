import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  BookOpen,
  CheckCircle2,
  Sparkles,
  LogOut,
  Layout,
  Code,
  CheckCircle,
  HelpCircle,
  Circle,
  Play,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Subtopic {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  content: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  subtopics: Subtopic[];
}

interface Roadmap {
  id?: string;
  skillName: string;
  totalEstimatedHours: number;
  topics: Topic[];
}

interface LearningModuleProps {
  skillName: string;
  topic: Topic;
  subtopic: Subtopic;
  roadmap: Roadmap;
  dreamJob: string;
  onBack: () => void;
  onNavigate: (subtopic: Subtopic) => void;
}

export function LearningModule({
  skillName,
  topic,
  subtopic,
  roadmap,
  dreamJob,
  onBack,
  onNavigate,
}: LearningModuleProps) {
  const [sections, setSections] = useState<string[]>([]);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [sectionContent, setSectionContent] = useState<Record<string, string>>({});
  const [isSectionLoading, setIsSectionLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  
  const { user, signOut } = useAuthContext();
  const { toast } = useToast();

  const currentIndex = topic.subtopics.findIndex((s) => s.id === subtopic.id);
  const prevSubtopic = currentIndex > 0 ? topic.subtopics[currentIndex - 1] : null;
  const nextSubtopic =
    currentIndex < topic.subtopics.length - 1 ? topic.subtopics[currentIndex + 1] : null;

  useEffect(() => {
    generateContent();
    checkCompletion();
  }, [subtopic.id]);

  const generateContent = async () => {
    setIsLoading(true);
    console.log("🚀 Stride AI: Requesting content for:", subtopic.title);
    setSections([]);
    setCurrentSection(null);
    setSectionContent({});
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-learning-content", {
        body: {
          skillName,
          subtopicTitle: subtopic.title,
        },
      });

      if (error) throw error;

      console.log("📥 Stride AI: Received Data:", data);

      if (data && data.sections) {
        setSections(data.sections || []);
        
        const firstSection = data.sections?.[0];
        if (firstSection) {
          setCurrentSection(firstSection);
          if (data.firstSectionContent) {
            setSectionContent({ [firstSection]: data.firstSectionContent });
          }
        }
      } else {
        throw new Error("Invalid data format received - 'sections' missing");
      }
    } catch (e: any) {
      console.error("❌ Stride AI: Generation error:", e);
      toast({
        title: "Content Generation Failed",
        description: e.message || "Failed to load lesson content.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSectionClick = async (section: string) => {
    if (sectionContent[section]) {
      setCurrentSection(section);
      return;
    }

    setCurrentSection(section);
    setIsSectionLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-learning-content", {
        body: {
          skillName,
          subtopicTitle: subtopic.title,
          section: section,
        },
      });

      if (error) throw error;
      if (data) {
        setSectionContent(prev => ({ ...prev, [section]: data.content }));
      }
    } catch (e: any) {
      console.error("Section fetch error:", e);
    } finally {
      setIsSectionLoading(false);
    }
  };

  const checkCompletion = async () => {
    if (!user || !roadmap.id) return;

    const { data } = await supabase
      .from("topic_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("roadmap_id", roadmap.id)
      .eq("topic_id", topic.id)
      .eq("subtopic_id", subtopic.id)
      .maybeSingle();

    setIsCompleted(data?.is_completed || false);
  };

  const markAsComplete = async () => {
    if (!user || !roadmap.id) return;

    setIsMarkingComplete(true);

    try {
      const { error } = await supabase
        .from("topic_progress")
        .upsert({
          user_id: user.id,
          roadmap_id: roadmap.id,
          topic_id: topic.id,
          subtopic_id: subtopic.id,
          is_completed: true,
          completion_percentage: 100,
          completed_at: new Date().toISOString(),
        });

      if (error) throw error;

      setIsCompleted(true);
      toast({
        title: "Module completed!",
        description: "Great job! Keep up the learning momentum.",
      });
    } catch (error) {
      console.error("Error marking complete:", error);
      toast({
        title: "Error",
        description: "Could not save progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingComplete(false);
    }
  };

  const topicProgress = ((currentIndex + 1) / topic.subtopics.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 h-20 flex items-center">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center group relative">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <img 
                    src="/logo.png" 
                    alt="Stride Logo" 
                    className="absolute h-24 w-auto max-w-[200%] object-contain" 
                  />
                </div>
                <div className="flex flex-col ml-4">
                  <span className="text-3xl font-black italic tracking-tighter text-primary drop-shadow-sm leading-tight">STRIDE</span>
                  <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 leading-none -mt-0.5 ml-1">{topic.title}</p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Course Progress</span>
              <span className="font-medium">{Math.round(topicProgress)}%</span>
            </div>
            <Progress value={topicProgress} className="h-2" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span>{skillName}</span>
          <ChevronRight className="w-4 h-4" />
          <span>{topic.title}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{subtopic.title}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-border/50 shadow-xl bg-card/80 backdrop-blur-md">
            <div className="p-8 pb-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{subtopic.title}</h1>
                  <p className="text-muted-foreground mt-2">{subtopic.description}</p>
                </div>
                {isCompleted && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full border border-success/20">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold text-sm">Step Completed</span>
                  </div>
                )}
              </div>

              <div className="w-full pt-6 border-t border-border/50">
                <div className="min-h-[300px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                      <p className="text-muted-foreground mt-4 text-sm animate-pulse">Syncing concepts...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-2 text-primary font-semibold text-sm mb-2">
                         <BookOpen className="w-4 h-4" /> Learning Pillars
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sections.map((section) => (
                          <Button
                            key={section}
                            variant={currentSection === section ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSectionClick(section)}
                            className="rounded-full px-4 text-xs font-semibold"
                          >
                            {section}
                          </Button>
                        ))}
                      </div>

                      <div className="bg-muted/30 rounded-2xl p-8 border border-border/50 min-h-[200px]">
                        {isSectionLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 opacity-50">
                            <Loader2 className="w-6 h-6 animate-spin mb-2" />
                            <p className="text-xs">Processing insight...</p>
                          </div>
                        ) : currentSection && sectionContent[currentSection] ? (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="prose prose-blue dark:prose-invert max-w-none 
                                     prose-p:leading-relaxed prose-p:mb-6 
                                     prose-headings:text-primary prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4
                                     prose-strong:text-primary prose-strong:font-black
                                     prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                                     prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-border prose-pre:shadow-2xl
                                     prose-li:marker:text-primary prose-li:mb-2
                                     whitespace-pre-wrap"
                          >
                            <ReactMarkdown>{sectionContent[currentSection]}</ReactMarkdown>
                          </motion.div>
                        ) : (
                          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm italic">
                            Select a pillar above to explore.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-muted/30 border-t border-border px-8 py-6 flex items-center justify-between">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6"
                onClick={() => prevSubtopic && onNavigate(prevSubtopic)}
                disabled={!prevSubtopic}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <Button
                size="lg"
                className={`rounded-full px-10 transition-all duration-300 shadow-lg ${
                  isCompleted ? "bg-success hover:bg-success/90" : "bg-primary hover:scale-105"
                }`}
                onClick={markAsComplete}
                disabled={isCompleted || isMarkingComplete}
              >
                {isMarkingComplete ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : isCompleted ? (
                  <CheckCircle className="w-5 h-5 animate-bounce mr-2" />
                ) : (
                  <Sparkles className="w-5 h-5 mr-2" />
                )}
                {isCompleted ? "Step Completed" : "Mark as Mastered"}
              </Button>

              <Button
                variant={nextSubtopic ? "default" : "outline"}
                size="lg"
                className="rounded-full px-6"
                onClick={() => nextSubtopic && onNavigate(nextSubtopic)}
                disabled={!nextSubtopic}
              >
                {nextSubtopic ? (
                  <>
                    Next Step
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  "Course End"
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
