import { useState, type FC, type ChangeEvent, type FormEvent } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Camera,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Trash2,
  Edit3,
  MapPin,
  LogOut,
  Sparkles,
  Navigation,
} from 'lucide-react';
import {
  COOL_SPOT_LOGOS,
  type AuthSession,
  type CoolSpot,
  type CoolSpotLogoId,
  type CoolSpotRequest,
} from '../types/coolSpot';
import {
  logoutAwsSession,
  submitCoolSpotRequest,
  upsertAdminCoolSpot,
  deleteAdminCoolSpot,
  updateAdminRequest,
} from '../api/plannerApi';
import { useAuth } from '../context/AuthContext';

interface CoolSpotPortalProps {
  cityId: string;
  cityLabel: string;
  defaultCoords: { lat: number; lon: number };
  session: AuthSession;
  onSessionChange: (session: AuthSession) => void;
  coolSpots: CoolSpot[];
  requests: CoolSpotRequest[];
  onRefreshData: () => void;
  onFocusSpotOnMap?: (lat: number, lon: number) => void;
}

export const CoolSpotPortal: FC<CoolSpotPortalProps> = ({
  cityId,
  cityLabel,
  defaultCoords,
  session,
  onSessionChange,
  coolSpots,
  requests,
  onRefreshData,
  onFocusSpotOnMap,
}) => {
  const { openAuthModal, loginWithAmazon, login } = useAuth();

  // Login Form State
  const [loginRoleTab, setLoginRoleTab] = useState<'user' | 'admin'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // User Cool Spot Submission State
  const [reqName, setReqName] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [reqLat, setReqLat] = useState(String(defaultCoords.lat));
  const [reqLon, setReqLon] = useState(String(defaultCoords.lon));
  const [reqLogo, setReqLogo] = useState<CoolSpotLogoId>('tree_canopy');
  const [reqSpotImage, setReqSpotImage] = useState<string>('');
  const [userSubmitSuccess, setUserSubmitSuccess] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);

  // Admin No-Code Builder State
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminDesc, setAdminDesc] = useState('');
  const [adminLat, setAdminLat] = useState(String(defaultCoords.lat));
  const [adminLon, setAdminLon] = useState(String(defaultCoords.lon));
  const [adminLogo, setAdminLogo] = useState<CoolSpotLogoId>('tree_canopy');
  const [adminSpotImage, setAdminSpotImage] = useState<string>('');
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminQueueError, setAdminQueueError] = useState<string | null>(null);
  const [adminQueueNotice, setAdminQueueNotice] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // Convert uploaded Cool Spot photo for S3 / storage preview
  const handleImageFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Autofill user's current GPS coordinates if they are standing at the Cool Spot
  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setReqLat(pos.coords.latitude.toFixed(6));
        setReqLon(pos.coords.longitude.toFixed(6));
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Handle Login via unified AWS Auth
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setAuthLoading(true);
    setLoginError(null);
    try {
      await login(email.trim(), password);
      setPassword('');
    } catch (err: any) {
      setLoginError(err?.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle User Submitting Cool Spot Request (Image + Lat/Lon + Message)
  const handleUserRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reqName.trim() || !reqMessage.trim()) return;

    await submitCoolSpotRequest(
      {
        city: cityId,
        user_email: session.email || 'user@heatsafe.in',
        suggested_name: reqName.trim(),
        message: reqMessage.trim(),
        lat: parseFloat(reqLat) || defaultCoords.lat,
        lon: parseFloat(reqLon) || defaultCoords.lon,
        suggested_logo: reqLogo,
        spot_image_url: reqSpotImage,
      },
      session.token
    );

    setReqName('');
    setReqMessage('');
    setReqSpotImage('');
    setUserSubmitSuccess(
      'Your Cool Spot photo, coordinates (Lat/Lon), and message have been forwarded to the Admin Console!'
    );
    onRefreshData();
    setTimeout(() => setUserSubmitSuccess(null), 5000);
  };

  // Handle Admin No-Code Create / Edit Cool Spot
  const handleAdminSaveSpot = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) return;

    await upsertAdminCoolSpot(
      {
        id: editingSpotId || crypto.randomUUID(),
        spot_id: editingSpotId || undefined,
        city: cityId,
        name: adminName.trim(),
        description: adminDesc.trim(),
        lat: parseFloat(adminLat) || defaultCoords.lat,
        lon: parseFloat(adminLon) || defaultCoords.lon,
        coords: {
          lat: parseFloat(adminLat) || defaultCoords.lat,
          lon: parseFloat(adminLon) || defaultCoords.lon,
        },
        logo_id: adminLogo,
        image_url: adminSpotImage || undefined,
        verified_by: session.email,
      },
      session.token
    );

    setEditingSpotId(null);
    setAdminName('');
    setAdminDesc('');
    setAdminSpotImage('');
    setAdminNotice(editingSpotId ? 'Cool Spot updated on map!' : 'New Cool Spot published to map!');
    onRefreshData();
    setTimeout(() => setAdminNotice(null), 4000);
  };

  // Admin 1-Click Verify & Approve User Request (uses backend atomic transaction)
  const handleApproveRequest = async (req: CoolSpotRequest) => {
    setAdminQueueError(null);
    setAdminQueueNotice(null);
    setProcessingRequestId(req.request_id);
    try {
      if (req.status?.toLowerCase() === 'pending') {
        await updateAdminRequest(req.request_id, 'APPROVED', session.token);
      } else {
        const safeImage = req.spot_image_url && req.spot_image_url.length > 60000 ? '' : req.spot_image_url;
        await upsertAdminCoolSpot(
          {
            id: req.request_id,
            spot_id: req.request_id,
            city: req.city || cityId || 'indore',
            name: req.suggested_name,
            description: req.message,
            lat: req.lat,
            lon: req.lon,
            coords: {
              lat: req.lat,
              lon: req.lon,
            },
            logo_id: req.suggested_logo,
            image_url: safeImage || undefined,
            verified_by: session.email || 'Admin',
          },
          session.token
        );
      }
      setAdminQueueNotice(`Verified & published "${req.suggested_name}" to map!`);
      onRefreshData();
      setTimeout(() => setAdminQueueNotice(null), 4000);
    } catch (err: any) {
      setAdminQueueError(err?.message || 'Failed to approve cool spot request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (req: CoolSpotRequest) => {
    setAdminQueueError(null);
    setAdminQueueNotice(null);
    setProcessingRequestId(req.request_id);
    try {
      await updateAdminRequest(req.request_id, 'REJECTED', session.token);
      setAdminQueueNotice(`Rejected "${req.suggested_name}".`);
      onRefreshData();
      setTimeout(() => setAdminQueueNotice(null), 4000);
    } catch (err: any) {
      setAdminQueueError(err?.message || 'Failed to reject cool spot request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const loadSpotIntoAdminEditor = (spot: CoolSpot) => {
    setEditingSpotId(spot.spot_id ?? null);
    setAdminName(spot.name);
    setAdminDesc(spot.description);
    setAdminLat(String(spot.lat));
    setAdminLon(String(spot.lon));
    setAdminLogo(spot.logo_id);
    setAdminSpotImage(spot.image_url || '');
  };

  const getLogoMeta = (id: CoolSpotLogoId) =>
    COOL_SPOT_LOGOS.find((l) => l.id === id) || COOL_SPOT_LOGOS[0];

  const pendingRequests = requests.filter((r) => r.status?.toLowerCase() === 'pending');
  const approvedRequests = requests.filter((r) => r.status?.toLowerCase() === 'approved');
  const rejectedRequests = requests.filter((r) => r.status?.toLowerCase() === 'rejected');
  const visibleQueueRequests =
    queueFilter === 'all'
      ? requests
      : requests.filter((r) => r.status?.toLowerCase() === queueFilter);

  return (
    <section
      id="cool-spots-portal"
      className="section-shell"
      style={{
        backgroundColor: 'var(--color-sage)',
        borderTop: '1px solid rgba(1, 71, 46, 0.12)',
      }}
    >
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          <div>
            <div className="utility-label" style={{ marginBottom: '0.5rem' }}>
              AWS COGNITO • S3 PHOTO STORAGE • DYNAMODB — {cityLabel.toUpperCase()}
            </div>
            <h2 className="display-section">
              COOL SPOTS DIRECTORY &<br />
              NO-CODE ADMIN STUDIO.
            </h2>
          </div>

          {session.role !== 'guest' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                backgroundColor: 'var(--color-cream)',
                padding: '0.65rem 1.2rem',
                borderRadius: '999px',
                border: '1px solid rgba(1, 71, 46, 0.2)',
              }}
            >
              {session.role === 'admin' ? (
                <ShieldCheck size={18} color="#01472e" />
              ) : (
                <UserCheck size={18} color="#0284c7" />
              )}
              <div style={{ fontSize: '0.78rem' }}>
                <strong style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {session.role} ACCESS
                </strong>{' '}
                • {session.email}
              </div>
              <button
                type="button"
                onClick={() => onSessionChange(logoutAwsSession())}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'rgba(194, 65, 52, 0.12)',
                  color: '#C24134',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <LogOut size={13} /> SIGN OUT
              </button>
            </div>
          )}
        </div>

        {/* 1. GUEST VIEW: ROLE-SEPARATED LOGIN & VERIFIED COOL SPOTS */}
        {session.role === 'guest' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2rem',
              alignItems: 'stretch',
            }}
          >
            {/* Login Card */}
            <div
              style={{
                backgroundColor: 'var(--color-cream)',
                borderRadius: 'var(--radius-card)',
                padding: '2.25rem',
                border: '1px solid rgba(1, 71, 46, 0.15)',
              }}
            >
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setLoginRoleTab('user')}
                  className={loginRoleTab === 'user' ? 'btn-pill-primary' : 'btn-pill-secondary'}
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem' }}
                >
                  <UserCheck size={15} /> USER LOGIN
                </button>
                <button
                  type="button"
                  onClick={() => setLoginRoleTab('admin')}
                  className={loginRoleTab === 'admin' ? 'btn-pill-primary' : 'btn-pill-secondary'}
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem' }}
                >
                  <ShieldCheck size={15} /> ADMIN LOGIN
                </button>
              </div>

              <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '1.85rem', marginBottom: '0.5rem' }}>
                {loginRoleTab === 'admin'
                  ? 'ADMIN NO-CODE CONSOLE SIGN IN'
                  : 'USER COOL SPOT SUBMISSION SIGN IN'}
              </h3>
              <p style={{ fontSize: '0.88rem', opacity: 0.8, marginBottom: '1.5rem' }}>
                {loginRoleTab === 'admin'
                  ? 'Sign in as an Admin to verify user-submitted Cool Spot photos & coordinates, or customize Cool Spot logos and descriptions directly.'
                  : 'Sign in as a User to send a photo of a Cool Spot along with its Latitude, Longitude, and description for Admin verification.'}
              </p>

              {/* Login with Amazon Gateway & Full Modal Trigger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await loginWithAmazon();
                    } catch (err: any) {
                      setLoginError(err?.message || 'Login with Amazon failed.');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#232F3E',
                    border: '1.5px solid #131921',
                    borderRadius: '999px',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(35, 47, 62, 0.2)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M13.5 12.8c-1.3 0-2.2.3-2.8.9-.6.6-.7 1.3-.7 2 0 .9.3 1.6.8 2.1.5.5 1.3.8 2.2.8 1.1 0 2.1-.4 2.8-1.2.7-.8 1.1-1.8 1.1-3v-1.6h-3.4zm4.8 4.8c-.5.6-1.1 1.1-1.8 1.4-.7.3-1.6.5-2.6.5-1.5 0-2.7-.4-3.6-1.3-.9-.9-1.3-2-1.3-3.4 0-1.5.5-2.7 1.5-3.6 1-.9 2.4-1.3 4.2-1.3h3.5v-.8c0-1.1-.3-1.9-.9-2.5-.6-.6-1.5-.9-2.7-.9-1.3 0-2.5.4-3.5 1.1-.3.2-.6.1-.8-.1l-1.1-1.3c-.2-.2-.2-.5 0-.7 1.5-1.1 3.3-1.7 5.3-1.7 2 0 3.6.5 4.6 1.5 1 1 1.5 2.5 1.5 4.4v7.9c0 .4.2.7.5.9.2.1.2.4.1.6l-1.7 1.2c-.3.2-.6.1-.8-.2l-.5-.9z"
                      fill="#FFFFFF"
                    />
                    <path
                      d="M21.5 18.2c-2.8 2-6.5 3.1-10.4 3.1-4.7 0-9-1.6-12.6-4.5-.3-.2-.3-.6 0-.8.2-.2.6-.2.8 0 3.4 2.7 7.5 4.2 11.8 4.2 3.6 0 7-1 9.6-2.8.4-.3.9 0 .8.8z"
                      fill="#FF9900"
                    />
                    <path
                      d="M22.2 16.9c-.3-.4-1.8-.2-2.7-.1-.3 0-.4-.3-.2-.5 1.4-1.2 3.5-.8 3.8-.4.3.4-.1 2.5-1.4 3.7-.2.2-.5.1-.4-.2.4-.8.9-2.1.9-2.5z"
                      fill="#FF9900"
                    />
                  </svg>
                  <span>Sign in with Amazon</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="btn-pill-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.55rem 1rem', width: '100%' }}
                >
                  <Sparkles size={14} /> OPEN FULL AUTH DIALOG / REGISTER
                </button>
              </div>

              {/* Quick Fill Pills */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="utility-label" style={{ fontSize: '0.62rem', opacity: 0.65 }}>FILL DEMO EMAIL:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab('admin');
                    setEmail('heatsafe-admin-20261106@example.com');
                    setPassword('');
                    setLoginError(null);
                  }}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.55rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(1, 71, 46, 0.1)',
                    border: '1px solid rgba(1, 71, 46, 0.2)',
                    cursor: 'pointer',
                  }}
                >
                  Admin Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab('user');
                    setEmail('heatsafe-smoke-20261103@example.com');
                    setPassword('');
                    setLoginError(null);
                  }}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.55rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(1, 71, 46, 0.1)',
                    border: '1px solid rgba(1, 71, 46, 0.2)',
                    cursor: 'pointer',
                  }}
                >
                  User Email
                </button>
              </div>

              {loginError && (
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #f87171',
                    borderRadius: '0.85rem',
                    color: '#b91c1c',
                    fontSize: '0.78rem',
                    marginBottom: '1rem',
                  }}
                >
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="utility-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.68rem' }}>
                    EMAIL ADDRESS ({loginRoleTab.toUpperCase()})
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={loginRoleTab === 'admin' ? 'admin@heatsafe.in' : 'walker@indore.in'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.85rem',
                      border: '1px solid rgba(1, 71, 46, 0.25)',
                      backgroundColor: '#fff',
                      fontSize: '0.92rem',
                    }}
                  />
                </div>

                <div>
                  <label className="utility-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.68rem' }}>
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.85rem',
                      border: '1px solid rgba(1, 71, 46, 0.25)',
                      backgroundColor: '#fff',
                      fontSize: '0.92rem',
                    }}
                  />
                </div>

                <button type="submit" className="btn-pill-primary" disabled={authLoading} style={{ marginTop: '0.5rem' }}>
                  {authLoading
                    ? 'AUTHENTICATING...'
                    : loginRoleTab === 'admin'
                    ? 'OPEN ADMIN CONSOLE'
                    : 'OPEN USER SUBMISSION PAGE'}
                </button>
              </form>
            </div>

            {/* Verified Cool Spots List */}
            <div
              style={{
                backgroundColor: 'var(--color-olive)',
                borderRadius: 'var(--radius-card)',
                padding: '2.25rem',
              }}
            >
              <div className="utility-label" style={{ marginBottom: '0.75rem' }}>
                LIVE VERIFIED COOL SPOTS ({coolSpots.length})
              </div>
              <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '1.85rem', marginBottom: '1.25rem' }}>
                VERIFIED SHADE & HYDRATION NODES
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '360px', overflowY: 'auto' }}>
                {coolSpots.map((spot) => {
                  const logo = getLogoMeta(spot.logo_id);
                  return (
                    <div
                      key={spot.spot_id}
                      style={{
                        backgroundColor: 'var(--color-cream)',
                        padding: '1rem 1.15rem',
                        borderRadius: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {spot.image_url ? (
                          <img
                            src={spot.image_url}
                            alt={spot.name}
                            style={{
                              width: '54px',
                              height: '54px',
                              borderRadius: '12px',
                              objectFit: 'cover',
                              border: `2px solid ${logo.color}`,
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: '1.6rem',
                              width: '54px',
                              height: '54px',
                              borderRadius: '12px',
                              backgroundColor: `${logo.color}18`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {logo.emoji}
                          </span>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {logo.emoji} {spot.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.78 }}>{spot.description}</div>
                          <div style={{ fontSize: '0.68rem', opacity: 0.65, marginTop: '0.2rem' }}>
                            📍 Lat: {spot.lat?.toFixed(4) ?? 'N/A'}, Lon: {spot.lon?.toFixed(4) ?? 'N/A'} • {logo.label}
                          </div>
                        </div>
                      </div>

                      {onFocusSpotOnMap && typeof spot.lat === 'number' && typeof spot.lon === 'number' && (
                        <button
                          type="button"
                          onClick={() => onFocusSpotOnMap(spot.lat!, spot.lon!)}
                          className="btn-pill-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.68rem' }}
                        >
                          <MapPin size={13} /> ROUTE HERE
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. USER ACCESS PAGE */}
        {session.role === 'user' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '2rem',
            }}
          >
            {/* User Form */}
            <div
              style={{
                backgroundColor: 'var(--color-cream)',
                borderRadius: 'var(--radius-card)',
                padding: '2.25rem',
              }}
            >
              <div className="utility-label" style={{ color: '#0284c7', marginBottom: '0.4rem' }}>
                USER ACCESS PAGE • SUBMIT COOL SPOT
              </div>
              <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '2rem', marginBottom: '1rem' }}>
                FORWARD A COOL SPOT TO ADMIN
              </h3>

              {userSubmitSuccess && (
                <div
                  style={{
                    backgroundColor: 'rgba(46, 125, 50, 0.12)',
                    border: '1px solid #2E7D32',
                    color: '#1B5E20',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.85rem',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    marginBottom: '1.25rem',
                  }}
                >
                  ✅ {userSubmitSuccess}
                </div>
              )}

              <form onSubmit={handleUserRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                    COOL SPOT NAME / LANDMARK
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 56 Dukan Shaded Mist Corridor / Pyaau"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.95rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(1,71,46,0.25)',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span className="utility-label" style={{ fontSize: '0.68rem' }}>
                      EXACT LOCATION COORDINATES (LATITUDE & LONGITUDE)
                    </span>
                    <button
                      type="button"
                      onClick={handleUseCurrentGps}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: '#0284c7',
                        background: 'rgba(2, 132, 199, 0.1)',
                        border: 'none',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '999px',
                        cursor: 'pointer',
                      }}
                    >
                      <Navigation size={11} />
                      {locatingGps ? 'DETECTING GPS...' : 'USE MY CURRENT GPS'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Latitude"
                        value={reqLat}
                        onChange={(e) => setReqLat(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.7rem 0.95rem',
                          borderRadius: '0.75rem',
                          border: '1px solid rgba(1,71,46,0.25)',
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Longitude"
                        value={reqLon}
                        onChange={(e) => setReqLon(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.7rem 0.95rem',
                          borderRadius: '0.75rem',
                          border: '1px solid rgba(1,71,46,0.25)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.45rem' }}>
                    COOL SPOT CATEGORY
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                    {COOL_SPOT_LOGOS.map((logo) => (
                      <button
                        key={logo.id}
                        type="button"
                        onClick={() => setReqLogo(logo.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.75rem',
                          border: reqLogo === logo.id ? `2px solid ${logo.color}` : '1px solid rgba(1,71,46,0.18)',
                          backgroundColor: reqLogo === logo.id ? `${logo.color}15` : '#fff',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '1.15rem' }}>{logo.emoji}</span>
                        <span>{logo.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                    MESSAGE / DESCRIPTION OF THE COOL SPOT
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe shade, drinking water, or cooling hours..."
                    value={reqMessage}
                    onChange={(e) => setReqMessage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.95rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(1,71,46,0.25)',
                    }}
                  />
                </div>

                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                    UPLOAD IMAGE OF THE COOL SPOT (AWS S3)
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      padding: '1rem',
                      borderRadius: '0.85rem',
                      border: '2px dashed rgba(2, 132, 199, 0.45)',
                      backgroundColor: 'rgba(2, 132, 199, 0.05)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#0284c7',
                    }}
                  >
                    <Camera size={18} />
                    <span>{reqSpotImage ? 'Image Attached (Click to Change)' : 'Select Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, setReqSpotImage)}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {reqSpotImage && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <img
                        src={reqSpotImage}
                        alt="Preview"
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '0.75rem' }}
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-pill-primary">
                  <Sparkles size={16} /> SEND COOL SPOT REQUEST TO ADMIN
                </button>
              </form>
            </div>

            {/* User Submission History */}
            <div
              style={{
                backgroundColor: 'var(--color-olive)',
                borderRadius: 'var(--radius-card)',
                padding: '2.25rem',
              }}
            >
              <div className="utility-label" style={{ marginBottom: '0.5rem' }}>
                YOUR SUBMISSION TRACKER
              </div>
              <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '1.85rem', marginBottom: '1.25rem' }}>
                SUBMITTED COOL SPOT REQUESTS
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {requests.length === 0 ? (
                  <p style={{ opacity: 0.75, fontSize: '0.9rem' }}>
                    You haven't submitted any Cool Spots yet.
                  </p>
                ) : (
                  requests.map((req) => {
                    const logo = getLogoMeta(req.suggested_logo);
                    return (
                      <div
                        key={req.request_id}
                        style={{
                          backgroundColor: 'var(--color-cream)',
                          padding: '1rem',
                          borderRadius: '1rem',
                          display: 'flex',
                          gap: '0.85rem',
                          alignItems: 'flex-start',
                        }}
                      >
                        {req.spot_image_url ? (
                          <img
                            src={req.spot_image_url}
                            alt={req.suggested_name}
                            style={{ width: '60px', height: '60px', borderRadius: '0.65rem', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: '1.6rem' }}>{logo.emoji}</span>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>{req.suggested_name}</strong>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '999px',
                                textTransform: 'uppercase',
                                backgroundColor:
                                req.status === 'approved'
                                  ? 'rgba(46,125,50,0.15)'
                                  : req.status === 'rejected'
                                  ? 'rgba(194,65,52,0.15)'
                                  : 'rgba(217,119,6,0.15)',
                              color:
                                req.status === 'approved'
                                  ? '#2E7D32'
                                  : req.status === 'rejected'
                                  ? '#C24134'
                                  : '#D97706',
                              }}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', opacity: 0.8, margin: '0.25rem 0' }}>{req.message}</p>
                          <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>
                            📍 Lat: {req.lat.toFixed(4)}, Lon: {req.lon.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. ADMIN CONSOLE */}
        {session.role === 'admin' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: '2rem',
            }}
          >
            {/* Left Column: No-Code Cool Spot Customizer */}
            <div
              style={{
                backgroundColor: 'var(--color-cream)',
                borderRadius: 'var(--radius-card)',
                padding: '2.25rem',
                border: '2px solid rgba(1, 71, 46, 0.25)',
              }}
            >
              <div className="utility-label" style={{ color: 'var(--color-forest)', marginBottom: '0.4rem' }}>
                NO-CODE ADMIN CONSOLE • CUSTOMIZE COOL SPOTS
              </div>
              <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '2rem', marginBottom: '1rem' }}>
                {editingSpotId ? 'MODIFY COOL SPOT' : 'CREATE NEW COOL SPOT'}
              </h3>

              {adminNotice && (
                <div
                  style={{
                    backgroundColor: 'rgba(46, 125, 50, 0.14)',
                    border: '1px solid #2E7D32',
                    color: '#1B5E20',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    marginBottom: '1rem',
                  }}
                >
                  ✨ {adminNotice}
                </div>
              )}

              <form onSubmit={handleAdminSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                    COOL SPOT TITLE
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Regional Park Shaded Canal Walk"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.95rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(1,71,46,0.25)',
                    }}
                  />
                </div>

                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.45rem' }}>
                    SELECT COOL SPOT LOGO
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '0.5rem' }}>
                    {COOL_SPOT_LOGOS.map((logo) => (
                      <button
                        key={logo.id}
                        type="button"
                        onClick={() => setAdminLogo(logo.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.55rem 0.7rem',
                          borderRadius: '0.75rem',
                          border: adminLogo === logo.id ? `2px solid ${logo.color}` : '1px solid rgba(1,71,46,0.18)',
                          backgroundColor: adminLogo === logo.id ? `${logo.color}18` : '#fff',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '1.25rem' }}>{logo.emoji}</span>
                        <span>{logo.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                      LATITUDE
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={adminLat}
                      onChange={(e) => setAdminLat(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.95rem',
                        borderRadius: '0.75rem',
                        border: '1px solid rgba(1,71,46,0.25)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                      LONGITUDE
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={adminLon}
                      onChange={(e) => setAdminLon(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.95rem',
                        borderRadius: '0.75rem',
                        border: '1px solid rgba(1,71,46,0.25)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="utility-label" style={{ fontSize: '0.68rem', display: 'block', marginBottom: '0.35rem' }}>
                    DESCRIPTION
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter description..."
                    value={adminDesc}
                    onChange={(e) => setAdminDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.95rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(1,71,46,0.25)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" className="btn-pill-primary" style={{ flex: 1 }}>
                    <PlusCircle size={16} />
                    {editingSpotId ? 'UPDATE COOL SPOT' : 'ADD COOL SPOT TO MAP'}
                  </button>
                  {editingSpotId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSpotId(null);
                        setAdminName('');
                        setAdminDesc('');
                        setAdminSpotImage('');
                      }}
                      className="btn-pill-secondary"
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              </form>

              {/* Existing Cool Spots List */}
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(1,71,46,0.15)' }}>
                <div className="utility-label" style={{ marginBottom: '0.75rem', fontSize: '0.7rem' }}>
                  MANAGE EXISTING COOL SPOTS ({coolSpots.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '260px', overflowY: 'auto' }}>
                  {coolSpots.map((spot) => {
                    const logo = getLogoMeta(spot.logo_id);
                    return (
                      <div
                        key={spot.spot_id}
                        style={{
                          backgroundColor: 'var(--color-olive)',
                          padding: '0.75rem 1rem',
                          borderRadius: '0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ fontSize: '1.35rem' }}>{logo.emoji}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{spot.name}</div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>
                              Lat: {spot.lat?.toFixed(4) ?? '—'}, Lon: {spot.lon?.toFixed(4) ?? '—'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => loadSpotIntoAdminEditor(spot)}
                            style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'var(--color-cream)', cursor: 'pointer' }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!spot.spot_id) return;
                              await deleteAdminCoolSpot(spot.spot_id, session.token);
                              onRefreshData();
                            }}
                            style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(194,65,52,0.15)', color: '#C24134', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: User Verification Queue */}
            <div
              style={{
                backgroundColor: 'var(--color-olive)',
                borderRadius: 'var(--radius-card)',
                padding: '2.25rem',
              }}
            >
              <div className="utility-label" style={{ marginBottom: '0.4rem' }}>
                USER SUBMISSIONS ({pendingRequests.length} AWAITING VERIFICATION)
              </div>
              <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '2rem', marginBottom: '1rem' }}>
                VERIFY USER COOL SPOT PHOTOS & COORDS
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.15rem' }}>
                {(
                  [
                    ['pending', `PENDING (${pendingRequests.length})`],
                    ['approved', `APPROVED (${approvedRequests.length})`],
                    ['rejected', `REJECTED (${rejectedRequests.length})`],
                    ['all', `ALL (${requests.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setQueueFilter(key)}
                    style={{
                      padding: '0.38rem 0.85rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(1, 71, 46, 0.22)',
                      backgroundColor: queueFilter === key ? 'var(--color-forest)' : 'var(--color-cream)',
                      color: queueFilter === key ? 'var(--color-cream)' : 'var(--color-forest)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {adminQueueError && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #f87171',
                    color: '#b91c1c',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '1rem',
                  }}
                >
                  {adminQueueError}
                </div>
              )}

              {adminQueueNotice && (
                <div
                  style={{
                    backgroundColor: 'rgba(46, 125, 50, 0.14)',
                    border: '1px solid #2E7D32',
                    color: '#1B5E20',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    marginBottom: '1rem',
                  }}
                >
                  {adminQueueNotice}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '640px', overflowY: 'auto' }}>
                {visibleQueueRequests.length === 0 ? (
                  <p style={{ opacity: 0.75 }}>
                    No {queueFilter === 'all' ? '' : `${queueFilter} `}Cool Spot requests in this view.
                  </p>
                ) : (
                  visibleQueueRequests.map((req) => {
                    const logo = getLogoMeta(req.suggested_logo);
                    return (
                      <div
                        key={req.request_id}
                        style={{
                          backgroundColor: 'var(--color-cream)',
                          padding: '1.25rem',
                          borderRadius: '1.15rem',
                          borderLeft: `5px solid ${logo.color}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.4rem' }}>{logo.emoji}</span>
                            <strong style={{ fontSize: '1rem' }}>{req.suggested_name}</strong>
                          </div>
                          <span className="utility-label" style={{ fontSize: '0.65rem' }}>
                            STATUS: {req.status.toUpperCase()}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.86rem', marginBottom: '0.5rem' }}>{req.message}</p>

                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-forest)',
                            backgroundColor: 'rgba(1, 71, 46, 0.08)',
                            padding: '0.4rem 0.65rem',
                            borderRadius: '0.5rem',
                            marginBottom: '0.75rem',
                            display: 'block',
                          }}
                        >
                          📍 Latitude: {req.lat.toFixed(5)} | Longitude: {req.lon.toFixed(5)} <br />
                          By: {req.user_email}
                        </div>

                        {req.spot_image_url && (
                          <div style={{ marginBottom: '0.85rem' }}>
                            <img
                              src={req.spot_image_url}
                              alt={req.suggested_name}
                              style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '0.75rem' }}
                            />
                          </div>
                        )}

                        {req.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button
                              type="button"
                              disabled={processingRequestId === req.request_id}
                              onClick={() => handleApproveRequest(req)}
                              className="btn-pill-primary"
                              style={{ flex: 1, padding: '0.55rem 0.9rem', fontSize: '0.72rem' }}
                            >
                              <CheckCircle2 size={15} />
                              {processingRequestId === req.request_id ? 'PROCESSING...' : 'VERIFY & PUBLISH'}
                            </button>
                            <button
                              type="button"
                              disabled={processingRequestId === req.request_id}
                              onClick={() => handleRejectRequest(req)}
                              className="btn-pill-secondary"
                              style={{ padding: '0.55rem 0.9rem', fontSize: '0.72rem', color: '#C24134' }}
                            >
                              <XCircle size={15} /> REJECT
                            </button>
                          </div>
                        ) : req.status?.toLowerCase() === 'approved' ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(1,71,46,0.1)' }}>
                            <span style={{ fontSize: '0.74rem', color: '#15803D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <CheckCircle2 size={15} /> PUBLISHED TO COOL SPOTS
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApproveRequest(req)}
                              className="btn-pill-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.65rem' }}
                              title="Re-sync this spot to map and cool spots list"
                            >
                              🔄 RE-SYNC TO MAP
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};