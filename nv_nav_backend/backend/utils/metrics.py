"""
metrics.py

Computes evaluation metrics used in /metrics and reported in
output/metrics_summary.json.
"""
import numpy as np


def position_rmse(est_xy, gt_xy):
    """RMSE_r = sqrt(mean(||r_hat_t - r_t_gt||^2))"""
    est_xy = np.asarray(est_xy)
    gt_xy = np.asarray(gt_xy)
    err = np.linalg.norm(est_xy - gt_xy, axis=1)
    return float(np.sqrt(np.mean(err ** 2)))


def max_position_error(est_xy, gt_xy):
    est_xy = np.asarray(est_xy)
    gt_xy = np.asarray(gt_xy)
    err = np.linalg.norm(est_xy - gt_xy, axis=1)
    return float(np.max(err))


def position_error_series(est_xy, gt_xy):
    est_xy = np.asarray(est_xy)
    gt_xy = np.asarray(gt_xy)
    return np.linalg.norm(est_xy - gt_xy, axis=1)


def heading_rmse(est_psi, gt_psi, degrees=True):
    """Heading RMSE, properly wrapping angle differences to (-pi, pi]."""
    est_psi = np.asarray(est_psi)
    gt_psi = np.asarray(gt_psi)
    diff = np.arctan2(np.sin(est_psi - gt_psi), np.cos(est_psi - gt_psi))
    rmse_rad = np.sqrt(np.mean(diff ** 2))
    return float(np.degrees(rmse_rad)) if degrees else float(rmse_rad)


def heading_error_series(est_psi, gt_psi, degrees=True):
    est_psi = np.asarray(est_psi)
    gt_psi = np.asarray(gt_psi)
    diff = np.arctan2(np.sin(est_psi - gt_psi), np.cos(est_psi - gt_psi))
    return np.degrees(diff) if degrees else diff


def convergence_time(error_series, dt, threshold=10.0):
    """Time (s) until position error first falls below `threshold` and stays
    there, starting from a (deliberately poor) initialization. Returns None
    if it never converges."""
    error_series = np.asarray(error_series)
    below = error_series < threshold
    for i in range(len(below)):
        if below[i:].all():
            return float(i * dt)
    return None


def average_nis(nis_series, state_meas_dim=1):
    """Average normalized innovation squared, compared to the theoretical
    chi-squared mean (= measurement dimension) for filter consistency."""
    nis_series = np.asarray(nis_series)
    return {
        "mean_NIS": float(np.mean(nis_series)),
        "theoretical_chi2_mean": float(state_meas_dim),
        "std_NIS": float(np.std(nis_series)),
    }


def neff_stats(neff_series, resampled_series):
    neff_series = np.asarray(neff_series)
    resampled_series = np.asarray(resampled_series)
    return {
        "mean_Neff": float(np.mean(neff_series)),
        "min_Neff": float(np.min(neff_series)),
        "std_Neff": float(np.std(neff_series)),
        "resampling_rate": float(np.mean(resampled_series)),
    }
