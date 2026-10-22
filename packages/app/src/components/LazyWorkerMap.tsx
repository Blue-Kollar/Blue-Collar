"use client";

import dynamic from "next/dynamic";
import LoadingState from "@/components/LoadingState";

/**
 * Worker map backed by leaflet + leaflet.markercluster. Loaded on demand so
 * the Leaflet bundle stays out of the initial page JS.
 */
const LazyWorkerMap = dynamic(() => import("@/components/WorkerMap"), {
  ssr: false,
  loading: () => <LoadingState className="py-20" message="Loading map…" />,
});

export default LazyWorkerMap;
