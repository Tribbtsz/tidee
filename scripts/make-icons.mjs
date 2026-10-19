import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="72" y1="40" x2="448" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="0.52" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#2dd4bf"/>
    </linearGradient>
    <linearGradient id="shine" x1="120" y1="80" x2="380" y2="220" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <rect width="512" height="512" rx="116" fill="url(#shine)"/>
  <path d="M76 198c52-64 96-64 148 0s96 64 148 0 54-48 92-2" fill="none"
        stroke="#ffffff" stroke-width="36" stroke-linecap="round" opacity="0.96"/>
  <path d="M76 318c52-64 96-64 148 0s96 64 148 0 54-48 92-2" fill="none"
        stroke="#ffffff" stroke-width="36" stroke-linecap="round" opacity="0.42"/>
</svg>
`);

await mkdir('public/icon', { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icon/${size}.png`);
  console.log(`icon ${size}x${size}`);
}
