import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { PwaInstallHint } from "@/components/portal/PwaInstallHint";

// Scoped PWA chrome for the patient app. Exporting metadata/viewport here keeps
// the standalone/home-screen behavior on the patient portal only — the provider
// EMR under (modules) is unaffected.
export const metadata: Metadata = {
  title: "DripVitals",
  applicationName: "DripVitals",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DripVitals",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function PatientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Satoshi (patient portal + login only). Loaded at runtime like the site's
          other fonts so a font-CDN hiccup can never fail the build. The provider
          EMR is unaffected — it keeps Inter. */}
      <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap"
      />
      {children}
      <PwaInstallHint />
    </>
  );
}
