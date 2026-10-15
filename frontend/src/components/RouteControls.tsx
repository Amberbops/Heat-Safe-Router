import type { FC, FormEvent } from 'react';
import { ArrowUpDown, Compass, Crosshair, Loader2, MapPin, Navigation } from 'lucide-react';
import { getEnabledCities, type CityConfig } from '../config/supportedCities';
import type { RecommendationMode } from '../types/route';

interface RouteControlsProps {
  selectedCity: CityConfig;
  onCityChange: (cityId: string) => void;
  originLat: string;
  originLon: string;
  destLat: string;
  destLon: string;
  onOriginLatChange: (val: string) => void;
  onOriginLonChange: (val: string) => void;
  onDestLatChange: (val: string) => void;
  onDestLonChange: (val: string) => void;
  activeMapClickTarget: 'origin' | 'destination';
  onSelectMapClickTarget: (target: 'origin' | 'destination') => void;
  onSwapCoordinates: () => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  error: string | null;
  activeMode: RecommendationMode;
  onModeChange: (mode: RecommendationMode) => void;
  hasRoutes: boolean;
}

export const RouteControls: FC<RouteControlsProps> = ({
  selectedCity,
  onCityChange,
  originLat,
  originLon,
  destLat,
  destLon,
  onOriginLatChange,
  onOriginLonChange,
  onDestLatChange,
  onDestLonChange,
  activeMapClickTarget,
  onSelectMapClickTarget,
  onSwapCoordinates,
  onSubmit,
  isLoading,
  error,
  activeMode,
  onModeChange,
  hasRoutes,
}) => {
  const enabledCities = getEnabledCities();

  return (
    <form
      onSubmit={onSubmit}
      className="card-cream"
      style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      aria-label="Pedestrian Route Planner Controls"
    >
      <div>
        <label
          htmlFor="city-select"
          className="utility-label"
          style={{ display: 'block', marginBottom: '0.55rem' }}
        >
          SELECT CITY
        </label>
        <div>
          <select
            id="city-select"
            className="input-editorial"
            value={selectedCity.id}
            onChange={(e) => onCityChange(e.target.value)}
            disabled={isLoading}
          >
            {enabledCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: '0.76rem', marginTop: '0.4rem', opacity: 0.75 }}>
          Active service bounds: {selectedCity.bounds.minLat}°N–{selectedCity.bounds.maxLat}°N,{' '}
          {selectedCity.bounds.minLon}°E–{selectedCity.bounds.maxLon}°E
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-olive)',
          padding: '0.85rem 1rem',
          borderRadius: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em' }}>
          NEXT MAP CLICK SETS:
        </span>
        <div style={{ display: 'flex', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={() => onSelectMapClickTarget('origin')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '999px',
              border: '1.5px solid var(--color-forest)',
              backgroundColor:
                activeMapClickTarget === 'origin' ? 'var(--color-forest)' : 'transparent',
              color:
                activeMapClickTarget === 'origin'
                  ? 'var(--color-cream)'
                  : 'var(--color-forest)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              cursor: 'pointer',
            }}
          >
            A — ORIGIN
          </button>
          <button
            type="button"
            onClick={() => onSelectMapClickTarget('destination')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '999px',
              border: '1.5px solid var(--color-forest)',
              backgroundColor:
                activeMapClickTarget === 'destination' ? 'var(--color-forest)' : 'transparent',
              color:
                activeMapClickTarget === 'destination'
                  ? 'var(--color-cream)'
                  : 'var(--color-forest)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              cursor: 'pointer',
            }}
          >
            B — DESTINATION
          </button>
        </div>
      </div>

      <fieldset
        style={{
          border:
            activeMapClickTarget === 'origin'
              ? '2px solid var(--color-forest)'
              : '1.5px solid rgba(1, 71, 46, 0.16)',
          borderRadius: '1.5rem',
          padding: '1.15rem',
        }}
      >
        <legend
          className="utility-label"
          style={{
            padding: '0 0.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <MapPin size={14} /> A — STARTING POINT
        </legend>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label
              htmlFor="origin-lat"
              style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.3rem' }}
            >
              LATITUDE
            </label>
            <input
              id="origin-lat"
              type="number"
              step="any"
              className="input-editorial"
              value={originLat}
              onChange={(e) => onOriginLatChange(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="origin-lon"
              style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.3rem' }}
            >
              LONGITUDE
            </label>
            <input
              id="origin-lon"
              type="number"
              step="any"
              className="input-editorial"
              value={originLon}
              onChange={(e) => onOriginLonChange(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectMapClickTarget('origin')}
          style={{
            marginTop: '0.65rem',
            background: 'none',
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            opacity: activeMapClickTarget === 'origin' ? 1 : 0.65,
          }}
        >
          <Crosshair size={13} />
          {activeMapClickTarget === 'origin'
            ? 'Click map to set Starting Point A'
            : 'Pick Point A on Map'}
        </button>
      </fieldset>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-0.65rem 0' }}>
        <button
          type="button"
          onClick={onSwapCoordinates}
          disabled={isLoading}
          aria-label="Swap starting point and destination coordinates"
          className="btn-pill-secondary"
          style={{ padding: '0.55rem 1.15rem', fontSize: '0.7rem' }}
        >
          <ArrowUpDown size={14} /> SWAP A / B
        </button>
      </div>

      <fieldset
        style={{
          border:
            activeMapClickTarget === 'destination'
              ? '2px solid var(--color-forest)'
              : '1.5px solid rgba(1, 71, 46, 0.16)',
          borderRadius: '1.5rem',
          padding: '1.15rem',
        }}
      >
        <legend
          className="utility-label"
          style={{
            padding: '0 0.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Navigation size={14} /> B — DESTINATION
        </legend>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label
              htmlFor="dest-lat"
              style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.3rem' }}
            >
              LATITUDE
            </label>
            <input
              id="dest-lat"
              type="number"
              step="any"
              className="input-editorial"
              value={destLat}
              onChange={(e) => onDestLatChange(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="dest-lon"
              style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.3rem' }}
            >
              LONGITUDE
            </label>
            <input
              id="dest-lon"
              type="number"
              step="any"
              className="input-editorial"
              value={destLon}
              onChange={(e) => onDestLonChange(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectMapClickTarget('destination')}
          style={{
            marginTop: '0.65rem',
            background: 'none',
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            opacity: activeMapClickTarget === 'destination' ? 1 : 0.65,
          }}
        >
          <Crosshair size={13} />
          {activeMapClickTarget === 'destination'
            ? 'Click map to set Destination B'
            : 'Pick Point B on Map'}
        </button>
      </fieldset>

      {hasRoutes && (
        <div>
          <span className="utility-label" style={{ display: 'block', marginBottom: '0.55rem' }}>
            OPTIMIZATION PRIORITY MODE
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {(
              [
                { id: 'heat_safe', label: 'HEAT-SAFE', desc: 'Lower Heat' },
                { id: 'balanced', label: 'BALANCED', desc: 'Smart Tradeoff' },
                { id: 'fast', label: 'FAST', desc: 'Shortest Time' },
              ] as const
            ).map((mode) => {
              const active = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onModeChange(mode.id)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '1rem',
                    border: '1.5px solid var(--color-forest)',
                    backgroundColor: active ? 'var(--color-forest)' : 'var(--color-olive)',
                    color: active ? 'var(--color-cream)' : 'var(--color-forest)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em' }}>
                    {mode.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.15rem' }}>
                    {mode.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(194, 65, 52, 0.12)',
            border: '1.5px solid var(--heat-very-high)',
            color: 'var(--color-forest)',
            padding: '1rem 1.15rem',
            borderRadius: '1.25rem',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <button type="submit" className="btn-pill-primary" disabled={isLoading} style={{ width: '100%' }}>
        {isLoading ? (
          <>
            <Loader2 size={18} /> CALCULATING HEAT-SAFE PATHS...
          </>
        ) : (
          <>
            <Compass size={18} /> ANALYZE WALKING ROUTES
          </>
        )}
      </button>
    </form>
  );
};