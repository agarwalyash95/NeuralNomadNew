'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Compass, 
  Loader2,
  Map as MapIcon,
  Globe
} from 'lucide-react';
import { MockTripData, ItineraryItem } from './types';
import { CATEGORY_STYLE } from './utils/categoryStyle';
import { usePlannerHoverStore } from '@/store/planner-hover.store';

interface PlannerMapProps {
  planData: MockTripData;
  /** A deliberately pinned item always wins over ambient hover. */
  pinnedItem?: ItineraryItem | null;
  focusedDayId?: string | null;
  onPinClick?: (item: ItineraryItem) => void;
}

type MapTheme = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

interface MapPinNode {
  id: string;
  title: string;
  type: string;
  latitude: number;
  longitude: number;
  item: ItineraryItem;
  cityName: string;
  dayNumber: number;
  dayId: string;
  // True when this item had no real latitude/longitude and was placed at a
  // computed fallback position — never presented with the same visual
  // confidence as a real location. See docs/travel-intelligence-implementation-roadmap.md §2.5.
  isPositionFallback: boolean;
}

// No fallback key on purpose: a missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY must
// fail visibly (map error state) rather than silently bill a shared key.
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Synchronous placeholder canvas
function getPlaceholderPin(type: string, isHovered: boolean) {
  // Same hex values GenericNode/AIInsightsPanel/SuggestionCard use — a pin
  // used to lump activity and attraction into one color even though the
  // timeline tells them apart. Transport modes stay one blue on the map
  // (a map cares "this is a transit leg", not which specific mode).
  const color = ['flight', 'train', 'bus', 'cab', 'transit'].includes(type)
    ? '#3b82f6'
    : (CATEGORY_STYLE as Record<string, { hex: string }>)[type]?.hex ?? '#64748b';

  const size = isHovered ? 44 : 32;
  const canvas = document.createElement('canvas');
  canvas.width = size + 6;
  canvas.height = size + 6;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const radius = size / 2;
  const centerX = radius + 3;
  const centerY = radius + 3;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  return canvas.toDataURL();
}

// Asynchronous circular thumbnail image renderer
function createCircularMarkerImage(imageUrl: string, isHovered: boolean, callback: (dataUrl: string) => void) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageUrl;

  const size = isHovered ? 44 : 32;
  const canvas = document.createElement('canvas');
  canvas.width = size + 6;
  canvas.height = size + 6;
  const ctx = canvas.getContext('2d');

  const drawFallback = () => {
    if (!ctx) return;
    const radius = size / 2;
    const centerX = radius + 3;
    const centerY = radius + 3;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    callback(canvas.toDataURL());
  };

  img.onload = () => {
    if (!ctx) {
      drawFallback();
      return;
    }
    const radius = size / 2;
    const centerX = radius + 3;
    const centerY = radius + 3;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2.5, 0, 2 * Math.PI);
    ctx.clip();
    ctx.drawImage(img, centerX - radius, centerY - radius, size, size);
    ctx.restore();

    callback(canvas.toDataURL());
  };

  img.onerror = () => {
    drawFallback();
  };
}

