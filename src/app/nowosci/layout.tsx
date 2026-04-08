import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Nowości produktowe",
  description:
    "Aktualne nowości produktowe Gedeon: albumy, ramki i media fotograficzne dla B2B.",
  alternates: {
    canonical: `${SITE_URL}/nowosci`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/nowosci`,
    title: "Nowości produktowe | Gedeon",
    description:
      "Aktualne nowości produktowe Gedeon: albumy, ramki i media fotograficzne dla B2B.",
    images: [
      {
        url: `${SITE_URL}/android-chrome-512x512.png`,
        width: 512,
        height: 512,
        alt: "Gedeon nowości",
      },
    ],
  },
};

export default function NewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
