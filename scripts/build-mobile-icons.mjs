import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const icon = await readFile(path.join(root, "site", "brand-icon.svg"));
const res = path.join(root, "android", "app", "src", "main", "res");
const scales = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(scales)) {
  for (const filename of ["ic_launcher.png", "ic_launcher_round.png"]) {
    await sharp(icon).resize(48 * scale).flatten({ background: "#fbf7f0" })
      .toFile(path.join(res, `mipmap-${density}`, filename));
  }
  const mark = await sharp(icon).resize(60 * scale).png().toBuffer();
  await sharp({ create: { width: 108 * scale, height: 108 * scale, channels: 4, background: "#fbf7f0" } })
    .composite([{ input: mark, gravity: "centre" }])
    .png().toFile(path.join(res, `mipmap-${density}`, "ic_launcher_foreground.png"));
}
const splash = await sharp(icon).resize(180).png().toBuffer();
for (const directory of await readdir(res, { withFileTypes: true })) {
  if (!directory.isDirectory() || !directory.name.startsWith("drawable")) continue;
  const files = await readdir(path.join(res, directory.name));
  if (!files.includes("splash.png")) continue;
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#fbf7f0" } })
    .composite([{ input: splash, gravity: "centre" }]).png()
    .toFile(path.join(res, directory.name, "splash.png"));
}
const assets = path.join(root, "ios", "App", "App", "Assets.xcassets");
await sharp(icon).resize(1024).flatten({ background: "#fbf7f0" })
  .toFile(path.join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"));
for (const filename of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await sharp({ create: { width: 2732, height: 2732, channels: 3, background: "#fbf7f0" } })
    .composite([{ input: splash, gravity: "centre" }]).png()
    .toFile(path.join(assets, "Splash.imageset", filename));
}
console.log("Generated branded iOS and Android icons and launch images.");
