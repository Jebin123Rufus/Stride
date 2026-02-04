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
- estimatedHours: Time to complete
- subtopics: Array of subtopics with similar structure plus a "content" field with detailed learning content

Make the content practical and actionable with examples, exercises, and real-world applications.`;

    const userPrompt = `Create a detailed learning roadmap for: ${skillName}
Target Job: ${dreamJob}

The roadmap should include 4-6 main topics, each with 3-5 subtopics. Make it comprehensive enough to take someone from beginner to job-ready for this skill.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "generate_roadmap",
              description: "Generate a skill learning roadmap",
              parameters: {
                type: "object",
                properties: {
                  skillName: { type: "string" },
                  totalEstimatedHours: { type: "number" },
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        estimatedHours: { type: "number" },
                        subtopics: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              title: { type: "string" },
                              description: { type: "string" },
                              estimatedMinutes: { type: "number" },
                              content: { type: "string" }
                            },
                            required: ["id", "title", "description", "estimatedMinutes", "content"]
                          }
                        }
                      },
                      required: ["id", "title", "description", "estimatedHours", "subtopics"]
                    }
                  }
                },
                required: ["skillName", "totalEstimatedHours", "topics"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_roadmap" } }
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call response received");
    }

    const roadmap = JSON.parse(toolCall.function.arguments);

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
