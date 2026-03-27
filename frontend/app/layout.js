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
        <link rel="icon" href="/bemaco-ico.png" />
        <link rel="shortcut icon" href="/bemaco-ico.png" />
        <link rel="apple-touch-icon" href="/bemaco-ico.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
