import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { MessageSquare, ShoppingBag, MessageCircle, Brain, Sheet, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({ component: Overview });

function Stat({ icon: Icon, label, value, hint }: any) {
  return (
    <Card className="p-5 border-border/50" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="text-3xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function Overview() {
  const fn = useServerFn(getDashboardOverview);
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => fn() });

  if (isLoading) return <div className="text-muted-foreground">Loading dashboard…</div>;

  const fb = data?.fbConfig?.connected;
  const sheets = data?.sheetsConfig?.connected;
  const ai = !!data?.aiSettings;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Live status of your MetaPilot automation.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={MessageSquare} label="Conversations" value={data?.conversations.length ?? 0} />
        <Stat icon={MessageCircle} label="Comments" value={data?.comments.length ?? 0} />
        <Stat icon={ShoppingBag} label="Orders" value={data?.orders.length ?? 0} />
        <Stat icon={Brain} label="AI Messages" value={data?.messageCount ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ConnState icon={MessageSquare} label="Facebook Page" ok={!!fb} hint={fb ? data?.fbConfig?.page_name : "Add Page Access Token"} />
        <ConnState icon={Sheet} label="Google Sheets KB" ok={!!sheets} hint={sheets ? `${data?.sheetsConfig?.row_count} rows synced` : "Connect a sheet"} />
        <ConnState icon={Brain} label="AI Engine" ok={ai} hint={ai ? `${data?.aiSettings?.provider} • ${data?.aiSettings?.model}` : "Configure AI"} />
      </div>

      <Card className="p-5 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="font-semibold mb-3">Recent Orders</h2>
        {data?.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet. They'll appear here as the AI captures them from Messenger.</p>
        ) : (
          <div className="space-y-2">
            {data?.orders.slice(0, 5).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                <div>
                  <div className="font-medium">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{o.phone} • {o.status}</div>
                </div>
                <div className="text-primary font-medium">৳ {Number(o.total ?? 0).toFixed(0)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ConnState({ icon: Icon, label, ok, hint }: any) {
  return (
    <Card className="p-4 border-border/50 flex items-center gap-3" style={{ background: "var(--gradient-card)" }}>
      <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-secondary"><Icon className="h-5 w-5" /></div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{hint}</div>
      </div>
      {ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
    </Card>
  );
}