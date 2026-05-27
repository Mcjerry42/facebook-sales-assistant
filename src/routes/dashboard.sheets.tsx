import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getDashboardOverview, connectSheet, saveOrdersSheet, testOrdersSheet } from "@/lib/dashboard.functions";
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
  const saveOrdersFn = useServerFn(saveOrdersSheet);
  const testOrdersFn = useServerFn(testOrdersSheet);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn() });
  const cfg = data?.sheetsConfig;
  const [url, setUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [ordersUrl, setOrdersUrl] = useState("");

  useEffect(() => {
    if (cfg) {
      setUrl(cfg.sheet_url ?? "");
      setSheetName(cfg.sheet_name ?? "Sheet1");
      setOrdersUrl((cfg as any).orders_sheet_url ?? "");
    }
  }, [cfg]);

  const sync = useMutation({
    mutationFn: () => connectFn({ data: { sheet_url: url, sheet_name: sheetName } }),
    onSuccess: (r) => { toast.success(`Synced ${r.rowCount} rows`); qc.invalidateQueries({ queryKey: ["overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveOrders = useMutation({
    mutationFn: () => saveOrdersFn({ data: { orders_sheet_url: ordersUrl || null } }),
    onSuccess: () => { toast.success("Orders sheet URL saved"); qc.invalidateQueries({ queryKey: ["overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const testOrders = useMutation({
    mutationFn: () => testOrdersFn(),
    onSuccess: (r: any) => toast.success(`Test row sent (${r.status}). Check your sheet.`),
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

      <Card className="p-6 space-y-4 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <div>
          <h2 className="font-semibold">Auto-export orders to Google Sheets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create a Google Apps Script Web App that appends a row from the JSON we POST, then paste its URL here.
            Each confirmed order will be sent automatically.
          </p>
        </div>
        <details className="text-xs text-muted-foreground rounded border border-border/40 p-3">
          <summary className="cursor-pointer font-medium">Show Apps Script template</summary>
          <pre className="mt-2 overflow-auto text-[11px] leading-relaxed">{`function doGet() {
  return ContentService.createTextOutput("MetaPilot webhook is live");
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID","Created","Name","Phone","Address","Items","Total","Status","Notes"]);
    }
    var o = JSON.parse(e.postData.contents);
    sheet.appendRow([
      o.id, o.created_at, o.customer_name, o.phone, o.address,
      JSON.stringify(o.items), o.total, o.status, o.notes || ""
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}</pre>
          <ol className="mt-2 list-decimal list-inside space-y-1">
            <li>Open your Google Sheet → Extensions → Apps Script.</li>
            <li>Paste the code above, save (Ctrl/Cmd+S).</li>
            <li>Click <b>Deploy → New deployment</b>. Gear icon → <b>Web app</b>.</li>
            <li>Execute as: <b>Me</b> · Who has access: <b>Anyone</b> → Deploy.</li>
            <li>Authorize when prompted, then copy the Web app URL.</li>
          </ol>
        </details>
        <div>
          <Label>Apps Script Web App URL</Label>
          <Input value={ordersUrl} onChange={(e) => setOrdersUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..../exec" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveOrders.mutate()} disabled={saveOrders.isPending} variant="secondary">
            {saveOrders.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => testOrders.mutate()}
            disabled={!ordersUrl || testOrders.isPending}
          >
            {testOrders.isPending ? "Sending…" : "Send test row"}
          </Button>
        </div>
        {(cfg as any)?.orders_last_synced_at && (
          <p className="text-xs text-muted-foreground">
            Last order synced: {new Date((cfg as any).orders_last_synced_at).toLocaleString()}
          </p>
        )}
      </Card>
    </div>
  );
}