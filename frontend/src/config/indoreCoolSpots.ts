import type { CoolSpot, NearbyCoolSpotMatch } from '../types/coolSpot';
import type { Coordinates, RouteAlternative } from '../types/route';

export const INITIAL_INDORE_COOL_SPOTS: CoolSpot[] = [
  {
    id: 'cs-rajwada-pyau',
    name: 'Rajwada Municipal Cold Water Pyau',
    category: 'hydration',
    coords: { lat: 22.7189, lon: 75.8562 },
    coolingOffsetC: -3.0,
    description: 'Chilled RO drinking water kiosk shaded under the heritage arcade.',
    openHours: '07:00 AM – 10:00 PM',
    upvotes: 48,
  },
  {
    id: 'cs-56dukan-mist',
    name: '56 Dukan Shaded Pergola & Mist Zone',
    category: 'shaded_vendor',
    coords: { lat: 22.7245, lon: 75.8841 },
    coolingOffsetC: -4.5,
    description: 'Pedestrian-only shaded food street with mist fans, fresh coconut water & shikanji.',
    openHours: '08:00 AM – 11:00 PM',
    upvotes: 94,
  },
  {
    id: 'cs-ti-mall-ac',
    name: 'Treasure Island (TI) Mall Atrium Refuge',
    category: 'ac_refuge',
    coords: { lat: 22.7218, lon: 75.8788 },
    coolingOffsetC: -7.5,
    description: 'Air-conditioned public atrium with seating and water stations on MG Road.',
    openHours: '10:00 AM – 10:30 PM',
    upvotes: 76,
  },
  {
    id: 'cs-nehru-park-canopy',
    name: 'Nehru Park Banyan Canopy Walk',
    category: 'canopy_park',
    coords: { lat: 22.7209, lon: 75.8726 },
    coolingOffsetC: -4.2,
    description: 'Dense old-growth tree canopy near Regal Square offering deep shade and benches.',
    openHours: '06:00 AM – 09:00 PM',
    upvotes: 63,
  },
  {
    id: 'cs-bhawarkuan-juice',
    name: 'Bhawarkuan Student Hydration & Sugarcane Hub',
    category: 'shaded_vendor',
    coords: { lat: 22.6926, lon: 75.8679 },
    coolingOffsetC: -3.2,
    description: 'Shaded cold sugarcane juice, nimbu pani, and clay matka water stalls near DAVV.',
    openHours: '08:30 AM – 10:00 PM',
    upvotes: 52,
  },
  {
    id: 'cs-gandhi-hall-garden',
    name: 'Gandhi Hall Shaded Veranda & Water Point',
    category: 'hydration',
    coords: { lat: 22.7201, lon: 75.8695 },
    coolingOffsetC: -3.8,
    description: 'High-ceiling stone corridor and public drinking water fountain near Regal Circle.',
    openHours: '08:00 AM – 08:00 PM',
    upvotes: 39,
  },
  {
    id: 'cs-c21-ac',
    name: 'C21 Mall & Vijay Nagar Metro Shaded Concourse',
    category: 'ac_refuge',
    coords: { lat: 22.7448, lon: 75.8944 },
    coolingOffsetC: -7.0,
    description: 'Full AC relief lobby and shaded underpass seating along AB Road.',
    openHours: '10:00 AM – 10:30 PM',
    upvotes: 81,
  },
  {
    id: 'cs-sarafa-matka',
    name: 'Sarafa Heritage Matka Water & Shaded Lane',
    category: 'hydration',
    coords: { lat: 22.7175, lon: 75.8546 },
    coolingOffsetC: -3.5,
    description: 'Narrow canyon street architecture blocks direct afternoon sun; free clay-pot water.',
    openHours: '09:00 AM – 11:30 PM',
    upvotes: 44,
  },
  {
    id: 'cs-geeta-bhawan-pyau',
    name: 'Geeta Bhawan Trust Cold Water Kiosk',
    category: 'hydration',
    coords: { lat: 22.7147, lon: 75.8823 },
    coolingOffsetC: -3.0,
    description: '24/7 philanthropic chilled drinking water station with shaded waiting bench.',
    openHours: '24 Hours',
    upvotes: 67,
  },
  {
    id: 'cs-lalbagh-canopy',
    name: 'Lal Bagh Estate Dense Tree Corridor',
    category: 'canopy_park',
    coords: { lat: 22.7014, lon: 75.8475 },
    coolingOffsetC: -4.8,
    description: 'Lush botanical shade corridor with significantly lower surface radiant heat.',
    openHours: '06:00 AM – 07:00 PM',
    upvotes: 58,
  },
];

const STORAGE_KEY = 'HEATSAFE_CROWDSOURCED_COOL_SPOTS_V1';

export function loadAllCoolSpots(): CoolSpot[] {
  if (typeof window === 'undefined') return INITIAL_INDORE_COOL_SPOTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_INDORE_COOL_SPOTS;
    const custom: CoolSpot[] = JSON.parse(raw);
    return [...INITIAL_INDORE_COOL_SPOTS, ...custom];
  } catch {
    return INITIAL_INDORE_COOL_SPOTS;
  }
}

export function saveCrowdsourcedCoolSpot(newSpot: CoolSpot): CoolSpot[] {
  const existingCustom: CoolSpot[] = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();
  const updatedCustom = [newSpot, ...existingCustom];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustom));
  }
  return [...INITIAL_INDORE_COOL_SPOTS, ...updatedCustom];
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function findCoolSpotsAlongRoute(
  spots: CoolSpot[],
  userGps: Coordinates | null,
  activeRoute: RouteAlternative | undefined,
  maxCorridorMeters = 280
): NearbyCoolSpotMatch[] {
  const polyCoords = activeRoute?.geometry?.coordinates || [];

  const matches: NearbyCoolSpotMatch[] = [];

  for (const spot of spots) {
    const distFromUser = userGps
      ? Math.round(haversineMeters(userGps.lat, userGps.lon, spot.coords.lat, spot.coords.lon))
      : 9999;

    let minRouteDist = 9999;
    if (polyCoords.length > 0) {
      for (const [lon, lat] of polyCoords) {
        const d = haversineMeters(lat, lon, spot.coords.lat, spot.coords.lon);
        if (d < minRouteDist) minRouteDist = d;
      }
    } else if (userGps) {
      minRouteDist = distFromUser;
    }

    if (minRouteDist <= maxCorridorMeters || distFromUser <= maxCorridorMeters) {
      matches.push({
        spot,
        distanceFromUserM: distFromUser,
        distanceFromRouteM: Math.round(minRouteDist),
      });
    }
  }

  return matches.sort((a, b) => a.distanceFromUserM - b.distanceFromUserM);
}