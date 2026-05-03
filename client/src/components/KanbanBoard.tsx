import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getPlatformColor, formatBudget, formatRelativeTime, truncate } from "@/lib/utils";
import { Link } from "wouter";
import { Zap, Trophy, MapPin, DollarSign, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "new",        label: "New",        color: "text-zinc-400",   border: "border-zinc-500/30",   bg: "bg-zinc-500/5"   },
  { key: "classified", label: "Classified",  color: "text-blue-400",   border: "border-blue-500/30",   bg: "bg-blue-500/5"   },
  { key: "enriched",   label: "Enriched",    color: "text-indigo-400", border: "border-indigo-500/30", bg: "bg-indigo-500/5" },
  { key: "pitched",    label: "Pitched",     color: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-500/5" },
  { key: "replied",    label: "Replied",     color: "text-green-400",  border: "border-green-500/30",  bg: "bg-green-500/5"  },
  { key: "won",        label: "Won",         color: "text-emerald-400",border: "border-emerald-500/30",bg: "bg-emerald-500/5"},
  { key: "lost",       label: "Lost",        color: "text-red-400",    border: "border-red-500/30",    bg: "bg-red-500/5"    },
];

interface KanbanBoardProps {
  search?: string;
  platformFilter?: string;
  remoteOnly?: boolean;
}

export default function KanbanBoard({ search, platformFilter, remoteOnly }: KanbanBoardProps) {
  const qc = useQueryClient();

  const params = new URLSearchParams({
    limit: "200",
    ...(search && { search }),
    ...(platformFilter && platformFilter !== "all" && { platform: platformFilter }),
    ...(remoteOnly && { remote: "true" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["jobs-kanban", search, platformFilter, remoteOnly],
    queryFn: () => api.get<any>(`/jobs?${params}`),
    staleTime: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/jobs/${id}`, { status }),
    onSuccess: (_: any, { status }: { id: string; status: string }) => {
      toast({ title: `Job moved to ${status}` });
      qc.invalidateQueries({ queryKey: ["jobs-kanban"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const enrichMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/enrich/job/${jobId}`),
    onSuccess: () => {
      toast({ title: "Enrichment started" });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["jobs-kanban"] }), 4000);
    },
    onError: (e: any) => toast({ title: "Enrichment failed", description: e.message, variant: "destructive" }),
  });

  const jobs: any[] = data?.jobs || [];

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    COLUMNS.forEach(c => { map[c.key] = []; });
    jobs.forEach(j => {
      if (map[j.status]) map[j.status].push(j);
      else map["new"] = [...(map["new"] || []), j];
    });
    return map;
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <div key={col.key} className="shrink-0 w-64">
            <Skeleton className="h-8 mb-2 rounded-lg" />
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 mb-2 rounded-xl" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6">
      {COLUMNS.map(col => {
        const colJobs = grouped[col.key] || [];
        return (
          <div key={col.key} className="shrink-0 w-64 flex flex-col">
            {/* Column header */}
            <div className={cn(
              "flex items-center justify-between px-3 py-2 rounded-lg border mb-2",
              col.border, col.bg
            )}>
              <span className={cn("text-xs font-semibold", col.color)}>{col.label}</span>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5", col.color)}>
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {colJobs.length === 0 ? (
                <div className={cn(
                  "flex-1 min-h-16 rounded-xl border border-dashed flex items-center justify-center text-xs",
                  col.border, "text-zinc-700"
                )}>
                  Empty
                </div>
              ) : (
                colJobs.map((job: any) => (
                  <KanbanCard
                    key={job.id}
                    job={job}
                    col={col}
                    onStatusChange={(status) => statusMutation.mutate({ id: job.id, status })}
                    onEnrich={() => enrichMutation.mutate(job.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  job, col, onStatusChange, onEnrich
}: {
  job: any;
  col: (typeof COLUMNS)[0];
  onStatusChange: (s: string) => void;
  onEnrich: () => void;
}) {
  const nextStatus = COLUMNS[COLUMNS.findIndex(c => c.key === job.status) + 1]?.key;
  const prevStatus = COLUMNS[COLUMNS.findIndex(c => c.key === job.status) - 1]?.key;

  return (
    <div className={cn(
      "rounded-xl border bg-card/60 p-3 hover:border-indigo-500/30 transition-all group hover:shadow-lg hover:shadow-indigo-500/5",
      col.border
    )}>
      {/* Title */}
      <Link href={`/app/jobs/${job.id}`}>
        <p className="text-xs font-semibold text-zinc-200 line-clamp-2 hover:text-indigo-400 transition-colors cursor-pointer leading-snug mb-1.5">
          {job.title}
        </p>
      </Link>

      {/* Company */}
      {job.companyName && (
        <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1 truncate">
          {job.companyDomain ? (
            <img
              src={`https://www.google.com/s2/favicons?domain=${job.companyDomain}&sz=12`}
              alt="" className="w-3 h-3 object-contain rounded-sm shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : null}
          {job.companyName}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-1 mb-2">
        <Badge className={`text-[9px] ${getPlatformColor(job.platform)}`}>{job.platform}</Badge>
        {job.remote && <Badge variant="outline" className="text-[9px]">🌐 Remote</Badge>}
        {job.contactFound && (
          <Badge className="text-[9px] bg-green-500/15 text-green-400 border-green-500/20">✓ Contact</Badge>
        )}
        {job.opportunityScore && (
          <Badge className={cn(
            "text-[9px]",
            job.opportunityScore >= 75 ? "bg-green-500/20 text-green-400" :
            job.opportunityScore >= 50 ? "bg-yellow-500/20 text-yellow-400" :
            "bg-red-500/20 text-red-400"
          )}>
            {job.opportunityScore}
          </Badge>
        )}
      </div>

      {/* Budget/Location */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-600 mb-2">
        {(job.budgetMin || job.budgetMax) && (
          <span className="flex items-center gap-0.5">
            <DollarSign className="w-2.5 h-2.5" />
            {formatBudget(job.budgetMin, job.budgetMax, job.budgetType)}
          </span>
        )}
        {job.location && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
        )}
      </div>

      {/* Time + source */}
      <div className="flex items-center justify-between text-[10px] text-zinc-700 mb-2">
        <span>{formatRelativeTime(job.discoveredAt)}</span>
        {job.sourceUrl && (
          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Actions: shown on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {prevStatus && (
          <button
            className="flex-1 text-[10px] py-0.5 px-1.5 rounded border border-border/40 text-zinc-500 hover:text-zinc-300 hover:border-border/70 transition-colors"
            onClick={() => onStatusChange(prevStatus)}
          >
            ← {prevStatus}
          </button>
        )}
        {!job.contactFound && !job.isAnonymous && (
          <button
            className="px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-400 text-[10px] hover:bg-indigo-500/10 transition-colors flex items-center gap-0.5"
            onClick={onEnrich}
          >
            <Zap className="w-2.5 h-2.5" /> Enrich
          </button>
        )}
        {nextStatus && nextStatus !== "lost" && (
          <button
            className="flex-1 text-[10px] py-0.5 px-1.5 rounded border border-border/40 text-zinc-500 hover:text-zinc-300 hover:border-border/70 transition-colors"
            onClick={() => onStatusChange(nextStatus)}
          >
            {nextStatus} →
          </button>
        )}
        {job.status !== "won" && (
          <button
            className="px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400 text-[10px] hover:bg-emerald-500/10 transition-colors"
            onClick={() => onStatusChange("won")}
            title="Mark as won"
          >
            <Trophy className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
