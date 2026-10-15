export type RecommendationMode = 'fast' | 'balanced' | 'heat_safe';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface WeatherData {
  temperature_c: number;
  relative_humidity: number;
  wind_speed_kmh: number;
  weather_code?: number;
  condition?: string;
  timestamp?: string;
}

export interface HeatBreakdown {
  weather_heat_score: number;
  environmental_exposure_score: number;
  final_heat_score: number;
  components?: {
    temperature_weight?: number;
    humidity_weight?: number;
    wind_weight?: number;
    duration_weight?: number;
    weather_weight?: number;
    environmental_proxy_weight?: number;
    surface_weight?: number;
    waytype_weight?: number;
  };
}

export interface ModeScores {
  fast: number;
  balanced: number;
  heat_safe: number;
}

export interface RouteGeoJSONGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // GeoJSON convention: [longitude, latitude]
}

export interface RouteAlternative {
  route_id: string;
  distance_km: number;
  duration_min: number;
  heat_score: number;
  heat_category: 'Low Heat' | 'Moderate Heat' | 'High Heat' | 'Very High Heat' | string;
  weather_heat?: number;
  environmental_exposure?: number;
  breakdown?: HeatBreakdown;
  mode_scores?: ModeScores;
  geometry: RouteGeoJSONGeometry;
  summary?: string;
}

export interface RecommendationsMap {
  fast: string;
  balanced: string;
  heat_safe: string;
}

export interface ModelMetadata {
  name?: string;
  type?: 'deterministic' | 'ml' | string;
  version?: string;
  ml_enabled?: boolean;
  feature_schema?: string[];
  weights?: {
    weather: number;
    environmental_proxy: number;
    weather_components: {
      temperature: number;
      humidity: number;
      wind: number;
      duration: number;
    };
    proxy_components: {
      surface: number;
      waytype: number;
    };
  };
}

export interface StorageMetadata {
  dynamodb_saved?: boolean;
  status?: string;
  table?: string;
  error?: string;
}

export interface PlanRouteResponse {
  status: string;
  request_id: string;
  city?: string;
  origin: Coordinates;
  destination: Coordinates;
  weather: WeatherData;
  route_count: number;
  routes: RouteAlternative[];
  recommendations: RecommendationsMap;
  recommended_route: string;
  model?: ModelMetadata;
  storage?: StorageMetadata;
}

export interface HealthResponse {
  status: string;
  service?: string;
  timestamp?: string;
}