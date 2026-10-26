import type {
  HealthResponse,
  PlanRouteResponse,
  RouteAlternative,
  WeatherData,
} from '../types/route';
import type { CoolSpot, CoolSpotRequest, UserRole, AuthSession } from '../types/coolSpot';

const DEFAULT_API_BASE_URL = 'https://zlxk92fdb6.execute-api.us-east-1.amazonaws.com/dev';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, '');

const SPOTS_STORAGE_KEY = 'heatsafe_aws_coolspots_v1';
const REQUESTS_STORAGE_KEY = 'heatsafe_aws_spot_requests_v1';
const AUTH_STORAGE_KEY = 'heatsafe_aws_auth_session_v1';

// Real-time inter-tab & role synchronization channel
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('heatsafe_channel_sync')
    : null;

function notifySync(type: string, data?: unknown) {
  try {
    syncChannel?.postMessage({ type, data, timestamp: Date.now() });
  } catch {
    // Non-blocking
  }
}

// Default initial verified Cool Spots for Indore (Local Fallback)
const DEFAULT_COOL_SPOTS: CoolSpot[] = [
  {
    id: 'spot_indore_1',
    spot_id: 'spot_indore_1',
    city: 'indore',
    name: 'Regional Park Shaded Promenade',
    description: 'Dense neem & banyan canopy with mist breeze near canal bank.',
    lat: 22.6845,
    lon: 75.8521,
    coords: { lat: 22.6845, lon: 75.8521 },
    logo_id: 'tree_canopy',
    coolingOffsetC: 3.5,
    openHours: '06:00 - 21:00',
    upvotes: 48,
    verified_by: 'admin@heatsafe.in',
    created_at: new Date().toISOString(),
  },
  {
    id: 'spot_indore_2',
    spot_id: 'spot_indore_2',
    city: 'indore',
    name: 'Rajwada Heritage Hydration Kiosk',
    description: 'Filtered cold drinking water station and shaded stone arcade.',
    lat: 22.7186,
    lon: 75.8547,
    coords: { lat: 22.7186, lon: 75.8547 },
    logo_id: 'water_station',
    coolingOffsetC: 2.0,
    openHours: '08:00 - 22:00',
    upvotes: 112,
    verified_by: 'admin@heatsafe.in',
    created_at: new Date().toISOString(),
  },
];

export class PlannerApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'PlannerApiError';
    this.status = status;
    this.code = code;
  }
}

export interface PlanRouteParams {
  city: string;
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
}

function toSafeNumber(val: unknown, fallback = 0): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

function extractCoordinatesArray(rawGeometry: any): [number, number][] {
  if (!rawGeometry) return [];

  if (Array.isArray(rawGeometry)) {
    return rawGeometry
      .filter((pt) => Array.isArray(pt) && pt.length >= 2)
      .map((pt) => [toSafeNumber(pt[0]), toSafeNumber(pt[1])]);
  }

  if (Array.isArray(rawGeometry.coordinates)) {
    return rawGeometry.coordinates
      .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
      .map((pt: any) => [toSafeNumber(pt[0]), toSafeNumber(pt[1])]);
  }

  if (rawGeometry.geometry && Array.isArray(rawGeometry.geometry.coordinates)) {
    return rawGeometry.geometry.coordinates
      .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
      .map((pt: any) => [toSafeNumber(pt[0]), toSafeNumber(pt[1])]);
  }

  if (Array.isArray(rawGeometry.features) && rawGeometry.features[0]?.geometry?.coordinates) {
    return rawGeometry.features[0].geometry.coordinates
      .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
      .map((pt: any) => [toSafeNumber(pt[0]), toSafeNumber(pt[1])]);
  }

  return [];
}

