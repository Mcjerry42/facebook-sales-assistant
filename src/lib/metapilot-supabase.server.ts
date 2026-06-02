import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function envValue(value: string | undefined) {
  return value?.replace(/^["']|["']$/g, "");
}

function getMetapilotServerConfig() {
  const url = envValue(process.env.METAPILOT_SUPABASE_URL || process.env.SUPABASE_URL);
  const serviceRoleKey = envValue(process.env.METAPILOT_SUPABASE_SERVICE_ROLE_KEY);

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

let metapilotAdminClient: ReturnType<typeof createMetapilotAdminClient> | undefined;

export const metapilotSupabaseAdmin = new Proxy({} as ReturnType<typeof createMetapilotAdminClient>, {
  get(_target, prop, receiver) {
    if (!metapilotAdminClient) {
      metapilotAdminClient = createMetapilotAdminClient();
    }

    return Reflect.get(metapilotAdminClient, prop, receiver);
  },
});
