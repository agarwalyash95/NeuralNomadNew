'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Map, { Marker, NavigationControl, FullscreenControl, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Compass, 
  Plane,
  Home,
  Utensils,
  Camera,
  Car,
  MapPin,
  Train,
  Bus,
  Loader2,
  Maximize2,
  Map as MapIcon,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { MockTripData, ItineraryItem } from './mockData';

interface PlannerMapProps {
  planData: MockTripData;
  hoveredItem: ItineraryItem | null;
  focusedDayId?: string | null;
  onPinClick?: (item: ItineraryItem) => void;
}

type MapTheme = 'streets' | 'light' | 'dark' | 'satellite';

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

// Fallback coordinate mapping for mock data or geocoding misses
const CITY_COORDINATES_LOOKUP: Record<string, { lat: number; lng: number }> = {
  manali: { lat: 32.2396, lng: 77.1887 },
  kasol: { lat: 32.0100, lng: 77.3150 },
  tosh: { lat: 32.0125, lng: 77.3500 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  goa: { lat: 15.2993, lng: 74.1240 },
  shimla: { lat: 31.1048, lng: 77.1734 },
  dharamshala: { lat: 32.2190, lng: 76.3234 },
  agra: { lat: 27.1767, lng: 78.0081 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  srinagar: { lat: 34.0837, lng: 74.7973 },
  leh: { lat: 34.1526, lng: 77.5771 },
  paris: { lat: 48.8566, lng: 2.3522 },
  london: { lat: 51.5074, lng: -0.1278 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  new_york: { lat: 40.7128, lng: -74.0060 },
};

// Premium token-free Maplibre styles from CartoDB and Esri satellite raster
const THEME_STYLES: Record<MapTheme, string | any> = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: {
    version: 8,
    sources: {
      'satellite-tiles': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Esri, Maxar, Earthstar Geographics'
      }
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite-tiles',
        minzoom: 0,
        maxzoom: 20
      }
    ]
  }
};

