import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Blog foto B2B",
  description:
    "Artykuly, poradniki i trendy dla studiow fotograficznych, sklepow foto i minilabow.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blog`,
    title: "Blog foto B2B | Gedeon",
    description:
      "Artykuly, poradniki i trendy dla studiow fotograficznych, sklepow foto i minilabow.",
    images: [
      {
        url: `${SITE_URL}/android-chrome-512x512.png`,
        width: 512,
        height: 512,
        alt: "Gedeon Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog foto B2B | Gedeon",
    description:
      "Artykuly, poradniki i trendy dla studiow fotograficznych, sklepow foto i minilabow.",
    images: [`${SITE_URL}/android-chrome-512x512.png`],
  },
};

export default function BlogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

