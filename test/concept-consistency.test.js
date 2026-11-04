import test from "node:test";
import assert from "node:assert/strict";
import { curateIdeas, handleRequest, normaliseInput } from "../src/core.js";

const description = "My dad is happiest in the garden, loves a good coffee and has every tool. budget of £40";
const input = normaliseInput({ mode: "describe", description }).value;
const candidate = (title, query, why = `A useful ${title.toLowerCase()} for time in the garden.`, extra = {}) => ({
  title, concept: title, search_query: query, why, category: "Home",
  estimated_max_price_gbp: 30, ...extra,
});
// Exact displayed production examples and supplied retailer-search queries.
const conflicts = [
  candidate("Garden kneeler with tool pouch", "garden apron with pockets",
    "A tool apron keeps his favourite hand tools close at hand while he works, a handy extra for someone who already owns plenty."),
  candidate("Enamel camp-style coffee pot", "stovetop moka pot coffee maker",
    "A classic stovetop brewer that makes strong coffee outdoors on a picnic or garden lunch, if he likes a fuller brew."),
  candidate("Foldable gardening kneeling bench", "gardening utility apron",
    "A gardening apron keeps tools within reach."),
  candidate("Enamel camping coffee percolator", "stove top espresso maker",
    "A compact espresso maker for coffee outdoors."),
  candidate("Garden kneeling cushion", "garden kneeling cushion",
    "A pocketed tool apron keeps tools close while gardening."),
  candidate("Moka coffee maker", "moka coffee maker", undefined, { concept: "Enamel camping coffee pot" }),
  candidate("Garden kneeling pad", "garden kneeling pad", undefined, {
    product_spec: { required_features: ["tool apron with pockets"] },
  }),
  candidate("Moka coffee pot", "moka coffee pot", undefined, {
    product_spec: { required_variants: ["enamel camping coffee pot"] },
  }),
  candidate("Garden kneeling mat", "garden kneeling mat", undefined, {
    concept: "Garden kneeling mat and tool apron",
  }),
  candidate("Garden kneeling mat", "garden kneeling mat", undefined, {
    product_spec: { preferred_features: ["gardening apron"] },
  }),
];
const accepted = [
  candidate("Garden kneeling pad", "garden kneeling mat", "A padded kneeling mat for long sessions of weeding and planting."),
  candidate("Moka coffee pot", "stovetop espresso maker", "A moka pot makes a fuller brew for a coffee break in the garden."),
  candidate("Enamel camping coffee pot", "enamel camping coffee pot", "An enamel coffee pot for a garden lunch or camping trip."),
  candidate("Garden seat with storage box", "garden storage seat", "A seat with storage for gardening bits."),
  candidate("Manual coffee grinder", "manual coffee grinder"),
  candidate("Garden coffee pour-over dripper set", "pour over coffee dripper"),
  candidate("Solar garden lanterns", "solar garden lanterns"),
  candidate("Garden wind chime", "garden wind chime"),
  candidate("Gardening field guide", "gardening field guide"),
  candidate("Garden kneeler with tool pouch", "garden kneeler tool pouch", "A kneeler with a pouch to keep tools nearby."),
  candidate("Garden kneeler and tool apron set", "garden kneeler apron set", "A tool apron and kneeler for gardening."),
  candidate("Garden notebook", "garden notebook", "A notebook for planning planting over coffee, with notes on his kneeling pad and tool apron."),
  candidate("Garden kneeling mat", "garden kneeling mat", "A kneeling mat for gardening, unlike a tool apron."),
  candidate("Garden kneeling pad cover", "garden kneeling pad cover", "A cover for an existing kneeling pad."),
  candidate("Garden kneeler and tool apron bundle", "garden kneeler tool apron bundle", "A kneeler and tool apron bundle for planting.", {
    concept: "Garden kneeler and tool apron bundle",
    product_spec: { required_features: ["tool apron"], preferred_features: ["garden kneeler"] },
  }),
  candidate("Gardening tool apron", "gardening tool apron", "A tool apron keeps hand tools close."),
  candidate("Garden seat cushion", "garden seat cushion", "A cushion for his garden seat."),
  candidate("Kneeling mat with handles", "garden kneeling mat handles", "His tool apron keeps tools close; this mat adds padding while planting."),
  candidate("Garden kneeling cushion", "garden kneeling cushion", "A handy companion to his tool apron.", {
    product_spec: { preferred_features: ["without tool apron"] },
  }),
];
const comparativeBundle = candidate(
  "Garden kneeler versus tool apron",
  "tool apron with pockets",
  "A tool apron keeps hand tools close while gardening.",
);
const comparativeFullBundle = candidate(
  "Garden kneeler versus tool apron bundle",
  "garden kneeler tool apron bundle",
  "A kneeler and tool apron bundle for planting.",
);
const repeatedKneelingAid = candidate(
  "Garden kneeling mat with handles",
  "foam garden kneeling mat",
  "A padded mat that could be handy for long sessions of weeding and planting, though he may already have something similar.",
);
const env = {
  ALLOWED_ORIGINS: "https://gifts.example.com",
  IP_SALT: "concept-test-salt-0123456789abcdef",
  ANTHROPIC_API_KEY: "test-only",
  RECOMMENDATION_MODE: "baseline-v3.3",
};
async function release(ideas, exclude = [], overrides = {}) {
  return handleRequest(new Request("https://gifts.example.com/api/ideas", {
    method: "POST",
    headers: { Origin: env.ALLOWED_ORIGINS, "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, exclude }),
  }), env, {
    budget: { consume: async () => ({ ok: true }) },
    fetch: async () => Response.json({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: "gift_ideas", input: { ideas } }],
    }),
    ...overrides,
  });
}

