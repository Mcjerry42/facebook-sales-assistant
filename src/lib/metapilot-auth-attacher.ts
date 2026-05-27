import { createMiddleware } from "@tanstack/react-start";

export const attachMetapilotAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { metapilotSupabase } = await import("@/lib/metapilot-supabase.client");
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
