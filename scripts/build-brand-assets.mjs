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
const christmas = await readFile(new URL("christmas.webp", originals));
for (const width of [800, 1400, 2000]) {
  await sharp(christmas).resize({ width }).webp({ quality: 82, effort: 6 })
    .toFile(fileURLToPath(new URL(`images/christmas-${width}.webp`, site)));
}
const socialPhoto = await sharp(christmas).resize(600, 630, { fit: "cover", position: "right" }).toBuffer();
await sharp(await readFile(new URL("og-image.svg", site)))
  .composite([{ input: socialPhoto, left: 600, top: 0 }])
  .png({ palette: true, colours: 128, effort: 10 })
  .toFile(fileURLToPath(new URL("og-image.png", site)));
await sharp(await readFile(new URL("brand-icon.svg", site)))
  .resize(180, 180).png().toFile(fileURLToPath(new URL("apple-touch-icon.png", site)));
console.log("Rendered Christmas banner variants, sharing image and home-screen icon");
