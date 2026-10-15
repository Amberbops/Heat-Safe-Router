import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import {
  Compass,
  KeyRound,
  LocateFixed,
  Mic,
  MicOff,
  Navigation,
  Play,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { fetchPlannedRoutes } from '../api/plannerApi';
import type { CityConfig } from '../config/supportedCities';
import type { Coordinates, PlanRouteResponse } from '../types/route';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  spokenSummary?: string;
  engine?: 'gemini' | 'smart-local';
  modelUsed?: string;
}

export interface MappyAssistantProps {
  selectedCity: CityConfig;
  currentPlan: PlanRouteResponse | null;
  selectedRouteId: string | null;
  onPlanLoaded: (
    plan: PlanRouteResponse,
    origin: Coordinates,
    destination: Coordinates,
    preferredRouteId: string
  ) => void;
  onSelectRoute: (routeId: string) => void;
}

const INDORE_LANDMARKS: Array<{
  keywords: string[];
  name: string;
  lat: number;
  lon: number;
}> = [
  {
    keywords: ['airport', 'devi ahilya', 'ahilyabai', 'holkar airport', 'holker airport', 'aerodrome'],
    name: 'Devi Ahilyabai Holkar Airport',
    lat: 22.7279,
    lon: 75.8046,
  },
  {
    keywords: ['rajwada', 'rajवाड़ा', 'rajwara'],
    name: 'Rajwada Palace',
    lat: 22.7186,
    lon: 75.8557,
  },
  {
    keywords: ['sarafa', 'sarafa bazaar', 'sarafa market'],
    name: 'Sarafa Bazaar',
    lat: 22.7177,
    lon: 75.8543,
  },
  {
    keywords: ['56 dukan', 'chhappan', 'chappan', 'fifty six dukan'],
    name: '56 Dukan (Chhappan Dukan)',
    lat: 22.7244,
    lon: 75.8839,
  },
  {
    keywords: ['treasure island', 'ti mall', 't i mall'],
    name: 'Treasure Island (TI) Mall',
    lat: 22.7218,
    lon: 75.8788,
  },
  {
    keywords: ['c21', 'c 21', 'malhar mega mall', 'century 21'],
    name: 'C21 & Malhar Mega Mall (AB Road)',
    lat: 22.7445,
    lon: 75.8942,
  },
  {
    keywords: ['palasia', 'old palasia', 'new palasia'],
    name: 'Palasia Square',
    lat: 22.7256,
    lon: 75.8856,
  },
  {
    keywords: ['lal bagh', 'lalbagh', 'lal bag'],
    name: 'Lal Bagh Palace',
    lat: 22.7009,
    lon: 75.8471,
  },
  {
    keywords: ['khajrana', 'ganesh mandir', 'khajrana temple'],
    name: 'Khajrana Ganesh Mandir',
    lat: 22.7352,
    lon: 75.9062,
  },
  {
    keywords: ['vijay nagar', 'vijaynagar'],
    name: 'Vijay Nagar Square',
    lat: 22.7533,
    lon: 75.8937,
  },
  {
    keywords: ['bhawarkuan', 'bhanwarkuan', 'bhawarkua', 'davv', 'it park', 'crystal it park'],
    name: 'Bhawarkuan Square / IT Park',
    lat: 22.6922,
    lon: 75.8676,
  },
  {
    keywords: ['regal square', 'regal circle', 'gandhi hall'],
    name: 'Regal Square & Gandhi Hall',
    lat: 22.7198,
    lon: 75.8698,
  },
  {
    keywords: ['railway station', 'indore junction', 'train station', 'sarwate', 'bus stand'],
    name: 'Indore Junction Railway Station',
    lat: 22.7172,
    lon: 75.8683,
  },
  {
    keywords: ['holkar stadium', 'cricket stadium', 'nehru stadium'],
    name: 'Holkar Cricket Stadium',
    lat: 22.7243,
    lon: 75.8796,
  },
  {
    keywords: ['annapurna', 'annapurna temple', 'annapurna road'],
    name: 'Annapurna Temple, Indore',
    lat: 22.6968,
    lon: 75.8375,
  },
  {
    keywords: ['geeta bhawan', 'gita bhavan', 'my hospital', 'm y hospital'],
    name: 'Geeta Bhawan Square',
    lat: 22.7145,
    lon: 75.8825,
  },
  {
    keywords: ['sgsits', 'gsits', 'lantern square', 'vallabh nagar'],
    name: 'SGSITS Campus, Park Road',
    lat: 22.7251,
    lon: 75.8714,
  },
  {
    keywords: ['regional park', 'pipliyapala', 'atal bihari park', 'choithram'],
    name: 'Pipliyapala Regional Park',
    lat: 22.6812,
    lon: 75.8579,
  },
];

const ACTIVE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.1-pro-preview',
  'gemma-4-31b-it',
];

function cleanSpokenDestinationQuery(raw: string): string {
  return raw
    .replace(/^(?:hey|hi|hello|okay|ok)?\s*(?:mappy|mapi|mappie|mapie)[,.\s]*/i, '')
    .replace(
      /^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+)?(?:find|plan|show|get|give|take|walk|go|navigate|reach|head)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:best\s+|coolest\s+|cooler\s+|shady\s+|shortest\s+|fastest\s+|walking\s+|heat-safe\s+|heat\s+safe\s+)?(?:route|routes|way|path|walk|directions?)?\s*(?:to|towards|for|at)?\s*/i,
      ''
    )
    .replace(/^(?:reach|visit|go\s+to|walk\s+to|take\s+me\s+to)\s+/i, '')
    .replace(/[,.;]?\s*(?:and\s+)?(?:tell|show|give|find|let)\s+me\s+.*$/i, '')
    .replace(/\s+from\s+(?:my\s+current\s+location|here|current\s+location|my\s+location).*$/i, '')
    .replace(/[?.!,]+$/g, '')
    .trim();
}

function buildConciseSpokenSummary(fullText: string, explicitSpoken?: string): string {
  if (explicitSpoken && explicitSpoken.trim().length > 4) {
    return explicitSpoken.trim();
  }
  const stripped = fullText
    .replace(/\([^)]*proxy[^)]*\)/gi, '')
    .replace(/\([^)]*\d+\.\d+\s*km[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = stripped.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 2 && stripped.length <= 165) {
    return stripped;
  }
  return `${sentences[0]} ${sentences[sentences.length - 1]}`.trim();
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointToSegmentMeters(
  lat: number,
  lon: number,
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): { distM: number; frac: number } {
  const cosLat = Math.cos(((lat1 + lat2 + lat) / 3) * (Math.PI / 180));
  const mLat = 111132;
  const mLon = 111320 * cosLat;
  const px = (lon - lon1) * mLon;
  const py = (lat - lat1) * mLat;
  const dx = (lon2 - lon1) * mLon;
  const dy = (lat2 - lat1) * mLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) return { distM: Math.hypot(px, py), frac: 0 };
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return { distM: Math.hypot(px - t * dx, py - t * dy), frac: t };
}

