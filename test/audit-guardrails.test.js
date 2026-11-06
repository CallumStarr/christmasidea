import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("remote workflow actions use immutable commit references", async () => {
  const files = await readdir(new URL("../.github/workflows/", import.meta.url));
  for (const file of files.filter((name) => /\.ya?ml$/.test(name))) {
    const text = await read(`.github/workflows/${file}`);
    for (const [, action] of text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      if (action.startsWith("./")) continue;
      assert.match(action, /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/, `${file}: ${action}`);
    }
    assert.doesNotMatch(text, /pull_request_target/, file);
  }
});

test("quality CI checks generated pages and both application bundles without deploying", async () => {
  const workflow = await read(".github/workflows/quality.yml");
  for (const command of [
    "npm run build:pages",
    "git diff --exit-code -- site",
    "npm run build:app",
    "npx --no-install wrangler deploy --dry-run",
  ]) assert.ok(workflow.includes(command), `missing ${command}`);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /timeout-minutes: \d+/);
  assert.doesNotMatch(workflow, /secrets\.|--remote/);
});

test("privacy copy describes named local wishlists and their actual limits consistently", async () => {
  const privacy = await read("site/privacy.html");
  assert.match(privacy, /up to 20 named wishlists with up to 50 gift concepts each/);
  assert.doesNotMatch(privacy, /never a name field|Shortlists are capped at 50 gifts/);
  assert.match(privacy, /deleting a local entry does not revoke shared copies/);
});

test("Android light navigation controls are limited to supported API levels", async () => {
  const base = await read("android/app/src/main/res/values/styles.xml");
  const modern = await read("android/app/src/main/res/values-v27/styles.xml");
  assert.doesNotMatch(base, /windowLightNavigationBar|navigationBarColor/);
  assert.match(base, /name="AppTheme.NoActionBar" parent="AppTheme.NoActionBarBase"/);
  assert.match(modern, /name="android:windowLightNavigationBar">true/);
  assert.match(modern, /name="android:navigationBarColor">#fbf7f0/);
});
