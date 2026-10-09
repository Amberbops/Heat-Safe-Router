export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface WeatherData {
  temperature_c: number;
  humidity_percent: number;
  wind_speed_kmh: number;
  timezone?: string;
}

export interface HeatComponents {
  temperature?: number;
  humidity?: number;
  wind?: number;
  duration?: number;
}

export interface Segment {
  start_point: { latitude: number; longitude: number };
  end_point: { latitude: number; longitude: number };
  distance_km: number;
  surface_id: number;
  surface_exposure: number;
  waytype_id: number;
  waytype_exposure: number;
  environmental_exposure: number;
}

export interface RouteHeat {
  heat_score: number;
  category: "Low" | "Moderate" | "High" | "Extreme" | string;
  weather_heat: number;
  environmental_exposure: number;
  components?: HeatComponents;
  segments?: Segment[];
}

export interface RouteItem {
  route_id: string;
  distance_km: number;
  duration_min: number;
  geometry?: {
    coordinates: [number, number][]; // [longitude, latitude]
    type: string;
  };
  heat: RouteHeat;
  normalized?: Record<string, number>;
  mode_scores?: {
    fast?: number;
    balanced?: number;
    "heat-safe"?: number;
  };
}

export interface RecommendationSummary {
  route_id: string;
  reason?: string;
  distance_km?: number;
  duration_min?: number;
  heat_score?: number;
}

export interface Recommendations {
  fast: RecommendationSummary;
  balanced: RecommendationSummary;
  "heat-safe": RecommendationSummary;
}

export interface ModelMetadata {
  description: string;
  weather_weights: Record<string, number>;
  environmental_proxy_weights: Record<string, number>;
  final_heat_weights: Record<string, number>;
  note: string;
}

export interface RoutePlanResponse {
  status: string;
  request_id: string;
  origin: Coordinate;
  destination: Coordinate;
  weather: WeatherData;
  route_count: number;
  routes: RouteItem[];
  recommendations: Recommendations;
  recommended_route: string;
  model: ModelMetadata;
  storage?: {
    status: string;
    table: string;
  };
}
