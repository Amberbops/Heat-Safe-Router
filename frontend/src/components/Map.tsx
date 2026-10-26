import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { Coordinates, RouteAlternative } from '../types/route';
import type { CoolSpot, CoolSpotLogoId } from '../types/coolSpot';

// Fix Leaflet's default marker icons via CDN (avoids Vite PNG bundling issues)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Cool spot icon generator
function getCoolSpotIcon(logoId?: CoolSpotLogoId): L.DivIcon {
  const iconEmojiMap: Record<string, string> = {
    tree_canopy: '🌳',
    water_station: '💧',
    hydration: '💧',
    mist_fountain: '⛲',
    mist_zone: '🌬️',
    indoor_ac: '❄️',
    cooling_shelter: '❄️',
    ac_refuge: '❄️',
    shaded_corridor: '🏛️',
    shaded_stall: '🎪',
    shaded_vendor: '🛍️',
    shaded_park: '🌿',
    green_park: '🌿',
    canopy_park: '🌳',
    transit_shade: '🚏',
    medical_aid: '🏥',
  };

  const emoji = (logoId && iconEmojiMap[logoId]) || '📍';

  return L.divIcon({
    className: 'custom-coolspot-icon',
    html: `<div style="
      background: white;
      border: 2px solid #2d6a4f;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      font-size: 14px;
    ">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Controller for map bounds and view updates
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

// Map click listener for setting Origin / Destination
function MapClickHandler({
  onMapClick,
}: {
  onMapClick?: (coord: Coordinates) => void;
}) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
    },
  });
  return null;
}

export interface RouteMapProps {
  cityCenter: Coordinates;
  origin?: Coordinates | null;
  destination?: Coordinates | null;
  routes?: RouteAlternative[];
  selectedRouteId?: string | null;
  recommendedRouteId?: string | null;
  activeMapClickTarget?: 'origin' | 'destination';
  onMapClickCoordinate?: (coord: Coordinates) => void;
  onSelectRoute?: (routeId: string) => void;
  coolSpots?: CoolSpot[];
  onSelectSpot?: (spot: CoolSpot) => void;
}

export function RouteMap({
  cityCenter,
  origin,
  destination,
  routes = [],
  selectedRouteId,
  recommendedRouteId,
  onMapClickCoordinate,
  onSelectRoute,
  coolSpots = [],
  onSelectSpot,
}: RouteMapProps) {
  const defaultCenter: [number, number] = [
    origin?.lat ?? cityCenter.lat,
    origin?.lon ?? cityCenter.lon,
  ];

  return (
    <div style={{ height: '520px', width: '100%', borderRadius: '1.25rem', overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapController center={defaultCenter} />
        <MapClickHandler onMapClick={onMapClickCoordinate} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Origin Marker */}
        {origin && (
          <Marker position={[origin.lat, origin.lon]}>
            <Popup>
              <strong>Origin</strong>
              <br />
              {origin.lat.toFixed(4)}, {origin.lon.toFixed(4)}
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker position={[destination.lat, destination.lon]}>
            <Popup>
              <strong>Destination</strong>
              <br />
              {destination.lat.toFixed(4)}, {destination.lon.toFixed(4)}
            </Popup>
          </Marker>
        )}

        {/* Routes Polylines */}
        {routes.map((route) => {
          const isSelected = route.route_id === selectedRouteId;
          const isRecommended = route.route_id === recommendedRouteId;
          const coords = route.geometry?.coordinates || [];

          const positions: [number, number][] = coords.map(([lon, lat]) => [
            lat,
            lon,
          ]);

          if (positions.length === 0) return null;

          const color = isSelected
            ? '#01472e' // Dark forest green
            : isRecommended
            ? '#2e7d32' // Green recommendation
            : route.heat_category?.toLowerCase().includes('high')
            ? '#c24134' // Red high heat
            : '#8fae9b'; // Sage alternative

          return (
            <Polyline
              key={route.route_id}
              positions={positions}
              pathOptions={{
                color,
                weight: isSelected ? 6 : 4,
                opacity: isSelected ? 0.95 : 0.6,
                dashArray: isSelected ? undefined : '6, 8',
              }}
              eventHandlers={{
                click: () => onSelectRoute?.(route.route_id),
              }}
            >
              <Popup>
                <strong>{route.heat_category || 'Walking Route'}</strong>
                <br />
                Distance: {route.distance_km} km | Time: {route.duration_min} min
                <br />
                Heat Score: {route.heat_score}/100
              </Popup>
            </Polyline>
          );
        })}

        {/* Cool Spots Markers with TS(2322) undefined protection */}
        {coolSpots.map((spot) => {
          const lat = spot.lat ?? (Array.isArray(spot.coords) ? spot.coords[0] : spot.coords?.lat);
          const lon = spot.lon ?? (Array.isArray(spot.coords) ? spot.coords[1] : spot.coords?.lon);

          // Guard against undefined lat/lon
          if (typeof lat !== 'number' || typeof lon !== 'number') {
            return null;
          }

          const spotPos: [number, number] = [lat, lon];

          return (
            <Marker
              key={spot.spot_id || spot.id}
              position={spotPos}
              icon={getCoolSpotIcon(spot.logo_id)}
              eventHandlers={{
                click: () => onSelectSpot?.(spot),
              }}
            >
              <Popup>
                <strong>{spot.name}</strong>
                <p style={{ margin: '4px 0', fontSize: '12px' }}>{spot.description}</p>
                <div style={{ fontSize: '11px', color: '#555' }}>
                  <span>❄️ Cooling: -{spot.coolingOffsetC ?? 2}°C</span>
                  <br />
                  <span>🕒 Hours: {spot.openHours || 'All Day'}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// Helper to map heat score or category to hex color string
export function getHeatColorHex(score?: number, category?: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('low') || (score !== undefined && score > 0 && score < 35)) {
    return '#2e7d32'; // Low heat (Green)
  }
  if (cat.includes('moderate') || (score !== undefined && score >= 35 && score < 60)) {
    return '#d97706'; // Moderate heat (Amber)
  }
  if (cat.includes('very high') || (score !== undefined && score >= 80)) {
    return '#991b1b'; // Very high heat (Deep red)
  }
  return '#c24134'; // High heat (Red)
}

// Aliases for full backward compatibility
export const Map = RouteMap;
export default RouteMap;