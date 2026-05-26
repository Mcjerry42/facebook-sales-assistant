import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDashboardOverview, updateOrderStatus } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/orders")({ component: Orders });

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

function Orders() {
  const fn = useServerFn(getDashboardOverview);
  const updateFn = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => fn() });
  const orders = data?.orders ?? [];

  const mut = useMutation({
    mutationFn: (v: { id: string; status: any }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overview"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">Captured automatically by AI from Messenger chats.</p>
      </div>
      <Card className="border-border/50 overflow-hidden" style={{ background: "var(--gradient-card)" }}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border/40">
            <tr><th className="p-3">Customer</th><th className="p-3">Phone</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No orders yet.</td></tr>
            )}
            {orders.map((o: any) => (
              <tr key={o.id} className="border-b border-border/20 last:border-0">
                <td className="p-3">
                  <div className="font-medium">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{o.address}</div>
                </td>
                <td className="p-3">{o.phone}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{JSON.stringify(o.items)}</td>
                <td className="p-3 font-medium text-primary">৳ {Number(o.total ?? 0).toFixed(0)}</td>
                <td className="p-3">
                  <Select value={o.status} onValueChange={(v) => mut.mutate({ id: o.id, status: v })}>
                    <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}