-- Add DELETE policy for skill_roadmaps table
CREATE POLICY "Users can delete their own roadmaps"
ON public.skill_roadmaps
FOR DELETE
USING (auth.uid() = user_id);