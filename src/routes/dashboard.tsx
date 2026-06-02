import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState, useCallback } from "react";
import { metapilotSupabase } from "@/lib/metapilot-supabase-browser";
import { getDashboardOverview, toggleBotEnabled, fixFirstUserApproval } from "@/lib/dashboard.functions";
import {
  LogOut,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/components/page-loader";
import { Paywall } from "@/components/paywall";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  component: DashboardLayout,
  errorComponent: DashboardError,
});

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Dashboard failed to load</h1>
        <p className="text-sm text-muted-foreground break-words">
          {error?.message ?? "Unknown error"}
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isAppOwner, setIsAppOwner] = useState<boolean | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [botEnabled, setBotEnabled] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let mounted = true;
    metapilotSupabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session?.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const u = data.session.user;
      setUser(u);
      const [{ data: profile }, { data: allProfiles }, { data: settings }, { data: roleRow }] = await Promise.all([
        metapilotSupabase
          .from("profiles")
          .select("is_approved, approved_until")
          .eq("id", u.id)
          .maybeSingle(),
        metapilotSupabase
          .from("profiles")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1),
        metapilotSupabase
          .from("app_settings")
          .select("whatsapp_number")
          .limit(1)
          .maybeSingle(),
        metapilotSupabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      if (!mounted) return;
      
      const ownerId = allProfiles?.[0]?.id;
      const isOwner = ownerId === u.id;
      const notExpired = !profile?.approved_until || new Date(profile.approved_until).getTime() > Date.now();
      
      let approved = !!profile?.is_approved && notExpired;
      
      if (isOwner && roleRow?.role === "admin") {
        try {
          await fixFirstUserApproval();
        } catch (e) {
          console.error("Failed to fix approval", e);
        }
        approved = false;
      }
      
      setIsApproved(approved);
      setIsAppOwner(isOwner);
      setWhatsapp(settings?.whatsapp_number ?? null);
      setChecking(false);
    });
    const {
      data: { subscription },
    } = metapilotSupabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") navigate({ to: "/login", replace: true });
      else if (s?.user) setUser(s.user);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await metapilotSupabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // Load bot status
  useEffect(() => {
    if (!isApproved) return;
    setBotLoading(true);
    getDashboardOverview().then((data) => {
      setBotEnabled(data.botEnabled ?? false);
      setBotLoading(false);
    }).catch(() => setBotLoading(false));
  }, [isApproved]);

  const handleToggleBot = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    const prev = botEnabled;
    // Optimistically toggle UI
    setBotEnabled(!prev);
    try {
      await toggleBotEnabled({ data: { enabled: !prev } });
      // Re-fetch to confirm actual DB state
      const data = await getDashboardOverview();
      setBotEnabled(data.botEnabled ?? !prev);
      toast.success(data.botEnabled ? "Bot চালু হয়েছে!" : "Bot বন্ধ হয়েছে!");
    } catch (err) {
      // Revert on error
      setBotEnabled(prev);
      toast.error("সমস্যা হয়েছে, আবার চেষ্টা করুন");
      console.error("Toggle bot error:", err);
    } finally {
      setToggling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botEnabled, toggling]);

  if (checking) {
    return <FullPageLoader label="Preparing your dashboard" />;
  }

  if (isAppOwner === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This application is already owned by another user.
            If you need access or support, please contact the administrator.
          </p>
          {whatsapp && (
            <Button asChild className="w-full mt-4" style={{ background: "#25D366" }}>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                Contact on WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={signOut} className="w-full mt-2">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (isApproved === false) {
    return <Paywall userEmail={user?.email} onSignOut={signOut} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">MetaPilot</h1>
        </div>

        {/* Bot Status Card */}
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Bot Status</p>
              <p className="text-lg font-semibold">
                {botLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : botEnabled ? (
                  <span className="text-green-600">চালু আছে</span>
                ) : (
                  <span className="text-red-500">বন্ধ আছে</span>
                )}
              </p>
            </div>
            <button
              onClick={handleToggleBot}
              disabled={botLoading || toggling}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                botEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  botEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {botEnabled
              ? "Bot আপনার Facebook পেজে মেসেজের উত্তর দিচ্ছে"
              : "Bot বন্ধ আছে। চালু করতে উপরের টগল ব্যবহার করুন"}
          </p>
        </div>

        {/* User Info & Sign Out */}
        <div className="space-y-3">
          <p className="text-center text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button variant="outline" onClick={signOut} className="w-full gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}