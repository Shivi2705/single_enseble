"use client";

import { useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { UploadCloud, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlotlyChart } from "@/components/plots/PlotlyChart";
import { useUploadMap } from "@/hooks/use-api";
import { toast } from "@/components/ui/toaster";
import { formatNumber } from "@/lib/utils";

const DOMAIN_M = 1000;
const RES_M = 10;
const N = Math.round(DOMAIN_M / RES_M); // 100

// Deterministic synthetic magnetic anomaly field, standing in for the
// backend's internal MagneticMap grid (not exposed as raw data by the API).
function fieldAt(x: number, y: number) {
  const a = Math.sin(x / 90) * Math.cos(y / 70) * 35;
  const b = Math.sin((x + y) / 140) * 20;
  const c = Math.cos(x / 45 - y / 60) * 12;
  return 48000 + a + b + c; // nT, centered near a plausible ambient value
}

function buildGrid() {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < N; i++) {
    xs.push(i * RES_M);
    ys.push(i * RES_M);
  }
  const z: number[][] = ys.map((y) => xs.map((x) => fieldAt(x, y)));
  return { xs, ys, z };
}

function buildTrajectory(seedOffset: number, noiseScale: number) {
  const pts: { x: number; y: number }[] = [];
  let x = DOMAIN_M / 2;
  let y = DOMAIN_M / 2;
  let heading = 0.3 + seedOffset;
  for (let i = 0; i < 360; i++) {
    heading += Math.sin(i / 40 + seedOffset) * 0.05;
    x += Math.cos(heading) * 2.5 + (Math.random() - 0.5) * noiseScale;
    y += Math.sin(heading) * 2.5 + (Math.random() - 0.5) * noiseScale;
    x = Math.max(0, Math.min(DOMAIN_M, x));
    y = Math.max(0, Math.min(DOMAIN_M, y));
    pts.push({ x, y });
  }
  return pts;
}

