import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const tacoBellBold = localFont({
  src: "./fonts/taco-bell-bold.ttf",
  variable: "--font-taco-bell-bold",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ultra Marathon Route Planner",
  description: "Plan your meme ultra marathon routes with waypoints and distance tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <html lang="en">
      <head>
        {apiKey && (
          <>
            <Script
              src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
              strategy="beforeInteractive"
            />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${tacoBellBold.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
