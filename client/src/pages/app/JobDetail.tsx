import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getPlatformColor, getStatusColor, formatBudget, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft, ExternalLink, Zap, Bot, Mail, MapPin, Globe, Clock, DollarSign, Users, Building2, Check
} from "lucide-react";

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

  const agentMutation = useMutation({
    mutationFn: () => api.post("/agent/runs", { jobId: params.id, approvalMode: "draft" }),
    onSuccess: () => {
      toast({ title: "Agent run started", description: "Check Agent Runs for progress" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
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
              <Badge className={getStatusColor(job?.status)}>{job?.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {job?.companyName && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.companyName}</span>}
              {job?.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
              {(job?.budgetMin || job?.budgetMax) && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {formatBudget(job?.budgetMin, job?.budgetMax, job?.budgetType)}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatRelativeTime(job?.discoveredAt)}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
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
              <CardTitle className="text-sm">Job Description</CardTitle>
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
                          <div className="text-xs text-indigo-400 flex items-center gap-1 mt-0.5">
                            {contact.email}
                            {contact.emailVerified && <Check className="w-3 h-3 text-green-400" />}
                          </div>
                        )}
                      </div>
                      <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500" asChild>
                        <Link href="/app/outreach">
                          <Mail className="w-3 h-3" /> Pitch
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Enrichment status */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Enrichment status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Domain resolved", done: job?.domainResolved },
                { label: "Contact found", done: job?.contactFound },
                { label: "Contact verified", done: job?.contactVerified },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge className={done ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-500"}>
                    {done ? "Yes" : "No"}
                  </Badge>
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
                <div className="font-medium">{company.name}</div>
                {company.domain && <div className="text-muted-foreground text-xs">{company.domain}</div>}
                {company.industry && <div className="flex justify-between"><span className="text-muted-foreground">Industry</span><span>{company.industry}</span></div>}
                {company.size && <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{company.size}</span></div>}
                {company.location && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{company.location}</span></div>}
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
        </div>
      </div>
    </div>
  );
}
