"use client";

import { useEffect, useRef, useState } from "react";
import type { Worker } from "@/types";
import Link from "next/link";
import { MapPin, X, BadgeCheck } from "lucide-react";

// Leaflet is loaded client-side only
let L: typeof import("leaflet") | null = null;

interface Props {
  workers: Worker[];
}

interface PopupWorker {
  worker: Worker;
  x: number;
  y: number;
}

export default function WorkerMap({ workers }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [popup, setPopup] = useState<PopupWorker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (mapInstanceRef.current) return; // already initialised

    // Dynamically import leaflet + markercluster
    Promise.all([
      import("leaflet"),
      import("leaflet.markercluster"),
    ]).then(([leaflet]) => {
      L = leaflet.default;

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (L as any).markerClusterGroup({ chunkedLoading: true });

      const workersWithCoords = workers.filter(
        (w) => w.latitude != null && w.longitude != null
      ) as (Worker & { latitude: number; longitude: number })[];

      workersWithCoords.forEach((worker) => {
        const marker = L!.marker([worker.latitude, worker.longitude]);
        marker.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          const point = map.latLngToContainerPoint(e.latlng);
          setPopup({ worker, x: point.x, y: point.y });
        });
        cluster.addLayer(marker);
      });

      map.addLayer(cluster);
      map.on("click", () => setPopup(null));
      map.on("zoom", () => setPopup(null));

      mapInstanceRef.current = map;
      setReady(true);
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when workers change
  useEffect(() => {
    if (!ready || !mapInstanceRef.current || !L) return;
    // markers are set on initial load; for live updates a full re-init would be needed
  }, [workers, ready]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border shadow-sm">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
      />

      <div ref={mapRef} className="w-full h-full" />

      {/* Custom popup */}
      {popup && (
        <div
          className="absolute z-[1000] w-56 rounded-xl border bg-white shadow-lg p-3 animate-fade-in"
          style={{ left: popup.x + 12, top: popup.y - 80 }}
        >
          <button
            onClick={() => setPopup(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            {popup.worker.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={popup.worker.avatar}
                alt={popup.worker.name}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-blue-100"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                {popup.worker.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-sm font-semibold text-gray-800 truncate">
                {popup.worker.name}
                {popup.worker.isVerified && (
                  <BadgeCheck size={13} className="text-blue-500 shrink-0" />
                )}
              </div>
              <span className="text-xs text-blue-600">{popup.worker.category.name}</span>
            </div>
          </div>
          {popup.worker.location && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
              <MapPin size={11} />
              {popup.worker.location}
            </div>
          )}
          <Link
            href={`/workers/${popup.worker.id}`}
            className="block w-full rounded-md bg-blue-600 py-1.5 text-center text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            View Profile
          </Link>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