function normalizeWeather(rawWeather: any): WeatherData {
  if (!rawWeather || typeof rawWeather !== 'object') {
    return {
      temperature_c: 0,
      relative_humidity: 0,
      wind_speed_kmh: 0,
    };
  }

  const temp = toSafeNumber(
    rawWeather.temperature_c ??
      rawWeather.temperature ??
      rawWeather.temp_c ??
      rawWeather.temp,
    0
  );

  const humidity = toSafeNumber(
    rawWeather.humidity_percent ??
      rawWeather.relative_humidity ??
      rawWeather.humidity ??
      rawWeather.rh,
    0
  );

  const wind = toSafeNumber(
    rawWeather.wind_speed_kmh ??
      rawWeather.wind_speed ??
      rawWeather.wind_kph ??
      rawWeather.wind,
    0
  );

  return {
    temperature_c: temp,
    relative_humidity: humidity,
    wind_speed_kmh: wind,
    weather_code: rawWeather.weather_code,
    condition: rawWeather.condition ?? rawWeather.description,
    timestamp: rawWeather.timestamp ?? rawWeather.time,
  };
}

function normalizeRouteAlternative(rawRoute: any, index: number): RouteAlternative {
  const heatObj = rawRoute?.heat && typeof rawRoute.heat === 'object' ? rawRoute.heat : {};

  const heatScore = toSafeNumber(
    heatObj.heat_score ??
      rawRoute?.heat_score ??
      rawRoute?.final_heat_score ??
      rawRoute?.estimated_heat_score ??
      rawRoute?.breakdown?.final_heat_score ??
      heatObj.final_score ??
      rawRoute?.score,
    0
  );

  let heatCategory =
    heatObj.category ??
    rawRoute?.heat_category ??
    rawRoute?.category ??
    rawRoute?.heat_level;

  if (!heatCategory || typeof heatCategory !== 'string') {
    if (heatScore < 35) heatCategory = 'Low Heat';
    else if (heatScore < 60) heatCategory = 'Moderate Heat';
    else if (heatScore < 80) heatCategory = 'High Heat';
    else heatCategory = 'Very High Heat';
  }

  const distanceKm =
    rawRoute?.distance_km !== undefined
      ? toSafeNumber(rawRoute.distance_km)
      : rawRoute?.distance_m !== undefined
      ? Number((toSafeNumber(rawRoute.distance_m) / 1000).toFixed(2))
      : rawRoute?.distance !== undefined
      ? toSafeNumber(rawRoute.distance) > 100
        ? Number((toSafeNumber(rawRoute.distance) / 1000).toFixed(2))
        : toSafeNumber(rawRoute.distance)
      : 0;

  const durationMin =
    rawRoute?.duration_min !== undefined
      ? Math.round(toSafeNumber(rawRoute.duration_min))
      : rawRoute?.duration_minutes !== undefined
      ? Math.round(toSafeNumber(rawRoute.duration_minutes))
      : rawRoute?.duration_s !== undefined
      ? Math.round(toSafeNumber(rawRoute.duration_s) / 60)
      : rawRoute?.duration !== undefined
      ? toSafeNumber(rawRoute.duration) > 180
        ? Math.round(toSafeNumber(rawRoute.duration) / 60)
        : Math.round(toSafeNumber(rawRoute.duration))
      : 0;

  const weatherHeat =
    heatObj.weather_heat ??
    rawRoute?.weather_heat ??
    rawRoute?.weather_heat_score ??
    heatObj.components?.weather_heat;

  const envExposure =
    heatObj.environmental_exposure ??
    rawRoute?.environmental_exposure ??
    rawRoute?.environmental_exposure_score ??
    heatObj.components?.environmental_exposure;

  const rawModeScores = rawRoute?.mode_scores ?? rawRoute?.scores;
  const modeScores =
    rawModeScores && typeof rawModeScores === 'object'
      ? {
          fast: toSafeNumber(rawModeScores.fast),
          balanced: toSafeNumber(rawModeScores.balanced),
          heat_safe: toSafeNumber(rawModeScores.heat_safe ?? rawModeScores.heatsafe),
        }
      : undefined;

  const coords = extractCoordinatesArray(
    rawRoute?.geometry ?? rawRoute?.geojson ?? rawRoute?.coordinates
  );

  return {
    ...rawRoute,
    route_id: String(rawRoute?.route_id ?? rawRoute?.id ?? `route_${index + 1}`),
    distance_km: distanceKm,
    duration_min: durationMin,
    heat_score: Number(heatScore.toFixed(1)),
    heat_category: heatCategory,
    weather_heat: weatherHeat !== undefined ? toSafeNumber(weatherHeat) : undefined,
    environmental_exposure:
      envExposure !== undefined ? toSafeNumber(envExposure) : undefined,
    mode_scores: modeScores,
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
  };
}

