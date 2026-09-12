"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "emerald" | "amber";
  delay?: number;
}

const accentMap = {
  primary: "from-primary/15 to-primary/5 text-primary",
  secondary: "from-secondary/15 to-secondary/5 text-secondary",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-500",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-500",
};

export function StatCard({ label, value, unit, icon: Icon, accent = "primary", delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", accentMap[accent])} />
        <CardContent className="relative p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-background/60", accentMap[accent])}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight">{value}</span>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
