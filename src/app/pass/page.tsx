import { PassRecovery } from "./PassRecovery";

export const metadata = { title: "Phateam — retrouver mon pass" };

/**
 * Filet de sécurité pour `/pass` sans jeton.
 *
 * On y arrive par un raccourci d'écran d'accueil créé avant que le
 * manifeste ne soit corrigé, ou par une URL tapée à la main. Plutôt qu'une
 * page introuvable, on rouvre le dernier pass connu de cet appareil — et
 * à défaut on demande le code à 6 chiffres, que le porteur a sous les yeux
 * s'il a son pass, et que l'opticien peut retrouver autrement.
 */
export default function PassEntryPage() {
  return <PassRecovery />;
}