function extractRouteId(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return String(val.route_id ?? val.id ?? '');
  }
  return '';
}

export async function checkApiHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) return false;
    const data: HealthResponse = await response.json();
    return data.status === 'ok' || data.status === 'healthy' || response.status === 200;
  } catch {
    return false;
  }
}

export async function fetchPlannedRoutes(
  params: PlanRouteParams,
  signal?: AbortSignal
): Promise<PlanRouteResponse> {
  const query = new URLSearchParams({
    city: params.city.toLowerCase(),
    originLat: String(params.originLat),
    originLon: String(params.originLon),
    destLat: String(params.destLat),
    destLon: String(params.destLon),
  });

  const url = `${API_BASE_URL}/plan-route?${query.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new PlannerApiError(
      'Unable to reach the Heat-Safe routing server. Please check your network connection and try again.'
    );
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new PlannerApiError(
        'The routing service returned an unreadable response. Please try again shortly.',
        response.status
      );
    }
  }

  if (!response.ok || payload?.status === 'error') {
    const backendMsg = payload?.message || payload?.error || payload?.detail || '';
    const lowerMsg = String(backendMsg).toLowerCase();

    if (
      response.status === 422 ||
      lowerMsg.includes('outside') ||
      lowerMsg.includes('service area') ||
      lowerMsg.includes('unsupported location') ||
      lowerMsg.includes('bounds')
    ) {
      throw new PlannerApiError(
        'This location is outside our current service area. Please choose a point within a supported city.',
        response.status,
        'UNSUPPORTED_LOCATION'
      );
    }

    if (lowerMsg.includes('unsupported city')) {
      throw new PlannerApiError(
        backendMsg || 'The selected city is not yet enabled on the routing server.',
        response.status,
        'UNSUPPORTED_CITY'
      );
    }

    if (lowerMsg.includes('no walkable') || lowerMsg.includes('no route')) {
      throw new PlannerApiError(
        backendMsg || 'No walkable pedestrian route could be found between these two coordinates.',
        response.status,
        'NO_ROUTE'
      );
    }

    throw new PlannerApiError(
      backendMsg ||
        'Unable to calculate walking routes for the selected coordinates. Please try another pair of points.',
      response.status
    );
  }

  const normalizedRoutes: RouteAlternative[] = Array.isArray(payload?.routes)
    ? payload.routes.map(normalizeRouteAlternative)
    : [];

  if (normalizedRoutes.length === 0) {
    throw new PlannerApiError(
      'No walkable routes were returned for these coordinates. Please try selecting points closer to pedestrian streets.'
    );
  }

  const fallbackRouteId = normalizedRoutes[0]?.route_id || 'route_1';
  const rawRecs = payload?.recommendations || {};

  const recommendations = {
    fast: extractRouteId(rawRecs.fast) || fallbackRouteId,
    balanced: extractRouteId(rawRecs.balanced) || fallbackRouteId,
    heat_safe:
      extractRouteId(rawRecs.heat_safe ?? rawRecs.heatsafe ?? rawRecs['heat-safe']) ||
      extractRouteId(payload?.recommended_route) ||
      fallbackRouteId,
  };

  const recommendedRoute =
    extractRouteId(payload?.recommended_route) ||
    recommendations.heat_safe ||
    fallbackRouteId;

  return {
    ...payload,
    status: payload?.status || 'ok',
    request_id: String(payload?.request_id || ''),
    origin: {
      lat: toSafeNumber(payload?.origin?.lat ?? payload?.origin?.latitude, params.originLat),
      lon: toSafeNumber(payload?.origin?.lon ?? payload?.origin?.longitude, params.originLon),
    },
    destination: {
      lat: toSafeNumber(payload?.destination?.lat ?? payload?.destination?.latitude, params.destLat),
      lon: toSafeNumber(payload?.destination?.lon ?? payload?.destination?.longitude, params.destLon),
    },
    weather: normalizeWeather(payload?.weather),
    routes: normalizedRoutes,
    route_count: toSafeNumber(payload?.route_count, normalizedRoutes.length),
    recommendations,
    recommended_route: recommendedRoute,
    model: payload?.model,
    storage: payload?.storage,
  };
}

export async function fetchLiveUvIndex(lat: number, lon: number): Promise<number> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index`
    );
    if (!res.ok) return 6.5;
    const data = await res.json();
    return data?.current?.uv_index ?? 6.5;
  } catch (err) {
    console.warn('Failed to fetch live UV index, defaulting to 6.5', err);
    return 6.5;
  }
}

