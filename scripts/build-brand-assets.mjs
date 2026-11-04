import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const site = new URL("../site/", import.meta.url);
for (const [source, output, width, height] of [
  ["og-image.svg", "og-image.png", 1200, 630],
  ["brand-icon.svg", "apple-touch-icon.png", 180, 180],
]) {
  const svg = await readFile(new URL(source, site));
  await sharp(svg).resize(width, height).png().toFile(fileURLToPath(new URL(output, site)));
  console.log(`Rendered ${output}: ${width} x ${height}`);
}
