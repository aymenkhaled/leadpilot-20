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
import { Users, Search, Mail, Check, Star, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { initials, formatRelativeTime } from "@/lib/utils";

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", page, search, verifiedOnly],
    queryFn: () => api.get<any>(`/contacts?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}${verifiedOnly ? "&verified=true" : ""}`),
  });

  const championMutation = useMutation({
    mutationFn: (id: string) => api.post(`/contacts/${id}/mark-champion`),
    onSuccess: () => {
      toast({ title: "Champion status updated" });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const contacts = data?.contacts || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-400" /> Contacts
          </h1>
          <p className="text-sm text-muted-foreground">{pagination.total} contacts</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button
          variant={verifiedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className={verifiedOnly ? "bg-green-600 hover:bg-green-500" : ""}
        >
          <Check className="w-3.5 h-3.5" /> Verified only
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No contacts yet</h3>
          <p className="text-sm text-muted-foreground">Contacts are found through enrichment</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact: any) => (
            <Card key={contact.id} className="bg-card/50 border-border/50 hover:border-indigo-500/20 transition-colors">
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
                    <div className="text-xs text-muted-foreground">{contact.title}</div>
                    {contact.email && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-indigo-400">{contact.email}</span>
                        {contact.emailConfidence > 0 && (
                          <span className="text-xs text-muted-foreground">({contact.emailConfidence}% conf)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
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
                    <Badge variant="outline" className="text-xs">
                      via {contact.enrichmentProvider || "manual"}
                    </Badge>
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
