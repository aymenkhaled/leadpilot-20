import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getStatusColor, formatRelativeTime, truncate } from "@/lib/utils";
import { Mail, ChevronLeft, ChevronRight, Send, Eye, MessageSquare, Plus, Sparkles, Expand, Trash2, Copy, Check as CheckIcon, Search, Download } from "lucide-react";

function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const searchStr = useSearch();
  const urlParams = searchStr ? new URLSearchParams(searchStr) : null;

  const [contactId, setContactId] = useState(urlParams?.get("contactId") || "");
  const [jobId, setJobId] = useState(urlParams?.get("jobId") || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  // Sync from URL params when dialog opens
  useEffect(() => {
    if (open && searchStr) {
      const p = new URLSearchParams(searchStr);
      if (p.get("contactId")) setContactId(p.get("contactId")!);
      if (p.get("jobId")) setJobId(p.get("jobId")!);
    }
  }, [open, searchStr]);

  const { data: contactsData } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: () => api.get<any>("/contacts?limit=100"),
    enabled: open,
  });

  const { data: jobsData } = useQuery({
    queryKey: ["jobs-list"],
    queryFn: () => api.get<any>("/jobs?limit=100"),
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<any>("/outreach/generate", { jobId, contactId }),
    onSuccess: (data: any) => {
      setSubject(data.subject || "");
      setBody(data.body || "");
      toast({ title: "Email generated with AI" });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: (status: string) =>
      api.post("/outreach", {
        subject,
        body,
        status,
        ...(contactId && { contactId }),
        ...(jobId && { jobId }),
        ...(status === "sent" ? { sentAt: new Date().toISOString() } : {}),
      }),
    onSuccess: (_: any, status: string) => {
      toast({ title: status === "sent" ? "Email sent!" : "Draft saved" });
      qc.invalidateQueries({ queryKey: ["outreach"] });
      onClose();
      setSubject(""); setBody(""); setContactId(""); setJobId("");
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const contacts = contactsData?.contacts || [];
  const jobs = jobsData?.jobs || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={expanded ? "sm:max-w-3xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Compose Email</DialogTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setExpanded(!expanded)} title="Expand editor">
              <Expand className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contact <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="Select contact..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {contacts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.fullName || `${c.firstName} ${c.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Job <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="Select job..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {jobs.map((j: any) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs">
                      {j.title} — {j.companyName || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {contactId && jobId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generateMutation.isPending ? "Generating..." : "Generate with AI"}
            </Button>
          )}

          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              className="mt-1 h-8 text-sm"
              placeholder="Email subject..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Body</Label>
              {body && (
                <span className={`text-[10px] ${body.length > 800 ? "text-amber-400" : "text-muted-foreground"}`}>
                  {body.length} chars{body.length > 800 ? " — consider shortening" : ""}
                </span>
              )}
            </div>
            <Textarea
              className="mt-0 text-sm font-mono"
              placeholder="Email body..."
              rows={expanded ? 16 : 8}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate("draft")}
            disabled={!subject || !body || saveMutation.isPending}
          >
            Save draft
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => saveMutation.mutate("sent")}
            disabled={!subject || !body || saveMutation.isPending}
          >
            <Send className="w-3.5 h-3.5" /> Send now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OutreachPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const searchStr = useSearch();

  // Auto-open compose dialog if URL has jobId or contactId params
  useEffect(() => {
    if (searchStr) {
      const urlParams = new URLSearchParams(searchStr);
      if (urlParams.get("jobId") || urlParams.get("contactId")) {
        setComposeOpen(true);
      }
    }
  }, [searchStr]);

  // Keyboard shortcut: C = compose
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setComposeOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function copyEmail(item: any) {
    const text = `Subject: ${item.subject}\n\n${item.body || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/outreach/${id}`, { status: "sent", sentAt: new Date().toISOString() }),
    onSuccess: () => {
      toast({ title: "Email marked as sent" });
      qc.invalidateQueries({ queryKey: ["outreach"] });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/outreach/${id}`, {
        status,
        ...(status === "opened" ? { openedAt: new Date().toISOString() } : {}),
        ...(status === "replied" ? { repliedAt: new Date().toISOString() } : {}),
      }),
    onSuccess: (_: any, { status }: { id: string; status: string }) => {
      toast({ title: `Email marked as ${status}` });
      qc.invalidateQueries({ queryKey: ["outreach"] });
    },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const params = new URLSearchParams({
    page: page.toString(), limit: "25",
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(search && { search }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/outreach/${id}`),
    onSuccess: () => {
      toast({ title: "Email deleted" });
      qc.invalidateQueries({ queryKey: ["outreach"] });
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["outreach", page, statusFilter, search],
    queryFn: () => api.get<any>(`/outreach?${params}`),
  });

  const { data: stats } = useQuery({
    queryKey: ["outreach", "stats"],
    queryFn: () => api.get<any>("/outreach/stats"),
  });

  const outreachItems = data?.outreach || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };
  const byStatus = stats?.byStatus || {};

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Mail className="w-4 h-4 text-green-400" />
            </div>
            Outreach
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total} total emails
            {stats?.openRate > 0 && <span className="ml-2 text-indigo-400 font-medium">{stats.openRate}% open</span>}
            {stats?.replyRate > 0 && <span className="ml-2 text-green-400 font-medium">{stats.replyRate}% reply</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams({
                ...(statusFilter !== "all" && { status: statusFilter }),
                ...(search && { search }),
              });
              const a = document.createElement("a");
              a.href = `/api/outreach/export/csv?${params}`;
              a.download = "outreach.csv";
              a.click();
            }}
            title="Export filtered outreach to CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => setComposeOpen(true)}
            title="Compose email (press C)"
          >
            <Plus className="w-4 h-4" /> Compose
            <kbd className="ml-1.5 hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/60 font-mono">C</kbd>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Draft", key: "draft", icon: Mail, color: "text-zinc-400" },
          { label: "Sent", key: "sent", icon: Send, color: "text-blue-400" },
          { label: "Opened", key: "opened", icon: Eye, color: "text-indigo-400" },
          { label: "Replied", key: "replied", icon: MessageSquare, color: "text-green-400" },
          { label: "Bounced", key: "bounced", icon: Mail, color: "text-red-400" },
        ].map(({ label, key, icon: Icon, color }) => {
          const count = byStatus[key] || 0;
          const sent = byStatus["sent"] || 0;
          const opened = byStatus["opened"] || 0;
          const replied = byStatus["replied"] || 0;
          const totalSent = sent + opened + replied;
          const sub =
            key === "opened" && totalSent > 0 ? `${Math.round((opened + replied) / totalSent * 100)}% open` :
            key === "replied" && (opened + replied) > 0 ? `${Math.round(replied / totalSent * 100)}% reply` :
            null;
          return (
            <Card
              key={key}
              className={`gradient-top-border-green bg-card/50 border-border/50 cursor-pointer hover-glow transition-all ${statusFilter === key ? "border-green-500/30 bg-green-500/5" : ""}`}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            >
              <div className="p-3 text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
                {sub && <div className="text-[10px] text-indigo-400 font-medium mt-0.5">{sub}</div>}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all") && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : outreachItems.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/40 rounded-2xl bg-card/20">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-green-400/50" />
          </div>
          <h3 className="font-semibold mb-1.5">
            {search || statusFilter !== "all" ? "No matching outreach" : "No outreach yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Compose an email or generate one from a job's contacts"}
          </p>
          {search || statusFilter !== "all" ? (
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}>
              Clear filters
            </Button>
          ) : (
            <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setComposeOpen(true)}>
              <Plus className="w-4 h-4" /> Compose email
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {outreachItems.map((item: any) => (
            <Card key={item.id} className="bg-card/50 border-border/50 hover:border-indigo-500/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-medium text-sm">{item.subject}</span>
                      <Badge className={`text-[10px] ${getStatusColor(item.status)}`}>{item.status}</Badge>
                      {item.followUpCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-indigo-500/20 text-indigo-400">
                          {item.followUpCount} follow-up{item.followUpCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    {(item.toEmail || item.contactName) && (
                      <div className="text-xs text-indigo-400/80 mb-0.5 flex items-center gap-1 flex-wrap">
                        <span>To:</span>
                        {item.contactName && <span className="font-medium text-foreground/70">{item.contactName}</span>}
                        {item.toEmail && <span className="font-medium">&lt;{item.toEmail}&gt;</span>}
                      </div>
                    )}
                    {item.jobTitle && (
                      <div className="text-xs text-muted-foreground/70 mb-0.5">
                        Re: {item.jobTitle}{item.jobCompany ? ` @ ${item.jobCompany}` : ""}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{truncate(item.body || "", 150)}</p>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {item.sentAt ? `Sent ${formatRelativeTime(item.sentAt)}` : `Created ${formatRelativeTime(item.createdAt)}`}
                      {item.openedAt && <span className="ml-2 text-indigo-400">· Opened {formatRelativeTime(item.openedAt)}</span>}
                      {item.repliedAt && <span className="ml-2 text-green-400">· Replied {formatRelativeTime(item.repliedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 items-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
                      onClick={() => copyEmail(item)}
                      title="Copy email to clipboard"
                    >
                      {copiedId === item.id ? <CheckIcon className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    {item.status === "draft" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500"
                        onClick={() => sendMutation.mutate(item.id)}
                        disabled={sendMutation.isPending}
                      >
                        <Send className="w-3 h-3" /> Send
                      </Button>
                    )}
                    {item.status === "sent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => statusMutation.mutate({ id: item.id, status: "opened" })}
                        disabled={statusMutation.isPending}
                      >
                        <Eye className="w-3 h-3" /> Opened
                      </Button>
                    )}
                    {(item.status === "sent" || item.status === "opened") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => statusMutation.mutate({ id: item.id, status: "replied" })}
                          disabled={statusMutation.isPending}
                        >
                          <MessageSquare className="w-3 h-3" /> Replied
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => statusMutation.mutate({ id: item.id, status: "bounced" })}
                          disabled={statusMutation.isPending}
                          title="Mark as bounced"
                        >
                          ↩
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => { if (confirm("Delete this email?")) deleteMutation.mutate(item.id); }}
                      title="Delete email"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {pagination.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
