import { useToast } from "@/hooks/use-toast";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-xl animate-fade-in",
            toast.variant === "destructive"
              ? "bg-red-950/90 border-red-800 text-red-100"
              : toast.variant === "success"
                ? "bg-green-950/90 border-green-800 text-green-100"
                : "bg-card/95 border-border text-foreground"
          )}
        >
          {toast.variant === "destructive" ? (
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          ) : toast.variant === "success" ? (
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            {toast.title && <div className="text-sm font-semibold leading-tight">{toast.title}</div>}
            {toast.description && <div className="text-xs text-current/70 mt-0.5 leading-relaxed">{toast.description}</div>}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
