import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getMetapilotServerConfig() {
  const url = process.env.METAPILOT_SUPABASE_URL;
  const serviceRoleKey = process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing metapilot Supabase server config: ${[
        !url ? "METAPILOT_SUPABASE_URL" : "",
        !serviceRoleKey ? "METAPILOT_SUPABASE_SERVICE_ROLE_KEY" : "",
      ].filter(Boolean).join(", ")}`,
    );
  }

  return { url, serviceRoleKey };
}

export function createMetapilotAdminClient() {
  const { url, serviceRoleKey } = getMetapilotServerConfig();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const metapilotSupabaseAdmin = createMetapilotAdminClient();
