import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const site = new URL("../site/", import.meta.url);
const originals = new URL("../assets/editorial/", import.meta.url);
await mkdir(new URL("images/", site), { recursive: true });
for (const name of ["garden", "books", "space", "play", "baby", "history", "coffee", "mum", "dad", "gesture"]) {
  for (const width of [400, 800, 1200]) {
    await sharp(fileURLToPath(new URL(`${name}.webp`, originals)))
      .resize(width, width * 0.7, { fit: "cover" })
      .webp({ quality: 82, effort: 6 })
      .toFile(fileURLToPath(new URL(`images/${name}-${width}.webp`, site)));
  }
  console.log(`Rendered ${name}: 400, 800 and 1200 pixel WebP`);
}
for (const [source, output, width, height] of [
  ["og-image.svg", "og-image.png", 1200, 630],
  ["brand-icon.svg", "apple-touch-icon.png", 180, 180],
]) {
  const svg = await readFile(new URL(source, site));
  await sharp(svg).resize(width, height).png().toFile(fileURLToPath(new URL(output, site)));
  console.log(`Rendered ${output}: ${width} x ${height}`);
}
