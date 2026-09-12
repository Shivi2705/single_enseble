"""
correlation_matcher.py

Implements:
  Eq. 9  - Windowed matching error:   E(r) = sum_t [m_t - M_hat_t(r)]^2
  Eq. 10 - Best-position selection:   r_hat = argmin_r E(r)

Used to produce a coarse initial position estimate r_init that seeds the
EKF (Eq. 11) or the particle filter's initial spread (Eq. 20), by grid-
searching candidate anchor positions and, for each, comparing a short window
of real measurements against the map values predicted along the (IMU-
dictated) relative displacement from that anchor.
"""
import numpy as np

from estimation.magnetic_map import MagneticMap


def correlation_init(measurements, rel_positions, mag_map: MagneticMap,
                      grid_step=20.0, domain=None):
    """Eq. 9-10: coarse position initializer.

    measurements  : array (T_w,) of real scalar/field-magnitude measurements m_t
    rel_positions : array (T_w, 2) of relative (dx, dy) displacements from an
                    unknown anchor position, integrated from the IMU over the
                    matching window.
    mag_map       : MagneticMap to query predicted values.
    grid_step     : spacing (m) of the candidate-anchor search grid.
    domain        : (xmin, xmax, ymin, ymax); defaults to the map's extent.

    Returns dict: r_hat (2,), and the full error surface for diagnostics.
    """
    if domain is None:
        domain = mag_map.extent()
    xmin, xmax, ymin, ymax = domain

    xs = np.arange(xmin, xmax, grid_step)
    ys = np.arange(ymin, ymax, grid_step)

    best_E = np.inf
    best_r = np.array([(xmin + xmax) / 2, (ymin + ymax) / 2])
    E_surface = np.zeros((len(xs), len(ys)))

    rel = np.asarray(rel_positions)
    m = np.asarray(measurements)

    for i, rx in enumerate(xs):
        for j, ry in enumerate(ys):
            cand_x = rx + rel[:, 0]
            cand_y = ry + rel[:, 1]
            m_hat = mag_map.query(cand_x, cand_y)
            m_hat = np.atleast_1d(m_hat)
            E = np.sum((m - m_hat) ** 2)  # Eq. 9
            E_surface[i, j] = E
            if E < best_E:
                best_E = E
                best_r = np.array([rx, ry])  # Eq. 10 running argmin

    return {
        "r_init": best_r,
        "E_min": float(best_E),
        "E_surface": E_surface,
        "x_grid": xs,
        "y_grid": ys,
    }
