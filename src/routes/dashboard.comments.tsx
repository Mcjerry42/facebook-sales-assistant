import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboardOverview, saveFbConfig } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/comments")({ component: Comments });

function Comments() {
  const fn = useServerFn(getDashboardOverview);
  const saveFn = useServerFn(saveFbConfig);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => fn() });
  const comments = data?.comments ?? [];
  const cfg = data?.fbConfig as any;
  const ai = data?.aiSettings as any;

  const [posts, setPosts] = useState<string[]>([]);
  const [postInput, setPostInput] = useState("");

  useEffect(() => {
    if (cfg) setPosts(Array.isArray(cfg.monitored_post_ids) ? cfg.monitored_post_ids : []);
  }, [cfg]);

  const save = useMutation({
    mutationFn: (nextPosts: string[]) =>
      saveFn({
        data: {
          page_id: cfg?.page_id ?? null,
          page_name: cfg?.page_name ?? null,
          page_access_token: cfg?.page_access_token ?? null,
          verify_token: cfg?.verify_token ?? "lovable_fb_verify_token",
          app_secret: cfg?.app_secret ?? null,
          monitored_post_ids: nextPosts,
        },
      }),
    onSuccess: () => {
      toast.success("Monitored posts updated");
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPost = () => {
    const id = extractPostId(postInput.trim());
    if (!id) { toast.error("Could not read post ID from that link"); return; }
    if (posts.includes(id)) { toast.info("Already added"); return; }
    const next = [...posts, id];
    setPosts(next);
    setPostInput("");
    save.mutate(next);
  };
  const removePost = (id: string) => {
    const next = posts.filter((p) => p !== id);
    setPosts(next);
    save.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Comments</h1>
        <p className="text-muted-foreground mt-1">
          AI replies only to comments on the posts you list below. Auto-reply is currently{" "}
          <b>{ai?.auto_reply_comments ? "ON" : "OFF"}</b>.
        </p>
      </div>

      <Card className="p-6 space-y-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <div>
          <h2 className="font-semibold">Monitored posts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a Facebook post link (or ID). Only comments on these posts will be auto-replied.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={postInput}
            onChange={(e) => setPostInput(e.target.value)}
            placeholder="https://www.facebook.com/.../posts/..."
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPost(); } }}
          />
          <Button type="button" variant="secondary" onClick={addPost} disabled={save.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {posts.length === 0 && (
            <p className="text-xs text-muted-foreground">No posts added yet — comments are being ignored.</p>
          )}
          {posts.map((id) => (
            <div key={id} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
              <span className="font-mono">{id}</span>
              <button onClick={() => removePost(id)} className="opacity-60 hover:opacity-100" aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="font-semibold mb-3">Recent comments</h2>
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

function extractPostId(input: string): string | null {
  if (!input) return null;
  if (/^[0-9]+(_[0-9]+)?$/.test(input)) return input;
  try {
    const u = new URL(input);
    const m = u.pathname.match(/\/(?:posts|permalink|videos|photos)\/(?:pfbid\w+|[0-9]+)/);
    if (m) {
      const last = u.pathname.split("/").filter(Boolean).pop();
      if (last) return last;
    }
    const story = u.searchParams.get("story_fbid");
    const pid = u.searchParams.get("id");
    if (story && pid) return `${pid}_${story}`;
    if (story) return story;
    const fbid = u.searchParams.get("fbid");
    if (fbid) return fbid;
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return last;
  } catch {}
  return null;
}