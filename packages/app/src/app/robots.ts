import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://bluecollar.app";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard/", "/auth/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
