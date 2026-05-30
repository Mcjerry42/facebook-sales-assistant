import {
  createFileRoute,
  Outlet,
  useNavigate,
  Link,
  useLocation,
  redirect,
} from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { metapilotSupabase } from "@/lib/metapilot-supabase-browser";
import { fixFirstUserApproval } from "@/lib/dashboard.functions";
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  ShoppingBag,
  Brain,
  Sheet,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet as SheetUI, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { FullPageLoader } from "@/components/page-loader";
import { Paywall } from "@/components/paywall";

export const Route = createFileRoute("/dashboard")({
  // Auth lives in localStorage — render entirely on the client to avoid
  // an SSR pass that has no session and produces a blank/hydration-mismatched page.
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

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/inbox", label: "Messenger Inbox", icon: MessageSquare },
  { to: "/dashboard/comments", label: "Comments", icon: MessageCircle },
  { to: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { to: "/dashboard/ai", label: "AI Settings", icon: Brain },
  { to: "/dashboard/sheets", label: "Google Sheets", icon: Sheet },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/connect", label: "Facebook & API", icon: Settings },
];

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isAppOwner, setIsAppOwner] = useState<boolean | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        // The DB trigger auto-approved them. Force override to false!
        try {
          await fixFirstUserApproval();
        } catch (e) {
          console.error("Failed to fix approval", e);
        }
        approved = false; // Block them immediately for this session
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const signOut = async () => {
    await metapilotSupabase.auth.signOut();
    navigate({ to: "/login" });
  };

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

  const SidebarContent = () => (
    <>
      <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2 pt-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold tracking-tight">MetaPilot</span>
      </Link>
      <nav className="flex-1 space-y-1">
        {nav.map((item) => {
          const active = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border pt-3">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <SidebarContent />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border/50 bg-sidebar/60 px-4 py-3 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">MetaPilot</span>
          </Link>
          <SheetUI open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-4 flex flex-col">
              <SidebarContent />
            </SheetContent>
          </SheetUI>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
