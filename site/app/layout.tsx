import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { DM_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stacklense.com"),
  title: "StackLense — Your codebase has a memory now",
  description:
    "StackLense watches every deploy and builds a living blueprint of your architecture. Decisions, services, security choices — all captured automatically.",
  openGraph: {
    title: "StackLense — Your codebase has a memory now",
    description:
      "Connect your repo or AWS account. Every deploy auto-updates your architecture blueprint. Works with Codex, Claude, Cursor, or any AI agent.",
    images: ["/og.png"],
    url: "https://stacklense.com",
    siteName: "StackLense",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${dmMono.variable} ${instrumentSerif.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
