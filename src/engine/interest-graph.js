// Interest/motivation graph. Maps what a shopper wrote ("obsessed with trains") onto the
// underlying motivations ("facets": movement, mechanics, construction, journeys...) and from
// there onto curated adjacent gift concepts. It is hand-authored, versioned data: small enough
// to review, deterministic, and free to run on every request. Facet links are hypotheses about
// *why* someone likes something; they are labelled as such everywhere they are surfaced.

import { contentStems, stemSet } from "../text.js";

export const GRAPH_VERSION = "interest-graph-v1";

/** Motivations behind interests. `label` is the phrase used in explanations. */
export const FACETS = {
  movement: { label: "things that move" },
  mechanics: { label: "how things work" },
  construction: { label: "building and engineering" },
  exploration: { label: "exploring and discovering" },
  journeys: { label: "journeys, maps and places" },
  imaginative: { label: "imaginative play and storytelling" },
  collecting: { label: "collecting and completing sets" },
  nature: { label: "nature and the outdoors" },
  creatures: { label: "animals and creatures" },
  science: { label: "science and experiments" },
  space: { label: "space and the night sky" },
  art: { label: "drawing and visual art" },
  crafting: { label: "making things by hand" },
  music: { label: "music and sound" },
  performance: { label: "performing and showing off" },
  competition: { label: "competition and challenge" },
  strategy: { label: "puzzles and strategy" },
  active: { label: "being active" },
  cooking: { label: "cooking and food craft" },
  hosting: { label: "hosting and time with others" },
  cosy: { label: "comfort and slowing down" },
  design: { label: "design and good-looking things" },
  tech: { label: "technology and gadgets" },
  organising: { label: "order and organisation" },
  history: { label: "history and how things used to be" },
  stories: { label: "stories and reading" },
  nurture: { label: "looking after living things" },
};

const r = (source) => new RegExp(`\\b(?:${source})\\b`, "i");

/**
 * Interests the graph recognises. `facets` are ordered by how strongly they explain the interest.
 * `own` are the words that make a product "directly about" the interest (used for novelty).
 * `trait` marks personality words (curious, creative) rather than topics.
 */
