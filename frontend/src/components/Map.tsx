import { useEffect, type FC } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { Coordinates, RouteAlternative } from '../types/route';

const originIcon = L.divIcon({
  className: '',
  html: `<div class="heatsafe-marker heatsafe-marker-origin">A</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const destinationIcon = L.divIcon({
  className: '',
  html: `<div class="heatsafe-marker heatsafe-marker-dest">B</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export function getHeatColorHex(score: number, category?: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('very high') || score >= 80) return '#C24134';
  if (cat.includes('high') || score >= 60) return '#D97706';
  if (cat.includes('moderate') || score >= 35) return '#E9A23B';
  return '#2E7D32';
}

interface MapViewportUpdaterProps {
  center: Coordinates;
  origin: Coordinates | null;
  destination: Coordinates | null;
  routes: RouteAlternative[];
  selectedRouteId: string | null;
}

const MapViewportUpdater: FC<MapViewportUpdaterProps> = ({
  center,
  origin,
  destination,
  routes,
}) => {
  const map = useMap();

  useEffect(() => {
    if (routes.length > 0) {
      const allLatLngs: [number, number][] = [];
      routes.forEach((route) => {
        route.geometry?.coordinates?.forEach(([lon, lat]) => {
          // GeoJSON [lon, lat] -> Leaflet [lat, lon]
          allLatLngs.push([lat, lon]);
        });
      });

      if (allLatLngs.length > 1) {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        return;
      }
    }

    if (origin && destination) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lon],
        [destination.lat, destination.lon],
      ]);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 });
      return;
    }

    map.setView([center.lat, center.lon], 14);
  }, [map, center.lat, center.lon, origin, destination, routes]);

  return null;
};

interface MapClickHandlerProps {
  onMapClick: (coord: Coordinates) => void;
}

const MapClickHandler: FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick({
        lat: Number(e.latlng.lat.toFixed(5)),
        lon: Number(e.latlng.lng.toFixed(5)),
      });
    },
  });
  return null;
};

export interface RouteMapProps {
  cityCenter: Coordinates;
  origin: Coordinates | null;
  destination: Coordinates | null;
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  recommendedRouteId: string | null;
  activeMapClickTarget: 'origin' | 'destination';
  onMapClickCoordinate: (coord: Coordinates) => void;
  onSelectRoute: (routeId: string) => void;
}

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
}) => {
  return (
    <div
      className="card-cream"
      style={{ padding: '1rem', position: 'relative' }}
      aria-label="Interactive Pedestrian Route Map"
    >
      <div
        style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          zIndex: 500,
          backgroundColor: 'rgba(254, 250, 224, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '0.55rem 1rem',
          borderRadius: '999px',
          border: '1px solid rgba(1, 71, 46, 0.2)',
          boxShadow: '0 8px 24px rgba(1, 71, 46, 0.15)',
          pointerEvents: 'none',
        }}
      >
        <span className="utility-label" style={{ fontSize: '0.68rem' }}>
          CLICK MAP TO SET {activeMapClickTarget === 'origin' ? 'ORIGIN (A)' : 'DESTINATION (B)'}
        </span>
      </div>

      <div className="planner-map-wrapper">
        <MapContainer
          center={[cityCenter.lat, cityCenter.lon]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewportUpdater
            center={cityCenter}
            origin={origin}
            destination={destination}
            routes={routes}
            selectedRouteId={selectedRouteId}
          />

          <MapClickHandler onMapClick={onMapClickCoordinate} />

          {origin && (
            <Marker position={[origin.lat, origin.lon]} icon={originIcon}>
              <Popup>
                <strong>Starting Point (A)</strong>
                <br />
                {origin.lat.toFixed(4)}, {origin.lon.toFixed(4)}
              </Popup>
            </Marker>
          )}

          {destination && (
            <Marker position={[destination.lat, destination.lon]} icon={destinationIcon}>
              <Popup>
                <strong>Destination (B)</strong>
                <br />
                {destination.lat.toFixed(4)}, {destination.lon.toFixed(4)}
              </Popup>
            </Marker>
          )}

          {routes.map((route) => {
            const isSelected = route.route_id === selectedRouteId;
            const isRecommended = route.route_id === recommendedRouteId;
            const leafletPositions: [number, number][] =
              route.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];

            const strokeColor = getHeatColorHex(route.heat_score, route.heat_category);

            return (
              <Polyline
                key={route.route_id}
                positions={leafletPositions}
                pathOptions={{
                  color: strokeColor,
                  weight: isSelected ? 8 : isRecommended ? 6 : 4,
                  opacity: isSelected ? 0.98 : 0.55,
                  dashArray: isSelected ? undefined : '6, 8',
                }}
                eventHandlers={{
                  click: () => onSelectRoute(route.route_id),
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', color: '#01472e' }}>
                    <strong style={{ textTransform: 'uppercase' }}>{route.route_id}</strong>
                    {isRecommended && (
                      <span
                        style={{
                          marginLeft: '0.4rem',
                          fontSize: '0.7rem',
                          backgroundColor: '#ccd5ae',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        Recommended
                      </span>
                    )}
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                      Heat Score: <strong>{route.heat_score} / 100</strong> ({route.heat_category})
                      <br />
                      Distance: <strong>{route.distance_km.toFixed(2)} km</strong>
                      <br />
                      Duration: <strong>{route.duration_min} min</strong>
                    </div>
                  </div>
                </Popup>
              </Polyline>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteMap;