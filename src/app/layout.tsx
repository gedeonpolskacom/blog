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
    default: "Gedeon Polska Blog — Inspiracje dla Profesjonalistów Foto",
    template: "%s | Gedeon Polska Blog",
  },
  description:
    "Blog i galeria inspiracji dla studiów fotograficznych, sklepów foto i minilabów. Nowości produktowe, trendy, poradniki od Gedeon Polska — producenta albumów, ramek i mediów foto.",
  keywords: [
    "albumy fotograficzne",
    "ramki do zdjęć",
    "papier fotograficzny",
    "drylab media",
    "studio fotograficzne",
    "Gedeon Polska",
    "B2B foto",
    "hurtownia foto",
  ],
  authors: [{ name: "Gedeon Polska" }],
  creator: "Gedeon Polska",
  openGraph: {
    type: "website",
    locale: "pl_PL",
    alternateLocale: ["en_US"],
    siteName: "Gedeon Polska Blog",
    title: "Gedeon Polska Blog — Inspiracje dla Profesjonalistów Foto",
    description:
      "Blog i galeria inspiracji dla branży fotograficznej. Nowości, trendy, poradniki.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gedeon Polska Blog",
    description: "Inspiracje dla profesjonalistów foto",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/site.webmanifest",
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
