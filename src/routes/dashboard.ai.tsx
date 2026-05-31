import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboardOverview, saveAiSettings, askAi } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/ai")({ ssr: false, component: AiSettingsPage });

const MODELS = [
  "google/gemini-1.5-flash",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "deepseek-chat",
  "deepseek-reasoner",
];

const DEFAULT_FORM = {
  provider: "lovable",
  model: "google/gemini-1.5-flash",
  api_key: null,
  system_instructions: "You are a friendly Bengali/English sales agent. Reply in the same language as the customer.",
  language_mode: "auto",
  auto_reply_messages: true,
  auto_reply_comments: true,
  auto_hide_abusive: true,
  comment_trigger_keywords: ["price", "দাম", "details", "বিস্তারিত", "inbox", "order"],
};

function AiSettingsPage() {
  const overviewFn = useServerFn(getDashboardOverview);
  const saveFn = useServerFn(saveAiSettings);
  const askFn = useServerFn(askAi);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn() });

  const [form, setForm] = useState<any>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [showBaseUrl, setShowBaseUrl] = useState(false);

  useEffect(() => {
    if (!data || form) return;
    const initial = data.aiSettings ?? DEFAULT_FORM;
    setForm(initial);
    setKeywordsText((initial.comment_trigger_keywords ?? []).join(", "));
  }, [data, form]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      ...form,
      comment_trigger_keywords: keywordsText.split(",").map((s) => s.trim()).filter(Boolean),
    }}),
    onSuccess: () => { toast.success("AI settings saved"); qc.invalidateQueries({ queryKey: ["overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const ask = useMutation({
    mutationFn: () => askFn({ data: { message: testInput } }),
    onSuccess: (r) => setTestOutput(r.text),
    onError: (e: any) => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        Failed to load AI settings: {(error as Error).message}
      </div>
    );
  }

  if (isLoading || !form) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI Settings</h1>
        <p className="text-muted-foreground mt-1">Configure how the AI replies to customers.</p>
      </div>

      <Card className="p-6 space-y-5 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable AI (default, no key)</SelectItem>
                <SelectItem value="openai">OpenAI (your key)</SelectItem>
                <SelectItem value="gemini">Google Gemini (your key)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Model</Label>
            <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.provider !== "lovable" && (
            <>
              <div className="md:col-span-2">
                <Label>API Key</Label>
                <Input type="password" value={form.api_key ?? ""} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <Label>Custom Base URL (optional)</Label>
                  <button
                    type="button"
                    onClick={() => setShowBaseUrl(!showBaseUrl)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {showBaseUrl ? "Hide" : "Show"}
                  </button>
                </div>
                {showBaseUrl && (
                  <Input
                    value={form.base_url ?? ""}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    placeholder="https://api.deepseek.com/v1"
                    className="mt-1"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for default. For DeepSeek use: <code className="text-xs bg-secondary px-1 rounded">https://api.deepseek.com/v1</code>
                </p>
              </div>
            </>
          )}
          <div>
            <Label>Language</Label>
            <Select value={form.language_mode} onValueChange={(v) => setForm({ ...form, language_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect (Bengali / English / Banglish)</SelectItem>
                <SelectItem value="bn">Bengali only</SelectItem>
                <SelectItem value="en">English only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>System Instructions</Label>
          <Textarea rows={5} value={form.system_instructions} onChange={(e) => setForm({ ...form, system_instructions: e.target.value })} />
        </div>

        <div>
          <Label>Comment trigger keywords (comma-separated)</Label>
          <Input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="price, দাম, inbox" />
          <p className="text-xs text-muted-foreground mt-1">When a comment matches, AI auto-replies and sends a private DM.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Toggle label="Auto-reply messages" value={form.auto_reply_messages} onChange={(v) => setForm({ ...form, auto_reply_messages: v })} />
          <Toggle label="Auto-reply comments" value={form.auto_reply_comments} onChange={(v) => setForm({ ...form, auto_reply_comments: v })} />
          <Toggle label="Hide abusive comments" value={form.auto_hide_abusive} onChange={(v) => setForm({ ...form, auto_hide_abusive: v })} />
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ background: "var(--gradient-primary)" }}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </Card>

      <Card className="p-6 space-y-3 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="font-semibold">Test the AI</h2>
        <p className="text-sm text-muted-foreground">Send a sample customer message and see the AI's reply using your Knowledge Base.</p>
        <Textarea rows={2} value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="দাম কত? / What is the price?" />
        <Button variant="secondary" onClick={() => ask.mutate()} disabled={!testInput || ask.isPending}>
          {ask.isPending ? "Thinking…" : "Run test"}
        </Button>
        {testOutput && (
          <div className="rounded-lg bg-secondary p-3 text-sm whitespace-pre-wrap">{testOutput}</div>
        )}
      </Card>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}