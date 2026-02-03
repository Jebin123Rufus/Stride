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
    const { dreamJob, currentSkills, resumeSkills } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const allSkills = [...new Set([...(currentSkills || []), ...(resumeSkills || [])])];
    
    const systemPrompt = `You are an expert career counselor and learning path designer. Your task is to analyze a user's dream job, their current skills, and market trends to create personalized learning paths.

Always respond with valid JSON containing exactly 3 learning paths:
1. "recommended" - The most balanced and personalized path based on their current skills and the job requirements
2. "easier" - A more accessible path with lower difficulty but still effective  
3. "professional" - The most comprehensive, industry-leading path with high-demand premium skills

Each path should include:
- title: A compelling name for the path
- description: 2-3 sentences explaining the path
- skills: An array of 4-8 skill objects with { name, priority (high/medium/low), estimatedHours }
- estimatedDuration: Total time estimate (e.g., "3-4 months")
- marketDemand: (high/medium) 
- salaryImpact: Potential salary increase percentage`;

    const userPrompt = `Dream Job: ${dreamJob}
Current Skills: ${allSkills.length > 0 ? allSkills.join(", ") : "None specified"}

Please analyze the skill gap and create 3 distinct learning paths to help achieve this career goal. Consider current market trends and in-demand skills for this role in 2024-2025.`;

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
              name: "generate_learning_paths",
              description: "Generate 3 personalized learning paths",
              parameters: {
                type: "object",
                properties: {
                  paths: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["recommended", "easier", "professional"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        skills: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              priority: { type: "string", enum: ["high", "medium", "low"] },
                              estimatedHours: { type: "number" }
                            },
                            required: ["name", "priority", "estimatedHours"]
                          }
                        },
                        estimatedDuration: { type: "string" },
                        marketDemand: { type: "string", enum: ["high", "medium"] },
                        salaryImpact: { type: "string" }
                      },
                      required: ["type", "title", "description", "skills", "estimatedDuration", "marketDemand", "salaryImpact"]
                    }
                  }
                },
                required: ["paths"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_learning_paths" } }
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
      throw new Error("Failed to generate learning paths");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call response received");
    }

    const paths = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(paths), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating learning paths:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
