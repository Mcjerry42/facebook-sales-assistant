import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const METAPILOT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lljslntqeucjgaeqvzvm.supabase.co';
const METAPILOT_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsanNsbnRxZXVjamdhZXF2enZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjI1MjQsImV4cCI6MjA5NTg5ODUyNH0.pMMgiKzLmCqMn0eNmPQgsXBVHAGQnpxCgobjmi6ffU4';

export const metapilotSupabase = createClient<Database>(
  METAPILOT_SUPABASE_URL,
  METAPILOT_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);