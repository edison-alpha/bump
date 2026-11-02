// Generates PWA icons from public/brand/icon.png. Run: pnpm icons
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/brand/icon.png";
const OUT = "public/icons";
const SKY = { r: 61, g: 187, b: 255, alpha: 1 };

await mkdir(OUT, { recursive: true });

const square = (size) => sharp(SOURCE).resize(size, size, { fit: "cover" });

await square(192).png().toFile(`${OUT}/icon-192.png`);
await square(512).png().toFile(`${OUT}/icon-512.png`);
await square(180).png().toFile(`${OUT}/apple-touch-icon.png`);

// Maskable: keep the artwork inside the central 80% safe zone on a solid brand background.
const inner = await square(Math.round(512 * 0.72)).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: SKY } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(`${OUT}/maskable-512.png`);

console.log("Icons written to", OUT);