export default function MapPage() {
  const [showGT, setShowGT] = useState(true);
  const [showEKF, setShowEKF] = useState(true);
  const [showPF, setShowPF] = useState(true);
  const [colorScale, setColorScale] = useState("Viridis");
  const [resolution, setResolution] = useState(String(RES_M));
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadMap = useUploadMap();

  const { xs, ys, z } = useMemo(() => buildGrid(), []);
  const gt = useMemo(() => buildTrajectory(0, 0), []);
  const ekf = useMemo(() => buildTrajectory(0.05, 4), []);
  const pf = useMemo(() => buildTrajectory(-0.05, 6), []);

  const flatZ = z.flat();
  const stats = {
    min: Math.min(...flatZ),
    max: Math.max(...flatZ),
    mean: flatZ.reduce((s, v) => s + v, 0) / flatZ.length,
  };

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Choose a file first", variant: "error" });
      return;
    }
    uploadMap.mutate(
      { file, resolutionM: Number(resolution) },
      {
        onSuccess: (res) =>
          toast({
            title: "Map uploaded",
            description: `Shape ${res.shape.join("×")} · extent ${res.extent_m.map((v) => formatNumber(v, 0)).join(" × ")} m`,
            variant: "success",
          }),
        onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "error" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Magnetic Map</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive anomaly map with ground-truth, EKF, and particle-filter trajectory overlays.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Field magnitude</CardTitle>
            <CardDescription>|B| over the {DOMAIN_M}×{DOMAIN_M} m survey domain (nT)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="2d">
              <TabsList>
                <TabsTrigger value="2d">2D map</TabsTrigger>
                <TabsTrigger value="3d">3D surface</TabsTrigger>
              </TabsList>
              <TabsContent value="2d">
                <PlotlyChart
                  height={480}
                  xTitle="x (m)"
                  yTitle="y (m)"
                  data={[
                    {
                      x: xs,
                      y: ys,
                      z,
                      type: "heatmap",
                      colorscale: colorScale,
                      colorbar: { title: "nT" },
                    } as any,
                    ...(showGT
                      ? [
                          {
                            x: gt.map((p) => p.x),
                            y: gt.map((p) => p.y),
                            mode: "lines" as const,
                            type: "scatter" as const,
                            name: "Ground truth",
                            line: { color: "#10B981", width: 2.5 },
                          },
                        ]
                      : []),
                    ...(showEKF
                      ? [
                          {
                            x: ekf.map((p) => p.x),
                            y: ekf.map((p) => p.y),
                            mode: "lines" as const,
                            type: "scatter" as const,
                            name: "EKF estimate",
                            line: { color: "#4F46E5", width: 2, dash: "dash" as const },
                          },
                        ]
                      : []),
                    ...(showPF
                      ? [
                          {
                            x: pf.map((p) => p.x),
                            y: pf.map((p) => p.y),
                            mode: "lines" as const,
                            type: "scatter" as const,
                            name: "PF estimate",
                            line: { color: "#F97316", width: 2, dash: "dashdot" as const },
                          },
                        ]
                      : []),
                  ]}
                  layoutOverrides={{ yaxis: { scaleanchor: "x" } as any }}
                />
              </TabsContent>
              <TabsContent value="3d">
                <PlotlyChart
                  height={480}
                  data={[
                    {
                      x: xs,
                      y: ys,
                      z,
                      type: "surface",
                      colorscale: colorScale,
                      showscale: true,
                    } as any,
                  ]}
                  layoutOverrides={{
                    scene: {
                      xaxis: { title: "x (m)" },
                      yaxis: { title: "y (m)" },
                      zaxis: { title: "|B| (nT)" },
                    } as any,
                    margin: { l: 0, r: 0, t: 10, b: 0 },
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overlay controls</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <ToggleRow label="Ground truth" checked={showGT} onChange={setShowGT} color="#10B981" />
              <ToggleRow label="EKF estimate" checked={showEKF} onChange={setShowEKF} color="#4F46E5" />
              <ToggleRow label="PF estimate" checked={showPF} onChange={setShowPF} color="#F97316" />
              <div>
                <Label className="text-xs text-muted-foreground">Color scale</Label>
                <Select value={colorScale} onValueChange={setColorScale}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Viridis", "Plasma", "Turbo", "Inferno", "Cividis"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Map statistics</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5 text-sm">
              <Row k="Min |B|" v={`${formatNumber(stats.min, 0)} nT`} />
              <Row k="Max |B|" v={`${formatNumber(stats.max, 0)} nT`} />
              <Row k="Mean |B|" v={`${formatNumber(stats.mean, 0)} nT`} />
              <Row k="Resolution" v={`${RES_M} m`} />
              <Row k="Extent" v={`${DOMAIN_M} × ${DOMAIN_M} m`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bilinear interpolation</CardTitle>
              <CardDescription>Eq. 8</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <div className="rounded-md bg-muted/60 p-3">
                <BlockMath math="M(x,y) = (1-u)(1-v)M_{i,j} + u(1-v)M_{i+1,j} + (1-u)v M_{i,j+1} + uv\, M_{i+1,j+1}" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload custom map</CardTitle>
              <CardDescription>Calls POST /upload-map (.npy or .csv)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Input ref={fileRef} type="file" accept=".npy,.csv" />
              <div>
                <Label className="text-xs text-muted-foreground">Resolution (m)</Label>
                <Input
                  type="number"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button className="w-full" onClick={handleUpload} disabled={uploadMap.isPending}>
                <UploadCloud className="h-4 w-4 mr-1.5" />
                {uploadMap.isPending ? "Uploading…" : "Upload map"}
              </Button>
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                The heatmap above is a synthetic illustrative field: the backend does not expose
                its raw internal map grid over the API. Uploaded maps are stored and used
                server-side for the next /run-ekf or /run-pf call.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </Label>
      <Switch checked={checked} onCheckedChange={onChange} />
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
