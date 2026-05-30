import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { metapilotSupabase } from "@/lib/metapilot-supabase-browser";
import { metapilotSupabaseAdmin } from "@/lib/metapilot-supabase.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const checkSignupsAllowed = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await metapilotSupabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true });
  return (count ?? 0) === 0;
});

const APP_URL = "https://id-preview--5c37c6b8-2d4f-4901-bfe7-810baaba3f65.lovable.app";
const getAuthRedirectUrl = () => {
  if (typeof window === "undefined") return `${APP_URL}/dashboard`;

  const origin = window.location.origin;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return `${APP_URL}/dashboard`;
  }

  return `${origin}/dashboard`;
};

export const Route = createFileRoute("/login")({
  component: LoginPage,
  loader: async () => {
    const signupsAllowed = await checkSignupsAllowed();
    return { signupsAllowed };
  },
});

function LoginPage() {
  const { signupsAllowed } = Route.useLoaderData();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(signupsAllowed ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = metapilotSupabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" && s) navigate({ to: "/dashboard" });
    });
    metapilotSupabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/dashboard" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!signupsAllowed) {
           throw new Error("Signups are currently disabled because the application already has an owner.");
        }
        const { data, error } = await metapilotSupabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        });
        if (error) throw error;
        if (data.session?.user) {
          toast.success("Account created");
          setMessage({ type: "success", text: "Account created. Opening dashboard…" });
          navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Account created");
          setMessage({ type: "success", text: "Account created. Please sign in now." });
          setMode("signin");
        }
      } else {
        const { data, error } = await metapilotSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session?.user) throw new Error("Sign in did not return a session. Please try again.");
        toast.success("Signed in");
        setMessage({ type: "success", text: "Signed in. Opening dashboard…" });
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err: any) {
      const text = err?.message ?? "Authentication failed";
      toast.error(text);
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setMessage({ type: "info", text: "Opening Google sign-in…" });
    try {
      const { error } = await metapilotSupabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getAuthRedirectUrl() },
      });
      if (error) throw error;
    } catch (err: any) {
      const text = err?.message ?? "Google sign-in failed";
      toast.error(text);
      setMessage({ type: "error", text });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-8" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-elegant)" }}>
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">MetaPilot AI</span>
        </Link>
        <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
           {signupsAllowed ? "The first account becomes the owner." : "Signups are closed. Please log in."}
        </p>

        {mode === "signin" && (
          <Button onClick={handleGoogle} variant="outline" className="mt-6 w-full">
            Continue with Google
          </Button>
        )}

        {mode === "signin" && (
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)" }}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {message && (
          <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${message.type === "error" ? "border-destructive/50 bg-destructive/10 text-destructive-foreground" : "border-border bg-secondary text-secondary-foreground"}`}>
            {message.text}
          </div>
        )}

        {signupsAllowed && (
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
            {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        )}
      </div>
    </div>
  );
}