export const MappyAssistant: FC<MappyAssistantProps> = ({
  selectedCity,
  currentPlan,
  selectedRouteId,
  onPlanLoaded,
  onSelectRoute,
}) => {
  const envKey = (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    ''
  ).trim();

  const [savedKey, setSavedKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('MAPPY_GEMINI_API_KEY') || '';
    }
    return '';
  });
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>(savedKey);
  const [lastApiError, setLastApiError] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string>('gemini-3.8-flash');

  const geminiApiKey = (savedKey || envKey).trim();
  const isGeminiConfigured = Boolean(geminiApiKey && geminiApiKey.length > 15);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  const [handsFreeEnabled, setHandsFreeEnabled] = useState<boolean>(true);
  const [singleShotListen, setSingleShotListen] = useState<boolean>(false);

  const [gpsLocation, setGpsLocation] = useState<Coordinates | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(15);
  const [gpsSource, setGpsSource] = useState<
    'locating' | 'live_gps' | 'outside_indore_fallback' | 'permission_denied_fallback'
  >('locating');

  const [activeDest, setActiveDest] = useState<{ name: string; coords: Coordinates } | null>(
    null
  );

  const [navActive, setNavActive] = useState<boolean>(false);
  const [detectedRouteId, setDetectedRouteId] = useState<string | null>(null);
  const [distanceFromRouteM, setDistanceFromRouteM] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [navStatus, setNavStatus] = useState<
    'idle' | 'on_route' | 'deviated' | 'arrived'
  >('idle');

  const offRouteCountRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const bgWatchIdRef = useRef<number | null>(null);
  const simStepRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(handsFreeEnabled);
  const singleShotRef = useRef<boolean>(singleShotListen);
  const gpsLocationRef = useRef<Coordinates | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const processCommandRef = useRef<(text: string) => Promise<void>>(async () => {});

  handsFreeRef.current = handsFreeEnabled;
  singleShotRef.current = singleShotListen;
  gpsLocationRef.current = gpsLocation;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hey! I’m Mappy. I show full route telemetry in the chat card while speaking only a quick, concise voice summary out loud. Say "Hey Mappy, take me to Rajwada" or click "SPEAK NOW"!',
      spokenSummary: 'Hey! I am Mappy. Say Hey Mappy or tap Speak Now whenever you are ready.',
      engine: isGeminiConfigured ? 'gemini' : 'smart-local',
    },
  ]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript]);

  const acquireRealGpsPosition = (): Promise<Coordinates> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        const fb = { lat: 22.7244, lon: 75.8839 };
        setGpsLocation(fb);
        setGpsSource('permission_denied_fallback');
        resolve(fb);
        return;
      }

      const handleSuccess = (pos: GeolocationPosition) => {
        const rawLat = Number(pos.coords.latitude.toFixed(5));
        const rawLon = Number(pos.coords.longitude.toFixed(5));
        const acc = Math.round(pos.coords.accuracy || 15);
        setGpsAccuracy(acc);

        const distFromIndoreKm =
          haversineMeters(rawLat, rawLon, selectedCity.center.lat, selectedCity.center.lon) / 1000;

        if (distFromIndoreKm <= 12.0) {
          const liveCoords = { lat: rawLat, lon: rawLon };
          setGpsLocation(liveCoords);
          gpsLocationRef.current = liveCoords;
          setGpsSource('live_gps');
          resolve(liveCoords);
        } else {
          const indoreFallback = { lat: 22.7244, lon: 75.8839 };
          setGpsLocation(indoreFallback);
          gpsLocationRef.current = indoreFallback;
          setGpsSource('outside_indore_fallback');
          resolve(indoreFallback);
        }
      };

      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        () => {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            () => {
              if (gpsLocationRef.current) {
                resolve(gpsLocationRef.current);
                return;
              }
              const fallback = { lat: 22.7244, lon: 75.8839 };
              setGpsLocation(fallback);
              gpsLocationRef.current = fallback;
              setGpsSource('permission_denied_fallback');
              resolve(fallback);
            },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 }
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
      );
    });
  };

  useEffect(() => {
    acquireRealGpsPosition();

    if ('geolocation' in navigator) {
      bgWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const rawLat = Number(pos.coords.latitude.toFixed(5));
          const rawLon = Number(pos.coords.longitude.toFixed(5));
          const distKm =
            haversineMeters(rawLat, rawLon, selectedCity.center.lat, selectedCity.center.lon) /
            1000;
          if (distKm <= 12.0) {
            const coords = { lat: rawLat, lon: rawLon };
            setGpsLocation(coords);
            gpsLocationRef.current = coords;
            setGpsAccuracy(Math.round(pos.coords.accuracy || 12));
            setGpsSource('live_gps');
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
      );
    }

    return () => {
      if (bgWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(bgWatchIdRef.current);
      }
    };
  }, [selectedCity.center.lat, selectedCity.center.lon]);

  const speakSummary = (voiceText: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    isSpeakingRef.current = true;

    const cleanText = voiceText.replace(/[*#_`|]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-IN';
    utterance.rate = 1.05;

    utterance.onend = () => {
      isSpeakingRef.current = false;
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  };

  const appendMessage = (
    role: 'user' | 'assistant',
    detailedText: string,
    shouldSpeak = false,
    engine?: 'gemini' | 'smart-local',
    customSpokenSummary?: string,
    modelUsed?: string
  ) => {
    const finalSpoken =
      role === 'assistant'
        ? buildConciseSpokenSummary(detailedText, customSpokenSummary)
        : undefined;

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        text: detailedText,
        spokenSummary: finalSpoken,
        engine,
        modelUsed,
      },
    ]);

    if (role === 'assistant' && shouldSpeak && finalSpoken) {
      speakSummary(finalSpoken);
    }
  };

  const resolveDestinationQuery = async (
    rawQuery: string
  ): Promise<{ name: string; coords: Coordinates } | null> => {
    const cleaned = cleanSpokenDestinationQuery(rawQuery).toLowerCase();
    const fullLower = rawQuery.toLowerCase();

    for (const item of INDORE_LANDMARKS) {
      for (const kw of item.keywords) {
        if (cleaned.includes(kw) || fullLower.includes(kw)) {
          return { name: item.name, coords: { lat: item.lat, lon: item.lon } };
        }
      }
    }

    if (!cleaned || cleaned.length < 2) return null;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        `${cleaned}, Indore, Madhya Pradesh, India`
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          name: String(data[0].display_name).split(',')[0],
          coords: {
            lat: Number(Number(data[0].lat).toFixed(5)),
            lon: Number(Number(data[0].lon).toFixed(5)),
          },
        };
      }
    } catch {
      // Ignore network error
    }
    return null;
  };

  const evaluateGpsSample = (lat: number, lon: number, accM: number) => {
    if (!currentPlan || !currentPlan.routes.length || !selectedRouteId) return;

    let bestRouteId = selectedRouteId;
    let bestRouteDist = Infinity;
    let selectedDistM = Infinity;
    let selectedProgress = 0;
    let distToDestM = Infinity;

    for (const route of currentPlan.routes) {
      const coords = route.geometry?.coordinates || [];
      if (coords.length < 2) continue;

      let minD = Infinity;
      let coveredM = 0;
      let totalM = 0;

      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        const segM = haversineMeters(lat1, lon1, lat2, lon2);
        const { distM, frac } = pointToSegmentMeters(lat, lon, lon1, lat1, lon2, lat2);
        if (distM < minD) {
          minD = distM;
          coveredM = totalM + segM * frac;
        }
        totalM += segM;
      }

      if (minD < bestRouteDist) {
        bestRouteDist = minD;
        bestRouteId = route.route_id;
      }

      if (route.route_id === selectedRouteId) {
        selectedDistM = minD;
        selectedProgress = totalM > 0 ? Math.min(100, (coveredM / totalM) * 100) : 0;
        const [endLon, endLat] = coords[coords.length - 1];
        distToDestM = haversineMeters(lat, lon, endLat, endLon);
      }
    }

    setDetectedRouteId(bestRouteId);
    setDistanceFromRouteM(Number(selectedDistM.toFixed(1)));

    const arrivalThreshold = Math.max(22, 18 + accM * 0.6);
    const deviationThreshold = Math.max(35, 25 + accM * 1.1);

    if (distToDestM <= arrivalThreshold) {
      setProgressPercent(100);
      setNavStatus('arrived');
      setNavActive(false);
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      appendMessage(
        'assistant',
        'Destination reached! Your walking navigation session is complete.',
        true,
        'smart-local',
        'Destination reached. Navigation complete!'
      );
      return;
    }

    setProgressPercent(Number(selectedProgress.toFixed(1)));

    if (selectedDistM > deviationThreshold) {
      offRouteCountRef.current += 1;
      if (offRouteCountRef.current >= 2 && navStatus !== 'deviated') {
        setNavStatus('deviated');
        appendMessage(
          'assistant',
          `You appear to have drifted ${selectedDistM.toFixed(
            0
          )}m away from ${selectedRouteId.toUpperCase()}. Would you like me to recalculate a route from here?`,
          true,
          'smart-local',
          'You moved away from the selected route. Would you like me to reroute?'
        );
      }
    } else {
      offRouteCountRef.current = 0;
      setNavStatus('on_route');
    }
  };

  const startLiveNavigation = (customRouteId?: string) => {
    const targetRoute = customRouteId || selectedRouteId || currentPlan?.routes?.[0]?.route_id;
    if (!currentPlan || !targetRoute) {
      appendMessage(
        'assistant',
        'Please ask me to find a route to a destination first before starting navigation.',
        true,
        'smart-local',
        'Let us pick a destination first before starting navigation.'
      );
      return;
    }
    setNavActive(true);
    setNavStatus('on_route');
    offRouteCountRef.current = 0;
    simStepRef.current = 0;
    appendMessage(
      'assistant',
      `Live GPS navigation started along ${targetRoute.toUpperCase()}. Tracking your progress and route offset in real time.`,
      true,
      isGeminiConfigured ? 'gemini' : 'smart-local',
      `Navigation started on ${targetRoute}. Let's walk!`
    );

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const distFromIndoreKm =
            haversineMeters(lat, lon, selectedCity.center.lat, selectedCity.center.lon) / 1000;
          if (distFromIndoreKm <= 12) {
            const coords = { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
            setGpsLocation(coords);
            gpsLocationRef.current = coords;
            setGpsSource('live_gps');
            evaluateGpsSample(lat, lon, pos.coords.accuracy || 10);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  };

  const stopLiveNavigation = () => {
    setNavActive(false);
    setNavStatus('idle');
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    appendMessage(
      'assistant',
      'Live navigation stopped and GPS tracking has ended.',
      true,
      isGeminiConfigured ? 'gemini' : 'smart-local',
      'Navigation stopped.'
    );
  };

  const simulateWalkStep = (forceDeviation = false) => {
    if (!currentPlan || !selectedRouteId) return;
    const activeRoute =
      currentPlan.routes.find((r) => r.route_id === selectedRouteId) || currentPlan.routes[0];
    const coords = activeRoute.geometry?.coordinates || [];
    if (coords.length < 2) return;

    if (forceDeviation) {
      const midIdx = Math.min(coords.length - 1, Math.floor(coords.length / 2));
      const [lon, lat] = coords[midIdx];
      const drifted = {
        lat: Number((lat + 0.00065).toFixed(5)),
        lon: Number((lon + 0.00065).toFixed(5)),
      };
      setGpsLocation(drifted);
      gpsLocationRef.current = drifted;
      offRouteCountRef.current = 1;
      evaluateGpsSample(drifted.lat, drifted.lon, 8);
      return;
    }

    simStepRef.current = Math.min(
      coords.length - 1,
      simStepRef.current + Math.max(1, Math.floor(coords.length / 4))
    );
    const [lon, lat] = coords[simStepRef.current];
    const nextPt = { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
    setGpsLocation(nextPt);
    gpsLocationRef.current = nextPt;
    evaluateGpsSample(nextPt.lat, nextPt.lon, 6);
  };

  const handleReroute = async () => {
    if (!activeDest) {
      appendMessage(
        'assistant',
        'No active destination to reroute to yet.',
        true,
        'smart-local',
        'No active destination to reroute to yet.'
      );
      return;
    }
    setIsBusy(true);
    const origin = gpsLocationRef.current || (await acquireRealGpsPosition());
    try {
      const plan = await fetchPlannedRoutes({
        city: selectedCity.id,
        originLat: origin.lat,
        originLon: origin.lon,
        destLat: activeDest.coords.lat,
        destLon: activeDest.coords.lon,
      });
      const prefId = plan.recommendations?.heat_safe || plan.routes[0]?.route_id;
      onPlanLoaded(plan, origin, activeDest.coords, prefId);
      setNavStatus('on_route');
      offRouteCountRef.current = 0;
      simStepRef.current = 0;
      appendMessage(
        'assistant',
        `Rerouted from your current GPS (${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}) to ${
          activeDest.name
        }. Highlighted ${prefId.toUpperCase()} as the coolest updated option.`,
        true,
        isGeminiConfigured ? 'gemini' : 'smart-local',
        `Rerouted to ${activeDest.name} on ${prefId}.`
      );
    } catch (err: any) {
      appendMessage('assistant', err?.message || 'Unable to reroute right now.', true);
    } finally {
      setIsBusy(false);
    }
  };

  const ensureDistinctOrigin = (origin: Coordinates, dest: Coordinates): Coordinates => {
    const distM = haversineMeters(origin.lat, origin.lon, dest.lat, dest.lon);
    if (distM < 25) {
      return { lat: 22.7244, lon: 75.8839 };
    }
    return origin;
  };

  const callGeminiWithModelCascade = async (promptText: string): Promise<{
    data: any;
    modelUsed: string;
  }> => {
    const queue = [
      activeModelId,
      ...ACTIVE_GEMINI_MODELS.filter((m) => m !== activeModelId),
    ];

    let lastErrorMsg = '';

    for (const candidateModel of queue) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${geminiApiKey}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          setActiveModelId(candidateModel);
          setLastApiError(null);
          return { data: json, modelUsed: candidateModel };
        }

        const errBody = await res.json().catch(() => ({}));
        lastErrorMsg = errBody?.error?.message || `HTTP ${res.status} on ${candidateModel}`;

        if (
          res.status === 403 ||
          lastErrorMsg.toLowerCase().includes('api key not valid') ||
          lastErrorMsg.toLowerCase().includes('permission_denied')
        ) {
          break;
        }
      } catch (netErr: any) {
        lastErrorMsg = netErr?.message || 'Network error calling Gemini API';
      }
    }

    setLastApiError(lastErrorMsg);
    throw new Error(lastErrorMsg);
  };

  const callGeminiBrain = async (userText: string): Promise<boolean> => {
    if (!isGeminiConfigured) return false;

    const routesDetailed =
      currentPlan?.routes?.map((r) => ({
        route_id: r.route_id,
        distance_km: r.distance_km,
        duration_min: r.duration_min,
        heat_score: r.heat_score,
        heat_category: r.heat_category,
        weather_heat: r.weather_heat,
        environmental_exposure: r.environmental_exposure,
      })) || [];

    const systemPrompt = `You are Mappy, an intelligent voice navigation companion for Heat-Safe Router in Indore, India.
LIVE APP TELEMETRY:
- User Live GPS Origin: ${
      gpsLocationRef.current
        ? `${gpsLocationRef.current.lat},${gpsLocationRef.current.lon}`
        : '22.6973, 75.8626'
    }
- Active Destination: ${activeDest ? activeDest.name : 'None yet'}
- Current Indore Weather (Open-Meteo): ${
      currentPlan?.weather
        ? `${currentPlan.weather.temperature_c}°C, ${currentPlan.weather.relative_humidity}\% humidity, wind${currentPlan.weather.wind_speed_kmh} km/h`
        : 'Fetched upon route calculation'
    }
- Loaded Walking Routes: ${JSON.stringify(routesDetailed)}
- Recommendations: ${JSON.stringify(currentPlan?.recommendations || {})}
- Selected Route on Map: ${selectedRouteId || 'None'}

Return ONLY a valid JSON object with these keys:
{
  "action": "plan_route" | "select_route" | "start_navigation" | "stop_navigation" | "reroute" | "answer_only",
  "destination_query": "clean place name in Indore if action is plan_route (e.g. 'Rajwada', 'Devi Ahilyabai Holkar Airport'), else ''",
  "route_preference": "heat_safe" | "optimal" | "shortest" | "route-1" | "route-2" | "route-3" | "",
  "detailed_reply": "Detailed, helpful on-screen response with exact route numbers, distances, temperatures, and heat scores.",
  "spoken_summary": "A short, punchy 1-sentence spoken voice summary (MAX 20 words) that sounds like a natural human friend speaking out loud."
}`;

    const { data, modelUsed } = await callGeminiWithModelCascade(
      `${systemPrompt}\n\nUser said: "${userText}"`
    );

    const rawParts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const nonThoughtParts = rawParts.filter((p) => !p.thought && typeof p.text === 'string');
    const rawText = (
      nonThoughtParts.length > 0
        ? nonThoughtParts.map((p) => p.text).join(' ')
        : rawParts.map((p) => p.text || '').join(' ')
    ).trim();

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return false;
    }

    let parsed: {
      action?: string;
      destination_query?: string;
      route_preference?: string;
      detailed_reply?: string;
      spoken_summary?: string;
      reply?: string;
    } = {};

    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return false;
    }

    const action = (parsed.action || 'answer_only').toLowerCase();

    if (action === 'plan_route') {
      const queryToUse = parsed.destination_query || userText;
      const rawOrigin = gpsLocationRef.current || (await acquireRealGpsPosition());
      const resolved = await resolveDestinationQuery(queryToUse);

      if (!resolved) {
        appendMessage(
          'assistant',
          `I heard you want to head to "${queryToUse}", but I couldn't pinpoint that spot inside our Indore service area. Try Devi Ahilyabai Holkar Airport, Rajwada, Sarafa Bazaar, Bhawarkuan, or 56 Dukan!`,
          true,
          'gemini',
          `I couldn't find ${queryToUse} in Indore. Try Rajwada, Sarafa, or the Airport!`,
          modelUsed
        );
        return true;
      }

      const origin = ensureDistinctOrigin(rawOrigin, resolved.coords);
      setActiveDest(resolved);

      const plan = await fetchPlannedRoutes({
        city: selectedCity.id,
        originLat: origin.lat,
        originLon: origin.lon,
        destLat: resolved.coords.lat,
        destLon: resolved.coords.lon,
      });

      const pref = (parsed.route_preference || 'heat_safe').toLowerCase();
      const shortest = plan.routes.reduce(
        (min, r) => (r.distance_km < min.distance_km ? r : min),
        plan.routes[0]
      );

      let chosenRouteId =
        plan.recommendations?.heat_safe ||
        plan.recommended_route ||
        plan.routes[0]?.route_id;

      if (pref.includes('short') || pref.includes('fast')) {
        chosenRouteId = shortest.route_id;
      } else if (pref.includes('optimal') || pref.includes('balanc')) {
        chosenRouteId = plan.recommendations?.balanced || chosenRouteId;
      }

      onPlanLoaded(plan, origin, resolved.coords, chosenRouteId);

      const chosenRoute =
        plan.routes.find((r) => r.route_id === chosenRouteId) || plan.routes[0];

      const routeBreakdown = plan.routes
        .map(
          (r) =>
            `${r.route_id.toUpperCase()}: ${r.distance_km.toFixed(2)} km (${
              r.duration_min
            } min, Heat ${r.heat_score}/100)`
        )
        .join(' • ');

      const detailedCard = `Mapped ${plan.routes.length} routes from (${origin.lat.toFixed(
        4
      )}, ${origin.lon.toFixed(4)}) to ${resolved.name} at ${plan.weather.temperature_c.toFixed(
        1
      )}°C. ${routeBreakdown}. Highlighted ${chosenRoute.route_id.toUpperCase()} as your best pick.`;

      const shortVoice = `I found ${plan.routes.length} routes to ${
        resolved.name
      }. ${chosenRoute.route_id.toUpperCase()} is your coolest option at ${chosenRoute.distance_km.toFixed(
        1
      )} kilometers with a ${chosenRoute.heat_score} heat score. Ready to start?`;

      appendMessage('assistant', detailedCard, true, 'gemini', shortVoice, modelUsed);
      return true;
    }

    if (action === 'select_route' && currentPlan && currentPlan.routes.length > 0) {
      const pref = (parsed.route_preference || '').toLowerCase();
      const shortest = currentPlan.routes.reduce(
        (min, r) => (r.distance_km < min.distance_km ? r : min),
        currentPlan.routes[0]
      );
      let targetId = selectedRouteId || currentPlan.routes[0].route_id;
      if (currentPlan.routes.some((r) => r.route_id.toLowerCase() === pref)) {
        targetId = pref;
      } else if (pref.includes('short')) {
        targetId = shortest.route_id;
      } else if (pref.includes('optimal')) {
        targetId = currentPlan.recommendations?.balanced || targetId;
      } else {
        targetId = currentPlan.recommendations?.heat_safe || targetId;
      }
      onSelectRoute(targetId);
      const detailed =
        parsed.detailed_reply ||
        parsed.reply ||
        `Switched active route to ${targetId.toUpperCase()}.`;
      const spoken =
        parsed.spoken_summary || `Switched to ${targetId}. Ready when you are!`;
      appendMessage('assistant', detailed, true, 'gemini', spoken, modelUsed);
      return true;
    }

    if (action === 'start_navigation') {
      startLiveNavigation();
      return true;
    }

    if (action === 'stop_navigation') {
      stopLiveNavigation();
      return true;
    }

    if (action === 'reroute') {
      await handleReroute();
      return true;
    }

    const detailed = parsed.detailed_reply || parsed.reply || '';
    if (detailed) {
      appendMessage(
        'assistant',
        detailed,
        true,
        'gemini',
        parsed.spoken_summary || buildConciseSpokenSummary(detailed),
        modelUsed
      );
      return true;
    }

    return false;
  };

  const answerAnalyticalQuestionLocally = (
    userText: string
  ): { detailed: string; spoken: string } | null => {
    const lower = userText.toLowerCase();

    if (
      /^(?:reach|take\s+me\s+to|walk\s+to|go\s+to|navigate\s+to|find\s+a\s+route\s+to|route\s+to)\b/i.test(
        lower
      )
    ) {
      return null;
    }

    const isQuestionOrComparison =
      lower.includes('temp') ||
      lower.includes('heat') ||
      lower.includes('hot') ||
      lower.includes('cool') ||
      lower.includes('weather') ||
      lower.includes('humid') ||
      lower.includes('wind') ||
      lower.includes('compare') ||
      lower.includes('difference') ||
      lower.includes('route 1') ||
      lower.includes('route one') ||
      lower.includes('route 2') ||
      lower.includes('route two') ||
      lower.includes('route 3');

    if (!isQuestionOrComparison) return null;

    if (!currentPlan || !currentPlan.routes.length) {
      return {
        detailed:
          "We haven't planned a route yet! Tell me where you'd like to walk first (like 'Reach Devi Ahilyabai Holkar Airport' or 'Take me to Rajwada'), and I'll compare the temperature and heat exposure for every route.",
        spoken: 'Tell me where you want to walk first, and I will compare the routes for you!',
      };
    }

    const w = currentPlan.weather;
    const rList = currentPlan.routes;
    const bestId = (
      currentPlan.recommendations?.heat_safe || rList[0].route_id
    ).toUpperCase();
    const bestRoute =
      rList.find((r) => r.route_id.toUpperCase() === bestId) || rList[0];

    const routeSummaries = rList
      .map(
        (r) =>
          `${r.route_id.toUpperCase()}: Heat ${r.heat_score}/100 (${
            r.heat_category
          }, ${r.distance_km.toFixed(2)} km, ${r.duration_min} min${
            r.environmental_exposure !== undefined
              ? `, surface proxy ${r.environmental_exposure.toFixed(1)}`
              : ''
          })`
      )
      .join(' • ');

    return {
      detailed: `Live Indore weather is ${w.temperature_c.toFixed(1)}°C (${
        w.relative_humidity
      }% humidity, ${w.wind_speed_kmh.toFixed(
        1
      )} km/h wind). Route Breakdown: ${routeSummaries}. Top Heat-Safe Pick: ${bestId}.`,
      spoken: `It's ${w.temperature_c.toFixed(
        1
      )} degrees in Indore right now. ${bestId} is your coolest choice with a ${
        bestRoute.heat_score
      } heat score.`,
    };
  };

  const processUserCommand = async (rawText: string) => {
    const text = rawText
      .replace(/^(?:hey|hi|hello|okay|ok)?\s*(?:mappy|mapi|mappie|mapie)[,.\s]*/i, '')
      .trim();
    if (!text) return;

    setIsOpen(true);
    setSingleShotListen(false);
    appendMessage('user', text);
    setInput('');
    setInterimTranscript('');
    setIsBusy(true);

    try {
      if (isGeminiConfigured) {
        try {
          const handled = await callGeminiBrain(text);
          if (handled) {
            setIsBusy(false);
            return;
          }
        } catch (err: any) {
          console.warn('Gemini fallback triggered:', err?.message);
        }
      }

      const localAnswer = answerAnalyticalQuestionLocally(text);
      if (localAnswer) {
        appendMessage(
          'assistant',
          localAnswer.detailed,
          true,
          'smart-local',
          localAnswer.spoken
        );
        setIsBusy(false);
        return;
      }

      const lower = text.toLowerCase();

      if (lower.includes('stop') || lower.includes('cancel')) {
        stopLiveNavigation();
        return;
      }

      if (
        lower.includes('start navigation') ||
        lower === 'yes' ||
        lower === 'start' ||
        lower.includes("let's go") ||
        lower.includes('lets go')
      ) {
        startLiveNavigation();
        return;
      }

      if (lower.includes('reroute') || lower.includes('another way')) {
        await handleReroute();
        return;
      }

      if (currentPlan && currentPlan.routes.length > 0) {
        if (lower.includes('shortest') || lower.includes('fastest')) {
          const shortest = currentPlan.routes.reduce(
            (min, r) => (r.distance_km < min.distance_km ? r : min),
            currentPlan.routes[0]
          );
          onSelectRoute(shortest.route_id);
          appendMessage(
            'assistant',
            `Switched to the SHORTEST route (${shortest.route_id.toUpperCase()}: ${shortest.distance_km.toFixed(
              2
            )} km, ${shortest.duration_min} min, Heat ${shortest.heat_score}/100).`,
            true,
            'smart-local',
            `Switched to ${shortest.route_id}, the shortest route at ${shortest.distance_km.toFixed(
              1
            )} kilometers.`
          );
          return;
        }
        if (lower.includes('optimal') || lower.includes('balanced')) {
          const optId = currentPlan.recommendations?.balanced || currentPlan.routes[0].route_id;
          onSelectRoute(optId);
          appendMessage(
            'assistant',
            `Switched to the OPTIMAL balanced route (${optId.toUpperCase()}).`,
            true,
            'smart-local',
            `Switched to ${optId}, your optimal balanced route.`
          );
          return;
        }
      }

      const rawOrigin = gpsLocationRef.current || (await acquireRealGpsPosition());
      const resolved = await resolveDestinationQuery(text);

      if (!resolved) {
        appendMessage(
          'assistant',
          `I couldn't find a place matching "${cleanSpokenDestinationQuery(
            text
          )}" in Indore. Try Devi Ahilyabai Holkar Airport, Rajwada, Sarafa Bazaar, Bhawarkuan, or 56 Dukan!`,
          true,
          'smart-local',
          `I couldn't find that place in Indore. Try Rajwada, Sarafa, or the Airport.`
        );
        return;
      }

      const origin = ensureDistinctOrigin(rawOrigin, resolved.coords);
      setActiveDest(resolved);

      const plan = await fetchPlannedRoutes({
        city: selectedCity.id,
        originLat: origin.lat,
        originLon: origin.lon,
        destLat: resolved.coords.lat,
        destLon: resolved.coords.lon,
      });

      const heatSafeId =
        plan.recommendations?.heat_safe ||
        plan.recommended_route ||
        plan.routes[0]?.route_id;

      onPlanLoaded(plan, origin, resolved.coords, heatSafeId);

      const hsRoute =
        plan.routes.find((r) => r.route_id === heatSafeId) || plan.routes[0];

      const allRoutesText = plan.routes
        .map(
          (r) =>
            `${r.route_id.toUpperCase()}: ${r.distance_km.toFixed(2)} km (${
              r.duration_min
            } min, Heat ${r.heat_score}/100)`
        )
        .join(' | ');

      appendMessage(
        'assistant',
        `Mapped ${plan.routes.length} routes from (${origin.lat.toFixed(4)}, ${origin.lon.toFixed(
          4
        )}) to ${resolved.name} (${plan.weather.temperature_c.toFixed(
          1
        )}°C). ${allRoutesText}. Highlighted ${hsRoute.route_id.toUpperCase()} as your Heat-Safe pick.`,
        true,
        'smart-local',
        `I found ${plan.routes.length} routes to ${
          resolved.name
        }. ${hsRoute.route_id.toUpperCase()} is your coolest option with a ${
          hsRoute.heat_score
        } heat score.`
      );
    } catch (err: any) {
      appendMessage('assistant', err?.message || 'Unable to process that request right now.', true);
    } finally {
      setIsBusy(false);
    }
  };

  processCommandRef.current = processUserCommand;

  useEffect(() => {
    const SpeechRec =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRec || (!handsFreeEnabled && !singleShotListen)) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      return;
    }

    const recognition = new SpeechRec();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current) return;

      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      const hasWakeWordInInterim = /(?:mappy|mapi|mappie|mapie)/i.test(interim);
      if (singleShotRef.current || hasWakeWordInInterim) {
        setInterimTranscript(interim);
      } else {
        setInterimTranscript('');
      }

      const combined = finalChunk.trim();
      if (!combined) return;

      setInterimTranscript('');

      const wakeMatch = combined.match(
        /(?:^|\b)(?:hey|hi|hello|okay|ok)?\s*(?:mappy|mapi|mappie|mapie|map\s*e)\b[,.\s]*(.*)$/i
      );

      if (wakeMatch) {
        const remainderCommand = (wakeMatch[1] || '').trim();
        setIsOpen(true);

        if (remainderCommand.length > 2) {
          processCommandRef.current(remainderCommand);
        } else {
          setSingleShotListen(true);
          speakSummary('Yes? Listening.');
        }
        return;
      }

      if (singleShotRef.current) {
        setSingleShotListen(false);
        processCommandRef.current(combined);
      }
    };

    recognition.onerror = () => {};

    recognition.onend = () => {
      if (handsFreeRef.current || singleShotRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // already started
          }
        }, 350);
      }
    };

    try {
      recognition.start();
    } catch {
      // ignore
    }

    return () => {
      try {
        recognition.onend = null;
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [handsFreeEnabled, singleShotListen]);

  const handleSaveApiKey = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = tempKeyInput.trim();
    setSavedKey(cleaned);
    if (typeof window !== 'undefined') {
      if (cleaned) {
        localStorage.setItem('MAPPY_GEMINI_API_KEY', cleaned);
      } else {
        localStorage.removeItem('MAPPY_GEMINI_API_KEY');
      }
    }
    setShowKeyModal(false);
    setLastApiError(null);
    appendMessage(
      'assistant',
      cleaned
        ? 'Gemini API key saved! Using active Gemini Flash models with dual Detailed Card + Voice Summarizer output.'
        : 'Removed custom API key; using smart local engine.',
      true,
      cleaned ? 'gemini' : 'smart-local',
      cleaned ? 'Gemini API key connected!' : 'Using local engine.'
    );
  };

  const routes = currentPlan?.routes || [];
  const heatSafeRouteId =
    currentPlan?.recommendations?.heat_safe ||
    currentPlan?.recommended_route ||
    routes[0]?.route_id;
  const optimalRouteId =
    currentPlan?.recommendations?.balanced || routes[0]?.route_id;
  const shortestRoute =
    routes.length > 0
      ? routes.reduce((min, r) => (r.distance_km < min.distance_km ? r : min), routes[0])
      : null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '1.75rem',
          right: '1.75rem',
          zIndex: 1500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setHandsFreeEnabled((prev) => !prev);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.85rem 1.1rem',
            borderRadius: '999px',
            border: '2px solid var(--color-cream)',
            backgroundColor: singleShotListen
              ? 'var(--heat-very-high)'
              : handsFreeEnabled
              ? 'var(--heat-low)'
              : 'var(--color-forest)',
            color: '#fff',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            cursor: 'pointer',
            boxShadow: '0 14px 35px rgba(1, 71, 46, 0.3)',
          }}
        >
          <Radio size={15} />
          {singleShotListen
            ? 'LISTENING FOR COMMAND...'
            : handsFreeEnabled
            ? 'WAKE WORD: "HEY MAPPY"'
            : 'WAKE WORD OFF'}
        </button>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="btn-pill-primary"
          style={{
            padding: '1rem 1.4rem',
            boxShadow: '0 20px 50px rgba(1, 71, 46, 0.38)',
            border: '2px solid var(--color-cream)',
          }}
          aria-label="Open Mappy AI Walking Companion"
        >
          <Sparkles size={18} />
          {isOpen ? 'CLOSE' : 'MAPPY AI'}
        </button>
      </div>

      {isOpen && (
        <aside
          aria-label="Mappy Heat-Safe Navigation Companion"
          className="card-cream"
          style={{
            position: 'fixed',
            bottom: '5.75rem',
            right: '1.75rem',
            width: 'min(92vw, 455px)',
            maxHeight: '83vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1500,
            overflow: 'hidden',
            border: '2px solid var(--color-forest)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-forest)',
              color: 'var(--color-cream)',
              padding: '0.95rem 1.2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Compass size={18} />
                <span
                  style={{
                    fontFamily: 'Anton, sans-serif',
                    fontSize: '1.18rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  MAPPY VOICE AGENT
                </span>
                <span
                  style={{
                    fontSize: '0.56rem',
                    fontWeight: 700,
                    letterSpacing: '0.13em',
                    padding: '0.18rem 0.5rem',
                    borderRadius: '999px',
                    backgroundColor:
                      isGeminiConfigured && !lastApiError
                        ? 'var(--heat-low)'
                        : 'var(--heat-moderate)',
                    color: '#fff',
                  }}
                >
                  {isGeminiConfigured && !lastApiError
                    ? `GEMINI (${activeModelId})`
                    : 'SMART LOCAL ENGINE'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.13em',
                  opacity: 0.85,
                  marginTop: '0.18rem',
                }}
              >
                {lastApiError
                  ? `⚠️ ${lastApiError.slice(0, 44)}`
                  : singleShotListen
                  ? '🎙️ SPEAK YOUR COMMAND NOW...'
                  : '🎙️ SAY "HEY MAPPY..." OR TAP SPEAK NOW'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => {
                  setTempKeyInput(geminiApiKey);
                  setShowKeyModal((prev) => !prev);
                }}
                title="Configure Google AI Studio Gemini API Key"
                style={{
                  background: isGeminiConfigured
                    ? 'rgba(46, 125, 50, 0.55)'
                    : 'var(--heat-high)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.4rem',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              >
                <KeyRound size={15} />
              </button>
              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                title={voiceEnabled ? 'Mute spoken responses' : 'Enable spoken responses'}
                style={{
                  background: 'rgba(254,250,224,0.15)',
                  border: 'none',
                  color: 'var(--color-cream)',
                  padding: '0.4rem',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize Mappy"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-cream)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {showKeyModal && (
            <form
              onSubmit={handleSaveApiKey}
              style={{
                backgroundColor: 'var(--color-sage)',
                padding: '0.85rem 1rem',
                borderBottom: '1.5px solid var(--color-forest)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                🔑 PASTE GOOGLE AI STUDIO GEMINI API KEY (SAVED LOCALLY IN BROWSER):
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="password"
                  className="input-editorial"
                  placeholder="AIzaSy..."
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
                />
                <button
                  type="submit"
                  className="btn-pill-primary"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.68rem' }}
                >
                  SAVE KEY
                </button>
              </div>
            </form>
          )}

          <div
            style={{
              backgroundColor: 'rgba(204, 213, 174, 0.55)',
              padding: '0.45rem 1rem',
              borderBottom: '1px solid rgba(1,71,46,0.12)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.68rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <LocateFixed size={13} />
              {gpsLocation ? (
                <span>
                  Origin: {gpsLocation.lat.toFixed(4)}, {gpsLocation.lon.toFixed(4)}{' '}
                  <span style={{ opacity: 0.75 }}>
                    (
                    {gpsSource === 'live_gps'
                      ? `Live GPS ±${gpsAccuracy}m`
                      : 'Indore Pilot Anchor'}
                    )
                  </span>
                </span>
              ) : (
                <span>Acquiring browser GPS...</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => acquireRealGpsPosition()}
              style={{
                background: 'var(--color-cream)',
                border: '1px solid rgba(1,71,46,0.25)',
                borderRadius: '999px',
                padding: '0.16rem 0.55rem',
                fontSize: '0.6rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              REFRESH GPS
            </button>
          </div>

          {routes.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--color-olive)',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid rgba(1,71,46,0.14)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {heatSafeRouteId && (
                  <button
                    type="button"
                    onClick={() => onSelectRoute(heatSafeRouteId)}
                    style={{
                      padding: '0.38rem',
                      borderRadius: '0.75rem',
                      border: '1.5px solid var(--color-forest)',
                      backgroundColor:
                        selectedRouteId === heatSafeRouteId
                          ? 'var(--color-forest)'
                          : 'var(--color-cream)',
                      color:
                        selectedRouteId === heatSafeRouteId
                          ? 'var(--color-cream)'
                          : 'var(--color-forest)',
                      fontSize: '0.63rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    HEAT-SAFE
                    <br />
                    <span style={{ opacity: 0.8 }}>{heatSafeRouteId.toUpperCase()}</span>
                  </button>
                )}

                {optimalRouteId && (
                  <button
                    type="button"
                    onClick={() => onSelectRoute(optimalRouteId)}
                    style={{
                      padding: '0.38rem',
                      borderRadius: '0.75rem',
                      border: '1.5px solid var(--color-forest)',
                      backgroundColor:
                        selectedRouteId === optimalRouteId
                          ? 'var(--color-forest)'
                          : 'var(--color-cream)',
                      color:
                        selectedRouteId === optimalRouteId
                          ? 'var(--color-cream)'
                          : 'var(--color-forest)',
                      fontSize: '0.63rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    OPTIMAL
                    <br />
                    <span style={{ opacity: 0.8 }}>{optimalRouteId.toUpperCase()}</span>
                  </button>
                )}

                {shortestRoute && (
                  <button
                    type="button"
                    onClick={() => onSelectRoute(shortestRoute.route_id)}
                    style={{
                      padding: '0.38rem',
                      borderRadius: '0.75rem',
                      border: '1.5px solid var(--color-forest)',
                      backgroundColor:
                        selectedRouteId === shortestRoute.route_id
                          ? 'var(--color-forest)'
                          : 'var(--color-cream)',
                      color:
                        selectedRouteId === shortestRoute.route_id
                          ? 'var(--color-cream)'
                          : 'var(--color-forest)',
                      fontSize: '0.63rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    SHORTEST
                    <br />
                    <span style={{ opacity: 0.8 }}>
                      {Number(shortestRoute.distance_km ?? 0).toFixed(2)} km
                    </span>
                  </button>
                )}
              </div>

              <div
                style={{
                  marginTop: '0.55rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  flexWrap: 'wrap',
                }}
              >
                {!navActive ? (
                  <button
                    type="button"
                    onClick={() => startLiveNavigation()}
                    className="btn-pill-primary"
                    style={{ padding: '0.42rem 0.9rem', fontSize: '0.65rem', width: '100%' }}
                  >
                    <Play size={13} /> START LIVE NAVIGATION ({selectedRouteId?.toUpperCase()})
                  </button>
                ) : (
                  <>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                      Progress: {progressPercent}% • Offset: {distanceFromRouteM}m • Following:{' '}
                      {(detectedRouteId || selectedRouteId)?.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => simulateWalkStep(false)}
                        className="btn-pill-secondary"
                        style={{ padding: '0.32rem 0.6rem', fontSize: '0.6rem', flex: 1 }}
                      >
                        <Navigation size={11} /> STEP ALONG
                      </button>
                      <button
                        type="button"
                        onClick={() => simulateWalkStep(true)}
                        className="btn-pill-secondary"
                        style={{ padding: '0.32rem 0.6rem', fontSize: '0.6rem', flex: 1 }}
                      >
                        TEST DRIFT
                      </button>
                      {navStatus === 'deviated' && (
                        <button
                          type="button"
                          onClick={handleReroute}
                          className="btn-pill-primary"
                          style={{ padding: '0.32rem 0.6rem', fontSize: '0.6rem' }}
                        >
                          <RefreshCw size={11} /> REROUTE
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={stopLiveNavigation}
                        className="btn-pill-secondary"
                        style={{ padding: '0.32rem 0.6rem', fontSize: '0.6rem' }}
                      >
                        <Square size={11} /> STOP
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div
            ref={chatScrollRef}
            style={{
              padding: '0.9rem 1rem',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.7rem',
              maxHeight: '260px',
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                  backgroundColor:
                    m.role === 'user' ? 'var(--color-forest)' : 'var(--color-olive)',
                  color: m.role === 'user' ? 'var(--color-cream)' : 'var(--color-forest)',
                  padding: '0.7rem 0.95rem',
                  borderRadius: '1.1rem',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                }}
              >
                {m.role === 'assistant' && m.engine && (
                  <div
                    style={{
                      fontSize: '0.56rem',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      opacity: 0.68,
                      marginBottom: '0.25rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {m.engine === 'gemini'
                      ? `✨ Gemini AI (${m.modelUsed || activeModelId})`
                      : '⚡ Mappy Local Telemetry'}
                  </div>
                )}
                <div>{m.text}</div>
                {m.role === 'assistant' &&
                  m.spokenSummary &&
                  m.spokenSummary !== m.text && (
                    <div
                      style={{
                        marginTop: '0.45rem',
                        paddingTop: '0.4rem',
                        borderTop: '1px dashed rgba(1, 71, 46, 0.2)',
                        fontSize: '0.73rem',
                        opacity: 0.85,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.4rem',
                      }}
                    >
                      <span>🔊 Spoken: "{m.spokenSummary}"</span>
                      <button
                        type="button"
                        onClick={() => speakSummary(m.spokenSummary!)}
                        style={{
                          background: 'var(--color-cream)',
                          border: '1px solid rgba(1,71,46,0.25)',
                          borderRadius: '999px',
                          padding: '0.1rem 0.45rem',
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        REPLAY
                      </button>
                    </div>
                  )}
              </div>
            ))}

            {interimTranscript && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '86%',
                  backgroundColor: 'rgba(1, 71, 46, 0.14)',
                  color: 'var(--color-forest)',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '1rem',
                  fontSize: '0.78rem',
                  fontStyle: 'italic',
                  border: '1px dashed var(--color-forest)',
                }}
              >
                🎙️ {interimTranscript}
              </div>
            )}

            {isBusy && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  opacity: 0.75,
                }}
              >
                ✨ MAPPY IS ANALYZING...
              </div>
            )}
          </div>

          <div
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: singleShotListen
                ? 'rgba(194, 65, 52, 0.15)'
                : 'var(--color-sage)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              borderTop: '1px solid rgba(1,71,46,0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSingleShotListen((prev) => !prev);
                setInterimTranscript('Speak your question or destination now...');
              }}
              disabled={isBusy}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: singleShotListen
                  ? 'var(--heat-very-high)'
                  : 'var(--color-forest)',
                color: 'var(--color-cream)',
                fontWeight: 700,
                fontSize: '0.68rem',
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              <Mic size={14} />
              {singleShotListen
                ? 'LISTENING FOR 1 COMMAND (TAP TO CANCEL)'
                : 'SPEAK NOW (OR SAY "HEY MAPPY...")'}
            </button>

            <button
              type="button"
              onClick={() => setHandsFreeEnabled((prev) => !prev)}
              style={{
                padding: '0.5rem 0.7rem',
                borderRadius: '999px',
                border: '1.5px solid var(--color-forest)',
                backgroundColor: handsFreeEnabled ? 'var(--color-cream)' : 'transparent',
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Toggle continuous 'Hey Mappy' wake-word detection"
            >
              {handsFreeEnabled ? <Mic size={13} /> : <MicOff size={13} />}
            </button>
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              processUserCommand(input);
            }}
            style={{
              padding: '0.6rem 1rem',
              borderTop: '1px solid rgba(1,71,46,0.14)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              className="input-editorial"
              placeholder="Ask about route temperatures, heat scores, or places..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isBusy}
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            />

            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              className="btn-pill-primary"
              style={{ padding: '0.55rem 0.85rem' }}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};

export default MappyAssistant;