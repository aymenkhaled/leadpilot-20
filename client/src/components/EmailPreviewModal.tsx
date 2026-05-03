import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusColor, formatRelativeTime } from "@/lib/utils";
import { Copy, Check, Mail, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface EmailPreviewModalProps {
  item: any;
  open: boolean;
  onClose: () => void;
}

export default function EmailPreviewModal({ item, open, onClose }: EmailPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  function copyFull() {
    const text = `Subject: ${item.subject}\n\n${item.body || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Email copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const bodyLines = (item.body || "").split("\n");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0d0d12] border-border/60">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-base">{item.subject}</DialogTitle>
            <Badge className={`text-[10px] ${getStatusColor(item.status)}`}>{item.status}</Badge>
          </div>
        </DialogHeader>

        {/* Meta */}
        <div className="space-y-1.5 border-b border-border/40 pb-3">
          {(item.toEmail || item.contactName) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-zinc-600 w-8">To:</span>
              <span className="text-zinc-300">
                {item.contactName ? `${item.contactName} ` : ""}
                {item.toEmail ? <span className="text-indigo-400">&lt;{item.toEmail}&gt;</span> : null}
              </span>
            </div>
          )}
          {(item.jobTitle || item.jobCompany) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-zinc-600 w-8">Re:</span>
              <span className="text-zinc-400">{item.jobTitle}{item.jobCompany ? ` @ ${item.jobCompany}` : ""}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-zinc-600 w-8">Date:</span>
            <span className="text-zinc-500">
              {item.sentAt ? formatRelativeTime(item.sentAt) : formatRelativeTime(item.createdAt)}
            </span>
          </div>
          {item.openedAt && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-600 w-8">Open:</span>
              <span className="text-indigo-400">Opened {formatRelativeTime(item.openedAt)}</span>
            </div>
          )}
          {item.repliedAt && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-600 w-8">Reply:</span>
              <span className="text-green-400">Replied {formatRelativeTime(item.repliedAt)}</span>
            </div>
          )}
        </div>

        {/* Email body render */}
        <div className="rounded-xl border border-border/40 bg-[#09090d] overflow-hidden">
          {/* Email chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-white/[0.02]">
            <Mail className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs text-zinc-500 font-medium">{item.subject}</span>
          </div>

          {/* Body */}
          <div className="p-4 max-h-[340px] overflow-y-auto">
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
              {bodyLines.map((line: string, i: number) => {
                const isBlank = line.trim() === "";
                const isGreeting = i === 0 && line.trim().startsWith("Hi");
                const isSignoff = /^(Best|Regards|Thanks|Cheers|Sincerely|Kind regards)/i.test(line.trim());
                const isLink = /https?:\/\//.test(line);

                if (isBlank) return <div key={i} className="h-3" />;
                if (isGreeting) return (
                  <p key={i} className="text-zinc-200 font-medium mb-1">{line}</p>
                );
                if (isSignoff) return (
                  <p key={i} className="text-zinc-400 mt-3">{line}</p>
                );
                if (isLink) {
                  const parts = line.split(/(https?:\/\/[^\s]+)/g);
                  return (
                    <p key={i} className="text-zinc-400 mb-0.5">
                      {parts.map((part, j) =>
                        /https?:\/\//.test(part)
                          ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 inline-flex items-center gap-0.5">
                              {part} <ExternalLink className="w-2.5 h-2.5 inline" />
                            </a>
                          : part
                      )}
                    </p>
                  );
                }
                return <p key={i} className="text-zinc-400 mb-0.5">{line}</p>;
              })}
            </div>
          </div>
        </div>

        {/* Char count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            {(item.body || "").length} chars · {(item.body || "").split(/\s+/).filter(Boolean).length} words
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={copyFull}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
