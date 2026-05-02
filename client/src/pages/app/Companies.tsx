import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Search, Globe, Users, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

export default function CompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["companies", page, search],
    queryFn: () => api.get<any>(`/companies?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  const companies = data?.companies || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" /> Companies
          </h1>
          <p className="text-sm text-muted-foreground">{pagination.total} companies tracked</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search companies..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No companies yet</h3>
          <p className="text-sm text-muted-foreground">Companies are created when you enrich job postings</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {companies.map((company: any) => (
            <Card key={company.id} className="bg-card/50 border-border/50 hover:border-indigo-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{company.name}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {company.domain && (
                        <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {company.domain}
                        </a>
                      )}
                      {company.location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {company.location}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {company.industry && <Badge variant="secondary" className="text-xs">{company.industry}</Badge>}
                      {company.size && <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />{company.size}</Badge>}
                      {company.fundingStage && <Badge variant="indigo" className="text-xs">{company.fundingStage}</Badge>}
                    </div>
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
