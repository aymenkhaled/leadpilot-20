import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return "—";
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount}`;
}

export function formatBudget(min?: number | null, max?: number | null, type?: string | null): string {
  if (!min && !max) return "—";
  const suffix = type === "hourly" ? "/hr" : type === "monthly" ? "/mo" : "";
  if (min && max) return `${formatCurrency(min)}–${formatCurrency(max)}${suffix}`;
  if (min) return `From ${formatCurrency(min)}${suffix}`;
  return `Up to ${formatCurrency(max!)}${suffix}`;
}

export function getPlatformColor(platform: string): string {
  const p = (platform || "").toLowerCase().replace(/[^a-z]/g, "");
  const colors: Record<string, string> = {
    linkedin: "bg-blue-500/20 text-blue-400",
    indeed: "bg-orange-500/20 text-orange-400",
    upwork: "bg-green-500/20 text-green-400",
    freelancer: "bg-cyan-500/20 text-cyan-400",
    remoteok: "bg-purple-500/20 text-purple-400",
    weworkremotely: "bg-yellow-500/20 text-yellow-400",
    glassdoor: "bg-emerald-500/20 text-emerald-400",
    dice: "bg-red-500/20 text-red-400",
    wellfound: "bg-pink-500/20 text-pink-400",
    jobspy: "bg-indigo-500/20 text-indigo-400",
    google: "bg-blue-500/20 text-blue-400",
    ziprecruiter: "bg-rose-500/20 text-rose-400",
    monster: "bg-orange-500/20 text-orange-400",
    apify: "bg-violet-500/20 text-violet-400",
  };
  return colors[p] || "bg-zinc-500/20 text-zinc-400";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: "bg-zinc-500/20 text-zinc-400",
    classified: "bg-blue-500/20 text-blue-400",
    enriched: "bg-indigo-500/20 text-indigo-400",
    pitched: "bg-purple-500/20 text-purple-400",
    replied: "bg-green-500/20 text-green-400",
    won: "bg-emerald-500/20 text-emerald-400",
    lost: "bg-red-500/20 text-red-400",
    skipped: "bg-zinc-500/10 text-zinc-500",
    draft: "bg-zinc-500/20 text-zinc-400",
    sent: "bg-blue-500/20 text-blue-400",
    opened: "bg-indigo-500/20 text-indigo-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    running: "bg-blue-500/20 text-blue-400 animate-pulse",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    cancelled: "bg-zinc-500/20 text-zinc-400",
  };
  return colors[status] || "bg-zinc-500/20 text-zinc-400";
}

export function getSignalColor(type: string): string {
  const colors: Record<string, string> = {
    funding: "text-emerald-400",
    hiring_spike: "text-blue-400",
    job_change: "text-violet-400",
    tech_install: "text-cyan-400",
    leadership_change: "text-orange-400",
  };
  return colors[type] || "text-zinc-400";
}

export function getSignalIcon(type: string): string {
  const icons: Record<string, string> = {
    funding: "💰",
    hiring_spike: "📈",
    job_change: "🔄",
    tech_install: "🔧",
    leadership_change: "👤",
  };
  return icons[type] || "📊";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function initials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
