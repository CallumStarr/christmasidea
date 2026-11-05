import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const site = (p) => new URL(`../site/${p}`, import.meta.url);
const read = (p) => readFile(site(p), "utf8");

test("at least ten gift guides give all eight ideas equal Amazon and eBay search links", async () => {
  const files = (await readdir(site("gifts/"))).filter((f) => f.startsWith("gifts-for-") || f.startsWith("secret-santa"));
  assert.ok(files.length >= 10);
  const tag = (await read("index.html")).match(/AMAZON_TAG:\s*"([^"]+)"/)[1];
  for (const file of files) {
    const html = await read(`gifts/${file}`);
    const links = html.match(/<a href="https:\/\/www\.amazon\.co\.uk\/s\?[^"]+"[^>]*>/g) || [];
    assert.equal(links.length, 8, `${file} should have 8 ideas`);
    const ebayLinks = html.match(/<a href="https:\/\/www\.ebay\.co\.uk\/sch\/i\.html\?[^"]+"[^>]*>/g) || [];
    assert.equal(ebayLinks.length, links.length, `${file} must give both merchants equal coverage`);
    assert.equal((html.match(/class="merchant-links"/g) || []).length, 8);
    for (const link of links) {
      assert.match(link, /rel="sponsored noopener"/, file);
      assert.ok(link.includes(`tag=${tag}`), `${file} missing affiliate tag`);
    }
    assert.match(html, /Ad: Amazon shopping links are affiliate links/, `${file} needs a disclosure`);
    assert.match(html, /<link rel="canonical"/, file);
  }
});

test("sitemap lists every guide and robots.txt points to it", async () => {
  const sitemap = await read("sitemap.xml");
  const files = (await readdir(site("gifts/"))).filter((f) => f.startsWith("gifts-for-") || f.startsWith("secret-santa"));
  for (const file of files) assert.ok(sitemap.includes(`/gifts/${file.replace(".html", "")}`), file);
  assert.match(await read("robots.txt"), /Sitemap: https:\/\/christmasidea\.co\.uk\/sitemap\.xml/);
});

test("404 page exists and is noindex; social image and touch icon are present", async () => {
  assert.match(await read("404.html"), /name="robots" content="noindex"/);
  assert.ok((await readFile(site("og-image.png"))).length > 5000);
  assert.ok((await readFile(site("apple-touch-icon.png"))).length > 100);
  assert.match(await read("index.html"), /og:image/);
});

