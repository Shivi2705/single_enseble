import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | undefined | null, digits = 2): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function apiBase(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("nv-nav-api-url");
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

/** Builds a URL to a backend-served plot image.
 * The backend mounts output/plots at /static/plots (see main.py), so any
 * plot path/filename just needs to be resolved against that mount + the
 * configured API base. Handles three shapes we might get back from the
 * API: an already-absolute URL, a "/static/plots/xyz.png" path, or a bare
 * filename / server-local path (older responses) -- in the last case we
 * just take the basename and point it at the static mount. */
export function resolveBackendAsset(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = apiBase();
  if (path.startsWith("/static/")) return `${base}${path}`;
  const filename = path.split(/[\\/]/).pop();
  return `${base}/static/plots/${encodeURIComponent(filename || "")}`;
}
