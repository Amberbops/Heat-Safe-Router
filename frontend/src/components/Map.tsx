import { useEffect, useState, type FC } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates, RouteAlternative } from '../types/route';
import type { CoolSpot, CoolSpotCategory } from '../types/coolSpot';
import { loadAllCoolSpots } from '../config/indoreCoolSpots';
import { CoolSpotMapLayer } from './CoolSpotMapLayer';

export interface RouteMapProps {
  cityCenter: Coordinates;
  origin: Coordinates | null;
  destination: Coordinates | null;
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  recommendedRouteId?: string | null;
  activeMapClickTarget: 'origin' | 'destination' | null;
  onMapClickCoordinate: (coords: Coordinates) => void;
  onSelectRoute: (routeId: string) => void;
  ambientTempC?: number;
  coolSpots?: CoolSpot[];
  onDetourToCoolSpot?: (spot: CoolSpot) => void;
}

export function getHeatColorHex(heatScore: number, heatCategory?: string): string {
  const cat = (heatCategory || '').toLowerCase();
  if (cat.includes('very high') || heatScore >= 80) return '#C24134';
  if (cat.includes('high') || heatScore >= 60) return '#D97706';
  if (cat.includes('moderate') || heatScore >= 35) return '#E9A23B';
  return '#2E7D32';
}

function getRouteStrokeColor(
  heatScore: number,
  isSelected: boolean,
  heatCategory?: string
): string {
  if (!isSelected) return '#6b7f6e';
  return getHeatColorHex(heatScore, heatCategory);
}

interface ViewportControllerProps {
  cityCenter: Coordinates;
  origin: Coordinates | null;
  destination: Coordinates | null;
  routes: RouteAlternative[];
}

const ViewportController: FC<ViewportControllerProps> = ({
  cityCenter,
  origin,
  destination,
  routes,
}) => {
  const map = useMap();

  useEffect(() => {
    const latLngs: [number, number][] = [];

    if (routes.length > 0) {
      routes.forEach((route) => {
        route.geometry?.coordinates?.forEach(([lon, lat]) => {
          latLngs.push([lat, lon]);
        });
      });
    } else {
      if (origin) latLngs.push([origin.lat, origin.lon]);
      if (destination) latLngs.push([destination.lat, destination.lon]);
    }

    if (latLngs.length >= 2) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 14);
    } else {
      map.setView([cityCenter.lat, cityCenter.lon], 13);
    }
  }, [cityCenter.lat, cityCenter.lon, origin, destination, routes, map]);

  return null;
};

interface MapClickHandlerProps {
  activeTarget: 'origin' | 'destination' | null;
  onPickCoordinate: (coords: Coordinates) => void;
}

const MapClickHandler: FC<MapClickHandlerProps> = ({ activeTarget, onPickCoordinate }) => {
  useMapEvents({
    click(e) {
      if (!activeTarget) return;
      onPickCoordinate({
        lat: Number(e.latlng.lat.toFixed(5)),
        lon: Number(e.latlng.lng.toFixed(5)),
      });
    },
  });
  return null;
};

const CATEGORY_PILLS: Array<{
  id: CoolSpotCategory;
  label: string;
  logo: string;
  color: string;
}> = [
  { id: 'hydration', label: 'Water / Pyau', logo: '💧', color: '#0284c7' },
  { id: 'shaded_vendor', label: 'Vendor Spot', logo: '🥥', color: '#d97706' },
  { id: 'ac_refuge', label: 'AC Refuge', logo: '❄️', color: '#4f46e5' },
  { id: 'canopy_park', label: 'Garden Canopy', logo: '🌳', color: '#15803d' },
];

