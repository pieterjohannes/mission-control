import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionWrapper } from "@/components/SessionWrapper";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Mission Control — Kai",
  description: "Kai's local workspace dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mission Control",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "mobile-web-app-capable": "yes",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0a0e1a" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Prevent flash: apply stored theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mc-theme')||'dark';document.documentElement.className=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex">
        <ThemeProvider>
          <SessionWrapper>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </SessionWrapper>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  );
}
