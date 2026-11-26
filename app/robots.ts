import type { MetadataRoute } from "next";

const fallbackSiteUrl = "https://markdownvideo.avikmukherjee.com";
const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallbackSiteUrl,
).origin;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
