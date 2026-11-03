// Generates the static gift-guide pages, 404 page, stylesheet and sitemap into site/.
// Run with: npm run build:pages
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const ORIGIN = "https://christmasidea.co.uk";

// Single source of truth for the affiliate tag: the home page config.
const home = readFileSync(join(SITE, "index.html"), "utf8");
const TAG = (home.match(/AMAZON_TAG:\s*"([^"]*)"/) || [])[1] || "";

const amazon = (q) => {
  const u = new URL("https://www.amazon.co.uk/s");
  u.searchParams.set("k", q);
  if (TAG) u.searchParams.set("tag", TAG);
  return u.toString();
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const GUIDES = [
  {
    slug: "gifts-for-4-year-olds",
    h1: "Gift ideas for 4-year-olds",
    desc: "Safe, screen-free gift ideas for 4-year-olds, from pretend play to chunky puzzles, with tips for choosing quiet or noisy toys.",
    intro: "Four-year-olds are curious, imaginative and increasingly independent. The best gifts give them something to pretend, build, sort or make, rather than something that only does one thing when a button is pressed.",
    tips: [
      "Check the age label on the box. If the child has younger siblings, keep small-part toys well away from them.",
      "If the family prefers a quiet house, look for open-ended play such as dressing up, building and drawing instead of toys with sound effects.",
      "Pick one thing they can do with a grown-up and one they can do alone.",
    ],
    ideas: [
      ["Chunky wooden jigsaw puzzle", "Large pieces suit small hands and build early problem-solving.", "chunky wooden jigsaw puzzle 4 years"],
      ["Dressing-up costume", "Fuels imaginative role play, from firefighter to dragon.", "kids dressing up costume 4-5 years"],
      ["Large building blocks", "Open-ended and quiet; big enough for little hands.", "large building blocks toddler preschool"],
      ["Picture book set", "Short, funny stories to share at bedtime.", "picture books age 4 bundle"],
      ["Play-dough or modelling clay kit", "Squishing and rolling builds finger strength and creativity.", "play dough set kids"],
      ["Kids' watercolour paint set", "Washable paints and a pad let them make their own art.", "kids washable watercolour paint set"],
      ["Balance bike or scooter", "Gets them outside and builds coordination. Check the weight and height guidance.", "kids balance bike 4 year old"],
      ["Simple first board game", "Teaches turn-taking with short, friendly rules.", "first board game preschool 4 years"],
    ],
  },
  {
    slug: "gifts-for-new-babies",
    h1: "Gift ideas for a new baby",
    desc: "Thoughtful newborn and new-baby gift ideas that avoid the risky or unnecessary, from soft books to keepsakes.",
    intro: "A new baby gift should be useful, safe and easy to enjoy straight away. Avoid anything that makes health or sleep claims; parents often have strong preferences there, and safety guidance changes.",
    tips: [
      "Stick to soft, washable things and keepsakes. Leave feeding, medical and sleep-positioning items to the parents.",
      "Newborns outgrow clothes in weeks, so consider the next size up or a larger size than newborn.",
      "Something for the parents, such as a meal voucher or a treat, is often the most appreciated gift.",
    ],
    ideas: [
      ["Soft crinkle cloth book", "High-contrast pages for looking at together.", "soft crinkle cloth baby book high contrast"],
      ["Muslin squares", "Endlessly useful and machine washable.", "muslin cloth squares baby pack"],
      ["Baby keepsake memory box", "A place to keep first-year mementoes.", "baby keepsake memory box"],
      ["Soft rattle", "Light and easy for tiny hands to hold.", "soft fabric baby rattle"],
      ["Baby bath towel with hood", "Cosy after bath time.", "hooded baby bath towel"],
      ["Baby milestone cards", "Fun for photos of each month.", "baby milestone cards"],
      ["Soft comforter toy", "A cuddly companion for the pram or car seat.", "baby comforter soft toy"],
      ["Treat for the new parents", "Good coffee, tea or a cosy blanket for the 3am feeds.", "gift set new parents coffee tea"],
    ],
  },
  {
    slug: "gifts-for-space-lovers",
    h1: "Gift ideas for space lovers",
    desc: "Gift ideas for children and adults fascinated by space: telescopes, star maps, models and books.",
    intro: "Space fans range from eight-year-olds who know every planet to adults who stargaze from the garden. Match the gift to how hands-on they like to be.",
    tips: [
      "For children, a simple kit they can build themselves is often more fun than something fragile.",
      "For adults, a good star chart or binoculars can beat a cheap telescope.",
      "Check recommended ages on kits that include small parts or tools.",
    ],
    ideas: [
      ["Glow-in-the-dark star ceiling stickers", "Turns a bedroom into a night sky.", "glow in the dark star stickers ceiling"],
      ["Beginner telescope", "Look for stable mounts rather than huge magnification claims.", "beginner telescope kids"],
      ["Solar system model kit", "A hands-on build that teaches the planets.", "solar system model kit kids"],
      ["Illustrated book about space", "Full-page pictures and clear explanations.", "illustrated space book children"],
      ["Planisphere or star map", "Helps find constellations on clear nights.", "planisphere star finder"],
      ["Rocket building kit", "Construction and science in one project.", "build your own rocket kit"],
      ["Space-themed jigsaw", "A calm activity for rainy days.", "space jigsaw puzzle"],
      ["Binoculars for stargazing", "Easy for beginners and good for wildlife as well.", "binoculars for stargazing beginners"],
    ],
  },
  {
    slug: "gifts-for-gardeners",
    h1: "Gift ideas for gardeners",
    desc: "Practical and pretty gift ideas for gardeners, from quality hand tools to seeds and plant-care extras.",
    intro: "Keen gardeners usually already own the basics, so the best gifts are quality upgrades, small luxuries or things for the quiet winter months.",
    tips: [
      "Quality hand tools are a safe bet; a favourite trowel is used for years.",
      "Avoid specific plants unless you know their garden and soil.",
      "Seasonal extras such as seed collections and bird feeders suit almost every garden.",
    ],
    ideas: [
      ["Stainless-steel hand trowel and fork", "Strong, rust-resistant and comfortable to hold.", "stainless steel hand trowel fork set"],
      ["Gardening gloves", "Breathable, thorn-resistant pairs get worn out quickly.", "gardening gloves thorn resistant women men"],
      ["Seed collection", "Easy to grow herbs or flowers for next spring.", "gardener seed collection gift"],
      ["Kneeler and seat", "Easier on the knees and back.", "garden kneeler seat"],
      ["Hand cream for working hands", "A small luxury after a day in the soil.", "gardener hand cream"],
      ["Bird feeder", "Brings wildlife to the garden all year.", "garden bird feeder"],
      ["Gardening journal", "For planting plans and notes.", "garden planner journal"],
      ["Pruning snips", "Precise and light for deadheading and herbs.", "garden snips pruning secateurs"],
    ],
  },
  {
    slug: "gifts-for-history-lovers",
    h1: "Gift ideas for history lovers",
    desc: "Gift ideas for history buffs: books, models, maps and experiences that go beyond the usual.",
    intro: "History lovers are often specific about periods and places. Start with the era they love, then pick something to read, build or display.",
    tips: [
      "Check what they already own; keen readers often have the famous titles.",
      "Pick one period rather than a general 'history' gift.",
      "Maps, prints and models make good display gifts.",
    ],
    ideas: [
      ["Narrative history book", "Well-written books on a period they love.", "popular history book bestseller"],
      ["Historical atlas", "Beautiful and endlessly browsable.", "historical atlas world history"],
      ["Roman or medieval model kit", "A hands-on project for a quiet weekend.", "historical model kit"],
      ["History trivia game", "Fun for family evenings.", "history trivia board game"],
      ["Reproduction map print", "Frame it for the study.", "vintage historical map print"],
      ["Museum or heritage membership gift", "A year of visits to castles and houses.", "heritage membership gift"],
      ["Timeline wall chart", "A visual overview they can pin up.", "history timeline wall chart"],
      ["Biography of someone they admire", "A personal choice that shows you paid attention.", "biography historical figure"],
    ],
  },
  {
    slug: "gifts-for-tea-and-coffee-lovers",
    h1: "Gift ideas for tea and coffee lovers",
    desc: "Gift ideas for hot-drink lovers: brewing gear, good mugs and tasting sets, with tips on what not to buy.",
    intro: "Hot-drink lovers are often particular. Gear and accessories are safer than a bag of coffee or tea you have guessed at.",
    tips: [
      "Do you know how they brew? A pour-over fan and a cafetiere fan want different things.",
      "A good mug or travel cup is a low-risk gift.",
      "Avoid flavoured blends unless you know their tastes.",
    ],
    ideas: [
      ["Pour-over coffee set", "Simple, stylish way to brew a better cup.", "pour over coffee dripper set"],
      ["Insulated travel mug", "Keeps drinks hot on the commute or walk.", "insulated travel mug leak proof"],
      ["Tea infuser teapot", "Glass pots show off loose leaf tea.", "glass teapot infuser loose leaf"],
      ["Hand coffee grinder", "Fresh grounds make a big difference.", "manual coffee grinder"],
      ["Handmade ceramic mug", "A pretty everyday luxury.", "handmade ceramic mug"],
      ["Milk frother", "Lattes and hot chocolate at home.", "handheld milk frother"],
      ["Tea tasting set", "A sampler lets them find favourites.", "tea tasting sampler gift set"],
      ["Coffee scoop and storage tin", "Keeps beans fresh and tidy.", "coffee storage canister airtight"],
    ],
  },
  {
    slug: "gifts-for-mum",
    h1: "Gift ideas for mum",
    desc: "Gift ideas for mum that show you listened, from comfort and wellbeing to hobbies and keepsakes.",
    intro: "The best gift for mum reflects something she loves or something she never buys for herself. A thoughtful small gift often beats an expensive generic one.",
    tips: [
      "Think about what she does in her free time and give something that makes it nicer.",
      "A personal touch, like a photo or a handwritten note, matters more than the price.",
      "Skip fragrance unless you know the scents she wears.",
    ],
    ideas: [
      ["Soft throw blanket", "Cosy for the sofa on winter evenings.", "soft throw blanket sofa"],
      ["Photo frame or personalised photo book", "A family memory she can display.", "personalised photo book family"],
      ["Spa-at-home gift set", "Candles, bath salts and a face mask.", "spa gift set bath salts candle"],
      ["Good-quality mug and treats", "A small ritual she will enjoy daily.", "mug tea gift set"],
      ["Book by her favourite author", "A guaranteed pleasure.", "bestselling novel paperback"],
      ["Cookbook for her cuisine", "Inspiration if she loves cooking.", "cookbook easy home cooking"],
      ["Slippers", "Comfortable and practical.", "womens memory foam slippers"],
      ["Jigsaw or craft kit", "A calm hobby for quiet evenings.", "jigsaw puzzle 1000 pieces"],
    ],
  },
  {
    slug: "gifts-for-dad",
    h1: "Gift ideas for dad",
    desc: "Gift ideas for dad beyond socks: practical upgrades, hobby gear and fun extras.",
    intro: "Dads are famously hard to buy for. Pick a hobby he talks about, then give something that makes it easier, tidier or more enjoyable.",
    tips: [
      "Listen for complaints; the thing he grumbles about is a gift opportunity.",
      "Avoid gadgets he has not asked for; they get returned.",
      "Experience gifts and good food are reliable.",
    ],
    ideas: [
      ["Quality multi-tool", "Useful for jobs around the house or garden.", "multi tool pliers stainless"],
      ["Insulated flask", "Keeps tea hot on walks and trips.", "insulated flask 1 litre"],
      ["Biography or history book", "For quiet evenings.", "history book popular non fiction"],
      ["Cordless torch or head torch", "Handy for the car, shed or camping.", "rechargeable head torch"],
      ["Craft beer or whisky tasting glasses", "A good gift if he enjoys a drink.", "whisky tasting glasses gift set"],
      ["Wallet or card holder", "A simple upgrade he will use daily.", "mens leather wallet slim"],
      ["Board game for two", "Something to do together.", "two player board game strategy"],
      ["Bluetooth speaker", "Music in the garage or garden.", "portable bluetooth speaker"],
    ],
  },
  {
    slug: "secret-santa-gifts-under-10",
    h1: "Secret Santa gift ideas under Â£10",
    desc: "Safe, universal Secret Santa gifts that suit almost anyone in the office or friend group, chosen to stay inside a Â£10 limit.",
    intro: "Secret Santa works best when the gift is useful, light-hearted and unlikely to offend. Prices change, so check the listing against your limit before you buy.",
    tips: [
      "Avoid anything very personal, such as clothing or fragrance.",
      "A small treat plus a small useful item usually beats one gimmick.",
      "Ask in the group chat about allergies or dietary needs before buying food.",
    ],
    ideas: [
      ["Funny desk plant or cactus pot", "A cheerful addition to any workspace.", "mini desk plant pot"],
      ["Notebook and nice pen", "Always used in the office.", "notebook pen gift set"],
      ["Mug warmer or tea infuser", "Simple, useful and unobtrusive.", "tea infuser mug lid"],
      ["Card game", "Quick to play with colleagues or family.", "pocket card game party"],
      ["Scented candle", "Pick a neutral scent such as vanilla or sea salt.", "scented candle small gift"],
      ["Socks with a festive pattern", "Fun and low-risk.", "festive novelty socks"],
      ["Puzzle cube or brain teaser", "Small desk-friendly toy.", "puzzle cube brain teaser"],
      ["Reusable coffee cup", "Practical and greener.", "reusable coffee cup lid"],
    ],
  },
  {
    slug: "gifts-for-book-lovers",
    h1: "Gift ideas for book lovers",
    desc: "Gift ideas for readers that go beyond another book, from reading accessories to cosy extras.",
    intro: "Keen readers often have a to-read pile already, so accessories and comforts are sometimes safer than guessing a title.",
    tips: [
      "If you buy a book, check their taste first; a gift receipt helps.",
      "A good reading light or bookmark is something they will use every day.",
      "Audiobook subscriptions are a hit if they commute.",
    ],
    ideas: [
      ["Clip-on reading light", "Lets them read in bed without disturbing anyone.", "clip on book reading light rechargeable"],
      ["Leather or beaded bookmark", "Small, pretty and practical.", "bookmark gift set"],
      ["Book sleeve or cover", "Protects paperbacks in a bag.", "book sleeve padded"],
      ["Reading cushion or lap desk", "Comfortable for long sessions.", "book reading pillow"],
      ["Literary tote bag", "Carries the library haul.", "literary tote bag canvas"],
      ["Bookends", "Neat shelves for a growing collection.", "bookends decorative"],
      ["Cosy blanket and tea set", "The perfect reading-nook gift.", "blanket tea gift set"],
      ["Book tracker journal", "For notes and wishlist titles.", "reading journal book log"],
    ],
  },
];

const CSS = `:root{font-family:"Figtree",system-ui,Arial,sans-serif;color:#20342c;background:#fbfaf6;line-height:1.6}
body{margin:0}.wrap{max-width:760px;margin:0 auto;padding:2rem 1.25rem 4rem}
a{color:#17624b}h1,h2{line-height:1.2}h1{font-size:2.2rem}
nav.crumb{font-size:.95rem;margin-bottom:1rem}
.disclosure{font-size:.9rem;padding:.6rem .8rem;background:#eef6f1;border-radius:6px}
.idea{padding:1rem 0;border-bottom:1px solid #e3e0d6}.idea h3{margin:.1rem 0}
.cta{margin:2rem 0;padding:1.25rem;background:#8b1631;color:#fff;border-radius:10px}
.cta a{color:#fff;font-weight:700}
.more{columns:2;padding-left:1.2rem}
footer{margin-top:3rem;font-size:.9rem;color:#5b6b64}
@media(max-width:600px){.more{columns:1}h1{font-size:1.8rem}}`;

const FOOTER = `<footer><p>Ad: we earn a commission from qualifying Amazon purchases made through links on this page. Prices and availability change, so check the listing before you buy.</p>
<p><a href="/about">About</a> Â· <a href="/privacy">Privacy</a> Â· <a href="/">ChristmasIdea</a></p></footer>`;

function head(title, desc, path, extra = "") {
  const url = `${ORIGIN}${path}`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#8b1631">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/guide.css">
${extra}</head>
<body>
<main class="wrap">
`;
}

function guidePage(g) {
  const path = `/gifts/${g.slug}`;
  const title = `${g.h1} | ChristmasIdea`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.h1,
    description: g.desc,
    mainEntityOfPage: `${ORIGIN}${path}`,
  };
  const related = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 6);
  return head(title, g.desc, path, `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`) +
`<nav class="crumb"><a href="/">ChristmasIdea</a> â€º <a href="/gifts/">Gift guides</a></nav>
<h1>${esc(g.h1)}</h1>
<p class="disclosure">Ad: we earn a commission from qualifying Amazon purchases. Links search Amazon UK; we do not list prices.</p>
<p>${esc(g.intro)}</p>
<h2>How to choose</h2>
<ul>${g.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
<h2>Eight ideas to consider</h2>
${g.ideas.map(([name, why, q]) => `<div class="idea"><h3>${esc(name)}</h3><p>${esc(why)}</p><p><a href="${esc(amazon(q))}" rel="sponsored noopener" target="_blank">Search Amazon UK</a></p></div>`).join("\n")}
<div class="cta"><strong>Need something more personal?</strong> Describe who you are shopping for and get eight tailored ideas in seconds. <a href="/">Try the gift finder</a>.</div>
<h2>More gift guides</h2>
<ul class="more">${related.map((r) => `<li><a href="/gifts/${r.slug}">${esc(r.h1)}</a></li>`).join("")}</ul>
${FOOTER}
</main>
</body>
</html>
`;
}

function indexPage() {
  return head("Gift guides | ChristmasIdea", "Original gift guides for children, new babies, hobbyists, mum, dad and Secret Santa.", "/gifts/") +
`<nav class="crumb"><a href="/">ChristmasIdea</a></nav>
<h1>Gift guides</h1>
<p>Practical guides for common gift problems. For ideas matched to one specific person, use the <a href="/">gift finder</a>.</p>
<ul>${GUIDES.map((g) => `<li><a href="/gifts/${g.slug}">${esc(g.h1)}</a> â€“ ${esc(g.desc)}</li>`).join("")}</ul>
${FOOTER}
</main>
</body>
</html>
`;
}

function notFoundPage() {
  return head("Page not found | ChristmasIdea", "That page could not be found.", "/404.html").replace(
    '<link rel="canonical" href="https://christmasidea.co.uk/404.html">\n', "<meta name=\"robots\" content=\"noindex\">\n") +
`<h1>We could not find that page</h1>
<p>It may have moved. Try the <a href="/">gift finder</a> or browse the <a href="/gifts/">gift guides</a>.</p>
${FOOTER}
</main>
</body>
</html>
`;
}

mkdirSync(join(SITE, "gifts"), { recursive: true });
writeFileSync(join(SITE, "guide.css"), CSS + "\n");
writeFileSync(join(SITE, "404.html"), notFoundPage());
writeFileSync(join(SITE, "gifts", "index.html"), indexPage());
for (const g of GUIDES) writeFileSync(join(SITE, "gifts", `${g.slug}.html`), guidePage(g));

const today = new Date().toISOString().slice(0, 10);
const urls = ["/", "/gifts/", ...GUIDES.map((g) => `/gifts/${g.slug}`), "/about", "/privacy"];
writeFileSync(
  join(SITE, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`
);
console.log(`Wrote ${GUIDES.length} guides, index, 404, guide.css and sitemap.xml`);