export default function PlannerMap({ planData, hoveredItem, focusedDayId, onPinClick }: PlannerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>('streets');
  const [selectedPin, setSelectedPin] = useState<MapPinNode | null>(null);

  // Avoid SSR rendering failures of WebGL MapLibre
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Generate markers with coordinates dynamically (and apply smart coordinate spiral spacing for fallbacks)
  const pins: MapPinNode[] = useMemo(() => {
    const list: MapPinNode[] = [];

    const getCoordsForCity = (cityName: string): { lat: number; lng: number } => {
      const lower = cityName.toLowerCase();
      for (const key of Object.keys(CITY_COORDINATES_LOOKUP)) {
        if (lower.includes(key)) {
          const coords = CITY_COORDINATES_LOOKUP[key];
          if (coords) return coords;
        }
      }
      return { lat: 28.6139, lng: 77.2090 }; // Delhi fallback
    };

    planData.cities.forEach((city) => {
      const baseCoords = getCoordsForCity(city.cityName);
      
      let totalItemsInCity = 0;
      city.days.forEach(d => { totalItemsInCity += d.items.length; });

      let currentItemIndex = 0;
      city.days.forEach((day) => {
        day.items.forEach((item) => {
          if (item.isInactive || item.isDeleting) return;
          let lat = item.latitude;
          let lng = item.longitude;

          // Jitter and angle-spread to prevent overlapping markers on identical geolocations
          if (!lat || !lng) {
            const angle = (currentItemIndex / (totalItemsInCity || 1)) * 2 * Math.PI + 0.5;
            const radius = 0.012 + (currentItemIndex % 2 === 0 ? 0.003 : -0.003) + (item.type === 'hotel' ? -0.005 : 0);
            lat = baseCoords.lat + Math.sin(angle) * radius;
            lng = baseCoords.lng + Math.cos(angle) * radius;
          }

          list.push({
            id: item.id,
            title: item.title,
            type: item.type,
            latitude: lat,
            longitude: lng,
            item,
            cityName: city.cityName,
            dayNumber: day.dayNumber,
            dayId: day.id
          });
          currentItemIndex++;
        });
      });
    });

    return list;
  }, [planData]);

  // 2. Sort pins chronologically to compute routing lines
  const sortedPinsForPath = useMemo(() => {
    return [...pins].sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.id.localeCompare(b.id);
    });
  }, [pins]);

  // Generate GeoJSON line feature
  const routeGeoJSON = useMemo(() => {
    const coords = sortedPinsForPath.map(p => [p.longitude, p.latitude]);
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: coords
      }
    };
  }, [sortedPinsForPath]);

  // 3. Compute initial center state based on pins bounding box
  const initialViewState = useMemo(() => {
    if (pins.length === 0) {
      return {
        longitude: 77.1887,
        latitude: 32.2396,
        zoom: 11
      };
    }

    let minLng = 180, maxLng = -180;
    let minLat = 90, maxLat = -90;

    pins.forEach(p => {
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
    });

    return {
      longitude: (minLng + maxLng) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: pins.length === 1 ? 12 : 9
    };
  }, [pins]);

  // Recenter map viewport to encapsulate all pins
  const recenterAll = () => {
    if (pins.length === 0 || !mapRef.current) return;
    
    let minLng = 180, maxLng = -180;
    let minLat = 90, maxLat = -90;

    pins.forEach(p => {
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
    });

    mapRef.current.fitBounds([minLng, minLat, maxLng, maxLat], {
      padding: 60,
      duration: 1500
    });
  };

  // 4. Trigger auto-camera fit on initial load
  useEffect(() => {
    let timer: any = null;
    if (isMounted && pins.length > 0) {
      timer = setTimeout(() => {
        recenterAll();
      }, 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isMounted, pins]);

  // 5. Track hovered item to initiate camera flight zoom focus
  useEffect(() => {
    if (hoveredItem) {
      const pin = pins.find(p => p.id === hoveredItem.id);
      if (pin && mapRef.current) {
        mapRef.current.flyTo({
          center: [pin.longitude, pin.latitude],
          zoom: 15.5,
          duration: 1500,
          essential: true
        });
        setSelectedPin(pin);
      }
    }
  }, [hoveredItem, pins]);

  // 6. Track day changes to zoom to the coordinates bounding box of that day
  useEffect(() => {
    if (!focusedDayId || !mapRef.current) return;

    const dayPins = pins.filter(p => p.dayId === focusedDayId);
    if (dayPins.length === 0) return;

    if (dayPins.length === 1 && dayPins[0]) {
      const pin = dayPins[0];
      mapRef.current.flyTo({
        center: [pin.longitude, pin.latitude],
        zoom: 14.5,
        duration: 1500,
        essential: true
      });
      setSelectedPin(pin);
    } else {
      let minLng = 180, maxLng = -180;
      let minLat = 90, maxLat = -90;

      dayPins.forEach(p => {
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
      });

      mapRef.current.fitBounds([minLng, minLat, maxLng, maxLat], {
        padding: 80,
        duration: 1500
      });

      // Show detail card of the first item of the focused day
      const firstPin = dayPins.sort((a, b) => a.id.localeCompare(b.id))[0];
      if (firstPin) {
        setSelectedPin(firstPin);
      }
    }
  }, [focusedDayId, pins]);

  // Category Icon Resolver
  const getPinStyle = (type: string) => {
    let icon = <MapPin size={14} />;
    let gradient = 'from-slate-500 to-slate-700';
    let glow = 'shadow-slate-500/20';

    switch (type) {
      case 'flight':
        icon = <Plane size={14} className="rotate-45 text-white fill-white" />;
        gradient = 'from-blue-500 to-indigo-600';
        glow = 'shadow-indigo-500/40';
        break;
      case 'hotel':
        icon = <Home size={14} className="text-white fill-white" />;
        gradient = 'from-violet-500 to-purple-600';
        glow = 'shadow-purple-500/40';
        break;
      case 'food':
        icon = <Utensils size={14} className="text-white fill-white" />;
        gradient = 'from-amber-500 to-orange-600';
        glow = 'shadow-orange-500/40';
        break;
      case 'activity':
        icon = <Camera size={14} className="text-white fill-white" />;
        gradient = 'from-emerald-500 to-teal-600';
        glow = 'shadow-emerald-500/40';
        break;
      case 'taxi':
      case 'cab':
        icon = <Car size={14} className="text-white fill-white" />;
        gradient = 'from-yellow-400 to-amber-500';
        glow = 'shadow-amber-500/40';
        break;
      case 'train':
        icon = <Train size={14} className="text-white fill-white" />;
        gradient = 'from-cyan-500 to-blue-600';
        glow = 'shadow-cyan-500/40';
        break;
      case 'bus':
        icon = <Bus size={14} className="text-white fill-white" />;
        gradient = 'from-teal-500 to-emerald-600';
        glow = 'shadow-teal-500/40';
        break;
    }

    return { icon, gradient, glow };
  };

  const getThemeIcon = (t: MapTheme) => {
    switch (t) {
      case 'light': return <Sun size={13} />;
      case 'dark': return <Moon size={13} />;
      case 'satellite': return <Globe size={13} />;
      case 'streets':
      default:
        return <MapIcon size={13} />;
    }
  };

  if (!isMounted) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#fbfaf7] border-b border-[#e2ddd2]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="mt-2 text-xs font-bold text-[#8c857b] uppercase tracking-wider">Mounting Map Canvas...</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden select-none border-b border-[#e2ddd2] bg-[#f0ede6]">
      {/* 1. Header Toolbar Theme Selector */}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-2xl bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(139,124,103,0.14)] border border-[#e2ddd2]/80 backdrop-blur-md">
        <div className="flex items-center gap-1.5 px-2 py-1 text-slate-800 shrink-0">
          <Compass className="animate-spin text-slate-500 duration-1000" size={15} style={{ animationDuration: '6s' }} />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700">Dynamic Map</span>
        </div>
        <div className="h-4 w-px bg-slate-200 shrink-0" />
        
        {/* Style Switches */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[180px] sm:max-w-none">
          {(['streets', 'light', 'dark', 'satellite'] as MapTheme[]).map((t) => (
            <button
              key={t}
              onClick={(e) => { e.stopPropagation(); setMapTheme(t); }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase transition-all duration-300 ${
                mapTheme === t 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-[#6e685f] hover:bg-slate-100'
              }`}
            >
              {getThemeIcon(t)}
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Floating Right Map Navigation Controls */}
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-1.5 rounded-2xl bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(139,124,103,0.14)] border border-[#e2ddd2]/80 backdrop-blur-md">
        <button 
          onClick={recenterAll}
          className="rounded-xl p-2 text-[#5c564e] transition-all duration-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
          title="Fit Plan Bounds"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* 3. Real Interactive WebGL Maplibre container */}
      <div className="h-full w-full">
        <Map
          ref={mapRef}
          initialViewState={initialViewState}
          mapStyle={THEME_STYLES[mapTheme]}
          mapLib={maplibregl}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Navigation controls embedded onto map */}
          <NavigationControl position="bottom-right" showCompass={true} />
          <FullscreenControl position="bottom-right" />

          {/* Connect points using vector line layer */}
          {sortedPinsForPath.length > 1 && (
            <Source id="route-path" type="geojson" data={routeGeoJSON}>
              <Layer
                id="route-path-layer"
                type="line"
                paint={{
                  'line-color': mapTheme === 'dark' ? '#ff4081' : mapTheme === 'satellite' ? '#ffd600' : '#4f46e5',
                  'line-width': 3,
                  'line-opacity': 0.8,
                  'line-dasharray': [1, 2]
                }}
                layout={{
                  'line-join': 'round',
                  'line-cap': 'round'
                }}
              />
            </Source>
          )}

          {/* Interactive Markers */}
          {pins.map((pin) => {
            const isSelected = selectedPin?.id === pin.id;
            const { icon, gradient, glow } = getPinStyle(pin.type);

            return (
              <Marker
                key={pin.id}
                latitude={pin.latitude}
                longitude={pin.longitude}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedPin(pin);
                  onPinClick?.(pin.item);
                  mapRef.current?.flyTo({
                    center: [pin.longitude, pin.latitude],
                    zoom: 15,
                    duration: 1000
                  });
                }}
              >
                <div className="relative cursor-pointer group">
                  {/* Dynamic Glowing Pulse Wave behind selected pins */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                      className={`absolute -left-2 -top-2 h-10 w-10 rounded-full bg-indigo-500/20 border border-indigo-500/30`}
                    />
                  )}

                  {/* Marker Pin bubble with gorgeous CSS gradient */}
                  <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-full border-1.5 border-white bg-gradient-to-tr shadow-md transition-all duration-300 transform ${gradient} ${glow} ${
                    isSelected ? 'scale-125 shadow-lg ring-3 ring-indigo-200/40 border-indigo-200' : 'hover:scale-110'
                  }`}>
                    {icon}
                  </div>
                  
                  {/* Tiny arrow pointing downwards */}
                  <div className={`mx-auto w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] border-t-white ${isSelected ? 'border-t-indigo-200' : ''}`} />
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>
    </div>
  );
}
