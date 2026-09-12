# NV-Nav Frontend

A Next.js 14 (App Router) + TypeScript dashboard for the **Calibration-Free NV-Center
Vector Magnetometry Fused with Map-Matching Navigation** research project. It consumes
the FastAPI backend in `backend/main.py`:

- `POST /simulate-odmr`
- `POST /run-ekf`
- `POST /run-pf`
- `GET /metrics`
- `GET /plots`
- `POST /upload-map`

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · custom shadcn/ui-style primitives ·
`@react-three/fiber` + `@react-three/drei` (3D diamond viewer) · Plotly.js (charts) ·
Framer Motion · TanStack Query · Zustand · Lucide icons · KaTeX (`react-katex`).

## Getting started

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if not localhost:8000
npm run dev
```

Open http://localhost:3000. Make sure the FastAPI backend is running at the URL
configured in **Settings** (defaults to `http://localhost:8000`).

## Pages

| Route         | Description                                              |
|---------------|-----------------------------------------------------------|
| `/`           | Dashboard: live status, latest metrics, recent plots      |
| `/diamond`    | Interactive 3D diamond-cubic lattice + NV axes             |
| `/odmr`       | ODMR spectrum, Lorentzian fit, Zeeman inversion            |
| `/filters`    | EKF vs. Particle Filter — configure, run, compare          |
| `/map`        | Magnetic anomaly map with trajectory overlays              |
| `/equations`  | All 24 equations (Eq. 1–24), searchable and grouped        |
| `/datasets`   | Dataset metadata, NV axes, download links, citation        |
| `/settings`   | API URL, theme, refresh interval, default filter params    |

## Known limitations / integration notes

The backend's JSON responses are intentionally lightweight (summary statistics and
server-side file paths), so a few pages fill gaps with clearly-labeled, deterministic
**illustrative** data rather than guessing at endpoints that don't exist:

1. **Plot images.** `GET /plots` and the `plots` field in `/run-ekf` / `/run-pf`
   responses return local filesystem paths (e.g. `output/plots/ekf_map_trajectory_....png`),
   not URLs. To let the frontend actually display them, mount a static file route in
   FastAPI, e.g.:
   ```python
   from fastapi.staticfiles import StaticFiles
   app.mount("/static-output", StaticFiles(directory=config.OUTPUT_DIR), name="output")
   ```
   and adjust `resolveBackendAsset()` in `lib/utils.ts` to match your mount path. Until
   then, plot cards show a graceful fallback with the raw path.

2. **ODMR spectrum page.** `/simulate-odmr` returns aggregate stats (mean/std B∥,
   condition number), not the raw per-timestep spectrum. The spectrum plot is generated
   client-side from the same physical model (Eq. 1) for interactivity, while the "Fetch
   backend summary" button calls the real endpoint and displays its response.

3. **Magnetic Map page.** The backend's `MagneticMap` grid isn't exposed via a GET
   endpoint, so the heatmap/surface is a synthetic, deterministic stand-in field sized to
   the dataset's domain (1000×1000 m at 10 m resolution). The **Upload custom map** panel
   is fully wired to the real `POST /upload-map` endpoint.

4. **Datasets page** mirrors `dataset_metadata.json` directly (values copied from the
   uploaded backend) since there's no GET endpoint for it, and offers download buttons
   assuming a static mount for the `dataset/` directory.

5. **Filter comparison.** Per-timestep estimate/ground-truth arrays are saved to `.npz`
   server-side but not returned in the JSON response, so the "Compare" tab reads
   aggregate metrics from `GET /metrics` rather than re-plotting raw trajectories; the
   per-run "Generated plots" grid uses the backend's own PNGs (see point 1).

None of this affects the real control-plane calls (`/run-ekf`, `/run-pf`,
`/upload-map`, `/metrics`, `/plots`) — those are fully wired through `lib/api.ts`.

## Project structure

```
app/                # Next.js App Router pages
components/         # ui primitives, navigation, dashboard, diamond, plots, equations
lib/                # api client, constants (NV axes, equations catalog), utils
hooks/               # React Query hooks
store/               # Zustand UI/settings store
types/               # Shared TypeScript types mirroring the backend contracts
```

## Notes

- No `localStorage`/`sessionStorage` browser-storage assumptions beyond the API URL and
  UI preferences, which persist via Zustand's `persist` middleware.
- Dark mode follows `prefers-color-scheme` by default; toggle in Settings.
- All charts are Plotly.js, exportable to PNG via the chart toolbar.
