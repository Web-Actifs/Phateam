import sharp from 'sharp';
import fs from 'fs';

// Marque : un anneau (la lentille) traversé d'un arc ouvert (le geste du
// retour). Pas de feuille, pas de planète.
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1b3a6b"/>
  <circle cx="256" cy="256" r="132" fill="none" stroke="#ffffff" stroke-width="34"/>
  <path d="M256 92 A164 164 0 0 1 402 182" fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" opacity="0.55"/>
  <circle cx="256" cy="256" r="46" fill="#ffffff"/>
</svg>`;

fs.mkdirSync('public', { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log(`public/icon-${size}.png`);
}
await sharp(Buffer.from(svg(180))).resize(180, 180).png().toFile('public/apple-icon.png');
fs.writeFileSync('public/icon.svg', svg(512));
console.log('public/apple-icon.png, public/icon.svg');
