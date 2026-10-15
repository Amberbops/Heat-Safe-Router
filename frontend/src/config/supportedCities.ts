import type { Coordinates } from '../types/route';

export interface CityConfig {
  id: string;
  name: string;
  region: string;
  label: string;
  enabled: boolean;
  defaultOrigin: Coordinates;
  defaultDestination: Coordinates;
  center: Coordinates;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export const SUPPORTED_CITIES: Record<string, CityConfig> = {
  indore: {
    id: 'indore',
    name: 'Indore',
    region: 'Madhya Pradesh',
    label: 'Indore, Madhya Pradesh',
    enabled: true,
    defaultOrigin: { lat: 22.7196, lon: 75.8577 },
    defaultDestination: { lat: 22.7256, lon: 75.8656 },
    center: { lat: 22.7196, lon: 75.8577 },
    bounds: {
      minLat: 22.6,
      maxLat: 22.85,
      minLon: 75.75,
      maxLon: 75.98,
    },
  },
};

export const INITIAL_CITY_ID = 'indore';

export const getEnabledCities = (): CityConfig[] =>
  Object.values(SUPPORTED_CITIES).filter((city) => city.enabled);