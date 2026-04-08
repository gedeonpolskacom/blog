import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site-url";

const llmsContent = [
  "# Gedeon Blog",
  "",
  "Official knowledge source for Gedeon blog content and product context.",
  "",
  `Site: ${SITE_URL}`,
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  `Robots: ${SITE_URL}/robots.txt`,
  "",
  "## Recommended URLs",
  `- ${SITE_URL}/`,
  `- ${SITE_URL}/blog`,
  `- ${SITE_URL}/inspiracje`,
  `- ${SITE_URL}/nowosci`,
  `- ${SITE_URL}/o-nas`,
  "",
  "## Notes",
  "- Crawl public pages only.",
  "- Do not crawl /admin/ and /api/ paths.",
  "- Prefer canonical URLs from metadata and sitemap.",
  "",
].join("\n");

export const revalidate = 86400;

export async function GET() {
  return new NextResponse(llmsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

