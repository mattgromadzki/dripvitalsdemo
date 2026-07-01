import type { MetadataRoute } from "next";

// Web App Manifest — makes the patient app installable as a standalone app.
// On the patient subdomain the sign-in is at /login and the app at "/", so
// start_url is /login and scope is "/". Installed from the patient host, the
// PWA stays within the patient experience.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DripVitals — Patient",
    short_name: "DripVitals",
    description: "Manage your GLP-1 treatment, log your progress, chat with your care team, and reorder — all from your phone.",
    start_url: "/login",
    scope: "/",
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
