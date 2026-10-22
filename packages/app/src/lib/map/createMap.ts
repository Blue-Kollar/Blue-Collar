import type * as Leaflet from "leaflet";

let defaultIconConfigured = false;

export interface MapMarker {
  latitude: number;
  longitude: number;
  onClick?: (event: Leaflet.LeafletMouseEvent, map: Leaflet.Map) => void;
}

type LeafletWithMarkerCluster = typeof import("leaflet") & {
  markerClusterGroup(options: { chunkedLoading: boolean }): Leaflet.LayerGroup;
};

export async function createMap(
  container: HTMLElement,
  markers: MapMarker[] = []
): Promise<Leaflet.Map> {
  const [leafletModule] = await Promise.all([
    import("leaflet"),
    import("leaflet.markercluster"),
  ]);
  const leaflet = leafletModule.default;

  if (!defaultIconConfigured) {
    // Leaflet's default asset paths are not resolved correctly by webpack.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
    leaflet.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    defaultIconConfigured = true;
  }

  const map = leaflet.map(container, {
    center: [20, 0],
    zoom: 2,
    zoomControl: true,
  });

  try {
    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
      .addTo(map);

    const cluster = (leaflet as LeafletWithMarkerCluster).markerClusterGroup({
      chunkedLoading: true,
    });

    markers.forEach(({ latitude, longitude, onClick }) => {
      const marker = leaflet.marker([latitude, longitude]);
      if (onClick) {
        marker.on("click", (event) => onClick(event, map));
      }
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return map;
  } catch (error) {
    map.remove();
    throw error;
  }
}
