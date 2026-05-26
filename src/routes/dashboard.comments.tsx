import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/comments")({ component: Comments });

function Comments() {
  const fn = useServerFn(getDashboardOverview);
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => fn() });
  const comments = data?.comments ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Comments</h1>
        <p className="text-muted-foreground mt-1">Auto-replied & moderated comments on your Page posts.</p>
      </div>
      <Card className="p-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments captured yet.</p>}
        <div className="space-y-3">
          {comments.map((c: any) => (
            <div key={c.id} className="flex justify-between gap-4 border-b border-border/30 pb-3 last:border-0">
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.commenter_name ?? "Anonymous"}</div>
                <div className="text-sm text-muted-foreground truncate">{c.text}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.dm_sent && <Badge variant="secondary">DM sent</Badge>}
                {c.hidden && <Badge variant="destructive">Hidden</Badge>}
                <Badge>{c.action}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}