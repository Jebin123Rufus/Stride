import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topicTitle, subtopicTitle, skillName, dreamJob } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert educator creating comprehensive, in-depth learning content. Generate VERY detailed educational content (800-1200 words minimum) that includes:

1. **Introduction & Overview**
   - What is this concept and why it matters
   - Prerequisites and what you'll learn

2. **Core Concepts & Theory**
   - Detailed explanations with multiple examples
   - Key terminology and definitions
   - How it fits into the bigger picture

3. **Practical Implementation**
   - Step-by-step code examples with explanations
   - Multiple use cases and scenarios
   - Real-world applications

4. **Best Practices & Patterns**
   - Industry-standard approaches
   - Common pitfalls and how to avoid them
   - Performance considerations

5. **Hands-On Exercises**
   - Practice exercises with clear instructions
   - Challenge problems to test understanding
   - Project ideas to build

6. **Summary & Key Takeaways**
   - Main points to remember
   - Quick reference guide
   - Next steps for further learning

7. **Quiz Questions**
   - 3-5 questions to test understanding
   - Mix of conceptual and practical questions

Format the content in Markdown with proper headings (##, ###), code blocks with language specification, bullet points, and numbered lists. Make it comprehensive enough to serve as standalone documentation.`;

    const userPrompt = `Create comprehensive, detailed learning content (minimum 800-1200 words) for:
Skill: ${skillName}
Topic: ${topicTitle}
Subtopic: ${subtopicTitle}
Target Career: ${dreamJob}

Make the content practical and job-ready focused. Include:
- Multiple real-world examples
- Detailed code samples with line-by-line explanations
- Common interview questions related to this topic
- Tips for applying this knowledge in a ${dreamJob} role

DO NOT include any time estimates or duration information. Focus purely on the educational content.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate content");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating content:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
