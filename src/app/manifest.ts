import type { MetadataRoute } from "next";

/**
 * Manifeste PWA. Il ne sert qu'à une chose : que le pass s'ouvre en plein
 * écran depuis l'écran d'accueil, sans barre d'adresse ni chrome de
 * navigateur. Ce n'est pas un vrai pass Apple/Google Wallet — c'est
 * délibéré, on teste le concept avant d'investir dans les certificats.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Regard+",
    short_name: "Regard+",
    description: "Votre pass de collecte",
    // Pas de start_url : le manifeste retombe alors sur l'URL depuis
    // laquelle l'utilisateur a ajouté la page, donc sur SON pass, jeton
    // compris. Une valeur fixe comme « /pass » rouvrirait une page sans
    // jeton — Android l'utilise vraiment au lancement, contrairement à
    // iOS qui repart de l'URL courante.
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
