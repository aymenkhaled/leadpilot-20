import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getPlatformColor, getStatusColor, initials } from "@/lib/utils";
import { Search, Briefcase, Users, Building2, ArrowRight, Command } from "lucide-react";
import { cn } from "@/lib/utils";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQ = useDebounce(query, 200);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debouncedQ],
    queryFn: () => api.get<any>(`/search?q=${encodeURIComponent(debouncedQ)}`),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  });

  const jobs: any[]      = data?.jobs      || [];
  const contacts: any[]  = data?.contacts  || [];
  const companies: any[] = data?.companies || [];
  const total = jobs.length + contacts.length + companies.length;

  type FlatResult = { type: "job" | "contact" | "company"; item: any; href: string };
  const flat: FlatResult[] = [
    ...jobs.map(item => ({ type: "job" as const, item, href: `/app/jobs/${item.id}` })),
    ...contacts.map(item => ({ type: "contact" as const, item, href: `/app/contacts` })),
    ...companies.map(item => ({ type: "company" as const, item, href: `/app/companies` })),
  ];

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery("");
    setCursor(0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearch]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function go(href: string) {
    navigate(href);
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(flat.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(0, c - 1));
    } else if (e.key === "Enter" && flat[cursor]) {
      go(flat[cursor].href);
    }
  }

  const showEmpty = debouncedQ.length >= 2 && !isFetching && total === 0;

  return (
    <>
      <button
        onClick={openSearch}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors group"
        title="Global search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden bg-[#0d0d12] border-border/60 shadow-2xl shadow-black/60">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setCursor(0); }}
              onKeyDown={handleKey}
              placeholder="Search jobs, contacts, companies…"
              className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-zinc-600 h-auto"
            />
            {isFetching && (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin shrink-0" />
            )}
          </div>

          {/* Results */}
          <div className="max-h-[440px] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-600">
                Type at least 2 characters to search across jobs, contacts, and companies
              </div>
            ) : showEmpty ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-600">
                No results for "<span className="text-zinc-400">{debouncedQ}</span>"
              </div>
            ) : (
              <div className="py-2">
                {jobs.length > 0 && (
                  <Section label="Jobs" icon={<Briefcase className="w-3 h-3 text-indigo-400" />}>
                    {jobs.map((job, i) => {
                      const idx = i;
                      return (
                        <ResultRow
                          key={job.id}
                          active={cursor === idx}
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => go(`/app/jobs/${job.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-zinc-200 truncate block">{job.title}</span>
                            <span className="text-xs text-zinc-500 truncate block">{job.companyName || "Unknown company"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className={`text-[10px] ${getPlatformColor(job.platform)}`}>{job.platform}</Badge>
                            <Badge className={`text-[10px] ${getStatusColor(job.status)}`}>{job.status}</Badge>
                          </div>
                        </ResultRow>
                      );
                    })}
                  </Section>
                )}
                {contacts.length > 0 && (
                  <Section label="Contacts" icon={<Users className="w-3 h-3 text-violet-400" />}>
                    {contacts.map((contact, i) => {
                      const idx = jobs.length + i;
                      const name = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";
                      return (
                        <ResultRow
                          key={contact.id}
                          active={cursor === idx}
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => go("/app/contacts")}
                        >
                          <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                            {initials(name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-zinc-200 truncate block">{name}</span>
                            <span className="text-xs text-zinc-500 truncate block">{contact.email}</span>
                          </div>
                          {contact.emailVerified && (
                            <Badge className="text-[10px] bg-green-500/20 text-green-400 shrink-0">✓ verified</Badge>
                          )}
                        </ResultRow>
                      );
                    })}
                  </Section>
                )}
                {companies.length > 0 && (
                  <Section label="Companies" icon={<Building2 className="w-3 h-3 text-blue-400" />}>
                    {companies.map((company, i) => {
                      const idx = jobs.length + contacts.length + i;
                      return (
                        <ResultRow
                          key={company.id}
                          active={cursor === idx}
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => go("/app/companies")}
                        >
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
                            {company.domain ? (
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${company.domain}&sz=16`}
                                alt=""
                                className="w-4 h-4 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <Building2 className="w-3 h-3 text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-zinc-200 truncate block">{company.name}</span>
                            <span className="text-xs text-zinc-500 truncate block">{company.industry || company.domain || ""}</span>
                          </div>
                          {company.size && (
                            <Badge variant="outline" className="text-[10px] shrink-0">{company.size}</Badge>
                          )}
                        </ResultRow>
                      );
                    })}
                  </Section>
                )}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-[#09090d]">
            <div className="flex items-center gap-3 text-[10px] text-zinc-700">
              <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/5 border border-white/10 font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/5 border border-white/10 font-mono">↵</kbd> open</span>
              <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/5 border border-white/10 font-mono">esc</kbd> close</span>
            </div>
            {total > 0 && (
              <span className="text-[10px] text-zinc-700">{total} result{total !== 1 ? "s" : ""}</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ active, onClick, onMouseEnter, children }: {
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        active ? "bg-indigo-600/15 text-foreground" : "hover:bg-white/[0.03]"
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {children}
      {active && <ArrowRight className="w-3.5 h-3.5 text-indigo-400 ml-auto shrink-0" />}
    </button>
  );
}