export const INTERESTS = [
  { id: "trains", label: "trains", re: r("trains?|railways?|steam engines?|locomotives?|thomas the tank"), facets: ["movement", "mechanics", "construction", "journeys", "imaginative", "collecting"], own: "train railway locomotive rail track" },
  { id: "vehicles", label: "cars and vehicles", re: r("cars?|vehicles?|trucks?|diggers?|tractors?|lorr(?:y|ies)|buses|fire engines?"), facets: ["movement", "mechanics", "construction", "imaginative"], own: "car vehicle truck digger tractor lorry bus" },
  { id: "planes", label: "planes and flying", re: r("planes?|aeroplanes?|aircraft|aviation|flying|pilots?"), facets: ["movement", "mechanics", "journeys", "science"], own: "plane aeroplane aircraft aviation flight" },
  { id: "boats", label: "boats and the sea", re: r("boats?|ships?|sailing|pirates?"), facets: ["movement", "journeys", "exploration", "imaginative"], own: "boat ship sailing pirate" },
  { id: "building", label: "building things", re: r("lego|building(?: things| blocks)?|construction|making things|builds? things|engineering|meccano"), facets: ["construction", "mechanics", "imaginative", "crafting"], own: "lego building construction brick block" },
  { id: "space", label: "space", re: r("space|planets?|astronom\\w*|stars|rockets?|astronauts?|the moon"), facets: ["space", "science", "exploration", "imaginative"], own: "space planet astronomy star rocket astronaut moon" },
  { id: "dinosaurs", label: "dinosaurs", re: r("dinosaurs?|dinos?|fossils?|t-?rex"), facets: ["creatures", "history", "exploration", "science", "collecting"], own: "dinosaur dino fossil" },
  { id: "animals", label: "animals", re: r("animals?|wildlife|zoos?|horses?|ponies|pony|cats?|dogs?|puppies|kittens?"), facets: ["creatures", "nature", "nurture"], own: "animal wildlife zoo horse pony cat dog" },
  { id: "bugs", label: "bugs and minibeasts", re: r("bugs?|insects?|minibeasts?|creepy crawlies|butterfl(?:y|ies)|spiders?"), facets: ["creatures", "nature", "science", "exploration"], own: "bug insect minibeast butterfly spider" },
  { id: "nature", label: "nature", re: r("nature|outdoors|the outdoors|outside|forests?|woods|walking|hiking|birds?|birdwatching"), facets: ["nature", "exploration", "active", "creatures"], own: "nature outdoor forest wood walking hiking bird" },
  { id: "gardening", label: "gardening", re: r("garden(?:ing|er)?|plants?|growing things|allotments?|houseplants?"), facets: ["nurture", "nature", "crafting", "cosy"], own: "garden gardening plant allotment houseplant" },
  { id: "science", label: "science", re: r("science|experiments?|chemistry|physics|biology|stem"), facets: ["science", "mechanics", "exploration"], own: "science experiment chemistry physics biology" },
  { id: "drawing", label: "drawing and art", re: r("drawing|draws?|art|painting|paints?|sketch(?:ing)?|colouring|artist"), facets: ["art", "crafting", "design", "imaginative"], own: "drawing art painting paint sketch colouring" },
  { id: "crafts", label: "crafts", re: r("crafts?|crafting|crafty|knitting|crochet|sewing|making stuff"), facets: ["crafting", "art", "design", "cosy"], own: "craft knitting crochet sewing" },
  { id: "music", label: "music", re: r("music|singing|sings?|guitar|piano|drums?|instruments?|bands?|vinyl|records"), facets: ["music", "performance", "collecting"], own: "music guitar piano drum instrument vinyl record" },
  { id: "dancing", label: "dancing and performing", re: r("danc(?:e|ing|er)|ballet|acting|drama|theatre|performing|showing off"), facets: ["performance", "music", "active", "imaginative"], own: "dance ballet drama theatre" },
  { id: "football", label: "football", re: r("football|soccer"), facets: ["active", "competition", "collecting"], own: "football soccer" },
  { id: "sport", label: "sport", re: r("sports?|rugby|cricket|tennis|running|runner|athletics|gym|fitness|swimming|cycling|climbing"), facets: ["active", "competition"], own: "sport rugby cricket tennis running gym fitness swimming cycling climbing" },
  { id: "gaming", label: "video games", re: r("gaming|gamer|video games?|minecraft|fortnite|nintendo|playstation|xbox|roblox"), facets: ["tech", "competition", "strategy", "imaginative"], own: "gaming game video console minecraft" },
  { id: "board-games", label: "board games and puzzles", re: r("board games?|card games?|puzzles?|jigsaws?|chess|riddles?|brain teasers?"), facets: ["strategy", "competition", "hosting"], own: "board game puzzle jigsaw chess" },
  { id: "reading", label: "reading", re: r("reading|reads|books?|bookworm|stories|novels?"), facets: ["stories", "cosy", "imaginative"], own: "book reading story novel" },
  { id: "writing", label: "writing", re: r("writing|writes|journal(?:ling)?|poetry"), facets: ["stories", "crafting", "organising"], own: "writing journal poetry" },
  { id: "pretend", label: "pretend play", re: r("pretend play|role ?play|dressing up|dress-?up|make[- ]believe|superheroes?|princess(?:es)?|fairies|fairy"), facets: ["imaginative", "performance", "stories"], own: "pretend dress costume superhero princess fairy" },
  { id: "cooking", label: "cooking", re: r("cook(?:ing|s)?|chef|kitchen"), facets: ["cooking", "hosting", "crafting"], own: "cook cooking chef kitchen" },
  { id: "baking", label: "baking", re: r("bak(?:e|es|ing|er)|cakes?|bread"), facets: ["cooking", "crafting", "hosting"], own: "baking bake cake bread" },
  { id: "coffee", label: "coffee", re: r("coffee|espresso|barista"), facets: ["cooking", "cosy", "design"], own: "coffee espresso" },
  { id: "tea", label: "tea", re: r("tea|teas"), facets: ["cosy", "cooking"], own: "tea" },
  { id: "travel", label: "travel", re: r("travel(?:ling|ler|s)?|holidays?|backpacking|adventures?|exploring the world"), facets: ["journeys", "exploration", "organising"], own: "travel holiday backpack" },
  { id: "maps", label: "maps and geography", re: r("maps?|geography|flags|countries|atlas"), facets: ["journeys", "exploration", "collecting"], own: "map geography atlas flag" },
  { id: "camping", label: "camping", re: r("camping|camp|wild camping|tents?"), facets: ["nature", "exploration", "active"], own: "camping camp tent" },
  { id: "fishing", label: "fishing", re: r("fishing|angling|angler"), facets: ["nature", "cosy", "active"], own: "fishing angling" },
  { id: "photography", label: "photography", re: r("photograph(?:y|er)|photos?|cameras?"), facets: ["art", "tech", "exploration"], own: "photography photo camera" },
  { id: "tech", label: "technology", re: r("tech|technology|gadgets?|computers?|coding|programming|robots?|electronics"), facets: ["tech", "mechanics", "science"], own: "tech technology gadget computer coding robot electronics" },
  { id: "history", label: "history", re: r("history|historical|castles?|knights?|romans?|vikings?|egypt(?:ians?)?|ww2|world war"), facets: ["history", "stories", "exploration"], own: "history castle knight roman viking egyptian" },
  { id: "film", label: "films and TV", re: r("films?|movies?|cinema|tv|television|box sets?|star wars|marvel|harry potter"), facets: ["stories", "cosy", "collecting"], own: "film movie cinema tv" },
  { id: "diy", label: "DIY", re: r("diy|woodwork(?:ing)?|tools|fixing things|tinkering|tinker"), facets: ["mechanics", "construction", "crafting"], own: "diy woodwork tool" },
  { id: "cars-adult", label: "cars and motoring", re: r("motor ?bikes?|motorcycles?|classic cars?|motorsport|formula (?:one|1)|f1"), facets: ["movement", "mechanics", "competition", "design"], own: "motorbike motorcycle car motorsport f1" },
  { id: "interiors", label: "interiors and design", re: r("interiors?|home decor|design|architecture|homeware"), facets: ["design", "cosy", "organising"], own: "interior decor design architecture" },
  { id: "hosting", label: "hosting", re: r("hosting|entertaining|dinner parties|parties|having people over"), facets: ["hosting", "cooking", "design"], own: "hosting entertaining party" },
  { id: "wellbeing", label: "relaxing", re: r("relax(?:ing|ation)?|yoga|meditation|mindful(?:ness)?|self[- ]care|unwind(?:ing)?"), facets: ["cosy", "active"], own: "relax yoga meditation mindfulness" },
  { id: "organising", label: "being organised", re: r("organi[sz]ed|organi[sz]ing|planners?|tidy|lists|stationery"), facets: ["organising", "design"], own: "organiser planner stationery" },
  { id: "magic", label: "magic tricks", re: r("magic(?: tricks)?|magicians?|tricks"), facets: ["performance", "mechanics", "imaginative"], own: "magic trick magician" },
  { id: "trait-curious", label: "curiosity", trait: true, re: r("curious|inquisitive|asks? (?:lots of |loads of )?questions|always asking (?:why|how)|loves? learning|wants to know how"), facets: ["science", "exploration", "mechanics"], own: "" },
  { id: "trait-imaginative", label: "imagination", trait: true, re: r("imaginative|imagination|creative|dreamy|makes up stories|inventive"), facets: ["imaginative", "art", "stories", "crafting"], own: "" },
  { id: "trait-active", label: "energy", trait: true, re: r("energetic|active|sporty|never sits still|full of beans|outdoorsy|on the go"), facets: ["active", "competition", "nature"], own: "" },
  { id: "trait-practical", label: "practicality", trait: true, re: r("practical|hands-?on|handy|likes useful things|loves gadgets that work"), facets: ["mechanics", "organising", "construction"], own: "" },
  { id: "trait-sociable", label: "sociability", trait: true, re: r("sociable|social|outgoing|life and soul|loves company|loves people"), facets: ["hosting", "competition", "performance"], own: "" },
  { id: "trait-quiet", label: "a quieter nature", trait: true, re: r("quiet|shy|introvert(?:ed)?|homebody|bookish|calm"), facets: ["cosy", "stories", "crafting"], own: "" },
  { id: "trait-competitive", label: "a competitive streak", trait: true, re: r("competitive|loves winning|hates losing"), facets: ["competition", "strategy", "active"], own: "" },
  { id: "trait-clever", label: "a sharp mind", trait: true, re: r("clever|bright|smart|brainy|logical|loves a challenge"), facets: ["strategy", "science", "mechanics"], own: "" },
  { id: "trait-arty", label: "an artistic eye", trait: true, re: r("arty|artistic|stylish|good eye"), facets: ["art", "design", "crafting"], own: "" },
  { id: "trait-nostalgic", label: "nostalgia", trait: true, re: r("nostalgic|retro|vintage|old-?fashioned|old school"), facets: ["history", "design", "collecting"], own: "" },
  { id: "trait-nurturing", label: "a caring nature", trait: true, re: r("caring|kind|nurturing|loves looking after"), facets: ["nurture", "creatures", "cosy"], own: "" },
].map((it) => ({ ...it, ownStems: new Set(contentStems(it.own)) }));

