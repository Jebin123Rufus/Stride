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
    const { subtopicTitle, skillName, section } = await req.json();

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const model = "llama-3.1-8b-instant";

    // Mode 1: Initial Skeleton & First Section Data
    if (!section) {
      const systemPrompt = `You are an expert technical documentation designer. Provide 4 granular sub-topic titles and a RICH technical deep-dive for the first title.
      
      FORMATTING RULES:
      1. Use double line breaks between paragraphs for clarity.
      2. **Bold** every important technical keyword or concept.
      3. Use \`code\` tags for variables, methods, or small snippets.
      4. Use professional Markdown headings and bullet points.
      
      Respond STRICTLY in JSON:
      {
        "sections": ["Title 1", "Title 2", "Title 3", "Title 4"],
        "firstSectionContent": "Richly formatted Markdown content here..."
      }`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Skill: ${skillName} | Topic: ${subtopicTitle}` }],
          response_format: { type: "json_object" }
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mode 3: Quiz Generation
    if (section === "quiz") {
      const systemPrompt = `You are a technical examiner. Create a 10-question multiple-choice quiz about the given topic.
      Each question must have:
      1. A clear question text.
      2. 4 distinct options.
      3. Exactly 1 correct answer (as index 0-3).
      4. A brief explanation for the correct answer.

      Respond STRICTLY in JSON format:
      {
        "questions": [
          {
            "question": "Question text?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "explanation": "Explanation here..."
          }
        ]
      }`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a 10-question quiz for - Skill: ${skillName} | Lesson: ${subtopicTitle}` }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const data = await response.json();
      return new Response(data.choices[0].message.content, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Targeted Fetch for specific section
    const systemPrompt = `You are a master technical tutor. Provide a RICH technical deep-dive for the section.
    
    FORMATTING RULES:
    1. **Bold** all key technical terms.
    2. Use double line breaks between sections.
    3. Include practical examples with \`inline code\` or blocks.
    4. NO intro or greeting.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Skill: ${skillName} | Lesson: ${subtopicTitle} | Section: ${section}` }
        ]
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify({ content: data.choices[0].message.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ERROR:", error.message);
    return new Response(JSON.stringify({ 
      error: "Failed", 
      message: error.message,
      isError: true 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
