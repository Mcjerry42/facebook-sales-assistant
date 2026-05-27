import { createMiddleware } from "@tanstack/react-start";
import { metapilotSupabase } from "@/lib/metapilot-supabase.client";

export const attachMetapilotAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await metapilotSupabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    return next();
  }

  return next({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
});
