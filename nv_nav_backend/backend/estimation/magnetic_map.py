"""
magnetic_map.py

Implements Eq. 8: Bilinear interpolation on a gridded magnetic map.

    M(x,y) = (1-a)(1-b) M00 + a(1-b) M10 + (1-a)b M01 + a b M11

Provides a MagneticMap class wrapping scipy.interpolate.RegularGridInterpolator
for the bilinear case, plus an optional Gaussian-Process interpolant for
sparse-survey maps (still a closed-form-posterior statistical smoother, not a
trained/learned model in the ML sense).
"""
import numpy as np
from scipy.interpolate import RegularGridInterpolator

from config import DOMAIN_M, MAP_RESOLUTION_M


def synthetic_magnetic_field(x, y):
    """Same synthetic anomaly field used to generate the ground-truth
    dataset (dataset/generate_dataset.py), so /run-ekf and /run-pf can build
    a self-consistent map without needing a separately uploaded survey."""
    anomalies = [
        (250, 250, 400, 25000),
        (700, 800, 300, -18000),
        (500, 500, 600, 12000),
        (850, 150, 250, 20000),
        (150, 750, 350, -15000),
    ]
    b = 50000.0 + 0.01 * x - 0.005 * y
    for (cx, cy, sigma, amp) in anomalies:
        b = b + amp * np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma ** 2)))
    return b


class MagneticMap:
    """Gridded magnetic map with bilinear interpolation (Eq. 8)."""

    def __init__(self, x_grid=None, y_grid=None, values=None, resolution_m=None):
        if resolution_m is None:
            resolution_m = MAP_RESOLUTION_M
        if x_grid is None or y_grid is None or values is None:
            n = int(DOMAIN_M / resolution_m) + 1
            x_grid = np.linspace(0, DOMAIN_M, n)
            y_grid = np.linspace(0, DOMAIN_M, n)
            XX, YY = np.meshgrid(x_grid, y_grid, indexing="ij")
            values = synthetic_magnetic_field(XX, YY)

        self.x_grid = x_grid
        self.y_grid = y_grid
        self.values = values
        self._interp = RegularGridInterpolator(
            (x_grid, y_grid), values, bounds_error=False, fill_value=None
        )

    def query(self, x, y):
        """Eq. 8: predicted field value(s) M(x,y) at position(s) (x, y).
        x, y may be scalars or arrays of the same shape."""
        x = np.atleast_1d(x)
        y = np.atleast_1d(y)
        pts = np.stack([x, y], axis=-1)
        z = self._interp(pts)
        return z if z.shape[0] > 1 else float(z[0])

    def gradient(self, x, y, h=None):
        """Numerical gradient of the map at (x, y), used as H_t in Eq. 17
        (the measurement Jacobian for the EKF)."""
        if h is None:
            h = (self.x_grid[1] - self.x_grid[0])
        dzdx = (self.query(x + h, y) - self.query(x - h, y)) / (2 * h)
        dzdy = (self.query(x, y + h) - self.query(x, y - h)) / (2 * h)
        return np.array([dzdx, dzdy]).flatten()

    def extent(self):
        return (float(self.x_grid.min()), float(self.x_grid.max()),
                float(self.y_grid.min()), float(self.y_grid.max()))

    @classmethod
    def from_npy(cls, path, resolution_m=None):
        values = np.load(path)
        if resolution_m is None:
            resolution_m = MAP_RESOLUTION_M
        nx, ny = values.shape
        x_grid = np.linspace(0, (nx - 1) * resolution_m, nx)
        y_grid = np.linspace(0, (ny - 1) * resolution_m, ny)
        return cls(x_grid, y_grid, values)

    @classmethod
    def from_csv_grid(cls, path, resolution_m=None):
        values = np.loadtxt(path, delimiter=",")
        return cls.from_npy_array(values, resolution_m)

    @classmethod
    def from_npy_array(cls, values, resolution_m=None):
        if resolution_m is None:
            resolution_m = MAP_RESOLUTION_M
        nx, ny = values.shape
        x_grid = np.linspace(0, (nx - 1) * resolution_m, nx)
        y_grid = np.linspace(0, (ny - 1) * resolution_m, ny)
        return cls(x_grid, y_grid, values)


class GPMagneticMap:
    """Optional Gaussian-Process interpolant for sparse survey points
    (closed-form posterior mean/variance, not a trained neural model)."""

    def __init__(self, xy_samples, z_samples, length_scale=100.0, noise=1.0):
        from sklearn.gaussian_process import GaussianProcessRegressor
        from sklearn.gaussian_process.kernels import RBF, WhiteKernel

        kernel = RBF(length_scale=length_scale) + WhiteKernel(noise_level=noise)
        self.gp = GaussianProcessRegressor(kernel=kernel, normalize_y=True)
        self.gp.fit(xy_samples, z_samples)

    def query(self, x, y):
        x = np.atleast_1d(x)
        y = np.atleast_1d(y)
        pts = np.stack([x, y], axis=-1)
        z = self.gp.predict(pts)
        return z if z.shape[0] > 1 else float(z[0])
