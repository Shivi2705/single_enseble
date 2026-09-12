"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUIStore } from "@/store";
import { Toaster } from "@/components/ui/toaster";

function ThemeManager() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);

    if (theme === "dark") apply(true);
    else if (theme === "light") apply(false);
    else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const listener = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeManager />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
