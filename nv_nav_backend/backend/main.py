"""
main.py

FastAPI application exposing the NV-center magnetometry + map-matching
navigation pipeline. See design report Section 7 ("Implementation
Architecture") for the endpoint contract this file implements.
"""
import logging
import os
import time
import json
import shutil

import numpy as np
import pandas as pd
import glob

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, List

import config
from sensing.odmr_simulator import simulate_spectrum
from sensing.peak_fitter import fit_two_dip_spectrum
from sensing.field_solver import (
    zeeman_inversion, vector_reconstruction, single_axis_projection,
    body_to_world, condition_number,
)
from estimation.magnetic_map import MagneticMap
from estimation.correlation_matcher import correlation_init
from estimation.ekf import EKF
from estimation.particle_filter import ParticleFilter
from utils import metrics as metrics_utils
from utils import plotting

logging.basicConfig(level=logging.INFO,
                     format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nv_nav_backend")

app = FastAPI(title="NV-Center Navigation Backend",
              description="Calibration-free NV magnetometry fused with map-matching navigation")

# Allow the Next.js frontend (dev server on :3000, or wherever it's hosted) to
# call this API from the browser. Without this, the browser's CORS preflight
# (an OPTIONS request) gets rejected with 405 before any POST/GET is ever
# attempted, which is what causes "backend is not connected" in the UI even
# though the server itself is healthy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your actual frontend origin(s) in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve output/plots as static files so the frontend can load plot images by
# URL (e.g. <img src="http://localhost:8000/static/plots/ekf_map_trajectory_...png">)
# instead of trying to load a server-local filesystem path like
# "D:\nv\nv_nav_backend\backend\output\plots\pf_heading_error_....png", which
# a browser can never fetch.
app.mount("/static/plots", StaticFiles(directory=config.PLOTS_DIR), name="plots")


def _plot_url(local_path: str) -> str:
    """Convert an on-disk plot path into a URL served by the /static/plots mount."""
    return f"/static/plots/{os.path.basename(local_path)}"


def _cleanup_old_plots(prefixes, keep=1):
    """Each /run-ekf or /run-pf call generates a fresh, uniquely-timestamped
    set of PNGs, and nothing was ever deleting the old ones -- the plots
    directory grows without bound. Before saving a new run's plots, delete
    older files sharing the same prefix (e.g. 'ekf_position_error_'), keeping
    only the most recent `keep` run(s) per plot type."""
    for prefix in prefixes:
        matches = sorted(
            glob.glob(os.path.join(config.PLOTS_DIR, f"{prefix}*.png")),
            key=os.path.getmtime,
        )
        for old_file in matches[:max(0, len(matches) - keep)]:
            try:
                os.remove(old_file)
            except OSError:
                pass


GT_DF = pd.read_csv(config.GROUND_TRUTH_CSV)
RNG = np.random.default_rng(7)

# The sensing pipeline (ODMR simulate + peak-fit for every timestep x axis)
# is the expensive part of /run-ekf and /run-pf, and it doesn't depend on
# which filter is run afterwards. If the frontend runs EKF then PF (or vice
# versa) back-to-back with the same axis_count/subset_axes/n_steps, reuse
# the cached sensing result instead of recomputing 3600 x n_axes curve fits
# a second time. Cleared automatically once it grows past a few entries.
_SENSING_CACHE = {}
_SENSING_CACHE_MAX = 4


def _cached_sensing_pipeline(use_real_data, axis_count, subset_axes, n_steps):
    key = (use_real_data, axis_count,
           tuple(subset_axes) if subset_axes else None, n_steps)
    if key in _SENSING_CACHE:
        logger.info(f"Reusing cached sensing pipeline result for key={key}")
        return _SENSING_CACHE[key]
    result = run_sensing_pipeline(use_real_data, axis_count, subset_axes, n_steps)
    if len(_SENSING_CACHE) >= _SENSING_CACHE_MAX:
        _SENSING_CACHE.pop(next(iter(_SENSING_CACHE)))
    _SENSING_CACHE[key] = result
    return result


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class SimulateODMRRequest(BaseModel):
    use_real_data: bool = True
    axis_count: int = 4
    subset_axes: Optional[List[int]] = None
    n_steps: Optional[int] = None  # optional subsample for speed


class RunEKFRequest(BaseModel):
    axis_count: int = 4
    subset_axes: Optional[List[int]] = None
    use_correlation_init: bool = True
    process_noise_scale: float = 1.0
    measurement_noise_scale: float = 1.0
    n_steps: Optional[int] = None


class RunPFRequest(BaseModel):
    axis_count: int = 4
    subset_axes: Optional[List[int]] = None
    n_particles: int = 1000
    use_correlation_init: bool = True
    resample_threshold: Optional[float] = None
    process_noise_scale: float = 1.0
    measurement_noise_scale: float = 1.0
    n_steps: Optional[int] = None


# ---------------------------------------------------------------------------
# Core sensing pipeline (shared by /simulate-odmr, /run-ekf, /run-pf)
# ---------------------------------------------------------------------------
def _select_axes(axis_count, subset_axes):
    if axis_count == 4:
        idx = [0, 1, 2, 3]
    elif axis_count == 3:
        idx = subset_axes if subset_axes else [0, 1, 2]
    elif axis_count == 1:
        idx = subset_axes if subset_axes else [0]
    else:
        raise ValueError("axis_count must be 1, 3, or 4")
    return idx, config.NV_AXES[idx]


def run_sensing_pipeline(use_real_data, axis_count, subset_axes=None, n_steps=None):
    """Runs ODMR simulation/loading + peak fitting (Eq. 2) + Zeeman inversion
    (Eq. 3) + vector reconstruction (Eq. 4-5) or single-axis path (Eq. 6b),
    for every timestep in the (possibly subsampled) trajectory.

    Returns a dict of arrays: t, B_body (T,3) or B_scalar (T,), B_parallel_all
    (T, n_axes), fit_diagnostics, axes_used.
    """
    idx, axes = _select_axes(axis_count, subset_axes)
    n_axes = len(idx)

    df = GT_DF if n_steps is None else GT_DF.iloc[:n_steps].reset_index(drop=True)
    T = len(df)
    logger.info(f"Running sensing pipeline: axis_count={axis_count}, axes={idx}, T={T}")

    B_true_body = df[["Bx_gt_nT", "By_gt_nT", "Bz_gt_nT"]].to_numpy() / 1e5  # nT -> Gauss

    B_parallel_all = np.zeros((T, n_axes))
    sigma_f_all = np.zeros((T, n_axes))
    fit_fail_count = 0

    for t in range(T):
        B_vec_gauss = B_true_body[t]
        for a_i, axis_vec in enumerate(axes):
            b_true = float(np.dot(B_vec_gauss, axis_vec))  # true scalar projection

            if use_real_data:
                # "Real data" here = the CSV ground truth trajectory/field;
                # we still need an ODMR spectrum to extract f*_k per the
                # spec's pipeline, so we simulate the spectrum consistent
                # with the CSV's true field (this stands in for a real
                # photon-counting acquisition at that field).
                f_sweep, I_meas, _ = simulate_spectrum(b_true, rng=RNG)
            else:
                f_sweep, I_meas, _ = simulate_spectrum(b_true, rng=RNG)

            fit = fit_two_dip_spectrum(f_sweep, I_meas)
            if not fit["fit_ok"]:
                fit_fail_count += 1
                B_parallel_all[t, a_i] = b_true  # fall back to truth to keep pipeline alive
                sigma_f_all[t, a_i] = np.nan
                continue

            b_hat = zeeman_inversion(fit["f_minus"], fit["f_plus"])  # Eq. 3
            B_parallel_all[t, a_i] = b_hat
            sigma_f_all[t, a_i] = np.nanmean([fit["sigma_f_minus"], fit["sigma_f_plus"]])

    if fit_fail_count:
        logger.warning(f"{fit_fail_count} peak fits failed to converge; fell back to ground truth for those samples.")

    result = {
        "t": df["t"].to_numpy(),
        "axes_used": idx,
        "B_parallel_all": B_parallel_all,
        "sigma_f_all": sigma_f_all,
        "gt_xy": df[["x_gt", "y_gt"]].to_numpy(),
        "gt_psi": df["psi_gt"].to_numpy(),
        "imu": df[["ax_imu", "ay_imu", "omega_imu"]].to_numpy(),
    }

    if n_axes >= 3:
        B_body = np.zeros((T, 3))
        cond_N = condition_number(axes)
        for t in range(T):
            weights = None
            if not np.any(np.isnan(sigma_f_all[t])):
                sig = np.clip(sigma_f_all[t], 1e-3, None)
                weights = 1.0 / (sig ** 2)
            B_body[t] = vector_reconstruction(B_parallel_all[t], axes=axes, weights=weights)
        result["B_body"] = B_body
        result["cond_N"] = float(cond_N)
    else:
        # Single-axis path (Eq. 6b): the one scalar projection IS B_parallel_all[:,0]
        result["B_scalar"] = B_parallel_all[:, 0]
        result["axis_vector"] = axes[0]

    return result


def _world_field_scalar(sensing_result, t_idx, psi):
    """Rotate the reconstructed field into the world frame (Eq. 7) and
    reduce to a scalar comparable to the (scalar) magnetic map."""
    if "B_body" in sensing_result:
        Bxy_body = sensing_result["B_body"][t_idx, :2]
        Bxy_world = body_to_world(Bxy_body, psi)
        Bz = sensing_result["B_body"][t_idx, 2]
        mag_gauss = np.sqrt(Bxy_world[0] ** 2 + Bxy_world[1] ** 2 + Bz ** 2)
    else:
        # single axis: treat the scalar projection itself, rotated trivially
        mag_gauss = abs(sensing_result["B_scalar"][t_idx])
    return mag_gauss * 1e5  # Gauss -> nT, to match the map's units


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {"status": "ok", "message": "NV-Center Navigation Backend"}


@app.post("/simulate-odmr")
def simulate_odmr(req: SimulateODMRRequest):
    try:
        result = run_sensing_pipeline(
            use_real_data=req.use_real_data,
            axis_count=req.axis_count,
            subset_axes=req.subset_axes,
            n_steps=req.n_steps,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ts = int(time.time())
    out_path = os.path.join(config.OUTPUT_DIR, f"sensing_results_{ts}.npz")
    save_kwargs = {
        "t": result["t"],
        "axes_used": np.array(result["axes_used"]),
        "B_parallel_all": result["B_parallel_all"],
        "sigma_f_all": result["sigma_f_all"],
    }
    if "B_body" in result:
        save_kwargs["B_body"] = result["B_body"]
    if "B_scalar" in result:
        save_kwargs["B_scalar"] = result["B_scalar"]
    np.savez(out_path, **save_kwargs)

    n_axes = len(result["axes_used"])
    stats = {
        "n_steps": int(len(result["t"])),
        "axis_count": req.axis_count,
        "axes_used": result["axes_used"],
        "mean_B_parallel_gauss": float(np.nanmean(result["B_parallel_all"])),
        "std_B_parallel_gauss": float(np.nanstd(result["B_parallel_all"])),
    }
    if "cond_N" in result:
        stats["condition_number_N"] = result["cond_N"]

    logger.info(f"simulate-odmr complete -> {out_path}")
    return {"summary": stats, "output_path": out_path}


def _build_map():
    return MagneticMap()


def _run_filter_common(req, filter_kind: str):
    idx = req.subset_axes
    axis_count = req.axis_count
    n_steps = req.n_steps if req.n_steps else config.N_STEPS

    sensing = _cached_sensing_pipeline(True, axis_count, idx, n_steps)
    mag_map = _build_map()

    t_arr = sensing["t"]
    T = len(t_arr)
    dt = config.DT
    gt_xy = sensing["gt_xy"]
    gt_psi = sensing["gt_psi"]
    imu = sensing["imu"]

    # Ground-truth measurement stream (world-frame scalar field magnitude, nT)
    z_series = np.array([
        _world_field_scalar(sensing, k, gt_psi[k]) for k in range(T)
    ])

    if req.use_correlation_init:
        window = min(60, T)
        rel_positions = np.cumsum(
            np.stack([
                np.cumsum(imu[:window, 0]) * dt * dt,
                np.cumsum(imu[:window, 1]) * dt * dt,
            ], axis=1), axis=0
        )
        init = correlation_init(z_series[:window], rel_positions, mag_map, grid_step=25.0)
        r_init = init["r_init"]
        P0_pos_std = 30.0
    else:
        r_init = gt_xy[0]
        P0_pos_std = 200.0  # deliberately poor initialization

    x0 = np.array([r_init[0], r_init[1], 0.0, 0.0, gt_psi[0]])
    P0 = np.diag([P0_pos_std ** 2, P0_pos_std ** 2, 4.0, 4.0, (0.3) ** 2])

    return sensing, mag_map, t_arr, T, dt, gt_xy, gt_psi, imu, z_series, x0, P0


@app.post("/run-ekf")
def run_ekf(req: RunEKFRequest):
    try:
        (sensing, mag_map, t_arr, T, dt, gt_xy, gt_psi, imu, z_series, x0, P0
         ) = _run_filter_common(req, "ekf")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ekf = EKF(x0, P0, mag_map, dt,
              process_noise_scale=req.process_noise_scale,
              measurement_noise_scale=req.measurement_noise_scale)

    est_xy = np.zeros((T, 2))
    est_psi = np.zeros(T)
    for k in range(T):
        u = imu[k]
        ekf.predict(u)
        ekf.update(z_series[k])
        est_xy[k] = ekf.x[:2]
        est_psi[k] = ekf.x[4]

    P_diag_hist = np.array(ekf.history["P_diag"])
    nis_hist = np.array(ekf.history["NIS"])

    pos_err = metrics_utils.position_error_series(est_xy, gt_xy)
    heading_err = metrics_utils.heading_error_series(est_psi, gt_psi)

    rmse_pos = metrics_utils.position_rmse(est_xy, gt_xy)
    max_err = metrics_utils.max_position_error(est_xy, gt_xy)
    rmse_heading = metrics_utils.heading_rmse(est_psi, gt_psi)
    nis_stats = metrics_utils.average_nis(nis_hist)

    ts = int(time.time())
    npz_path = os.path.join(config.OUTPUT_DIR, f"ekf_results_{ts}.npz")
    np.savez(npz_path, t=t_arr, est_xy=est_xy, est_psi=est_psi, gt_xy=gt_xy,
             gt_psi=gt_psi, P_diag=P_diag_hist, NIS=nis_hist,
             innovation=np.array(ekf.history["innovation"]),
             K_norm=np.array(ekf.history["K_norm"]))

    _cleanup_old_plots([
        "ekf_position_error_", "ekf_heading_error_",
        "ekf_covariance_innovations_", "ekf_map_trajectory_",
    ])
    plot_paths = {
        "position_error_time": _plot_url(plotting.plot_position_error_time(
            t_arr, ekf_err=pos_err, filename=f"ekf_position_error_{ts}.png")),
        "heading_error_time": _plot_url(plotting.plot_heading_error_time(
            t_arr, ekf_err_deg=heading_err, filename=f"ekf_heading_error_{ts}.png")),
        "covariance_innovations": _plot_url(plotting.plot_ekf_covariance_innovations(
            t_arr, P_diag_hist, nis_hist, filename=f"ekf_covariance_innovations_{ts}.png")),
        "map_trajectory": _plot_url(plotting.plot_magnetic_map_trajectories(
            mag_map, gt_xy, ekf_xy=est_xy, filename=f"ekf_map_trajectory_{ts}.png")),
    }

    logger.info(f"run-ekf complete: RMSE={rmse_pos:.2f} m, max_err={max_err:.2f} m")
    return {
        "output_path": npz_path,
        "plots": plot_paths,
        "metrics": {
            "rmse_position_m": rmse_pos,
            "max_position_error_m": max_err,
            "rmse_heading_deg": rmse_heading,
            **nis_stats,
        },
    }


@app.post("/run-pf")
def run_pf(req: RunPFRequest):
    try:
        (sensing, mag_map, t_arr, T, dt, gt_xy, gt_psi, imu, z_series, x0, P0
         ) = _run_filter_common(req, "pf")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    resample_thresh = req.resample_threshold if req.resample_threshold else req.n_particles / 2.0
    R = config.build_measurement_noise_R(req.measurement_noise_scale)
    sigma_meas = float(np.sqrt(R[0, 0]))
    pf = ParticleFilter(x0, P0, req.n_particles, mag_map, dt,
                         process_noise_scale=req.process_noise_scale,
                         sigma_meas=sigma_meas,
                         resample_threshold=resample_thresh)

    est_xy = np.zeros((T, 2))
    est_psi = np.zeros(T)
    for k in range(T):
        u = imu[k]
        pf.predict(u)
        est, n_eff, resampled = pf.update(z_series[k])
        est_xy[k] = est[:2]
        est_psi[k] = est[4]

    neff_hist = np.array(pf.history["N_eff"])
    resampled_hist = np.array(pf.history["resampled"])

    pos_err = metrics_utils.position_error_series(est_xy, gt_xy)
    heading_err = metrics_utils.heading_error_series(est_psi, gt_psi)

    rmse_pos = metrics_utils.position_rmse(est_xy, gt_xy)
    max_err = metrics_utils.max_position_error(est_xy, gt_xy)
    rmse_heading = metrics_utils.heading_rmse(est_psi, gt_psi)
    neff_summary = metrics_utils.neff_stats(neff_hist, resampled_hist)

    ts = int(time.time())
    npz_path = os.path.join(config.OUTPUT_DIR, f"pf_results_{ts}.npz")
    np.savez(npz_path, t=t_arr, est_xy=est_xy, est_psi=est_psi, gt_xy=gt_xy,
             gt_psi=gt_psi, N_eff=neff_hist, resampled=resampled_hist)

    _cleanup_old_plots([
        "pf_position_error_", "pf_heading_error_", "pf_neff_", "pf_map_trajectory_",
    ])
    plot_paths = {
        "position_error_time": _plot_url(plotting.plot_position_error_time(
            t_arr, pf_err=pos_err, filename=f"pf_position_error_{ts}.png")),
        "heading_error_time": _plot_url(plotting.plot_heading_error_time(
            t_arr, pf_err_deg=heading_err, filename=f"pf_heading_error_{ts}.png")),
        "neff_time": _plot_url(plotting.plot_pf_neff_time(
            t_arr, neff_hist, resampled_hist, filename=f"pf_neff_{ts}.png")),
        "map_trajectory": _plot_url(plotting.plot_magnetic_map_trajectories(
            mag_map, gt_xy, pf_xy=est_xy, filename=f"pf_map_trajectory_{ts}.png")),
    }

    logger.info(f"run-pf complete: RMSE={rmse_pos:.2f} m, max_err={max_err:.2f} m")
    return {
        "output_path": npz_path,
        "plots": plot_paths,
        "metrics": {
            "rmse_position_m": rmse_pos,
            "max_position_error_m": max_err,
            "rmse_heading_deg": rmse_heading,
            **neff_summary,
        },
    }


@app.post("/upload-map")
async def upload_map(file: UploadFile = File(...), resolution_m: float = Form(config.MAP_RESOLUTION_M)):
    dest_path = os.path.join(config.MAPS_DIR, file.filename)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        if file.filename.lower().endswith(".npy"):
            mag_map = MagneticMap.from_npy(dest_path, resolution_m=resolution_m)
        elif file.filename.lower().endswith(".csv"):
            mag_map = MagneticMap.from_csv_grid(dest_path, resolution_m=resolution_m)
        else:
            raise HTTPException(status_code=400, detail="Map file must be .npy or .csv")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse map file: {e}")

    logger.info(f"Uploaded custom map: {dest_path}, shape={mag_map.values.shape}")
    return {
        "status": "ok",
        "stored_path": dest_path,
        "shape": list(mag_map.values.shape),
        "extent_m": mag_map.extent(),
    }


@app.get("/metrics")
def get_metrics():
    output_files = os.listdir(config.OUTPUT_DIR)
    ekf_files = sorted([f for f in output_files if f.startswith("ekf_results_")])
    pf_files = sorted([f for f in output_files if f.startswith("pf_results_")])

    summary = {}

    if ekf_files:
        latest = np.load(os.path.join(config.OUTPUT_DIR, ekf_files[-1]))
        pos_err = metrics_utils.position_error_series(latest["est_xy"], latest["gt_xy"])
        summary["ekf"] = {
            "file": ekf_files[-1],
            "rmse_position_m": metrics_utils.position_rmse(latest["est_xy"], latest["gt_xy"]),
            "max_position_error_m": metrics_utils.max_position_error(latest["est_xy"], latest["gt_xy"]),
            "rmse_heading_deg": metrics_utils.heading_rmse(latest["est_psi"], latest["gt_psi"]),
            "convergence_time_s": metrics_utils.convergence_time(pos_err, config.DT),
            **metrics_utils.average_nis(latest["NIS"]),
        }

    if pf_files:
        latest = np.load(os.path.join(config.OUTPUT_DIR, pf_files[-1]))
        pos_err = metrics_utils.position_error_series(latest["est_xy"], latest["gt_xy"])
        summary["particle_filter"] = {
            "file": pf_files[-1],
            "rmse_position_m": metrics_utils.position_rmse(latest["est_xy"], latest["gt_xy"]),
            "max_position_error_m": metrics_utils.max_position_error(latest["est_xy"], latest["gt_xy"]),
            "rmse_heading_deg": metrics_utils.heading_rmse(latest["est_psi"], latest["gt_psi"]),
            "convergence_time_s": metrics_utils.convergence_time(pos_err, config.DT),
            **metrics_utils.neff_stats(latest["N_eff"], latest["resampled"]),
        }

    if not summary:
        return JSONResponse(status_code=404, content={"detail": "No EKF or PF runs found yet. Call /run-ekf or /run-pf first."})

    summary_path = os.path.join(config.OUTPUT_DIR, "metrics_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2, default=lambda o: None)

    return summary


@app.get("/plots")
def list_plots():
    if not os.path.isdir(config.PLOTS_DIR):
        return {"plots": []}
    files = sorted(os.listdir(config.PLOTS_DIR))
    plots = [
        {"filename": f, "url": _plot_url(f)}
        for f in files if f.lower().endswith(".png")
    ]
    return {"plots": plots}
