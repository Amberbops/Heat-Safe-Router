import { useMemo, type FC } from 'react';
import L from 'leaflet';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { Clock, Navigation, ThermometerSnowflake, ThumbsUp } from 'lucide-react';
import type { CoolSpot, CoolSpotCategory } from '../types/coolSpot';

export interface CoolSpotMapLayerProps {
  spots: CoolSpot[];
  activeCategories?: CoolSpotCategory[];
  ambientTempC?: number;
  onDetourToSpot?: (spot: CoolSpot) => void;
}

const CATEGORY_VISUALS: Record<
  CoolSpotCategory,
  {
    label: string;
    bgColor: string;
    emojiLogo: string;
    svgMarkup: string;
  }
> = {
  hydration: {
    label: 'Public Water / Pyau',
    bgColor: '#0284c7',
    emojiLogo: '💧',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
  },
  shaded_vendor: {
    label: 'Shaded Vendor Spot',
    bgColor: '#d97706',
    emojiLogo: '🥥',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"/><path d="M5 8h14"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/><path d="m12 8 1-6h2"/></svg>`,
  },
  ac_refuge: {
    label: 'AC Indoor Refuge',
    bgColor: '#4f46e5',
    emojiLogo: '❄️',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>`,
  },
  canopy_park: {
    label: 'Garden / Tree Canopy',
    bgColor: '#15803d',
    emojiLogo: '🌳',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z"/><path d="M8.5 14.5A4 4 0 0 1 12 8"/></svg>`,
  },
};

function createCategoryDivIcon(category: CoolSpotCategory): L.DivIcon {
  const vis = CATEGORY_VISUALS[category] || CATEGORY_VISUALS.hydration;
  return L.divIcon({
    className: 'cool-spot-div-icon',
    html: `
      <div class="cool-spot-pin" style="background-color: ${vis.bgColor}; color: #ffffff;">
        ${vis.svgMarkup}
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

export const CoolSpotMapLayer: FC<CoolSpotMapLayerProps> = ({
  spots,
  activeCategories,
  ambientTempC,
  onDetourToSpot,
}) => {
  const iconsByCategory = useMemo(() => {
    return {
      hydration: createCategoryDivIcon('hydration'),
      shaded_vendor: createCategoryDivIcon('shaded_vendor'),
      ac_refuge: createCategoryDivIcon('ac_refuge'),
      canopy_park: createCategoryDivIcon('canopy_park'),
    };
  }, []);

  const visibleSpots = useMemo(() => {
    if (!activeCategories || activeCategories.length === 0) return spots;
    return spots.filter((s) => activeCategories.includes(s.category));
  }, [spots, activeCategories]);

  return (
    <>
      {visibleSpots.map((spot) => {
        const vis = CATEGORY_VISUALS[spot.category];
        const estimatedSpotTemp =
          ambientTempC !== undefined
            ? (ambientTempC + spot.coolingOffsetC).toFixed(1)
            : null;

        return (
          <Marker
            key={spot.id}
            position={[spot.coords.lat, spot.coords.lon]}
            icon={iconsByCategory[spot.category]}
          >
            <Tooltip
              direction="top"
              offset={[0, -20]}
              opacity={1}
              className="cool-spot-hover-tooltip"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.95rem' }}>{vis.emojiLogo}</span>
                <span>{vis.label.toUpperCase()}</span>
                <span style={{ opacity: 0.75 }}>• {spot.name}</span>
              </span>
            </Tooltip>

            <Popup className="cool-spot-click-popup" maxWidth={270} minWidth={235}>
              <div style={{ padding: '0.35rem 0.25rem', fontFamily: 'inherit' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.4rem',
                    marginBottom: '0.45rem',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      backgroundColor: vis.bgColor,
                      color: '#ffffff',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>{vis.emojiLogo}</span>
                    {vis.label}
                  </span>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      opacity: 0.8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <ThumbsUp size={11} /> {spot.upvotes}
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: 'Anton, sans-serif',
                    fontSize: '1.1rem',
                    letterSpacing: '0.02em',
                    color: 'var(--color-forest, #01472e)',
                    lineHeight: 1.15,
                  }}
                >
                  {spot.name}
                </div>

                <p
                  style={{
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                    margin: '0.35rem 0 0.65rem',
                    opacity: 0.88,
                  }}
                >
                  {spot.description}
                </p>

                <div
                  style={{
                    backgroundColor: 'rgba(21, 128, 61, 0.12)',
                    border: '1px solid rgba(21, 128, 61, 0.35)',
                    borderRadius: '0.75rem',
                    padding: '0.5rem 0.65rem',
                    marginBottom: '0.45rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#15803d',
                    }}
                  >
                    <ThermometerSnowflake size={15} />
                    <span>EST. TEMP DROPOFF</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: '#15803d',
                      }}
                    >
                      {spot.coolingOffsetC.toFixed(1)}°C
                    </span>
                    {estimatedSpotTemp && (
                      <div style={{ fontSize: '0.62rem', opacity: 0.8 }}>
                        Feels like ~{estimatedSpotTemp}°C
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(1, 71, 46, 0.07)',
                    borderRadius: '0.75rem',
                    padding: '0.45rem 0.65rem',
                    marginBottom: '0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontWeight: 700,
                    }}
                  >
                    <Clock size={13} />
                    SERVING HOURS:
                  </span>
                  <span style={{ fontWeight: 600 }}>{spot.openHours}</span>
                </div>

                {onDetourToSpot && (
                  <button
                    type="button"
                    onClick={() => onDetourToSpot(spot)}
                    style={{
                      width: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      backgroundColor: 'var(--color-forest, #01472e)',
                      color: 'var(--color-cream, #fefae0)',
                      border: 'none',
                      borderRadius: '999px',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      cursor: 'pointer',
                    }}
                  >
                    <Navigation size={12} />
                    ROUTE TO THIS COOL SPOT
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default CoolSpotMapLayer;