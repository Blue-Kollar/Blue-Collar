import type { MetadataRoute } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://bluecollar.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/workers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const res = await fetch(`${API}/workers?limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticRoutes;
    const json = await res.json();
    const workerRoutes: MetadataRoute.Sitemap = (json.data ?? []).map(
      (w: { id: string; updatedAt?: string }) => ({
        url: `${BASE}/workers/${w.id}`,
        lastModified: w.updatedAt ? new Date(w.updatedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })
    );
    return [...staticRoutes, ...workerRoutes];
  } catch {
    return staticRoutes;
  }
}
