import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";
import "react-photo-album/masonry.css";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display-next",
});

const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body-next",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gedeon Blog - inspiracje dla profesjonalistow foto",
    template: "%s | Gedeon Blog",
  },
  description:
    "Blog i galeria inspiracji dla studiow fotograficznych, sklepow foto i minilabow. Nowosci produktowe, trendy i poradniki od Gedeon.",
  keywords: [
    "albumy fotograficzne",
    "ramki do zdjec",
    "papier fotograficzny",
    "drylab media",
    "studio fotograficzne",
    "Gedeon",
    "B2B foto",
    "hurtownia foto",
  ],
  authors: [{ name: "Gedeon" }],
  creator: "Gedeon",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    locale: "pl_PL",
    alternateLocale: ["en_US"],
    siteName: "Gedeon Blog",
    title: "Gedeon Blog - inspiracje dla profesjonalistow foto",
    description:
      "Blog i galeria inspiracji dla branzy fotograficznej. Nowosci, trendy i poradniki.",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "Gedeon Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gedeon Blog",
    description: "Inspiracje dla profesjonalistow foto",
    images: ["/android-chrome-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

const globalStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "Gedeon",
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      sameAs: [
        "https://b2b.gedeonpolska.com",
        "https://gedeonpolska.myshopify.com",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: "Gedeon Blog",
      inLanguage: "pl-PL",
      publisher: {
        "@id": `${SITE_URL}#organization`,
      },
    },
  ],
};

const globalStructuredDataJson = JSON.stringify(globalStructuredData).replace(
  /</g,
  "\\u003c",
);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("gedeon-theme")?.value;
  const initialTheme = cookieTheme === "light" ? "light" : "dark";

  return (
    <html lang="pl" data-theme={initialTheme} suppressHydrationWarning>
      <body
        data-theme={initialTheme}
        className={`${displayFont.variable} ${bodyFont.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: globalStructuredDataJson }}
        />
        {children}
      </body>
    </html>
  );
}
