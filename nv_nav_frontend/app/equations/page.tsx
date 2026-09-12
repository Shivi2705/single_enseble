"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Equation } from "@/components/equations/Equation";
import { EQUATIONS } from "@/lib/constants";

const SECTION_ORDER = [
  "ODMR & Sensing",
  "Vector Reconstruction",
  "Frame Rotation & Map",
  "Map Matching",
  "EKF",
  "Particle Filter",
];

export default function EquationsPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EQUATIONS;
    return EQUATIONS.filter(
      (eq) =>
        eq.number.toLowerCase().includes(q) ||
        eq.name.toLowerCase().includes(q) ||
        eq.section.toLowerCase().includes(q) ||
        eq.explanation.toLowerCase().includes(q)
    );
  }, [query]);

  const bySection = useMemo(() => {
    const map: Record<string, typeof EQUATIONS> = {};
    for (const s of SECTION_ORDER) map[s] = [];
    for (const eq of filtered) {
      if (!map[eq.section]) map[eq.section] = [];
      map[eq.section].push(eq);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equations Reference</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All 24 equations from the design report, grouped by pipeline stage.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by number, name, or keyword…"
          className="pl-9"
        />
      </div>

      <div className="space-y-4">
        {SECTION_ORDER.map((section) => {
          const eqs = bySection[section] ?? [];
          if (query && eqs.length === 0) return null;
          const isCollapsed = collapsed[section];
          return (
            <div key={section} className="rounded-lg border border-border">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{section}</h2>
                  <span className="text-xs text-muted-foreground">({eqs.length})</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isCollapsed ? "" : "rotate-180"
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
                      {eqs.map((eq) => (
                        <Equation key={eq.id} eq={eq} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {query && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No equations match &quot;{query}&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
