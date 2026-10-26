export type CoolSpotLogoId = 
  | 'water_station'
  | 'tree_canopy'
  | 'shaded_stall'
  | 'ac_refuge'
  | 'hydration'
  | 'shaded_vendor'
  | 'canopy_park'
  | 'shaded_park'
  | 'cooling_shelter'
  | 'mist_zone'
  | 'transit_shade'
  | 'medical_aid';

export type UserRole = 'guest' | 'user' | 'admin';

export interface AuthSession {
  email: string;
  role: UserRole;
  token?: string;
}

export interface CoolSpot {
  id: string;
  spot_id?: string;
  city?: string;
  name: string;
  description: string;
  lat?: number;
  lon?: number;
  coords?: { lat: number; lon: number } | [number, number];
  category?: CoolSpotLogoId | 'hydration' | 'shaded_vendor' | 'ac_refuge' | 'canopy_park';
  coolingOffsetC?: number;
  openHours?: string;
  upvotes?: number;
  isCrowdsourced?: boolean;
  logo_id: CoolSpotLogoId;
  image_url?: string;
  verified_by: string;
  created_at: string;
}

export interface CoolSpotRequest {
  request_id: string;
  city: string;
  user_email: string;
  suggested_name: string;
  message: string;
  lat: number;
  lon: number;
  suggested_logo: CoolSpotLogoId;
  spot_image_url: string; // Photo uploaded by the user
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface NearbyCoolSpotMatch {
  spot: CoolSpot;
  distanceFromUserM: number;
  distanceFromRouteM: number;
}

export const COOL_SPOT_LOGOS: {
  id: CoolSpotLogoId;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { id: 'tree_canopy', label: 'Dense Tree Canopy', emoji: '🌳', color: '#2E7D32' },
  { id: 'water_station', label: 'Drinking Water / Pyaau', emoji: '💧', color: '#0284C7' },
  { id: 'shaded_park', label: 'Shaded Garden / Park', emoji: '🌿', color: '#15803D' },
  { id: 'cooling_shelter', label: 'AC / Indoor Cooling Rest', emoji: '❄️', color: '#0369A1' },
  { id: 'mist_zone', label: 'Evaporative Mist Zone', emoji: '🌬️', color: '#0D9488' },
  { id: 'transit_shade', label: 'Shaded Transit Stop', emoji: '🚏', color: '#B45309' },
  { id: 'medical_aid', label: 'First Aid / Hydration Point', emoji: '🏥', color: '#DC2626' },
];