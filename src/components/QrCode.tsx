import QRCode from "qrcode";

/**
 * QR rendu en SVG côté serveur : net à toutes les tailles, aucun JavaScript
 * envoyé au navigateur, et il s'affiche instantanément à l'ouverture du pass.
 */
export async function QrCode({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0f1729ff", light: "#00000000" },
  });

  return (
    <div
      className={`[&>svg]:h-full [&>svg]:w-full ${className}`}
      // Le SVG vient de la librairie qrcode à partir d'une valeur que nous
      // fabriquons : aucune entrée utilisateur ne transite ici.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
