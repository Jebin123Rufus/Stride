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

    const systemPrompt = `You are an elite career strategist and master curriculum architect. Create an **extremely vast, exhaustive, and deep-dive** learning roadmap for a specific skill.
    
    CRITICAL INSTRUCTIONS:
    1.  **Exhaustive Depth**: The roadmap must include **at least 10-12 major topics**. Each major topic must contain **4-6 detailed subtopics**.
    2.  **Total Coverage**: Cover everything from absolute foundations to niche, industry-standard expert topics, advanced patterns, and latest 2024-2025 ecosystem tools.
    3.  **Market-Driven**: Focus on concepts, frameworks, and tools currently required by top-tier tech giants (FAANG+, top startups).
    4.  **No Time Estimates**: Do NOT include any estimated hours/minutes.
    
    Respond STRICTLY with a valid JSON in this format:
    {
      "skillName": "The Skill",
      "topics": [
        {
          "id": "topic-1",
          "title": "Topic Name",
          "description": "Vast explanation of this module's professional relevance.",
          "subtopics": [
            {
              "id": "subtopic-1-1",
              "title": "Subtopic Name",
              "description": "Exhaustive technical overview of what is covered.",
              "content": "Deep technical abstract of the concept."
            }
          ]
        }
      ]
    }`;

    const userPrompt = `Create an extremely vast, market-leading learning roadmap for: ${skillName}
    Strategic Context: This is for a professional aiming to become a top-tier ${dreamJob}.
    Requirement: Cover both major and minor technical pillars. Leave no skill gap unaddressed.`;

    try {
      const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
      if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

      console.log(`Calling Groq (llama-3.3-70b) for roadmap: ${skillName}`);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        console.error("Groq API Error:", errorMsg);
        throw new Error(`Groq API Error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      if (!text) throw new Error("No response text from Groq");

      return new Response(text, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (apiError: any) {
      console.error("Error via API:", apiError);
      return new Response(JSON.stringify({ 
        error: "Groq Roadmap Generation Failed", 
        details: apiError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    console.error("Critical server error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      message: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
