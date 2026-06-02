import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const METAPILOT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lljslntqeucjgaeqvzvm.supabase.co';
const METAPILOT_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_cJqP7v0vE82r7h2qYvVr2w_Jb8qWz7eQ';

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