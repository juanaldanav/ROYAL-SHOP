import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Royale Shop POS",
    short_name: "Royale POS",
    description: "Punto de venta Royale Shop",
    start_url: "/pos",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#18181b",
    categories: ["business", "productivity"],
    icons: [
      {
        // SVG: funciona en Chrome/Edge/Firefox modernos
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        // PNG: iOS Safari + Android fallback — drop icon-192.png en /public/icons/
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
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
