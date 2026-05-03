import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Briefcase, Search, Globe, Users, MapPin, ChevronLeft, ChevronRight, Trash2, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/utils";

const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Marketing", "E-commerce", "Education", "Real Estate", "Consulting", "Manufacturing", "Media"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "contacts", label: "Most contacts" },
];

export default function CompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      toast({ title: "Company deleted" });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["companies", page, search, industryFilter, sort],
    queryFn: () => api.get<any>(`/companies?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}${industryFilter !== "all" ? `&industry=${encodeURIComponent(industryFilter)}` : ""}&sort=${sort}`),
  });

  const companies = data?.companies || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            Companies
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total} companies tracked
            {data?.withDomain > 0 && <> · <span className="text-blue-400">{data.withDomain} with domain</span></>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams({
              ...(search && { search }),
              ...(industryFilter !== "all" && { industry: industryFilter }),
            });
            const a = document.createElement("a");
            a.href = `/api/companies/export/csv?${params}`;
            a.download = "companies.csv";
            a.click();
          }}
          title="Export filtered companies to CSV"
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search companies..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={industryFilter} onValueChange={v => { setIndustryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All industries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || industryFilter !== "all") && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setSearch(""); setIndustryFilter("all"); setPage(1); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/40 rounded-2xl bg-card/20">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-blue-400/50" />
          </div>
          <h3 className="font-semibold mb-1.5">
            {search || industryFilter !== "all" ? "No matching companies" : "No companies yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {search || industryFilter !== "all" ? "Try adjusting your filters" : "Companies are created when you enrich job postings"}
          </p>
          {(search || industryFilter !== "all") && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setIndustryFilter("all"); setPage(1); }}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {companies.map((company: any) => (
            <Card key={company.id} className="gradient-top-border-blue bg-card/50 border-border/50 hover-glow transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {company.domain ? (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${company.domain}&sz=32`}
                        alt=""
                        className="w-6 h-6 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Building2 className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{company.name}</span>
                      {company.linkedinUrl && (
                        <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-indigo-400 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {company.domain && (
                        <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {company.domain}
                        </a>
                      )}
                      {company.location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {company.location}</span>}
                      {company.employees && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {Number(company.employees).toLocaleString()} employees</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {company.industry && <Badge variant="secondary" className="text-xs">{company.industry}</Badge>}
                      {company.size && <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />{company.size}</Badge>}
                      {company.fundingStage && <Badge variant="indigo" className="text-xs">{company.fundingStage}</Badge>}
                      {company.revenue && <Badge variant="outline" className="text-xs text-green-400 border-green-500/20">{company.revenue}</Badge>}
                      {Number(company.jobCount) > 0 && (
                        <Badge variant="outline" className="text-xs text-indigo-400 border-indigo-500/30">
                          <Briefcase className="w-3 h-3 mr-1 text-indigo-400" />{company.jobCount} job{Number(company.jobCount) !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {Number(company.contactCount) > 0 && (
                        <Badge variant="outline" className="text-xs text-violet-400 border-violet-500/30">
                          <Users className="w-3 h-3 mr-1 text-violet-400" />{company.contactCount} contact{Number(company.contactCount) !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {company.techStack && Array.isArray(company.techStack) && (company.techStack as string[]).length > 0 && (
                        <>
                          {(company.techStack as string[]).slice(0, 3).map((t: string) => (
                            <Badge key={t} variant="outline" className="text-xs text-cyan-400 border-cyan-500/20">{t}</Badge>
                          ))}
                          {(company.techStack as string[]).length > 3 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">+{(company.techStack as string[]).length - 3}</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                    onClick={() => { if (confirm("Delete this company?")) deleteMutation.mutate(company.id); }}
                    title="Delete company"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">{page} / {pagination.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
