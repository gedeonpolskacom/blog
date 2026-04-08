import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Galeria inspiracji foto",
  description:
    "Galeria inspiracji produktowych Gedeon: albumy, ramki, media i realizacje dla branzy foto.",
  alternates: {
    canonical: `${SITE_URL}/inspiracje`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/inspiracje`,
    title: "Galeria inspiracji foto | Gedeon",
    description:
      "Galeria inspiracji produktowych Gedeon: albumy, ramki, media i realizacje dla branzy foto.",
    images: [
      {
        url: `${SITE_URL}/android-chrome-512x512.png`,
        width: 512,
        height: 512,
        alt: "Gedeon Inspiracje",
      },
    ],
  },
};

export default function InspirationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

