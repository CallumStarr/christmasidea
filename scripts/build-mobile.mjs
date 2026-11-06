import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { inlineScriptHashes } from "./build-csp-hashes.mjs";

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
// App approval is separate from website approval. Do not bundle Special Links until it is confirmed.
if (process.env.AMAZON_MOBILE_APPROVED !== "true") {
  html = html.replace(/AMAZON_TAG:\s*"[^"]*"/, 'AMAZON_TAG: ""');
  const configPath = path.join(target, "monetization-config.js");
  const config = await readFile(configPath, "utf8");
  const publicConfig = JSON.parse(config.match(/export const MONETIZATION_CONFIG = ([\s\S]*);\s*$/)?.[1] || "");
  publicConfig.AMAZON_TAG = "";
  await writeFile(configPath, `// Generated mobile settings; Amazon app approval is required for Special Links.\nexport const MONETIZATION_CONFIG = ${JSON.stringify(publicConfig, null, 2)};\n`);
  for (const name of await readdir(target, { recursive: true })) {
    if (!name.endsWith(".html") || name === "index.html") continue;
    const file = path.join(target, name);
    const page = await readFile(file, "utf8");
    await writeFile(file, page.replace(/(href="https:\/\/www\.amazon\.co\.uk\/[^"]*?)(?:&amp;|&)tag=[^"&]*((?:&amp;|&)[^"]*|")/g, "$1$2"));
  }
}
const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...new Set(inlineScriptHashes(html))].join(" ")}`,
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
