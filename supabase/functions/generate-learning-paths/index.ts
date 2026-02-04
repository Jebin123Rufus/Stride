import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  // Handle direct browser check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "Function is alive and reachable!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { dreamJob, currentSkills, resumeSkills } = body;
    

    const allSkills = [...new Set([...(currentSkills || []), ...(resumeSkills || [])])];
    
    const systemPrompt = `You are an elite career strategist. Analyze the user's dream job and current skills to create 3 **vast and comprehensive** learning paths.
    
    For each path:
    - **Description**: Must be detailed, explaining the "why" and "how" based on **current 2024-2025 market trends**.
    - **Skills**: Include **at least 8** high-impact, high-paying skills in demand for this specific path.
    
    Respond ONLY with a JSON object in this format:
    {
      "paths": [
        {
          "type": "recommended" | "easier" | "professional",
          "title": "string",
          "description": "A vast, detailed description of this career path, analyzing market demand and key opportunities.",
          "skills": [{ "name": "string", "priority": "high"|"medium"|"low" }],
          "marketDemand": "Analysis",
          "salaryImpact": "Range"
        }
      ]
    }`;

    const userPrompt = `Dream Job: ${dreamJob}\nCurrent Skills: ${allSkills.length > 0 ? allSkills.join(", ") : "None specified"}
    
    REQUIREMENT: Generate extensive, high-value paths based on current top-tier market demands.`;

    try {
      console.log("Calling Groq API (llama-3.3-70b)...");
      const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
      
      if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured");
      }
 
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
        const errorText = await response.text();
        console.error("Groq API Error:", response.status, errorText);
        throw new Error(`Groq API Error: ${response.status}`);
      }
 
      const data = await response.json();
      const text = data.choices[0].message.content;
      
      if (!text) throw new Error("No response text from Groq");
 
      return new Response(text, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
 
    } catch (apiError: any) {
      console.error("Error generating paths:", apiError);
      return new Response(JSON.stringify({ 
        error: "Groq API Call Failed", 
        details: apiError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    console.error("Critical server error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
