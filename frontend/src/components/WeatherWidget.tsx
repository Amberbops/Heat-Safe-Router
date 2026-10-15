import type { FC } from 'react';
import { Thermometer, Droplets, Wind, Database } from 'lucide-react';
import type { StorageMetadata, WeatherData } from '../types/route';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  cityLabel: string;
  storage?: StorageMetadata;
}

export const WeatherWidget: FC<WeatherWidgetProps> = ({
  weather,
  cityLabel,
  storage,
}) => {
  const isDynamoSaved =
    storage?.dynamodb_saved === true || storage?.status === 'saved';

  if (!weather) {
    return (
      <div
        className="card-cream"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          backgroundColor: 'rgba(254, 250, 224, 0.7)',
        }}
      >
        <div className="utility-label" style={{ opacity: 0.75 }}>
          LIVE METEOROLOGICAL TELEMETRY — {cityLabel}
        </div>
        <p style={{ fontSize: '0.88rem', marginTop: '0.35rem', opacity: 0.85 }}>
          Calculate a route to retrieve real-time temperature, humidity, and wind conditions.
        </p>
      </div>
    );
  }

  return (
    <div
      className="card-cream"
      style={{
        padding: '1.35rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span className="utility-label">LIVE TELEMETRY — {cityLabel}</span>
        {isDynamoSaved && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              backgroundColor: 'var(--color-sage)',
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
            }}
          >
            <Database size={12} /> DynamoDB: saved
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-olive)',
            padding: '0.75rem',
            borderRadius: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.75 }}>
            <Thermometer size={14} />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em' }}>
              TEMP
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>
            {weather.temperature_c.toFixed(1)}°C
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-olive)',
            padding: '0.75rem',
            borderRadius: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.75 }}>
            <Droplets size={14} />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em' }}>
              HUMIDITY
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>
            {weather.relative_humidity}%
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-olive)',
            padding: '0.75rem',
            borderRadius: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.75 }}>
            <Wind size={14} />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em' }}>
              WIND
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>
            {weather.wind_speed_kmh.toFixed(1)} <small style={{ fontSize: '0.75rem' }}>km/h</small>
          </div>
        </div>
      </div>
    </div>
  );
};