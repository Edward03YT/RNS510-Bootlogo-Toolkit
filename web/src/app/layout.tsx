import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VW RNS 510 Bootlogo Studio • Custom Splash ISO Generator",
  description:
    "Professional web studio for creating custom boot splash logos and bootable update ISO images for Volkswagen RNS 510, Škoda Columbus, and SEAT Media System with real-time RGB555 simulation and anti-artifact filtering.",
  keywords: [
    "RNS 510",
    "bootlogo",
    "VW",
    "Volkswagen",
    "Skoda Columbus",
    "SEAT Media",
    "LOGO.FLI",
    "ISO",
    "RGB555",
    "SWL update",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
