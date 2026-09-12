"use client";

import { useState } from "react";
import { RotateCcw, Save, Sun, Moon, Laptop } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useUIStore, type ThemeMode } from "@/store";
import { DEFAULT_API_URL } from "@/lib/constants";
import { toast } from "@/components/ui/toaster";
import { StatusIndicator } from "@/components/shared/StatusIndicator";

export default function SettingsPage() {
  const {
    apiUrl,
    setApiUrl,
    theme,
    setTheme,
    refreshIntervalMs,
    setRefreshIntervalMs,
    filterDefaults,
    setFilterDefaults,
    resetFilterDefaults,
  } = useUIStore();

  const [apiUrlDraft, setApiUrlDraft] = useState(apiUrl);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the backend connection, appearance, and default filter parameters.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backend API</CardTitle>
          <CardDescription>Base URL of the FastAPI server (backend/main.py)</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={apiUrlDraft}
              onChange={(e) => setApiUrlDraft(e.target.value)}
              placeholder={DEFAULT_API_URL}
              className="flex-1"
            />
            <Button
              onClick={() => {
                setApiUrl(apiUrlDraft);
                toast({ title: "API URL saved", variant: "success" });
              }}
            >
              <Save className="h-4 w-4 mr-1.5" /> Save
            </Button>
          </div>
          <StatusIndicator />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Theme preference</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { v: "light", label: "Light", icon: Sun },
                { v: "dark", label: "Dark", icon: Moon },
                { v: "auto", label: "Auto", icon: Laptop },
              ] as { v: ThemeMode; label: string; icon: any }[]
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => setTheme(v)}
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                  theme === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live data</CardTitle>
          <CardDescription>Refresh interval for the backend status check</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Label className="text-xs text-muted-foreground">
            Refresh every {(refreshIntervalMs / 1000).toFixed(0)}s
          </Label>
          <Slider
            className="mt-2"
            min={5000}
            max={60000}
            step={5000}
            value={[refreshIntervalMs]}
            onValueChange={([v]) => setRefreshIntervalMs(v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Default filter parameters</CardTitle>
            <CardDescription>Pre-filled when opening Navigation Filters</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilterDefaults}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          <div>
            <Label className="text-xs text-muted-foreground">Axis count</Label>
            <Select
              value={String(filterDefaults.axisCount)}
              onValueChange={(v) => setFilterDefaults({ axisCount: Number(v) as 1 | 3 | 4 })}
            >
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
              Process noise scale: {filterDefaults.processNoiseScale.toFixed(2)}×
            </Label>
            <Slider
              className="mt-2"
              min={0.1}
              max={5}
              step={0.1}
              value={[filterDefaults.processNoiseScale]}
              onValueChange={([v]) => setFilterDefaults({ processNoiseScale: v })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Measurement noise scale: {filterDefaults.measurementNoiseScale.toFixed(2)}×
            </Label>
            <Slider
              className="mt-2"
              min={0.1}
              max={5}
              step={0.1}
              value={[filterDefaults.measurementNoiseScale]}
              onValueChange={([v]) => setFilterDefaults({ measurementNoiseScale: v })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Particle count: {filterDefaults.nParticles}
            </Label>
            <Slider
              className="mt-2"
              min={100}
              max={5000}
              step={100}
              value={[filterDefaults.nParticles]}
              onValueChange={([v]) => setFilterDefaults({ nParticles: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