export const RouteMap: FC<RouteMapProps> = ({
  cityCenter,
  origin,
  destination,
  routes,
  selectedRouteId,
  recommendedRouteId,
  activeMapClickTarget,
  onMapClickCoordinate,
  onSelectRoute,
  ambientTempC,
  coolSpots,
  onDetourToCoolSpot,
}) => {
  const [defaultSpots] = useState<CoolSpot[]>(() => loadAllCoolSpots());
  const [showCoolSpots, setShowCoolSpots] = useState<boolean>(true);
  const [activeCategories, setActiveCategories] = useState<CoolSpotCategory[]>([
    'hydration',
    'shaded_vendor',
    'ac_refuge',
    'canopy_park',
  ]);

  const spotsToRender = coolSpots || defaultSpots;

  const toggleCategory = (cat: CoolSpotCategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '500px',
        borderRadius: '1.5rem',
        overflow: 'hidden',
        border: '2px solid var(--color-forest, #01472e)',
      }}
    >
      {/* Floating Map Overlay Toolbar for Cool Spots */}
      <div
        style={{
          position: 'absolute',
          top: '0.85rem',
          right: '0.85rem',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.45rem',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: '0.35rem',
            backgroundColor: 'rgba(254, 250, 224, 0.94)',
            backdropFilter: 'blur(8px)',
            padding: '0.4rem 0.55rem',
            borderRadius: '999px',
            border: '1.5px solid var(--color-forest, #01472e)',
            boxShadow: '0 10px 25px rgba(1, 71, 46, 0.18)',
          }}
        >
          <button
            type="button"
            onClick={() => setShowCoolSpots((prev) => !prev)}
            style={{
              padding: '0.28rem 0.65rem',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: showCoolSpots ? 'var(--color-forest, #01472e)' : 'transparent',
              color: showCoolSpots
                ? 'var(--color-cream, #fefae0)'
                : 'var(--color-forest, #01472e)',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            {showCoolSpots ? '✦ COOL SPOTS ON' : 'COOL SPOTS OFF'}
          </button>

          {showCoolSpots &&
            CATEGORY_PILLS.map((pill) => {
              const active = activeCategories.includes(pill.id);
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => toggleCategory(pill.id)}
                  title={`Toggle ${pill.label}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '999px',
                    border: `1.5px solid ${pill.color}`,
                    backgroundColor: active ? pill.color : 'transparent',
                    color: active ? '#ffffff' : 'var(--color-forest, #01472e)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{pill.logo}</span>
                  <span>{pill.label}</span>
                </button>
              );
            })}
        </div>

        {activeMapClickTarget && (
          <div
            style={{
              backgroundColor: 'var(--color-forest, #01472e)',
              color: 'var(--color-cream, #fefae0)',
              padding: '0.35rem 0.85rem',
              borderRadius: '999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              boxShadow: '0 8px 20px rgba(1, 71, 46, 0.25)',
            }}
          >
            📍 CLICK ANYWHERE ON MAP TO SET {activeMapClickTarget.toUpperCase()}
          </div>
        )}
      </div>

      <MapContainer
        center={[cityCenter.lat, cityCenter.lon]}
        zoom={13}
        style={{ width: '100%', height: '100%', minHeight: '500px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ViewportController
          cityCenter={cityCenter}
          origin={origin}
          destination={destination}
          routes={routes}
        />

        <MapClickHandler
          activeTarget={activeMapClickTarget}
          onPickCoordinate={onMapClickCoordinate}
        />

        {/* Render Walking Route Polylines */}
        {routes.map((route) => {
          const isSelected = route.route_id === selectedRouteId;
          const isRecommended = route.route_id === recommendedRouteId;
          const positions: [number, number][] =
            route.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];

          if (positions.length === 0) return null;

          return (
            <Polyline
              key={route.route_id}
              positions={positions}
              pathOptions={{
                color: getRouteStrokeColor(route.heat_score, isSelected, route.heat_category),
                weight: isSelected ? 7 : 4,
                opacity: isSelected ? 0.96 : 0.55,
                dashArray: isSelected ? undefined : '6, 8',
              }}
              eventHandlers={{
                click: () => onSelectRoute(route.route_id),
              }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                  {route.route_id.toUpperCase()} {isRecommended ? '★ (Heat-Safe Pick)' : ''}
                  <br />
                  {route.distance_km.toFixed(2)} km • {route.duration_min} min • Heat{' '}
                  {route.heat_score}/100
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Origin Marker */}
        {origin && (
          <CircleMarker
            center={[origin.lat, origin.lon]}
            radius={9}
            pathOptions={{
              color: '#fefae0',
              weight: 3,
              fillColor: '#01472e',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <strong>Walking Origin</strong>
              <br />
              {origin.lat.toFixed(4)}, {origin.lon.toFixed(4)}
            </Popup>
          </CircleMarker>
        )}

        {/* Destination Marker */}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lon]}
            radius={9}
            pathOptions={{
              color: '#fefae0',
              weight: 3,
              fillColor: '#c24134',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <strong>Walking Destination</strong>
              <br />
              {destination.lat.toFixed(4)}, {destination.lon.toFixed(4)}
            </Popup>
          </CircleMarker>
        )}

        {/* Interactive Cool Spot Layer (Hover Logo + Click Serving Hours & Temp Dropoff) */}
        {showCoolSpots && (
          <CoolSpotMapLayer
            spots={spotsToRender}
            activeCategories={activeCategories}
            ambientTempC={ambientTempC}
            onDetourToSpot={(spot: CoolSpot) => {
              if (onDetourToCoolSpot) {
                onDetourToCoolSpot(spot);
              } else {
                onMapClickCoordinate(spot.coords);
              }
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export const Map = RouteMap;
export default RouteMap;