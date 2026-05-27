import { Sparkles } from "lucide-react";

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div
            className="absolute inset-0 rounded-2xl blur-xl opacity-70 animate-pulse"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-6 w-6 text-primary-foreground animate-pulse" />
          </div>
          <div className="absolute -inset-2 rounded-3xl border border-primary/30 animate-ping" />
        </div>
        <div className="text-sm text-muted-foreground tracking-wide">{label}…</div>
      </div>
    </div>
  );
}

export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center"
      style={{ background: "var(--gradient-hero)" }}
    >
      <PageLoader label={label} />
    </div>
  );
}