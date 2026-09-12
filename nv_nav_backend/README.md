# NV-Center Navigation Backend

Calibration-free NV-center vector magnetometry fused with map-matching
navigation (EKF + particle filter), implementing Eq. 1–24 of the design
report.

## Important note on the dataset

The `datasets` attachment provided alongside the spec arrived **empty** (no
`ground_truth_3600s.csv` / `dataset_metadata.json` were actually present in
the upload). `dataset/generate_dataset.py` synthesizes both files locally,
using exactly the physical constants and sensor parameters from Section 8
of the report (D_zfs, NV axis geometry, IMU noise densities, a 1000x1000 m
domain, 3600 x 1 Hz samples). This has already been run once — the CSV and
JSON are included in `dataset/`. If you have real survey/trajectory data,
replace those two files (same schema) and everything downstream is
unaffected.

## Quickstart

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open `http://127.0.0.1:8000/docs` for interactive Swagger UI, or call:

- `GET /` – health check
- `POST /simulate-odmr` – ODMR simulate/load + peak fit (Eq. 2) + Zeeman
  inversion (Eq. 3) + vector reconstruction (Eq. 4–5) or single-axis (Eq. 6b)
- `POST /run-ekf` – full EKF run (Eq. 11–19) over the trajectory
- `POST /run-pf` – full particle filter run (Eq. 20–24)
- `POST /upload-map` – upload a custom `.npy` or `.csv` magnetic map
- `GET /metrics` – aggregate metrics from the latest EKF/PF runs
- `GET /plots` – list generated plot files

Run tests with:

```bash
python -m pytest tests/ -v
# or
python tests/test_pipeline.py
```

## Known tuning caveat

The EKF/PF filter gains, process/measurement noise scaling, and the
synthetic map's spatial gradient are a reasonable first-pass, physically
traceable configuration (see `config.py` and each module's equation
comments) but have not been hand-tuned for minimal RMSE — a short (100–300
step) test run can diverge if `use_correlation_init=False` and the true
displacement is large relative to the map's feature scale. For the paper's
actual results section, sweep `process_noise_scale` /
`measurement_noise_scale`, and consider tightening the map's grid resolution
via `dataset_metadata.json["map_resolution_m"]`.

## Structure

See `backend/` for the three-tier layout described in the design report
(Section 7.1): `sensing/` (Eq. 1–7), `estimation/` (Eq. 8–24), `utils/`
(plotting + metrics), `tests/`.
