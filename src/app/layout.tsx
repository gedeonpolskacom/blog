import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { cookies } from "next/headers";
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
  title: {
    default: "Gedeon Blog â€” Inspiracje dla ProfesjonalistĂłw Foto",
    template: "%s | Gedeon Blog",
  },
  description:
    "Blog i galeria inspiracji dla studiĂłw fotograficznych, sklepĂłw foto i minilabĂłw. NowoĹ›ci produktowe, trendy, poradniki od Gedeon â€” producenta albumĂłw, ramek i mediĂłw foto.",
  keywords: [
    "albumy fotograficzne",
    "ramki do zdjÄ™Ä‡",
    "papier fotograficzny",
    "drylab media",
    "studio fotograficzne",
    "Gedeon",
    "B2B foto",
    "hurtownia foto",
  ],
  authors: [{ name: "Gedeon" }],
  creator: "Gedeon",
  openGraph: {
    type: "website",
    locale: "pl_PL",
    alternateLocale: ["en_US"],
    siteName: "Gedeon Blog",
    title: "Gedeon Blog â€” Inspiracje dla ProfesjonalistĂłw Foto",
    description:
      "Blog i galeria inspiracji dla branĹĽy fotograficznej. NowoĹ›ci, trendy, poradniki.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gedeon Blog",
    description: "Inspiracje dla profesjonalistĂłw foto",
  },
  robots: {
    index: true,
    follow: true,
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
        {children}
      </body>
    </html>
  );
}

