"""
ekf.py

Implements the Extended Kalman Filter, Eq. 11-19:

  Eq. 11  State definition:            x_t = [x, y, vx, vy, psi]
  Eq. 12  Motion (predict) model:      x_hat_{t|t-1} = f(x_hat_{t-1|t-1}, u_t)
  Eq. 13  Motion Jacobian:             F_t = df/dx
  Eq. 14  Measurement prediction:      z_hat_t = h(x_hat_{t|t-1}) = M(x,y)  (Eq. 8)
  Eq. 15  Covariance predict:          P_{t|t-1} = F_t P_{t-1|t-1} F_t^T + Q_t
  Eq. 16  Innovation:                  y_t = z_t - z_hat_t
  Eq. 17  Innovation covariance:       S_t = H_t P_{t|t-1} H_t^T + R_t
  Eq. 18  Kalman gain:                 K_t = P_{t|t-1} H_t^T S_t^-1
  Eq. 19  State update:                x_hat_{t|t} = x_hat_{t|t-1} + K_t y_t
  Eq. 19b Covariance update:           P_{t|t} = (I - K_t H_t) P_{t|t-1}

State: x = [x, y, vx, vy, psi]. Motion driven by IMU (ax, ay, omega).
Measurement: scalar magnetic field value compared against the map (Eq. 8),
with H_t the numerical map gradient (Eq. 17) restricted to the (x,y) block.
"""
import numpy as np

from config import build_process_noise_Q, build_measurement_noise_R
from estimation.magnetic_map import MagneticMap


def motion_model(x, u, dt):
    """Eq. 12: predicted mean state x_hat_{t|t-1}.
    x = [x, y, vx, vy, psi], u = [ax, ay, omega]."""
    px, py, vx, vy, psi = x
    ax, ay, omega = u
    px_new = px + vx * dt
    py_new = py + vy * dt
    vx_new = vx + ax * dt
    vy_new = vy + ay * dt
    psi_new = psi + omega * dt
    return np.array([px_new, py_new, vx_new, vy_new, psi_new])


def motion_jacobian(dt):
    """Eq. 13: F_t = df/dx, evaluated at any state (linear here since the
    motion model is linear in the state given u_t)."""
    F = np.eye(5)
    F[0, 2] = dt
    F[1, 3] = dt
    return F


class EKF:
    def __init__(self, x0, P0, mag_map: MagneticMap, dt,
                 process_noise_scale=1.0, measurement_noise_scale=1.0):
        self.x = np.asarray(x0, dtype=float)
        self.P = np.asarray(P0, dtype=float)
        self.map = mag_map
        self.dt = dt
        self.Q = build_process_noise_Q(process_noise_scale, dt)
        self.R = build_measurement_noise_R(measurement_noise_scale, n_channels=1)
        self.history = {
            "x": [], "P_diag": [], "innovation": [], "K_norm": [], "NIS": [],
        }

    def predict(self, u):
        F = motion_jacobian(self.dt)                          # Eq. 13
        self.x = motion_model(self.x, u, self.dt)              # Eq. 12
        self.P = F @ self.P @ F.T + self.Q                     # Eq. 15
        return self.x, self.P

    def update(self, z_meas):
        """z_meas: scalar magnetic-field measurement (world frame, already
        rotated via Eq. 7 at the call site)."""
        px, py = self.x[0], self.x[1]
        z_hat = self.map.query(px, py)                          # Eq. 14
        z_hat = float(np.atleast_1d(z_hat)[0])

        grad = self.map.gradient(px, py)                        # H_t spatial part
        H = np.zeros((1, 5))
        H[0, 0] = grad[0]
        H[0, 1] = grad[1]

        y = np.array([z_meas - z_hat])                          # Eq. 16
        S = H @ self.P @ H.T + self.R                            # Eq. 17
        K = self.P @ H.T @ np.linalg.inv(S)                      # Eq. 18

        self.x = self.x + (K @ y).flatten()                      # Eq. 19
        self.P = (np.eye(5) - K @ H) @ self.P                    # Eq. 19b

        nis = float(y.T @ np.linalg.inv(S) @ y)  # normalized innovation squared
        self.history["x"].append(self.x.copy())
        self.history["P_diag"].append(np.diag(self.P).copy())
        self.history["innovation"].append(float(y[0]))
        self.history["K_norm"].append(float(np.linalg.norm(K)))
        self.history["NIS"].append(nis)
        return self.x, self.P, nis

    def step(self, u, z_meas):
        self.predict(u)
        return self.update(z_meas)
