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
  const [content, setContent] = useState<string>(subtopic.content || "");
  const [isLoading, setIsLoading] = useState(!subtopic.content);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  
  const { user, signOut } = useAuthContext();
  const { toast } = useToast();

  // Find current position in topic
  const currentIndex = topic.subtopics.findIndex((s) => s.id === subtopic.id);
  const prevSubtopic = currentIndex > 0 ? topic.subtopics[currentIndex - 1] : null;
  const nextSubtopic =
    currentIndex < topic.subtopics.length - 1 ? topic.subtopics[currentIndex + 1] : null;

  useEffect(() => {
    if (!subtopic.content) {
      generateContent();
    }
    checkCompletion();
  }, [subtopic.id]);

  const generateContent = async () => {
    setIsLoading(true);
    
    try {
      const response = await supabase.functions.invoke("generate-learning-content", {
        body: {
          skillName,
          topicTitle: topic.title,
          subtopicTitle: subtopic.title,
          dreamJob,
        },
      });

      if (response.error) throw response.error;

      setContent(response.data.content);
    } catch (error) {
      console.error("Error generating content:", error);
      toast({
        title: "Error loading content",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  // Calculate topic progress
  const completedSubtopics = topic.subtopics.filter((s, i) => i <= currentIndex).length;
  const topicProgress = (completedSubtopics / topic.subtopics.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="text-lg font-bold">{skillName}</span>
                  <p className="text-xs text-muted-foreground">{topic.title}</p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Topic Progress</span>
              <span className="font-medium">{Math.round(topicProgress)}%</span>
            </div>
            <Progress value={topicProgress} className="h-2" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span>{skillName}</span>
          <ChevronRight className="w-4 h-4" />
          <span>{topic.title}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{subtopic.title}</span>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Badge variant="secondary" className="mb-2">
                  <Clock className="w-3 h-3 mr-1" />
                  {subtopic.estimatedMinutes} min
                </Badge>
                <h1 className="text-3xl font-bold">{subtopic.title}</h1>
                <p className="text-muted-foreground mt-2">{subtopic.description}</p>
              </div>
              {isCompleted && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-medium">Completed</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Generating personalized content...</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[60vh]">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Action buttons */}
            <div className="border-t border-border pt-6 mt-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => prevSubtopic && onNavigate(prevSubtopic)}
                  disabled={!prevSubtopic}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <Button
                  variant={isCompleted ? "secondary" : "default"}
                  onClick={markAsComplete}
                  disabled={isCompleted || isMarkingComplete}
                >
                  {isMarkingComplete ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : isCompleted ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : null}
                  {isCompleted ? "Completed" : "Mark as Complete"}
                </Button>

                <Button
                  variant={nextSubtopic ? "default" : "outline"}
                  onClick={() => nextSubtopic && onNavigate(nextSubtopic)}
                  disabled={!nextSubtopic}
                >
                  {nextSubtopic ? "Next" : "End of Topic"}
                  {nextSubtopic && <ChevronRight className="w-4 h-4 ml-2" />}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
