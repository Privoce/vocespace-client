import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import ClientProviders from "./client-providers";

import { publicPlatformConfiguration } from '@/lib/server-config';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: "Voce Space | Self-hosted conference app",
    template: "%s",
  },
  description:
    "Voce space is WebRTC project that gives you everything needed to build scalable and real-time audio and/or video experiences in your applications.",
  icons: {
    icon: {
      rel: "icon",
      url: "/favicon.ico",
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#101828',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtime = JSON.stringify(publicPlatformConfiguration()).replace(/</g, '\\u003c');
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: `window.__VOCESPACE_PLATFORM__=${runtime};` }} />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
