/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { Info, MapPin } from 'lucide-react';

export const MUKTAINAGAR_CENTER = { lat: 21.0758, lng: 75.9817 };

export interface Coords { lat: number; lng: number }

interface Props {
  value: Coords | null;
  onChange: (c: Coords) => void;
  initialCenter?: Coords;
  height?: number;
  /** Optional: receive reverse-geocoded address parts. */
  onGeocode?: (g: { address: string; area: string }) => void;
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

type GMaps = typeof google.maps;
let mapsPromise: Promise<GMaps> | null = null;

// Track global Google Maps authentication status (e.g. RefererNotAllowedMapError)
let gmapsAuthFailed = false;
const authFailureListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  const prevFailure = (window as any).gm_authFailure;
  (window as any).gm_authFailure = () => {
    gmapsAuthFailed = true;
    console.warn('[LocationMapPicker] Google Maps authentication failed (RefererNotAllowedMapError). Falling back to OpenStreetMap.');
    authFailureListeners.forEach((fn) => fn());
    if (typeof prevFailure === 'function') {
      try { prevFailure(); } catch { /* ignore */ }
    }
  };
}

function loadGoogleMaps(): Promise<GMaps> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (gmapsAuthFailed) return Promise.reject(new Error('Google Maps Referer/Auth blocked'));
  if ((window as unknown as { google?: { maps?: GMaps } }).google?.maps) {
    return Promise.resolve((window as unknown as { google: { maps: GMaps } }).google.maps);
  }
  if (mapsPromise) return mapsPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error('Google Maps key missing'));

  mapsPromise = new Promise<GMaps>((resolve, reject) => {
    const cbName = `__gmapsInit_${Math.random().toString(36).slice(2)}`;
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      const g = (window as unknown as { google?: { maps?: GMaps } }).google?.maps;
      if (g) resolve(g); else reject(new Error('google.maps unavailable'));
      delete (window as unknown as Record<string, unknown>)[cbName];
    };
    const s = document.createElement('script');
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: 'async',
      callback: cbName,
      libraries: 'geocoding',
    });
    if (TRACKING_ID) params.set('channel', TRACKING_ID);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

// Dynamic Leaflet Loader for zero-dependency OpenStreetMap fallback
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    // 1. CSS
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // 2. JS
    const s = document.createElement('script');
    s.id = 'leaflet-cdn-js';
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => {
      const L = (window as any).L;
      if (L) resolve(L);
      else reject(new Error('Leaflet unavailable'));
    };
    s.onerror = () => reject(new Error('Failed to load Leaflet script'));
    document.head.appendChild(s);
  });

  return leafletPromise;
}

// Module-level LRU cache for reverse-geocode results
const GEOCODE_CACHE = new Map<string, { address: string; area: string }>();
const GEOCODE_CACHE_MAX = 200;
const geocodeKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export function clearGeocodeCacheNear(lat: number, lng: number, radiusKeys = 1): void {
  for (let dx = -radiusKeys; dx <= radiusKeys; dx++) {
    for (let dy = -radiusKeys; dy <= radiusKeys; dy++) {
      GEOCODE_CACHE.delete(geocodeKey(lat + dx * 0.0001, lng + dy * 0.0001));
    }
  }
}
export function clearAllGeocodeCache(): void { GEOCODE_CACHE.clear(); }

const cacheGet = (k: string) => {
  const v = GEOCODE_CACHE.get(k);
  if (v) { GEOCODE_CACHE.delete(k); GEOCODE_CACHE.set(k, v); }
  return v;
};
const cacheSet = (k: string, v: { address: string; area: string }) => {
  GEOCODE_CACHE.set(k, v);
  if (GEOCODE_CACHE.size > GEOCODE_CACHE_MAX) {
    const first = GEOCODE_CACHE.keys().next().value;
    if (first !== undefined) GEOCODE_CACHE.delete(first);
  }
};

// OpenStreetMap Nominatim reverse geocode fallback
async function reverseGeocodeOsm(lat: number, lng: number): Promise<{ address: string; area: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const area = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.county || '';
    const address = [a.road, a.suburb || a.neighbourhood, a.village || a.town].filter(Boolean).join(', ');
    return { address: address || data.display_name?.split(',').slice(0, 3).join(', ') || '', area };
  } catch {
    return null;
  }
}

