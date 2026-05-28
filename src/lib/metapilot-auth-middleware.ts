import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const requireMetapilotAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const url = process.env.METAPILOT_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey = process.env.METAPILOT_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      `Missing metapilot auth config: ${[
        !url ? "METAPILOT_SUPABASE_URL" : "",
        !publishableKey ? "METAPILOT_SUPABASE_ANON_KEY" : "",
      ].filter(Boolean).join(", ")}`,
    );
  }

  const authHeader = getRequestHeader("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length);
  const supabase = createClient<Database>(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return next({
    context: {
      supabase,
      userId: data.user.id,
      user: data.user,
    },
  });
});
