import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getDashboardOverview, connectSheet } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, RefreshCw, Sheet as SheetIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/sheets")({ component: Sheets });

function Sheets() {
  const overviewFn = useServerFn(getDashboardOverview);
  const connectFn = useServerFn(connectSheet);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn() });
  const cfg = data?.sheetsConfig;
  const [url, setUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");

  useEffect(() => {
    if (cfg) { setUrl(cfg.sheet_url ?? ""); setSheetName(cfg.sheet_name ?? "Sheet1"); }
  }, [cfg]);

  const sync = useMutation({
    mutationFn: () => connectFn({ data: { sheet_url: url, sheet_name: sheetName } }),
    onSuccess: (r) => { toast.success(`Synced ${r.rowCount} rows`); qc.invalidateQueries({ queryKey: ["overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Google Sheets Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">Connect a sheet with columns like <code>question</code>, <code>answer</code>, <code>category</code>. The AI will answer using this data.</p>
      </div>

      <Card className="p-6 space-y-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <div>
          <Label>Google Sheets URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
          <p className="text-xs text-muted-foreground mt-1">Share → "Anyone with the link" can view.</p>
        </div>
        <div>
          <Label>Sheet tab name</Label>
          <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Sheet1" />
        </div>
        <Button onClick={() => sync.mutate()} disabled={!url || sync.isPending} style={{ background: "var(--gradient-primary)" }}>
          <RefreshCw className={sync.isPending ? "animate-spin h-4 w-4 mr-2" : "h-4 w-4 mr-2"} />
          {cfg?.connected ? "Re-sync now" : "Connect & Sync"}
        </Button>
      </Card>

      {cfg?.connected && (
        <Card className="p-4 border-border/50 flex items-center gap-3" style={{ background: "var(--gradient-card)" }}>
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-medium flex items-center gap-2"><SheetIcon className="h-4 w-4" /> Connected</div>
            <div className="text-xs text-muted-foreground">{cfg.row_count} rows • last synced {cfg.last_synced_at ? new Date(cfg.last_synced_at).toLocaleString() : "never"}</div>
          </div>
        </Card>
      )}
    </div>
  );
}