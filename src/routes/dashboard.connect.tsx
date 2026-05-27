import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboardOverview, saveFbConfig } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Copy, X, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/connect")({ component: ConnectPage });

function ConnectPage() {
  const overviewFn = useServerFn(getDashboardOverview);
  const saveFn = useServerFn(saveFbConfig);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn() });
  const cfg = data?.fbConfig;
  const [form, setForm] = useState<any>({ page_id: "", page_name: "", page_access_token: "", verify_token: "lovable_fb_verify_token", app_secret: "", monitored_post_ids: [] as string[] });
  const [webhookUrl, setWebhookUrl] = useState("");
  const [postInput, setPostInput] = useState("");

  useEffect(() => {
    if (cfg) setForm({
      page_id: cfg.page_id ?? "",
      page_name: cfg.page_name ?? "",
      page_access_token: cfg.page_access_token ?? "",
      verify_token: cfg.verify_token ?? "lovable_fb_verify_token",
      app_secret: cfg.app_secret ?? "",
      monitored_post_ids: Array.isArray((cfg as any).monitored_post_ids) ? (cfg as any).monitored_post_ids : [],
    });
  }, [cfg]);

  useEffect(() => {
    if (typeof window !== "undefined") setWebhookUrl(`${window.location.origin}/api/public/fb-webhook`);
  }, []);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => { toast.success("Facebook config saved"); qc.invalidateQueries({ queryKey: ["overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  const addPost = () => {
    const id = extractPostId(postInput.trim());
    if (!id) { toast.error("Could not read post ID from that link"); return; }
    if (form.monitored_post_ids.includes(id)) { toast.info("Already added"); return; }
    setForm({ ...form, monitored_post_ids: [...form.monitored_post_ids, id] });
    setPostInput("");
  };
  const removePost = (id: string) => {
    setForm({ ...form, monitored_post_ids: form.monitored_post_ids.filter((p: string) => p !== id) });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Facebook & API</h1>
        <p className="text-muted-foreground mt-1">Connect your Facebook Page so MetaPilot can read messages, comments, and reply on your behalf.</p>
      </div>

      <Card className="p-6 space-y-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="font-semibold">1. Meta Webhook</h2>
        <p className="text-sm text-muted-foreground">In your Meta App → Messenger → Webhooks, use these values:</p>
        <CopyRow label="Callback URL" value={webhookUrl} onCopy={copy} />
        <CopyRow label="Verify token" value={form.verify_token} onCopy={copy} />
        <p className="text-xs text-muted-foreground">Subscribe to <code>messages</code>, <code>messaging_postbacks</code>, <code>feed</code>.</p>
      </Card>

      <Card className="p-6 space-y-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="font-semibold">2. Page credentials</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Page ID" value={form.page_id} onChange={(v) => setForm({ ...form, page_id: v })} />
          <Field label="Page name" value={form.page_name} onChange={(v) => setForm({ ...form, page_name: v })} />
          <Field label="Verify token" value={form.verify_token} onChange={(v) => setForm({ ...form, verify_token: v })} />
          <Field label="App secret" value={form.app_secret} onChange={(v) => setForm({ ...form, app_secret: v })} type="password" />
          <div className="md:col-span-2">
            <Label>Page access token</Label>
            <Input type="password" value={form.page_access_token} onChange={(e) => setForm({ ...form, page_access_token: e.target.value })} placeholder="EAA..." />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ background: "var(--gradient-primary)" }}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {cfg?.connected && <span className="text-sm text-primary inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Connected</span>}
        </div>
      </Card>

      <Card className="p-6 space-y-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <div>
          <h2 className="font-semibold">3. Monitored posts</h2>
          <p className="text-sm text-muted-foreground mt-1">AI will only auto-reply to comments on the posts listed here. Leave empty to ignore all comments.</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={postInput}
            onChange={(e) => setPostInput(e.target.value)}
            placeholder="Paste Facebook post URL or ID"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPost(); } }}
          />
          <Button type="button" variant="secondary" onClick={addPost}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.monitored_post_ids.length === 0 && (
            <p className="text-xs text-muted-foreground">No posts added yet.</p>
          )}
          {form.monitored_post_ids.map((id: string) => (
            <div key={id} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
              <span className="font-mono">{id}</span>
              <button onClick={() => removePost(id)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} variant="secondary">
          {save.isPending ? "Saving…" : "Save monitored posts"}
        </Button>
      </Card>
    </div>
  );
}

function extractPostId(input: string): string | null {
  if (!input) return null;
  // If user pasted just digits or pageid_postid
  if (/^[0-9]+(_[0-9]+)?$/.test(input)) return input;
  try {
    const u = new URL(input);
    // /posts/<id> or /permalink/<id> or /videos/<id>
    const m = u.pathname.match(/\/(?:posts|permalink|videos|photos)\/(?:pfbid\w+|[0-9]+)/);
    if (m) {
      const last = u.pathname.split("/").filter(Boolean).pop();
      if (last) return last;
    }
    // ?story_fbid=...&id=...
    const story = u.searchParams.get("story_fbid");
    const pid = u.searchParams.get("id");
    if (story && pid) return `${pid}_${story}`;
    if (story) return story;
    // fbid for permalink.php
    const fbid = u.searchParams.get("fbid");
    if (fbid) return fbid;
    // Fallback: last path segment
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return last;
  } catch {
    // not a URL
  }
  return null;
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type ?? "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button variant="secondary" size="icon" onClick={() => onCopy(value)}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}