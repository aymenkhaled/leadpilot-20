import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getPlatformColor, getStatusColor, formatBudget, formatDate, formatRelativeTime } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ExternalLink, Zap, Bot, Mail, MapPin, Globe, Clock, DollarSign, Users, Building2, Check, Sparkles, Copy, Share2, Send, Plus,
} from "lucide-react";

const JOB_STATUSES = ["new", "classified", "enriched", "pitched", "replied", "won", "lost"] as const;

function JobNotesCard({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["jobs", jobId, "notes"],
    queryFn: () => api.get<any>(`/jobs/${jobId}`),
    enabled: !!jobId,
  });
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.job?.notes !== undefined) setNotes(data.job.notes || "");
  }, [data?.job?.notes]);

  const saveMutation = useMutation({
    mutationFn: (value: string) => api.patch(`/jobs/${jobId}`, { notes: value }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["jobs", jobId] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Internal notes</CardTitle>
          <button
            className={`text-xs transition-colors ${saved ? "text-green-400" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => saveMutation.mutate(notes)}
            disabled={saveMutation.isPending}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add private notes about this opportunity..."
          className="text-xs min-h-[80px] resize-none bg-accent/20"
          onBlur={() => {
            if (notes !== (data?.job?.notes || "")) saveMutation.mutate(notes);
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function JobDetailPage() {
  const params = useParams() as { id: string };
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", params.id],
    queryFn: () => api.get<any>(`/jobs/${params.id}`),
  });

  const enrichMutation = useMutation({
    mutationFn: () => api.post(`/enrich/job/${params.id}`),
    onSuccess: (result: any) => {
      toast({ title: "Enrichment complete", description: `Found ${result.contacts?.length || 0} contacts` });
      qc.invalidateQueries({ queryKey: ["jobs", params.id] });
    },
    onError: (e: any) => toast({ title: "Enrichment failed", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/jobs/${params.id}`, { status }),
    onSuccess: (updated: any) => {
      toast({ title: `Status updated to "${updated.status}"` });
      qc.invalidateQueries({ queryKey: ["jobs", params.id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const generatePitchMutation = useMutation({
    mutationFn: ({ jobId, contactId }: { jobId: string; contactId: string }) =>
      api.post<any>("/outreach/generate", { jobId, contactId }),
    onSuccess: (data: any, vars) => {
      api.post("/outreach", {
        jobId: vars.jobId,
        contactId: vars.contactId,
        subject: data.subject,
        body: data.body,
        status: "draft",
      }).then(() => {
        toast({ title: "Pitch generated", description: "Draft saved — go to Outreach to review" });
      }).catch(() => {
        toast({ title: "Pitch generated", description: `Subject: ${data.subject}` });
      });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const agentMutation = useMutation({
    mutationFn: () => api.post("/agent/runs", { jobId: params.id, approvalMode: "draft" }),
    onSuccess: () => {
      toast({ title: "Agent run started", description: "Check Agent Runs for progress" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const [copiedContactEmail, setCopiedContactEmail] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: relatedOutreach } = useQuery({
    queryKey: ["outreach", "job", params.id],
    queryFn: () => api.get<any>(`/outreach?jobId=${params.id}&limit=5`),
    enabled: !!params.id,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const { job, company, contacts } = data || {};

  function copyContactEmail(email: string, id: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedContactEmail(id);
      import("@/hooks/use-toast").then(m => m.toast({ title: "Email copied" }));
      setTimeout(() => setCopiedContactEmail(null), 2000);
    });
  }

  function copyJobLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      import("@/hooks/use-toast").then(m => m.toast({ title: "Link copied to clipboard" }));
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/app/jobs">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to jobs
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">{job?.title}</h1>
              <Badge className={getPlatformColor(job?.platform)}>{job?.platform}</Badge>
              <Select
                value={job?.status || "new"}
                onValueChange={(v) => statusMutation.mutate(v)}
                disabled={statusMutation.isPending}
              >
                <SelectTrigger className={`h-6 w-auto px-2 text-[11px] border-0 ${getStatusColor(job?.status)} rounded-full`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {job?.companyName && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.companyName}</span>}
              {job?.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
              {(job?.budgetMin || job?.budgetMax) && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {formatBudget(job?.budgetMin, job?.budgetMax, job?.budgetType)}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatRelativeTime(job?.discoveredAt)}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={copyJobLink}
              title="Copy link to this job"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </Button>
            {job?.sourceUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> View original
                </a>
              </Button>
            )}
            {!job?.contactFound && !job?.isAnonymous && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => enrichMutation.mutate()}
                loading={enrichMutation.isPending}
                data-testid="btn-enrich-job"
              >
                <Zap className="w-3.5 h-3.5" /> Enrich
              </Button>
            )}
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500"
              onClick={() => agentMutation.mutate()}
              loading={agentMutation.isPending}
              data-testid="btn-run-agent"
            >
              <Bot className="w-3.5 h-3.5" /> Run agent
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-4">
          {/* Description */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Job Description</CardTitle>
                {job?.description && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(job.description || "");
                      import("@/hooks/use-toast").then(m => m.toast({ title: "Description copied" }));
                    }}
                    title="Copy description"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {job?.description || "No description available."}
              </div>
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" /> Contacts ({contacts?.length || 0})
                </CardTitle>
                {contacts?.length === 0 && !job?.isAnonymous && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => enrichMutation.mutate()} loading={enrichMutation.isPending}>
                    <Zap className="w-3 h-3" /> Find contacts
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contacts?.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  {job?.isAnonymous ? (
                    <p className="text-sm">Anonymous posting — enrichment skipped</p>
                  ) : (
                    <p className="text-sm">No contacts found yet. Click "Find contacts" to enrich.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts?.map((contact: any) => (
                    <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-400">
                        {(contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{contact.fullName || `${contact.firstName} ${contact.lastName}`}</div>
                        <div className="text-xs text-muted-foreground">{contact.title}</div>
                        {contact.email && (
                          <div className="text-xs text-indigo-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {contact.email}
                            {contact.emailVerified && <span title="Email verified"><Check className="w-3 h-3 text-green-400" /></span>}
                            {contact.emailConfidence > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                contact.emailConfidence >= 90 ? "border-green-500/30 text-green-400" :
                                contact.emailConfidence >= 70 ? "border-yellow-500/30 text-yellow-400" :
                                "border-border/50 text-muted-foreground"
                              }`}>{contact.emailConfidence}%</span>
                            )}
                            <button
                              onClick={() => copyContactEmail(contact.email, contact.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy email"
                            >
                              {copiedContactEmail === contact.id
                                ? <Check className="w-3 h-3 text-green-400" />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {contact.linkedinUrl && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild title="View LinkedIn">
                            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() => generatePitchMutation.mutate({ jobId: params.id, contactId: contact.id })}
                          disabled={generatePitchMutation.isPending}
                          title="Generate AI pitch"
                        >
                          <Sparkles className="w-3 h-3" />
                          {generatePitchMutation.isPending ? "..." : "Pitch"}
                        </Button>
                        <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500" asChild>
                          <Link href={`/app/outreach?jobId=${params.id}&contactId=${contact.id}`}>
                            <Mail className="w-3 h-3" /> Outreach
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Internal notes */}
          <JobNotesCard jobId={params.id} />

          {/* Enrichment status */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Enrichment status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Domain resolved", done: job?.domainResolved },
                { label: "Contact found", done: job?.contactFound },
                { label: "Email verified", done: job?.contactVerified },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    {done
                      ? <Check className="w-3.5 h-3.5 text-green-400" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-zinc-600" />}
                    <span className={done ? "text-green-400 text-xs" : "text-zinc-500 text-xs"}>{done ? "Done" : "Pending"}</span>
                  </div>
                </div>
              ))}
              {job?.enrichedAt && (
                <p className="text-xs text-muted-foreground mt-2">Enriched {formatRelativeTime(job.enrichedAt)}</p>
              )}
            </CardContent>
          </Card>

          {/* Company */}
          {company && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" /> Company
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {company.domain && (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${company.domain}&sz=32`}
                      alt=""
                      className="w-5 h-5 object-contain rounded-sm"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="font-medium">{company.name}</div>
                </div>
                {company.domain && (
                  <a
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" /> {company.domain}
                  </a>
                )}
                {company.industry && <div className="flex justify-between"><span className="text-muted-foreground">Industry</span><span>{company.industry}</span></div>}
                {company.size && <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{company.size}</span></div>}
                {company.employees && <div className="flex justify-between"><span className="text-muted-foreground">Employees</span><span>{Number(company.employees).toLocaleString()}</span></div>}
                {company.revenue && <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span>{company.revenue}</span></div>}
                {company.fundingStage && <div className="flex justify-between"><span className="text-muted-foreground">Funding</span><span>{company.fundingStage}</span></div>}
                {company.location && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{company.location}</span></div>}
              </CardContent>
            </Card>
          )}

          {/* Opportunity Score */}
          {job?.opportunityScore && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Opportunity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-black ${
                    job.opportunityScore >= 75 ? "text-green-400" : job.opportunityScore >= 50 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {job.opportunityScore}
                  </div>
                  <div className="flex-1">
                    <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          job.opportunityScore >= 75 ? "bg-green-500" : job.opportunityScore >= 50 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, job.opportunityScore)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.opportunityScore >= 75 ? "High fit" : job.opportunityScore >= 50 ? "Moderate fit" : "Low fit"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {job?.skills && (job.skills as string[]).length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(job.skills as string[]).map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Outreach history */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-400" /> Outreach
                  {(relatedOutreach?.outreach || []).length > 0 && ` (${relatedOutreach.outreach.length})`}
                </CardTitle>
                <div className="flex gap-1.5">
                  <Link href={`/app/outreach?jobId=${params.id}`}>
                    <Button size="sm" variant="outline" className="h-6 text-xs">
                      <Plus className="w-3 h-3" /> Compose
                    </Button>
                  </Link>
                  {(relatedOutreach?.outreach || []).length > 0 && (
                    <Link href="/app/outreach">
                      <span className="text-xs text-indigo-400 hover:underline cursor-pointer self-center">View all →</span>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(relatedOutreach?.outreach || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No outreach sent for this job yet</p>
              ) : (
                relatedOutreach.outreach.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/20">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      item.status === "replied" ? "bg-green-500/20" : item.status === "sent" || item.status === "opened" ? "bg-blue-500/20" : "bg-zinc-500/20"
                    }`}>
                      {item.status === "replied" ? <Check className="w-3 h-3 text-green-400" /> : <Send className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.subject}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{item.status}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