const BY_ID = new Map(INTERESTS.map((it) => [it.id, it]));
export const interestById = (id) => BY_ID.get(id) || null;

const LEAD_FILLER = /^(?:i|he|she|they|we|it|is|are|was|were|be|he's|she's|they're|and|but|so|also|the|a|an|who|that|really|just)$/i;
const NEGATION_BEFORE = /\b(?:not|no|never|isn'?t|doesn'?t|don'?t|hates?|dislikes?|can'?t stand|avoid|not keen on|not into|not a fan of)\s+(?:\w+\s+){0,2}$/i;
const OWNED_BEFORE = /\b(?:already (?:has|have|owns?|got)|has (?:loads|lots|plenty) of|owns?)\s+(?:\w+\s+){0,3}$/i;
const STRONG_BEFORE = /\b(?:obsessed with|loves?|adores?|mad (?:about|on)|crazy about|passionate about|really into|big fan of|fanatic|addicted to|lives for)\s+(?:\w+\s+){0,2}$/i;

/**
 * Detects interests and traits, keeping a short verbatim anchor for each so any explanation can
 * quote what the shopper actually wrote. Negated mentions ("not into football") are skipped.
 * Owned mentions ("already has loads of train sets") still signal an interest, at lower strength.
 */
export function detectInterests(text) {
  const source = String(text || "");
  const found = [];
  for (const it of INTERESTS) {
    const re = new RegExp(it.re.source, "gi");
    let best = null;
    for (const m of source.matchAll(re)) {
      const before = source.slice(Math.max(0, m.index - 40), m.index);
      if (NEGATION_BEFORE.test(before)) continue;
      const owned = OWNED_BEFORE.test(before);
      const strength = owned ? 0.5 : STRONG_BEFORE.test(before) ? 1 : it.trait ? 0.6 : 0.85;
      if (!best || strength > best.strength) {
        const leadWords = before.split(/[.,;!?]/).pop().trim().split(/\s+/).filter(Boolean).slice(-3);
        // "is 7 and loves dinosaurs" -> "loves dinosaurs": start after the last joining word or number.
        const cut = leadWords.findLastIndex((w) => /^(?:and|but|who|that|\d+|years?|old)$/i.test(w));
        if (cut >= 0) leadWords.splice(0, cut + 1);
        while (leadWords.length && LEAD_FILLER.test(leadWords[0])) leadWords.shift();
        const lead = leadWords.join(" ");
        const evidence = `${lead ? `${lead} ` : ""}${m[0]}`.slice(-60).trim();
        best = { id: it.id, label: it.label, trait: Boolean(it.trait), strength, owned, evidence, position: m.index };
      }
    }
    if (best) found.push(best);
  }
  // Drop a broad interest when a more specific one covers the same words (e.g. "cars" inside "classic cars").
  const filtered = found.filter((f) => !(f.id === "vehicles" && found.some((g) => g.id === "cars-adult")));
  return filtered.sort((a, b) => b.strength - a.strength || a.position - b.position);
}

/** Aggregates the motivations behind the detected interests into weighted facets. */
export function facetWeights(interests) {
  const acc = new Map();
  for (const found of interests) {
    const it = interestById(found.id);
    if (!it) continue;
    it.facets.forEach((facet, rank) => {
      const w = found.strength * (1 - rank * 0.08);
      const prev = acc.get(facet) || { id: facet, label: FACETS[facet].label, weight: 0, from: [] };
      prev.weight += w;
      if (!prev.from.includes(found.id)) prev.from.push(found.id);
      acc.set(facet, prev);
    });
  }
  return [...acc.values()].sort((a, b) => b.weight - a.weight);
}

export function describeFacets(weights, limit = 5) {
  return weights.slice(0, limit).map((f) => f.label);
}

/* ---------- curated adjacent concepts ---------- */

// t title, q search query, c category, a audiences (k 4-12, t 13-17, a adults), max typical GBP,
// f facets served, w neutral explanation of the concept itself, i interests it is literally about.
const RAW_CONCEPTS = [
  // movement / mechanics / construction
  { t: "Marble run construction set", q: "marble run construction set", c: "Games & toys", a: "k", max: 40, f: ["movement", "construction", "mechanics"], w: "A marble run is about building a route and watching it move: part engineering, part chain reaction." },
  { t: "Roller coaster building kit", q: "roller coaster building kit", c: "Games & toys", a: "kt", max: 45, f: ["movement", "construction", "mechanics"], w: "Building a working roller coaster turns an interest in moving machines into a design challenge." },
  { t: "Interlocking gears building set", q: "gears building set kids", c: "Games & toys", a: "k", max: 30, f: ["mechanics", "construction", "movement"], w: "A gears set shows how turning one piece drives another, which is the heart of every engine and machine." },
  { t: "Take-apart toy truck with drill", q: "take apart toy truck drill", c: "Games & toys", a: "k", max: 25, f: ["mechanics", "construction", "movement"], i: ["vehicles"], w: "A take-apart truck is assembled and unscrewed with a toy drill, so building and moving come together." },
  { t: "Wooden ball run with ramps", q: "wooden ball run ramps", c: "Games & toys", a: "k", max: 35, f: ["movement", "construction"], w: "A wooden ball run can be rebuilt in new layouts, rewarding experimenting with slopes and speed." },
  { t: "Gravity maze logic game", q: "gravity maze logic game", c: "Games & toys", a: "kt", max: 30, f: ["strategy", "movement", "construction"], w: "Gravity maze puzzles ask the player to build a working path before testing it, mixing logic with motion." },
  { t: "Wind-up car building kit", q: "wind up car building kit", c: "Hobbies & crafts", a: "kt", max: 25, f: ["mechanics", "construction", "movement"], i: ["vehicles"], w: "A wind-up car kit means building the mechanism, then watching it go under its own power." },
  { t: "Wooden mechanical model kit", q: "wooden mechanical model kit", c: "Hobbies & crafts", a: "ta", max: 45, f: ["mechanics", "construction", "design"], w: "Wooden mechanical models are built gear by gear and actually move once finished." },
  { t: "Kinetic desk sculpture", q: "kinetic desk sculpture", c: "Home", a: "ta", max: 40, f: ["movement", "design", "mechanics"], w: "A kinetic sculpture keeps moving on a desk or shelf, satisfying for anyone who likes watching mechanisms." },
  { t: "Large foam building blocks", q: "large foam building blocks", c: "Games & toys", a: "k", max: 35, f: ["construction", "imaginative", "active"], w: "Big soft blocks let children build things they can actually climb into or knock down." },
  { t: "Magnetic tile construction set", q: "magnetic tiles building set", c: "Games & toys", a: "k", max: 45, f: ["construction", "design", "imaginative"], w: "Magnetic tiles snap together into towers, tunnels and garages, so building is quick and satisfying." },
  { t: "Construction site play mat with ramps", q: "construction play mat ramps", c: "Games & toys", a: "k", max: 25, f: ["construction", "imaginative", "movement"], i: ["vehicles"], w: "A construction site mat gives toy vehicles somewhere to work, with roads and ramps to build stories around." },
  { t: "Remote control construction digger", q: "remote control digger toy", c: "Games & toys", a: "k", max: 40, f: ["movement", "mechanics", "construction"], i: ["vehicles"], w: "A remote control digger can actually scoop and move, putting the child in charge of the machine." },
  { t: "Build-your-own crane kit", q: "build your own crane kit", c: "Games & toys", a: "kt", max: 35, f: ["construction", "mechanics", "movement"], w: "Building a working crane shows how pulleys and levers lift things, then it becomes a toy." },
  { t: "Paper aeroplane making kit", q: "paper aeroplane making kit", c: "Hobbies & crafts", a: "kt", max: 15, f: ["movement", "crafting", "science"], i: ["planes"], w: "Folding and testing paper aeroplanes is a quick experiment in what makes things fly." },
  { t: "Balsa wood glider kit", q: "balsa wood glider kit", c: "Hobbies & crafts", a: "kta", max: 20, f: ["movement", "crafting", "science"], i: ["planes"], w: "A balsa glider is built by hand and then flown outdoors, turning making into an afternoon out." },

  // journeys / exploration
  { t: "Giant floor map of the world", q: "giant floor map world kids", c: "Games & toys", a: "k", max: 30, f: ["journeys", "exploration", "imaginative"], i: ["maps"], w: "A floor map big enough to sit on turns places and routes into something to explore and play on." },
  { t: "Illustrated children's atlas", q: "illustrated children atlas", c: "Books", a: "k", max: 20, f: ["journeys", "exploration", "stories"], i: ["maps"], w: "An illustrated atlas is full of routes, places and pictures to pore over and ask questions about." },
  { t: "Town road play mat", q: "town road play mat", c: "Games & toys", a: "k", max: 25, f: ["journeys", "imaginative", "movement"], w: "A road play mat gives every toy vehicle a town to travel around and stories to act out." },
  { t: "Toy ticket machine and conductor set", q: "toy ticket machine role play", c: "Games & toys", a: "k", max: 25, f: ["imaginative", "journeys", "performance"], w: "A toy ticket machine invites role play as the conductor, driver or station master." },
  { t: "Explorer kit with compass and binoculars", q: "kids explorer kit binoculars compass", c: "Outdoors & sport", a: "k", max: 25, f: ["exploration", "nature", "journeys"], w: "An explorer kit turns a walk to the park into an expedition with a mission." },
  { t: "Children's binoculars", q: "kids binoculars", c: "Outdoors & sport", a: "k", max: 25, f: ["exploration", "nature", "creatures"], w: "Binoculars make birds, boats and faraway things suddenly close, which suits a curious explorer." },
  { t: "Scratch-off world map poster", q: "scratch off world map poster", c: "Home", a: "ta", max: 25, f: ["journeys", "collecting", "design"], i: ["maps", "travel"], w: "A scratch-off map records places visited and becomes a growing wall-sized record of trips." },
  { t: "Travel journal for trips", q: "travel journal notebook", c: "Stationery", a: "ta", max: 20, f: ["journeys", "stories", "organising"], i: ["travel"], w: "A travel journal gives a home to tickets, notes and memories from each trip." },
  { t: "Globe with illuminated map", q: "illuminated globe", c: "Home", a: "kta", max: 45, f: ["journeys", "exploration", "design"], w: "A light-up globe is both a lamp and a way to find places mentioned in stories and news." },
  { t: "Vintage-style railway poster print", q: "vintage railway poster print", c: "Home", a: "ta", max: 30, f: ["journeys", "history", "design"], i: ["trains"], w: "Classic railway poster art celebrates journeys and places with bold mid-century design." },
  { t: "Railway journeys book", q: "great railway journeys book", c: "Books", a: "ta", max: 25, f: ["journeys", "history", "stories"], i: ["trains"], w: "A book of great railway routes mixes travel, engineering history and armchair exploring." },
  { t: "Transport picture encyclopedia", q: "transport encyclopedia kids", c: "Books", a: "k", max: 20, f: ["mechanics", "movement", "exploration"], w: "A transport encyclopedia explains how trains, planes, ships and diggers work, with cutaway pictures to study." },
  { t: "How things work book for children", q: "how things work book kids", c: "Books", a: "k", max: 20, f: ["mechanics", "science", "exploration"], w: "A how-things-work book answers the endless 'but how does it go?' questions with clear diagrams." },

  // imaginative / performance / stories
  { t: "Puppet theatre with hand puppets", q: "puppet theatre hand puppets", c: "Games & toys", a: "k", max: 40, f: ["imaginative", "performance", "stories"], w: "A puppet theatre gives a child a stage to invent and perform their own stories." },
  { t: "Story-building picture cards", q: "story telling picture cards kids", c: "Games & toys", a: "k", max: 15, f: ["imaginative", "stories"], w: "Story cards prompt new adventures each time, a good outlet for an inventive mind." },
  { t: "Dressing-up costume chest", q: "kids dressing up costume set", c: "Games & toys", a: "k", max: 35, f: ["imaginative", "performance"], i: ["pretend"], w: "A box of costumes turns any afternoon into a new character and a new story." },
  { t: "Play tent or den kit", q: "kids play tent den kit", c: "Games & toys", a: "k", max: 40, f: ["imaginative", "cosy", "construction"], w: "A den kit can be built and rebuilt as a hideout, a camp or a station waiting room." },
  { t: "Personalised storybook", q: "personalised childrens storybook", c: "Books", a: "k", max: 30, f: ["stories", "imaginative"], w: "A personalised storybook puts the child into the adventure as the main character." },
  { t: "Kids' magic tricks set", q: "kids magic tricks set", c: "Games & toys", a: "kt", max: 25, f: ["performance", "mechanics", "imaginative"], i: ["magic"], w: "A magic set teaches tricks to rehearse and perform, combining practice with showing off." },
  { t: "Audio story player for children", q: "children audio story player", c: "Tech", a: "k", max: 60, f: ["stories", "cosy", "imaginative"], w: "An audio story player lets a child choose and replay stories independently." },
  { t: "Graphic novel starter set", q: "graphic novel box set", c: "Books", a: "kt", max: 30, f: ["stories", "art", "imaginative"], w: "Graphic novels mix pictures and story, often drawing in readers who resist long text." },

  // science / space / tech
  { t: "Children's microscope kit", q: "kids microscope kit", c: "Hobbies & crafts", a: "kt", max: 40, f: ["science", "exploration", "nature"], w: "A microscope reveals the hidden detail in leaves, salt and hair, feeding a curious mind." },
  { t: "Snap-together circuit kit", q: "snap circuit kit kids", c: "Hobbies & crafts", a: "kt", max: 45, f: ["science", "mechanics", "tech", "construction"], w: "Snap-together circuits show how switches, lights and motors work without any soldering." },
  { t: "Planetarium star projector torch", q: "planetarium projector torch", c: "Games & toys", a: "k", max: 20, f: ["space", "science", "cosy"], w: "A planetarium torch throws stars and planets onto the ceiling for bedtime exploring." },
  { t: "Beginner's telescope", q: "beginner telescope", c: "Outdoors & sport", a: "kta", max: 100, f: ["space", "science", "exploration"], w: "A beginner's telescope makes the moon's craters and Saturn's rings something to see first-hand." },
  { t: "Solar system model kit", q: "solar system model kit", c: "Hobbies & crafts", a: "k", max: 25, f: ["space", "science", "crafting"], w: "Building and painting a solar system model makes the planets' order and size easy to grasp." },
  { t: "Kitchen science experiment kit", q: "kids science experiment kit", c: "Hobbies & crafts", a: "k", max: 30, f: ["science", "exploration"], w: "A science kit turns 'what happens if...' into safe, guided experiments at the kitchen table." },
  { t: "Crystal growing kit", q: "crystal growing kit", c: "Hobbies & crafts", a: "kt", max: 25, f: ["science", "collecting", "nature"], w: "Growing crystals takes a few days of watching, which rewards patience and curiosity." },
  { t: "Coding robot for beginners", q: "coding robot beginners", c: "Tech", a: "kt", max: 60, f: ["tech", "science", "strategy"], w: "A coding robot turns programming into giving instructions to something that moves." },
  { t: "Solar-powered robot kit", q: "solar powered robot kit", c: "Hobbies & crafts", a: "kt", max: 25, f: ["tech", "construction", "science"], w: "A solar robot kit is built from parts and then powered by sunlight, combining construction with science." },
  { t: "Night sky guidebook", q: "night sky guide book", c: "Books", a: "ta", max: 20, f: ["space", "nature", "exploration"], w: "A night sky guide helps identify constellations and planets from a back garden." },
  { t: "Weather station for kids", q: "kids weather station kit", c: "Hobbies & crafts", a: "k", max: 30, f: ["science", "nature", "exploration"], w: "A weather station lets a child measure wind, rain and temperature and spot patterns." },

  // nature / creatures / nurture
  { t: "Bug hunting kit with viewer", q: "bug hunting kit viewer", c: "Outdoors & sport", a: "k", max: 20, f: ["creatures", "nature", "exploration", "science"], w: "A bug kit with a magnifying viewer makes garden minibeasts something to study up close." },
  { t: "Bird feeder with window mount", q: "window bird feeder", c: "Outdoors & sport", a: "kta", max: 25, f: ["creatures", "nature", "nurture"], w: "A window bird feeder brings visiting birds close enough to watch and identify." },
  { t: "Grow-your-own garden kit", q: "kids grow your own kit", c: "Hobbies & crafts", a: "k", max: 20, f: ["nurture", "nature", "science"], w: "A growing kit lets a child plant, water and watch something change week by week." },
  { t: "Terrarium building kit", q: "terrarium kit", c: "Hobbies & crafts", a: "ta", max: 40, f: ["nurture", "nature", "design", "crafting"], w: "Building a terrarium creates a small living landscape that needs little looking after." },
  { t: "Bug hotel kit", q: "bug hotel kit", c: "Outdoors & sport", a: "kta", max: 25, f: ["creatures", "nature", "construction"], w: "A bug hotel is built by hand and then becomes home to garden wildlife." },
  { t: "Animal tracks and signs field guide", q: "animal tracks field guide", c: "Books", a: "kta", max: 15, f: ["creatures", "nature", "exploration"], w: "A tracks guide turns muddy footprints and nibbled cones into clues to follow." },
  { t: "Wildlife camera for the garden", q: "garden wildlife camera", c: "Tech", a: "ta", max: 70, f: ["creatures", "nature", "tech"], w: "A wildlife camera shows what visits the garden at night, without disturbing it." },
  { t: "Fossil and dinosaur skeleton model kit", q: "dinosaur skeleton model kit", c: "Hobbies & crafts", a: "k", max: 25, f: ["creatures", "history", "construction"], i: ["dinosaurs"], w: "Assembling a dinosaur skeleton model mixes building with learning how these animals fitted together." },
  { t: "Wildflower seed growing set", q: "wildflower seed kit", c: "Outdoors & sport", a: "ta", max: 20, f: ["nature", "nurture", "creatures"], w: "Wildflower seeds grow into a patch that attracts bees and butterflies through the summer." },

  // art / crafting / design
  { t: "Spirograph design set", q: "spirograph design set", c: "Hobbies & crafts", a: "kt", max: 20, f: ["art", "mechanics", "design"], w: "A Spirograph-style set creates intricate patterns from turning gears, mixing drawing with mechanics." },
  { t: "Learn-to-draw book with sketch pad", q: "learn to draw book kids", c: "Books", a: "kt", max: 15, f: ["art", "crafting"], w: "A step-by-step drawing book builds confidence by turning simple shapes into pictures." },
  { t: "Paint-your-own wooden vehicles set", q: "paint your own wooden vehicles", c: "Hobbies & crafts", a: "k", max: 20, f: ["art", "crafting", "movement"], i: ["vehicles"], w: "Painting wooden vehicles makes a toy that the child designed and finished themselves." },
  { t: "Air-dry clay modelling kit", q: "air dry clay kit", c: "Hobbies & crafts", a: "kta", max: 25, f: ["crafting", "art", "imaginative"], w: "Air-dry clay lets ideas become small sculptures without needing a kiln." },
  { t: "Cardboard construction toolkit", q: "cardboard construction kit kids", c: "Hobbies & crafts", a: "k", max: 25, f: ["construction", "crafting", "imaginative"], w: "Child-friendly cardboard tools turn delivery boxes into stations, tunnels and vehicles." },
  { t: "Watercolour painting starter set", q: "watercolour paint set beginners", c: "Hobbies & crafts", a: "ta", max: 30, f: ["art", "cosy", "crafting"], w: "A watercolour starter set is a calm, portable way to start painting." },
  { t: "Embroidery starter kit", q: "embroidery kit beginners", c: "Hobbies & crafts", a: "ta", max: 25, f: ["crafting", "art", "cosy"], w: "An embroidery kit is a slow, satisfying craft with a finished piece to keep." },
  { t: "Lino printing starter kit", q: "lino printing kit", c: "Hobbies & crafts", a: "ta", max: 35, f: ["art", "crafting", "design"], w: "Lino printing turns one carved design into many prints, cards or posters." },
  { t: "Instant print camera", q: "instant print camera", c: "Tech", a: "ta", max: 90, f: ["art", "tech", "hosting"], w: "An instant camera prints photos on the spot, perfect for capturing moments with friends." },
  { t: "Label maker", q: "handheld label maker", c: "Stationery", a: "ta", max: 30, f: ["organising", "design", "tech"], w: "A label maker brings tidy order to drawers, cables and jars." },
  { t: "Desk organiser with drawers", q: "desk organiser drawers", c: "Stationery", a: "ta", max: 30, f: ["organising", "design"], w: "A good desk organiser gives everything a place and keeps the workspace calm." },

  // music / performance
  { t: "Kalimba thumb piano", q: "kalimba thumb piano", c: "Music & film", a: "kta", max: 30, f: ["music", "cosy", "crafting"], w: "A kalimba is easy to pick up and sounds lovely almost immediately." },
  { t: "Children's percussion set", q: "kids percussion instrument set", c: "Music & film", a: "k", max: 30, f: ["music", "performance", "active"], w: "A percussion set lets a child make music straight away and play along to songs." },
  { t: "Karaoke microphone with speaker", q: "karaoke microphone speaker", c: "Music & film", a: "kt", max: 30, f: ["performance", "music", "hosting"], w: "A karaoke microphone turns the living room into a stage." },
  { t: "Ukulele starter pack", q: "ukulele starter pack", c: "Music & film", a: "kta", max: 50, f: ["music", "performance"], w: "A ukulele is a friendly first instrument with simple chords and a cheerful sound." },
  { t: "Record display shelf", q: "vinyl record display shelf", c: "Home", a: "ta", max: 30, f: ["music", "collecting", "design"], i: ["music"], w: "A record display shelf shows off a favourite album cover like artwork." },

  // strategy / competition / hosting
  { t: "Cooperative family board game", q: "cooperative family board game", c: "Games & toys", a: "kta", max: 30, f: ["strategy", "hosting"], w: "In a cooperative game everyone wins or loses together, which keeps family games friendly." },
  { t: "Train route-building board game", q: "train route board game", c: "Games & toys", a: "kta", max: 45, f: ["journeys", "strategy", "collecting"], i: ["trains"], w: "A route-building board game is about planning railway lines across a map, a natural fit for journey planners." },
  { t: "Logic puzzle game for one player", q: "single player logic puzzle game", c: "Games & toys", a: "kta", max: 25, f: ["strategy", "competition"], w: "Single-player logic puzzles have levels that get steadily harder, good for a problem solver." },
  { t: "Wooden puzzle box", q: "wooden puzzle box", c: "Games & toys", a: "ta", max: 30, f: ["strategy", "mechanics", "design"], w: "A puzzle box hides its opening mechanism, so solving it is the gift." },
  { t: "Chess set with learn-to-play guide", q: "chess set beginners guide", c: "Games & toys", a: "kta", max: 30, f: ["strategy", "competition"], w: "A chess set with a beginner's guide is a game that can grow with the player for years." },
  { t: "Party quiz game", q: "party quiz game", c: "Games & toys", a: "ta", max: 25, f: ["hosting", "competition"], w: "A quiz game is an easy way to get a group playing together." },
  { t: "Table football game", q: "table football game", c: "Games & toys", a: "kt", max: 60, f: ["competition", "active", "hosting"], i: ["football"], w: "Tabletop football brings fast, competitive matches indoors." },
  { t: "Mini indoor basketball hoop", q: "over door basketball hoop", c: "Outdoors & sport", a: "kt", max: 25, f: ["active", "competition"], w: "An over-the-door hoop gives energy somewhere to go on rainy days." },
  { t: "Garden obstacle course set", q: "kids garden obstacle course", c: "Outdoors & sport", a: "k", max: 40, f: ["active", "competition", "construction"], w: "An obstacle course can be set up in new layouts, rewarding speed and invention." },
  { t: "Stunt kite", q: "stunt kite", c: "Outdoors & sport", a: "kta", max: 30, f: ["active", "movement", "nature"], w: "A kite gets everyone outside on a windy day, and learning to steer it is half the fun." },

  // cooking / cosy / design / history
  { t: "Children's baking set with real tools", q: "kids baking set real tools", c: "Kitchen", a: "k", max: 25, f: ["cooking", "crafting"], w: "Child-sized baking tools make them a proper helper in the kitchen." },
  { t: "Bread-making starter kit", q: "bread making kit", c: "Kitchen", a: "ta", max: 40, f: ["cooking", "crafting"], w: "A bread-making kit gathers the tools for a slow, rewarding weekend bake." },
  { t: "Pasta-making set", q: "pasta making set", c: "Kitchen", a: "ta", max: 40, f: ["cooking", "hosting", "crafting"], w: "Making fresh pasta is a hands-on project that ends with dinner to share." },
  { t: "Hand-crank coffee grinder", q: "manual coffee grinder", c: "Kitchen", a: "a", max: 40, f: ["cooking", "mechanics", "cosy"], i: ["coffee"], w: "A hand grinder makes the coffee ritual slower and more hands-on." },
  { t: "Loose-leaf teapot with infuser", q: "glass teapot infuser", c: "Kitchen", a: "ta", max: 30, f: ["cosy", "design"], i: ["tea"], w: "A glass infuser teapot makes brewing a calm little ritual to watch." },
  { t: "Clip-on reading light", q: "clip on reading light", c: "Home", a: "kta", max: 20, f: ["stories", "cosy"], w: "A clip-on reading light makes reading in bed or a favourite chair easier." },
  { t: "Book lover's reading journal", q: "reading journal book log", c: "Stationery", a: "ta", max: 15, f: ["stories", "organising", "collecting"], i: ["reading"], w: "A reading journal records every book finished, with space for thoughts and favourite lines." },
  { t: "Surprise wrapped mystery book", q: "surprise mystery book", c: "Books", a: "ta", max: 20, f: ["stories", "exploration"], i: ["reading"], w: "A wrapped mystery book adds the fun of not knowing what comes next." },
  { t: "Retro mechanical puzzle collection", q: "metal puzzle set", c: "Games & toys", a: "ta", max: 20, f: ["strategy", "mechanics", "history"], w: "Metal disentanglement puzzles are pocket-sized brain teasers with a satisfying solution." },
  { t: "Build-your-own castle model", q: "castle model kit", c: "Hobbies & crafts", a: "k", max: 30, f: ["history", "construction", "imaginative"], w: "Building a castle model mixes construction with knights, sieges and storytelling." },
  { t: "Historical timeline poster", q: "history timeline poster", c: "Home", a: "kt", max: 15, f: ["history", "exploration", "stories"], i: ["history"], w: "A timeline poster puts dinosaurs, Romans and rockets in order on the bedroom wall." },
  { t: "Desk planner and goal journal", q: "undated desk planner", c: "Stationery", a: "ta", max: 20, f: ["organising", "design"], w: "An undated planner works whenever they start it, with space for goals and lists." },
  { t: "Cosy reading nook cushion", q: "reading pillow with arms", c: "Home", a: "ta", max: 30, f: ["cosy", "stories"], w: "A reading pillow with arms makes reading in bed properly comfortable." },
  { t: "Personalised name puzzle", q: "personalised wooden name puzzle", c: "Games & toys", a: "k", max: 25, f: ["imaginative", "construction"], w: "A name puzzle is personal and practical: it is played with and then kept." },
  { t: "Personalised star map print", q: "personalised star map print", c: "Home", a: "ta", max: 40, f: ["space", "design"], w: "A star map shows the night sky over a chosen date and place, quietly personal." },
  { t: "Personalised bookplate stamp", q: "personalised book stamp", c: "Stationery", a: "ta", max: 25, f: ["stories", "design", "collecting"], i: ["reading"], w: "A personalised book stamp marks every book in a library as theirs." },
  { t: "Model railway scenery kit", q: "model railway scenery kit", c: "Hobbies & crafts", a: "ta", max: 40, f: ["crafting", "construction", "collecting"], i: ["trains"], w: "Scenery kits add trees, buildings and landscape, often the most creative part of a layout." },
  { t: "Wooden toy station and signal box", q: "wooden toy train station", c: "Games & toys", a: "k", max: 35, f: ["imaginative", "construction", "journeys"], i: ["trains"], w: "A station and signal box adds stories to a track: arrivals, departures and passengers." },
  { t: "Toy car garage with lift", q: "toy car garage lift", c: "Games & toys", a: "k", max: 40, f: ["imaginative", "mechanics", "movement"], i: ["vehicles"], w: "A toy garage with a working lift adds ramps, repairs and parking to car play." },
  { t: "Build-your-own model aeroplane kit", q: "model aeroplane kit beginners", c: "Hobbies & crafts", a: "kta", max: 30, f: ["construction", "crafting", "movement"], i: ["planes"], w: "A model aeroplane kit is a satisfying build that ends up on display." },
];

export const CONCEPTS = RAW_CONCEPTS.map((c, n) => ({
  id: `g${n + 1}`,
  title: c.t,
  query: c.q,
  category: c.c,
  audiences: c.a,
  maxPrice: c.max,
  facets: c.f,
  interests: c.i || [],
  why: c.w,
  concept: c.t,
  stems: stemSet(`${c.t} ${c.q}`),
}));

/** Audience code for an age in years: k (4-12), t (13-17), a (18+, or age unknown). Under-4s get none. */
export function audienceFor(ageYears) {
  if (ageYears === null || ageYears === undefined) return "a";
  if (ageYears < 4) return "";
  if (ageYears < 13) return "k";
  if (ageYears < 18) return "t";
  return "a";
}

/** True when the title is literally about the interest (shares its own words). */
export function isDirectFor(stems, interestIds) {
  for (const id of interestIds) {
    const it = interestById(id);
    if (!it) continue;
    for (const s of it.ownStems) if (stems.has(s)) return true;
  }
  return false;
}
