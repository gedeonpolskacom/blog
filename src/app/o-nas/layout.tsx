import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "O nas",
  description:
    "Poznaj Gedeon - producenta i dystrybutora rozwiazan dla rynku foto oraz autora bloga branzowego.",
  alternates: {
    canonical: `${SITE_URL}/o-nas`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/o-nas`,
    title: "O nas | Gedeon",
    description:
      "Poznaj Gedeon - producenta i dystrybutora rozwiazan dla rynku foto oraz autora bloga branzowego.",
    images: [
      {
        url: `${SITE_URL}/android-chrome-512x512.png`,
        width: 512,
        height: 512,
        alt: "O nas - Gedeon",
      },
    ],
  },
};

export default function AboutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

