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

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
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
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  
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
    if (!user || !roadmap.id) return;
    
    setIsLoading(true);
    console.log("🚀 Stride AI: Loading content for:", subtopic.title);
    
    // Reset state first
    setSections([]);
    setCurrentSection(null);
    setSectionContent({});

    try {
      // 1. Try to fetch existing content from database
      const { data: progressData } = await supabase
        .from("topic_progress")
        .select("notes")
        .eq("user_id", user.id)
        .eq("roadmap_id", roadmap.id)
        .eq("topic_id", topic.id)
        .eq("subtopic_id", subtopic.id)
        .maybeSingle();

      if (progressData?.notes) {
        try {
          const cached = JSON.parse(progressData.notes);
          if (cached.sections && cached.sections.length > 0) {
            console.log("📦 Stride AI: Loaded content from cache");
            setSections(cached.sections);
            setSectionContent(cached.content || {});
            if (cached.sections[0]) setCurrentSection(cached.sections[0]);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Cache parse error:", e);
        }
      }

      // 2. Generate new content if not cached
      const { data, error } = await supabase.functions.invoke("generate-learning-content", {
        body: {
          skillName,
          subtopicTitle: subtopic.title,
        },
      });

      if (error) throw error;
      if (data && data.isError) {
        throw new Error(data.message || data.error || "Generation failed");
      }

      if (data && data.sections) {
        const newSections = data.sections || [];
        const newContent = data.firstSectionContent ? { [newSections[0]]: data.firstSectionContent } : {};
        
        setSections(newSections);
        setSectionContent(newContent);
        if (newSections[0]) setCurrentSection(newSections[0]);

        // Save to cache
        await supabase
          .from("topic_progress")
          .upsert({
            user_id: user.id,
            roadmap_id: roadmap.id,
            topic_id: topic.id,
            subtopic_id: subtopic.id,
            notes: JSON.stringify({ sections: newSections, content: newContent }),
            updated_at: new Date().toISOString(),
          });
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
        if (data.isError) {
          throw new Error(data.message || data.error || "Failed to load section");
        }
        
        const updatedContent = { ...sectionContent, [section]: data.content };
        setSectionContent(updatedContent);

        // Update cache
        if (user && roadmap.id) {
          await supabase
            .from("topic_progress")
            .upsert({
              user_id: user.id,
              roadmap_id: roadmap.id,
              topic_id: topic.id,
              subtopic_id: subtopic.id,
              notes: JSON.stringify({ sections, content: updatedContent }),
              updated_at: new Date().toISOString(),
            });
        }
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

  const startQuiz = async () => {
    setIsQuizLoading(true);
    setShowQuiz(true);
    setQuizSubmitted(false);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-learning-content", {
        body: {
          skillName,
          subtopicTitle: subtopic.title,
          section: "quiz",
        },
      });

      if (error) throw error;
      console.log("📥 Stride AI: Quiz Response Data:", data);

      if (data) {
        if (data.isError) {
          throw new Error(data.message || data.error || "Quiz generation failed");
        }
        if (data.questions && data.questions.length > 0) {
          setQuizQuestions(data.questions);
          setUserAnswers(new Array(data.questions.length).fill(-1));
        } else {
          console.error("❌ Stride AI: Invalid quiz format. Questions missing or empty in:", data);
          throw new Error("No questions were generated. Please try again.");
        }
      }
    } catch (e: any) {
      console.error("Quiz generation error:", e);
      toast({
        title: "Quiz Generation Failed",
        description: "Could not load the quiz. Please try again.",
        variant: "destructive"
      });
      setShowQuiz(false);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    if (quizSubmitted) return;
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const submitQuiz = async () => {
    if (userAnswers.includes(-1)) {
      toast({
        title: "Incomplete Quiz",
        description: "Please answer all questions before submitting.",
        variant: "destructive"
      });
      return;
    }

    let score = 0;
    userAnswers.forEach((answer, index) => {
      if (answer === quizQuestions[index].correctAnswer) {
        score++;
      }
    });

    setQuizScore(score);
    setQuizSubmitted(true);

    const passScore = Math.ceil(quizQuestions.length * 0.6); // 60% to pass

    if (score >= passScore) {
      await markAsComplete();
    } else {
      toast({
        title: "Quiz Not Passed",
        description: `You scored ${score}/${quizQuestions.length}. You need at least ${passScore}/${quizQuestions.length} to pass. Try again!`,
        variant: "destructive"
      });
    }
  };


  const markAsComplete = async () => {
    if (!user || !roadmap.id) return;

    setIsMarkingComplete(true);

    try {
      // Get all subtopics in this roadmap to check overall progress
      const allSubtopics = roadmap.topics.flatMap(t => t.subtopics.map(s => s.id));
      
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
          notes: JSON.stringify({ sections, content: sectionContent }),
        });

      if (error) throw error;

      setIsCompleted(true);
      toast({
        title: "Module mastered!",
        description: "Great job! You passed the quiz and completed this module.",
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
                  ) : showQuiz ? (
                    <div className="space-y-8 py-4">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-2xl font-bold flex items-center gap-2">
                             <Sparkles className="w-6 h-6 text-primary" />
                             Module Mastery Quiz
                          </h2>
                          <p className="text-muted-foreground">Answer 10 questions to prove your mastery (6/10 required)</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowQuiz(false)}>
                          Cancel
                        </Button>
                      </div>

                      {isQuizLoading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <p className="text-muted-foreground mt-4">Generating your unique quiz...</p>
                        </div>
                      ) : (
                        <div className="space-y-12">
                          {quizQuestions.map((q, qIdx) => (
                            <div key={qIdx} className="space-y-4">
                              <div className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                  {qIdx + 1}
                                </span>
                                <h3 className="text-lg font-medium pt-1">{q.question}</h3>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-12">
                                {q.options.map((opt, oIdx) => {
                                  let variant: "outline" | "default" | "secondary" = "outline";
                                  const isSelected = userAnswers[qIdx] === oIdx;
                                  
                                  if (quizSubmitted) {
                                    if (oIdx === q.correctAnswer) variant = "default";
                                    else if (isSelected) variant = "secondary";
                                  } else if (isSelected) {
                                    variant = "default";
                                  }

                                  return (
                                    <Button
                                      key={oIdx}
                                      variant={variant}
                                      className={`justify-start h-auto py-3 px-4 text-left whitespace-normal border-2 ${
                                        quizSubmitted && isSelected && oIdx !== q.correctAnswer ? "border-destructive bg-destructive/10" : 
                                        quizSubmitted && oIdx === q.correctAnswer ? "border-success bg-success/10 text-success-foreground" :
                                        isSelected ? "border-primary" : "border-border/50"
                                      }`}
                                      onClick={() => handleAnswerSelect(qIdx, oIdx)}
                                      disabled={quizSubmitted}
                                    >
                                      <span className="mr-3 opacity-50">{String.fromCharCode(65 + oIdx)}.</span>
                                      {opt}
                                    </Button>
                                  );
                                })}
                              </div>
                              {quizSubmitted && (
                                <div className={`ml-12 p-4 rounded-xl text-sm ${
                                  userAnswers[qIdx] === q.correctAnswer ? "bg-success/5 text-success border border-success/20" : "bg-destructive/5 text-destructive border border-destructive/20"
                                }`}>
                                  <p className="font-bold mb-1">{userAnswers[qIdx] === q.correctAnswer ? "Correct!" : "Incorrect."}</p>
                                  <p className="opacity-90">{q.explanation}</p>
                                </div>
                              )}
                            </div>
                          ))}

                          {quizQuestions.length > 0 && !quizSubmitted ? (
                            <div className="pt-8 flex justify-center">
                              <Button size="xl" className="rounded-full px-12" onClick={submitQuiz}>
                                Submit Quiz
                              </Button>
                            </div>
                          ) : quizQuestions.length > 0 ? (
                            <div className="pt-8 space-y-6 flex flex-col items-center border-t border-border mt-12">
                              <div className="text-center">
                                <h3 className="text-3xl font-bold mb-2">Final Score: {quizScore}/{quizQuestions.length}</h3>
                                <p className="text-muted-foreground">
                                  {quizScore >= Math.ceil(quizQuestions.length * 0.6) 
                                    ? "Congratulations! You've mastered this module." 
                                    : "Not quite there yet. Review the content and try again."}
                                </p>
                              </div>
                              <div className="flex gap-4">
                                {quizScore < Math.ceil(quizQuestions.length * 0.6) && (
                                  <Button variant="outline" size="lg" className="rounded-full px-8" onClick={startQuiz}>
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Try Again
                                  </Button>
                                )}
                                <Button size="lg" className="rounded-full px-8" onClick={() => setShowQuiz(false)}>
                                  {quizScore >= Math.ceil(quizQuestions.length * 0.6) ? "Back to Lesson" : "Review Content"}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
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
                onClick={isCompleted ? undefined : startQuiz}
                disabled={isCompleted || isMarkingComplete || showQuiz}
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
