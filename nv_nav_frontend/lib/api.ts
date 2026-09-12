import axios, { AxiosError } from "axios";
import { apiBase } from "./utils";
import type {
  SimulateODMRRequest,
  SimulateODMRResponse,
  RunEKFRequest,
  RunPFRequest,
  RunFilterResponse,
  MetricsSummary,
  PlotsResponse,
  UploadMapResponse,
} from "@/types";

function client(timeoutMs = 120_000) {
  return axios.create({
    baseURL: apiBase(),
    timeout: timeoutMs,
    headers: { "Content-Type": "application/json" },
  });
}

// /run-ekf and /run-pf re-fit an ODMR spectrum for every timestep x axis
// (a real scipy curve_fit call each time, not vectorized) before the filter
// even starts. On the full 3600-step dataset at axis_count=4 that's 14,400
// fits — measured at roughly 7-8 minutes end to end. Give these two calls a
// much longer budget than the default 120s so the UI doesn't time out on a
// request that's still legitimately running server-side.
const HEAVY_TIMEOUT_MS = 15 * 60_000;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function unwrap(err: unknown): never {
  const ax = err as AxiosError<{ detail?: string }>;
  const detail = ax?.response?.data?.detail;
  const message =
    detail || ax?.message || "Failed to reach the NV-Nav backend. Check Settings.";
  throw new ApiError(message, ax?.response?.status);
}

export async function checkHealth(): Promise<{ status: string; message: string }> {
  try {
    const { data } = await client().get("/");
    return data;
  } catch (err) {
    return unwrap(err);
  }
}

export async function simulateODMR(
  params: SimulateODMRRequest
): Promise<SimulateODMRResponse> {
  try {
    const { data } = await client().post("/simulate-odmr", params);
    return data;
  } catch (err) {
    return unwrap(err);
  }
}

export async function runEKF(params: RunEKFRequest): Promise<RunFilterResponse> {
  try {
    const { data } = await client(HEAVY_TIMEOUT_MS).post("/run-ekf", params);
    return data;
  } catch (err) {
    return unwrap(err);
  }
}

export async function runPF(params: RunPFRequest): Promise<RunFilterResponse> {
  try {
    const { data } = await client(HEAVY_TIMEOUT_MS).post("/run-pf", params);
    return data;
  } catch (err) {
    return unwrap(err);
  }
}

export async function getMetrics(): Promise<MetricsSummary> {
  try {
    const { data } = await client().get("/metrics");
    return data;
  } catch (err) {
    // 404 means "no runs yet" — treat as empty rather than a hard error.
    const ax = err as AxiosError;
    if (ax?.response?.status === 404) return {};
    return unwrap(err);
  }
}

export async function getPlots(): Promise<PlotsResponse> {
  try {
    const { data } = await client().get("/plots");
    return data;
  } catch (err) {
    return unwrap(err);
  }
}

export async function uploadMap(
  file: File,
  resolutionM?: number
): Promise<UploadMapResponse> {
  try {
    const form = new FormData();
    form.append("file", file);
    if (resolutionM) form.append("resolution_m", String(resolutionM));
    const { data } = await client().post("/upload-map", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (err) {
    return unwrap(err);
  }
}
