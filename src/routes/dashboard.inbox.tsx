import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getDashboardOverview, getMessages, toggleHumanTakeover } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/inbox")({ component: Inbox });

function Inbox() {
  const overviewFn = useServerFn(getDashboardOverview);
  const messagesFn = useServerFn(getMessages);
  const toggleFn = useServerFn(toggleHumanTakeover);
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn() });
  const conversations = overview?.conversations ?? [];
  const active = conversations.find((c: any) => c.id === activeId) ?? conversations[0];

  const { data: messages } = useQuery({
    queryKey: ["messages", active?.id],
    queryFn: () => messagesFn({ data: { conversationId: active!.id } }),
    enabled: !!active?.id,
  });

  const toggle = useMutation({
    mutationFn: (vars: { enabled: boolean }) => toggleFn({ data: { conversationId: active!.id, enabled: vars.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overview"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Messenger Inbox</h1>
        <p className="text-muted-foreground mt-1">Live AI conversations from your Facebook Page.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] min-h-[60vh]">
        <Card className="p-2 border-border/50 overflow-auto" style={{ background: "var(--gradient-card)" }}>
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet. Connect your Facebook Page to get started.</p>
          )}
          {conversations.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg transition hover:bg-secondary/60",
                active?.id === c.id && "bg-secondary",
              )}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium text-sm truncate">{c.fb_user_name ?? "Unknown"}</span>
                {c.unread_count > 0 && <span className="text-xs bg-primary text-primary-foreground rounded-full px-2">{c.unread_count}</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message ?? "—"}</p>
            </button>
          ))}
        </Card>
        <Card className="p-4 border-border/50 flex flex-col" style={{ background: "var(--gradient-card)" }}>
          {active ? (
            <>
              <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                <div>
                  <div className="font-medium">{active.fb_user_name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">AI auto-reply {active.human_takeover ? "paused" : "active"}</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  Human takeover
                  <Switch checked={!!active.human_takeover} onCheckedChange={(v) => toggle.mutate({ enabled: v })} />
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-auto">
                {(messages ?? []).map((m: any) => (
                  <div key={m.id} className={cn("flex", m.is_ai ? "justify-end" : "justify-start")}>
                    <div className={cn("rounded-2xl px-4 py-2 max-w-[75%] text-sm", m.is_ai ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {(!messages || messages.length === 0) && <p className="text-sm text-muted-foreground">No messages.</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground m-auto">Select a conversation.</p>
          )}
        </Card>
      </div>
    </div>
  );
}