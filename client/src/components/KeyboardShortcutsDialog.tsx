import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS = [
  { key: "?", desc: "Show keyboard shortcuts", group: "Global" },
  { key: "/", desc: "Focus search bar", group: "Global" },
  { key: "Esc", desc: "Close dialogs / clear focus", group: "Global" },
  { key: "S", desc: "Open scrape dialog (Jobs page)", group: "Page Actions" },
  { key: "C", desc: "Compose new outreach (Outreach page)", group: "Page Actions" },
  { key: "G D", desc: "Go to Dashboard", group: "Navigation" },
  { key: "G J", desc: "Go to Jobs", group: "Navigation" },
  { key: "G S", desc: "Go to Signals", group: "Navigation" },
  { key: "G C", desc: "Go to Contacts", group: "Navigation" },
  { key: "G O", desc: "Go to Outreach", group: "Navigation" },
  { key: "G A", desc: "Go to Agent Runs", group: "Navigation" },
  { key: "G M", desc: "Go to Companies", group: "Navigation" },
  { key: "G T", desc: "Go to Settings", group: "Navigation" },
];

const NAV_MAP: Record<string, string> = {
  j: "/app/jobs",
  d: "/app/dashboard",
  s: "/app/signals",
  a: "/app/agent",
  c: "/app/contacts",
  o: "/app/outreach",
  m: "/app/companies",
  t: "/app/settings",
};

export default function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const gPressed = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (inInput) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        setOpen(true);
        return;
      }

      // G + key navigation
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        gPressed.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPressed.current = false; }, 1500);
        return;
      }

      if (gPressed.current && NAV_MAP[e.key.toLowerCase()]) {
        gPressed.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        navigate(NAV_MAP[e.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-indigo-400" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {(["Global", "Page Actions", "Navigation"] as const).map(group => {
            const groupShortcuts = SHORTCUTS.filter(s => s.group === group);
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">{group}</p>
                <div className="space-y-0.5">
                  {groupShortcuts.map(({ key, desc }) => (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-sm text-muted-foreground">{desc}</span>
                      <div className="flex gap-1">
                        {key.split(" ").map((k, i) => (
                          <kbd key={i} className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-muted border border-border text-[11px] font-mono font-semibold text-foreground">
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground text-center pt-1">Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">?</kbd> anywhere to open this</p>
      </DialogContent>
    </Dialog>
  );
}
