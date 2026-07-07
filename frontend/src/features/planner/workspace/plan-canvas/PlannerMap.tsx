'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Compass, 
  Loader2,
  Map as MapIcon,
  Globe
} from 'lucide-react';
import { MockTripData, ItineraryItem } from './mockData';

interface PlannerMapProps {
  planData: MockTripData;
  hoveredItem: ItineraryItem | null;
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
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDV-Iz869XNnqx17Ou39MiZoSn977EymoM";

export default function PlannerMap({ planData, hoveredItem, focusedDayId, onPinClick }: PlannerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>('roadmap');
  const [selectedPin, setSelectedPin] = useState<MapPinNode | null>(null);

  // 1. Load Google Maps JS API script
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
  const mainCityName = planData.cities[0]?.cityName || 'Darjeeling';

  const pins: MapPinNode[] = useMemo(() => {
    const list: MapPinNode[] = [];
    planData.cities.forEach((city) => {
      let itemIdx = 0;
      city.days.forEach((day) => {
        if (focusedDayId && day.id !== focusedDayId) return;

        day.items.forEach((item) => {
          if (item.isInactive || item.isDeleting) return;
          const lat = item.latitude || 27.0360 + (itemIdx * 0.004);
          const lng = item.longitude || 88.2627 + (itemIdx * 0.004);

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
          });
          itemIdx++;
        });
      });
    });
    return list;
  }, [planData, focusedDayId]);

  // 3. Initialize Google Map instance & Geocode destination city
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapInstanceRef.current) return;
    const win = window as any;
    if (!win.google?.maps) return;

    const initialCenter = { lat: 27.0360, lng: 88.2627 };
    const map = new win.google.maps.Map(containerRef.current, {
      center: initialCenter,
      zoom: 12,
      mapTypeId: mapTheme,
      disableDefaultUI: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // Geocode primary city dynamically
    const geocoder = new win.google.maps.Geocoder();
    geocoder.geocode({ address: mainCityName }, (results: any, status: any) => {
      if (status === 'OK' && results[0] && mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(results[0].geometry.location);
      }
    });
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

    pins.forEach((pin, index) => {
      const pos = { lat: pin.latitude, lng: pin.longitude };
      bounds.extend(pos);
      pathCoordinates.push(pos);

      // Create Google Marker
      const marker = new win.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: pin.title,
        label: {
          text: `${index + 1}`,
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '11px',
        },
      });

      marker.addListener('click', () => {
        setSelectedPin(pin);
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

  // 6. Pan to Hovered Item
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !hoveredItem) return;
    if (hoveredItem.latitude && hoveredItem.longitude) {
      mapInstanceRef.current.panTo({ lat: hoveredItem.latitude, lng: hoveredItem.longitude });
    }
  }, [hoveredItem, isLoaded]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      {!isLoaded && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-white">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
          <p className="text-xs font-medium text-slate-400">Loading Google Maps...</p>
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
      </div>

      {/* Active Pin Info Card Overlay */}
      {selectedPin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 left-6 z-10 w-72 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-white shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                {selectedPin.type}
              </span>
              <h4 className="mt-1 font-bold text-white text-sm">{selectedPin.title}</h4>
              <p className="text-xs text-slate-400">{selectedPin.cityName} • Day {selectedPin.dayNumber}</p>
            </div>
            <button
              onClick={() => setSelectedPin(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          {selectedPin.item.price && (
            <p className="mt-2 text-xs font-semibold text-emerald-400">{selectedPin.item.price}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
