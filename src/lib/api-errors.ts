import { NextResponse } from "next/server";

/**
 * Les fonctions Postgres lèvent des erreurs métier par leur nom
 * (INSUFFICIENT_BALANCE, INVALID_PIN…). On les traduit ici en réponses
 * HTTP et en phrases lisibles par un opticien derrière son comptoir —
 * un message technique devant un client tue l'adoption.
 */
const BUSINESS: Record<string, { status: number; message: string }> = {
  ACCOUNT_NOT_FOUND: {
    status: 404,
    message: "Client non reconnu. Vérifiez le code à 6 chiffres du pass.",
  },
  PARTNER_NOT_FOUND: {
    status: 400,
    message: "Boutique inconnue. Reconnectez-vous à la console.",
  },
  REWARD_NOT_FOUND: {
    status: 400,
    message: "Cette récompense n'est plus disponible.",
  },
  INVALID_WEIGHT: {
    status: 400,
    message: "Le poids doit être compris entre 1 g et 10 kg.",
  },
  INVALID_PIN: {
    status: 403,
    message: "Code à 4 chiffres incorrect. Demandez-le au client sur son pass.",
  },
  INSUFFICIENT_BALANCE: {
    status: 409,
    message: "Solde insuffisant pour cette récompense.",
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: 400,
    message: "Requête invalide (clé d'idempotence manquante).",
  },
};

export function businessError(raw: string) {
  const code = Object.keys(BUSINESS).find((k) => raw.includes(k));
  if (!code) return null;
  const { status, message } = BUSINESS[code];
  return NextResponse.json({ error: code, message }, { status });
}

export function unexpected(raw: string) {
  return NextResponse.json(
    { error: "UNEXPECTED", message: "Une erreur est survenue. Réessayez.", detail: raw },
    { status: 500 },
  );
}
