import type { FC } from 'react';
import { Check, Clock, Footprints, Flame, Sparkles } from 'lucide-react';
import type { RecommendationsMap, RouteAlternative } from '../types/route';
import { getHeatColorHex } from './Map';

interface RouteCardProps {
  route: RouteAlternative;
  isSelected: boolean;
  recommendations?: RecommendationsMap;
  onSelect: (routeId: string) => void;
}

export const RouteCard: FC<RouteCardProps> = ({
  route,
  isSelected,
  recommendations,
  onSelect,
}) => {
  const routeId = String(route?.route_id || 'route_1');
  const heatScore = Number(route?.heat_score ?? 0);
  const distanceKm = Number(route?.distance_km ?? 0);
  const durationMin = Number(route?.duration_min ?? 0);
  const heatCategory = String(route?.heat_category || 'Moderate Heat');

  const heatColor = getHeatColorHex(heatScore, heatCategory);

  const badges: string[] = [];
  if (recommendations?.heat_safe === routeId) badges.push('HEAT-SAFE PICK');
  if (recommendations?.balanced === routeId) badges.push('BALANCED PICK');
  if (recommendations?.fast === routeId) badges.push('FASTEST PICK');

  const safeFastScore = Number(route?.mode_scores?.fast ?? 0);
  const safeBalancedScore = Number(route?.mode_scores?.balanced ?? 0);
  const safeHeatSafeScore = Number(route?.mode_scores?.heat_safe ?? 0);

  return (
    <article
      className={`route-card ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onSelect(routeId)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(routeId);
        }
      }}
      aria-label={`Route ${routeId}, Heat Score ${heatScore} out of 100`}
    >
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <span className="utility-label" style={{ fontSize: '0.82rem' }}>
            {routeId.replace(/_/g, ' ')}
          </span>
          <span
            style={{
              backgroundColor: heatColor,
              color: '#fefae0',
              padding: '0.3rem 0.85rem',
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {heatCategory}
          </span>
        </div>

        {badges.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              marginBottom: '1.25rem',
            }}
          >
            {badges.map((badge) => (
              <span
                key={badge}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  backgroundColor: 'var(--color-sage)',
                  color: 'var(--color-forest)',
                  padding: '0.28rem 0.7rem',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                }}
              >
                <Sparkles size={11} /> {badge}
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            margin: '1rem 0 1.35rem',
          }}
        >
          <span
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: '3.8rem',
              lineHeight: 0.9,
              color: heatColor,
            }}
          >
            {Number.isFinite(heatScore) ? heatScore.toFixed(0) : '0'}
          </span>
          <span className="utility-label" style={{ opacity: 0.75 }}>
            / 100 ESTIMATED HEAT SCORE
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            padding: '1rem',
            backgroundColor: 'var(--color-olive)',
            borderRadius: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.75 }}>
              <Footprints size={14} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em' }}>
                DISTANCE
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {Number.isFinite(distanceKm) ? distanceKm.toFixed(2) : '0.00'} km
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.75 }}>
              <Clock size={14} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em' }}>
                DURATION
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {Number.isFinite(durationMin) ? durationMin : '0'} min
            </div>
          </div>
        </div>

        {route?.mode_scores && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              opacity: 0.82,
              marginBottom: '1.25rem',
              padding: '0 0.25rem',
            }}
          >
            <span>Fast: {safeFastScore.toFixed(1)}</span>
            <span>Balanced: {safeBalancedScore.toFixed(1)}</span>
            <span>Heat-Safe: {safeHeatSafeScore.toFixed(1)}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(routeId);
        }}
        className={isSelected ? 'btn-pill-primary' : 'btn-pill-secondary'}
        style={{ width: '100%' }}
      >
        {isSelected ? (
          <>
            <Check size={16} /> SELECTED ON MAP
          </>
        ) : (
          <>
            <Flame size={16} /> SELECT ROUTE
          </>
        )}
      </button>
    </article>
  );
};