import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteItem, Coordinate } from "../types/route";

// Fix standard Leaflet default icon issues in bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom styled div icons for modern pin markers
const createOriginIcon = () =>
  L.divIcon({
    className: "custom-map-marker marker-origin",
    html: `
      <div class="marker-pin origin-pin">
        <span class="marker-dot"></span>
        <span class="marker-label">A</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });

const createDestIcon = () =>
  L.divIcon({
    className: "custom-map-marker marker-dest",
    html: `
      <div class="marker-pin dest-pin">
        <span class="marker-dot"></span>
        <span class="marker-label">B</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });

interface MapProps {
  origin: Coordinate;
  destination: Coordinate;
  routes: RouteItem[];
  selectedRouteId: string;
  recommendedRouteId?: string;
  onSelectRoute: (routeId: string) => void;
  onMapClickLocation?: (coord: Coordinate) => void;
  clickTargetMode: "origin" | "destination" | "none";
}

// Subcomponent to fit map bounds to routes or markers
function MapBoundsUpdater({
  origin,
  destination,
  routes,
  selectedRoute,
}: {
  origin: Coordinate;
  destination: Coordinate;
  routes: RouteItem[];
  selectedRoute?: RouteItem;
}) {
  const map = useMap();

  useEffect(() => {
    try {
      const points: [number, number][] = [];

      // If active route has geometry, fit to it
      if (selectedRoute?.geometry?.coordinates?.length) {
        selectedRoute.geometry.coordinates.forEach(([lon, lat]) => {
          points.push([lat, lon]);
        });
      } else if (routes.length > 0) {
        routes.forEach((r) => {
          r.geometry?.coordinates?.forEach(([lon, lat]) => {
            points.push([lat, lon]);
          });
        });
      } else {
        points.push([origin.latitude, origin.longitude]);
        points.push([destination.latitude, destination.longitude]);
      }

      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true,
        });
      }
    } catch (err) {
      console.warn("Could not fit bounds:", err);
    }
  }, [map, origin, destination, routes, selectedRoute]);

  return null;
}

// Subcomponent to handle click on map to set points
function MapClickHandler({
  onMapClickLocation,
  clickTargetMode,
}: {
  onMapClickLocation?: (coord: Coordinate) => void;
  clickTargetMode: "origin" | "destination" | "none";
}) {
  useMapEvents({
    click(e) {
      if (clickTargetMode !== "none" && onMapClickLocation) {
        onMapClickLocation({
          latitude: Number(e.latlng.lat.toFixed(5)),
          longitude: Number(e.latlng.lng.toFixed(5)),
        });
      }
    },
  });

  return null;
}

export const RouteMap: React.FC<MapProps> = ({
  origin,
  destination,
  routes,
  selectedRouteId,
  recommendedRouteId,
  onSelectRoute,
  onMapClickLocation,
  clickTargetMode,
}) => {
  const selectedRoute = routes.find((r) => r.route_id === selectedRouteId);

  // Determine polyline color based on role
  const getRouteColor = (route: RouteItem, isSelected: boolean) => {
    const isRecommended = route.route_id === recommendedRouteId;
    if (isSelected) {
      if (isRecommended) return "#10b981"; // Emerald
      if (route.mode_scores?.fast !== undefined) return "#f59e0b"; // Amber
      return "#0284c7"; // Blue
    }
    // Inactive routes
    return "#94a3b8"; // Slate
  };

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[origin.latitude, origin.longitude]}
        zoom={14}
        scrollWheelZoom={true}
        className="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsUpdater
          origin={origin}
          destination={destination}
          routes={routes}
          selectedRoute={selectedRoute}
        />

        <MapClickHandler
          onMapClickLocation={onMapClickLocation}
          clickTargetMode={clickTargetMode}
        />

        {/* Origin Marker */}
        <Marker
          position={[origin.latitude, origin.longitude]}
          icon={createOriginIcon()}
        >
          <Popup>
            <div className="marker-popup-content">
              <strong>Origin (Start)</strong>
              <div>
                Lat: {origin.latitude}, Lon: {origin.longitude}
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Destination Marker */}
        <Marker
          position={[destination.latitude, destination.longitude]}
          icon={createDestIcon()}
        >
          <Popup>
            <div className="marker-popup-content">
              <strong>Destination (End)</strong>
              <div>
                Lat: {destination.latitude}, Lon: {destination.longitude}
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Render Inactive Routes first so Active Route renders on top */}
        {routes
          .filter((r) => r.route_id !== selectedRouteId)
          .map((route) => {
            const coords = (route.geometry?.coordinates || []).map(
              ([lon, lat]) => [lat, lon] as [number, number]
            );

            return (
              <Polyline
                key={route.route_id}
                positions={coords}
                pathOptions={{
                  color: getRouteColor(route, false),
                  weight: 4,
                  opacity: 0.5,
                  dashArray: "6, 6",
                }}
                eventHandlers={{
                  click: () => onSelectRoute(route.route_id),
                }}
              >
                <Popup>
                  <div className="route-popup">
                    <h4>{route.route_id.toUpperCase()}</h4>
                    <p>Heat Score: {route.heat.heat_score}/100</p>
                    <p>Duration: {route.duration_min} min</p>
                    <p>Distance: {route.distance_km} km</p>
                    <button
                      className="popup-btn"
                      onClick={() => onSelectRoute(route.route_id)}
                    >
                      Select Route
                    </button>
                  </div>
                </Popup>
              </Polyline>
            );
          })}

        {/* Render Selected Route on top with vibrant highlight */}
        {selectedRoute && (
          <Polyline
            key={`selected-${selectedRoute.route_id}`}
            positions={(selectedRoute.geometry?.coordinates || []).map(
              ([lon, lat]) => [lat, lon] as [number, number]
            )}
            pathOptions={{
              color: getRouteColor(selectedRoute, true),
              weight: 6,
              opacity: 0.95,
            }}
          >
            <Popup>
              <div className="route-popup">
                <h4>
                  {selectedRoute.route_id.toUpperCase()}{" "}
                  {selectedRoute.route_id === recommendedRouteId
                    ? "★ Recommended"
                    : ""}
                </h4>
                <p>
                  <strong>Heat Score:</strong> {selectedRoute.heat.heat_score}/100 (
                  {selectedRoute.heat.category})
                </p>
                <p>
                  <strong>Duration:</strong> {selectedRoute.duration_min} min
                </p>
                <p>
                  <strong>Distance:</strong> {selectedRoute.distance_km} km
                </p>
              </div>
            </Popup>
          </Polyline>
        )}
      </MapContainer>
    </div>
  );
};
