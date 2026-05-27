import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const METAPILOT_SUPABASE_URL = 'https://pydqjtlingbijppznvzl.supabase.co';
const METAPILOT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZzM5OvxYZh8sDmEH9jxi9g_RcEnqwX5';

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
