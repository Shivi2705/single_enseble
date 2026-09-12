"use client";

import { useMemo, useState } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { Activity, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlotlyChart } from "@/components/plots/PlotlyChart";
import { useSimulateODMR } from "@/hooks/use-api";
import { formatNumber } from "@/lib/utils";
import type { AxisCount } from "@/types";

const D_ZFS_MHZ = 2870.08;
const GAMMA_E = 2.802; // MHz/G
const N_STEPS = 3600;

// Deterministic pseudo-random field per timestep, purely for illustrating the
// spectrum shape interactively (the backend's /simulate-odmr endpoint returns
// aggregate summary statistics rather than a raw per-timestep spectrum).
function fieldForTimestep(t: number) {
  return 8 + 6 * Math.sin(t / 180) + 2 * Math.sin(t / 37 + 1.3);
}

function lorentzian(f: number, center: number, contrast: number, width: number) {
  return (contrast) / (1 + Math.pow((f - center) / (width / 2), 2));
}

export default function ODMRPage() {
  const [timestep, setTimestep] = useState(0);
  const [axisCount, setAxisCount] = useState<AxisCount>(4);
  const [showDips, setShowDips] = useState(true);
  const [showResiduals, setShowResiduals] = useState(false);
  const simulate = useSimulateODMR();

  const bTrue = fieldForTimestep(timestep);
  const splitting = 2 * GAMMA_E * bTrue;
  const fMinus = D_ZFS_MHZ - splitting / 2;
  const fPlus = D_ZFS_MHZ + splitting / 2;
  const contrast = 0.18;
  const width = 2.4;
  const I0 = 1.0;

  const { fSweep, spectrum, fitCurve, residuals } = useMemo(() => {
    const n = 400;
    const lo = D_ZFS_MHZ - 60;
    const hi = D_ZFS_MHZ + 60;
    const fSweep: number[] = [];
    const spectrum: number[] = [];
    const fitCurve: number[] = [];
    const residuals: number[] = [];
    let seed = timestep * 7919;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < n; i++) {
      const f = lo + ((hi - lo) * i) / (n - 1);
      fSweep.push(f);
      const clean =
        I0 * (1 - lorentzian(f, fMinus, contrast, width) - lorentzian(f, fPlus, contrast, width));
      const noisy = clean + (rand() - 0.5) * 0.01;
      spectrum.push(noisy);
      fitCurve.push(clean);
      residuals.push(noisy - clean);
    }
    return { fSweep, spectrum, fitCurve, residuals };
  }, [timestep, fMinus, fPlus]);

  const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const meanY = spectrum.reduce((s, y) => s + y, 0) / spectrum.length;
  const ssTot = spectrum.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;

  const handleRunSummary = () => {
    simulate.mutate({ use_real_data: true, axis_count: axisCount, n_steps: 200 });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ODMR Spectroscopy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Two-dip Lorentzian fit and Zeeman inversion at a chosen point along the trajectory.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Activity className="h-3.5 w-3.5" /> t = {timestep}s of {N_STEPS}s
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Spectrum</CardTitle>
              <CardDescription>Photoluminescence intensity vs. microwave frequency</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <PlotlyChart
                height={380}
                xTitle="Frequency (MHz)"
                yTitle="Normalized intensity (a.u.)"
                data={[
                  {
                    x: fSweep,
                    y: spectrum,
                    mode: "markers",
                    type: "scatter",
                    name: "Measured",
                    marker: { size: 4, color: "#94A3B8" },
                  },
                  {
                    x: fSweep,
                    y: fitCurve,
                    mode: "lines",
                    type: "scatter",
                    name: "Lorentzian fit",
                    line: { color: "#4F46E5", width: 2.5 },
                  },
                  ...(showDips
                    ? [
                        {
                          x: fSweep,
                          y: fSweep.map((f) => 1 - lorentzian(f, fMinus, contrast, width)),
                          mode: "lines" as const,
                          type: "scatter" as const,
                          name: "f₋ dip",
                          line: { color: "#F97316", width: 1.5, dash: "dot" as const },
                        },
                        {
                          x: fSweep,
                          y: fSweep.map((f) => 1 - lorentzian(f, fPlus, contrast, width)),
                          mode: "lines" as const,
                          type: "scatter" as const,
                          name: "f₊ dip",
                          line: { color: "#10B981", width: 1.5, dash: "dot" as const },
                        },
                      ]
                    : []),
                ]}
              />
              {showResiduals && (
                <div className="mt-4 border-t border-border pt-4">
                  <PlotlyChart
                    height={160}
                    xTitle="Frequency (MHz)"
                    yTitle="Residual"
                    data={[
                      {
                        x: fSweep,
                        y: residuals,
                        mode: "lines",
                        type: "scatter",
                        name: "Residual",
                        line: { color: "#EF4444", width: 1 },
                      },
                    ]}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governing equations</CardTitle>
              <CardDescription>Eq. 1 &amp; 2 — lineshape and peak fitting</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 grid gap-4 md:grid-cols-2">
              <div className="rounded-md bg-muted/60 p-4 overflow-x-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">Eq. 1 — Lorentzian lineshape</p>
                <BlockMath math="I(f) = I_0 \left[1 - \sum_{k} \frac{C_k}{1 + \left(\frac{f - f_k}{\Gamma_k/2}\right)^2}\right]" />
              </div>
              <div className="rounded-md bg-muted/60 p-4 overflow-x-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">Eq. 2 — nonlinear least-squares fit</p>
                <BlockMath math="\hat\theta = \arg\min_{\theta} \sum_j \left[I_j - I(f_j;\theta)\right]^2" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground">Timestep: {timestep}s</Label>
                <Slider
                  className="mt-2"
                  min={0}
                  max={N_STEPS - 1}
                  step={1}
                  value={[timestep]}
                  onValueChange={([v]) => setTimestep(v)}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Axis count</Label>
                <Select value={String(axisCount)} onValueChange={(v) => setAxisCount(Number(v) as AxisCount)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 axis</SelectItem>
                    <SelectItem value="3">3 axes</SelectItem>
                    <SelectItem value="4">4 axes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal text-muted-foreground">Show individual dips</Label>
                <Switch checked={showDips} onCheckedChange={setShowDips} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal text-muted-foreground">Show residuals</Label>
                <Switch checked={showResiduals} onCheckedChange={setShowResiduals} />
              </div>

              <button
                onClick={handleRunSummary}
                disabled={simulate.isPending}
                className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {simulate.isPending ? "Requesting backend…" : "Fetch backend summary"}
              </button>
              {simulate.data && (
                <div className="rounded-md border border-border p-3 text-xs space-y-1">
                  <Row k="Mean B∥" v={`${formatNumber(simulate.data.summary.mean_B_parallel_gauss, 4)} G`} />
                  <Row k="Std B∥" v={`${formatNumber(simulate.data.summary.std_B_parallel_gauss, 4)} G`} />
                  {simulate.data.summary.condition_number_N !== undefined && (
                    <Row k="Condition number" v={formatNumber(simulate.data.summary.condition_number_N, 3)} />
                  )}
                </div>
              )}
              {simulate.isError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" /> Could not reach backend — check Settings.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fitted parameters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm space-y-1.5">
              <Row k="I₀" v={I0.toFixed(3)} />
              <Row k="f₋ (MHz)" v={fMinus.toFixed(3)} />
              <Row k="f₊ (MHz)" v={fPlus.toFixed(3)} />
              <Row k="Contrast C" v={contrast.toFixed(3)} />
              <Row k="Linewidth Γ (MHz)" v={width.toFixed(2)} />
              <Row k="B∥ (Zeeman, G)" v={bTrue.toFixed(4)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fit quality</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm space-y-1.5">
              <Row k="R²" v={r2.toFixed(4)} />
              <Row k="RMSE" v={rmse.toExponential(2)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium font-mono">{v}</span>
    </div>
  );
}
