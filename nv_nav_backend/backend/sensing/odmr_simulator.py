"""
odmr_simulator.py

Implements Eq. 1: Lorentzian line-shape forward model for an ODMR spectrum,
and generates synthetic spectra (with shot noise) from a known ground-truth
magnetic field, for a given NV axis and frequency sweep window.

    I_model(f) = I0 - sum_k C_k * (w_k/2)^2 / ((f - f_k)^2 + (w_k/2)^2)

Each NV axis produces two resonance dips (f+, f-) around the zero-field
splitting D, split symmetrically by the Zeeman term (Eq. 3, inverted here to
place the peaks at the correct simulated locations).
"""
import numpy as np

from config import D_ZFS_MHZ, GAMMA_E_MHZ_PER_G


def lorentzian_multi_dip(f, I0, peaks):
    """Eq. 1: I0 minus a sum of Lorentzian dips.

    peaks: list of (C_k, f_k, w_k) tuples (contrast, center freq MHz, linewidth MHz)
    """
    I = np.full_like(f, I0, dtype=float)
    for (C_k, f_k, w_k) in peaks:
        I = I - C_k * (w_k / 2.0) ** 2 / ((f - f_k) ** 2 + (w_k / 2.0) ** 2)
    return I


def zeeman_forward(B_parallel_gauss):
    """Inverse of Eq. 3, used only to *place* simulated peaks:
    given a scalar projected field B_parallel (Gauss) along one NV axis,
    return the (f_minus, f_plus) resonance frequencies (MHz) around D.
    f_plus - f_minus = 2 * gamma_e * B_parallel  (Eq. 3, solved for splitting)
    """
    splitting = 2.0 * GAMMA_E_MHZ_PER_G * B_parallel_gauss
    f_plus = D_ZFS_MHZ + splitting / 2.0
    f_minus = D_ZFS_MHZ - splitting / 2.0
    return f_minus, f_plus


def simulate_spectrum(B_parallel_gauss, f_sweep=None, contrast=0.15,
                       linewidth_mhz=2.5, I0=1.0, shot_noise_std=0.003,
                       rng=None):
    """Generate one synthetic ODMR spectrum for a single NV axis given the
    true scalar field projection along that axis (Gauss).

    Returns (f_sweep, I_meas, true_peaks) where true_peaks = (f_minus, f_plus).
    """
    if rng is None:
        rng = np.random.default_rng()
    if f_sweep is None:
        f_sweep = np.linspace(D_ZFS_MHZ - 60, D_ZFS_MHZ + 60, 400)

    f_minus, f_plus = zeeman_forward(B_parallel_gauss)
    peaks = [(contrast, f_minus, linewidth_mhz), (contrast, f_plus, linewidth_mhz)]
    I_clean = lorentzian_multi_dip(f_sweep, I0, peaks)
    I_meas = I_clean + rng.normal(0, shot_noise_std, size=f_sweep.shape)
    return f_sweep, I_meas, (f_minus, f_plus)
