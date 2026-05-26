import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/analytics")({ component: Analytics });

function Analytics() {
  const fn = useServerFn(getDashboardOverview);
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => fn() });

  const orders = data?.orders ?? [];
  const revenue = orders.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
  const confirmed = orders.filter((o: any) => o.status === "confirmed" || o.status === "shipped" || o.status === "delivered").length;
  const convRate = orders.length ? Math.round((confirmed / orders.length) * 100) : 0;

  const byStatus: Record<string, number> = {};
  orders.forEach((o: any) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance of your automated funnel.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total Revenue" value={`৳ ${revenue.toFixed(0)}`} />
        <Metric label="Confirmed Orders" value={confirmed} />
        <Metric label="Conversion" value={`${convRate}%`} />
      </div>
      <Card className="p-6 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="font-semibold mb-4">Orders by status</h2>
        <div className="space-y-2">
          {Object.entries(byStatus).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1"><span className="capitalize">{k}</span><span>{v}</span></div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(v / orders.length) * 100}%`, background: "var(--gradient-primary)" }} />
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-5 border-border/50" style={{ background: "var(--gradient-card)" }}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </Card>
  );
}