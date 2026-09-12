"""
plotting.py

Publication-quality plotting helpers (Matplotlib + Seaborn style), each
saving a PNG at >=300 dpi into output/plots/, per the spec's "Required
plots" section.
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    plt.style.use("seaborn-v0_8-darkgrid")
except Exception:
    pass

from config import PLOTS_DIR, ON_VERCEL
from sensing.odmr_simulator import lorentzian_multi_dip


def _save(fig, filename):
    """Save a figure and return whatever a caller should treat as this
    plot's location: a local filesystem path normally, or a public Vercel
    Blob URL when running on Vercel (where local files don't persist and
    can't be served back to the browser on a later request)."""
    if ON_VERCEL:
        import io
        import vercel_blob

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=300)
        plt.close(fig)
        buf.seek(0)
        resp = vercel_blob.put(f"plots/{filename}", buf.read(),
                                {"access": "public", "addRandomSuffix": "false"})
        return resp["url"]
    else:
        path = os.path.join(PLOTS_DIR, filename)
        fig.savefig(path, dpi=300)
        plt.close(fig)
        return path


def plot_odmr_fit_examples(examples, filename="odmr_fit_examples.png"):
    """examples: list of dicts with keys:
        t, f_sweep, I_meas, fit (dict from peak_fitter output)
    """
    n = len(examples)
    fig, axes = plt.subplots(1, n, figsize=(5 * n, 4), squeeze=False)
    axes = axes[0]
    for ax, ex in zip(axes, examples):
        f = ex["f_sweep"]
        ax.plot(f, ex["I_meas"], ".", ms=2, alpha=0.5, label="Measured")
        fit = ex["fit"]
        if fit.get("fit_ok", False):
            peaks = [(fit["C_minus"], fit["f_minus"], fit["w_minus"]),
                     (fit["C_plus"], fit["f_plus"], fit["w_plus"])]
            I_fit = lorentzian_multi_dip(f, fit["I0"], peaks)
            ax.plot(f, I_fit, "-", lw=2, color="crimson", label="Lorentzian fit")
            ax.axvline(fit["f_minus"], color="gray", ls="--", lw=1)
            ax.axvline(fit["f_plus"], color="gray", ls="--", lw=1)
            ax.annotate(f"f-={fit['f_minus']:.2f} MHz", (fit["f_minus"], 0.6),
                        rotation=90, fontsize=8, va="bottom")
            ax.annotate(f"f+={fit['f_plus']:.2f} MHz", (fit["f_plus"], 0.6),
                        rotation=90, fontsize=8, va="bottom")
        ax.set_title(f"t = {ex['t']} s")
        ax.set_xlabel("Frequency (MHz)")
        ax.set_ylabel("Normalized fluorescence")
        ax.legend(fontsize=8)
    fig.tight_layout()
    return _save(fig, filename)


def plot_magnetic_map_trajectories(mag_map, gt_xy, ekf_xy=None, pf_xy=None,
                                    filename="magnetic_map_trajectories.png"):
    fig, ax = plt.subplots(figsize=(7, 6))
    extent = mag_map.extent()
    im = ax.imshow(mag_map.values.T, origin="lower", extent=extent,
                    cmap="viridis", aspect="auto")
    cbar = fig.colorbar(im, ax=ax)
    cbar.set_label("|B| (nT)")

    gt_xy = np.asarray(gt_xy)
    ax.plot(gt_xy[:, 0], gt_xy[:, 1], color="white", lw=2, label="Ground truth")
    if ekf_xy is not None:
        ekf_xy = np.asarray(ekf_xy)
        ax.plot(ekf_xy[:, 0], ekf_xy[:, 1], color="orange", lw=1.5, ls="--", label="EKF estimate")
    if pf_xy is not None:
        pf_xy = np.asarray(pf_xy)
        ax.plot(pf_xy[:, 0], pf_xy[:, 1], color="red", lw=1.5, ls=":", label="PF estimate")

    ax.set_xlabel("x (m)")
    ax.set_ylabel("y (m)")
    ax.set_title("Magnetic map with trajectories")
    ax.legend()
    fig.tight_layout()
    return _save(fig, filename)


def plot_position_error_time(t, ekf_err=None, pf_err=None,
                              filename="position_error_time.png"):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    if ekf_err is not None:
        ax.plot(t, ekf_err, label="EKF", color="orange")
    if pf_err is not None:
        ax.plot(t, pf_err, label="Particle filter", color="red")
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Position error ||r_est - r_gt|| (m)")
    ax.set_title("Position error over time")
    ax.legend()
    fig.tight_layout()
    return _save(fig, filename)


def plot_heading_error_time(t, ekf_err_deg=None, pf_err_deg=None,
                             filename="heading_error_time.png"):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    if ekf_err_deg is not None:
        ax.plot(t, ekf_err_deg, label="EKF", color="orange")
    if pf_err_deg is not None:
        ax.plot(t, pf_err_deg, label="Particle filter", color="red")
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Heading error (deg)")
    ax.set_title("Heading error over time")
    ax.legend()
    fig.tight_layout()
    return _save(fig, filename)


def plot_ekf_covariance_innovations(t, P_diag_history, nis_series,
                                     chi2_threshold=3.84,
                                     filename="ekf_covariance_innovations.png"):
    P_diag_history = np.asarray(P_diag_history)
    fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)

    axes[0].plot(t, np.sqrt(P_diag_history[:, 0]), label=r"$\sqrt{P_{xx}}$")
    axes[0].plot(t, np.sqrt(P_diag_history[:, 1]), label=r"$\sqrt{P_{yy}}$")
    axes[0].set_ylabel("Position std (m)")
    axes[0].set_title("EKF position covariance")
    axes[0].legend()

    axes[1].plot(t, nis_series, label="NIS", color="teal")
    axes[1].axhline(chi2_threshold, color="crimson", ls="--",
                     label=f"chi2 threshold ({chi2_threshold})")
    axes[1].set_xlabel("Time (s)")
    axes[1].set_ylabel("NIS")
    axes[1].set_title("Normalized innovation squared")
    axes[1].legend()

    fig.tight_layout()
    return _save(fig, filename)


def plot_pf_neff_time(t, neff_series, resampled_series,
                       filename="pf_neff_time.png"):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.plot(t, neff_series, color="purple", label="N_eff")
    resampled_series = np.asarray(resampled_series, dtype=bool)
    t = np.asarray(t)
    for tt in t[resampled_series]:
        ax.axvline(tt, color="gray", alpha=0.15, lw=1)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Effective sample size")
    ax.set_title("Particle filter N_eff and resampling events")
    ax.legend()
    fig.tight_layout()
    return _save(fig, filename)


def plot_rmse_vs_axis_count(axis_counts, rmse_values,
                             filename="rmse_vs_axis_count.png"):
    fig, ax = plt.subplots(figsize=(6, 4.5))
    ax.bar([str(a) for a in axis_counts], rmse_values, color="steelblue")
    ax.set_xlabel("NV axis count")
    ax.set_ylabel("Position RMSE (m)")
    ax.set_title("RMSE vs. axis count")
    fig.tight_layout()
    return _save(fig, filename)
