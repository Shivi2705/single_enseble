"""
field_solver.py

Implements:
  Eq. 3  - Zeeman splitting inversion:      B_parallel,i = (f+_i - f-_i) / (2 * gamma_e)
  Eq. 4  - Linear projection system:        b = N B
  Eq. 5  - Least-squares vector solution:   B_hat = (N^T N)^-1 N^T b   (or weighted)
  Eq. 6a - Orientation determination (assumed known/given here; see note)
  Eq. 6b - Single-axis scalar projection:   B_parallel(t) = B(t) . n_NV

All outputs are in Gauss unless otherwise noted; conversion to nT happens at
the call site where needed (1 G = 1e5 nT).
"""
import numpy as np

from config import GAMMA_E_MHZ_PER_G, NV_AXES


def zeeman_inversion(f_minus, f_plus, gamma_e_mhz_per_g=None):
    """Eq. 3: scalar field projection B_parallel,i (Gauss) along one NV axis,
    from the paired resonance frequencies f-_i, f+_i (MHz). Calibration-free:
    the common-mode offset (D, strain) cancels in the difference.
    """
    if gamma_e_mhz_per_g is None:
        gamma_e_mhz_per_g = GAMMA_E_MHZ_PER_G
    return (f_plus - f_minus) / (2.0 * gamma_e_mhz_per_g)


def vector_reconstruction(b_parallel, axes=None, weights=None):
    """Eq. 4-5: reconstruct the full field vector B_hat (body frame, Gauss)
    from n >= 3 scalar projections b_parallel along known NV axis directions.

    b_parallel : array (n,) of scalar projections (Eq. 3 outputs)
    axes       : array (n, 3) of unit vectors (subset of the 4 <111> axes)
    weights    : optional array (n,) of per-axis weights (e.g. 1/sigma^2 from
                 the peak-fit uncertainty), used for weighted least squares.

    Returns B_hat (3,) in Gauss.
    """
    if axes is None:
        axes = NV_AXES
    b = np.asarray(b_parallel).reshape(-1, 1)   # (n, 1)  -- Eq. 4
    N = np.asarray(axes)                        # (n, 3)  -- Eq. 4

    if weights is not None:
        try:
            W = np.diag(weights)
            NT_W = N.T @ W
            B_hat = np.linalg.solve(NT_W @ N, NT_W @ b)  # Eq. 5, weighted
        except np.linalg.LinAlgError:
            # Fall back to unweighted least-squares if the weighted normal
            # equations are ill-conditioned/singular (e.g. near-zero weight
            # from an unusually confident but degenerate fit).
            B_hat, *_ = np.linalg.lstsq(N, b, rcond=None)
    else:
        B_hat, *_ = np.linalg.lstsq(N, b, rcond=None)  # Eq. 5

    return B_hat.flatten()


def condition_number(axes=None):
    """Reports cond(N), quantifying how axis geometry amplifies per-axis
    noise into vector-estimate noise (Section 5.2 of the report)."""
    if axes is None:
        axes = NV_AXES
    return np.linalg.cond(np.asarray(axes))


def single_axis_projection(B_vec, n_NV):
    """Eq. 6b: scalar projection of the true field onto a single, known NV
    axis direction (used when axis_count == 1)."""
    return float(np.dot(B_vec, n_NV))


def body_to_world(B_body_xy, psi):
    """Eq. 7: rotate a 2D body-frame field component into the world frame
    using the current heading estimate psi (radians).

        B_world = R(psi) B_body,  R(psi) = [[cos psi, -sin psi],
                                              [sin psi,  cos psi]]
    """
    c, s = np.cos(psi), np.sin(psi)
    R = np.array([[c, -s], [s, c]])
    return R @ np.asarray(B_body_xy)
