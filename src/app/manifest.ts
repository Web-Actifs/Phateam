import type { MetadataRoute } from "next";

/**
 * Manifeste PWA. Il ne sert qu'à une chose : que le pass s'ouvre en plein
 * écran depuis l'écran d'accueil, sans barre d'adresse ni chrome de
 * navigateur. Ce n'est pas un vrai pass Apple/Google Wallet — c'est
 * délibéré, on teste le concept avant d'investir dans les certificats.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Phateam",
    short_name: "Phateam",
    description: "Votre pass de collecte",
    start_url: "/pass",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b3a6b",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
