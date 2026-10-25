import type { Coordinates } from './route';

export type CoolSpotCategory =
  | 'hydration'      // Public water fountains, RO Pyau stations
  | 'shaded_vendor'  // Shaded coconut water, buttermilk (chhaas), sugarcane juice stalls
  | 'ac_refuge'      // Public malls, metro stations, libraries, hospital lobbies
  | 'canopy_park';   // Dense tree canopy / shaded garden benches

export interface CoolSpot {
  id: string;
  name: string;
  category: CoolSpotCategory;
  coords: Coordinates;
  coolingOffsetC: number; // Estimated local perceived cooling benefit (e.g., -4.5°C)
  description: string;
  openHours: string;
  upvotes: number;
  isCrowdsourced?: boolean;
}

export interface NearbyCoolSpotMatch {
  spot: CoolSpot;
  distanceFromUserM: number;
  distanceFromRouteM: number;
}