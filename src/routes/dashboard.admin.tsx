import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, RotateCw, Save, ShieldCheck, X } from "lucide-react";
import {
  getAdminControls,
  savePackageSettings,
  updateUserApproval,
} from "@/lib/dashboard.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin")({
  ssr: false,
  component: AdminControlsPage,
});

type SettingsForm = {
  price_bdt: number;
  duration_days: number;
  whatsapp_number: string;
  package_name: string;
  paywall_title: string;
  paywall_message: string;
};

const DEFAULT_SETTINGS: SettingsForm = {
  price_bdt: 2000,
  duration_days: 30,
  whatsapp_number: "",
  package_name: "MetaPilot Pro",
  paywall_title: "Activate your account",
  paywall_message:
    "এপটি ব্যবহার করতে নিচের প্যাকেজটি কিনুন। WhatsApp এ যোগাযোগ করুন, পেমেন্ট নিশ্চিত হলে আপনার একাউন্ট approve করে দেওয়া হবে।",
};

function AdminControlsPage() {
  const controlsFn = useServerFn(getAdminControls);
  const approvalFn = useServerFn(updateUserApproval);
  const settingsFn = useServerFn(savePackageSettings);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-controls"],
    queryFn: () => controlsFn(),
  });
  const [settings, setSettings] = useState<SettingsForm>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!data?.settings) return;
    setSettings({
      price_bdt: Number(data.settings.price_bdt ?? DEFAULT_SETTINGS.price_bdt),
      duration_days: Number(data.settings.duration_days ?? DEFAULT_SETTINGS.duration_days),
      whatsapp_number: data.settings.whatsapp_number ?? "",
      package_name: data.settings.package_name ?? DEFAULT_SETTINGS.package_name,
      paywall_title: data.settings.paywall_title ?? DEFAULT_SETTINGS.paywall_title,
      paywall_message: data.settings.paywall_message ?? DEFAULT_SETTINGS.paywall_message,
    });
  }, [data?.settings]);

  const approve = useMutation({
    mutationFn: (payload: {
      userId: string;
      is_approved: boolean;
      approved_until: string | null;
    }) => approvalFn({ data: payload }),
    onSuccess: () => {
      toast.success("User approval updated");
      qc.invalidateQueries({ queryKey: ["admin-controls"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSettings = useMutation({
    mutationFn: () => settingsFn({ data: settings }),
    onSuccess: () => {
      toast.success("Package settings saved");
      qc.invalidateQueries({ queryKey: ["admin-controls"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approvedUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + Number(settings.duration_days || 30));
    return d.toISOString();
  }, [settings.duration_days]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        Failed to load admin controls: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">Admin only</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin Controls</h1>
        <p className="text-muted-foreground mt-1">
          Approve users and edit package settings from here. The same data is also editable in the
          backend table view.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="border-border/50 p-5" style={{ background: "var(--gradient-card)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">User Approval</h2>
              <p className="text-sm text-muted-foreground">
                Approve, remove approval, and set expiry automatically from package duration.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-controls"] })}
            >
              <RotateCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading users…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.profiles ?? []).map((p: any) => {
                  const expired = p.approved_until
                    ? new Date(p.approved_until).getTime() <= Date.now()
                    : false;
                  const active = Boolean(p.is_approved) && !expired;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">
                          {p.email ?? p.full_name ?? "Unknown user"}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.full_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={active ? "default" : "secondary"}>
                          {active ? "Approved" : p.is_approved ? "Expired" : "Not approved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.approved_until
                          ? new Date(p.approved_until).toLocaleDateString()
                          : "Unlimited / not set"}
                      </TableCell>
                      <TableCell className="text-right">
                        {active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approve.isPending}
                            onClick={() =>
                              approve.mutate({
                                userId: p.id,
                                is_approved: false,
                                approved_until: null,
                              })
                            }
                          >
                            <X className="mr-2 h-4 w-4" /> Remove
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={approve.isPending}
                            onClick={() =>
                              approve.mutate({
                                userId: p.id,
                                is_approved: true,
                                approved_until: approvedUntil,
                              })
                            }
                          >
                            <Check className="mr-2 h-4 w-4" /> Approve {settings.duration_days}d
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="border-border/50 p-5" style={{ background: "var(--gradient-card)" }}>
          <h2 className="font-semibold">Package Settings</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This controls the paywall price, duration, WhatsApp button, and message.
          </p>
          <div className="space-y-4">
            <div>
              <Label>Package name</Label>
              <Input
                value={settings.package_name}
                onChange={(e) => setSettings({ ...settings, package_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (BDT)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.price_bdt}
                  onChange={(e) => setSettings({ ...settings, price_bdt: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Duration days</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.duration_days}
                  onChange={(e) =>
                    setSettings({ ...settings, duration_days: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div>
              <Label>WhatsApp number</Label>
              <Input
                value={settings.whatsapp_number}
                onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                placeholder="8801XXXXXXXXX"
              />
            </div>
            <div>
              <Label>Paywall title</Label>
              <Input
                value={settings.paywall_title}
                onChange={(e) => setSettings({ ...settings, paywall_title: e.target.value })}
              />
            </div>
            <div>
              <Label>Paywall message</Label>
              <Textarea
                rows={4}
                value={settings.paywall_message}
                onChange={(e) => setSettings({ ...settings, paywall_message: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <span className="text-sm">WhatsApp button visible</span>
              <Switch checked={Boolean(settings.whatsapp_number.trim())} disabled />
            </div>
            <Button
              className="w-full"
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
              style={{ background: "var(--gradient-primary)" }}
            >
              <Save className="mr-2 h-4 w-4" />{" "}
              {saveSettings.isPending ? "Saving…" : "Save package"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
