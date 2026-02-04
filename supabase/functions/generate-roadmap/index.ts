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
    const { skillName, dreamJob } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert curriculum designer. Create a comprehensive learning roadmap for a specific skill. The roadmap should be structured with topics and subtopics that progressively build knowledge from beginner to advanced.

Each topic should include:
- id: A unique identifier (e.g., "topic-1")
- title: Clear topic name
- description: Brief explanation of what will be learned
- subtopics: Array of subtopics with detailed learning content

Each subtopic should have:
- id: A unique identifier (e.g., "subtopic-1-1")
- title: Clear subtopic name
- description: Comprehensive description of what will be covered (at least 2-3 sentences)
- content: VERY detailed learning content with examples, code snippets, exercises, and real-world applications. This should be comprehensive documentation (at least 500-800 words per subtopic) formatted in Markdown with:
  * Clear explanations of concepts
  * Multiple code examples with explanations
  * Best practices and common pitfalls
  * Practical exercises
  * Real-world use cases
  * Tips and tricks

Make the content practical, actionable, and comprehensive enough to serve as standalone learning material.`;

    const userPrompt = `Create a detailed learning roadmap for: ${skillName}
Target Job: ${dreamJob}

The roadmap should include 4-6 main topics, each with 3-5 subtopics. Make it comprehensive enough to take someone from beginner to job-ready for this skill.

IMPORTANT: Each subtopic's content should be very detailed (500-800 words minimum) with thorough explanations, multiple code examples, and practical exercises. Do NOT include any time estimates or duration information.`;

    const jsonSchema = {
      type: "object",
      properties: {
        skillName: { type: "string" },
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              subtopics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    content: { type: "string" }
                  },
                  required: ["id", "title", "description", "content"]
                }
              }
            },
            required: ["id", "title", "description", "subtopics"]
          }
        }
      },
      required: ["skillName", "topics"]
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "roadmap_response",
            schema: jsonSchema,
            strict: true
          }
        }
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
      throw new Error("Failed to generate roadmap");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("No content in response:", JSON.stringify(data));
      throw new Error("No content received from AI");
    }

    const roadmap = JSON.parse(content);

    return new Response(JSON.stringify(roadmap), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating roadmap:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
