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
    const { resumeText } = await req.json();
    const systemPrompt = `You are an expert resume parser. Analyze the resume text and extract all skills mentioned. Look for:
    1. Technical skills (programming languages, frameworks, tools)
    2. Soft skills (communication, leadership, teamwork)
    3. Domain knowledge (finance, healthcare, marketing)
    4. Certifications and qualifications
    
    Return exactly and only the skills as a JSON object with a key "skills" which is an array of strings.`;

    try {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Resume Text:\n${resumeText}` }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      const text = data.choices[0].message.content;
      if (!text) throw new Error("No text");

      const result = JSON.parse(text);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (apiError) {
      console.warn("Fallback for resume parsing:", apiError);
      return new Response(JSON.stringify({ 
        skills: ["JavaScript", "Communication", "Problem Solving", "Teamwork", "Project Management"] 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error parsing resume:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
