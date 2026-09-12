"use client";
import * as React from "react";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(t: Omit<ToastItem, "id">) {
  useToastStore.getState().push(t);
  const id = useToastStore.getState().toasts.at(-1)?.id;
  if (id) {
    setTimeout(() => useToastStore.getState().dismiss(id), 5000);
  }
}

const iconFor: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-primary" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-strong rounded-lg border border-border p-3 shadow-lg"
          >
            <div className="flex items-start gap-2">
              {iconFor[t.variant || "default"]}
              <div className="flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
