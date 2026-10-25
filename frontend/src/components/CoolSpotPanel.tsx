import { useState, type FC, type FormEvent } from 'react';
import {
  Building2,
  CupSoda,
  Droplets,
  Navigation,
  PlusCircle,
  ThumbsUp,
  Trees,
} from 'lucide-react';
import type { CoolSpot, CoolSpotCategory, NearbyCoolSpotMatch } from '../types/coolSpot';
import type { Coordinates } from '../types/route';

interface CoolSpotPanelProps {
  allSpots: CoolSpot[];
  corridorSpots: NearbyCoolSpotMatch[];
  activeCategories: CoolSpotCategory[];
  onToggleCategory: (cat: CoolSpotCategory) => void;
  onDetourToSpot: (spot: CoolSpot) => void;
  onAddCrowdsourcedSpot: (spot: CoolSpot) => void;
  userGps: Coordinates | null;
}

const CATEGORY_META: Record<
  CoolSpotCategory,
  { label: string; badgeColor: string; icon: any }
> = {
  hydration: {
    label: 'WATER / PYAU',
    badgeColor: '#0284c7',
    icon: Droplets,
  },
  shaded_vendor: {
    label: 'SHADED VENDORS',
    badgeColor: '#d97706',
    icon: CupSoda,
  },
  ac_refuge: {
    label: 'AC REFUGE',
    badgeColor: '#4f46e5',
    icon: Building2,
  },
  canopy_park: {
    label: 'TREE CANOPY',
    badgeColor: '#15803d',
    icon: Trees,
  },
};

