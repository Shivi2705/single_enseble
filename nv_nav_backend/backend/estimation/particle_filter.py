"""
particle_filter.py

Implements the Sampling-Importance-Resampling (SIR) particle filter,
Eq. 20-24:

  Eq. 20  Particle prediction:     x_t^(i) = f(x_{t-1}^(i), u_t) + w_t^(i)
  Eq. 21  Importance weight:       w_t^(i) ~ w_{t-1}^(i) * exp(-(z_t - M(x^(i)))^2 / (2 sigma^2))
  Eq. 22  Normalization:           w_t^(i) <- w_t^(i) / sum_j w_t^(j)
  Eq. 23  Effective sample size:   N_eff = 1 / sum_i (w_t^(i))^2 ; resample if N_eff < N_thresh
  Eq. 24  Weighted estimate:       r_hat_t = sum_i w_t^(i) x_t^(i)

Vectorized over particles (state array shape (N, 5): [x, y, vx, vy, psi]).
"""
import numpy as np

from config import build_process_noise_Q
from estimation.magnetic_map import MagneticMap


class ParticleFilter:
    def __init__(self, x0_mean, x0_cov, n_particles, mag_map: MagneticMap, dt,
                 process_noise_scale=1.0, sigma_meas=50.0,
                 resample_threshold=None, rng=None):
        self.N = n_particles
        self.map = mag_map
        self.dt = dt
        self.Q = build_process_noise_Q(process_noise_scale, dt)
        self.sigma_meas = sigma_meas
        self.resample_threshold = resample_threshold if resample_threshold is not None else n_particles / 2.0
        self.rng = rng if rng is not None else np.random.default_rng()

        self.particles = self.rng.multivariate_normal(x0_mean, x0_cov, size=n_particles)
        self.weights = np.full(n_particles, 1.0 / n_particles)

        self.history = {
            "estimate": [], "N_eff": [], "resampled": [],
        }

    def predict(self, u):
        """Eq. 20: vectorized particle prediction with per-particle process
        noise drawn from Q_t."""
        ax, ay, omega = u
        px = self.particles[:, 0] + self.particles[:, 2] * self.dt
        py = self.particles[:, 1] + self.particles[:, 3] * self.dt
        vx = self.particles[:, 2] + ax * self.dt
        vy = self.particles[:, 3] + ay * self.dt
        psi = self.particles[:, 4] + omega * self.dt

        noise = self.rng.multivariate_normal(np.zeros(5), self.Q, size=self.N)
        self.particles = np.stack([px, py, vx, vy, psi], axis=1) + noise

    def update(self, z_meas):
        """Eq. 21-22: importance weighting + normalization based on the
        per-particle predicted magnetic field from the map (Eq. 8)."""
        px = self.particles[:, 0]
        py = self.particles[:, 1]
        z_hat = np.atleast_1d(self.map.query(px, py))  # Eq. 8, per particle

        log_w = -0.5 * ((z_meas - z_hat) ** 2) / (self.sigma_meas ** 2)
        log_w = log_w - np.max(log_w)  # numerical stability
        w = self.weights * np.exp(log_w)  # Eq. 21
        w_sum = np.sum(w)
        if w_sum <= 0 or not np.isfinite(w_sum):
            w = np.full(self.N, 1.0 / self.N)
        else:
            w = w / w_sum  # Eq. 22
        self.weights = w

        n_eff = self.effective_sample_size()
        resampled = False
        if n_eff < self.resample_threshold:
            self.resample()
            resampled = True

        est = self.estimate()
        self.history["estimate"].append(est.copy())
        self.history["N_eff"].append(n_eff)
        self.history["resampled"].append(resampled)
        return est, n_eff, resampled

    def effective_sample_size(self):
        """Eq. 23 (first half): N_eff = 1 / sum_i w_i^2."""
        return float(1.0 / np.sum(self.weights ** 2))

    def resample(self):
        """Eq. 23 (second half): systematic resampling proportional to
        weights, refreshing to an equally-weighted particle set."""
        positions = (self.rng.uniform() + np.arange(self.N)) / self.N
        cumulative_sum = np.cumsum(self.weights)
        cumulative_sum[-1] = 1.0
        indices = np.searchsorted(cumulative_sum, positions)
        self.particles = self.particles[indices]
        self.weights = np.full(self.N, 1.0 / self.N)

    def estimate(self):
        """Eq. 24: weighted mean state estimate."""
        return np.average(self.particles, axis=0, weights=self.weights)

    def step(self, u, z_meas):
        self.predict(u)
        return self.update(z_meas)
