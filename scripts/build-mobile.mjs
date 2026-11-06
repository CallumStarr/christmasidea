import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = path.join(root, "mobile", "www");
await mkdir(target, { recursive: true });
await cp(path.join(root, "site"), target, { recursive: true });
await build({
  entryPoints: [path.join(root, "mobile", "native-bridge.js")],
  bundle: true, format: "esm", target: ["safari16.4", "chrome110"],
  outfile: path.join(target, "native-bridge.js"),
});
let html = await readFile(path.join(target, "index.html"), "utf8");
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://m.media-amazon.com https://images-eu.ssl-images-amazon.com https://i.ebayimg.com",
  "connect-src 'self' https://christmasidea.co.uk",
  "frame-src https://christmasidea.co.uk",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'",
].join("; ");
html = html.replace('<html lang="en-GB">', '<html lang="en-GB" data-native-app>')
  .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('<script type="module" src="/app.js"></script>', '<script type="module" src="/native-bridge.js"></script>\n<script type="module" src="/app.js"></script>');
await writeFile(path.join(target, "index.html"), html);
console.log("Bundled Santa's Helper for iOS and Android in mobile\\www.");