export const CoolSpotPanel: FC<CoolSpotPanelProps> = ({
  allSpots,
  corridorSpots,
  activeCategories,
  onToggleCategory,
  onDetourToSpot,
  onAddCrowdsourcedSpot,
  userGps,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CoolSpotCategory>('hydration');
  const [description, setDescription] = useState('');
  const [openHours, setOpenHours] = useState('08:00 AM – 09:00 PM');

  const handleCreateSpot = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const coords = userGps || { lat: 22.7215, lon: 75.8755 };
    const defaultOffsets: Record<CoolSpotCategory, number> = {
      hydration: -3.2,
      shaded_vendor: -3.8,
      ac_refuge: -7.0,
      canopy_park: -4.5,
    };

    const newSpot: CoolSpot = {
      id: `crowd-${Date.now()}`,
      name: name.trim(),
      category,
      coords,
      coolingOffsetC: defaultOffsets[category],
      description:
        description.trim() || 'Community-verified cooling & hydration refuge in Indore.',
      openHours,
      upvotes: 1,
      isCrowdsourced: true,
    };

    onAddCrowdsourcedSpot(newSpot);
    setName('');
    setDescription('');
    setShowAddForm(false);
  };

  const displayedMatches = corridorSpots.filter((m) =>
    activeCategories.includes(m.spot.category)
  );

  return (
    <section
      style={{
        marginTop: '1.5rem',
        border: '1.5px solid var(--color-forest, #01472e)',
        borderRadius: '1.5rem',
        padding: '1.5rem',
        backgroundColor: 'var(--color-cream, #fefae0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              opacity: 0.75,
              color: 'var(--color-forest, #01472e)',
            }}
          >
            MICRO-CLIMATE REFUGE & HYDRATION OVERLAY • {allSpots.length} ACTIVE SPOTS
          </div>
          <h3
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
              lineHeight: 1.08,
              color: 'var(--color-forest, #01472e)',
              marginTop: '0.2rem',
            }}
          >
            COOL SPOTS & HYDRATION ALONG YOUR PATH
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          style={{
            padding: '0.65rem 1.15rem',
            fontSize: '0.7rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: 'var(--color-forest, #01472e)',
            color: 'var(--color-cream, #fefae0)',
            borderRadius: '999px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          <PlusCircle size={15} />
          {showAddForm ? 'CLOSE FORM' : '+ CROWDSOURCE COOL SPOT'}
        </button>
      </div>

      {/* Category Toggles */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.55rem',
          marginBottom: '1.25rem',
        }}
      >
        {(Object.keys(CATEGORY_META) as CoolSpotCategory[]).map((cat) => {
          const meta = CATEGORY_META[cat];
          const IconComp = meta.icon;
          const isActive = activeCategories.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggleCategory(cat)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.95rem',
                borderRadius: '999px',
                border: `1.5px solid ${meta.badgeColor}`,
                backgroundColor: isActive ? meta.badgeColor : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-forest, #01472e)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <IconComp size={14} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Crowdsourcing Form Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleCreateSpot}
          style={{
            backgroundColor: 'rgba(1, 71, 46, 0.05)',
            border: '1.5px solid var(--color-forest, #01472e)',
            borderRadius: '1.2rem',
            padding: '1.25rem',
            marginBottom: '1.25rem',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-forest, #01472e)' }}>
            📍 PIN A NEW COOL SPOT AT YOUR CURRENT GPS (
            {userGps
              ? `${userGps.lat.toFixed(4)}, ${userGps.lon.toFixed(4)}`
              : 'Indore Center'}
            )
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.65rem',
            }}
          >
            <input
              type="text"
              placeholder="Spot Name (e.g., Palasia Shaded Pyau)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ccc' }}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CoolSpotCategory)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ccc' }}
            >
              <option value="hydration">💧 Public Water Fountain / Pyau</option>
              <option value="shaded_vendor">🥥 Shaded Juice / Coconut Vendor</option>
              <option value="ac_refuge">❄️ Air-Conditioned Public Refuge</option>
              <option value="canopy_park">🌳 Dense Tree Canopy / Park</option>
            </select>
            <input
              type="text"
              placeholder="Open Hours (e.g., 8 AM - 9 PM)"
              value={openHours}
              onChange={(e) => setOpenHours(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ccc' }}
            />
          </div>
          <input
            type="text"
            placeholder="Short description / tip"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ccc' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              style={{
                backgroundColor: 'var(--color-forest, #01472e)',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
            >
              PUBLISH TO LIVE MAP
            </button>
          </div>
        </form>
      )}

      {/* Corridor Matches Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '0.9rem',
        }}
      >
        {displayedMatches.slice(0, 4).map(({ spot, distanceFromRouteM, distanceFromUserM }) => {
          const meta = CATEGORY_META[spot.category];
          const IconComp = meta.icon;
          return (
            <div
              key={spot.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '1.2rem',
                padding: '1rem 1.15rem',
                border: '1px solid rgba(1, 71, 46, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.6rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      backgroundColor: meta.badgeColor,
                      color: '#fff',
                    }}
                  >
                    <IconComp size={11} />
                    {meta.label}
                  </span>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#15803d',
                    }}
                  >
                    {spot.coolingOffsetC.toFixed(1)}°C Relief
                  </span>
                </div>

                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    marginTop: '0.45rem',
                    color: 'var(--color-forest, #01472e)',
                  }}
                >
                  {spot.name}
                </div>
                <p
                  style={{
                    fontSize: '0.76rem',
                    opacity: 0.85,
                    marginTop: '0.2rem',
                    lineHeight: 1.4,
                  }}
                >
                  {spot.description}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed rgba(1, 71, 46, 0.18)',
                  fontSize: '0.68rem',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--color-forest, #01472e)' }}>
                  {distanceFromRouteM < 900
                    ? `${distanceFromRouteM}m off route`
                    : `${(distanceFromUserM / 1000).toFixed(1)} km away`}{' '}
                  • <ThumbsUp size={11} style={{ display: 'inline' }} /> {spot.upvotes}
                </span>

                <button
                  type="button"
                  onClick={() => onDetourToSpot(spot)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    backgroundColor: 'var(--color-forest, #01472e)',
                    color: 'var(--color-cream, #fefae0)',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '0.32rem 0.75rem',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                  }}
                >
                  <Navigation size={11} />
                  DETOUR HERE
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CoolSpotPanel;