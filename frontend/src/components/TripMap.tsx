import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "../lib/utils";
import Fa from "./Fa";
import { MAP_DEFAULT_CENTER, MAP_STYLE_URL } from "../lib/config";
import { parseStationLocationToLngLat } from "../lib/station-location";

interface MapTrackingProps {
  position: { lat: number; lng: number; speed: number; timestamp: number } | null;
  vehiclePlate?: string;
  sourceStation?: { name: string; location: string };
  destinationStation?: { name: string; location: string };
  connected: boolean;
  className?: string;
}

// Parse station location to [lng, lat] for MapLibre
function parseLocation(loc: string): [number, number] | null {
  return parseStationLocationToLngLat(loc);
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
  const [mapError, setMapError] = useState<string | null>(null);

  const sourceCoords = useMemo(() => parseLocation(sourceStation?.location || ""), [sourceStation?.location]);
  const destCoords = useMemo(() => parseLocation(destinationStation?.location || ""), [destinationStation?.location]);
  const vehicleCoords = useMemo(() => position ? [position.lng, position.lat] as [number, number] : null, [position]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE_URL,
        center: vehicleCoords || sourceCoords || MAP_DEFAULT_CENTER,
        zoom: vehicleCoords ? 14 : 8,
        attributionControl: false,
      });

      map.current.addControl(new maplibregl.NavigationControl(), "top-right");

      // Add source station marker with SVG path indicator
      if (sourceCoords) {
        const el = document.createElement("div");
        el.className = "flex flex-col items-center";
        el.innerHTML = `
          <div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-900 bg-white shadow-md">
            <span class="text-[10px] font-bold text-ink-900">S</span>
          </div>
          <span class="mt-1 whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[9px] text-white shadow">${sourceStation?.name?.split("(")[0].trim() || "Source"}</span>
        `;
        sourceMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat(sourceCoords)
          .addTo(map.current!);
      }

      // Add destination station marker with SVG path indicator
      if (destCoords) {
        const el = document.createElement("div");
        el.className = "flex flex-col items-center";
        el.innerHTML = `
          <div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-flame-500 bg-white shadow-md">
            <span class="text-[10px] font-bold text-flame-500">D</span>
          </div>
          <span class="mt-1 whitespace-nowrap rounded bg-flame-500 px-1.5 py-0.5 text-[9px] text-white shadow">${destinationStation?.name?.split("(")[0].trim() || "Dest"}</span>
        `;
        destMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat(destCoords)
          .addTo(map.current!);
      }

      // Draw SVG route path between stations
      if (sourceCoords && destCoords) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(sourceCoords);
        bounds.extend(destCoords);
        map.current!.fitBounds(bounds, { padding: 80, duration: 1000 });
      }
    } catch (e) {
      setMapError(e instanceof Error ? e.message : "Failed to initialize map");
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [sourceCoords, destCoords, sourceStation?.name, destinationStation?.name]);

  // Draw/update route line
  useEffect(() => {
    if (!map.current || !sourceCoords || !destCoords) return;
    if (map.current.getSource("route")) return;

    const routeGeoJSON = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [sourceCoords, destCoords],
      },
    };

    try {
      map.current.addSource("route", {
        type: "geojson",
        data: routeGeoJSON,
      });

      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#10075C",
          "line-width": 4,
          "line-dasharray": [2, 4],
          "line-opacity": 0.8,
        },
      });

      // Add vehicle position marker if available
      if (vehicleCoords && !vehicleMarker.current) {
        const el = document.createElement("div");
        el.className = "flex items-center gap-1 rounded-full bg-ink-900 px-2 py-1 text-xs font-semibold text-white shadow-lg";
        el.innerHTML = `<span>🚌</span><span>${vehiclePlate || "Bus"}</span>`;
        vehicleMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(vehicleCoords)
          .addTo(map.current!);
      }
    } catch (e) {
      console.warn("Failed to add route:", e);
    }
  }, [sourceCoords, destCoords, vehicleCoords, vehiclePlate]);

  // Update vehicle position
  useEffect(() => {
    if (!vehicleMarker.current || !vehicleCoords) return;
    vehicleMarker.current.setLngLat(vehicleCoords);
  }, [vehicleCoords]);

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
      {!connected && (
        <div className="absolute top-2 right-2 z-10">
          <span className="chip bg-amber-100 text-amber-700">Offline</span>
        </div>
      )}
      {connected && !vehicleCoords && (
        <div className="absolute inset-0 flex items-center justify-center bg-mist/50 z-10">
          <div className="text-center text-ink-500 animate-pulse">
            <Fa name="navigation" className="mx-auto h-8 w-8 text-flame-500" />
            <p className="mt-2 text-sm">Waiting for GPS data…</p>
          </div>
        </div>
      )}
    </div>
  );
}