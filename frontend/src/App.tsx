import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Sun,
} from 'lucide-react';
import { checkApiHealth, fetchPlannedRoutes } from './api/plannerApi';
import {
  INITIAL_CITY_ID,
  SUPPORTED_CITIES,
  type CityConfig,
} from './config/supportedCities';
import type {
  Coordinates,
  PlanRouteResponse,
  RecommendationMode,
} from './types/route';
import {
  parseCoordinateInput,
  validateRouteCoordinates,
} from './utils/locationValidation';
import { RouteControls } from './components/RouteControls';
import { RouteMap } from './components/Map';
import { RouteCard } from './components/RouteCard';
import { RouteAnalytics } from './components/RouteAnalytics';
import { WeatherWidget } from './components/WeatherWidget';
import { SystemInfoModal } from './components/SystemInfoModal';

export function App() {
  const [selectedCity, setSelectedCity] = useState<CityConfig>(
    SUPPORTED_CITIES[INITIAL_CITY_ID] || Object.values(SUPPORTED_CITIES)[0]
  );
  const [originLat, setOriginLat] = useState<string>(
    String(SUPPORTED_CITIES[INITIAL_CITY_ID]?.defaultOrigin?.lat || 22.7196)
  );
  const [originLon, setOriginLon] = useState<string>(
    String(SUPPORTED_CITIES[INITIAL_CITY_ID]?.defaultOrigin?.lon || 75.8577)
  );
  const [destLat, setDestLat] = useState<string>(
    String(SUPPORTED_CITIES[INITIAL_CITY_ID]?.defaultDestination?.lat || 22.7256)
  );
  const [destLon, setDestLon] = useState<string>(
    String(SUPPORTED_CITIES[INITIAL_CITY_ID]?.defaultDestination?.lon || 75.8656)
  );
  const [activeMapClickTarget, setActiveMapClickTarget] = useState<
    'origin' | 'destination'
  >('origin');

  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<PlanRouteResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<RecommendationMode>('heat_safe');
  const [isSystemModalOpen, setIsSystemModalOpen] = useState<boolean>(false);

  const activeRequestController = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    const verifyHealth = async () => {
      const healthy = await checkApiHealth();
      if (mounted) setApiOnline(healthy);
    };
    verifyHealth();
    const interval = setInterval(verifyHealth, 45000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.12 }
    );

    const elements = document.querySelectorAll('.reveal-item');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [planResult]);

  const handleCityChange = (cityId: string) => {
    const nextCity = SUPPORTED_CITIES[cityId];
    if (!nextCity) return;

    if (activeRequestController.current) {
      activeRequestController.current.abort();
    }

    setSelectedCity(nextCity);
    setOriginLat(String(nextCity.defaultOrigin.lat));
    setOriginLon(String(nextCity.defaultOrigin.lon));
    setDestLat(String(nextCity.defaultDestination.lat));
    setDestLon(String(nextCity.defaultDestination.lon));

    setPlanResult(null);
    setSelectedRouteId(null);
    setError(null);
    setIsLoading(false);
    setActiveMapClickTarget('origin');
  };

  const handleMapClickCoordinate = (coord: Coordinates) => {
    setError(null);
    if (activeMapClickTarget === 'origin') {
      setOriginLat(String(coord.lat));
      setOriginLon(String(coord.lon));
      setActiveMapClickTarget('destination');
    } else {
      setDestLat(String(coord.lat));
      setDestLon(String(coord.lon));
      setActiveMapClickTarget('origin');
    }
  };

  const handleSwapCoordinates = () => {
    setOriginLat(destLat);
    setOriginLon(destLon);
    setDestLat(originLat);
    setDestLon(originLon);
    setError(null);
  };

  const handleModeChange = (mode: RecommendationMode) => {
    setActiveMode(mode);
    if (planResult?.recommendations?.[mode]) {
      setSelectedRouteId(planResult.recommendations[mode]);
    }
  };

  const executeRoutePlan = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    setError(null);
    setPlanResult(null);
    setSelectedRouteId(null);

    const validation = validateRouteCoordinates(
      originLat,
      originLon,
      destLat,
      destLon,
      selectedCity
    );

    if (!validation.valid || !validation.origin || !validation.destination) {
      setError(validation.error || 'Invalid coordinates.');
      return;
    }

    if (activeRequestController.current) {
      activeRequestController.current.abort();
    }
    const controller = new AbortController();
    activeRequestController.current = controller;

    setIsLoading(true);

    try {
      const response = await fetchPlannedRoutes(
        {
          city: selectedCity.id,
          originLat: validation.origin.lat,
          originLon: validation.origin.lon,
          destLat: validation.destination.lat,
          destLon: validation.destination.lon,
        },
        controller.signal
      );

      setPlanResult(response);
      setApiOnline(true);

      const routesList = Array.isArray(response?.routes) ? response.routes : [];
      const preferredRouteId =
        response?.recommendations?.[activeMode] ||
        response?.recommended_route ||
        routesList[0]?.route_id ||
        null;

      setSelectedRouteId(preferredRouteId);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setPlanResult(null);
      setSelectedRouteId(null);
      setError(
        err?.message ||
          'Unable to calculate routes right now. Please verify your coordinates and try again.'
      );
    } finally {
      if (activeRequestController.current === controller) {
        setIsLoading(false);
      }
    }
  };

  const parsedOrigin = parseCoordinateInput(originLat, originLon);
  const parsedDestination = parseCoordinateInput(destLat, destLon);
  const routesArray = Array.isArray(planResult?.routes) ? planResult.routes : [];
  const selectedRouteObj =
    routesArray.find((r) => r.route_id === selectedRouteId) || routesArray[0] || null;

  const scrollToPlanner = () => {
    document.getElementById('route-planner')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <svg className="noise-overlay" aria-hidden="true">
        <filter id="heatsafe-fractal-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#heatsafe-fractal-noise)" />
      </svg>

      <header className="fixed-nav" role="banner">
        <a
          href="#home"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
        >
          <span
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: '1.35rem',
              letterSpacing: '0.02em',
              lineHeight: 1,
            }}
          >
            — HEATSAFE
          </span>
          <span
            style={{
              fontSize: '0.58rem',
              fontWeight: 700,
              letterSpacing: '0.26em',
              marginTop: '0.15rem',
              opacity: 0.78,
            }}
          >
            CLIMATE-AWARE NAVIGATION
          </span>
        </a>

        <nav aria-label="Primary Navigation">
          <ul className="nav-links">
            <li>
              <a href="#home" className="nav-link">
                HOME
              </a>
            </li>
            <li>
              <a href="#route-planner" className="nav-link">
                ROUTE PLANNER
              </a>
            </li>
            <li>
              <a href="#methodology" className="nav-link">
                METHODOLOGY
              </a>
            </li>
            <li>
              <a href="#analytics" className="nav-link">
                IMPACT
              </a>
            </li>
          </ul>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            type="button"
            onClick={() => setIsSystemModalOpen(true)}
            title="Inspect AWS API Gateway connection status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              backgroundColor: 'var(--color-olive)',
              border: '1px solid rgba(1, 71, 46, 0.18)',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.16em',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  apiOnline === null
                    ? 'var(--heat-moderate)'
                    : apiOnline
                    ? 'var(--heat-low)'
                    : 'var(--heat-very-high)',
              }}
            />
            AWS: {apiOnline === null ? 'CHECKING' : apiOnline ? 'ONLINE' : 'OFFLINE'}
          </button>

          <button
            type="button"
            onClick={scrollToPlanner}
            className="btn-pill-primary"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.72rem' }}
          >
            PLAN A ROUTE
          </button>
        </div>
      </header>

      <main>
        <section
          id="home"
          style={{
            minHeight: '100vh',
            backgroundColor: 'var(--color-sage)',
            padding: '8.5rem clamp(1.5rem, 5vw, 5rem) 4rem',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 'min(96vw, 1480px)',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '3rem',
              alignItems: 'center',
            }}
          >
            <div style={{ zIndex: 2 }}>
              <div className="utility-label" style={{ marginBottom: '1rem' }}>
                ENVIRONMENTAL PEDESTRIAN INTELLIGENCE • {selectedCity?.label || 'Indore'}
              </div>

              <h1 className="display-hero" aria-label="WALK COOLER.">
                <div>
                  {'WALK'.split('').map((char, idx) => (
                    <span
                      key={`w-${idx}`}
                      className="hero-letter"
                      style={{ animationDelay: `${idx * 0.06}s` }}
                    >
                      {char}
                    </span>
                  ))}
                </div>
                <div>
                  {'COOLER.'.split('').map((char, idx) => (
                    <span
                      key={`c-${idx}`}
                      className="hero-letter"
                      style={{ animationDelay: `${(idx + 4) * 0.06}s` }}
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </h1>

              <p
                style={{
                  fontSize: 'clamp(1.05rem, 1.4vw, 1.3rem)',
                  maxWidth: '560px',
                  marginTop: '1.75rem',
                  marginBottom: '2.25rem',
                  fontWeight: 500,
                }}
              >
                Not every shortcut is the smartest route. Discover walking paths that consider
                estimated heat exposure, distance, and travel time.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={scrollToPlanner}
                  className="btn-pill-primary"
                >
                  FIND MY ROUTE <ArrowDownRight size={18} />
                </button>
                <a href="#methodology" className="btn-pill-secondary">
                  HOW IT WORKS <ArrowUpRight size={18} />
                </a>
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                minHeight: '460px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className="card-cream"
                style={{
                  width: '100%',
                  maxWidth: '540px',
                  borderRadius: 'var(--radius-floating)',
                  padding: '2.5rem',
                  position: 'relative',
                  background:
                    'linear-gradient(145deg, var(--color-cream) 0%, var(--color-olive) 100%)',
                }}
              >
                <div
                  className="animate-float"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.75rem',
                  }}
                >
                  <span className="utility-label" style={{ opacity: 0.7 }}>
                    ILLUSTRATIVE ROUTE PREVIEW
                  </span>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--heat-moderate)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-cream)',
                    }}
                  >
                    <Sun size={22} />
                  </div>
                </div>

                <svg
                  viewBox="0 0 400 160"
                  style={{ width: '100%', height: 'auto', marginBottom: '1.5rem' }}
                  aria-hidden="true"
                >
                  <path
                    d="M 24 125 Q 190 95 376 35"
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="5"
                    strokeDasharray="8 8"
                  />
                  <path
                    d="M 24 125 C 110 20, 260 150, 376 35"
                    fill="none"
                    stroke="#2E7D32"
                    strokeWidth="7"
                  />
                  <circle cx="24" cy="125" r="9" fill="#01472e" />
                  <circle cx="376" cy="35" r="9" fill="#C24134" />
                </svg>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div
                    style={{
                      backgroundColor: 'var(--color-cream)',
                      padding: '1rem 1.25rem',
                      borderRadius: '1.5rem',
                      borderLeft: '6px solid var(--heat-high)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div className="utility-label" style={{ fontSize: '0.68rem' }}>
                        ROUTE A — 1.2 KM — HIGHER HEAT
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.2rem' }}>
                        Exposed arterial corridor (Illustrative)
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: 'Anton, sans-serif',
                        fontSize: '1.65rem',
                        color: 'var(--heat-high)',
                      }}
                    >
                      74/100
                    </span>
                  </div>

                  <div
                    className="animate-float-delayed"
                    style={{
                      backgroundColor: 'var(--color-cream)',
                      padding: '1rem 1.25rem',
                      borderRadius: '1.5rem',
                      borderLeft: '6px solid var(--heat-low)',
                      boxShadow: 'var(--shadow-forest-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div className="utility-label" style={{ fontSize: '0.68rem' }}>
                        ROUTE B — 1.5 KM — LOWER ESTIMATED HEAT
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.2rem' }}>
                        Heat-Safe pedestrian alternative (Illustrative)
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: 'Anton, sans-serif',
                        fontSize: '1.65rem',
                        color: 'var(--heat-low)',
                      }}
                    >
                      38/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="route-planner"
          className="section-shell"
          style={{ backgroundColor: 'var(--color-olive)' }}
        >
          <div className="reveal-item">
            <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
              LIVE WEATHER. MULTIPLE ROUTES. SMARTER WALKING. — {selectedCity?.label || 'Indore'}
            </div>
            <h2 className="display-section">
              FIND YOUR
              <br />
              COOLER WAY.
            </h2>
          </div>

          <div className="planner-grid">
            <div>
              <WeatherWidget
                weather={planResult?.weather || null}
                cityLabel={selectedCity?.label || 'Indore'}
                storage={planResult?.storage}
              />

              <RouteControls
                selectedCity={selectedCity}
                onCityChange={handleCityChange}
                originLat={originLat}
                originLon={originLon}
                destLat={destLat}
                destLon={destLon}
                onOriginLatChange={setOriginLat}
                onOriginLonChange={setOriginLon}
                onDestLatChange={setDestLat}
                onDestLonChange={setDestLon}
                activeMapClickTarget={activeMapClickTarget}
                onSelectMapClickTarget={setActiveMapClickTarget}
                onSwapCoordinates={handleSwapCoordinates}
                onSubmit={executeRoutePlan}
                isLoading={isLoading}
                error={error}
                activeMode={activeMode}
                onModeChange={handleModeChange}
                hasRoutes={routesArray.length > 0}
              />
            </div>

            <div>
              <RouteMap
                cityCenter={selectedCity?.center || { lat: 22.7196, lon: 75.8577 }}
                origin={parsedOrigin}
                destination={parsedDestination}
                routes={routesArray}
                selectedRouteId={selectedRouteId}
                recommendedRouteId={
                  planResult?.recommendations?.[activeMode] ||
                  planResult?.recommended_route ||
                  null
                }
                activeMapClickTarget={activeMapClickTarget}
                onMapClickCoordinate={handleMapClickCoordinate}
                onSelectRoute={setSelectedRouteId}
              />
            </div>
          </div>

          {routesArray.length > 0 && (
            <div style={{ marginTop: '3.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <span className="utility-label">
                    {routesArray.length} WALKABLE ALTERNATIVES RETURNED
                  </span>
                  <h3
                    style={{
                      fontFamily: 'Anton, sans-serif',
                      fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                      lineHeight: 0.95,
                      marginTop: '0.35rem',
                    }}
                  >
                    COMPARE ROUTE ALTERNATIVES
                  </h3>
                </div>
                <span className="utility-label" style={{ opacity: 0.75 }}>
                  ACTIVE MODE: {activeMode.replace('_', '-').toUpperCase()}
                </span>
              </div>

              <div className="routes-comparison-grid">
                {routesArray.map((route) => (
                  <RouteCard
                    key={route.route_id}
                    route={route}
                    isSelected={route.route_id === selectedRouteId}
                    recommendations={planResult?.recommendations}
                    onSelect={setSelectedRouteId}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <RouteAnalytics
          routes={routesArray}
          selectedRoute={selectedRouteObj}
          weather={planResult?.weather || null}
          model={planResult?.model}
          onSelectRoute={setSelectedRouteId}
        />

        <section
          id="methodology"
          className="section-shell"
          style={{ backgroundColor: 'var(--color-cream)' }}
        >
          <div className="reveal-item">
            <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
              ENVIRONMENTAL ROUTING ARCHITECTURE
            </div>
            <h2 className="display-section" style={{ marginBottom: '3rem' }}>
              BUILT FOR
              <br />
              BETTER WALKS.
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
            }}
          >
            <div
              className="reveal-item stagger-1"
              style={{
                backgroundColor: 'var(--color-olive)',
                borderRadius: 'var(--radius-card)',
                padding: '2.5rem',
              }}
            >
              <div
                style={{
                  fontFamily: 'Anton, sans-serif',
                  fontSize: '3.5rem',
                  lineHeight: 1,
                  marginBottom: '1rem',
                }}
              >
                01
              </div>
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                UNDERSTAND THE WEATHER
              </div>
              <p style={{ fontSize: '0.98rem', opacity: 0.88 }}>
                Retrieve current ambient temperature, relative humidity, and wind conditions for the
                active urban service area in real time.
              </p>
            </div>

            <div
              className="reveal-item stagger-2"
              style={{
                backgroundColor: 'var(--color-olive)',
                borderRadius: 'var(--radius-card)',
                padding: '2.5rem',
              }}
            >
              <div
                style={{
                  fontFamily: 'Anton, sans-serif',
                  fontSize: '3.5rem',
                  lineHeight: 1,
                  marginBottom: '1rem',
                }}
              >
                02
              </div>
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                EXPLORE ALTERNATIVE ROUTES
              </div>
              <p style={{ fontSize: '0.98rem', opacity: 0.88 }}>
                Generate multiple walkable pedestrian route alternatives with HeiGIT /
                openrouteservice geometry and segment metadata.
              </p>
            </div>

            <div
              className="reveal-item stagger-3"
              style={{
                backgroundColor: 'var(--color-olive)',
                borderRadius: 'var(--radius-card)',
                padding: '2.5rem',
              }}
            >
              <div
                style={{
                  fontFamily: 'Anton, sans-serif',
                  fontSize: '3.5rem',
                  lineHeight: 1,
                  marginBottom: '1rem',
                }}
              >
                03
              </div>
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                COMPARE ESTIMATED EXPOSURE
              </div>
              <p style={{ fontSize: '0.98rem', opacity: 0.88 }}>
                Calculate and compare route exposure using current weather and OSM-derived
                environmental proxies across Fast, Balanced, and Heat-Safe modes.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer
        style={{
          backgroundColor: 'var(--color-forest)',
          color: 'var(--color-sage)',
          borderRadius: 'var(--radius-section) var(--radius-section) 0 0',
          marginTop: '3rem',
          padding: 'clamp(3.5rem, 7vw, 6.5rem) clamp(1.5rem, 5vw, 5rem) 3rem',
        }}
      >
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div className="utility-label" style={{ marginBottom: '1rem', opacity: 0.8 }}>
            — HEATSAFE CLIMATE-AWARE PEDESTRIAN ROUTER
          </div>

          <h2
            className="display-section"
            style={{ color: 'var(--color-sage)', marginBottom: '3rem' }}
          >
            TAKE THE
            <br />
            COOLER PATH.
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '2.5rem',
              paddingBottom: '3rem',
              borderBottom: '1px solid rgba(204, 213, 174, 0.2)',
            }}
          >
            <div>
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                NAVIGATION
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <a href="#route-planner" style={{ textDecoration: 'none' }}>
                    Route Planner
                  </a>
                </li>
                <li>
                  <a href="#analytics" style={{ textDecoration: 'none' }}>
                    Heat Analytics
                  </a>
                </li>
                <li>
                  <a href="#methodology" style={{ textDecoration: 'none' }}>
                    Methodology
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                OPEN SOURCE & INFRASTRUCTURE
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <a
                    href="https://github.com/Amberbops/Heat-Safe-Router"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                      <path d="M9 18c-4.51 2-5-2-7-2" />
                    </svg>
                    GitHub Repository <ArrowUpRight size={14} />
                  </a>
                </li>
                <li>
                  <span>
                    AWS API Status:{' '}
                    <strong>
                      {apiOnline === null ? 'Checking' : apiOnline ? 'Operational' : 'Offline'}
                    </strong>
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                MODEL LIMITATION DISCLAIMER
              </div>
              <p style={{ fontSize: '0.84rem', opacity: 0.82, lineHeight: 1.55 }}>
                Scores reflect estimated relative heat exposure derived from live weather and
                OpenStreetMap surface/waytype proxies. It does not measure physical shade canopy or
                radiant pavement heat and is not medical advice.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginTop: '2rem',
              fontSize: '0.78rem',
              opacity: 0.75,
            }}
          >
            <span>Heat-Safe Router • Powered by AWS Lambda, API Gateway & HeiGIT ORS</span>
            <span>Indore, Madhya Pradesh Service Region</span>
          </div>
        </div>
      </footer>

      <SystemInfoModal
        isOpen={isSystemModalOpen}
        onClose={() => setIsSystemModalOpen(false)}
        isApiOnline={apiOnline}
        requestId={planResult?.request_id}
      />
    </>
  );
}

export default App;