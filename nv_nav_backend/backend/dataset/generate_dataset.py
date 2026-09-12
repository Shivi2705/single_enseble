"""
generate_dataset.py

NOTE: The uploaded "datasets" attachment was empty on arrival (no
ground_truth_3600s.csv / dataset_metadata.json were actually present in the
upload). This script synthesizes both files using exactly the parameters
specified in the design report (Section 8: "Datasets and Parameters"), so the
rest of the pipeline has something concrete and physically consistent to run
against. It only needs to be run once; the backend treats its output as the
"already exists" dataset/ directory per the spec and does not modify it
afterwards.

Run:
    python generate_dataset.py
"""
import json
import numpy as np
import pandas as pd
import os

RNG = np.random.default_rng(42)

# ---------------------------------------------------------------------------
# Physical / sensor constants (Section 8.1, 8.2, 8.4 of the report)
# ---------------------------------------------------------------------------
D_ZFS_MHZ = 2870.08          # zero-field splitting
E_STRAIN_MHZ = 1.0           # strain splitting
GAMMA_NV_MHZ_PER_G = 2.802   # electron gyromagnetic ratio (MHz/Gauss), ~2pi*2.802 MHz/G convention
A_PAR_MHZ = -2.17
P_QUAD_MHZ = -4.95

# Four <111> NV axis unit vectors (tetrahedral diamond geometry)
NV_AXES = (1.0 / np.sqrt(3)) * np.array([
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
])

# IMU noise (Section 8.4) - representative consumer-grade MEMS IMU
ACCEL_NOISE_DENSITY_UG_SQRTHZ = 150.0   # micro-g / sqrt(Hz)
GYRO_NOISE_DENSITY_DPS_SQRTHZ = 0.01    # deg/s / sqrt(Hz)

# Simulation timing
DT = 1.0            # seconds
N_STEPS = 3600       # 1 hour @ 1 Hz
DOMAIN_M = 1000.0    # 1000 m x 1000 m domain

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def synthetic_magnetic_field(x, y):
    """A smooth synthetic magnetic-anomaly field (nT) over the domain, built
    from a handful of dipole-like Gaussian anomalies superimposed on a mild
    linear gradient (Earth-field-like background). Used as ground truth for
    both the map and the "true" field the trajectory experiences.
    Returns total field magnitude in nT (treated as a scalar map channel);
    the vector field for sensing purposes is derived elsewhere by adding a
    fixed background vector.
    """
    anomalies = [
        (250, 250, 400, 25000),
        (700, 800, 300, -18000),
        (500, 500, 600, 12000),
        (850, 150, 250, 20000),
        (150, 750, 350, -15000),
    ]
    b = 50000.0 + 0.01 * x - 0.005 * y  # background gradient, nT
    for (cx, cy, sigma, amp) in anomalies:
        b = b + amp * np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma ** 2)))
    return b


def generate_trajectory():
    """Generate a smooth, bounded ground-truth trajectory (figure-8-ish path)
    inside the 1000x1000 m domain, plus consistent velocity/heading/IMU
    channels."""
    t = np.arange(N_STEPS) * DT
    T = N_STEPS * DT

    cx, cy = DOMAIN_M / 2, DOMAIN_M / 2
    Rx, Ry = 350.0, 300.0
    omega = 2 * np.pi / T * 2  # 2 loops over the full run

    x = cx + Rx * np.sin(omega * t)
    y = cy + Ry * np.sin(2 * omega * t) / 2

    vx = np.gradient(x, DT)
    vy = np.gradient(y, DT)
    psi = np.unwrap(np.arctan2(vy, vx))

    ax_true = np.gradient(vx, DT)
    ay_true = np.gradient(vy, DT)
    omega_true = np.gradient(psi, DT)

    # IMU noise std (convert density -> per-sample std at DT sampling)
    fs = 1.0 / DT
    accel_std = ACCEL_NOISE_DENSITY_UG_SQRTHZ * 1e-6 * 9.80665 * np.sqrt(fs / 2)
    gyro_std = np.deg2rad(GYRO_NOISE_DENSITY_DPS_SQRTHZ) * np.sqrt(fs / 2)

    ax_meas = ax_true + RNG.normal(0, accel_std, N_STEPS)
    ay_meas = ay_true + RNG.normal(0, accel_std, N_STEPS)
    omega_meas = omega_true + RNG.normal(0, gyro_std, N_STEPS)

    # Ground-truth field vector at each position: background (world Bz-like
    # component folded into scalar map) + local anomaly used as B_z channel;
    # for a simple vector model we place the anomaly on B_z and give small
    # fixed Bx, By background components (Earth-field-like).
    bz = synthetic_magnetic_field(x, y)  # nT
    bx = 20000.0 * np.ones(N_STEPS)      # nT, fixed background
    by = -5000.0 * np.ones(N_STEPS)      # nT, fixed background

    df = pd.DataFrame({
        "t": t,
        "x_gt": x,
        "y_gt": y,
        "vx_gt": vx,
        "vy_gt": vy,
        "psi_gt": psi,
        "ax_imu": ax_meas,
        "ay_imu": ay_meas,
        "omega_imu": omega_meas,
        "Bx_gt_nT": bx,
        "By_gt_nT": by,
        "Bz_gt_nT": bz,
    })
    return df, accel_std, gyro_std


def main():
    df, accel_std, gyro_std = generate_trajectory()
    csv_path = os.path.join(OUT_DIR, "ground_truth_3600s.csv")
    df.to_csv(csv_path, index=False)

    metadata = {
        "dt": DT,
        "n_steps": N_STEPS,
        "domain_m": DOMAIN_M,
        "nv_axes": NV_AXES.tolist(),
        "D_zfs_mhz": D_ZFS_MHZ,
        "E_strain_mhz": E_STRAIN_MHZ,
        "gamma_e_mhz_per_g": GAMMA_NV_MHZ_PER_G,
        "A_par_mhz": A_PAR_MHZ,
        "P_quad_mhz": P_QUAD_MHZ,
        "imu_noise": {
            "accel_noise_density_ug_sqrtHz": ACCEL_NOISE_DENSITY_UG_SQRTHZ,
            "gyro_noise_density_dps_sqrtHz": GYRO_NOISE_DENSITY_DPS_SQRTHZ,
            "accel_std_per_sample_mps2": float(accel_std),
            "gyro_std_per_sample_radps": float(gyro_std),
        },
        "linewidth_mhz_range": [1.0, 5.0],
        "contrast_range": [0.05, 0.30],
        "map_resolution_m": 10.0,
        "notes": (
            "Synthesized locally per Section 8 of the design report because "
            "the uploaded dataset attachment was empty; not real survey data."
        ),
    }
    meta_path = os.path.join(OUT_DIR, "dataset_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Wrote {csv_path} ({len(df)} rows)")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
