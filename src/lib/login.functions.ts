import { createServerFn } from "@tanstack/react-start";
import { metapilotSupabaseAdmin } from "./metapilot-supabase.server";

export const checkSignupsAllowed = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await metapilotSupabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true });
  return (count ?? 0) === 0;
});

export const resetApproval = createServerFn({ method: "POST" })
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    // Override the DB trigger that auto-approves the first user
    await metapilotSupabaseAdmin.from("profiles").update({ is_approved: false }).eq("id", data);
    return true;
  });
