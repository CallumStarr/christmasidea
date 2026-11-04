import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const site = new URL("../site/", import.meta.url);
const originals = new URL("../assets/editorial/", import.meta.url);
await mkdir(new URL("images/", site), { recursive: true });
for (const name of ["garden", "books", "space", "play", "baby", "history", "coffee", "mum", "dad", "gesture"]) {
  for (const width of [400, 800, 1200]) {
    await sharp(fileURLToPath(new URL(`${name}-cutout.webp`, originals)))
      .resize(width, width * 0.7, { fit: "contain", background: "#00000000" })
      .webp({ quality: 80, alphaQuality: 80, effort: 6 })
      .toFile(fileURLToPath(new URL(`images/${name}-${width}.webp`, site)));
  }
  console.log(`Rendered ${name}: 400, 800 and 1200 pixel WebP`);
}
const christmas = await readFile(new URL("christmas.webp", originals));
for (const name of ["finder-canvas", "guides-canvas"]) {
  const source = await readFile(new URL(`${name}.webp`, originals));
  const metadata = await sharp(source).metadata();
  const extensionWidth = 512;
  const width = metadata.width + extensionWidth;
  const photoHeight = metadata.height;
  const height = width * 1.5;
  const extension = await sharp(source).extract({ left: 0, top: 0, width: extensionWidth, height: photoHeight })
    .flop().toBuffer();
  const scene = await sharp(source).extract({ left: 0, top: 0, width: metadata.width, height: photoHeight }).toBuffer();
  const photograph = await sharp({ create: { width, height: photoHeight, channels: 3, background: "#f0e8dd" } })
    .composite([{ input: extension, left: 0, top: 0 }, { input: scene, left: extensionWidth, top: 0 }])
    .png().toBuffer();
  const stripHeight = 96;
  const tailHeight = stripHeight * 2;
  const stripHalf = await sharp(source).extract({ left: 256, top: metadata.height - stripHeight, width: 1024, height: stripHeight }).toBuffer();
  const nativeStrip = await sharp({ create: { width, height: stripHeight, channels: 3, background: "#f0e8dd" } })
    .composite([{ input: stripHalf, top: 0, left: 0 }, { input: await sharp(stripHalf).flop().toBuffer(), top: 0, left: 1024 }])
    .removeAlpha().png().toBuffer();
  const linenStats = await sharp(nativeStrip).stats();
  const strip = await sharp(nativeStrip)
    .linear([0.35, 0.35, 0.35], linenStats.channels.map(({ mean }) => mean * 0.65)).toBuffer();
  const tail = await sharp({ create: { width, height: tailHeight, channels: 3, background: "#f0e8dd" } })
    .composite([{ input: strip, top: 0, left: 0 }, { input: await sharp(strip).flip().toBuffer(), top: stripHeight, left: 0 }])
    .png().toBuffer();
  const canvas = Buffer.alloc(width * height * 3);
  const tailPixels = await sharp(tail).removeAlpha().raw().toBuffer();
  for (let y = 0; y < height; y++) {
    tailPixels.copy(canvas, y * width * 3, (y % tailHeight) * width * 3, (y % tailHeight + 1) * width * 3);
  }
  const photoPixels = await sharp(photograph).removeAlpha().raw().toBuffer();
  photoPixels.copy(canvas);
  // Blend only the empty lower linen, never the objects in the scene.
  for (let y = photoHeight - 96; y < photoHeight; y++) {
    const weight = (y - photoHeight + 96) / 95;
    for (let x = 0; x < width * 3; x++) {
      const index = y * width * 3 + x;
      canvas[index] = Math.round(canvas[index] * (1 - weight) + tailPixels[(y % tailHeight) * width * 3 + x] * weight);
    }
  }
  for (const outputWidth of [1000, width]) {
    await sharp(canvas, { raw: { width, height, channels: 3 } }).resize({ width: outputWidth, withoutEnlargement: true })
      .webp({ quality: outputWidth === 1000 ? 85 : 88, effort: 6 }).toFile(fileURLToPath(new URL(`images/${name}-${outputWidth}.webp`, site)));
  }
  await sharp(tail).webp({ quality: 88, effort: 6 })
    .toFile(fileURLToPath(new URL(`images/${name}-linen.webp`, site)));
}
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
console.log("Rendered integrated finder/guide canvases, linen continuations, sharing image and home-screen icon");
