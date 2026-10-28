// Generates the PWA icons in public/icons from one SVG. Run: node scripts/make-icons.mjs
import { createRequire } from "node:module";

// sharp ships with Next.js; resolve it through next so no extra dependency is needed.
const require = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = require("sharp");

const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <rect x="136" y="136" width="240" height="240" rx="56"/>
    <path d="M256 196v120M196 256h120"/>
  </g>`;

const svg = ({ rounded, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#5B3BE6"/>
  ${glyph(scale)}
</svg>`;

const out = [
  ["public/icons/icon-192.png", 192, { rounded: true, scale: 1 }],
  ["public/icons/icon-512.png", 512, { rounded: true, scale: 1 }],
  ["public/icons/icon-maskable-512.png", 512, { rounded: false, scale: 0.8 }],
  ["public/icons/apple-touch-icon.png", 180, { rounded: false, scale: 0.9 }],
];
for (const [file, size, opts] of out) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png().toFile(file);
  console.log(file);
}
