import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import OpsNav from "./OpsNav";

// Gauge system type: Archivo (clean grotesk) for UI text, IBM Plex Mono for
// data/measurement labels — loaded via next/font/google, self-hosted at build.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Partli — Ops",
  description: "Partli operations console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-partli-bg">
        <OpsNav />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
