import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShoppingBag, Sparkles, Shield, Languages, Sheet } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <nav className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">MetaPilot AI</span>
        </div>
        <Link to="/login">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </nav>

      <header className="container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          AI sales agent for Facebook Pages
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          Reply, sell, and capture orders <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>automatically</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          MetaPilot answers Messenger DMs and comments in Bengali, English, or mixed Banglish — pulls answers from your Google Sheet, hides spam, and books orders straight into your dashboard.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/login">
            <Button size="lg" className="text-base" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              Open dashboard
            </Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto grid gap-4 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: MessageSquare, title: "Messenger auto-reply", desc: "Human-like AI replies in Bangla, English, and Banglish — 24/7." },
          { icon: ShoppingBag, title: "Auto order capture", desc: "Collects name, phone, address, items. Saved to Supabase & Sheets." },
          { icon: Sheet, title: "Google Sheets brain", desc: "Connect a sheet — AI uses it as live knowledge base." },
          { icon: Shield, title: "Spam & abuse filter", desc: "Detects abusive comments and hides them automatically." },
          { icon: Languages, title: "Comment-to-DM", desc: "Keywords like 'price' or 'দাম' trigger a Messenger DM." },
          { icon: Sparkles, title: "BYOK AI", desc: "Use built-in Lovable AI or plug in your own OpenAI / Gemini key." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border p-6 transition hover:border-primary/50" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-elegant)" }}>
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
