import type { RoutePlanResponse } from "../types/route";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://zlxk92fdb6.execute-api.us-east-1.amazonaws.com/dev";

export interface HealthResponse {
  status: string;
  service: string;
  message?: string;
  endpoints?: Record<string, string>;
  region?: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchRoutePlan(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<RoutePlanResponse> {
  const params = new URLSearchParams({
    originLat: originLat.toString(),
    originLon: originLon.toString(),
    destLat: destLat.toString(),
    destLon: destLon.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/plan-route?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok || data.status === "error") {
    throw new Error(data.message || `Route planning failed with status ${response.status}`);
  }

  return data as RoutePlanResponse;
}
