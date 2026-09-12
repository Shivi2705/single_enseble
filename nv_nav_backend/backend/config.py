"""
config.py

Loads dataset/dataset_metadata.json and exposes constants, paths, and
IMU noise covariance builders used throughout the sensing/estimation layers.
"""
import json
import os
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
METADATA_JSON = os.path.join(DATASET_DIR, "dataset_metadata.json")
GROUND_TRUTH_CSV = os.path.join(DATASET_DIR, "ground_truth_3600s.csv")

# Vercel Functions ship a read-only filesystem except for /tmp, and /tmp is
# not guaranteed to persist between invocations (each may land on a
# different instance). ON_VERCEL is true whenever this is running as a
# Vercel Function (Vercel sets VERCEL=1 automatically) -- in that case we
# write npz/map files to /tmp (fine, they're only read back within the same
# request) and route generated plots through Vercel Blob storage instead of
# a local static mount (see utils/plotting.py). Locally / on a normal host
# (Render, Railway, a VM, etc.) everything still lives under backend/output
# exactly as before.
ON_VERCEL = bool(os.environ.get("VERCEL"))

if ON_VERCEL:
    OUTPUT_DIR = os.path.join("/tmp", "output")
    MAPS_DIR = os.path.join("/tmp", "maps")
else:
    OUTPUT_DIR = os.path.join(BASE_DIR, "output")
    MAPS_DIR = os.path.join(BASE_DIR, "maps")
PLOTS_DIR = os.path.join(OUTPUT_DIR, "plots")

for d in (OUTPUT_DIR, PLOTS_DIR, MAPS_DIR):
    os.makedirs(d, exist_ok=True)

# Vercel Blob store to persist plot PNGs across requests/instances. Only
# used when ON_VERCEL; requires a Blob store connected to the project
# (adds BLOB_READ_WRITE_TOKEN automatically -- see deployment notes).
BLOB_READ_WRITE_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")


def load_metadata():
    with open(METADATA_JSON, "r") as f:
        return json.load(f)


METADATA = load_metadata()

DT = METADATA["dt"]
N_STEPS = METADATA["n_steps"]
DOMAIN_M = METADATA["domain_m"]
NV_AXES = np.array(METADATA["nv_axes"])  # shape (4, 3), fixed <111> directions
D_ZFS_MHZ = METADATA["D_zfs_mhz"]
E_STRAIN_MHZ = METADATA["E_strain_mhz"]
GAMMA_E_MHZ_PER_G = METADATA["gamma_e_mhz_per_g"]
LINEWIDTH_RANGE = METADATA["linewidth_mhz_range"]
CONTRAST_RANGE = METADATA["contrast_range"]
MAP_RESOLUTION_M = METADATA["map_resolution_m"]

_imu = METADATA["imu_noise"]
ACCEL_STD = _imu["accel_std_per_sample_mps2"]
GYRO_STD = _imu["gyro_std_per_sample_radps"]


def build_process_noise_Q(process_noise_scale: float = 1.0, dt: float = None):
    """Build the process-noise covariance Q_t for state x = [x, y, vx, vy, psi]
    (Eq. 15 input), derived from IMU accel/gyro noise densities loaded from
    dataset_metadata.json. Discretized with a simple piecewise-constant
    acceleration / constant-turn-rate assumption over one timestep dt.
    """
    if dt is None:
        dt = DT
    s = process_noise_scale
    sigma_a = ACCEL_STD * s
    sigma_g = GYRO_STD * s

    # Position noise driven by acceleration noise integrated twice; velocity
    # noise driven by acceleration noise integrated once; heading noise
    # driven directly by gyro noise integrated once.
    q_pos = (sigma_a ** 2) * (dt ** 4) / 4.0
    q_pos_vel = (sigma_a ** 2) * (dt ** 3) / 2.0
    q_vel = (sigma_a ** 2) * (dt ** 2)
    q_psi = (sigma_g ** 2) * (dt ** 2)

    Q = np.zeros((5, 5))
    # x block
    Q[0, 0] = q_pos
    Q[0, 2] = q_pos_vel
    Q[2, 0] = q_pos_vel
    Q[2, 2] = q_vel
    # y block
    Q[1, 1] = q_pos
    Q[1, 3] = q_pos_vel
    Q[3, 1] = q_pos_vel
    Q[3, 3] = q_vel
    # heading
    Q[4, 4] = q_psi
    return Q


def build_measurement_noise_R(measurement_noise_scale: float = 1.0, n_channels: int = 1):
    """Measurement-noise covariance R_t (Eq. 17 input), for the magnetic
    measurement(s) fed to the filter. Traceable in magnitude to the peak-fit
    frequency uncertainty (Eq. 2) propagated through the Zeeman relation
    (Eq. 3): sigma_B = sigma_f / (sqrt(2) * gamma_e).
    """
    sigma_f_mhz = 0.02  # representative sub-linewidth peak-fit precision (MHz)
    sigma_B_gauss = sigma_f_mhz / (np.sqrt(2) * GAMMA_E_MHZ_PER_G)
    sigma_B_nT = sigma_B_gauss * 1e5  # 1 G = 1e5 nT
    sigma = sigma_B_nT * measurement_noise_scale
    return (sigma ** 2) * np.eye(n_channels)
