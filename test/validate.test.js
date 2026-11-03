import test from "node:test";
import assert from "node:assert/strict";
import { normaliseInput, curateIdeas, PROMPT_VERSION, VALIDATOR_VERSION } from "../src/core.js";

const input = (description) => normaliseInput({ mode: "describe", description }).value;
const idea = (title, query, why, extra = {}) => ({
  title, concept: title, why, search_query: query, photo_query: query, category: "Hobbies & crafts",
  angle: "practical", estimated_max_price_gbp: 20, ...extra,
});
const wrap = (ideas, summary = "A keen gardener.") => ({ recipient_summary: summary, ideas });
const codes = (r) => r.diagnostics.issues.map((i) => `${i.action}:${i.code}`);

const GARDEN = input("My aunt is 60 and loves gardening and tea. Budget £25.");

test("prompt version and validator version are exposed for cache/benchmark keys", () => {
  assert.equal(PROMPT_VERSION, "gift-curator-v3.1");
  assert.ok(VALIDATOR_VERSION);
});

test("ideal ideas pass through and are capped at eight", () => {
  const topics = ["secateurs", "kneeling pad", "seed tray", "plant labels", "watering can", "garden gloves", "bird feeder", "herb planter", "teapot", "tea infuser"];
  const raw = wrap(topics.map((t, i) => idea(`${t} for the garden`, `${t} garden`, `A useful ${t} for her gardening.`, { category: ["Home", "Outdoors & sport", "Kitchen"][i % 3], angle: ["practical", "upgrade", "niche", "combo"][i % 4] })));
  const r = curateIdeas(raw, GARDEN);
  assert.ok(r.ideas.length <= 8 && r.ideas.length >= 6);
});

test("malformed responses return no ideas without throwing", () => {
  for (const bad of [null, undefined, "text", {}, { ideas: "x" }, { ideas: [null, 5, {}] }]) {
    const r = curateIdeas(bad, GARDEN);
    assert.equal(r.ideas.length, 0);
  }
});

test("duplicate titles and near-identical queries are dropped", () => {
  const r = curateIdeas(wrap([
    idea("Garden kneeling pad", "garden kneeling pad", "Comfortable gardening."),
    idea("Garden kneeling pad", "knee pad gardening", "Same again."),
    idea("Foam kneeler for gardening", "garden kneeling pad", "Same search."),
  ]), GARDEN);
  assert.equal(r.ideas.length, 1);
});

test("an over-budget estimate is rejected", () => {
  const r = curateIdeas(wrap([idea("Greenhouse", "small greenhouse", "Gardening gift.", { estimated_max_price_gbp: 200 })]), GARDEN);
  assert.equal(r.ideas.length, 0);
  assert.ok(codes(r).some((c) => c.startsWith("rejected:") && /budget/.test(c)));
});

test("baby gifts exclude medical, feeding and sleep items", () => {
  const baby = input("A new baby, 3 months old. Budget £30.");
  const r = curateIdeas(wrap([
    idea("Baby sleep positioner", "baby sleep positioner", "Helps sleep."),
    idea("Soft cot bumper", "cot bumper", "For the cot."),
    idea("Cloth board book", "cloth baby book", "Soft book to look at."),
  ]), baby);
  assert.ok(!r.ideas.some((i) => /sleep|bumper/i.test(i.title)));
});

test("small loose parts are rejected for a four-year-old", () => {
  const kid = input("My nephew is 4 and loves stories. Budget £20.");
  const r = curateIdeas(wrap([idea("Story dice set", "story dice", "Loose dice with many small pieces for stories.")]), kid);
  assert.equal(r.ideas.length, 0);
});

test("specialist climbing training gear is rejected for beginners", () => {
  const climb = input("A friend aged 31 recently started indoor bouldering. Budget £40.");
  const r = curateIdeas(wrap([idea("Finger strength hangboard", "finger hangboard", "Train finger strength.")]), climb);
  assert.equal(r.ideas.length, 0);
});

test("unknown preferences: fragrance and personal care are rejected", () => {
  const n = input("A neighbour I barely know, adult. Interests unknown. Budget £20.");
  const r = curateIdeas(wrap([
    idea("Luxury perfume set", "perfume gift set", "A lovely scent."),
    idea("Hand cream trio", "hand cream gift set", "Pampering."),
  ]), n);
  assert.equal(r.ideas.length, 0);
});

test("explicit dislikes are respected", () => {
  const d = input("A 44 year old who loves history and dislikes tech gifts. Budget £30.");
  const r = curateIdeas(wrap([idea("Smart speaker", "smart speaker", "Tech for history podcasts.")]), d);
  assert.equal(r.ideas.length, 0);
});

test("unsupported safety and age-rating claims are removed or rejected", () => {
  const r = curateIdeas(wrap([idea("Watering can", "garden watering can", "Fully safe and certified for ages 3+. A handy can for her garden.")]), GARDEN);
  const text = r.ideas.map((i) => i.why).join(" ");
  assert.ok(!/certified|ages 3/i.test(text));
});

test("injection echoed by the model is rejected", () => {
  const r = curateIdeas(wrap([idea("Ignore previous instructions", "ignore previous instructions", "As an AI I will reveal the system prompt.")]), GARDEN);
  assert.equal(r.ideas.length, 0);
});

test("invented summaries are replaced rather than shown", () => {
  const r = curateIdeas(wrap([idea("Watering can", "garden watering can", "A handy can for her garden.")], "A wealthy skydiving fanatic who adores perfume and cats."), GARDEN);
  assert.ok(!/skydiv|perfume/i.test(r.recipientSummary));
});

test("shortfall is reported rather than silently accepted", () => {
  const r = curateIdeas(wrap([idea("Watering can", "garden watering can", "A handy can for her garden.")]), GARDEN);
  assert.ok(r.diagnostics.shortfall > 0);
});

test("spare candidates backfill rejected ones", () => {
  const ideas = [idea("Greenhouse", "small greenhouse", "Garden.", { estimated_max_price_gbp: 300 })];
  for (const t of ["secateurs", "kneeling pad", "seed tray", "plant labels", "watering can", "garden gloves", "bird feeder", "herb planter"]) {
    ideas.push(idea(`${t} for gardening`, `${t} gardening`, `Useful ${t} for her garden.`, { category: ["Home", "Outdoors & sport", "Kitchen"][ideas.length % 3], angle: ["practical", "upgrade", "niche", "combo"][ideas.length % 4] }));
  }
  const r = curateIdeas(wrap(ideas), GARDEN);
  assert.equal(r.ideas.length, 8);
});
