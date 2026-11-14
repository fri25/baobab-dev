import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permet un build de vérification sans toucher au dossier du serveur de dev
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Les photos de profil sont limitées à 3 Mo dans l'application. La marge
  // couvre l'encodage multipart envoyé à l'action serveur.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
