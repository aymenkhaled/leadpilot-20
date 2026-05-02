import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Settings, User, Key, Layers, Send, Bell, CreditCard, Check, X, Plus, Trash2, TestTube } from "lucide-react";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", desc: "GPT-4o for classification, pitch generation, agent loop" },
  { id: "anthropic", name: "Anthropic", desc: "Claude for alternative AI model" },
  { id: "aleads", name: "A-Leads", desc: "Primary contact enrichment (domain search)" },
  { id: "prospeo", name: "Prospeo", desc: "Email enrichment by domain" },
  { id: "apollo", name: "Apollo", desc: "Contact search by company domain" },
  { id: "hunter", name: "Hunter.io", desc: "Email finder by domain" },
  { id: "rocketreach", name: "RocketReach", desc: "Professional contact enrichment" },
  { id: "serper", name: "Serper", desc: "Google search for domain resolution" },
  { id: "apify", name: "Apify", desc: "Job scraping via Apify actors" },
  { id: "smartlead", name: "Smartlead", desc: "Outbound email sending" },
  { id: "instantly", name: "Instantly", desc: "Outbound email sending" },
  { id: "postmark", name: "Postmark", desc: "Transactional email (welcome, alerts)" },
  { id: "stripe", name: "Stripe", desc: "Billing and subscription management" },
];

const WATERFALL_PROVIDERS = ["aleads", "prospeo", "apollo", "hunter", "rocketreach"];

function ProfileTab() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<any>("/settings"),
  });
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch("/settings", data),
    onSuccess: () => {
      toast({ title: "Settings saved", variant: "default" });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const { register, handleSubmit } = useForm({ defaultValues: settings });

  return (
    <form onSubmit={handleSubmit(data => saveMutation.mutate(data))} className="space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Profile & Sender Info</CardTitle>
          <CardDescription>This information is used to personalize generated pitches and emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Company name</Label>
              <Input {...register("profileCompanyName")} placeholder="Acme Agency" className="mt-1" defaultValue={settings?.profileCompanyName || ""} />
            </div>
            <div>
              <Label>Your domain</Label>
              <Input {...register("profileDomain")} placeholder="acme.agency" className="mt-1" defaultValue={settings?.profileDomain || ""} />
            </div>
          </div>
          <div>
            <Label>Website</Label>
            <Input {...register("profileWebsite")} placeholder="https://acme.agency" className="mt-1" defaultValue={settings?.profileWebsite || ""} />
          </div>
          <div>
            <Label>Services offered</Label>
            <Input {...register("profileServices")} placeholder="React development, TypeScript, Node.js" className="mt-1" defaultValue={settings?.profileServices || ""} />
          </div>
          <div>
            <Label>Pitch / value proposition</Label>
            <Textarea {...register("profilePitch")} placeholder="We build fast, scalable web apps..." className="mt-1" rows={3} defaultValue={settings?.profilePitch || ""} />
          </div>
          <div>
            <Label>About you</Label>
            <Textarea {...register("profileDescription")} placeholder="Brief bio or company description..." className="mt-1" rows={3} defaultValue={settings?.profileDescription || ""} />
          </div>
          <div>
            <Label>Portfolio URL</Label>
            <Input {...register("profilePortfolioUrl")} placeholder="https://portfolio.acme.agency" className="mt-1" defaultValue={settings?.profilePortfolioUrl || ""} />
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <Input {...register("profileLinkedin")} placeholder="https://linkedin.com/in/yourname" className="mt-1" defaultValue={settings?.profileLinkedin || ""} />
          </div>
          <div>
            <Label>Example emails <span className="text-muted-foreground text-xs">(used to match your writing style)</span></Label>
            <Textarea {...register("profileExampleEmails")} placeholder="Paste 2-3 emails you've sent before..." className="mt-1" rows={6} defaultValue={settings?.profileExampleEmails || ""} />
          </div>
          <div>
            <Label>Notable projects / portfolio highlights</Label>
            <Textarea {...register("profileProjects")} placeholder="Built X for Y that resulted in Z..." className="mt-1" rows={3} defaultValue={settings?.profileProjects || ""} />
          </div>
        </CardContent>
      </Card>
      <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500" loading={saveMutation.isPending}>
        Save profile
      </Button>
    </form>
  );
}

