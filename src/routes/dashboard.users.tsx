import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { metapilotSupabase } from "@/lib/metapilot-supabase-browser";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/users")({
  ssr: false,
  component: UsersAndPricing,
});

type Profile = { id: string; email: string | null; full_name: string | null; is_approved: boolean; created_at: string };
type Settings = {
  id: string;
  price_bdt: number;
  whatsapp_number: string | null;
  package_name: string;
  paywall_title: string;
  paywall_message: string;
};

function UsersAndPricing() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: ps }, { data: st }] = await Promise.all([
      metapilotSupabase.from("profiles").select("id,email,full_name,is_approved,created_at").order("created_at", { ascending: false }),
      metapilotSupabase.from("app_settings").select("*").limit(1).maybeSingle(),
    ]);
    setProfiles((ps as Profile[]) ?? []);
    setS(st as Settings | null);
  };

  useEffect(() => { load(); }, []);

  const toggleApproved = async (p: Profile, v: boolean) => {
    const { error } = await metapilotSupabase.from("profiles").update({ is_approved: v }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(v ? "Approved" : "Revoked");
    load();
  };

  const saveSettings = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await metapilotSupabase
      .from("app_settings")
      .update({
        price_bdt: s.price_bdt,
        whatsapp_number: s.whatsapp_number,
        package_name: s.package_name,
        paywall_title: s.paywall_title,
        paywall_message: s.paywall_message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users & Pricing</h1>
        <p className="text-muted-foreground mt-1">Approve users, set the price, and configure the WhatsApp contact. Editable here or directly from the database.</p>
      </div>

      <Card className="p-6 border-border/50 space-y-4" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold">Paywall settings</h2>
        {!s ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Package name</Label>
              <Input value={s.package_name} onChange={(e) => setS({ ...s, package_name: e.target.value })} />
            </div>
            <div>
              <Label>Price (BDT)</Label>
              <Input type="number" value={s.price_bdt} onChange={(e) => setS({ ...s, price_bdt: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <Label>WhatsApp number (with country code, e.g. 8801XXXXXXXXX)</Label>
              <Input value={s.whatsapp_number ?? ""} onChange={(e) => setS({ ...s, whatsapp_number: e.target.value })} placeholder="8801XXXXXXXXX" />
            </div>
            <div className="md:col-span-2">
              <Label>Paywall title</Label>
              <Input value={s.paywall_title} onChange={(e) => setS({ ...s, paywall_title: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Paywall message</Label>
              <Textarea rows={4} value={s.paywall_message} onChange={(e) => setS({ ...s, paywall_message: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 border-border/50" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold mb-4">Users ({profiles.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border/40">
            <tr><th className="p-2">Email</th><th className="p-2">Name</th><th className="p-2">Joined</th><th className="p-2">Approved</th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-border/20 last:border-0">
                <td className="p-2">{p.email}</td>
                <td className="p-2 text-muted-foreground">{p.full_name}</td>
                <td className="p-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="p-2">
                  <Switch checked={p.is_approved} onCheckedChange={(v) => toggleApproved(p, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}