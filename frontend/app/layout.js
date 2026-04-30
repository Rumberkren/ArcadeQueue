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

export const metadata = {
  title: "ChuMaiQueue",
  description: "Chunithm and Maimai Queue Management System for Arcades",
  icons: {
    icon: '/bemaco-ico.png',
    shortcut: '/bemaco-ico.png',
    apple: '/bemaco-ico.png'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/bemaco-ico.png" sizes="any" />
        <link rel="icon" href="/bemaco-ico.png" sizes="192x192" />
        <link rel="icon" href="/bemaco-ico.png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/bemaco-ico.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#f43f5e" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
