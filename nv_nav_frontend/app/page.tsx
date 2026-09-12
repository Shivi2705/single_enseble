"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target,
  Crosshair,
  AlertTriangle,
  Timer,
  PlayCircle,
  Gem,
  ArrowRight,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { PlotThumbnail } from "@/components/dashboard/PlotThumbnail";
import { StatusIndicator } from "@/components/shared/StatusIndicator";
import { useMetrics, usePlots, useRunEKF, useRunPF } from "@/hooks/use-api";
import { toast } from "@/components/ui/toaster";
import { formatDuration, formatNumber } from "@/lib/utils";

export default function HomePage() {
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: plots, isLoading: plotsLoading } = usePlots();
  const runEKF = useRunEKF();
  const runPF = useRunPF();

  const ekf = metrics?.ekf;
  const pf = metrics?.particle_filter;

  const handleRunEKF = () => {
    toast({ title: "Running EKF…", description: "This may take a few seconds." });
    runEKF.mutate(
      { axis_count: 4 },
      {
        onSuccess: (res) =>
          toast({
            title: "EKF run complete",
            description: `RMSE ${formatNumber(res.metrics.rmse_position_m)} m`,
            variant: "success",
          }),
        onError: (err: any) =>
          toast({ title: "EKF run failed", description: err.message, variant: "error" }),
      }
    );
  };

  const handleRunPF = () => {
    toast({ title: "Running Particle Filter…", description: "This may take a few seconds." });
    runPF.mutate(
      { axis_count: 4, n_particles: 1000 },
      {
        onSuccess: (res) =>
          toast({
            title: "PF run complete",
            description: `RMSE ${formatNumber(res.metrics.rmse_position_m)} m`,
            variant: "success",
          }),
        onError: (err: any) =>
          toast({ title: "PF run failed", description: err.message, variant: "error" }),
      }
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-border glass p-8 md:p-12"
      >
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-2">
            <StatusIndicator />
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            Calibration-Free NV-Center Vector Magnetometry
            <span className="text-gradient block">Fused with Map-Matching Navigation</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
            A research dashboard for exploring ODMR-based diamond magnetometry, four-axis
            vector field reconstruction, and EKF / particle-filter navigation against a
            magnetic anomaly map — with no GPS and no per-device calibration.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleRunEKF} disabled={runEKF.isPending}>
              <PlayCircle className="h-4 w-4 mr-1.5" />
              {runEKF.isPending ? "Running EKF…" : "Run EKF"}
            </Button>
            <Button onClick={handleRunPF} variant="secondary" disabled={runPF.isPending}>
              <PlayCircle className="h-4 w-4 mr-1.5" />
              {runPF.isPending ? "Running PF…" : "Run Particle Filter"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/diamond">
                <Gem className="h-4 w-4 mr-1.5" /> View 3D Diamond
              </Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest run metrics</h2>
          <Link href="/filters" className="text-xs text-primary flex items-center gap-1 hover:underline">
            Full comparison <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {!metricsLoading && !ekf && !pf ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No EKF or particle-filter runs yet. Use the buttons above, or head to{" "}
              <Link href="/filters" className="text-primary hover:underline">
                Navigation Filters
              </Link>{" "}
              to run one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="EKF Position RMSE"
              value={metricsLoading ? "…" : formatNumber(ekf?.rmse_position_m)}
              unit="m"
              icon={Target}
              accent="primary"
              delay={0}
            />
            <StatCard
              label="PF Position RMSE"
              value={metricsLoading ? "…" : formatNumber(pf?.rmse_position_m)}
              unit="m"
              icon={Crosshair}
              accent="secondary"
              delay={0.05}
            />
            <StatCard
              label="Max Error"
              value={
                metricsLoading
                  ? "…"
                  : formatNumber(
                      Math.max(ekf?.max_position_error_m ?? 0, pf?.max_position_error_m ?? 0)
                    )
              }
              unit="m"
              icon={AlertTriangle}
              accent="amber"
              delay={0.1}
            />
            <StatCard
              label="Convergence Time"
              value={
                metricsLoading
                  ? "…"
                  : formatDuration(ekf?.convergence_time_s ?? pf?.convergence_time_s)
              }
              icon={Timer}
              accent="emerald"
              delay={0.15}
            />
          </div>
        )}
      </section>

      {/* Recent plots */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent plots</h2>
          <span className="text-xs text-muted-foreground">
            {plots?.plots?.length ?? 0} available
          </span>
        </div>
        <Card>
          <CardContent className="p-5">
            {plotsLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : plots?.plots?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {plots.plots.slice(-8).map((p) => (
                  <PlotThumbnail key={p.filename} filename={p.filename} path={p.path} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <p className="text-sm">No plots generated yet. Run EKF or PF to create some.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick links */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>ODMR Spectroscopy</CardTitle>
            <CardDescription>Inspect fitted resonance dips and Zeeman inversion.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href="/odmr">Open <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Magnetic Map</CardTitle>
            <CardDescription>Explore the anomaly map with trajectory overlays.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href="/map">Open <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Equations Reference</CardTitle>
            <CardDescription>Every equation (1–24) with explanations.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href="/equations">Open <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
