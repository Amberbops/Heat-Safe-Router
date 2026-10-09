import React from "react";
import {
  ArrowUpDown,
  Search,
  Crosshair,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Coordinate } from "../types/route";
import { INDORE_PRESETS } from "../constants/presets";
import type { PresetLocation } from "../constants/presets";

interface RouteControlsProps {
  origin: Coordinate;
  destination: Coordinate;
  onChangeOrigin: (coord: Coordinate) => void;
  onChangeDestination: (coord: Coordinate) => void;
  onSwapCoordinates: () => void;
  onApplyPreset: (preset: PresetLocation) => void;
  onSubmit: () => void;
  isLoading: boolean;
  clickTargetMode: "origin" | "destination" | "none";
  setClickTargetMode: (mode: "origin" | "destination" | "none") => void;
  errorMessage?: string;
}

export const RouteControls: React.FC<RouteControlsProps> = ({
  origin,
  destination,
  onChangeOrigin,
  onChangeDestination,
  onSwapCoordinates,
  onApplyPreset,
  onSubmit,
  isLoading,
  clickTargetMode,
  setClickTargetMode,
  errorMessage,
}) => {
  return (
    <div className="controls-container">
      {/* Quick Presets */}
      <div className="presets-section">
        <div className="section-label">
          <Sparkles size={14} />
          <span>Indore Walking Corridors</span>
        </div>
        <div className="presets-pill-list">
          {INDORE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="preset-btn"
              onClick={() => onApplyPreset(preset)}
              title={`${preset.originName} to ${preset.destName}`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Coordinate Input Form */}
      <div className="coords-form">
        {/* Origin Row */}
        <div className="input-group">
          <div className="input-header">
            <span className="point-badge origin-badge">A</span>
            <label>Origin Coordinates</label>
            <button
              type="button"
              className={`click-pick-btn ${
                clickTargetMode === "origin" ? "active" : ""
              }`}
              onClick={() =>
                setClickTargetMode(
                  clickTargetMode === "origin" ? "none" : "origin"
                )
              }
              title="Click here, then click on the map to set origin"
            >
              <Crosshair size={13} />
              {clickTargetMode === "origin" ? "Click Map..." : "Pick on Map"}
            </button>
          </div>
          <div className="coord-inputs-row">
            <div className="coord-field">
              <span className="field-prefix">Lat</span>
              <input
                type="number"
                step="0.0001"
                value={origin.latitude}
                onChange={(e) =>
                  onChangeOrigin({
                    ...origin,
                    latitude: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="coord-field">
              <span className="field-prefix">Lon</span>
              <input
                type="number"
                step="0.0001"
                value={origin.longitude}
                onChange={(e) =>
                  onChangeOrigin({
                    ...origin,
                    longitude: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="swap-btn-row">
          <button
            type="button"
            className="swap-btn"
            onClick={onSwapCoordinates}
            title="Swap Origin and Destination"
          >
            <ArrowUpDown size={16} />
            <span>Swap Points</span>
          </button>
        </div>

        {/* Destination Row */}
        <div className="input-group">
          <div className="input-header">
            <span className="point-badge dest-badge">B</span>
            <label>Destination Coordinates</label>
            <button
              type="button"
              className={`click-pick-btn ${
                clickTargetMode === "destination" ? "active" : ""
              }`}
              onClick={() =>
                setClickTargetMode(
                  clickTargetMode === "destination" ? "none" : "destination"
                )
              }
              title="Click here, then click on the map to set destination"
            >
              <Crosshair size={13} />
              {clickTargetMode === "destination" ? "Click Map..." : "Pick on Map"}
            </button>
          </div>
          <div className="coord-inputs-row">
            <div className="coord-field">
              <span className="field-prefix">Lat</span>
              <input
                type="number"
                step="0.0001"
                value={destination.latitude}
                onChange={(e) =>
                  onChangeDestination({
                    ...destination,
                    latitude: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="coord-field">
              <span className="field-prefix">Lon</span>
              <input
                type="number"
                step="0.0001"
                value={destination.longitude}
                onChange={(e) =>
                  onChangeDestination({
                    ...destination,
                    longitude: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="error-alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          className="submit-plan-btn"
          onClick={onSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="btn-spinner" />
              <span>Optimizing Routes via AWS...</span>
            </>
          ) : (
            <>
              <Search size={18} />
              <span>Find Heat-Safe Routes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
