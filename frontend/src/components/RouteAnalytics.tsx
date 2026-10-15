import type { FC } from 'react';
import { Cpu, Layers, ShieldAlert, Sun } from 'lucide-react';
import type { ModelMetadata, RouteAlternative, WeatherData } from '../types/route';
import { getHeatColorHex } from './Map';

interface RouteAnalyticsProps {
  routes: RouteAlternative[];
  selectedRoute: RouteAlternative | null;
  weather: WeatherData | null;
  model?: ModelMetadata;
  onSelectRoute: (routeId: string) => void;
}

export const RouteAnalytics: FC<RouteAnalyticsProps> = ({
  routes,
  selectedRoute,
  weather,
  model,
  onSelectRoute,
}) => {
  const isMlEnabled =
    model?.ml_enabled === true ||
    model?.type?.toLowerCase() === 'ml' ||
    model?.name?.toLowerCase().includes('ml');

  const engineLabel = isMlEnabled
    ? 'ML-ASSISTED PREDICTION'
    : 'DETERMINISTIC BASELINE';

  const activeRoute = selectedRoute || routes[0] || null;

  return (
    <section
      id="analytics"
      className="section-shell"
      style={{ backgroundColor: 'var(--color-sage)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
          CLIMATE EXPOSURE TELEMETRY & MODEL ARCHITECTURE
        </div>
        <h2 className="display-section" style={{ marginBottom: '1.5rem' }}>
          THE HEAT
          <br />
          BEHIND THE ROUTE.
        </h2>
        <p
          style={{
            maxWidth: '680px',
            fontSize: '1.05rem',
            marginBottom: '2.5rem',
            opacity: 0.9,
          }}
        >
          Estimated relative heat exposure based on current weather and route metadata. This is a
          comparative pedestrian routing score, not a clinical or medical heat-stress assessment.
        </p>

        <div
          className="card-cream"
          style={{
            padding: '1.75rem 2rem',
            marginBottom: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '1rem',
                backgroundColor: 'var(--color-forest)',
                color: 'var(--color-cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cpu size={24} />
            </div>
            <div>
              <span className="utility-label" style={{ opacity: 0.7 }}>
                ACTIVE SCORING ENGINE
              </span>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.15rem' }}>
                {engineLabel}
              </h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                {isMlEnabled
                  ? 'Scoring computed by the deployed machine-learning heat inference pipeline.'
                  : 'Currently operating on the deterministic heat-exposure baseline engine.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: 'var(--color-olive)',
                padding: '0.55rem 1rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
              }}
            >
              TYPE: {(model?.type || 'DETERMINISTIC').toUpperCase()}
            </div>
            {model?.version && (
              <div
                style={{
                  backgroundColor: 'var(--color-olive)',
                  padding: '0.55rem 1rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                }}
              >
                VERSION: {model.version}
              </div>
            )}
            {model?.feature_schema && model.feature_schema.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--color-olive)',
                  padding: '0.55rem 1rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                }}
              >
                FEATURES: {model.feature_schema.length} INPUTS
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem',
          }}
        >
          <div className="card-cream" style={{ padding: '2.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Sun size={18} />
              <span className="utility-label">
                {activeRoute
                  ? `SELECTED ROUTE METRICS (${activeRoute.route_id})`
                  : 'ROUTE EXPOSURE TELEMETRY'}
              </span>
            </div>

            {activeRoute && weather ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--color-olive)',
                      padding: '1rem',
                      borderRadius: '1.25rem',
                    }}
                  >
                    <span className="utility-label" style={{ fontSize: '0.65rem', opacity: 0.75 }}>
                      FINAL HEAT SCORE
                    </span>
                    <div
                      style={{
                        fontFamily: 'Anton, sans-serif',
                        fontSize: '2.6rem',
                        color: getHeatColorHex(activeRoute.heat_score, activeRoute.heat_category),
                      }}
                    >
                      {activeRoute.heat_score} / 100
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--color-olive)',
                      padding: '1rem',
                      borderRadius: '1.25rem',
                    }}
                  >
                    <span className="utility-label" style={{ fontSize: '0.65rem', opacity: 0.75 }}>
                      WALKING DURATION
                    </span>
                    <div style={{ fontFamily: 'Anton, sans-serif', fontSize: '2.6rem' }}>
                      {activeRoute.duration_min} MIN
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span>Weather Heat Component (80% weight)</span>
                      <span>
                        {activeRoute.weather_heat !== undefined
                          ? `${activeRoute.weather_heat.toFixed(1)} / 100`
                          : 'Included in composite'}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '10px',
                        backgroundColor: 'var(--color-olive)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, activeRoute.weather_heat ?? activeRoute.heat_score)}%`,
                          height: '100%',
                          backgroundColor: 'var(--heat-high)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span>Environmental Exposure Proxy (20% weight)</span>
                      <span>
                        {activeRoute.environmental_exposure !== undefined
                          ? `${activeRoute.environmental_exposure.toFixed(1)} / 100`
                          : 'OSM Surface & Waytype'}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '10px',
                        backgroundColor: 'var(--color-olive)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            activeRoute.environmental_exposure ?? activeRoute.heat_score * 0.85
                          )}%`,
                          height: '100%',
                          backgroundColor: 'var(--color-forest)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '1.75rem',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid rgba(1,71,46,0.12)',
                  }}
                >
                  <span className="utility-label" style={{ display: 'block', marginBottom: '0.75rem' }}>
                    ALTERNATIVE ROUTE EXPOSURE COMPARISON
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {routes.map((r) => (
                      <div
                        key={r.route_id}
                        onClick={() => onSelectRoute(r.route_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem',
                            fontWeight: r.route_id === activeRoute.route_id ? 700 : 500,
                            marginBottom: '0.2rem',
                          }}
                        >
                          <span>
                            {r.route_id.toUpperCase()} ({r.distance_km.toFixed(2)} km,{' '}
                            {r.duration_min} min)
                          </span>
                          <span>{r.heat_score} / 100</span>
                        </div>
                        <div
                          style={{
                            height: '8px',
                            backgroundColor: 'var(--color-olive)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, r.heat_score)}%`,
                              height: '100%',
                              backgroundColor: getHeatColorHex(r.heat_score, r.heat_category),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ fontSize: '0.95rem', opacity: 0.8, marginTop: '1rem' }}>
                Run a route calculation in the planner above to inspect live weather heat scores,
                environmental exposure proxies, and side-by-side route comparisons.
              </p>
            )}
          </div>

          <div className="card-cream" style={{ padding: '2.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Layers size={18} />
              <span className="utility-label">DETERMINISTIC SCORING FORMULA</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  backgroundColor: 'var(--color-olive)',
                  padding: '1.25rem',
                  borderRadius: '1.5rem',
                }}
              >
                <div className="utility-label" style={{ marginBottom: '0.6rem' }}>
                  01 / WEATHER HEAT SCORE (80% OF FINAL)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.88rem',
                  }}
                >
                  <div>
                    • Ambient Temperature: <strong>50%</strong>
                  </div>
                  <div>
                    • Walking Duration: <strong>25%</strong>
                  </div>
                  <div>
                    • Relative Humidity: <strong>15%</strong>
                  </div>
                  <div>
                    • Wind Speed Cooling: <strong>10%</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-olive)',
                  padding: '1.25rem',
                  borderRadius: '1.5rem',
                }}
              >
                <div className="utility-label" style={{ marginBottom: '0.6rem' }}>
                  02 / ENVIRONMENTAL PROXY (20% OF FINAL)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.88rem',
                  }}
                >
                  <div>
                    • OSM Surface Material: <strong>60%</strong>
                  </div>
                  <div>
                    • OSM Waytype Classification: <strong>40%</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: '1.25rem',
                  border: '1px solid rgba(1, 71, 46, 0.2)',
                  fontSize: '0.82rem',
                  opacity: 0.9,
                }}
              >
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <strong>Transparency Note:</strong> Heat-Safe Router does not claim to measure
                  direct shade canopy, live pavement surface temperature, or direct solar radiation.
                  Scores represent relative exposure estimated from live meteorological conditions and
                  OpenStreetMap route metadata.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};