"use client";

import { useEffect, useState } from "react";
import { Loader2, PlayCircle, Target, AlertTriangle, Compass, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlotThumbnail } from "@/components/dashboard/PlotThumbnail";
import { useMetrics, useRunEKF, useRunPF } from "@/hooks/use-api";
import { toast } from "@/components/ui/toaster";
import { formatNumber } from "@/lib/utils";
import type { AxisCount, RunFilterResponse } from "@/types";

function MetricPill({ label, value, icon: Icon, color }: any) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

// The sensing stage re-fits a Lorentzian ODMR spectrum for every timestep x
// axis before the filter ever runs — measured at ~30ms per fit. This makes
// runtime scale directly with n_steps and axis_count, so we estimate it here
// to set expectations instead of leaving the person guessing whether it's stuck.
function estimateSeconds(nSteps: number, axisCount: AxisCount) {
  return (nSteps * axisCount * 0.03).toFixed(0);
}

function useElapsedSeconds(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

function FilterPanel({ kind }: { kind: "ekf" | "pf" }) {
  const [axisCount, setAxisCount] = useState<AxisCount>(4);
  const [nSteps, setNSteps] = useState(600);
  const [processNoise, setProcessNoise] = useState(1.0);
  const [measurementNoise, setMeasurementNoise] = useState(1.0);
  const [nParticles, setNParticles] = useState(1000);
  const [resampleThreshold, setResampleThreshold] = useState(500);
  const [useCorrInit, setUseCorrInit] = useState(true);
  const [result, setResult] = useState<RunFilterResponse | null>(null);

  const runEKF = useRunEKF();
  const runPF = useRunPF();
  const isPending = kind === "ekf" ? runEKF.isPending : runPF.isPending;
  const elapsed = useElapsedSeconds(isPending);
  const color = kind === "ekf" ? "text-ekf" : "text-pf";
  const bg = kind === "ekf" ? "bg-ekf" : "bg-pf";

  const handleRun = () => {
    const base = {
      axis_count: axisCount,
      n_steps: nSteps,
      use_correlation_init: useCorrInit,
      process_noise_scale: processNoise,
      measurement_noise_scale: measurementNoise,
    };
    toast({ title: `Running ${kind === "ekf" ? "EKF" : "Particle Filter"}…`, description: `~${estimateSeconds(nSteps, axisCount)}s estimated for ${nSteps} steps` });
    if (kind === "ekf") {
      runEKF.mutate(base, {
        onSuccess: (res) => {
          setResult(res);
          toast({ title: "EKF complete", variant: "success" });
        },
        onError: (err: any) => toast({ title: "EKF failed", description: err.message, variant: "error" }),
      });
    } else {
      runPF.mutate(
        { ...base, n_particles: nParticles, resample_threshold: resampleThreshold },
        {
          onSuccess: (res) => {
            setResult(res);
            toast({ title: "Particle filter complete", variant: "success" });
          },
          onError: (err: any) => toast({ title: "PF failed", description: err.message, variant: "error" }),
        }
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className={color}>{kind === "ekf" ? "EKF parameters" : "Particle filter parameters"}</CardTitle>
          <CardDescription>Configure and run against the ground-truth trajectory</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
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

          <div>
            <Label className="text-xs text-muted-foreground">
              Trajectory length: {nSteps} steps (~{nSteps}s of flight) · est. {estimateSeconds(nSteps, axisCount)}s to run
            </Label>
            <Slider className="mt-2" min={100} max={3600} step={100} value={[nSteps]} onValueChange={([v]) => setNSteps(v)} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              The sensing stage re-fits an ODMR spectrum per timestep per axis, so runtime scales with this and
              axis count. Start small (300–600) to iterate quickly; use the full 3600 for a publication run.
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Process noise scale: {processNoise.toFixed(2)}×</Label>
            <Slider className="mt-2" min={0.1} max={5} step={0.1} value={[processNoise]} onValueChange={([v]) => setProcessNoise(v)} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Measurement noise scale: {measurementNoise.toFixed(2)}×</Label>
            <Slider className="mt-2" min={0.1} max={5} step={0.1} value={[measurementNoise]} onValueChange={([v]) => setMeasurementNoise(v)} />
          </div>

          {kind === "pf" && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Number of particles: {nParticles}</Label>
                <Slider className="mt-2" min={100} max={5000} step={100} value={[nParticles]} onValueChange={([v]) => setNParticles(v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Resample threshold: {resampleThreshold}</Label>
                <Slider className="mt-2" min={50} max={nParticles} step={50} value={[resampleThreshold]} onValueChange={([v]) => setResampleThreshold(v)} />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">Correlation map-match init</Label>
            <Switch checked={useCorrInit} onCheckedChange={setUseCorrInit} />
          </div>

          <Button className="w-full" onClick={handleRun} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Running… {elapsed}s elapsed
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-1.5" /> Run {kind === "ekf" ? "EKF" : "Particle Filter"}
              </>
            )}
          </Button>
          {isPending && (
            <p className="text-center text-[11px] text-muted-foreground">
              Fitting ODMR spectra for {nSteps} steps × {axisCount} axes — this runs a real curve fit per
              sample, not a shortcut, so it&apos;s expected to take a while. Don&apos;t close this tab or click Run again.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricPill label="Position RMSE" value={`${formatNumber(result.metrics.rmse_position_m)} m`} icon={Target} color={bg} />
              <MetricPill label="Max Error" value={`${formatNumber(result.metrics.max_position_error_m)} m`} icon={AlertTriangle} color={bg} />
              <MetricPill label="Heading RMSE" value={`${formatNumber(result.metrics.rmse_heading_deg)}°`} icon={Compass} color={bg} />
              <MetricPill
                label={kind === "ekf" ? "Mean NIS" : "Mean N_eff"}
                value={formatNumber(
                  kind === "ekf"
                    ? (result.metrics as any).mean_NIS
                    : (result.metrics as any).mean_Neff
                )}
                icon={Gauge}
                color={bg}
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Generated plots</CardTitle>
                <CardDescription>Rendered by the backend for this run</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {Object.entries(result.plots).map(([key, path]) => (
                    <div key={key}>
                      <PlotThumbnail filename={key.replace(/_/g, " ")} path={path} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Configure parameters and run the filter to see metrics and plots here.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function FiltersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Navigation Filters</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Side-by-side comparison of the Extended Kalman Filter and Particle Filter for
          map-matching navigation.
        </p>
      </div>

      <Tabs defaultValue="ekf">
        <TabsList>
          <TabsTrigger value="ekf">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-ekf inline-block" /> EKF
          </TabsTrigger>
          <TabsTrigger value="pf">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-pf inline-block" /> Particle Filter
          </TabsTrigger>
          <TabsTrigger value="compare">
            <Badge variant="outline" className="mr-1.5 h-4 px-1 text-[9px]">VS</Badge> Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ekf">
          <FilterPanel kind="ekf" />
        </TabsContent>
        <TabsContent value="pf">
          <FilterPanel kind="pf" />
        </TabsContent>
        <TabsContent value="compare">
          <ComparePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComparePanel() {
  const [showGT, setShowGT] = useState(true);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Comparison summary</CardTitle>
            <CardDescription>
              Fetches the latest metrics from <code className="rounded bg-muted px-1">/metrics</code>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Show ground truth</Label>
            <Switch checked={showGT} onCheckedChange={setShowGT} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CompareTable showGT={showGT} />
        </CardContent>
      </Card>
    </div>
  );
}

function CompareTable({ showGT }: { showGT: boolean }) {
  const { data, isLoading } = useMetrics();
  const ekf = data?.ekf;
  const pf = data?.particle_filter;

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading metrics…</p>;
  if (!ekf && !pf)
    return <p className="text-sm text-muted-foreground">Run both filters to populate this comparison.</p>;

  const rows = [
    { label: "Position RMSE (m)", ekfV: ekf?.rmse_position_m, pfV: pf?.rmse_position_m },
    { label: "Max position error (m)", ekfV: ekf?.max_position_error_m, pfV: pf?.max_position_error_m },
    { label: "Heading RMSE (°)", ekfV: ekf?.rmse_heading_deg, pfV: pf?.rmse_heading_deg },
    { label: "Convergence time (s)", ekfV: ekf?.convergence_time_s, pfV: pf?.convergence_time_s },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Metric</th>
            <th className="py-2 pr-4 font-medium text-ekf">EKF</th>
            <th className="py-2 pr-4 font-medium text-pf">Particle Filter</th>
            {showGT && <th className="py-2 pr-4 font-medium text-gt">Ground truth</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4">{r.label}</td>
              <td className="py-2 pr-4 font-mono">{formatNumber(r.ekfV)}</td>
              <td className="py-2 pr-4 font-mono">{formatNumber(r.pfV)}</td>
              {showGT && <td className="py-2 pr-4 font-mono text-muted-foreground">0.00</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
