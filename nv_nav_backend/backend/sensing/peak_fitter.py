"""
peak_fitter.py

Implements Eq. 2: Nonlinear least-squares fit of the measured ODMR spectrum
to the Lorentzian forward model (Eq. 1), extracting best-fit resonance
frequencies f*_k (and contrast/linewidth/baseline as nuisance parameters).

    {I0*, Ck*, fk*, wk*} = argmin sum_f [I_meas(f) - I_model(f)]^2

Uses scipy.optimize.curve_fit (Levenberg-Marquardt).
"""
import numpy as np
from scipy.optimize import curve_fit

from config import D_ZFS_MHZ


def _two_dip_model(f, I0, C1, f1, w1, C2, f2, w2):
    """Two-Lorentzian-dip model used for the fit (Eq. 1 specialized to K=2,
    one dip below D and one above D)."""
    I = I0
    I = I - C1 * (w1 / 2.0) ** 2 / ((f - f1) ** 2 + (w1 / 2.0) ** 2)
    I = I - C2 * (w2 / 2.0) ** 2 / ((f - f2) ** 2 + (w2 / 2.0) ** 2)
    return I


def fit_two_dip_spectrum(f_sweep, I_meas, f_guess_minus=None, f_guess_plus=None,
                          contrast_guess=0.15, linewidth_guess=2.5, I0_guess=1.0):
    """Eq. 2: Nonlinear least-squares fit of a two-dip ODMR spectrum.

    Returns dict with fitted center frequencies f_minus*, f_plus*, and other
    fitted nuisance parameters, plus 1-sigma parameter uncertainties from the
    fit covariance (used to build measurement-noise estimates downstream).
    """
    if f_guess_minus is None:
        f_guess_minus = D_ZFS_MHZ - 10
    if f_guess_plus is None:
        f_guess_plus = D_ZFS_MHZ + 10

    p0 = [I0_guess, contrast_guess, f_guess_minus, linewidth_guess,
          contrast_guess, f_guess_plus, linewidth_guess]

    bounds_lo = [0.5, 0.0, f_sweep.min(), 0.1, 0.0, f_sweep.min(), 0.1]
    bounds_hi = [1.5, 1.0, f_sweep.max(), 20.0, 1.0, f_sweep.max(), 20.0]

    try:
        popt, pcov = curve_fit(
            _two_dip_model, f_sweep, I_meas, p0=p0,
            bounds=(bounds_lo, bounds_hi), maxfev=20000,
        )
        perr = np.sqrt(np.clip(np.diag(pcov), 0, None))
    except Exception as e:
        # Fall back to the initial guess if the fit fails to converge;
        # flagged via fit_ok=False so callers can handle/skip this sample.
        popt = np.array(p0)
        perr = np.full_like(popt, np.nan)
        return {
            "I0": popt[0], "C_minus": popt[1], "f_minus": popt[2], "w_minus": popt[3],
            "C_plus": popt[4], "f_plus": popt[5], "w_plus": popt[6],
            "sigma_f_minus": np.nan, "sigma_f_plus": np.nan,
            "fit_ok": False, "error": str(e),
        }

    I0, C1, f1, w1, C2, f2, w2 = popt
    sI0, sC1, sf1, sw1, sC2, sf2, sw2 = perr

    # Ensure ordering: "minus" is the lower-frequency dip.
    if f1 <= f2:
        f_minus, f_plus = f1, f2
        s_minus, s_plus = sf1, sf2
    else:
        f_minus, f_plus = f2, f1
        s_minus, s_plus = sf2, sf1

    return {
        "I0": I0, "C_minus": C1, "f_minus": f_minus, "w_minus": w1,
        "C_plus": C2, "f_plus": f_plus, "w_plus": w2,
        "sigma_f_minus": s_minus, "sigma_f_plus": s_plus,
        "fit_ok": True, "error": None,
    }
