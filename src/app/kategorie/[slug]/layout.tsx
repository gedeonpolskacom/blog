import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

const CATEGORY_META: Record<string, { pl: string; en: string; description: string }> = {
  albumy: {
    pl: "Albumy",
    en: "Albums",
    description: "Artykuly o albumach fotograficznych, kolekcjach i sprzedazy.",
  },
  ramki: {
    pl: "Ramki",
    en: "Frames",
    description: "Artykuly o ramkach, ekspozycji i trendach dekoracyjnych.",
  },
  media: {
    pl: "Media",
    en: "Media",
    description: "Artykuly o mediach DryLab i materialach dla branzy foto.",
  },
  trendy: {
    pl: "Trendy",
    en: "Trends",
    description: "Trendy rynkowe i inspiracje dla studiow fotograficznych i sklepow foto.",
  },
  poradniki: {
    pl: "Poradniki",
    en: "Guides",
    description: "Praktyczne poradniki dla biznesu foto i sprzedazy B2B.",
  },
  kodak: {
    pl: "KODAK",
    en: "KODAK",
    description: "Nowosci i porady produktowe zwiazane z marka KODAK.",
  },
};

type LayoutProps = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];

  if (!meta) {
    return {
      title: "Kategoria",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `Kategoria: ${meta.pl}`,
    description: meta.description,
    alternates: {
      canonical: `${SITE_URL}/kategorie/${slug}`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/kategorie/${slug}`,
      title: `Kategoria: ${meta.pl} | Gedeon`,
      description: meta.description,
      images: [
        {
          url: `${SITE_URL}/android-chrome-512x512.png`,
          width: 512,
          height: 512,
          alt: `${meta.en} - Gedeon`,
        },
      ],
    },
  };
}

export default function CategoryLayout({ children }: LayoutProps) {
  return children;
}

