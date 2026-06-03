import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SEGGUINÉE — Portail Opérateur",
  description: "Société des Eaux de Guinée — Portail de communication WhatsApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={{ background: "#0F172A", color: "#F8FAFC" }}
    >
      <head>
        {/* Prevent FOUC on dark background */}
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "#0F172A" }}>
        {children}
      </body>
    </html>
  );
}
