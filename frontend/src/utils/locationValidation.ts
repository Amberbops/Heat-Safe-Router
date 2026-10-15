import type { CityConfig } from '../config/supportedCities';
import type { Coordinates } from '../types/route';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const MIN_DISTANCE_DEGREES = 0.0001; // ~11 meters

export function parseCoordinateInput(latStr: string, lonStr: string): Coordinates | null {
  const lat = Number(latStr.trim());
  const lon = Number(lonStr.trim());
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    latStr.trim() === '' ||
    lonStr.trim() === ''
  ) {
    return null;
  }
  return { lat, lon };
}

export function isWithinCityBounds(coord: Coordinates, city: CityConfig): boolean {
  const { minLat, maxLat, minLon, maxLon } = city.bounds;
  return (
    coord.lat >= minLat &&
    coord.lat <= maxLat &&
    coord.lon >= minLon &&
    coord.lon <= maxLon
  );
}

export function validateRouteCoordinates(
  originLatStr: string,
  originLonStr: string,
  destLatStr: string,
  destLonStr: string,
  city: CityConfig
): { valid: boolean; error?: string; origin?: Coordinates; destination?: Coordinates } {
  const origin = parseCoordinateInput(originLatStr, originLonStr);
  const destination = parseCoordinateInput(destLatStr, destLonStr);

  if (!origin || !destination) {
    return {
      valid: false,
      error: 'Please enter valid numeric latitude and longitude coordinates for both points.',
    };
  }

  if (
    origin.lat < -90 ||
    origin.lat > 90 ||
    destination.lat < -90 ||
    destination.lat > 90 ||
    origin.lon < -180 ||
    origin.lon > 180 ||
    destination.lon < -180 ||
    destination.lon > 180
  ) {
    return {
      valid: false,
      error: 'Coordinates are outside valid geographical ranges (-90 to 90 lat, -180 to 180 lon).',
    };
  }

  if (!isWithinCityBounds(origin, city) || !isWithinCityBounds(destination, city)) {
    return {
      valid: false,
      error:
        'This location is outside our current service area. Please choose a point within a supported city.',
    };
  }

  const latDiff = Math.abs(origin.lat - destination.lat);
  const lonDiff = Math.abs(origin.lon - destination.lon);
  if (latDiff < MIN_DISTANCE_DEGREES && lonDiff < MIN_DISTANCE_DEGREES) {
    return {
      valid: false,
      error:
        'Starting point and destination are effectively identical. Please select two distinct locations.',
    };
  }

  return { valid: true, origin, destination };
}