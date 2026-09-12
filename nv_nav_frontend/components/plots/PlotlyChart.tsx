"use client";

import dynamic from "next/dynamic";
import type { Data, Layout, Config } from "plotly.js";
import { useUIStore } from "@/store";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface PlotlyChartProps {
  data: Data[];
  title?: string;
  xTitle?: string;
  yTitle?: string;
  height?: number;
  layoutOverrides?: Partial<Layout>;
  className?: string;
}

export function PlotlyChart({
  data,
  title,
  xTitle,
  yTitle,
  height = 360,
  layoutOverrides,
  className,
}: PlotlyChartProps) {
  const theme = useUIStore((s) => s.theme);
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const fontColor = isDark ? "#E5E7EB" : "#1E293B";

  const layout: Partial<Layout> = {
    title: title ? { text: title, font: { size: 14, color: fontColor } } : undefined,
    autosize: true,
    height,
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { family: "Inter, sans-serif", color: fontColor, size: 12 },
    margin: { l: 56, r: 24, t: title ? 44 : 16, b: 48 },
    xaxis: {
      title: xTitle ? { text: xTitle } : undefined,
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      linecolor: gridColor,
    },
    yaxis: {
      title: yTitle ? { text: yTitle } : undefined,
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      linecolor: gridColor,
    },
    legend: { orientation: "h", y: -0.25 },
    hovermode: "closest",
    ...layoutOverrides,
  };

  const config: Partial<Config> = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
    toImageButtonOptions: { format: "png", filename: title || "nv-nav-plot", scale: 2 },
  };

  return (
    <div className={className} style={{ width: "100%" }}>
      <Plot
        data={data}
        layout={layout}
        config={config}
        style={{ width: "100%", height: `${height}px` }}
        useResizeHandler
      />
    </div>
  );
}
