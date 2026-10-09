import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Activity,
  Info,
  CloudSun,
  Flame,
  CheckCircle2,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { RouteMap } from "./components/Map";
import { RouteControls } from "./components/RouteControls";
import { INDORE_PRESETS } from "./constants/presets";
import type { PresetLocation } from "./constants/presets";
import { RouteCard } from "./components/RouteCard";
import { RouteAnalytics } from "./components/RouteAnalytics";
import { WeatherWidget } from "./components/WeatherWidget";
import { SystemInfoModal } from "./components/SystemInfoModal";
import { checkHealth, fetchRoutePlan } from "./api/plannerApi";
import type { HealthResponse } from "./api/plannerApi";
import type { Coordinate, RoutePlanResponse, RouteItem } from "./types/route";
import "./App.css";

export function App() {
  const [origin, setOrigin] = useState<Coordinate>(INDORE_PRESETS[0].origin);
  const [destination, setDestination] = useState<Coordinate>(INDORE_PRESETS[0].dest);
  const [routePlan, setRoutePlan] = useState<RoutePlanResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [clickTargetMode, setClickTargetMode] = useState<"origin" | "destination" | "none">("none");
  const [showSystemModal, setShowSystemModal] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"routes" | "analytics">("routes");

  // Fetch route plan
  const planRouteWithCoords = useCallback(
    async (startCoord: Coordinate, endCoord: Coordinate) => {
      setIsLoading(true);
      setError(null);

      try {
        const plan = await fetchRoutePlan(
          startCoord.latitude,
          startCoord.longitude,
          endCoord.latitude,
          endCoord.longitude
        );

        setRoutePlan(plan);
        const recommendedId =
          plan.recommendations["heat-safe"]?.route_id || plan.routes[0]?.route_id;
        setSelectedRouteId(recommendedId);
      } catch (err) {
        console.error("Route planning error:", err);
        setError(err instanceof Error ? err.message : "Failed to compute routes");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    let isSubscribed = true;

    async function initialize() {
      try {
        const res = await checkHealth();
        if (isSubscribed) setHealth(res);
      } catch (err) {
        if (isSubscribed) {
          setHealthError(err instanceof Error ? err.message : "AWS Backend unreachable");
        }
      }

      try {
        const plan = await fetchRoutePlan(
          INDORE_PRESETS[0].origin.latitude,
          INDORE_PRESETS[0].origin.longitude,
          INDORE_PRESETS[0].dest.latitude,
          INDORE_PRESETS[0].dest.longitude
        );
        if (isSubscribed) {
          setRoutePlan(plan);
          const recommendedId =
            plan.recommendations["heat-safe"]?.route_id || plan.routes[0]?.route_id;
          setSelectedRouteId(recommendedId);
        }
      } catch (err) {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : "Failed to compute routes");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    initialize();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Handle preset selection
  const handleApplyPreset = (preset: PresetLocation) => {
    setOrigin(preset.origin);
    setDestination(preset.dest);
    planRouteWithCoords(preset.origin, preset.dest);
  };

  // Handle coordinate swap
  const handleSwapCoordinates = () => {
    const nextOrigin = destination;
    const nextDest = origin;
    setOrigin(nextOrigin);
    setDestination(nextDest);
    planRouteWithCoords(nextOrigin, nextDest);
  };

  // Handle map click
  const handleMapClickLocation = (coord: Coordinate) => {
    if (clickTargetMode === "origin") {
      setOrigin(coord);
      setClickTargetMode("none");
    } else if (clickTargetMode === "destination") {
      setDestination(coord);
      setClickTargetMode("none");
    }
  };

  const selectedRoute: RouteItem | undefined = routePlan?.routes.find(
    (r) => r.route_id === selectedRouteId
  ) || routePlan?.routes[0];

  const fastestRoute: RouteItem | undefined = routePlan?.routes.find(
    (r) => r.route_id === routePlan.recommendations.fast?.route_id
  );

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo-wrap">
            <Shield className="brand-icon" size={24} />
            <Flame className="brand-flame" size={14} />
          </div>
          <div className="brand-text">
            <h1>Heat-Safe Router</h1>
            <span className="brand-tagline">Indore Microclimate Pedestrian Engine</span>
          </div>
        </div>

        <div className="header-actions">
          {/* AWS Live Status */}
          <div className="status-pill-wrap">
            {health ? (
              <span className="status-pill online" title={`Connected to ${health.service}`}>
                <span className="status-dot green" />
                AWS Active
              </span>
            ) : healthError ? (
              <span className="status-pill error" title={healthError}>
                <span className="status-dot red" />
                AWS Error
              </span>
            ) : (
              <span className="status-pill checking">
                <RefreshCw className="spin-icon" size={12} />
                Connecting...
              </span>
            )}
          </div>

          {/* Quick Weather Capsule in Header */}
          {routePlan?.weather && (
            <div className="weather-capsule">
              <CloudSun size={15} />
              <span>{routePlan.weather.temperature_c}°C</span>
              <span className="capsule-sub">Indore</span>
            </div>
          )}

          {/* Info Modal Trigger */}
          <button
            type="button"
            className="info-btn"
            onClick={() => setShowSystemModal(true)}
            title="View AWS System Architecture & Heat Weights"
          >
            <Info size={16} />
            <span>Architecture & Scoring</span>
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="app-layout">
        {/* Left Sidebar: Controls, Cards, Analytics */}
        <aside className="app-sidebar">
          {/* Controls Card */}
          <RouteControls
            origin={origin}
            destination={destination}
            onChangeOrigin={setOrigin}
            onChangeDestination={setDestination}
            onSwapCoordinates={handleSwapCoordinates}
            onApplyPreset={handleApplyPreset}
            onSubmit={() => planRouteWithCoords(origin, destination)}
            isLoading={isLoading}
            clickTargetMode={clickTargetMode}
            setClickTargetMode={setClickTargetMode}
            errorMessage={error || undefined}
          />

          {/* Weather Widget */}
          {routePlan?.weather && (
            <WeatherWidget
              weather={routePlan.weather}
              heatCategory={selectedRoute?.heat.category}
            />
          )}

          {/* Navigation Tabs (Routes vs Deep Analytics) */}
          {routePlan && (
            <div className="sidebar-tabs">
              <button
                type="button"
                className={`tab-btn ${activeSidebarTab === "routes" ? "active" : ""}`}
                onClick={() => setActiveSidebarTab("routes")}
              >
                <Sliders size={15} />
                <span>Route Options ({routePlan.routes.length})</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeSidebarTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveSidebarTab("analytics")}
              >
                <Activity size={15} />
                <span>Heat Analytics</span>
              </button>
            </div>
          )}

          {/* Tab Content: Routes List */}
          {activeSidebarTab === "routes" && routePlan && (
            <div className="routes-list-section">
              <div className="routes-list-header">
                <span className="routes-count">
                  {routePlan.routes.length} Alternatives Calculated
                </span>
                <span className="db-save-tag" title="Saved in AWS DynamoDB">
                  <CheckCircle2 size={12} /> DynamoDB: {routePlan.storage?.status || "saved"}
                </span>
              </div>

              <div className="route-cards-stack">
                {/* Always prioritize the Heat-Safe route first */}
                {[...routePlan.routes]
                  .sort((a, b) => {
                    const aIsSafe = a.route_id === routePlan.recommendations["heat-safe"]?.route_id;
                    const bIsSafe = b.route_id === routePlan.recommendations["heat-safe"]?.route_id;
                    if (aIsSafe) return -1;
                    if (bIsSafe) return 1;
                    return a.heat.heat_score - b.heat.heat_score;
                  })
                  .map((route) => (
                    <RouteCard
                      key={route.route_id}
                      route={route}
                      isSelected={route.route_id === selectedRouteId}
                      recommendations={routePlan.recommendations}
                      fastestRoute={fastestRoute}
                      onSelect={(id) => setSelectedRouteId(id)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Tab Content: Deep Analytics */}
          {activeSidebarTab === "analytics" && selectedRoute && (
            <RouteAnalytics route={selectedRoute} />
          )}
        </aside>

        {/* Right Pane: Interactive Map */}
        <section className="app-map-section">
          {clickTargetMode !== "none" && (
            <div className="map-instruction-overlay">
              <span>
                Click anywhere on the map to set <strong>{clickTargetMode.toUpperCase()}</strong>
              </span>
              <button
                type="button"
                className="cancel-pick-btn"
                onClick={() => setClickTargetMode("none")}
              >
                Cancel
              </button>
            </div>
          )}

          <RouteMap
            origin={origin}
            destination={destination}
            routes={routePlan?.routes || []}
            selectedRouteId={selectedRouteId}
            recommendedRouteId={routePlan?.recommendations["heat-safe"]?.route_id}
            onSelectRoute={(id) => setSelectedRouteId(id)}
            onMapClickLocation={handleMapClickLocation}
            clickTargetMode={clickTargetMode}
          />
        </section>
      </main>

      {/* System & Architecture Modal */}
      <SystemInfoModal
        isOpen={showSystemModal}
        onClose={() => setShowSystemModal(false)}
        model={routePlan?.model}
        requestId={routePlan?.request_id}
        storageStatus={routePlan?.storage?.status}
        tableName={routePlan?.storage?.table}
      />
    </div>
  );
}

export default App;