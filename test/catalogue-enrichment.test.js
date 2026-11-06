import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { catalogueClaim, feedIdentity, normaliseCatalogueClaims, catalogueFacts, packagingSignature } from "../src/catalogue-facts.js";
import { createAwinProvider } from "../src/providers/awin.js";
import { assessProductEvidence, compileProductEvidence } from "../src/engine/product-evidence.js";
import { safetyCandidates, matchSafetyIdentifiers, screenSafety } from "../scripts/screen-product-safety.mjs";

test("feed identifiers reject placeholders, corruption and conflicting variants without inventing a barcode", () => {
  for (const value of ["0", "00", "00000000", "00000000000000", "GTIN 12345670", "12345670junk", "123456700000001"]) {
    assert.deepEqual(feedIdentity([value]), { gtin: "", status: "invalid" }, value);
  }
  assert.deepEqual(feedIdentity(["", " "]), { gtin: "", status: "missing" });
  assert.deepEqual(feedIdentity(["0", "12345670"]), { gtin: "00000012345670", status: "valid" });
  assert.deepEqual(feedIdentity(["12345670", "00000012345670"]), { gtin: "00000012345670", status: "valid" });
  assert.deepEqual(feedIdentity(["12345670", "4006381333931"]), { gtin: "", status: "conflicting" });
});

test("retailer assertions remain whitelisted, bounded and separate from quality assessments", () => {
  assert.equal(catalogueClaim("N/A", 40), "");
  assert.equal(catalogueClaim("unknown", 40), "");
  assert.equal(catalogueClaim(123, 40), "");
  assert.deepEqual(normaliseCatalogueClaims({ model: "X1", rating: 5, warranty: "2 years", independent: true }),
    { model: "X1", warranty: "2 years" });
  const facts = catalogueFacts({ model: "X1", mpn: "0" }, "https://shop.example/x1",
    "2026-11-06T12:00:00Z", "2026-11-07T12:00:00Z");
  assert.equal(facts.trust, "retailer-asserted");
  assert.deepEqual(facts.claims, { model: "X1" });
  assert.equal(assessProductEvidence({ concept: "coffee grinder" }, {
    provider: "awin", productId: "488:123", catalogueFacts: facts,
  }, compileProductEvidence()).evidenceCoverage, 0);
  assert.throws(() => catalogueFacts({ model: "X1" }, "http://shop.example", "2026-01-01", "2026-01-02"), /fact source/);
  assert.throws(() => catalogueFacts({ model: "X1" }, "https://shop.example", "bad", "2026-01-02"), /fact dates/);
});

test("packaging signatures distinguish bulk boxes and incompatible unit sizes", () => {
  assert.notEqual(packagingSignature("Chocolate Bar 32g"), packagingSignature("Chocolate Bar 32g (Box of 48)"));
  assert.equal(packagingSignature("Chocolate 0.5kg"), packagingSignature("Chocolate 500g"));
  assert.notEqual(packagingSignature("Juice 500ml"), packagingSignature("Juice 1l"));
  assert.equal(packagingSignature("Chocolate pack of 48 32g"), packagingSignature("Chocolate 48 x 32g"));
});

