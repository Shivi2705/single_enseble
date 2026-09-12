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

/** Builds a URL to a backend-served file/plot path via the /file-proxy convention.
 * Falls back to treating the path as already-absolute if it looks like a URL. */
export function resolveBackendAsset(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = apiBase();
  const filename = path.split("/").pop();
  return `${base}/static-file?path=${encodeURIComponent(path)}&filename=${encodeURIComponent(filename || "")}`;
}
