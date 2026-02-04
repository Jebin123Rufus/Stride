import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  Briefcase, 
  Sparkles, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Search, 
  X, 
  Check,
  FileText,
  Loader2
} from "lucide-react";
import { allJobs, jobCategories } from "@/data/jobs";
import { allSkills, skillCategories } from "@/data/skills";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  { id: 1, title: "Your Name", icon: User },
  { id: 2, title: "Dream Job", icon: Briefcase },
  { id: 3, title: "Current Skills", icon: Sparkles },
  { id: 4, title: "Resume (Optional)", icon: Upload },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [dreamJob, setDreamJob] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuthContext();
  const { toast } = useToast();

  const progress = (currentStep / steps.length) * 100;

  const filteredJobs = allJobs.filter((job) =>
    job.name.toLowerCase().includes(jobSearch.toLowerCase()) ||
    job.category.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const filteredSkills = allSkills.filter((skill) =>
    skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    skill.category.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const handleSkillToggle = (skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillName)
        ? prev.filter((s) => s !== skillName)
        : [...prev, skillName]
    );
  };

  const handleResumeUpload = async (file: File) => {
    setResumeFile(file);
    setIsParsingResume(true);

    try {
      // Read file as text (simple approach for now)
      const text = await file.text();
      
      const response = await supabase.functions.invoke("parse-resume", {
        body: { resumeText: text },
      });

      if (response.error) throw response.error;
      
      const { skills } = response.data;
      setResumeSkills(skills || []);
      
      toast({
        title: "Resume parsed!",
        description: `Found ${skills?.length || 0} skills in your resume.`,
      });
    } catch (error) {
      console.error("Error parsing resume:", error);
      toast({
        title: "Error parsing resume",
        description: "We'll continue without the resume analysis.",
        variant: "destructive",
      });
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      // Upsert profile (create if doesn't exist, update if it does)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          full_name: fullName,
          dream_job: dreamJob,
          onboarding_completed: true,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error("Profile save error details:", profileError);
        throw profileError;
      }

      // Insert user skills (with conflict handling)
      const allUserSkills = [...new Set([...selectedSkills, ...resumeSkills])];
      
      if (allUserSkills.length > 0) {
        const skillsToInsert = allUserSkills.map((skill) => ({
          user_id: user.id,
          skill_name: skill,
        }));

        // Using upsert to prevent errors on duplicate skills
        const { error: skillsError } = await supabase
          .from("user_skills")
          .upsert(skillsToInsert, {
            onConflict: 'user_id,skill_name',
            ignoreDuplicates: true
          });

        if (skillsError) {
          console.error("Skills save error details:", skillsError);
          throw skillsError;
        }
      }

      toast({
        title: "Profile complete!",
        description: "Generating your personalized learning paths...",
      });

      onComplete();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error saving profile",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return fullName.trim().length > 0;
      case 2:
        return dreamJob.length > 0;
      case 3:
        return true; // Skills are optional
      case 4:
        return true; // Resume is optional
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    step.id < currentStep
                      ? "bg-success text-success-foreground"
                      : step.id === currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.id < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className="hidden md:block text-sm font-medium">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-card rounded-2xl border border-border p-8 shadow-card"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Name */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-2xl font-bold mb-2">What's your name?</h2>
                <p className="text-muted-foreground mb-6">
                  Let's personalize your learning journey.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-2 h-12 text-lg"
                      autoFocus
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Dream Job */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-2xl font-bold mb-2">What's your dream job?</h2>
                <p className="text-muted-foreground mb-6">
                  Select the career you're working towards.
                </p>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    placeholder="Search jobs or categories..."
                    className="pl-10 h-12"
                  />
                </div>

                {dreamJob && (
                  <div className="mb-4">
                    <Badge variant="default" className="text-sm py-1 px-3">
                      {dreamJob}
                      <button
                        onClick={() => setDreamJob("")}
                        className="ml-2 hover:text-primary-foreground/80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  </div>
                )}

                <ScrollArea className="h-64 rounded-lg border border-border">
                  <div className="p-4 space-y-4">
                    {jobCategories
                      .filter((cat) =>
                        cat.jobs.some(
                          (job) =>
                            job.toLowerCase().includes(jobSearch.toLowerCase()) ||
                            cat.category.toLowerCase().includes(jobSearch.toLowerCase())
                        )
                      )
                      .map((category) => (
                        <div key={category.category}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            {category.category}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {category.jobs
                              .filter((job) =>
                                job.toLowerCase().includes(jobSearch.toLowerCase()) ||
                                category.category.toLowerCase().includes(jobSearch.toLowerCase())
                              )
                              .map((job) => (
                                <Badge
                                  key={job}
                                  variant={dreamJob === job ? "default" : "outline"}
                                  className="cursor-pointer transition-all hover:scale-105"
                                  onClick={() => setDreamJob(job)}
                                >
                                  {job}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* Step 3: Skills */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-2xl font-bold mb-2">What skills do you have?</h2>
                <p className="text-muted-foreground mb-6">
                  Select the skills you already possess. This helps us identify your skill gap.
                </p>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Search skills..."
                    className="pl-10 h-12"
                  />
                </div>

                {selectedSkills.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {selectedSkills.map((skill) => (
                      <Badge key={skill} variant="default" className="text-sm py-1 px-3">
                        {skill}
                        <button
                          onClick={() => handleSkillToggle(skill)}
                          className="ml-2 hover:text-primary-foreground/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <ScrollArea className="h-64 rounded-lg border border-border">
                  <div className="p-4 space-y-4">
                    {skillCategories
                      .filter((cat) =>
                        cat.skills.some(
                          (skill) =>
                            skill.toLowerCase().includes(skillSearch.toLowerCase()) ||
                            cat.category.toLowerCase().includes(skillSearch.toLowerCase())
                        )
                      )
                      .map((category) => (
                        <div key={category.category}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            {category.category}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {category.skills
                              .filter((skill) =>
                                skill.toLowerCase().includes(skillSearch.toLowerCase()) ||
                                category.category.toLowerCase().includes(skillSearch.toLowerCase())
                              )
                              .map((skill) => (
                                <Badge
                                  key={skill}
                                  variant={selectedSkills.includes(skill) ? "default" : "outline"}
                                  className="cursor-pointer transition-all hover:scale-105"
                                  onClick={() => handleSkillToggle(skill)}
                                >
                                  {selectedSkills.includes(skill) && (
                                    <Check className="w-3 h-3 mr-1" />
                                  )}
                                  {skill}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>

                <p className="text-sm text-muted-foreground mt-4">
                  Selected {selectedSkills.length} skill{selectedSkills.length !== 1 ? "s" : ""}
                </p>
              </motion.div>
            )}

            {/* Step 4: Resume */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-2xl font-bold mb-2">Upload your resume (optional)</h2>
                <p className="text-muted-foreground mb-6">
                  We'll analyze your resume to extract additional skills automatically.
                </p>

                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleResumeUpload(file);
                    }}
                    className="hidden"
                    id="resume-upload"
                    disabled={isParsingResume}
                  />
                  <label htmlFor="resume-upload" className="cursor-pointer">
                    {isParsingResume ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-muted-foreground">Analyzing your resume...</p>
                      </div>
                    ) : resumeFile ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="w-12 h-12 text-success" />
                        <p className="font-medium">{resumeFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Click to upload a different file
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="w-12 h-12 text-muted-foreground" />
                        <p className="font-medium">Drop your resume here or click to upload</p>
                        <p className="text-sm text-muted-foreground">
                          Supports .txt, .pdf, .doc, .docx
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {resumeSkills.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-3">Skills found in your resume:</h4>
                    <div className="flex flex-wrap gap-2">
                      {resumeSkills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {currentStep < steps.length ? (
              <Button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                disabled={!canProceed()}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                variant="hero"
                onClick={handleSubmit}
                disabled={isSubmitting || isParsingResume}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Paths...
                  </>
                ) : (
                  <>
                    Generate Learning Paths
                    <Sparkles className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
