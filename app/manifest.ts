import type { MetadataRoute } from "next";

// Web App Manifest — makes the patient portal installable as a standalone app.
// Scoped to /patient-portal so installing it launches straight into the patient
// experience (the provider EMR keeps its own normal browser behavior).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DripVitals — Patient",
    short_name: "DripVitals",
    description: "Manage your GLP-1 treatment, log your progress, chat with your care team, and reorder — all from your phone.",
    start_url: "/patient-portal",
    scope: "/patient-portal",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