test("site files are valid UTF-8 without mojibake or a byte-order mark", async () => {
  const names = ["index.html", "about.html", "privacy.html", "404.html", "gifts/index.html", "gifts/gifts-for-mum.html"];
  for (const name of names) {
    const bytes = await readFile(site(name));
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${name} has a BOM`);
    assert.doesNotMatch(bytes.toString("utf8"), /\u00c2|\u00e2\u20ac|\u00c3/, `${name} has mojibake`);
  }
});

test("operator contact details use email and offer a postal address on legal request", async () => {
  const about = await read("about.html");
  const privacy = await read("privacy.html");
  const email = '<a href="mailto:support@christmasidea.co.uk">support@christmasidea.co.uk</a>';
  assert.ok(about.includes(`<p><strong>Callum Starr</strong><br>Email: ${email}</p>`));
  assert.ok(privacy.includes(`<p>Santa's Helper is operated by <strong>Callum Starr</strong>. Email: ${email}.</p>`));
  assert.match(privacy, /A physical postal address is available upon legitimate legal request\./);
  for (const page of [about, privacy]) {
    const links = [...page.matchAll(/href="mailto:([^"]+)"/g)];
    assert.ok(links.length > 0);
    for (const [, address] of links) assert.equal(address, "support@christmasidea.co.uk");
  }
});

test("site copy avoids gift-edit jargon and uses clear, friendly finder language", async () => {
  const files = [
    "index.html", "about.html", "privacy.html", "404.html",
    ...(await readdir(site("gifts/"))).filter((name) => name.endsWith(".html")).map((name) => `gifts/${name}`),
  ];
  for (const name of files) {
    assert.doesNotMatch(await read(name), /the (?:christmas )?gift edit/i, name);
  }
  const home = await read("index.html");
  assert.match(home, /Who are you shopping for\?/);
  assert.match(home, /Please leave out names and sensitive details/);
  assert.doesNotMatch(home, /Curating your collection|Ideas curated by AI|Adjacent discovery/);
  assert.match(await read("404.html"), /We can't find/);
});

test("homepage offers optional feedback between the finder and gift guides", async () => {
  const home = await read("index.html");
  const feedback = home.indexOf('id="website-feedback"');
  const guides = home.indexOf('id="browse-title"');
  assert.ok(feedback > home.indexOf("Who are you shopping for?"));
  assert.ok(feedback < guides);
  assert.match(home, /name="site-rating" value="5"/);
  assert.match(home, /How useful is Santa's Helper\? <span>\(optional\)<\/span>/);
  assert.match(home, /for="site-feedback-note">What should we work on\? <span>\(optional\)<\/span>/);
  assert.match(home, /id="site-feedback-note"[^>]*maxlength="500"/);
  assert.doesNotMatch(home, /feedback-checks|name="site-feedback"/);
  assert.match(home, /leave a rating, a note, both or neither/i);
  assert.match(home, /Nothing is sent until you choose to send the email/);
  assert.match(home, /mailto:support@christmasidea\.co\.uk\?subject=/);
  assert.match(home, /leave this optional section blank/);
  assert.match(home, /Your email app should open with your feedback/);
  assert.match(await read("privacy.html"), /Santa's Helper does not receive or store them unless you choose to send the email/);
});

test("Worker sets CSP and HSTS headers and locks framing", async () => {
  const src = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(src, /Strict-Transport-Security/);
  assert.match(src, /Content-Security-Policy/);
  assert.match(src, /frame-ancestors 'none'/);
  assert.match(src, /object-src 'none'/);
  assert.match(src, /https:\/\/m\.media-amazon\.com/);
  assert.doesNotMatch(src, /images\.pexels\.com/);
});

test("product cards keep eBay examples non-clickable and Amazon listing images linked", async () => {
  const html = await read("index.html");
  assert.match(await read("api.js"), /\/api\/products/);
  assert.match(html, /photo\.href = product\.affiliateUrl/);
  assert.match(html, /document\.createElement\(product\.provider === "ebay" \? "div" : "a"\)/);
  assert.match(html, /shop\.href = product\.affiliateUrl/);
  assert.match(html, /Matched \$\{merchant\} listing: \$\{product\.title\}/);
  assert.match(html, /Example photo: eBay\. Amazon product may differ\./);
  assert.match(html, /Photo from Amazon listing/);
  assert.match(await read("home.css"), /\.merchant-links\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /shop\[data-provider=/);
  assert.doesNotMatch(html, /heading\.textContent = product\.title/);
  assert.match(html, /product\.price\?\.currency === "GBP"/);
  assert.match(await read("home.css"), /object-fit:contain/);
  assert.match(html, /loading = "lazy"/);
  assert.match(html, /decoding = "async"/);
  assert.match(html, /card\.classList\.add\("verified"\)/);
  assert.match(html, /Product photo unavailable/);
  assert.doesNotMatch(html, /api\/photos|pexels\.com|images\.pexels\.com/i);
});

test("product enrichment updates its original cards, never a later collection with matching titles", async () => {
  const html = await read("index.html");
  const source = html.match(/async function fillProducts\(ideas\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "product enrichment function must exist");
  for (const replaced of [false, true]) {
    const idea = { title: "Garden notebook", query: "garden notebook" };
    const original = { isConnected: true };
    const cards = new Map([[idea.title, original]]);
    const applied = [];
    let resolve;
    const pending = new Promise((done) => { resolve = done; });
    const enrich = runInNewContext(`(${source})`, {
      apiOn: () => true,
      cardsByTitle: cards,
      fetchProductBatches: async (_request, onBatch) => onBatch(await pending, 0),
      CFG: {},
      validProduct: () => true,
      setVerifiedProduct: (...args) => applied.push(args),
    });
    const filling = enrich([idea]);
    if (replaced) {
      original.isConnected = false;
      cards.set(idea.title, { isConnected: true });
    }
    const product = { title: "Verified notebook" };
    resolve({ products: [product] });
    await filling;
    assert.equal(applied.length, replaced ? 0 : 1);
    if (!replaced) {
      assert.equal(applied[0][0], original);
      assert.equal(applied[0][1], idea);
      assert.equal(applied[0][2], product);
    }
  }
});

test("progressive enrichment does not repeat a listing on cards from different batches", async () => {
  const html = await read("index.html");
  const source = html.match(/async function fillProducts\(ideas\)\{[\s\S]*?\n\}/)?.[0];
  const ideas = [{ title: "First" }, { title: "Second" }, { title: "Third" }];
  const cards = new Map(ideas.map((idea) => [idea.title, { isConnected: true }]));
  const applied = [];
  const product = { provider: "ebay", productId: "v1|123456789012|0" };
  const enrich = runInNewContext(`(${source})`, {
    apiOn: () => true, cardsByTitle: cards, CFG: {},
    validProduct: () => true,
    setVerifiedProduct: (card, idea, product) => applied.push({ card, idea, product }),
    fetchProductBatches: async (_request, onBatch) => {
      onBatch({ products: [product] }, 2);
      assert.equal(applied.length, 1, "the first completed batch must render immediately");
      onBatch({ products: [product, null] }, 0);
    },
  });
  await enrich(ideas);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].idea, ideas[2]);
});
test("shortlist dock is contextual and never covers the finder", async () => {
  const html = await read("index.html");
  const source = html.match(/let collectionInView = false;[\s\S]*?\.observe\(\$\("#results"\)\);/)?.[0];
  assert.ok(source);
  const elements = Object.fromEntries(["#listbar", "#openlist", "#nav-count", "#nav-shortlist", "#results"].map((id) => [id, {
    hidden: true,
    setAttribute(name, value) { this[name] = value; },
  }]));
  const shortlist = [{ title: "Notebook" }];
  let notify;
  runInNewContext(source, {
    $: (id) => elements[id],
    shortlist,
    IntersectionObserver: class {
      constructor(callback) { notify = callback; }
      observe(element) { assert.equal(element, elements["#results"]); }
    },
  });
  notify([{ isIntersecting: false }]);
  assert.equal(elements["#listbar"].hidden, true);
  assert.equal(elements["#nav-count"].textContent, 1);
  assert.equal(elements["#nav-shortlist"]["aria-label"], "Open your shortlist, 1 saved idea");
  notify([{ isIntersecting: true }]);
  assert.equal(elements["#listbar"].hidden, false);
  shortlist.pop();
  notify([{ isIntersecting: true }]);
  assert.equal(elements["#listbar"].hidden, true);
});

test("homepage separates gift concepts from matched listings and offers accessible prompt examples", async () => {
  const html = await read("index.html");
  assert.match(html, /Example descriptions/);
  assert.match(html, /class="prompt-chip"/);
  assert.match(html, /a\.textContent = `Search \$\{merchant\}`/);
  assert.match(html, /Search links open Amazon UK or eBay UK/);
  const disclosure = html.match(/<div class="recommendation-disclosure">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(disclosure, "shopping links need a dedicated disclosure");
  const visibleDisclosure = disclosure.match(/<p class="disclosure">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(visibleDisclosure, "the concept/product distinction must not be hidden inside details");
  assert.match(visibleDisclosure, /Amazon shopping links are affiliate links/);
  assert.match(visibleDisclosure, /gift ideas, not products we have tested/);
  assert.match(visibleDisclosure, /earn a commission/);
  assert.match(disclosure, /Matched Amazon listing/);
  assert.match(disclosure, /Matching is not a review or an endorsement/);
  assert.ok(html.indexOf(disclosure) < html.indexOf('id="cards"'), "disclosure must precede shopping results");
  const css = await read("home.css");
  assert.match(css, /\.media\{display:none\}/, "gift concepts must not display pretend product images");
  assert.match(css, /\.verified \.media\{display:block/, "only verified products expose product imagery");
  const verification = html.match(/function setVerifiedProduct\(card, idea, product\)\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(verification);
  assert.match(verification, /card\.classList\.add\("verified"\)/);
  assert.match(verification, /Matched \$\{merchant\} listing/);
  assert.match(html, /id="cancel"/);
  assert.match(html, /id="loading-text" role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /const ticker|aria-current="step"/, "waiting must not pretend to report server progress");
  assert.doesNotMatch(html, /optional anonymous feedback/);
  assert.ok(html.indexOf('id="ts"') > html.indexOf('id="go"'), "the security widget must not push the primary action below the first screen");
  assert.match(await read("api.js"), /Search cancelled\. Your description is still here\./);
  assert.doesNotMatch(html, /Checking every idea against what you told us|Reading your description/);
});

test("site privacy text describes optional Amazon product search without Pexels processing", async () => {
  const privacy = await read("privacy.html");
  assert.match(privacy, /Optional product discovery/);
  assert.match(privacy, /one hour/);
  assert.doesNotMatch(privacy, /Pexels/i);
});

test("privacy notice explains feedback minimisation and scheduled retention cleanup", async () => {
  const privacy = await read("privacy.html");
  assert.match(privacy, /does not receive your recipient description, generated idea text or a session identifier/);
  assert.match(privacy, /daily aggregate counters/);
  assert.match(privacy, /daily scheduled cleanup prunes feedback aggregate counters once they are 90 days old/);
  assert.match(privacy, /pseudonymous processing, not a guarantee of anonymity/);
  assert.match(privacy, /daily and minute buckets/);
  assert.match(privacy, /hourly and second buckets/);
  assert.match(privacy, /not the providers' own retention periods/);
  assert.doesNotMatch(privacy, /the operator should confirm/);
  assert.match(privacy, /ASA guidance on affiliate marketing disclosures/);

  const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(worker, /async scheduled\(_controller, env, ctx\)/);
  assert.match(config, /crons = \["0 3 \* \* \*"\]/);
});
