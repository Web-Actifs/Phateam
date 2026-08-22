import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Serif éditoriale réservée aux grands chiffres et aux titres : c'est elle
// qui écarte le prototype du template SaaS générique.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Regard+",
  description:
    "Rapportez vos emballages de lentilles chez votre opticien, gagnez des points.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Regard+",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b3a6b",
  width: "device-width",
  initialScale: 1,
  // Le pass doit donner l'impression d'une application, pas d'une page web.
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink-deep">
        {children}
      </body>
    </html>
  );
}
