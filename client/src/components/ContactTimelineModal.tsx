import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusColor, formatRelativeTime, initials } from "@/lib/utils";
import { Mail, User, Briefcase, Check, Eye, MessageSquare, Star } from "lucide-react";

interface ContactTimelineModalProps {
  contactId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ContactTimelineModal({ contactId, open, onClose }: ContactTimelineModalProps) {
  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ["contact-detail", contactId],
    queryFn: () => api.get<any>(`/contacts/${contactId}`),
    enabled: !!contactId && open,
    staleTime: 30_000,
  });

  const { data: outreachData, isLoading: outreachLoading } = useQuery({
    queryKey: ["outreach-for-contact", contactId],
    queryFn: () => api.get<any>(`/outreach?contactId=${contactId}&limit=50`),
    enabled: !!contactId && open,
    staleTime: 30_000,
  });

  const isLoading = contactLoading || outreachLoading;
  const emails: any[] = outreachData?.outreach || [];

  const name = contact
    ? contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"
    : "";

  const timeline = emails
    .map(e => ({
      ...e,
      date: e.repliedAt || e.openedAt || e.sentAt || e.createdAt,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-[#0d0d12] border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name ? (
              <>
                <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">
                  {initials(name)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  {contact?.email && <p className="text-xs text-muted-foreground font-normal">{contact.email}</p>}
                </div>
              </>
            ) : (
              "Contact Timeline"
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Contact meta */}
            {contact && (
              <div className="flex flex-wrap gap-2 text-xs">
                {contact.title && (
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <User className="w-3 h-3 text-zinc-600" />
                    {contact.title}
                  </div>
                )}
                {contact.isChampion && (
                  <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400">
                    <Star className="w-2.5 h-2.5 mr-0.5" /> Champion
                  </Badge>
                )}
                {contact.emailVerified && (
                  <Badge className="text-[10px] bg-green-500/20 text-green-400">
                    <Check className="w-2.5 h-2.5 mr-0.5" /> Verified
                  </Badge>
                )}
                {contact.emailConfidence && (
                  <span className="text-zinc-600">{contact.emailConfidence}% confidence</span>
                )}
              </div>
            )}

            {/* Timeline */}
            {timeline.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-600">No outreach history yet</p>
                <p className="text-xs text-zinc-700 mt-1">Emails sent to this contact will appear here</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border/40" />

                <div className="space-y-3 pl-8">
                  {timeline.map((email: any) => (
                    <div key={email.id} className="relative">
                      {/* Dot */}
                      <div className={`absolute -left-4.5 top-2 w-2.5 h-2.5 rounded-full border-2 bg-background ${
                        email.status === "replied" ? "border-green-500" :
                        email.status === "opened" ? "border-indigo-500" :
                        email.status === "sent" ? "border-blue-500" :
                        "border-zinc-600"
                      }`}
                        style={{ left: "-23px" }}
                      />

                      <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-200 truncate">{email.subject}</p>
                            {email.jobTitle && (
                              <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
                                <Briefcase className="w-2.5 h-2.5 shrink-0" />
                                {email.jobTitle}{email.jobCompany ? ` @ ${email.jobCompany}` : ""}
                              </p>
                            )}
                          </div>
                          <Badge className={`text-[9px] shrink-0 ${getStatusColor(email.status)}`}>{email.status}</Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                          <span>{formatRelativeTime(email.createdAt)}</span>
                          {email.sentAt && (
                            <span className="text-blue-500/70 flex items-center gap-0.5">
                              <Mail className="w-2.5 h-2.5" /> Sent {formatRelativeTime(email.sentAt)}
                            </span>
                          )}
                          {email.openedAt && (
                            <span className="text-indigo-400/70 flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" /> Opened
                            </span>
                          )}
                          {email.repliedAt && (
                            <span className="text-green-400/70 flex items-center gap-0.5">
                              <MessageSquare className="w-2.5 h-2.5" /> Replied
                            </span>
                          )}
                        </div>

                        {email.body && (
                          <p className="text-[11px] text-zinc-600 mt-1.5 line-clamp-2 leading-relaxed">
                            {email.body.substring(0, 120)}{email.body.length > 120 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
