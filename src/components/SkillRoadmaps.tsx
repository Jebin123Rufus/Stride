import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Circle,
  BookOpen,
  Loader2,
  LogOut,
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
}

interface Topic {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  subtopics: Subtopic[];
}

interface Subtopic {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  content: string;
}

interface Roadmap {
  id?: string;
  skillName: string;
  totalEstimatedHours: number;
  topics: Topic[];
}

interface SkillRoadmapsProps {
  selectedPath: LearningPath;
  onBack: () => void;
  onOpenLearning: (skill: string, topic: Topic, subtopic: Subtopic, roadmap: Roadmap) => void;
}

export function SkillRoadmaps({ selectedPath, onBack, onOpenLearning }: SkillRoadmapsProps) {
  const [roadmaps, setRoadmaps] = useState<Map<string, Roadmap>>(new Map());
  const [loadingSkill, setLoadingSkill] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  const [completedSubtopics, setCompletedSubtopics] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<any>(null);
  
  const { user, signOut } = useAuthContext();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchExistingRoadmaps();
      fetchProgress();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile(data);
  };

  const fetchExistingRoadmaps = async () => {
    if (!user || !selectedPath.id) return;

    const { data } = await supabase
      .from("skill_roadmaps")
      .select("*")
      .eq("user_id", user.id)
      .eq("learning_path_id", selectedPath.id);

    if (data) {
      const roadmapMap = new Map<string, Roadmap>();
      data.forEach((r) => {
        roadmapMap.set(r.skill_name, {
          id: r.id,
          skillName: r.skill_name,
          ...(r.roadmap_data as any),
        });
      });
      setRoadmaps(roadmapMap);
    }
  };

  const fetchProgress = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("topic_progress")
      .select("*, skill_roadmaps!inner(skill_name)")
      .eq("user_id", user.id);

    if (data) {
      // Track completed subtopics
      const completed = new Set<string>();
      const progressMap = new Map<string, number>();
      const skillSubtopics = new Map<string, { total: number; completed: number }>();

      data.forEach((p: any) => {
        const skillName = p.skill_roadmaps.skill_name;
        if (p.is_completed && p.subtopic_id) {
          completed.add(`${skillName}-${p.topic_id}-${p.subtopic_id}`);
        }
        
        if (!skillSubtopics.has(skillName)) {
          skillSubtopics.set(skillName, { total: 0, completed: 0 });
        }
        const current = skillSubtopics.get(skillName)!;
        current.total++;
        if (p.is_completed) current.completed++;
      });

      skillSubtopics.forEach((value, key) => {
        progressMap.set(key, Math.round((value.completed / value.total) * 100));
      });

      setCompletedSubtopics(completed);
      setProgress(progressMap);
    }
  };

  const generateRoadmap = async (skillName: string) => {
    if (!user || !selectedPath.id) return;

    setLoadingSkill(skillName);

    try {
      const response = await supabase.functions.invoke("generate-roadmap", {
        body: {
          skillName,
          dreamJob: profile?.dream_job || selectedPath.title,
        },
      });

      if (response.error) throw response.error;

      const roadmapData = response.data;

      // Save to database
      const { data: savedRoadmap, error } = await supabase
        .from("skill_roadmaps")
        .insert({
          user_id: user.id,
          learning_path_id: selectedPath.id,
          skill_name: skillName,
          roadmap_data: roadmapData,
        })
        .select()
        .single();

      if (error) throw error;

      const roadmap: Roadmap = {
        id: savedRoadmap.id,
        skillName,
        ...roadmapData,
      };

      setRoadmaps((prev) => new Map(prev).set(skillName, roadmap));
      setExpandedSkill(skillName);

      toast({
        title: "Roadmap generated!",
        description: `Your learning roadmap for ${skillName} is ready.`,
      });
    } catch (error) {
      console.error("Error generating roadmap:", error);
      toast({
        title: "Error generating roadmap",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingSkill(null);
    }
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/30";
      case "medium":
        return "bg-warning/10 text-warning border-warning/30";
      case "low":
        return "bg-success/10 text-success border-success/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const isSubtopicCompleted = (skillName: string, topicId: string, subtopicId: string) => {
    return completedSubtopics.has(`${skillName}-${topicId}-${subtopicId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <span className="text-lg font-bold">SkillPath Pro</span>
                <p className="text-xs text-muted-foreground">{selectedPath.title}</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Skill Roadmaps</h1>
          <p className="text-muted-foreground">
            Click on a skill to generate its detailed learning roadmap.
          </p>
        </div>

        <div className="space-y-4">
          {selectedPath.skills.map((skill, index) => {
            const roadmap = roadmaps.get(skill.name);
            const skillProgress = progress.get(skill.name) || 0;
            const isExpanded = expandedSkill === skill.name;
            const isLoading = loadingSkill === skill.name;

            return (
              <motion.div
                key={skill.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="overflow-hidden">
                  {/* Skill header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      if (roadmap) {
                        setExpandedSkill(isExpanded ? null : skill.name);
                      } else {
                        generateRoadmap(skill.name);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold">{skill.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={`${getPriorityColor(skill.priority)}`}
                            >
                              {skill.priority} priority
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {roadmap && (
                          <div className="w-32">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{skillProgress}%</span>
                            </div>
                            <Progress value={skillProgress} className="h-2" />
                          </div>
                        )}

                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : roadmap ? (
                          <ChevronDown
                            className={`w-5 h-5 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        ) : (
                          <Button size="sm" variant="outline">
                            Generate Roadmap
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded roadmap */}
                  {isExpanded && roadmap && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-border"
                    >
                      <ScrollArea className="max-h-96">
                        <div className="p-4 space-y-2">
                          {roadmap.topics.map((topic) => (
                            <div key={topic.id} className="rounded-lg border border-border">
                              <div
                                className="p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between"
                                onClick={() => toggleTopic(topic.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <BookOpen className="w-4 h-4 text-primary" />
                                  <div>
                                    <h4 className="font-medium">{topic.title}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      {topic.subtopics.length} lessons
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    expandedTopics.has(topic.id) ? "rotate-180" : ""
                                  }`}
                                />
                              </div>

                              {expandedTopics.has(topic.id) && (
                                <div className="border-t border-border bg-muted/20 p-2 space-y-1">
                                  {topic.subtopics.map((subtopic) => {
                                    const isCompleted = isSubtopicCompleted(skill.name, topic.id, subtopic.id);
                                    return (
                                      <div
                                        key={subtopic.id}
                                        className="flex items-center justify-between p-2 rounded hover:bg-background cursor-pointer transition-colors"
                                        onClick={() =>
                                          onOpenLearning(skill.name, topic, subtopic, roadmap)
                                        }
                                      >
                                        <div className="flex items-center gap-2">
                                          {isCompleted ? (
                                            <Check className="w-3 h-3 text-success" />
                                          ) : (
                                            <Circle className="w-3 h-3 text-muted-foreground" />
                                          )}
                                          <span className={`text-sm ${isCompleted ? "text-muted-foreground line-through" : ""}`}>
                                            {subtopic.title}
                                          </span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
