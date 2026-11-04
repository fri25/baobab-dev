import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baobab Dev",
    short_name: "Baobab",
    description: "La plateforme d'échange africaine, pour les devs, par les devs.",
    start_url: "/fil",
    display: "standalone",
    background_color: "#fbf7f0",
    theme_color: "#b9561a",
    lang: "fr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
