import React from "react";
import { Thermometer, Droplets, Wind, Sun, AlertTriangle } from "lucide-react";
import type { WeatherData } from "../types/route";

interface WeatherWidgetProps {
  weather: WeatherData;
  heatCategory?: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  weather,
  heatCategory,
}) => {
  const getCategoryColor = (cat?: string) => {
    switch (cat?.toLowerCase()) {
      case "low":
        return "badge-low";
      case "moderate":
        return "badge-mod";
      case "high":
        return "badge-high";
      case "very high":
      case "extreme":
        return "badge-extreme";
      default:
        return "badge-neutral";
    }
  };

  return (
    <div className="weather-card">
      <div className="weather-header">
        <div className="weather-title">
          <Sun className="weather-icon-sun" size={20} />
          <span>Live Microclimate Conditions</span>
        </div>
        {heatCategory && (
          <span className={`heat-badge ${getCategoryColor(heatCategory)}`}>
            {heatCategory === "Very High" && <AlertTriangle size={13} />}
            {heatCategory} Heat Risk
          </span>
        )}
      </div>

      <div className="weather-metrics-grid">
        <div className="weather-metric-item">
          <div className="metric-icon-wrap temp">
            <Thermometer size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Temperature</span>
            <span className="metric-val">{weather.temperature_c}°C</span>
          </div>
        </div>

        <div className="weather-metric-item">
          <div className="metric-icon-wrap humidity">
            <Droplets size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Humidity</span>
            <span className="metric-val">{weather.humidity_percent}%</span>
          </div>
        </div>

        <div className="weather-metric-item">
          <div className="metric-icon-wrap wind">
            <Wind size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Wind Speed</span>
            <span className="metric-val">{weather.wind_speed_kmh} km/h</span>
          </div>
        </div>
      </div>

      <div className="weather-footer">
        <span className="weather-tz">
          Timezone: {weather.timezone || "Asia/Kolkata (Indore)"}
        </span>
        <span className="weather-note">
          80% weight in model scoring
        </span>
      </div>
    </div>
  );
};