function ApiKeysTab() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const { data: existingKeys } = useQuery({
    queryKey: ["settings", "api-keys"],
    queryFn: () => api.get<any[]>("/settings/api-keys"),
  });

  const saveMutation = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      api.put(`/settings/api-keys/${provider}`, { key }),
    onSuccess: (_, { provider }) => {
      toast({ title: `${provider} key saved`, variant: "default" });
      setKeyValues(v => ({ ...v, [provider]: "" }));
      setShowKey(v => ({ ...v, [provider]: false }));
      qc.invalidateQueries({ queryKey: ["settings", "api-keys"] });
    },
    onError: (e: any) => toast({ title: "Failed to save key", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: string) => api.delete(`/settings/api-keys/${provider}`),
    onSuccess: () => {
      toast({ title: "Key deleted" });
      qc.invalidateQueries({ queryKey: ["settings", "api-keys"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (provider: string) => api.post<any>(`/settings/api-keys/${provider}/test`),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Connection successful", variant: "default" });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["settings", "api-keys"] });
    },
  });

  const existingByProvider = Object.fromEntries((existingKeys || []).map(k => [k.provider, k]));

  return (
    <div className="space-y-4">
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4">
          <p className="text-sm text-amber-400">
            <strong>BYOK saves 80%:</strong> Your own keys cost 0.1 credits per enrichment vs 1.0 for managed. All keys are AES-256-GCM encrypted and never logged.
          </p>
        </CardContent>
      </Card>

      {PROVIDERS.map(provider => {
        const existing = existingByProvider[provider.id];
        const isConfigured = !!existing;
        return (
          <Card key={provider.id} className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isConfigured ? "bg-green-500/20" : "bg-zinc-500/10"}`}>
                  <Key className={`w-4 h-4 ${isConfigured ? "text-green-400" : "text-zinc-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{provider.name}</span>
                    {isConfigured ? (
                      <Badge variant="success" className="text-[10px]">Configured</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Not set</Badge>
                    )}
                    {existing?.lastTestResult && (
                      <Badge className={`text-[10px] ${existing.lastTestResult === "ok" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {existing.lastTestResult === "ok" ? "✓ Connected" : "✗ Failed"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{provider.desc}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      type={showKey[provider.id] ? "text" : "password"}
                      placeholder={isConfigured ? "••••••••••••• (set)" : "Paste API key..."}
                      className="flex-1 min-w-0 h-8 text-xs"
                      value={keyValues[provider.id] || ""}
                      onChange={e => setKeyValues(v => ({ ...v, [provider.id]: e.target.value }))}
                      data-testid={`input-key-${provider.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 shrink-0"
                      onClick={() => {
                        const key = keyValues[provider.id];
                        if (!key?.trim()) return;
                        saveMutation.mutate({ provider: provider.id, key });
                      }}
                      loading={saveMutation.isPending && saveMutation.variables?.provider === provider.id}
                      data-testid={`btn-save-key-${provider.id}`}
                    >
                      Save
                    </Button>
                    {isConfigured && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs shrink-0"
                          onClick={() => testMutation.mutate(provider.id)}
                          loading={testMutation.isPending && testMutation.variables === provider.id}
                        >
                          <TestTube className="w-3 h-3" /> Test
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-red-400 hover:text-red-300 shrink-0"
                          onClick={() => deleteMutation.mutate(provider.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function WaterfallTab() {
  const { data: configs } = useQuery({
    queryKey: ["settings", "waterfall"],
    queryFn: () => api.get<any[]>("/settings/waterfall"),
  });

  const qc = useQueryClient();
  const [steps, setSteps] = useState<string[]>(["aleads", "prospeo", "apollo", "hunter"]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post("/settings/waterfall", data),
    onSuccess: () => {
      toast({ title: "Waterfall config saved" });
      qc.invalidateQueries({ queryKey: ["settings", "waterfall"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Enrichment Waterfall</CardTitle>
          <CardDescription>Providers are tried in order. Stops when a valid email is found.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((provider, i) => (
            <div key={provider} className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-border/50">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 font-medium text-sm capitalize">{provider}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => {
                  const arr = [...steps];
                  [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                  setSteps(arr);
                }}>↑</Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === steps.length - 1} onClick={() => {
                  const arr = [...steps];
                  [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                  setSteps(arr);
                }}>↓</Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => setSteps(steps.filter(s => s !== provider))}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add provider */}
          {WATERFALL_PROVIDERS.filter(p => !steps.includes(p)).map(p => (
            <Button key={p} variant="outline" size="sm" className="text-xs" onClick={() => setSteps([...steps, p])}>
              <Plus className="w-3 h-3" /> Add {p}
            </Button>
          ))}

          <Separator />
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => saveMutation.mutate({
              name: "Default",
              steps: steps.map(p => ({ provider: p, minConfidence: 70, stopOnFound: true, useBYOK: true })),
              isDefault: true,
            })}
            loading={saveMutation.isPending}
          >
            Save waterfall config
          </Button>
        </CardContent>
      </Card>

      {/* Existing configs */}
      {(configs || []).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Saved configs</h3>
          {(configs || []).map((cfg: any) => (
            <Card key={cfg.id} className="bg-card/50 border-border/50">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{cfg.name}</span>
                  {cfg.isDefault && <Badge variant="indigo" className="ml-2 text-[10px]">Default</Badge>}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {((cfg.steps as any[]) || []).map((s: any) => s.provider).join(" → ")}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BillingTab() {
  const { workspace } = useAuth();

  const createCheckout = useMutation({
    mutationFn: (plan: string) => api.post<any>("/billing/create-checkout", { plan }),
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
      else toast({ title: "Stripe not configured", description: "Add STRIPE_SECRET_KEY to environment", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPortal = useMutation({
    mutationFn: () => api.post<any>("/billing/portal"),
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const plans = [
    { id: "free", name: "Free", price: 0, credits: 50, features: ["50 credits/mo", "3 platforms", "Manual enrichment"] },
    { id: "pro", name: "Pro", price: 79, credits: 2000, features: ["2,000 credits/mo", "All platforms", "Waterfall enrichment", "Agent SDR"] },
    { id: "agency", name: "Agency", price: 249, credits: 10000, features: ["10,000 credits/mo", "Unlimited workspaces", "Webhook API", "Dedicated CSM"] },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Current plan</div>
              <div className="text-xl font-bold capitalize">{workspace?.plan}</div>
              <div className="text-sm text-muted-foreground">{workspace?.credits?.toLocaleString()} credits remaining</div>
            </div>
            {workspace?.plan !== "free" && (
              <Button variant="outline" onClick={() => openPortal.mutate()} loading={openPortal.isPending}>
                Manage subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className={`border ${workspace?.plan === plan.id ? "border-indigo-500/50 bg-indigo-500/5" : "border-border/50 bg-card/50"}`}>
            <CardContent className="p-4">
              <div className="font-bold text-lg mb-1">{plan.name}</div>
              <div className="text-2xl font-black mb-3">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map(f => (
                  <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-indigo-400" /> {f}
                  </li>
                ))}
              </ul>
              {workspace?.plan === plan.id ? (
                <Badge variant="indigo" className="w-full justify-center py-1.5">Current plan</Badge>
              ) : (
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-sm"
                  size="sm"
                  onClick={() => plan.id !== "free" && createCheckout.mutate(plan.id)}
                  disabled={plan.id === "free"}
                  loading={createCheckout.isPending && createCheckout.variables === plan.id}
                >
                  {plan.id === "free" ? "Free tier" : `Upgrade to ${plan.name}`}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<any>("/settings") });
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch("/settings", data),
    onSuccess: () => { toast({ title: "Saved" }); qc.invalidateQueries({ queryKey: ["settings"] }); },
  });

  const [notifySignals, setNotifySignals] = useState(settings?.notifyNewSignals ?? true);
  const [notifyEnrich, setNotifyEnrich] = useState(settings?.notifyEnrichComplete ?? true);
  const [notifyReply, setNotifyReply] = useState(settings?.notifyReply ?? true);

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Notification preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "New intent signals", desc: "Alert when strong signals are detected", value: notifySignals, set: setNotifySignals, key: "notifyNewSignals" },
            { label: "Enrichment complete", desc: "Alert when a job is fully enriched", value: notifyEnrich, set: setNotifyEnrich, key: "notifyEnrichComplete" },
            { label: "Email replies", desc: "Alert when a prospect replies", value: notifyReply, set: setNotifyReply, key: "notifyReply" },
          ].map(({ label, desc, value, set, key }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch
                checked={value}
                onCheckedChange={v => {
                  set(v);
                  saveMutation.mutate({ [key]: v });
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const params = useParams() as { tab?: string };
  const defaultTab = params.tab || "profile";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-muted-foreground" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground">Manage your workspace preferences and API keys</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0">
          {[
            { value: "profile", label: "Profile", icon: User },
            { value: "api-keys", label: "API Keys", icon: Key },
            { value: "waterfall", label: "Waterfall", icon: Layers },
            { value: "billing", label: "Billing", icon: CreditCard },
            { value: "notifications", label: "Notifications", icon: Bell },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400">
              <Icon className="w-3.5 h-3.5 mr-1.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="api-keys"><ApiKeysTab /></TabsContent>
        <TabsContent value="waterfall"><WaterfallTab /></TabsContent>
        <TabsContent value="billing"><BillingTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