for (const [index, idea] of conflicts.entries()) {
  test(`consistency rejects explicit conflict ${index + 1}: ${idea.title}`, async () => {
    const result = curateIdeas({ ideas: [idea] }, input);
    assert.deepEqual(result.ideas, []);
    assert.deepEqual(result.diagnostics.rejected[0].codes, ["product_concept_conflict"]);
    const response = await release([idea]);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.ideas, []);
    assert.equal(data.shortfall, true);
    assert.equal(data.engine_version, "baseline-v3.3");
  });
}

test("comparative titles cannot bypass conflict validation while consistent bundles can", async () => {
  for (const idea of [comparativeBundle, comparativeFullBundle, conflicts[0], conflicts[1]]) {
    const result = curateIdeas({ ideas: [idea] }, input);
    assert.deepEqual(result.ideas, []);
    assert.deepEqual(result.diagnostics.rejected[0].codes, ["product_concept_conflict"]);
  }
  const bundle = accepted[14];
  assert.equal(curateIdeas({ ideas: [bundle] }, input).ideas[0].title, bundle.title);
});

test("negated product mentions do not create an affirmative conflict", () => {
  const notApron = candidate(
    "Garden kneeling mat",
    "garden kneeling mat not apron",
    "A garden kneeling mat, not an apron.",
  );
  const result = curateIdeas({ ideas: [notApron] }, input);
  assert.deepEqual(result.ideas.map((i) => i.title), [notApron.title]);
});

test("exact previously reported kneeling mat is excluded against its earlier pad-and-seat title", async () => {
  const exclude = ["Pocket garden kneeling pad and seat"];
  const result = curateIdeas({ ideas: [repeatedKneelingAid] }, input, { exclude });
  assert.deepEqual(result.ideas, []);
  assert.ok(result.diagnostics.rejected[0].codes.includes("already_shown"));
  const response = await release([repeatedKneelingAid], exclude);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.ideas, []);
  assert.equal(data.shortfall, true);
});

for (const idea of accepted) {
  test(`consistency accepts coherent or contextual product: ${idea.title}`, async () => {
    const result = curateIdeas({ ideas: [idea] }, input);
    assert.equal(result.ideas.length, 1, JSON.stringify(result.diagnostics.rejected));
    const data = await (await release([idea])).json();
    assert.deepEqual(data.ideas.map((i) => i.title), [idea.title]);
  });
}

