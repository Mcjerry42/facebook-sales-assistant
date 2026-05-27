import { useEffect, useState } from "react";
import { metapilotSupabase } from "@/lib/metapilot-supabase-browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, LogOut, Sparkles, Lock } from "lucide-react";

type Settings = {
  price_bdt: number;
  whatsapp_number: string | null;
  package_name: string;
  paywall_title: string;
  paywall_message: string;
};

export function Paywall({ userEmail, onSignOut }: { userEmail?: string; onSignOut: () => void }) {
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    metapilotSupabase
      .from("app_settings")
      .select("price_bdt, whatsapp_number, package_name, paywall_title, paywall_message")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setS(data as Settings | null));
  }, []);

  const wa = s?.whatsapp_number?.replace(/[^0-9]/g, "");
  const waLink = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi! I want to activate my MetaPilot account.\nEmail: ${userEmail ?? ""}\nPackage: ${s?.package_name ?? ""}`,
      )}`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--gradient-hero)" }}>
      <Card className="w-full max-w-lg p-8 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">MetaPilot</span>
        </div>

        <div className="flex items-center gap-2 text-amber-500 text-sm mb-2">
          <Lock className="h-4 w-4" />
          <span>Account not yet activated</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{s?.paywall_title ?? "Activate your account"}</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed whitespace-pre-line">
          {s?.paywall_message ?? "Loading…"}
        </p>

        <div className="mt-6 rounded-lg border border-border/50 p-4 bg-background/40">
          <div className="text-xs uppercase text-muted-foreground">Package</div>
          <div className="font-medium mt-1">{s?.package_name ?? "—"}</div>
          <div className="text-3xl font-semibold text-primary mt-2">
            ৳ {Number(s?.price_bdt ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2" size="lg">
                <MessageCircle className="h-4 w-4" />
                Contact on WhatsApp
              </Button>
            </a>
          ) : (
            <Button className="w-full" size="lg" disabled>
              WhatsApp number not set yet
            </Button>
          )}
          <Button variant="ghost" onClick={onSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Signed in as <span className="text-foreground">{userEmail}</span>
        </p>
      </Card>
    </div>
  );
}