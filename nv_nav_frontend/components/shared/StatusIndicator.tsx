"use client";

import { useHealth } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function StatusIndicator({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError } = useHealth();

  const state = isLoading ? "loading" : isError ? "offline" : "online";

  const color =
    state === "online" ? "bg-emerald-500" : state === "offline" ? "bg-red-500" : "bg-amber-400";

  const label =
    state === "online" ? "Backend connected" : state === "offline" ? "Backend offline" : "Checking…";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {state === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              color
            )}
            style={{ animationDuration: state === "online" ? "2.5s" : "1s" }}
          />
          <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)} />
        </span>
      )}
      {!compact && <span>{label}</span>}
      {!compact && data?.message && state === "online" && (
        <span className="hidden md:inline text-muted-foreground/70">· {data.message}</span>
      )}
    </div>
  );
}
