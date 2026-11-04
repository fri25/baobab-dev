import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permet un build de vérification sans toucher au dossier du serveur de dev
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
