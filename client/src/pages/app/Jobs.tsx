import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import KanbanBoard from "@/components/KanbanBoard";
import { getPlatformColor, getStatusColor, formatBudget, formatRelativeTime, truncate } from "@/lib/utils";
import {
  Briefcase, Search, Plus, RefreshCw, ExternalLink, Globe, MapPin,
  DollarSign, Clock, Zap, ChevronLeft, ChevronRight, Play, Download, Trash2,
  Trophy, XCircle, LayoutGrid, List,
} from "lucide-react";

const PLATFORMS = [
  { id: "jobspy", name: "JobSpy (Indeed + LinkedIn + Glassdoor + Google)", sites: ["indeed", "google", "linkedin", "glassdoor", "zip_recruiter"] },
  { id: "upwork", name: "Upwork" },
  { id: "remoteok", name: "RemoteOK" },
  { id: "weworkremotely", name: "We Work Remotely" },
  { id: "freelancer", name: "Freelancer" },
  { id: "linkedin_apify", name: "LinkedIn (via Apify — requires APIFY key)" },
  { id: "indeed_apify", name: "Indeed (via Apify — requires APIFY key)" },
  { id: "wellfound_apify", name: "Wellfound (via Apify — requires APIFY key)" },
];

const QUICK_PRESETS = [
  { label: "React dev", keyword: "React developer", location: "Remote" },
  { label: "DevOps", keyword: "DevOps engineer", location: "Remote" },
  { label: "Node.js", keyword: "Node.js developer", location: "Remote" },
  { label: "TypeScript", keyword: "TypeScript developer", location: "" },
  { label: "Python", keyword: "Python developer", location: "" },
  { label: "Full-stack", keyword: "Full stack developer", location: "Remote" },
  { label: "Design agency", keyword: "design agency", location: "" },
  { label: "SaaS sales", keyword: "SaaS sales engineer", location: "" },
  { label: "Framer", keyword: "Framer designer", location: "Remote" },
  { label: "Webflow", keyword: "Webflow developer", location: "Remote" },
];

function ScrapeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [platform, setPlatform] = useState("jobspy");
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(25);
  const [hoursOld, setHoursOld] = useState(72);
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
          {/* Quick presets */}
          <div>
            <Label className="text-xs text-muted-foreground">Quick presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {QUICK_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setKeyword(p.keyword); setLocation(p.location); }}
                  className="px-2.5 py-1 text-xs rounded-full border border-border bg-accent/30 hover:bg-accent hover:border-indigo-500/40 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label>Posted within</Label>
              <Select value={hoursOld.toString()} onValueChange={v => setHoursOld(Number(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">Last 24 hours</SelectItem>
                  <SelectItem value="48">Last 48 hours</SelectItem>
                  <SelectItem value="72">Last 3 days</SelectItem>
                  <SelectItem value="168">Last 7 days</SelectItem>
                  <SelectItem value="720">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            loading={scrapeMutation.isPending}
            onClick={() => {
              if (!keyword.trim()) return toast({ title: "Keyword required", variant: "destructive" });
              scrapeMutation.mutate({ platform, keyword, location, resultsWanted: limit, hoursOld });
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
  const [statusFilter, setStatusFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("status") || "all";
  });
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [contactFoundOnly, setContactFoundOnly] = useState(false);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const qc = useQueryClient();

  const { data: latestRun } = useQuery({
    queryKey: ["scrape-latest-run"],
    queryFn: () => api.get<any>("/scrape/runs?limit=1"),
    refetchInterval: (query) => {
      const run = (query.state.data as any)?.runs?.[0];
      return run?.status === "running" ? 3000 : false;
    },
  });

  const activeRun = latestRun?.runs?.[0];
  const isRunning = activeRun?.status === "running";

  const params = new URLSearchParams({
    page: page.toString(),
    limit: "25",
    ...(search && { search }),
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(platformFilter !== "all" && { platform: platformFilter }),
    sort: sortBy,
    ...(remoteOnly && { remote: "true" }),
    ...(contactFoundOnly && { contactFound: "true" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", page, search, statusFilter, platformFilter, sortBy, remoteOnly, contactFoundOnly],
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/jobs/bulk-delete", { ids }),
    onSuccess: () => {
      toast({ title: `${selected.size} job${selected.size > 1 ? "s" : ""} deleted` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: any) => toast({ title: "Bulk delete failed", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/jobs/${id}`, { status }),
    onSuccess: (_: any, { status }: { id: string; status: string }) => {
      toast({ title: `Job marked as ${status}` });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: any) => toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });

  const jobs = data?.jobs || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  const allPageSelected = jobs.length > 0 && jobs.every((j: any) => selected.has(j.id));

  function toggleAll() {
    if (allPageSelected) {
      const next = new Set(selected);
      jobs.forEach((j: any) => next.delete(j.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      jobs.forEach((j: any) => next.add(j.id));
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  // Keyboard shortcut: S = scrape dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "s" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setScrapeOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-indigo-400" />
            </div>
            Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats?.total || 0} total jobs
            {(stats?.byPlatform?.length || 0) > 0 && ` · ${stats.byPlatform.length} platform${stats.byPlatform.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2.5 rounded-none border-0 ${viewMode === "list" ? "bg-indigo-600/20 text-indigo-300" : "text-zinc-600 hover:text-zinc-300"}`}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2.5 rounded-none border-0 border-l border-border/50 ${viewMode === "kanban" ? "bg-indigo-600/20 text-indigo-300" : "text-zinc-600 hover:text-zinc-300"}`}
              onClick={() => setViewMode("kanban")}
              title="Kanban view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csvParams = new URLSearchParams({
                ...(search && { search }),
                ...(statusFilter !== "all" && { status: statusFilter }),
                ...(platformFilter !== "all" && { platform: platformFilter }),
                ...(contactFoundOnly && { contactFound: "true" }),
              });
              const a = document.createElement("a");
              a.href = `/api/jobs/export/csv?${csvParams}`;
              a.download = "jobs.csv";
              a.click();
            }}
            title="Export filtered jobs to CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => setScrapeOpen(true)}
            data-testid="btn-scrape-jobs"
            title="Scrape jobs (press S)"
          >
            <Plus className="w-4 h-4" /> Scrape jobs
            <kbd className="ml-1.5 hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/60 font-mono">S</kbd>
          </Button>
        </div>
      </div>

      {/* Active scrape run banner */}
      {activeRun && (isRunning || activeRun.status === "completed") && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-all ${
          isRunning
            ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-300"
            : "bg-green-600/10 border-green-500/30 text-green-300"
        }`}>
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span className="font-medium">Scraping in progress</span>
              <span className="text-muted-foreground">· {activeRun.keyword || activeRun.platform} · fetching results…</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 shrink-0" />
              <span className="font-medium">Last scrape complete</span>
              <span className="text-muted-foreground">
                · {activeRun.jobsNew ?? 0} new / {activeRun.jobsFound ?? 0} found
                {activeRun.completedAt ? ` · ${formatRelativeTime(activeRun.completedAt)}` : ""}
              </span>
            </>
          )}
        </div>
      )}

      {/* Status + Platform breakdown */}
      {stats && (stats.byPlatform?.length > 0 || Object.keys(stats.byStatus || {}).length > 0) && (
        <div className="space-y-2">
          {Object.keys(stats.byStatus || {}).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.byStatus as Record<string, number>).map(([s, count]) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all hover:scale-105 ${statusFilter === s ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-300" : "border-border/50 bg-accent/30 text-muted-foreground hover:border-indigo-500/30"}`}
                >
                  {s} <span className="font-bold">{count}</span>
                </button>
              ))}
            </div>
          )}
          {stats.byPlatform?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {stats.byPlatform.map((p: any) => (
                <button
                  key={p.platform}
                  onClick={() => setPlatformFilter(platformFilter === p.platform ? "all" : p.platform)}
                  className={`${getPlatformColor(p.platform)} px-2.5 py-0.5 rounded-full text-xs font-medium transition-all hover:scale-105 ${platformFilter === p.platform ? "ring-2 ring-indigo-500/60" : ""}`}
                >
                  {p.platform} ({p.count})
                </button>
              ))}
            </div>
          )}
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
        <Button
          variant={remoteOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setRemoteOnly(!remoteOnly); setPage(1); }}
          className={remoteOnly ? "bg-green-600 hover:bg-green-500 h-9 text-xs" : "h-9 text-xs"}
          title="Show remote jobs only"
        >
          🌐 Remote only
        </Button>
        <Button
          variant={contactFoundOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setContactFoundOnly(!contactFoundOnly); setPage(1); }}
          className={contactFoundOnly ? "bg-violet-600 hover:bg-violet-500 h-9 text-xs" : "h-9 text-xs"}
          title="Show only jobs with a contact found"
        >
          ✓ Contact found
        </Button>
        {(search || statusFilter !== "all" || platformFilter !== "all" || remoteOnly || contactFoundOnly) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(""); setStatusFilter("all"); setPlatformFilter("all"); setRemoteOnly(false); setContactFoundOnly(false); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
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
            <SelectItem value="lost">Lost</SelectItem>
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-600/10 border border-indigo-500/30 rounded-xl">
          <span className="text-sm font-medium text-indigo-400">{selected.size} selected</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
            onClick={() => {
              const ids = Array.from(selected);
              Promise.all(ids.map(id => api.post(`/enrich/job/${id}`)))
                .then(() => {
                  toast({ title: `Enriching ${ids.length} jobs`, description: "This may take a moment" });
                  setSelected(new Set());
                  setTimeout(() => qc.invalidateQueries({ queryKey: ["jobs"] }), 4000);
                })
                .catch((e: any) => toast({ title: "Bulk enrich failed", description: e.message, variant: "destructive" }));
            }}
          >
            <Zap className="w-3 h-3" /> Enrich {selected.size}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
            loading={bulkDeleteMutation.isPending}
          >
            <Trash2 className="w-3 h-3" /> Delete {selected.size}
          </Button>
        </div>
      )}

      {/* Kanban board — replaces list when viewMode=kanban */}
      {viewMode === "kanban" && (
        <KanbanBoard
          search={search}
          platformFilter={platformFilter}
          remoteOnly={remoteOnly}
        />
      )}

      {viewMode === "list" && isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : viewMode === "list" && jobs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">
            {(search || statusFilter !== "all" || platformFilter !== "all" || remoteOnly || contactFoundOnly)
              ? "No jobs match your filters"
              : "No jobs yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {(search || statusFilter !== "all" || platformFilter !== "all" || remoteOnly || contactFoundOnly)
              ? "Try adjusting or clearing your filters"
              : "Start scraping job boards to find opportunities"}
          </p>
          {(search || statusFilter !== "all" || platformFilter !== "all" || remoteOnly || contactFoundOnly) ? (
            <Button variant="outline" size="sm" onClick={() => {
              setSearch(""); setStatusFilter("all"); setPlatformFilter("all");
              setRemoteOnly(false); setContactFoundOnly(false); setPage(1);
            }}>
              Clear all filters
            </Button>
          ) : (
            <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setScrapeOpen(true)}>
              <Plus className="w-4 h-4" /> Scrape jobs
            </Button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {/* Select-all row */}
          <div className="flex items-center gap-3 px-4 py-1.5">
            <Checkbox
              checked={allPageSelected}
              onCheckedChange={toggleAll}
              className="border-border/60"
              aria-label="Select all"
            />
            <span className="text-xs text-muted-foreground">Select all on page</span>
          </div>

          {jobs.map((job: any) => (
            <Card key={job.id} className={`bg-card/50 border-border/50 hover:border-indigo-500/30 transition-colors ${selected.has(job.id) ? "border-indigo-500/40 bg-indigo-500/5" : ""}`} data-testid={`card-job-${job.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(job.id)}
                    onCheckedChange={() => toggleOne(job.id)}
                    className="mt-0.5 border-border/60 shrink-0"
                    aria-label={`Select ${job.title}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link href={`/app/jobs/${job.id}`}>
                        <span className="font-semibold hover:text-indigo-400 transition-colors cursor-pointer">{job.title}</span>
                      </Link>
                      <Badge className={`text-[10px] ${getPlatformColor(job.platform)}`}>{job.platform}</Badge>
                      <Badge className={`text-[10px] ${getStatusColor(job.status)}`}>{job.status}</Badge>
                      {job.remote && <Badge variant="outline" className="text-[10px]">Remote</Badge>}
                      {job.contactFound && (
                        <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/20">✓ Contact</Badge>
                      )}
                      {job.opportunityScore && (
                        <Badge
                          className={`text-[10px] ${
                            job.opportunityScore >= 75
                              ? "bg-green-500/20 text-green-400"
                              : job.opportunityScore >= 50
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          Score: {job.opportunityScore}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {job.companyName && (
                        <span className="flex items-center gap-1">
                          {job.companyDomain ? (
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${job.companyDomain}&sz=16`}
                              alt=""
                              className="w-3 h-3 object-contain rounded-sm"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <Globe className="w-3 h-3" />
                          )}
                          {job.companyName}
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
                  <div className="flex gap-1.5 shrink-0 items-center flex-wrap justify-end">
                    {job.sourceUrl && (
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8" title="View original posting">
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
                    {job.status !== "won" && job.status !== "lost" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => statusMutation.mutate({ id: job.id, status: "won" })}
                          title="Mark as won"
                        >
                          <Trophy className="w-3 h-3" /> Won
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => statusMutation.mutate({ id: job.id, status: "lost" })}
                          title="Mark as lost"
                        >
                          <XCircle className="w-3 h-3" /> Lost
                        </Button>
                      </>
                    )}
                    {(job.status === "won" || job.status === "lost") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => statusMutation.mutate({ id: job.id, status: "new" })}
                        title="Reset status"
                      >
                        Reset
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
      ) : null}

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
