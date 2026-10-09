import React from "react";
import {
  X,
  Cpu,
  CheckCircle,
} from "lucide-react";
import type { ModelMetadata } from "../types/route";

interface SystemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  model?: ModelMetadata;
  requestId?: string;
  storageStatus?: string;
  tableName?: string;
}

export const SystemInfoModal: React.FC<SystemInfoModalProps> = ({
  isOpen,
  onClose,
  model,
  requestId,
  storageStatus,
  tableName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Cpu size={20} className="modal-icon" />
            <h3>AWS Architecture & Heat Scoring Engine</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Architecture overview */}
          <div className="info-section">
            <h4>Cloud Pipeline Overview</h4>
            <div className="arch-flow">
              <div className="arch-node">
                <span className="node-badge client">Frontend</span>
                <span>React + Vite</span>
              </div>
              <span className="arch-arrow">➔</span>
              <div className="arch-node">
                <span className="node-badge gateway">AWS Gateway</span>
                <span>HTTP REST</span>
              </div>
              <span className="arch-arrow">➔</span>
              <div className="arch-node">
                <span className="node-badge lambda">AWS Lambda</span>
                <span>Python 3.12 Planner</span>
              </div>
              <span className="arch-arrow">➔</span>
              <div className="arch-node">
                <span className="node-badge db">DynamoDB</span>
                <span>{tableName || "HeatSafe_RoutePlans"}</span>
              </div>
            </div>
          </div>

          {/* Model Weights Breakdown */}
          <div className="info-section">
            <h4>Heat Formula Weights</h4>
            <div className="weights-table">
              <div className="weight-row header-row">
                <span>Domain</span>
                <span>Weight</span>
                <span>Inputs</span>
              </div>
              <div className="weight-row">
                <span className="row-domain">Weather Component</span>
                <span className="row-weight highlight">80%</span>
                <span className="row-inputs">
                  Ambient Temperature (50%), Duration (25%), Relative Humidity (15%), Wind Speed (10%)
                </span>
              </div>
              <div className="weight-row">
                <span className="row-domain">Environmental Proxy</span>
                <span className="row-weight highlight">20%</span>
                <span className="row-inputs">
                  Surface Material (60% - Asphalt/Concrete/Gravel) + Road Category (40% - State/Urban/Footway)
                </span>
              </div>
            </div>
          </div>

          {/* Persistence status */}
          <div className="info-section">
            <h4>Telemetry & Audit Storage</h4>
            <div className="telemetry-box">
              <div className="telemetry-item">
                <span className="telemetry-lbl">Request ID:</span>
                <code className="telemetry-code">{requestId || "N/A"}</code>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-lbl">DynamoDB Status:</span>
                <span className="telemetry-pill">
                  <CheckCircle size={13} /> {storageStatus || "saved"}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-lbl">Storage Table:</span>
                <span className="telemetry-table">{tableName || "HeatSafe_RoutePlans"}</span>
              </div>
            </div>
            <p className="note-text">
              {model?.note ||
                "Every route plan is evaluated and persisted in AWS DynamoDB for longitudinal microclimate heat analysis."}
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-dismiss-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
