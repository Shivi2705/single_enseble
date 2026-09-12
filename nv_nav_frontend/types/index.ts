// Types mirroring the FastAPI backend (backend/main.py) request/response models.

export type AxisCount = 1 | 3 | 4;

export interface SimulateODMRRequest {
  use_real_data?: boolean;
  axis_count?: AxisCount;
  subset_axes?: number[] | null;
  n_steps?: number | null;
}

export interface SimulateODMRResponse {
  summary: {
    n_steps: number;
    axis_count: number;
    axes_used: number[];
    mean_B_parallel_gauss: number;
    std_B_parallel_gauss: number;
    condition_number_N?: number;
  };
  output_path: string;
}

export interface RunEKFRequest {
  axis_count?: AxisCount;
  subset_axes?: number[] | null;
  use_correlation_init?: boolean;
  process_noise_scale?: number;
  measurement_noise_scale?: number;
  n_steps?: number | null;
}

export interface RunPFRequest extends RunEKFRequest {
  n_particles?: number;
  resample_threshold?: number | null;
}

export interface FilterMetrics {
  rmse_position_m: number;
  max_position_error_m: number;
  rmse_heading_deg: number;
  [key: string]: number | string | undefined;
}

export interface RunFilterResponse {
  output_path: string;
  plots: Record<string, string>;
  metrics: FilterMetrics;
}

export interface MetricsSummary {
  ekf?: {
    file: string;
    rmse_position_m: number;
    max_position_error_m: number;
    rmse_heading_deg: number;
    convergence_time_s: number;
    [key: string]: number | string | undefined;
  };
  particle_filter?: {
    file: string;
    rmse_position_m: number;
    max_position_error_m: number;
    rmse_heading_deg: number;
    convergence_time_s: number;
    [key: string]: number | string | undefined;
  };
}

export interface PlotEntry {
  filename: string;
  path: string;
}

export interface PlotsResponse {
  plots: PlotEntry[];
}

export interface UploadMapResponse {
  status: string;
  stored_path: string;
  shape: number[];
  extent_m: number[];
}

export interface DatasetMetadata {
  dt: number;
  n_steps: number;
  domain_m: number;
  nv_axes: number[][];
  D_zfs_mhz: number;
  E_strain_mhz: number;
  gamma_e_mhz_per_g: number;
  A_par_mhz: number;
  P_quad_mhz: number;
  imu_noise: {
    accel_noise_density_ug_sqrtHz: number;
    gyro_noise_density_dps_sqrtHz: number;
    accel_std_per_sample_mps2: number;
    gyro_std_per_sample_radps: number;
  };
  linewidth_mhz_range: number[];
  contrast_range: number[];
  map_resolution_m: number;
  notes?: string;
}

export interface EquationEntry {
  id: string;
  number: string;
  name: string;
  section: string;
  latex: string;
  explanation: string;
  io: string;
  why: string;
  relatedPage?: { label: string; href: string };
}
