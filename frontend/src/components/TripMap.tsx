import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "../lib/utils";
import Fa from "./Fa";

interface MapTrackingProps {
  position: { lat: number; lng: number; speed: number; timestamp: number } | null;
  vehiclePlate?: string;
  sourceStation?: { name: string; location: string };
  destinationStation?: { name: string; location: string };
  connected: boolean;
  className?: string;
}

export default function TripMap({
  position,
  vehiclePlate,
  sourceStation,
  destinationStation,
  connected,
  className = "",
}: MapTrackingProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const vehicleMarker = useRef<maplibregl.Marker | null>(null);
  const sourceMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const routeLayerAdded = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Parse station locations
  const sourceCoords = useMemo(() => {
    if (!sourceStation?.location) return null;
    const [lat, lng] = sourceStation.location.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] as [number, number] : null;
  }, [sourceStation?.location]);

  const destCoords = useMemo(() => {
    if (!destinationStation?.location) return null;
    const [lat, lng] = destinationStation.location.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] as [number, number] : null;
  }, [destinationStation?.location]);

  const vehicleCoords = useMemo(() => {
    if (!position) return null;
    return [position.lng, position.lat] as [number, number];
  }, [position]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://demotiles.maplibre.org/style.json", // Free demo style
        center: vehicleCoords || sourceCoords || [30.06, -1.94], // Default to Kigali
        zoom: vehicleCoords ? 14 : 12,
        pitch: 45,
        bearing: 0,
        antialias: true,
        attributionControl: false,
      });

      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
      map.current.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "top-right"
      );

      // Add source/destination markers if available
      if (sourceCoords) {
        sourceMarker.current = new maplibregl.Marker({ color: "#10075C", scale: 1.2 })
          .setLngLat(sourceCoords)
          .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<strong>Source:</strong> ${sourceStation?.name}`))
          .addTo(map.current!);
      }

      if (destCoords) {
        destMarker.current = new maplibregl.Marker({ color: "#EA580C", scale: 1.2 })
          .setLngLat(destCoords)
          .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<strong>Destination:</strong> ${destinationStation?.name}`))
          .addTo(map.current!);
      }

      // Fit bounds to route if we have both stations
      if (sourceCoords && destCoords) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(sourceCoords);
        bounds.extend(destCoords);
        map.current!.fitBounds(bounds, { padding: 50, duration: 1000 });
      }

      routeLayerAdded.current = true;
    } catch (e) {
      setMapError(e instanceof Error ? e.message : "Failed to initialize map");
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      routeLayerAdded.current = false;
    };
  }, [sourceCoords, destCoords, sourceStation?.name, destinationStation?.name]);

  // Update vehicle position
  useEffect(() => {
    if (!map.current || !vehicleCoords) return;

    const [lng, lat] = vehicleCoords;

    if (!vehicleMarker.current) {
      const el = document.createElement("div");
      el.className = cn(
        "flex items-center justify-center gap-1 rounded-full bg-ink-900 px-2 py-1 text-xs font-semibold text-white shadow-glow",
        "transition-transform duration-300"
      );
      el.innerHTML = `
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        <span>${vehiclePlate || "Bus"}</span>
      `;
      vehicleMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map.current!);
    } else {
      vehicleMarker.current.setLngLat([lng, lat]);
    }

    // Update popup with speed
    if (vehicleMarker.current.getPopup()) {
      vehicleMarker.current.getPopup().setHTML(
        `<strong>${vehiclePlate || "Bus"}</strong><br>${position?.speed > 0 ? `${Math.round(position.speed * 3.6)} km/h` : "Stopped"}`
      );
    }

    // Animate camera to follow vehicle (optional - only if user hasn't interacted recently)
    // map.current?.easeTo({ center: [lng, lat] });
  }, [vehicleCoords, vehiclePlate, position?.speed]);

  // Add route line if both stations available
  useEffect(() => {
    if (!map.current || !sourceCoords || !destCoords || routeLayerAdded.current) return;

    const routeLine = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [sourceCoords, destCoords],
      },
    };

    try {
      map.current!.addSource("route", {
        type: "geojson",
        data: routeLine,
      });

      map.current!.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#10075C",
          "line-width": 4,
          "line-dasharray": [2, 8],
          "line-opacity": 0.8,
        },
      });
    } catch (e) {
      console.warn("Failed to add route line:", e);
    }
  }, [map.current, sourceCoords, destCoords]);

  if (mapError) {
    return (
      <div className={cn("relative h-56 bg-ink-50 flex items-center justify-center rounded-2xl", className)}>
        <div className="text-center text-ink-500">
          <Fa name="alert-circle" className="mx-auto h-8 w-8 text-flame-500" />
          <p className="mt-2 text-sm">Map unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-64 bg-mist rounded-2xl overflow-hidden", className)}>
      <div ref={mapContainer} className="absolute inset-0" />
      {!vehicleCoords && connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-mist/50 z-10">
          <div className="text-center text-ink-500 animate-pulse">
            <Fa name="satellite" className="mx-auto h-8 w-8 text-flame-500" />
            <p className="mt-2 text-sm">Waiting for GPS data…</p>
          </div>
        </div>
      )}
      {!connected && (
        <div className="absolute top-2 right-2 z-10">
          <span className="chip bg-amber-100 text-amber-700">Offline</span>
        </div>
      )}
    </div>
  );
}