export default function PlannerMap({ planData, pinnedItem, focusedDayId, onPinClick }: PlannerMapProps) {
  // Subscribed locally so hover changes only re-render the map, never the
  // parent workspace or the timeline — see planner-hover.store.ts.
  const ambientHovered = usePlannerHoverStore((s) => s.hoveredItem);
  const hoveredItem = pinnedItem || ambientHovered;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>('roadmap');
  const [clickedPin, setClickedPin] = useState<MapPinNode | null>(null);
  const [isRouteView, setIsRouteView] = useState(false);

  // 1. Load Google Maps JS API script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // No key → don't inject a doomed script; the render shows a setup hint
    if (!GOOGLE_MAPS_API_KEY) return;

    const win = window as any;
    if (win.google && win.google.maps) {
      setIsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-js-sdk';
    let checkInterval: any = null;

    if (document.getElementById(scriptId)) {
      checkInterval = setInterval(() => {
        if (win.google && win.google.maps) {
          setIsLoaded(true);
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 200);
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);


  // 2. Derive pin list
  // No hardcoded destination fallback — an empty string skips the geocode
  // call below rather than silently centering an unrelated trip on Darjeeling.
  const mainCityName = planData.cities[0]?.cityName || '';

  const pins: MapPinNode[] = useMemo(() => {
    const list: MapPinNode[] = [];
    planData.cities.forEach((city) => {
      // A real fallback center for this city, computed from whatever items in
      // it do have coordinates — never a hardcoded location from an unrelated
      // city. Only if the whole city has zero geo-located items do we fall
      // back further (the map's own initial center, itself geocoded from the
      // trip's actual destination — see the mainCityName geocode below).
      const knownCoords = city.days
        .flatMap((d) => d.items)
        .filter((it) => !it.isInactive && !it.isDeleting && it.latitude != null && it.longitude != null);
      const cityCenter = knownCoords.length
        ? {
            lat: knownCoords.reduce((s, it) => s + (it.latitude as number), 0) / knownCoords.length,
            lng: knownCoords.reduce((s, it) => s + (it.longitude as number), 0) / knownCoords.length,
          }
        : null;

      let itemIdx = 0;
      city.days.forEach((day) => {
        if (!isRouteView && focusedDayId && day.id !== focusedDayId) return;

        day.items.forEach((item) => {
          if (item.isInactive || item.isDeleting) return;
          const hasRealCoords = item.latitude != null && item.longitude != null;
          const fallbackCenter = cityCenter || { lat: 20.5937, lng: 78.9629 }; // India centroid — last-resort only
          const lat = hasRealCoords ? (item.latitude as number) : fallbackCenter.lat + (itemIdx * 0.004);
          const lng = hasRealCoords ? (item.longitude as number) : fallbackCenter.lng + (itemIdx * 0.004);

          list.push({
            id: item.id,
            title: item.title,
            type: item.type,
            latitude: lat,
            longitude: lng,
            item,
            cityName: city.cityName,
            dayNumber: day.dayNumber,
            dayId: day.id,
            isPositionFallback: !hasRealCoords,
          });
          itemIdx++;
        });
      });
    });
    return list;
  }, [planData, focusedDayId, isRouteView]);

  // 3. Initialize Google Map instance & Geocode destination city
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapInstanceRef.current) return;
    const win = window as any;
    if (!win.google?.maps) return;

    // Last-resort initial center only — geocode below re-centers on the
    // trip's actual destination (mainCityName) as soon as it resolves.
    const initialCenter = { lat: 20.5937, lng: 78.9629 };
    const map = new win.google.maps.Map(containerRef.current, {
      center: initialCenter,
      zoom: 12,
      mapTypeId: mapTheme,
      disableDefaultUI: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // Geocode primary city dynamically — skipped entirely when there's no
    // real destination yet, rather than geocoding a hardcoded placeholder city.
    if (mainCityName) {
      const geocoder = new win.google.maps.Geocoder();
      geocoder.geocode({ address: mainCityName }, (results: any, status: any) => {
        if (status === 'OK' && results[0] && mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(results[0].geometry.location);
        }
      });
    }
  }, [isLoaded, mainCityName, mapTheme]);

  // 4. Update Map Type
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(mapTheme);
    }
  }, [mapTheme]);

  // 5. Update Markers & Polyline Route
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    const win = window as any;
    if (!win.google?.maps) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (pins.length === 0) return;

    const bounds = new win.google.maps.LatLngBounds();
    const pathCoordinates: any[] = [];

    pins.forEach((pin) => {
      const pos = { lat: pin.latitude, lng: pin.longitude };
      bounds.extend(pos);
      pathCoordinates.push(pos);

      // Create Google Marker with circular placeholder
      const placeholderIcon = getPlaceholderPin(pin.type, false);
      const marker = new win.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: pin.isPositionFallback ? `${pin.title} (exact location unknown)` : pin.title,
        // Fallback-positioned pins render visibly faded — "we don't know
        // where this is" stays honest instead of looking like a real location.
        opacity: pin.isPositionFallback ? 0.55 : 1,
        icon: {
          url: placeholderIcon,
          size: new win.google.maps.Size(38, 38),
          scaledSize: new win.google.maps.Size(38, 38),
          anchor: new win.google.maps.Point(19, 19),
        },
      });

      (marker as any).pinId = pin.id;
      (marker as any).pinType = pin.type;
      (marker as any).standardIconUrl = placeholderIcon;
      (marker as any).hoveredIconUrl = getPlaceholderPin(pin.type, true);

      // A photo of *some* hotel on *your* hotel's pin is fabricated data in
      // miniature — the circular-crop fetch only runs when this place has
      // its own real photo. No image stays the honest category-glyph pin.
      if (pin.item.image) {
        createCircularMarkerImage(pin.item.image, false, (stdUrl) => {
          (marker as any).standardIconUrl = stdUrl;
          if (hoveredItem?.id !== pin.id) {
            marker.setIcon({
              url: stdUrl,
              size: new win.google.maps.Size(38, 38),
              scaledSize: new win.google.maps.Size(38, 38),
              anchor: new win.google.maps.Point(19, 19),
            });
          }
        });
        createCircularMarkerImage(pin.item.image, true, (hovUrl) => {
          (marker as any).hoveredIconUrl = hovUrl;
          if (hoveredItem?.id === pin.id) {
            marker.setIcon({
              url: hovUrl,
              size: new win.google.maps.Size(54, 54),
              scaledSize: new win.google.maps.Size(54, 54),
              anchor: new win.google.maps.Point(27, 27),
            });
          }
        });
      }

      marker.addListener('click', () => {
        setClickedPin(pin);
        onPinClick?.(pin.item);
      });

      markersRef.current.push(marker);
    });

    // Draw Polyline Route
    if (pathCoordinates.length > 1) {
      const polyline = new win.google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
      polyline.setMap(mapInstanceRef.current);
      polylineRef.current = polyline;
    }

    // Fit Map Bounds
    if (pins.length > 1) {
      mapInstanceRef.current.fitBounds(bounds);
    } else if (pins.length === 1 && pins[0]) {
      mapInstanceRef.current.setCenter({ lat: pins[0].latitude, lng: pins[0].longitude });
    }
  }, [isLoaded, pins, onPinClick]);

  // 6. Highlight, Pan, and Auto-Overlay Hovered Item (Synchronous Icon Swaps)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    const win = window as any;
    if (!win.google?.maps) return;



    markersRef.current.forEach((marker) => {
      const isHovered = hoveredItem && marker.pinId === hoveredItem.id;
      if (isHovered) {
        marker.setAnimation(win.google.maps.Animation.BOUNCE);
        marker.setZIndex(9999);
        if (marker.hoveredIconUrl) {
          marker.setIcon({
            url: marker.hoveredIconUrl,
            size: new win.google.maps.Size(54, 54),
            scaledSize: new win.google.maps.Size(54, 54),
            anchor: new win.google.maps.Point(27, 27),
          });
        }
        if (hoveredItem.latitude && hoveredItem.longitude) {
          mapInstanceRef.current.panTo({ lat: hoveredItem.latitude, lng: hoveredItem.longitude });
        }
      } else {
        marker.setAnimation(null);
        marker.setZIndex(1);
        if (marker.standardIconUrl) {
          marker.setIcon({
            url: marker.standardIconUrl,
            size: new win.google.maps.Size(38, 38),
            scaledSize: new win.google.maps.Size(38, 38),
            anchor: new win.google.maps.Point(19, 19),
          });
        }
      }
    });
  }, [hoveredItem, isLoaded, pins, clickedPin]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      {!isLoaded && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-white">
          {GOOGLE_MAPS_API_KEY ? (
            <>
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
              <p className="text-xs font-medium text-slate-400">Loading Google Maps...</p>
            </>
          ) : (
            <div className="max-w-xs px-6 text-center">
              <MapIcon className="mx-auto mb-3 h-8 w-8 text-slate-500" />
              <p className="text-xs font-bold text-slate-300">Map key not configured</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                Set <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in{' '}
                <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300">frontend/.env.local</code> and restart the dev server.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Google Map Container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Top Floating Control Bar */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/80 p-1.5 backdrop-blur-md">
        <button
          onClick={() => setMapTheme('roadmap')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            mapTheme === 'roadmap' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          <MapIcon size={13} /> Map
        </button>
        <button
          onClick={() => setMapTheme('satellite')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            mapTheme === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          <Globe size={13} /> Satellite
        </button>
        <button
          onClick={() => setMapTheme('hybrid')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            mapTheme === 'hybrid' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          <Compass size={13} /> Hybrid
        </button>

        <div className="h-4 w-[1px] bg-white/20 mx-1" />

        <button
          onClick={() => setIsRouteView(!isRouteView)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-all border ${
            isRouteView 
              ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs' 
              : 'border-transparent text-slate-300 hover:text-white'
          }`}
          title={isRouteView ? "Click to focus map on the active day's timeline items" : "Click to display all pins and routes across the entire trip"}
        >
          🌍 {isRouteView ? 'Entire Trip' : 'Focused Day'}
        </button>
      </div>
    </div>
  );
}
