import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting DB reset...");

    // Delete in order of dependencies (child first)
    const tables = [
      "topic_progress",
      "skill_roadmaps",
      "learning_paths",
      "user_skills",
      "profiles", // This is the root for app data. Deleting this usually cascades if configured, but manual delete is safer.
    ];

    const results = [];

    for (const table of tables) {
      console.log(`Deleting from ${table}...`);
      
      // Use user_id for deletion as it's the common ownership column
      const { error, count } = await supabaseAdmin
        .from(table)
        .delete()
        .neq("user_id", "00000000-0000-0000-0000-000000000000"); 

      if (error) {
        console.error(`Error deleting ${table}:`, error);
        results.push({ table, status: "error", error });
      } else {
        console.log(`Deleted ${count} rows from ${table}`);
        results.push({ table, status: "success", count });
      }
    }

    // Special handling for user_skills if it failed (likely no 'id' column)
    // profiles primary key is id (uuid references auth.users).
    
    return new Response(JSON.stringify({ message: "Reset complete", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
