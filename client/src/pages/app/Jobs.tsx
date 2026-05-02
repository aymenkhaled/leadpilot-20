import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getPlatformColor, getStatusColor, formatBudget, formatRelativeTime, truncate } from "@/lib/utils";
import {
  Briefcase, Search, Plus, RefreshCw, Filter, ExternalLink, Globe, MapPin,
  DollarSign, Clock, Zap, ChevronLeft, ChevronRight, Play,
} from "lucide-react";

const PLATFORMS = [
  { id: "jobspy", name: "JobSpy (Multi-platform)", sites: ["indeed", "google", "linkedin", "glassdoor", "zip_recruiter"] },
  { id: "upwork", name: "Upwork" },
  { id: "remoteok", name: "RemoteOK" },
  { id: "weworkremotely", name: "We Work Remotely" },
  { id: "freelancer", name: "Freelancer" },
];

function ScrapeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [platform, setPlatform] = useState("jobspy");
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(25);
  const qc = useQueryClient();

  const scrapeMutation = useMutation({
    mutationFn: (data: any) => api.post("/scrape", data),
    onSuccess: (data: any) => {
      toast({ title: "Scrape started", description: `Run ID: ${data.runId}` });
      onClose();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["jobs"] }), 3000);
    },
    onError: (e: any) => toast({ title: "Scrape failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scrape Job Postings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search keyword</Label>
            <Input
              placeholder="e.g. React developer, DevOps engineer"
              className="mt-1"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              data-testid="input-scrape-keyword"
            />
          </div>
          <div>
            <Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. New York, Remote"
              className="mt-1"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
          <div>
            <Label>Max results</Label>
            <Select value={limit.toString()} onValueChange={v => setLimit(Number(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 200].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} results</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            loading={scrapeMutation.isPending}
            onClick={() => {
              if (!keyword.trim()) return toast({ title: "Keyword required", variant: "destructive" });
              scrapeMutation.mutate({ platform, keyword, location, resultsWanted: limit });
            }}
            data-testid="btn-start-scrape"
          >
            <Play className="w-4 h-4" /> Start scraping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const qc = useQueryClient();

  const params = new URLSearchParams({
    page: page.toString(),
    limit: "25",
    ...(search && { search }),
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(platformFilter !== "all" && { platform: platformFilter }),
    sort: sortBy,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", page, search, statusFilter, platformFilter, sortBy],
    queryFn: () => api.get<any>(`/jobs?${params}`),
  });

  const { data: stats } = useQuery({
    queryKey: ["jobs", "stats"],
    queryFn: () => api.get<any>("/jobs/stats/overview"),
  });

  const enrichMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/enrich/job/${jobId}`),
    onSuccess: () => {
      toast({ title: "Enrichment started", variant: "default" });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: any) => toast({ title: "Enrichment failed", description: e.message, variant: "destructive" }),
  });

  const jobs = data?.jobs || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground">{stats?.total || 0} total jobs across {Object.keys(stats?.byPlatform || {}).length} platforms</p>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-500"
          onClick={() => setScrapeOpen(true)}
          data-testid="btn-scrape-jobs"
        >
          <Plus className="w-4 h-4" /> Scrape jobs
        </Button>
      </div>

      {/* Platform breakdown */}
      {stats?.byPlatform && stats.byPlatform.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.byPlatform.map((p: any) => (
            <button
              key={p.platform}
              onClick={() => setPlatformFilter(platformFilter === p.platform ? "all" : p.platform)}
              className={`${getPlatformColor(p.platform)} px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${platformFilter === p.platform ? "ring-2 ring-indigo-500" : ""}`}
            >
              {p.platform} ({p.count})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, companies..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-job-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="classified">Classified</SelectItem>
            <SelectItem value="enriched">Enriched</SelectItem>
            <SelectItem value="pitched">Pitched</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="won">Won</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="score">By score</SelectItem>
            <SelectItem value="budget">By budget</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["jobs"] })}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Jobs list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No jobs yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Start scraping job boards to find opportunities</p>
          <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setScrapeOpen(true)}>
            <Plus className="w-4 h-4" /> Scrape jobs
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job: any) => (
            <Card key={job.id} className="bg-card/50 border-border/50 hover:border-indigo-500/30 transition-colors" data-testid={`card-job-${job.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link href={`/app/jobs/${job.id}`}>
                        <span className="font-semibold hover:text-indigo-400 transition-colors cursor-pointer">{job.title}</span>
                      </Link>
                      <Badge className={`text-[10px] ${getPlatformColor(job.platform)}`}>{job.platform}</Badge>
                      <Badge className={`text-[10px] ${getStatusColor(job.status)}`}>{job.status}</Badge>
                      {job.remote && <Badge variant="outline" className="text-[10px]">Remote</Badge>}
                      {job.opportunityScore && (
                        <Badge variant="indigo" className="text-[10px]">Score: {job.opportunityScore}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {job.companyName && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {job.companyName}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                      )}
                      {(job.budgetMin || job.budgetMax) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatRelativeTime(job.discoveredAt)}
                      </span>
                    </div>
                    {job.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{truncate(job.description, 200)}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {job.sourceUrl && (
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    {!job.contactFound && !job.isAnonymous && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => enrichMutation.mutate(job.id)}
                        loading={enrichMutation.isPending}
                        data-testid={`btn-enrich-${job.id}`}
                      >
                        <Zap className="w-3 h-3" /> Enrich
                      </Button>
                    )}
                    <Link href={`/app/jobs/${job.id}`}>
                      <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * 25) + 1}–{Math.min(pagination.page * 25, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ScrapeDialog open={scrapeOpen} onClose={() => setScrapeOpen(false)} />
    </div>
  );
}