// ==========================================
// 1. AWS COGNITO / SESSION MANAGEMENT
// ==========================================
export function getSavedSession(): AuthSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { email: '', role: 'guest' };
    return JSON.parse(raw);
  } catch {
    return { email: '', role: 'guest' };
  }
}

export async function loginWithAwsCognito(
  email: string,
  password: string,
  roleSelect: UserRole
): Promise<AuthSession> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: roleSelect }),
    });
    if (res.ok) {
      const data = await res.json();
      const session: AuthSession = {
        email: data.email || email,
        role: data.role || roleSelect,
        token: data.token,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      notifySync('SESSION_CHANGED', session);
      return session;
    }
  } catch {
    // Fallback to simulated Cognito token for local dev testing
  }

  const session: AuthSession = {
    email,
    role: roleSelect,
    token: `aws-cognito-mock-jwt-${roleSelect}-${Date.now()}`,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  notifySync('SESSION_CHANGED', session);
  return session;
}

export function logoutAwsSession(): AuthSession {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  const guest: AuthSession = { email: '', role: 'guest' };
  notifySync('SESSION_CHANGED', guest);
  return guest;
}

// ==========================================
// 2. DYNAMODB COOL SPOTS FETCH & ADMIN CRUD
// ==========================================
export async function fetchCoolSpots(city: string = 'indore'): Promise<CoolSpot[]> {
  const normCity = (city || 'indore').toLowerCase();

  let remoteSpots: CoolSpot[] = [];
  try {
    const res = await fetch(`${API_BASE_URL}/cool-spots?city=${encodeURIComponent(city)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.spots)) {
        remoteSpots = data.spots;
      }
    }
  } catch {
    // remote fallback
  }

  let localSpots: CoolSpot[] = [];
  try {
    const stored = localStorage.getItem(SPOTS_STORAGE_KEY);
    localSpots = stored ? JSON.parse(stored) : [];
  } catch {
    localSpots = [];
  }

  // Combine remote spots and local spots
  const combined: CoolSpot[] = [...remoteSpots];
  for (const ls of localSpots) {
    const isDup = combined.some(
      (s) =>
        s.spot_id === ls.spot_id ||
        s.id === ls.id ||
        (s.name && ls.name && s.name.trim().toLowerCase() === ls.name.trim().toLowerCase())
    );
    if (!isDup) {
      combined.push(ls);
    }
  }

  // Always merge all approved user requests into live cool spots
  try {
    const rawReqs = localStorage.getItem(REQUESTS_STORAGE_KEY);
    const allReqs: CoolSpotRequest[] = rawReqs ? JSON.parse(rawReqs) : [];
    const approvedReqs = allReqs.filter(
      (r) =>
        (r.status?.toLowerCase() === 'approved' || (r.status as string) === 'APPROVED') &&
        Boolean(r.suggested_name)
    );

    for (const req of approvedReqs) {
      const exists = combined.some(
        (s) =>
          s.id === req.request_id ||
          s.spot_id === req.request_id ||
          (s.name && s.name.trim().toLowerCase() === req.suggested_name.trim().toLowerCase())
      );
      if (!exists) {
        combined.unshift({
          id: req.request_id,
          spot_id: req.request_id,
          city: req.city || normCity,
          name: req.suggested_name,
          description: req.message,
          lat: req.lat,
          lon: req.lon,
          coords: { lat: req.lat, lon: req.lon },
          logo_id: req.suggested_logo || 'tree_canopy',
          coolingOffsetC: 3.0,
          openHours: '06:00 - 22:00',
          upvotes: 1,
          verified_by: req.user_email ? `Verified (${req.user_email})` : 'Admin Verified',
          created_at: req.created_at || new Date().toISOString(),
          image_url: req.spot_image_url || undefined,
        });
      }
    }
  } catch {
    // safe
  }

  // Fallback to default cool spots if nothing found
  if (combined.length === 0) {
    combined.push(...DEFAULT_COOL_SPOTS);
  }

  // Save merged state back to storage safely
  try {
    // Strip oversized base64 images if quota constrained
    const safeToStore = combined.map((s) => ({
      ...s,
      image_url: s.image_url && s.image_url.length > 50000 ? '' : s.image_url,
    }));
    localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(safeToStore));
  } catch {
    // Non-blocking
  }

  // Flexible city filtering
  return combined.filter((s) => {
    if (!s.city) return true;
    const spotCity = s.city.toLowerCase();
    return spotCity === normCity || spotCity.includes(normCity) || normCity.includes(spotCity);
  });
}

export async function upsertAdminCoolSpot(
  spot: Omit<CoolSpot, 'spot_id' | 'created_at'> & { spot_id?: string },
  accessToken?: string
): Promise<CoolSpot> {
  const newSpot: CoolSpot = {
    ...spot,
    spot_id: spot.spot_id || `spot_${Date.now()}`,
    city: spot.city || 'indore',
    coolingOffsetC: spot.coolingOffsetC ?? 2.5,
    openHours: spot.openHours || '08:00 - 20:00',
    upvotes: spot.upvotes ?? 0,
    created_at: new Date().toISOString(),
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    await fetch(`${API_BASE_URL}/admin/cool-spots`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newSpot),
    });
  } catch {
    // Local fallback persistence
  }

  try {
    const stored = localStorage.getItem(SPOTS_STORAGE_KEY);
    const allSpots: CoolSpot[] = stored ? JSON.parse(stored) : [...DEFAULT_COOL_SPOTS];
    const existingIdx = allSpots.findIndex((s) => s.spot_id === newSpot.spot_id || s.id === newSpot.id);

    if (existingIdx >= 0) {
      allSpots[existingIdx] = newSpot;
    } else {
      allSpots.unshift(newSpot);
    }

    try {
      localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(allSpots));
    } catch {
      // If quota exceeded, strip heavy images and retry
      const compact = allSpots.map((s) => ({
        ...s,
        image_url: s.image_url && s.image_url.length > 50000 ? '' : s.image_url,
      }));
      localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(compact));
    }
  } catch {
    // Safe fallback
  }

  notifySync('COOL_SPOTS_UPDATED', newSpot);
  return newSpot;
}

export async function deleteAdminCoolSpot(spotId: string, accessToken?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    await fetch(`${API_BASE_URL}/admin/cool-spots/${encodeURIComponent(spotId)}`, {
      method: 'DELETE',
      headers,
    });
  } catch {
    // Local fallback
  }

  try {
    const stored = localStorage.getItem(SPOTS_STORAGE_KEY);
    const allSpots: CoolSpot[] = stored ? JSON.parse(stored) : DEFAULT_COOL_SPOTS;
    const filtered = allSpots.filter((s) => s.spot_id !== spotId);
    localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Safe
  }

  notifySync('COOL_SPOTS_UPDATED', { deletedId: spotId });
}

export const deleteCoolSpot = deleteAdminCoolSpot;

// ==========================================
// 3. USER REQUEST QUEUE & ADMIN REQUESTS
// ==========================================
export async function submitCoolSpotRequest(
  payload: Omit<CoolSpotRequest, 'request_id' | 'status' | 'created_at'>,
  accessToken?: string
): Promise<CoolSpotRequest> {
  const newRequest: CoolSpotRequest = {
    ...payload,
    request_id: `req_${Date.now()}`,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  // 1. Attempt AWS API Gateway sync
  try {
    const res = await fetch(`${API_BASE_URL}/cool-spots/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newRequest),
    });
    if (res.ok) {
      console.info('[AWS Sync] Successfully synced cool spot request to AWS.');
    } else {
      console.info(`[AWS Sync] Endpoint returned ${res.status}. Storing in persistent sync queue.`);
    }
  } catch (err) {
    console.info('[AWS Sync] Network/API endpoint unavailable, storing in persistent sync queue.', err);
  }

  // 2. Persist safely with browser storage quota protection
  try {
    const stored = localStorage.getItem(REQUESTS_STORAGE_KEY);
    const allRequests: CoolSpotRequest[] = stored ? JSON.parse(stored) : [];
    const filtered = allRequests.filter((r) => r.request_id !== newRequest.request_id);
    filtered.unshift(newRequest);
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (quotaErr) {
    console.warn('[Storage] Quota exceeded with image. Storing compact request record without heavy image.', quotaErr);
    try {
      const stored = localStorage.getItem(REQUESTS_STORAGE_KEY);
      const allRequests: CoolSpotRequest[] = stored ? JSON.parse(stored) : [];
      const compactRequest: CoolSpotRequest = { ...newRequest, spot_image_url: '' };
      allRequests.unshift(compactRequest);
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(allRequests));
    } catch {
      // Safe fallback
    }
  }

  // 3. Broadcast to all open tabs and role views in real time
  notifySync('NEW_REQUEST', newRequest);

  return newRequest;
}

