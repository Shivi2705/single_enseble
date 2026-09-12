"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { RotateCcw, Gem } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NV_AXES, NV_AXIS_COLORS } from "@/lib/constants";
import type { DiamondViewerOptions } from "@/components/diamond/DiamondViewer";

const DiamondViewer = dynamic(
  () => import("@/components/diamond/DiamondViewer").then((m) => m.DiamondViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> }
);

function ViewerSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Gem className="h-8 w-8 animate-pulse" />
        <p className="text-sm">Loading 3D crystal lattice…</p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-sm font-normal text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function DiamondPage() {
  const [resetSignal, setResetSignal] = useState(0);
  const [options, setOptions] = useState<DiamondViewerOptions>({
    showUnitCell: true,
    showAxes: true,
    spaceFilling: false,
    autoRotate: true,
  });

  const set = (partial: Partial<DiamondViewerOptions>) =>
    setOptions((o) => ({ ...o, ...partial }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">3D Diamond Viewer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive diamond-cubic lattice with the NV defect center and its four
          crystallographic sensing axes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="relative h-[420px] md:h-[560px] bg-gradient-to-b from-muted/40 to-transparent">
            <DiamondViewer options={options} resetSignal={resetSignal} />
            <div className="absolute right-3 top-3">
              <Button size="sm" variant="outline" onClick={() => setResetSignal((n) => n + 1)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset view
              </Button>
            </div>
            <div className="absolute left-3 bottom-3 flex flex-wrap gap-1.5">
              {NV_AXIS_COLORS.map((c, i) => (
                <Badge key={i} variant="outline" className="gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                  Axis {i + 1}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Display controls</CardTitle>
              <CardDescription>Orbit to rotate · scroll to zoom · drag to pan</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ToggleRow
                label="Show unit cell edges"
                checked={options.showUnitCell}
                onChange={(v) => set({ showUnitCell: v })}
              />
              <ToggleRow
                label="Show NV axes"
                checked={options.showAxes}
                onChange={(v) => set({ showAxes: v })}
              />
              <ToggleRow
                label="Space-filling representation"
                checked={options.spaceFilling}
                onChange={(v) => set({ spaceFilling: v })}
              />
              <ToggleRow
                label="Auto-rotate"
                checked={options.autoRotate}
                onChange={(v) => set({ autoRotate: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crystal structure</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <Row k="Structure" v="Diamond cubic" />
              <Row k="Space group" v="Fd3̄m (#227)" />
              <Row k="Lattice constant" v="3.567 Å" />
              <Row k="NV axis family" v="⟨111⟩ (4 orientations)" />
              <Row k="Inter-axis angle" v="109.47° (tetrahedral)" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legend</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-400" /> Carbon atom
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" /> Substitutional nitrogen
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" /> Vacancy (NV center)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vector reconstruction &amp; orientation</CardTitle>
          <CardDescription>Equations 4–6a, from the sensing pipeline</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 grid gap-4 md:grid-cols-3">
          <div className="rounded-md bg-muted/60 p-4 overflow-x-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Eq. 4 — weighted least-squares reconstruction
            </p>
            <BlockMath math="\hat{\mathbf{B}} = \left(\mathbf{N}^\top \mathbf{W} \mathbf{N}\right)^{-1} \mathbf{N}^\top \mathbf{W}\, \mathbf{b}" />
          </div>
          <div className="rounded-md bg-muted/60 p-4 overflow-x-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Eq. 5 — axis-set condition number
            </p>
            <BlockMath math="\kappa(\mathbf{N}) = \frac{\sigma_{max}(\mathbf{N})}{\sigma_{min}(\mathbf{N})}" />
          </div>
          <div className="rounded-md bg-muted/60 p-4 overflow-x-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Eq. 6a — tetrahedral axis angle
            </p>
            <BlockMath math="\cos^{-1}\!\left(-\tfrac{1}{3}\right) \approx 109.47^{\circ}" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NV axis directions</CardTitle>
          <CardDescription>Unit vectors in the crystal (body) frame, from dataset_metadata.json</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Axis</th>
                  <th className="py-2 pr-4 font-medium">n̂ₓ</th>
                  <th className="py-2 pr-4 font-medium">n̂ᵧ</th>
                  <th className="py-2 pr-4 font-medium">n̂_z</th>
                </tr>
              </thead>
              <tbody>
                {NV_AXES.map((axis, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                        style={{ backgroundColor: NV_AXIS_COLORS[i] }}
                      />
                      Axis {i + 1}
                    </td>
                    {axis.map((c, j) => (
                      <td key={j} className="py-2 pr-4 font-mono text-xs">
                        {c.toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