export function LocationMapPicker({ value, onChange, initialCenter, height = 220, onGeocode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onGeocodeRef = useRef(onGeocode);
  onChangeRef.current = onChange;
  onGeocodeRef.current = onGeocode;

  // Active provider: 'google' or 'osm'
  const [provider, setProvider] = useState<'google' | 'osm'>(gmapsAuthFailed || !BROWSER_KEY ? 'osm' : 'google');
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('hybrid');
  const [showRefererNotice, setShowRefererNotice] = useState(gmapsAuthFailed);

  // Google Maps refs
  const gMapRef = useRef<google.maps.Map | null>(null);
  const gMarkerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Leaflet refs
  const leafletMapRef = useRef<any>(null);
  const leafletMarkerRef = useRef<any>(null);

  // Listen to Google Maps auth failures
  useEffect(() => {
    const handleAuthFail = () => {
      setShowRefererNotice(true);
      setProvider('osm');
    };
    authFailureListeners.add(handleAuthFail);
    return () => { authFailureListeners.delete(handleAuthFail); };
  }, []);

  // ── 1. GOOGLE MAPS LIFECYCLE ──────────────────────────────────────
  useEffect(() => {
    if (provider !== 'google' || !containerRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || gmapsAuthFailed) {
          if (gmapsAuthFailed) setProvider('osm');
          return;
        }
        const start = value ?? initialCenter ?? MUKTAINAGAR_CENTER;
        const map = new maps.Map(containerRef.current, {
          center: start,
          zoom: value ? 17 : 15,
          mapTypeId: mapType,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: 'greedy',
        });
        gMapRef.current = map;
        geocoderRef.current = new maps.Geocoder();

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onChangeRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      })
      .catch((err) => {
        console.warn('[LocationMapPicker] Google Maps failed to load, switching to OpenStreetMap:', err.message);
        if (!cancelled) {
          setShowRefererNotice(true);
          setProvider('osm');
        }
      });

    return () => { cancelled = true; };
  }, [provider]);

  // Sync Google Map type
  useEffect(() => {
    if (provider === 'google' && gMapRef.current) {
      gMapRef.current.setMapTypeId(mapType);
    }
  }, [provider, mapType]);

  // Sync Google Map marker
  useEffect(() => {
    if (provider !== 'google') return;
    const map = gMapRef.current;
    if (!map || !value) {
      if (gMarkerRef.current && !value) {
        gMarkerRef.current.setMap(null);
        gMarkerRef.current = null;
      }
      return;
    }
    const pos = { lat: value.lat, lng: value.lng };
    if (!gMarkerRef.current) {
      const marker = new google.maps.Marker({
        map,
        position: pos,
        draggable: true,
      });
      let dragTimer: number | null = null;
      marker.addListener('drag', () => {
        const p = marker.getPosition();
        if (!p) return;
        if (dragTimer) window.clearTimeout(dragTimer);
        dragTimer = window.setTimeout(() => onChangeRef.current({ lat: p.lat(), lng: p.lng() }), 80);
      });
      marker.addListener('dragend', () => {
        if (dragTimer) { window.clearTimeout(dragTimer); dragTimer = null; }
        const p = marker.getPosition();
        if (p) onChangeRef.current({ lat: p.lat(), lng: p.lng() });
      });
      gMarkerRef.current = marker;
    } else {
      gMarkerRef.current.setPosition(pos);
    }
    map.panTo(pos);
    if ((map.getZoom() ?? 0) < 15) map.setZoom(17);

    // Reverse geocode via Google Geocoder
    if (onGeocodeRef.current && geocoderRef.current) {
      const cacheK = geocodeKey(pos.lat, pos.lng);
      const cached = cacheGet(cacheK);
      if (cached) {
        onGeocodeRef.current(cached);
      } else {
        geocoderRef.current
          .geocode({ location: pos })
          .then(({ results }) => {
            if (!results || results.length === 0) return;
            const best = results[0];
            const comps = best.address_components ?? [];
            const get = (type: string) =>
              comps.find((c) => c.types.includes(type))?.long_name ?? '';
            const area =
              get('sublocality_level_1') ||
              get('sublocality') ||
              get('neighborhood') ||
              get('locality') ||
              get('administrative_area_level_2') ||
              '';
            const address = (best.formatted_address ?? '')
              .split(',')
              .slice(0, 3)
              .join(',')
              .trim();
            const out = { address, area };
            cacheSet(cacheK, out);
            onGeocodeRef.current?.(out);
          })
          .catch(() => { /* silent */ });
      }
    }
  }, [provider, value]);

  // ── 2. OPENSTREETMAP (LEAFLET) LIFECYCLE ───────────────────────────
  useEffect(() => {
    if (provider !== 'osm' || !containerRef.current) return;
    let cancelled = false;

    // Clean container if it previously had Google Maps DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        const start = value ?? initialCenter ?? MUKTAINAGAR_CENTER;

        // Custom clean SVG pin icon
        const pinIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `<div style="transform: translate(-50%, -100%);"><svg width="34" height="42" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="#fff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg></div>`,
          iconSize: [0, 0],
        });

        const map = L.map(containerRef.current, {
          center: [start.lat, start.lng],
          zoom: value ? 17 : 15,
          zoomControl: false,
          attributionControl: false,
        });

        // OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        // Zoom control in bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Marker
        const marker = L.marker([start.lat, start.lng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);

        marker.on('drag', () => {
          const p = marker.getLatLng();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        });

        marker.on('dragend', () => {
          const p = marker.getLatLng();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        leafletMapRef.current = map;
        leafletMarkerRef.current = marker;
      })
      .catch((err) => {
        console.warn('[LocationMapPicker] Leaflet fallback failed:', err);
      });

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch { /* ignore */ }
        leafletMapRef.current = null;
      }
    };
  }, [provider]);

  // Sync Leaflet marker when value changes
  useEffect(() => {
    if (provider !== 'osm' || !leafletMapRef.current) return;
    if (value && leafletMarkerRef.current) {
      leafletMarkerRef.current.setLatLng([value.lat, value.lng]);
      leafletMapRef.current.panTo([value.lat, value.lng]);

      // Reverse geocode via Nominatim
      if (onGeocodeRef.current) {
        const cacheK = geocodeKey(value.lat, value.lng);
        const cached = cacheGet(cacheK);
        if (cached) {
          onGeocodeRef.current(cached);
        } else {
          reverseGeocodeOsm(value.lat, value.lng).then((res) => {
            if (res) {
              cacheSet(cacheK, res);
              onGeocodeRef.current?.(res);
            }
          });
        }
      }
    }
  }, [provider, value]);

  return (
    <div className="relative isolate z-0 rounded-xl overflow-hidden border border-border shadow-xs" style={{ height }}>
      {/* Top Banner & Mode Toggle */}
      <div className="absolute top-2 inset-x-2 z-[400] flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
        {/* OpenStreetMap Fallback Notice */}
        {provider === 'osm' ? (
          <div className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-background/90 text-foreground border border-border backdrop-blur-xs shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OpenStreetMap</span>
            {showRefererNotice && (
              <span className="text-[10px] text-muted-foreground opacity-80" title="Google Maps API key is restricted by HTTP Referrer. OpenStreetMap fallback is active.">
                · Free Fallback
              </span>
            )}
          </div>
        ) : (
          <div className="pointer-events-auto flex rounded-lg overflow-hidden shadow-xs border border-border bg-card text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMapType('roadmap')}
              className={`px-2.5 py-1 text-[11px] ${mapType === 'roadmap' ? 'bg-primary text-primary-foreground font-bold' : 'bg-card text-foreground hover:bg-muted'}`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapType('hybrid')}
              className={`px-2.5 py-1 text-[11px] border-l border-border ${mapType === 'hybrid' ? 'bg-primary text-primary-foreground font-bold' : 'bg-card text-foreground hover:bg-muted'}`}
            >
              Satellite
            </button>
          </div>
        )}

        <div className="pointer-events-auto text-[10.5px] text-muted-foreground bg-background/85 backdrop-blur-xs px-2 py-0.5 rounded-md border border-border">
          Tap or drag pin
        </div>
      </div>

      {/* Map DOM Target */}
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