test("real feed import produces an enriched SQLite snapshot and source-labelled runtime offers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalogue-enrichment-"));
  const snapshot = join(directory, "catalogue.sqlite");
  try {
    const url = "https://shop.example/grinder";
    const link = `https://www.awin1.com/cread.php?awinmid=488&awinaffid=3146453&ued=${encodeURIComponent(url)}`;
    const feed = join(directory, "feed.csv");
    const rows = [
      "merchant_id,aw_product_id,product_name,brand_name,search_price,currency,in_stock,delivery_cost,merchant_deep_link,aw_deep_link,ean,product_GTIN,model_number,product_model,mpn,warranty,dimensions,condition",
      `488,grinder,Coffee grinder,CoffeeCo,20,GBP,yes,2,${url},${link},0,12345670,0,Grinder X1,MPN-1,Two years,20 cm,new`,
      `488,conflict,Coffee grinder,CoffeeCo,20,GBP,yes,0,${url},${link},12345670,4006381333931,,,,,,new`,
      `488,single,Chocolate bar 32g,ChocolateCo,2,GBP,yes,0,${url},${link},4006381333931,,,,,,,new`,
      `488,box,Chocolate bar 32g (Box of 48),ChocolateCo,80,GBP,yes,0,${url},${link},4006381333931,,,,,,,new`,
    ];
    await writeFile(feed, rows.join("\n"));
    const script = fileURLToPath(new URL("../scripts/import-awin-feed.mjs", import.meta.url));
    const args = [script, "--feed", feed, "--advertisers", "488", "--output", directory, "--snapshot", snapshot];
    const run = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(await readFile(join(directory, "catalogue-enrichment-report.json"), "utf8"));
    assert.equal(report.coverage.products, 4);
    assert.equal(report.coverage.validGtin, 1);
    assert.equal(report.coverage.withClaims, 1);
    assert.equal(report.enrichment.identities.conflicting, 1);
    assert.deepEqual(report.enrichment.packagingConflicts, { gtinGroups: 1, products: 2 });
    assert.equal(report.independentQualityClaim, false);
    const db = new DatabaseSync(snapshot);
    try {
      const imported = db.prepare("SELECT gtin, facts_json FROM awin_products WHERE product_id='488:grinder'").get();
      assert.equal(imported.gtin, "00000012345670");
      assert.equal(db.prepare("SELECT gtin FROM awin_products WHERE product_id='488:box'").get().gtin, "");
      assert.equal(JSON.parse(imported.facts_json).model, "Grinder X1");
      const binding = {
        prepare(sql) {
          const query = db.prepare(sql);
          return {
            first: async () => query.get(),
            bind: (...args) => ({ all: async () => ({ results: query.all(...args) }) }),
          };
        },
      };
      const provider = createAwinProvider({
        AWIN_CATALOG: binding, PRODUCT_DISCOVERY_ENABLED: "true",
        AWIN_PRODUCT_DISCOVERY_ENABLED: "true", AWIN_PUBLISHER_ID: "3146453", AWIN_ALLOWED_ADVERTISERS: "488",
      });
      const products = await provider.searchProducts("Coffee grinder");
      assert.equal(products.length, 2);
      const product = products.find((item) => item.productId === "488:grinder");
      assert.equal(product.catalogueFacts.claims.mpn, "MPN-1");
      assert.equal(product.catalogueFacts.sourceUrl, url);
      assert.equal(product.catalogueFacts.trust, "retailer-asserted");
      assert.equal(provider.validateProduct(product).catalogueFacts.claims.model, "Grinder X1");
      assert.equal(provider.validateProduct(product).price.amount, 22);
      const malformed = provider.validateProduct({ ...product, catalogueFacts: {
        ...product.catalogueFacts, sourceUrl: "https://elsewhere.example",
      } });
      assert.equal(malformed.catalogueFacts, undefined);
      assert.equal(products.find((item) => item.productId === "488:conflict").gtin, undefined);
    } finally { db.close(); }
    const rerun = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.notEqual(rerun.status, 0);
    assert.match(rerun.stderr, /EEXIST/);
    const unchanged = JSON.parse(await readFile(join(directory, "catalogue-enrichment-report.json"), "utf8"));
    assert.equal(unchanged.generation, report.generation);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const alert = { title: "Product recall: CoffeeCo grinder", link: "/product-safety-alerts-reports-recalls/coffee-grinder" };
const products = [{ product_id: "488:grinder", brand: "CoffeeCo", gtin: "12345670" }];
const content = {
  base_path: alert.link, document_type: "product_safety_alert_report_recall",
  details: { body: "<p>Barcode 12345670. Check the batch number before taking action.</p>" },
};

test("safety matching creates review leads, never fuzzy safety certifications or automatic exclusions", async () => {
  assert.equal(safetyCandidates(products, [alert]).length, 1);
  assert.equal(safetyCandidates([{ ...products[0], brand: "The Range" }], [alert]).length, 0);
  assert.equal(safetyCandidates([{ ...products[0], brand: "CoffeeCo Special" }], [alert]).length, 0);
  assert.deepEqual(matchSafetyIdentifiers(products, content), ["488:grinder"]);
  assert.deepEqual(matchSafetyIdentifiers([{ ...products[0], gtin: "0" }], content), []);
  assert.throws(() => safetyCandidates(products, [{ title: "CoffeeCo", link: "https://evil.example" }]), /Invalid/);
  assert.throws(() => matchSafetyIdentifiers(products, { ...content, document_type: "news" }), /Invalid/);
  const calls = [];
  const report = await screenSafety(products, {
    fetchImpl: async (url) => {
      calls.push(String(url));
      return Response.json(String(url).includes("/api/search.json")
        ? { results: [alert], total: 1 } : content);
    },
  });
  assert.equal(report.leads[0].reviewed, false);
  assert.equal(report.automaticallyBlockedProducts, 0);
  assert.equal(report.safetyCertification, false);
  assert.match(report.attribution, /Open Government Licence/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => !url.includes("12345670") && !url.includes("488")));
});

test("safety screening reports bounds and fails visibly on incomplete or failed external data", async () => {
  const bounded = await screenSafety(products, {
    maxDocuments: 0, fetchImpl: async () => Response.json({ results: [alert], total: 1 }),
  });
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.contentDocumentsRead, 0);
  await assert.rejects(screenSafety(products, { fetchImpl: async () => new Response("", { status: 429 }) }), /HTTP 429/);
  await assert.rejects(screenSafety(products, {
    fetchImpl: async () => Response.json({ results: [], total: 1 }),
  }), /Malformed/);
  await assert.rejects(screenSafety(products, { maxDocuments: 101 }), /maxDocuments/);
  let page = 0;
  await assert.rejects(screenSafety(products, { fetchImpl: async () => Response.json(
    ++page === 1 ? { results: [alert], total: 2 } : { results: [alert], total: 3 }),
  }), /index changed/);
  await assert.rejects(screenSafety(products, {
    fetchImpl: async () => Response.json({ results: [alert], total: 2 }),
  }), /duplicate or missing/);
});
