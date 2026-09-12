"use client";

import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EquationEntry } from "@/types";

export function Equation({ eq }: { eq: EquationEntry }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Eq. {eq.number}</Badge>
              <h3 className="text-sm font-semibold">{eq.name}</h3>
            </div>
            {eq.relatedPage && (
              <Link
                href={eq.relatedPage.href}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {eq.relatedPage.label} <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="rounded-md bg-muted/60 px-4 py-3 overflow-x-auto">
            <BlockMath math={eq.latex} />
          </div>

          <p className="text-sm text-muted-foreground">{eq.explanation}</p>

          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div className="rounded-md border border-border p-2.5">
              <p className="font-medium text-foreground/80 mb-1">Input / Output</p>
              <p className="text-muted-foreground">{eq.io}</p>
            </div>
            <div className="rounded-md border border-border p-2.5">
              <p className="font-medium text-foreground/80 mb-1">Why this equation</p>
              <p className="text-muted-foreground">{eq.why}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
