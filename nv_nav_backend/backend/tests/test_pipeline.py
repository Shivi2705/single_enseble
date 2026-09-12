"""
test_pipeline.py

Basic sanity tests: loads metadata, runs a short (100-step) EKF and PF,
checks output shapes and finite values.
"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from main import RunEKFRequest, RunPFRequest, run_ekf, run_pf


def test_metadata_loads():
    assert config.N_STEPS == 3600
    assert config.NV_AXES.shape == (4, 3)
    assert config.DT > 0


def test_ekf_short_run():
    req = RunEKFRequest(axis_count=4, use_correlation_init=False, n_steps=100)
    result = run_ekf(req)
    assert "metrics" in result
    assert np.isfinite(result["metrics"]["rmse_position_m"])
    assert np.isfinite(result["metrics"]["max_position_error_m"])
    data = np.load(result["output_path"])
    assert data["est_xy"].shape == (100, 2)
    assert np.all(np.isfinite(data["est_xy"]))


def test_pf_short_run():
    req = RunPFRequest(axis_count=3, n_particles=200, use_correlation_init=False, n_steps=100)
    result = run_pf(req)
    assert "metrics" in result
    assert np.isfinite(result["metrics"]["rmse_position_m"])
    data = np.load(result["output_path"])
    assert data["est_xy"].shape == (100, 2)
    assert np.all(np.isfinite(data["est_xy"]))
    assert np.all(data["N_eff"] > 0)


if __name__ == "__main__":
    test_metadata_loads()
    test_ekf_short_run()
    test_pf_short_run()
    print("All tests passed.")
