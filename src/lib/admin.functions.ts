import { createServerFn } from "@tanstack/react-start";
import { requireMetapilotAuth } from "@/lib/metapilot-auth-middleware";
import { metapilotSupabaseAdmin } from "@/lib/metapilot-supabase.server";
import { z } from "zod";

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireMetapilotAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Only admin (first user) can see all
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");

    // Use admin client to bypass RLS and see all profiles
    const { data: profiles } = await metapilotSupabaseAdmin
      .from("profiles")
      .select("id, email, fb_page_id, fb_page_token, fb_status, is_approved, created_at")
      .order("created_at", { ascending: true });

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email ?? "unknown",
      fb_page_id: p.fb_page_id ?? "",
      fb_page_token: p.fb_page_token ? "***" : "",
      fb_status: (p.fb_status ?? "off") as string,
      is_approved: !!p.is_approved,
      created_at: p.created_at,
    }));
  });

export const adminToggleBot = createServerFn({ method: "POST" })
  .middleware([requireMetapilotAuth])
  .inputValidator((d: unknown) =>
    z.object({ targetUserId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Only admin can toggle others
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");

    const { error } = await metapilotSupabaseAdmin
      .from("profiles")
      .update({ fb_status: data.enabled ? "on" : "off" } as any)
      .eq("id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true, botEnabled: data.enabled };
  });