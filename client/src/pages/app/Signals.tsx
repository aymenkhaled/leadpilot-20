import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getSignalIcon, getSignalColor, formatRelativeTime } from "@/lib/utils";
import { Zap, ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, Trash2, CheckCheck, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

const SIGNAL_TYPES = ["funding", "hiring_spike", "job_change", "tech_install", "leadership_change"];
const SIGNAL_LABELS: Record<string, string> = {
  funding: "💰 Funding",
  hiring_spike: "📈 Hiring Spike",
  job_change: "🔄 Job Change",
  tech_install: "🔧 Tech Install",
  leadership_change: "👤 Leadership",
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: "bg-red-500/20 text-red-400",
  moderate: "bg-yellow-500/20 text-yellow-400",
  weak: "bg-zinc-500/20 text-zinc-400",
};

export default function SignalsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [strengthFilter, setStrengthFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideActed, setHideActed] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const qc = useQueryClient();

  const params = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(typeFilter !== "all" && { type: typeFilter }),
    ...(strengthFilter !== "all" && { strength: strengthFilter }),
    ...(search && { search }),
    sort: sortBy,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["signals", page, typeFilter, strengthFilter, search, sortBy],
    queryFn: () => api.get<any>(`/signals?${params}`),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["signals", "stats"],
    queryFn: () => api.get<any>("/signals/stats"),
  });

  const actMutation = useMutation({
    mutationFn: (id: string) => api.post(`/signals/${id}/act`),
    onSuccess: () => {
      toast({ title: "Signal marked as acted on" });
      qc.invalidateQueries({ queryKey: ["signals"] });
    },
  });

  const bulkActMutation = useMutation({
    mutationFn: () => api.post<any>("/signals/bulk-act"),
    onSuccess: (data: any) => {
      toast({ title: `Marked ${data.updated} signal${data.updated !== 1 ? "s" : ""} as acted on` });
      qc.invalidateQueries({ queryKey: ["signals"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/signals/${id}`),
    onSuccess: () => {
      toast({ title: "Signal deleted" });
      qc.invalidateQueries({ queryKey: ["signals"] });
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const allSignals = data?.signals || [];
  const signals = hideActed ? allSignals.filter((s: any) => !s.actedOnAt) : allSignals;
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            Intent Signals
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total} signals detected
            {stats?.unacted > 0 && (
              <span className="ml-2 text-yellow-400 font-medium">{stats.unacted} unacted</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const params = new URLSearchParams({
                ...(typeFilter !== "all" && { type: typeFilter }),
                ...(strengthFilter !== "all" && { strength: strengthFilter }),
                ...(search && { search }),
              });
              const a = document.createElement("a");
              a.href = `/api/signals/export/csv?${params}`;
              a.download = "signals.csv";
              a.click();
            }}
            title="Export filtered signals to CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button
            variant={hideActed ? "default" : "outline"}
            size="sm"
            className={`h-8 text-xs ${hideActed ? "bg-indigo-600 hover:bg-indigo-500" : ""}`}
            onClick={() => setHideActed(!hideActed)}
            title="Toggle hide acted-on signals"
          >
            <Check className="w-3.5 h-3.5" /> {hideActed ? "Showing unacted" : "Hide acted on"}
          </Button>
          {allSignals.some((s: any) => !s.actedOnAt) && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                if (confirm("Mark all unacted signals as acted on?")) bulkActMutation.mutate();
              }}
              loading={bulkActMutation.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all as acted
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats?.byType && stats.byType.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.byType.map((t: any) => (
            <Card key={t.type} className={`gradient-top-border-yellow bg-card/50 border-border/50 cursor-pointer hover-glow transition-all ${typeFilter === t.type ? "border-yellow-500/30 bg-yellow-500/5" : ""}`}
              onClick={() => setTypeFilter(typeFilter === t.type ? "all" : t.type)}>
              <CardContent className="p-3 text-center">
                <div className="text-xl mb-1">{getSignalIcon(t.type)}</div>
                <div className="text-lg font-bold">{t.count}</div>
                <div className="text-xs text-muted-foreground">{SIGNAL_LABELS[t.type] || t.type}</div>
                {t.strong > 0 && (
                  <div className="text-[10px] text-red-400 font-medium mt-0.5">{t.strong} strong</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search signals..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {(search || typeFilter !== "all" || strengthFilter !== "all") && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setSearch(""); setTypeFilter("all"); setStrengthFilter("all"); setPage(1); }}
          >
            Clear filters
          </button>
        )}
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Signal type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SIGNAL_TYPES.map(t => (
              <SelectItem key={t} value={t}>{SIGNAL_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "All", cls: "border-border/50 text-muted-foreground" },
            { value: "strong", label: "🔴 Strong", cls: "text-red-400 border-red-500/30" },
            { value: "moderate", label: "🟡 Moderate", cls: "text-yellow-400 border-yellow-500/30" },
            { value: "weak", label: "⚪ Weak", cls: "text-zinc-400 border-zinc-500/30" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStrengthFilter(opt.value); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                strengthFilter === opt.value
                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                  : `bg-accent/30 ${opt.cls} hover:border-indigo-500/30`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="strength">By strength</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signal list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">
            {hideActed
              ? "All signals acted on"
              : search || typeFilter !== "all" || strengthFilter !== "all"
              ? "No matching signals"
              : "No signals detected yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {hideActed
              ? "All signals have been acted on. Toggle off 'Hide acted on' to see them."
              : search || typeFilter !== "all" || strengthFilter !== "all"
              ? "Try adjusting your filters"
              : "Signals are automatically detected when you scrape job postings"}
          </p>
          {(hideActed || search || typeFilter !== "all" || strengthFilter !== "all") && (
            <button
              onClick={() => { setHideActed(false); setSearch(""); setTypeFilter("all"); setStrengthFilter("all"); setPage(1); }}
              className="mt-3 text-sm text-indigo-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal: any) => (
            <Card
              key={signal.id}
              className={`bg-card/50 border-border/50 hover:border-indigo-500/20 transition-colors ${signal.actedOnAt ? "opacity-60" : ""}`}
              data-testid={`signal-${signal.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{getSignalIcon(signal.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{signal.title}</span>
                      <Badge className={`text-[10px] ${STRENGTH_COLORS[signal.strength]}`}>{signal.strength}</Badge>
                      {signal.actedOnAt && <Badge variant="success" className="text-[10px]">Acted on</Badge>}
                    </div>
                    {signal.description && (
                      <p className="text-xs text-muted-foreground mb-1.5">{signal.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{formatRelativeTime(signal.detectedAt)}</span>
                      {signal.sourceName && <span>via {signal.sourceName}</span>}
                      {signal.jobId && (
                        <a
                          href={`/app/jobs/${signal.jobId}`}
                          className="text-indigo-400 hover:underline flex items-center gap-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          View job →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {signal.sourceUrl && (
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    {!signal.actedOnAt && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500"
                        onClick={() => actMutation.mutate(signal.id)}
                        loading={actMutation.isPending}
                      >
                        Act now <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {signal.actedOnAt && (
                      <Badge variant="success" className="text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => { if (confirm("Delete this signal?")) deleteMutation.mutate(signal.id); }}
                      title="Delete signal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            {page} / {pagination.pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
