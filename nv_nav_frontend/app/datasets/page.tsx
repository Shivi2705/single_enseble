"use client";

import Link from "next/link";
import { Download, Gem, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NV_AXES, NV_AXIS_COLORS } from "@/lib/constants";
import { apiBase } from "@/lib/utils";
import type { DatasetMetadata } from "@/types";

// Mirrors backend/dataset/dataset_metadata.json exactly. Shown directly since
// the backend has no GET endpoint exposing this file; only /upload-map and
// the sensing endpoints reference it internally.
const METADATA: DatasetMetadata = {
  dt: 1.0,
  n_steps: 3600,
  domain_m: 1000.0,
  nv_axes: NV_AXES,
  D_zfs_mhz: 2870.08,
  E_strain_mhz: 1.0,
  gamma_e_mhz_per_g: 2.802,
  A_par_mhz: -2.17,
  P_quad_mhz: -4.95,
  imu_noise: {
    accel_noise_density_ug_sqrtHz: 150.0,
    gyro_noise_density_dps_sqrtHz: 0.01,
    accel_std_per_sample_mps2: 0.0010401523073584585,
    gyro_std_per_sample_radps: 0.00012341341494884352,
  },
  linewidth_mhz_range: [1.0, 5.0],
  contrast_range: [0.05, 0.3],
  map_resolution_m: 10.0,
  notes:
    "Synthesized locally because the uploaded dataset attachment was empty; not real survey data.",
};

const COLUMNS = [
  { name: "t", desc: "Simulation time (s), 0 to 3599 at dt = 1.0 s." },
  { name: "x_gt, y_gt", desc: "Ground-truth 2D position in the world frame (m)." },
  { name: "psi_gt", desc: "Ground-truth heading (rad)." },
  { name: "ax_imu, ay_imu, omega_imu", desc: "Simulated noisy IMU acceleration and angular rate." },
  { name: "Bx_gt_nT, By_gt_nT, Bz_gt_nT", desc: "Ground-truth body-frame magnetic field components (nT)." },
];

export default function DatasetsPage() {
  const base = apiBase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The synthetic 3600-second ground-truth trajectory and sensor-noise metadata used
          throughout this dashboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ground_truth_3600s.csv</CardTitle>
              <CardDescription>
                {METADATA.n_steps} rows at dt = {METADATA.dt}s over a {METADATA.domain_m}×{METADATA.domain_m} m domain
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Column(s)</th>
                      <th className="py-2 pr-4 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLUMNS.map((c) => (
                      <tr key={c.name} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{c.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{c.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>NV axes (crystal frame)</CardTitle>
              <CardDescription>
                Fixed &lt;111&gt; tetrahedral directions — see the{" "}
                <Link href="/diamond" className="text-primary hover:underline inline-flex items-center gap-1">
                  3D Diamond Viewer <Gem className="h-3 w-3" />
                </Link>{" "}
                for an interactive preview
              </CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle>Noise &amp; sensing parameters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 grid gap-2 sm:grid-cols-2 text-sm">
              <Row k="Zero-field splitting D" v={`${METADATA.D_zfs_mhz} MHz`} />
              <Row k="Strain E" v={`${METADATA.E_strain_mhz} MHz`} />
              <Row k="Gyromagnetic ratio γₑ" v={`${METADATA.gamma_e_mhz_per_g} MHz/G`} />
              <Row k="Hyperfine A∥" v={`${METADATA.A_par_mhz} MHz`} />
              <Row k="Quadrupole P" v={`${METADATA.P_quad_mhz} MHz`} />
              <Row k="Map resolution" v={`${METADATA.map_resolution_m} m`} />
              <Row k="Linewidth range" v={`${METADATA.linewidth_mhz_range.join(" – ")} MHz`} />
              <Row k="Contrast range" v={METADATA.contrast_range.join(" – ")} />
              <Row k="Accel noise density" v={`${METADATA.imu_noise.accel_noise_density_ug_sqrtHz} µg/√Hz`} />
              <Row k="Gyro noise density" v={`${METADATA.imu_noise.gyro_noise_density_dps_sqrtHz} °/s/√Hz`} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Downloads</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <a href={`${base}/dataset/ground_truth_3600s.csv`} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-1.5" /> ground_truth_3600s.csv
                </a>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <a href={`${base}/dataset/dataset_metadata.json`} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-1.5" /> dataset_metadata.json
                </a>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <a href={`${base}/metrics`} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-1.5" /> Sample results (/metrics)
                </a>
              </Button>
              <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                These links assume the backend serves the dataset directory as static files.
                Add a <code className="rounded bg-muted px-1">StaticFiles</code> mount in
                FastAPI (e.g. at <code className="rounded bg-muted px-1">/dataset</code>) for
                direct downloads to work.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Citation</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground space-y-2">
              <p>
                This is a synthetically generated dataset produced for methodology
                demonstration and is not real survey data.
              </p>
              <pre className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-mono text-[11px]">
{`@misc{nvnav2026,
  title  = {Calibration-Free NV-Center Vector
            Magnetometry Fused with Map-Matching
            Navigation},
  note   = {Synthetic dataset, dt=1.0s, 3600s},
  year   = {2026}
}`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-2.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium font-mono">{v}</span>
    </div>
  );
}
