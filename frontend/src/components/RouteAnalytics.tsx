import React from "react";
import {
  Activity,
  Layers,
  Thermometer,
  Droplets,
  Wind,
  Clock,
  Info,
} from "lucide-react";
import type { RouteItem } from "../types/route";

interface RouteAnalyticsProps {
  route: RouteItem;
}

const SURFACE_NAMES: Record<number, string> = {
  0: "Unknown / Default",
  1: "Paved",
  2: "Unpaved",
  3: "Asphalt",
  4: "Concrete",
  6: "Metal",
  7: "Wood",
  8: "Compacted Gravel",
  10: "Gravel",
  11: "Dirt",
  12: "Ground",
  13: "Ice/Snow",
  14: "Paving Stones",
  15: "Sand",
  17: "Grass",
  18: "Grass Paver",
};

const WAYTYPE_NAMES: Record<number, string> = {
  0: "Unknown / Standard",
  1: "State Road",
  2: "Urban Road",
  3: "Residential Street",
  4: "Path",
  5: "Track",
  6: "Cycleway",
  7: "Footway / Pedestrian",
  8: "Steps",
  9: "Ferry",
  10: "Construction",
};

export const RouteAnalytics: React.FC<RouteAnalyticsProps> = ({ route }) => {
  const { heat } = route;
  const segments = heat.segments || [];

  // Aggregate surface types by distance
  const surfaceStats: Record<string, number> = {};
  const waytypeStats: Record<string, number> = {};
  let highExposureDist = 0;
  let lowExposureDist = 0;
  const totalDist = segments.reduce((sum, s) => sum + s.distance_km, 0);

  segments.forEach((s) => {
    const sName = SURFACE_NAMES[s.surface_id] || `Surface #${s.surface_id}`;
    surfaceStats[sName] = (surfaceStats[sName] || 0) + s.distance_km;

    const wName = WAYTYPE_NAMES[s.waytype_id] || `Way #${s.waytype_id}`;
    waytypeStats[wName] = (waytypeStats[wName] || 0) + s.distance_km;

    if (s.environmental_exposure > 65) {
      highExposureDist += s.distance_km;
    } else {
      lowExposureDist += s.distance_km;
    }
  });

  const highExposurePct = totalDist > 0 ? Math.round((highExposureDist / totalDist) * 100) : 0;
  const lowExposurePct = totalDist > 0 ? Math.round((lowExposureDist / totalDist) * 100) : 100;

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <Activity size={18} className="analytics-icon" />
        <h3>Heat Score Decomposition ({route.route_id.toUpperCase()})</h3>
      </div>

      {/* Weather vs Environment Split */}
      <div className="split-cards-grid">
        <div className="split-card">
          <div className="split-card-top">
            <span className="split-tag">80% Model Weight</span>
            <span className="split-score">{heat.weather_heat}</span>
          </div>
          <h4>Weather-Induced Heat</h4>
          <p className="split-desc">
            Derived from ambient temperature, humidity, wind cooling, and walking duration.
          </p>
          <div className="split-progress">
            <div
              className="split-progress-fill weather-fill"
              style={{ width: `${Math.min(100, heat.weather_heat)}%` }}
            />
          </div>
        </div>

        <div className="split-card">
          <div className="split-card-top">
            <span className="split-tag">20% Model Weight</span>
            <span className="split-score">{heat.environmental_exposure}</span>
          </div>
          <h4>Environmental Exposure</h4>
          <p className="split-desc">
            Estimated from surface thermal inertia (asphalt/concrete) and street geometry (OSM waytypes).
          </p>
          <div className="split-progress">
            <div
              className="split-progress-fill env-fill"
              style={{ width: `${Math.min(100, heat.environmental_exposure)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sub-components breakdown */}
      {heat.components && (
        <div className="components-breakdown">
          <h4>Component Scores</h4>
          <div className="components-grid">
            <div className="comp-item">
              <div className="comp-label">
                <Thermometer size={14} /> Temp Score (50%)
              </div>
              <div className="comp-bar-wrap">
                <div
                  className="comp-bar-fill temp"
                  style={{ width: `${heat.components.temperature || 0}%` }}
                />
              </div>
              <span className="comp-val">{heat.components.temperature || 0}</span>
            </div>

            <div className="comp-item">
              <div className="comp-label">
                <Droplets size={14} /> Humidity Score (15%)
              </div>
              <div className="comp-bar-wrap">
                <div
                  className="comp-bar-fill humidity"
                  style={{ width: `${heat.components.humidity || 0}%` }}
                />
              </div>
              <span className="comp-val">{heat.components.humidity || 0}</span>
            </div>

            <div className="comp-item">
              <div className="comp-label">
                <Wind size={14} /> Wind Relief (10%)
              </div>
              <div className="comp-bar-wrap">
                <div
                  className="comp-bar-fill wind"
                  style={{ width: `${heat.components.wind || 0}%` }}
                />
              </div>
              <span className="comp-val">{heat.components.wind || 0}</span>
            </div>

            <div className="comp-item">
              <div className="comp-label">
                <Clock size={14} /> Duration Penalty (25%)
              </div>
              <div className="comp-bar-wrap">
                <div
                  className="comp-bar-fill duration"
                  style={{ width: `${heat.components.duration || 0}%` }}
                />
              </div>
              <span className="comp-val">{heat.components.duration || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Segment Analysis */}
      {segments.length > 0 && (
        <div className="segment-analysis-card">
          <div className="segment-analysis-header">
            <Layers size={16} />
            <h4>Route Segment Exposure ({segments.length} segments analyzed)</h4>
          </div>

          <div className="exposure-ratio-bar">
            <div
              className="ratio-segment low-exp"
              style={{ width: `${lowExposurePct}%` }}
              title={`Low/Moderate Exposure: ${lowExposurePct}%`}
            >
              {lowExposurePct > 15 ? `${lowExposurePct}% Shaded / Low Heat` : ""}
            </div>
            <div
              className="ratio-segment high-exp"
              style={{ width: `${highExposurePct}%` }}
              title={`High Exposure: ${highExposurePct}%`}
            >
              {highExposurePct > 15 ? `${highExposurePct}% High Heat` : ""}
            </div>
          </div>

          {/* Top detected surfaces & waytypes */}
          <div className="tags-row">
            <span className="tag-title">Surfaces:</span>
            {Object.entries(surfaceStats)
              .slice(0, 4)
              .map(([name, dist]) => (
                <span key={name} className="feature-pill">
                  {name} ({dist.toFixed(2)} km)
                </span>
              ))}
          </div>

          <div className="tags-row">
            <span className="tag-title">Way types:</span>
            {Object.entries(waytypeStats)
              .slice(0, 4)
              .map(([name, dist]) => (
                <span key={name} className="feature-pill">
                  {name} ({dist.toFixed(2)} km)
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Methodology notice */}
      <div className="methodology-banner">
        <Info size={16} className="info-icon" />
        <p>
          Environmental exposure is calculated from OpenStreetMap road surface and pedestrian tag proxies. 
          Dynamic AWS DynamoDB persistence stores verified route calculations for ongoing microclimate calibration.
        </p>
      </div>
    </div>
  );
};