test("release uses valid spares in original order and never pads a consistency shortfall", async () => {
  const good = accepted.slice(0, 9);
  const data = await (await release([...conflicts.slice(0, 2), ...good])).json();
  assert.deepEqual(data.ideas.map((i) => i.title), good.slice(0, 8).map((i) => i.title));
  assert.equal(data.shortfall, false);
  const short = await (await release([...conflicts, good[0]])).json();
  assert.deepEqual(short.ideas.map((i) => i.title), [good[0].title]);
  assert.equal(short.shortfall, true);
});

test("different ideas rejects reworded kneeling aids but preserves adjacent gifts and accessories", async () => {
  const exclude = ["Pocket garden kneeling pad and seat"];
  const distinct = [...accepted.slice(3, 9), accepted[13], ...accepted.slice(15, 17)];
  for (const title of ["Garden kneeling mat with handles", "FOAM GARDEN KNEELERS", "Gardening kneeling cushions", "Folding garden kneeler seat"]) {
    const idea = candidate(title, "garden kneeling mat", "A padded mat that could be handy for long sessions of weeding and planting, though he may already have something similar.");
    for (const alternative of distinct) {
      const data = await (await release([idea, alternative], exclude)).json();
      assert.deepEqual(data.ideas.map((i) => i.title), [alternative.title]);
    }
  }
  for (const exclude of [["Manual coffee grinder"], ["Solar garden lanterns"], ["Gardening field guide"]]) {
    const idea = accepted[exclude[0].includes("grinder") ? 5 : 0];
    assert.deepEqual((await (await release([idea], exclude)).json()).ideas.map((i) => i.title), [idea.title]);
  }
  assert.deepEqual((await (await release([accepted[15]], ["Coffee barista apron"])).json()).ideas.map((i) => i.title), [accepted[15].title]);
});

test("exclusion matches title, concept or query anchors without conflating storage seats", async () => {
  for (const idea of [
    candidate("Comfort cushion", "garden kneeling mat", "A useful mat for gardening."),
    candidate("Comfort cushion", "garden comfort cushion", "A cushion for gardening.", { concept: "Garden kneeler" }),
  ]) {
    assert.deepEqual((await (await release([idea], ["Garden kneeling pads"])).json()).ideas, []);
  }
  assert.equal((await (await release([accepted[0]], ["Garden storage seat"])).json()).ideas.length, 1);
});

test("same-batch rewordings of kneeling aids are also duplicates", () => {
  const result = curateIdeas({ ideas: [
    accepted[0], candidate("Folding garden kneeler seat", "folding garden kneeler seat"), accepted[3],
  ] }, input);
  assert.deepEqual(result.ideas.map((i) => i.title), [accepted[0].title, accepted[3].title]);
});

test("exclusion changes cannot reuse a cached baseline response", async () => {
  const store = new Map();
  const keys = [];
  const cache = {
    match: async (key) => { keys.push(key.url); return store.get(key.url)?.clone(); },
    put: async (key, response) => { store.set(key.url, response.clone()); },
  };
  const first = await (await release([accepted[0]], [], { cache })).json();
  const more = await (await release([accepted[0]], ["Pocket garden kneeling pad and seat"], { cache })).json();
  assert.equal(first.ideas.length, 1);
  assert.deepEqual(more.ideas, []);
  assert.notEqual(keys[0], keys[1]);
  const cached = await (await release([accepted[0]], [], { cache })).json();
  assert.equal(cached.cached, true);
});

test("existing exclusion count and text limits remain unchanged", () => {
  const parsed = normaliseInput({ ...input, exclude: Array.from({ length: 30 }, (_, i) => `${i} ${"x".repeat(90)}`) });
  assert.equal(parsed.value.exclude.length, 24);
  assert.ok(parsed.value.exclude.every((title) => title.length === 80));
});
