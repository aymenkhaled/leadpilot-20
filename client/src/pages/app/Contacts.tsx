import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Users, Search, Mail, Check, Star, ExternalLink, ChevronLeft, ChevronRight, Trash2, Download, Copy, Send } from "lucide-react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials, formatRelativeTime } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "confidence", label: "Email confidence" },
];

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [championOnly, setChampionOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const qc = useQueryClient();

  function copyEmail(email: string, id: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(id);
      toast({ title: "Email copied" });
      setTimeout(() => setCopiedEmail(null), 2000);
    });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", page, search, verifiedOnly, championOnly, sort],
    queryFn: () => api.get<any>(`/contacts?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}${verifiedOnly ? "&verified=true" : ""}${championOnly ? "&champion=true" : ""}&sort=${sort}`),
  });

  const championMutation = useMutation({
    mutationFn: (id: string) => api.post(`/contacts/${id}/mark-champion`),
    onSuccess: () => {
      toast({ title: "Champion status updated" });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      toast({ title: "Contact deleted" });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const contacts = data?.contacts || [];
  const hasFilters = search || verifiedOnly || championOnly;
  const pagination = data?.pagination || { total: 0, pages: 1 };
  const championCount = contacts.filter((c: any) => c.isChampion).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            Contacts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total} contacts
            {data?.verified > 0 && <> · <span className="text-green-400">{data.verified} verified</span></>}
            {championCount > 0 && ` · ${championCount} champion${championCount !== 1 ? "s" : ""} on page`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams({
              ...(search && { search }),
              ...(verifiedOnly && { verified: "true" }),
              ...(championOnly && { champion: "true" }),
            });
            const a = document.createElement("a");
            a.href = `/api/contacts/export/csv?${params}`;
            a.download = "contacts.csv";
            a.click();
          }}
          title="Export filtered contacts to CSV"
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button
          variant={verifiedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setVerifiedOnly(!verifiedOnly); setPage(1); }}
          className={verifiedOnly ? "bg-green-600 hover:bg-green-500" : ""}
        >
          <Check className="w-3.5 h-3.5" /> Verified only
        </Button>
        <Button
          variant={championOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setChampionOnly(!championOnly); setPage(1); }}
          className={championOnly ? "bg-yellow-600 hover:bg-yellow-500" : ""}
        >
          <Star className="w-3.5 h-3.5" /> Champions
        </Button>
        <Select value={sort} onValueChange={v => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(""); setVerifiedOnly(false); setChampionOnly(false); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/40 rounded-2xl bg-card/20">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-violet-400/50" />
          </div>
          <h3 className="font-semibold mb-1.5">
            {hasFilters ? "No matching contacts" : "No contacts yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "Try adjusting your filters" : "Contacts are found when you enrich job postings"}
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setVerifiedOnly(false); setChampionOnly(false); setPage(1); }}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact: any) => (
            <Card key={contact.id} className="gradient-top-border-violet bg-card/50 border-border/50 hover-glow transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm">{initials(contact.fullName || `${contact.firstName} ${contact.lastName}`)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{contact.fullName || `${contact.firstName} ${contact.lastName}`}</span>
                      {contact.isChampion && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
                      {contact.emailVerified && <Check className="w-3.5 h-3.5 text-green-400" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[contact.title, contact.companyName].filter(Boolean).join(" · ")}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-indigo-400">{contact.email}</span>
                        <button
                          onClick={() => copyEmail(contact.email, contact.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy email"
                        >
                          {copiedEmail === contact.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {contact.emailConfidence > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            contact.emailConfidence >= 90 ? "border-green-500/30 text-green-400" :
                            contact.emailConfidence >= 70 ? "border-yellow-500/30 text-yellow-400" :
                            "border-border/50 text-muted-foreground"
                          }`}>
                            {contact.emailConfidence}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {contact.linkedinUrl && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => championMutation.mutate(contact.id)}
                      title="Toggle champion"
                    >
                      <Star className={`w-3.5 h-3.5 ${contact.isChampion ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </Button>
                    <Badge
                      className={`text-xs ${
                        contact.enrichmentProvider === "aleads" ? "bg-violet-500/15 text-violet-400 border-violet-500/20" :
                        contact.enrichmentProvider === "prospeo" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                        contact.enrichmentProvider === "apollo" ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
                        contact.enrichmentProvider === "hunter" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" :
                        contact.enrichmentProvider === "rocketreach" ? "bg-pink-500/15 text-pink-400 border-pink-500/20" :
                        "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }`}
                    >
                      via {contact.enrichmentProvider || "manual"}
                    </Badge>
                    {contact.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
                        asChild
                        title="Compose outreach"
                      >
                        <Link href={`/app/outreach?contactId=${contact.id}`}>
                          <Send className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => { if (confirm("Delete this contact?")) deleteMutation.mutate(contact.id); }}
                      title="Delete contact"
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
        <div className="flex items-center gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground px-2">{page} / {pagination.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
