import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { metapilotSupabase } from "@/lib/metapilot-supabase-browser";
import { listUsers, adminToggleBot } from "@/lib/admin.functions";
import { FullPageLoader } from "@/components/page-loader";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/users")({
  ssr: false,
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    metapilotSupabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) { navigate({ to: "/login", replace: true }); return; }
      // Check if admin
      const { data: role } = await metapilotSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) { navigate({ to: "/dashboard", replace: true }); return; }
      if (!mounted) return;
      try {
        const result = await listUsers();
        if (mounted) setUsers(result);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load users");
      } finally {
        if (mounted) setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [navigate]);

  const handleToggle = async (userId: string, current: boolean) => {
    setToggling(userId);
    try {
      await adminToggleBot({ data: { targetUserId: userId, enabled: !current } });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, fb_status: !current ? "on" : "off" } : u));
      toast.success(!current ? "Bot চালু হয়েছে!" : "Bot বন্ধ হয়েছে!");
    } catch (e: any) {
      toast.error(e?.message ?? "সমস্যা হয়েছে");
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <FullPageLoader label="Loading users" />;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Page: {u.fb_page_id || "—"} | Token: {u.fb_page_token || "—"} | Approved: {u.is_approved ? "✅" : "❌"}
              </p>
            </div>
            <button
              onClick={() => handleToggle(u.id, u.fb_status === "on")}
              disabled={toggling === u.id}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                u.fb_status === "on" ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${u.fb_status === "on" ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
        {users.length === 0 && <p className="text-muted-foreground text-sm">No users found.</p>}
      </div>
      <p className="mt-6 text-xs text-muted-foreground text-center">
        <a href="/dashboard" className="underline">← Back to dashboard</a>
      </p>
    </div>
  );
}