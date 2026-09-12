"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { RunEKFRequest, RunPFRequest, SimulateODMRRequest } from "@/types";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.checkHealth,
    retry: 1,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: api.getMetrics,
    retry: 1,
  });
}

export function usePlots() {
  return useQuery({
    queryKey: ["plots"],
    queryFn: api.getPlots,
    retry: 1,
  });
}

export function useSimulateODMR() {
  return useMutation({
    mutationFn: (params: SimulateODMRRequest) => api.simulateODMR(params),
  });
}

export function useRunEKF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: RunEKFRequest) => api.runEKF(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["plots"] });
    },
  });
}

export function useRunPF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: RunPFRequest) => api.runPF(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["plots"] });
    },
  });
}

export function useUploadMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, resolutionM }: { file: File; resolutionM?: number }) =>
      api.uploadMap(file, resolutionM),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plots"] });
    },
  });
}
