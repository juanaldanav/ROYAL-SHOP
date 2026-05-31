import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Royal Shop POS",
    short_name: "Royal POS",
    description: "Punto de venta Royal Shop",
    start_url: "/pos",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#18181b",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/logo-icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Nueva venta",
        url: "/pos",
        description: "Ir al punto de venta",
      },
      {
        name: "Dashboard",
        url: "/dashboard",
        description: "Ver reportes y métricas",
      },
    ],
  }
}
