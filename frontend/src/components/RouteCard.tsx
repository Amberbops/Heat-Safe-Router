import React from "react";
import {
  ShieldCheck,
  Zap,
  Scale,
  Clock,
  Navigation,
  Flame,
  CheckCircle2,
} from "lucide-react";
import type { RouteItem, Recommendations } from "../types/route";

interface RouteCardProps {
  route: RouteItem;
  isSelected: boolean;
  recommendations: Recommendations;
  fastestRoute?: RouteItem;
  onSelect: (routeId: string) => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isSelected,
  recommendations,
  fastestRoute,
  onSelect,
}) => {
  const isHeatSafe = recommendations["heat-safe"]?.route_id === route.route_id;
  const isFast = recommendations.fast?.route_id === route.route_id;
  const isBalanced = recommendations.balanced?.route_id === route.route_id;

  const heatScore = route.heat.heat_score;
  const category = route.heat.category;

  // Compute delta compared to fastest route
  let heatDeltaText = "";
  if (fastestRoute && fastestRoute.route_id !== route.route_id) {
    const diffHeat = fastestRoute.heat.heat_score - route.heat.heat_score;
    const diffTime = route.duration_min - fastestRoute.duration_min;
    if (diffHeat > 0) {
      heatDeltaText = `-${diffHeat.toFixed(1)} lower heat (+${Math.max(
        0,
        diffTime
      ).toFixed(1)} min)`;
    }
  }

  const getHeatColorClass = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "low":
        return "heat-low";
      case "moderate":
        return "heat-mod";
      case "high":
        return "heat-high";
      case "very high":
      case "extreme":
        return "heat-extreme";
      default:
        return "heat-mod";
    }
  };

  return (
    <div
      className={`route-card ${isSelected ? "selected" : ""} ${
        isHeatSafe ? "is-heat-safe" : ""
      }`}
      onClick={() => onSelect(route.route_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(route.route_id);
      }}
    >
      <div className="route-card-header">
        <div className="route-badges">
          {isHeatSafe && (
            <span className="mode-badge heat-safe-badge">
              <ShieldCheck size={14} />
              Heat-Safe Pick
            </span>
          )}
          {isFast && (
            <span className="mode-badge fast-badge">
              <Zap size={14} />
              Fastest
            </span>
          )}
          {isBalanced && (
            <span className="mode-badge balanced-badge">
              <Scale size={14} />
              Balanced
            </span>
          )}
          {!isHeatSafe && !isFast && !isBalanced && (
            <span className="mode-badge alt-badge">Alternative Route</span>
          )}
        </div>

        {isSelected && (
          <span className="selected-indicator">
            <CheckCircle2 size={16} /> Selected
          </span>
        )}
      </div>

      <div className="route-main-stats">
        <div className="stat-group heat-stat">
          <div className="stat-label">
            <Flame size={14} /> Heat Score
          </div>
          <div className={`heat-number ${getHeatColorClass(category)}`}>
            {heatScore}
            <span className="score-denom">/100</span>
          </div>
          <span className={`category-tag ${getHeatColorClass(category)}`}>
            {category}
          </span>
        </div>

        <div className="stat-divider" />

        <div className="stat-group time-stat">
          <div className="stat-label">
            <Clock size={14} /> Duration
          </div>
          <div className="stat-val">{route.duration_min} min</div>
          {heatDeltaText && (
            <span className="heat-delta-tag">{heatDeltaText}</span>
          )}
        </div>

        <div className="stat-divider" />

        <div className="stat-group dist-stat">
          <div className="stat-label">
            <Navigation size={14} /> Distance
          </div>
          <div className="stat-val">{route.distance_km} km</div>
          <span className="stat-sub">walking</span>
        </div>
      </div>

      {/* Mini Exposure Progress Bar */}
      <div className="heat-meter-bar-wrap">
        <div className="heat-meter-labels">
          <span>Heat Exposure Index</span>
          <span>{heatScore}%</span>
        </div>
        <div className="heat-meter-track">
          <div
            className={`heat-meter-fill ${getHeatColorClass(category)}`}
            style={{ width: `${Math.min(100, Math.max(5, heatScore))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