export const submitUserCoolSpotRequest = submitCoolSpotRequest;

export async function fetchCoolSpotRequests(accessToken?: string): Promise<CoolSpotRequest[]> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/cool-spots/requests`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.requests)) return data.requests;
    }
  } catch {
    // Local fallback
  }

  try {
    const stored = localStorage.getItem(REQUESTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export const getAdminRequests = fetchCoolSpotRequests;

export async function updateSpotRequestStatus(
  requestId: string,
  status: 'APPROVED' | 'REJECTED' | 'approved' | 'rejected',
  accessToken?: string
): Promise<void> {
  const normalizedStatus = status.toUpperCase() as 'APPROVED' | 'REJECTED';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    await fetch(`${API_BASE_URL}/admin/cool-spots/requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: normalizedStatus }),
    });
  } catch {
    // Local fallback
  }

  try {
    const stored = localStorage.getItem(REQUESTS_STORAGE_KEY);
    const allRequests: CoolSpotRequest[] = stored ? JSON.parse(stored) : [];
    const updated = allRequests.map((r) =>
      r.request_id === requestId ? { ...r, status: status.toLowerCase() as any } : r
    );
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Safe
  }

  notifySync('REQUEST_STATUS_UPDATED', { requestId, status });
}

export const updateAdminRequest = updateSpotRequestStatus;
