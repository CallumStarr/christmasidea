// Generates the static gift-guide pages, 404 page and sitemap into site/.
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
    desc: "Screen-free gift ideas for 4-year-olds, from pretend play to chunky puzzles, with tips on age guidance, space and noise.",
    intro: "Four-year-olds are curious, imaginative and increasingly independent. The best gifts give them something to pretend, build, sort or make, rather than something that only does one thing when a button is pressed.",
    tips: [
      "Check the age label on the box. If the child has younger siblings, keep small-part toys well away from them.",
      "If the family prefers a quiet house, look for open-ended play such as dressing up, building and drawing instead of toys with sound effects.",
      "Pick one thing they can do with a grown-up and one they can do alone.",
    ],
    ideas: [
      ["Chunky wooden jigsaw puzzle", "A satisfying little challenge for a child who likes finishing a job themselves.", "chunky wooden jigsaw puzzle 4 years", "Choose the piece count for their experience, not just their age. Clear pictures and a sturdy storage tray make it easier to start again."],
      ["Dressing-up costume", "For the child whose living room is a fire station one day and a dragon's cave the next.", "kids dressing up costume 4-5 years", "Check sizing, fastening and washing instructions. A simple tabard they can put on themselves may get more use than a complicated outfit."],
      ["Large building blocks", "Something to build, knock down and reinvent without batteries or instructions.", "large building blocks toddler preschool", "Match an existing block system if they have one. Check the age label and whether the box includes enough pieces for a satisfying build."],
      ["Picture book set", "New characters for the bedtime rotation, with plenty to spot on every page.", "picture books age 4 bundle", "Check which titles the family already owns. A single beautifully illustrated story can be a better gift than a large mixed bundle."],
      ["Play-dough or modelling clay kit", "For making a bakery, a dinosaur or whatever the afternoon calls for.", "play dough set kids", "Check the age label, ingredients and allergy guidance. Washable tools and resealable tubs are useful; a giant accessory set is not essential."],
      ["Kids' watercolour paint set", "A small invitation to make something, rather than follow a screen.", "kids washable watercolour paint set", "Look for age-appropriate washable paints and add thick paper. Check the contents rather than assuming a set includes a usable brush."],
      ["Balance bike or scooter", "For the child who would rather spend the afternoon outside.", "kids balance bike 4 year old", "Ask the parents first. Check seat or handlebar height, rider limits, storage space and suitable protective equipment."],
      ["Simple first board game", "Short rounds and shared laughs while they get the hang of taking turns.", "first board game preschool 4 years", "Look for simple rules and a short playing time. Check the number of players and whether an adult needs to read every turn."],
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
      ["Soft crinkle cloth book", "A few bold pictures to explore together, even before there are words.", "soft crinkle cloth baby book high contrast", "Check the stated age suitability and washing instructions. Avoid loose accessories, long cords or detachable small parts."],
      ["Muslin squares", "The practical extra that can go straight into the changing bag.", "muslin cloth squares baby pack", "Look for machine-washable fabric and useful dimensions. Ask whether the parents have a preferred material before buying a large pack."],
      ["Baby keepsake memory box", "Somewhere for the hospital bracelet, first cards and other tiny mementoes.", "baby keepsake memory box", "Check internal dimensions and compartments. This is storage for an adult to keep out of the baby's reach, not a nursery toy."],
      ["Soft rattle", "A simple first toy for supervised play with a grown-up.", "soft fabric baby rattle", "Choose a clearly age-labelled toy from a reputable seller. Check care instructions and inspect it regularly for loose stitching or parts."],
      ["Baby bath towel with hood", "A useful addition to the bath-time routine, without guessing clothing sizes.", "hooded baby bath towel", "Check the towel's actual dimensions and care label. A soft, absorbent fabric matters more than decorative extras."],
      ["Baby milestone cards", "A small keepsake for parents who enjoy documenting the first year.", "baby milestone cards", "Read the included milestones before ordering. Cards are photo props for adults to handle and should be kept out of the baby's reach."],
      ["Board book for shared reading", "A story to return to as the baby grows, rather than another cuddly toy.", "baby board book high contrast", "Choose sturdy pages and a clearly stated age range. Skip electronic extras if the parents prefer a quiet home."],
      ["Treat for the new parents", "Something for the people doing the night feeds, not just the new arrival.", "gift set new parents coffee tea", "Ask what they would actually enjoy. Dietary requirements and caffeine preferences matter; a meal voucher can be more useful than another hamper."],
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
      ["Glow-in-the-dark star ceiling stickers", "For the space fan who would like a little of the night sky indoors.", "glow in the dark star stickers ceiling", "Check the quantity, sizes and wall-surface guidance. For a child's room, ask a parent before gifting anything that attaches to the ceiling."],
      ["Beginner telescope", "For someone ready to make observing the sky a proper hobby.", "beginner telescope kids", "Prioritise a stable mount and straightforward setup over magnification claims. Never observe the sun without specialist equipment and expert guidance."],
      ["Solar system model kit", "For a hands-on learner who would rather build the planets than just read about them.", "solar system model kit kids", "Check the age range, small parts and whether paint or glue is included. Make sure there is somewhere to display the finished model."],
      ["Illustrated book about space", "A good choice for the endlessly curious person with one more question.", "illustrated space book children", "Match the reading level and check the publication date. Adult observers may prefer a practical sky guide to a general children's encyclopaedia."],
      ["Planisphere or star map", "A screen-free way to work out what is overhead on a clear night.", "planisphere star finder", "Choose one suitable for UK latitudes. A readable rotating planisphere is more practical outdoors than a purely decorative constellation print."],
      ["Rocket building kit", "An afternoon project for the person fascinated by how things fit together.", "build your own rocket kit", "Distinguish a display model from a launching kit. Check tools, consumables, recommended ages and any outdoor-space or supervision requirements."],
      ["Space-themed jigsaw", "A night-sky project for days when the real weather is not cooperating.", "space jigsaw puzzle", "Match the piece count to their patience and available table space. A detailed reference image helps with large areas of dark sky."],
      ["Binoculars for stargazing", "A practical alternative for someone not ready to store and set up a telescope.", "binoculars for stargazing beginners", "Consider weight and whether they can hold them comfortably; some need a tripod. Never point binoculars at the sun."],
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
      ["Stainless-steel hand trowel and fork", "A worthwhile upgrade for the gardener still using the bent trowel from the back of the shed.", "stainless steel hand trowel fork set", "Look for a comfortable handle and a solid join between head and handle. A tool they enjoy holding beats a large set of flimsy extras."],
      ["Gardening gloves", "A fresh pair for the person whose current ones have seen several winters.", "gardening gloves thorn resistant women men", "Check hand size and the kind of work they do. Fine planting and thorny pruning need different levels of protection; no glove is puncture-proof."],
      ["Seed collection", "Next spring's project in a small envelope, especially for a cook who grows herbs.", "gardener seed collection gift", "Check sowing dates, available growing space and whether the collection suits pots. Clearly labelled individual packets are easier to plan with."],
      ["Kneeler and seat", "A practical option for someone who spends a long time planting or weeding at ground level.", "garden kneeler seat", "Check dimensions, weight limits and stability on their garden surface. Ask first rather than assuming an aid will suit their needs."],
      ["Hand cream for working hands", "A small end-of-day ritual after washing off the soil.", "gardener hand cream", "Check fragrance and ingredient preferences. A modest tube paired with a good nail brush can feel more considered than a generic gift basket."],
      ["Bird feeder", "Something to watch from the kitchen window between gardening sessions.", "garden bird feeder", "Choose a feeder that opens easily for cleaning, with a suitable place to hang it. Check current wildlife guidance on hygiene and feeding."],
      ["Gardening journal", "For the planting dates, unexpected successes and things to do differently next year.", "garden planner journal", "Look for enough free-writing space and a practical size. An undated journal works better than one that starts halfway through the growing year."],
      ["Pruning snips", "For picking herbs and cutting flowers without reaching for the kitchen scissors.", "garden snips pruning secateurs", "Choose fine snips for soft stems, not heavy branches. Check hand fit, blade protection and the closing catch; they are not a substitute for secateurs."],
    ],
  },
  {
    slug: "gifts-for-history-lovers",
    h1: "Gift ideas for history lovers",
    desc: "Gift ideas for history lovers: books, models, maps and puzzles, with advice on choosing a period and checking the details.",
    intro: "History lovers are often specific about periods and places. Start with the era they love, then pick something to read, build or display.",
    tips: [
      "Check what they already own; keen readers often have the famous titles.",
      "Pick one period rather than a general 'history' gift.",
      "Maps, prints and models make good display gifts.",
    ],
    ideas: [
      ["Narrative history book", "An absorbing account of the period they always bring up at dinner.", "popular history book bestseller", "Start with their favourite era, then check their shelves. Read a sample: a specialist reader and a casual enthusiast may want very different levels of detail."],
      ["Historical atlas", "For someone who likes to understand where a story happened, not just when.", "historical atlas world history", "Check the geographic focus, period covered and printed size. Clear maps with readable labels matter more than an impressive page count."],
      ["Roman or medieval model kit", "A weekend project with a finished object for the shelf.", "historical model kit", "Match the historical period and skill level. Check the scale, display dimensions and whether paints, glue or tools are needed separately."],
      ["History trivia game", "A chance to put all those accumulated facts to use with friends.", "history trivia board game", "Check player numbers, typical playing time and geographic bias. A very specialist quiz can leave everyone except the recipient out of the game."],
      ["Reproduction map print", "A particular city, journey or home town made into something to keep.", "vintage historical map print", "Check the date, print dimensions and whether a frame is included. Make sure a reproduction is clearly described as such."],
      ["Museum-inspired puzzle", "An afternoon with a favourite collection, without finding room for another ornament.", "museum art history jigsaw puzzle", "Choose a subject they recognise and a suitable piece count. Check the finished dimensions before committing their dining table to it."],
      ["Timeline wall chart", "For someone who enjoys connecting people and events across different periods.", "history timeline wall chart", "Read the period coverage and actual dimensions. Fold-out formats suit limited wall space; tiny text can make a large timeline frustrating."],
      ["Biography of someone they admire", "A specific choice that shows you remembered the person behind their fascination.", "biography historical figure", "Check the author and whether it is a new account or a reissue. For a serious enthusiast, a well-sourced biography is preferable to a general gift edition."],
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
      ["Pour-over coffee set", "For the person who enjoys making the coffee almost as much as drinking it.", "pour over coffee dripper set", "Check filter size, whether filters are included and whether the dripper sits on their mug or needs a separate server. Match their current brewing habit."],
      ["Insulated travel mug", "A practical gift for a slow coffee drinker or a long morning commute.", "insulated travel mug leak proof", "Check capacity, cup-holder fit and cleaning instructions. A splash-resistant lid is not necessarily safe to carry loose in a bag."],
      ["Tea infuser teapot", "Space for loose leaves to open up, and a reason to make a proper pot.", "glass teapot infuser loose leaf", "Look for a removable basket and check the serving capacity. Make sure the care instructions suit the way they wash their everyday crockery."],
      ["Hand coffee grinder", "For someone ready to grind just enough beans for each brew.", "manual coffee grinder", "Check adjustment range and capacity against their brewing method. Espresso needs more precision than many entry-level grinders can offer."],
      ["Handmade ceramic mug", "A small upgrade to an everyday ritual, with no new technique to learn.", "handmade ceramic mug", "Check capacity and handle shape, not just the photograph. Confirm dishwasher and microwave suitability, and allow for handmade variations."],
      ["Milk frother", "For a home hot chocolate or a milk-topped morning coffee.", "handheld milk frother", "Check how it is powered and whether batteries are included. A handheld whisk does not heat milk; a jug-style frother takes more cupboard space."],
      ["Tea tasting set", "Several small discoveries rather than one large tin of the wrong blend.", "tea tasting sampler gift set", "Check caffeine preferences, flavours and whether the tea is loose-leaf or bagged. Read ingredients and allergen information before buying food or drink."],
      ["Coffee scoop and storage tin", "An easy-to-use home for the beans that otherwise live in a folded bag.", "coffee storage canister airtight", "Check capacity and lid design. Pairing a tin with their usual beans is more personal than choosing an unfamiliar flavoured coffee."],
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
      ["Soft throw blanket", "For her usual spot on the sofa, in a colour that actually belongs in her home.", "soft throw blanket sofa", "Check fabric, dimensions and washing instructions. A throw that only looks good folded over an armchair may not be big enough to curl up under."],
      ["Photo frame or personalised photo book", "A favourite memory given a life beyond the phone camera roll.", "personalised photo book family", "Check image quality, layout and the ordering deadline. Leave time to review a proof; personalisation often changes return options."],
      ["Bath-time treats", "For someone who already enjoys taking a little time over a bath.", "bath salts gift set", "Check fragrance and ingredient preferences. Do not assume she wants scented products; a good towel is an alternative if you are unsure."],
      ["Good-quality mug and treats", "Her usual tea or coffee, with something good to go alongside it.", "mug tea gift set", "Choose the drink she actually buys, and check dietary needs. One well-chosen mug and her favourite biscuits can beat an oversized generic hamper."],
      ["Book by her favourite author", "An easy next chapter when you know whose books she keeps returning to.", "bestselling novel paperback", "Check the exact title against her shelves or wish list. Consider print size, format and whether a gift receipt would be useful."],
      ["Cookbook for her cuisine", "New ideas for someone who genuinely loves trying a recipe.", "cookbook easy home cooking", "Match the cuisine, dietary preferences and available cooking time. Give it as inspiration, not an expectation that she should cook for everyone."],
      ["Slippers", "An everyday comfort, chosen for fit rather than a novelty slogan.", "womens memory foam slippers", "Check her size, preferred open or closed back, sole and care instructions. Keep the receipt: comfort is difficult to judge from a listing."],
      ["Jigsaw or craft kit", "Something absorbing for the quiet days between Christmas and New Year.", "jigsaw puzzle 1000 pieces", "Match the activity to an existing interest. Check skill level, included materials and whether she will need extra equipment to finish it."],
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
      ["Compact tool organiser", "For the person who owns the right bit somewhere, but can never find it.", "compact tool organiser small parts", "Check the tools or small parts he wants to store and measure the available space. Useful compartments matter more than a very large case."],
      ["Insulated flask", "A proper hot drink at the end of a walk or halfway through a morning in the garden.", "insulated flask 1 litre", "Check capacity, empty weight and how easily it opens and cleans. A cup lid is useful outdoors; a large flask can be too bulky for a small bag."],
      ["Biography or history book", "A quiet evening with the subject he always stops to watch on television.", "history book popular non fiction", "Find out which period or person interests him, then check what he owns. A specific choice beats the latest general bestseller."],
      ["Cordless torch or head torch", "For the dark corner of the shed, an evening walk or a camping trip.", "rechargeable head torch", "Check weight, charging connection and the low-light setting as well as maximum brightness. An adjustable strap and simple controls are worth looking for."],
      ["Craft beer or whisky tasting glasses", "For someone who already enjoys comparing a couple of favourites.", "whisky tasting glasses gift set", "Check the drink he actually likes and how the glasses should be washed. Skip alcohol-related gifts if you are not sure they would be welcome."],
      ["Wallet or card holder", "A simple replacement for the one that has quietly started falling apart.", "mens leather wallet slim", "Check whether he carries notes, coins or just cards. Match his preferred layout rather than assuming smaller is automatically better."],
      ["Board game for two", "A gift that includes a reason to sit down and spend an evening together.", "two player board game strategy", "Check that it is good with exactly two players, not merely playable with two. Match the rules complexity and playing time to his taste."],
      ["Bluetooth speaker", "For music in the workshop or something to listen to while potting plants.", "portable bluetooth speaker", "Check battery life, charging connection and the stated water-resistance rating. Find out whether he already has a speaker system he likes."],
    ],
  },
  {
    slug: "secret-santa-gifts-under-10",
    h1: "Secret Santa gift ideas under £10",
    desc: "Useful Secret Santa ideas for a £10 budget, with advice on preferences, practical details and checking the total price.",
    intro: "Secret Santa works best when the gift is useful, light-hearted and unlikely to offend. Prices change, so check the listing against your limit before you buy.",
    tips: [
      "Avoid anything very personal, such as clothing or fragrance.",
      "A small treat plus a small useful item usually beats one gimmick.",
      "Ask in the group chat about allergies or dietary needs before buying food.",
    ],
    ideas: [
      ["Small plant pot", "A desk-sized home for a cutting, without guessing someone's taste in jokes.", "mini desk plant pot", "Check dimensions, drainage and whether the plant is included. If buying a live plant, consider the recipient's light conditions and pets."],
      ["Notebook and nice pen", "A useful pair for lists, meetings or the idea that appears on the bus home.", "notebook pen gift set", "Look for a pocket-friendly size and usable paper. Check the final price: gift packaging can push a basic set over the limit."],
      ["Tea infuser", "For the colleague who always brings their own loose-leaf tea.", "tea infuser mug lid", "Choose a basket that fits an ordinary mug and is easy to empty. This only works if they drink loose-leaf tea; otherwise pick another idea."],
      ["Card game", "Something to open over lunch or take home for the holidays.", "pocket card game party", "Check age guidance, player count and language. Keep the content workplace-appropriate and avoid games that rely on embarrassing other players."],
      ["Small unscented candle", "A simple option when you know they enjoy candles, but not which fragrance.", "small unscented candle gift", "Check dimensions and the actual quantity. Include safe-use instructions and avoid guessing at a fragrance; even popular scents are not universal."],
      ["Socks with a festive pattern", "A little seasonal colour for someone who enjoys Christmas rather than novelty slogans.", "festive novelty socks", "Check the size range and fabric. Skip personal jokes and make sure the recipient would actually enjoy wearing them."],
      ["Puzzle cube or brain teaser", "A small distraction for the person who likes solving things with their hands.", "puzzle cube brain teaser", "Check difficulty and age suitability. Look for something with a clear objective rather than a decorative desk toy with no lasting interest."],
      ["Reusable coffee cup", "An extra cup for a regular coffee run, without a name or slogan to get wrong.", "reusable coffee cup lid", "Check the lid, capacity and washing guidance. Include delivery charges when checking the total against the agreed limit."],
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
      ["Clip-on reading light", "For the person who means it when they say just one more chapter.", "clip on book reading light rechargeable", "Look for adjustable brightness, a gentle low setting and a clip that will not damage pages. Check weight and the charging connection."],
      ["Leather or beaded bookmark", "A useful little upgrade from the receipt currently keeping their place.", "bookmark gift set", "Choose something thin enough not to strain the spine. A specific colour or motif they like is more personal than a generic literary quote."],
      ["Book sleeve or cover", "For the paperback that goes everywhere in the bottom of a bag.", "book sleeve padded", "Measure a book they actually carry. Hardbacks, larger paperbacks and e-readers need different sizes; check the closure and washing instructions."],
      ["Reading cushion or lap desk", "For longer reading sessions away from a desk.", "book reading pillow", "Check dimensions, support and storage space. Ask whether they prefer a cushion or a firm surface rather than choosing a bulky accessory unprompted."],
      ["Literary tote bag", "Room for the library haul, in a design connected to a book they love.", "literary tote bag canvas", "Check handle length, fabric weight and whether it has a useful inner pocket. Read the dimensions rather than relying on a styled photograph."],
      ["Bookends", "For the growing stack that has started leaning into the houseplant.", "bookends decorative", "Look for enough weight and a non-marking base. Check shelf depth and book height; very light decorative pairs may not hold heavy hardbacks."],
      ["Cosy blanket and tea set", "A reading-evening kit assembled around their usual comforts.", "blanket tea gift set", "Choose the tea they drink and a washable throw. Buying the two separately often gives you a better match than a pre-packed gift set."],
      ["Book tracker journal", "For remembering the brilliant ending and deciding what to read next.", "reading journal book log", "Check the page layout and number of entries. Some readers want prompts and ratings; others would rather have space for their own notes."],
    ],
  },
];

const HEADER = home.match(/<header class="masthead">[\s\S]*?<\/header>/)?.[0];
const FOOTER = home.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
if (!HEADER || !FOOTER) throw new Error("The homepage must provide the shared masthead and footer.");

const EDITS = {
  "gifts-for-4-year-olds": { art: "play", title: "For little imaginations", label: "Play & making", description: "AI-created scene of a wooden toy train, building blocks and colouring pencils on an oak table", group: "family", tone: "clay" },
  "gifts-for-new-babies": { art: "baby", title: "For a new arrival", label: "The first Christmas", description: "AI-created scene of a teddy bear, picture book and wooden rattle on a folded blanket", group: "family", tone: "clay" },
  "gifts-for-space-lovers": { art: "space", title: "For the stargazer", label: "After dark", description: "AI-created scene of a telescope and brass globe beside a window at dusk", group: "interests", tone: "sage" },
  "gifts-for-gardeners": { art: "garden", title: "For the gardener", label: "The outdoor edit", description: "AI-created scene of garden secateurs, gloves, seed envelopes and potted rosemary on limestone", group: "interests", tone: "sage" },
  "gifts-for-history-lovers": { art: "history", title: "For the history lover", label: "Another time & place", description: "AI-created scene of a classical temple model, old map, magnifying glass and leatherbound books", group: "interests", tone: "oat" },
  "gifts-for-tea-and-coffee-lovers": { art: "coffee", title: "For the tea & coffee lover", label: "The morning ritual", description: "AI-created scene of a cafetiere, green ceramic teapot and stoneware cup in morning light", group: "interests", tone: "oat" },
  "gifts-for-mum": { art: "mum", title: "For mum", label: "Her kind of Christmas", description: "AI-created scene of a linen journal, amber candle, cup of tea and ribbon-tied present", group: "family", tone: "clay" },
  "gifts-for-dad": { art: "dad", title: "For dad", label: "His kind of Christmas", description: "AI-created scene of an olive coffee flask, leather headphones and binoculars on an oak table", group: "family", tone: "sage" },
  "secret-santa-gifts-under-10": { art: "gesture", title: "Secret Santa, under £10", label: "Small budget, good idea", description: "AI-created scene of a small kraft-paper present, houseplant, mug and pocket notebook", group: "budget", tone: "clay" },
  "gifts-for-book-lovers": { art: "books", title: "For the book lover", label: "One more chapter", description: "AI-created scene of an open book, reading glasses, linen-shaded lamp and stoneware cup", group: "interests", tone: "oat" },
};

function header(path) {
  return HEADER
    .replace('href="#form" aria-current="page"', 'href="/#form"')
    .replace('href="/gifts/">The gift guides</a></div>', `href="/gifts/"${path.startsWith("/gifts") ? ' aria-current="page"' : ""}>The gift guides</a></div>`)
    .replace(/<button class="nav-shortlist"[^>]*>([\s\S]*?)<\/button>/,
      '<a class="nav-shortlist" id="nav-shortlist" href="/?shortlist=1" aria-label="Open your shortlist">$1</a>');
}

function art(g, className = "guide-illustration") {
  const edit = EDITS[g.slug];
  const decorative = className === "directory-art";
  const sizes = decorative
    ? "(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 42vw, 360px"
    : "(max-width: 760px) calc(100vw - 96px), 480px";
  return `<div class="${className} tone-${edit.tone}"${decorative ? ' aria-hidden="true"' : ""}><span>${esc(edit.label)}</span><img class="editorial-photo" src="/images/${edit.art}-800.webp" srcset="/images/${edit.art}-400.webp 400w, /images/${edit.art}-800.webp 800w, /images/${edit.art}-1200.webp 1200w" sizes="${sizes}" width="1200" height="840" alt="${decorative ? "" : esc(edit.description)}" loading="${decorative ? "lazy" : "eager"}" decoding="async"></div>`;
}

function guideLink(g) {
  return `<li><a href="/gifts/${g.slug}">${art(g, "directory-art")}<div class="directory-copy"><h3>${esc(EDITS[g.slug].title)}</h3><span class="directory-arrow" aria-hidden="true">&nearr;</span><p>${esc(g.desc)}</p><span class="directory-meta">Eight ideas &middot; What to look for</span></div></a></li>`;
}

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
<meta property="og:site_name" content="Santa's Helper">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Santa's Helper. A little thought. A lovely gift. Christmas gifts wrapped with burgundy ribbons.">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBF7F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C1518" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/theme.css">
<link rel="stylesheet" href="/guide.css">
<script type="module" src="/site-shell.js"></script>
${extra}</head>
<body>
<a class="skip-link" href="#guide-content">Skip to content</a>
${header(path)}
<main class="wrap guide-page" id="guide-content" tabindex="-1">
`;
}

function guidePage(g) {
  const path = `/gifts/${g.slug}`;
  const title = `${g.h1} | Santa's Helper`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.h1,
    description: g.desc,
    mainEntityOfPage: `${ORIGIN}${path}`,
  };
  const related = GUIDES.filter((x) => x.slug !== g.slug)
    .sort((a, b) => Number(EDITS[b.slug].group === EDITS[g.slug].group) - Number(EDITS[a.slug].group === EDITS[g.slug].group))
    .slice(0, 3);
  return head(title, g.desc, path, `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`) +
`<nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/gifts/">Gift guides</a><span aria-hidden="true">/</span><span aria-current="page">${esc(EDITS[g.slug].title)}</span></nav>
<div class="guide-intro"><div><p class="eyebrow">The Christmas gift guides</p><h1>${esc(g.h1)}</h1><p class="standfirst">${esc(g.intro)}</p><nav class="guide-jumps" aria-label="On this page"><a href="#gift-ideas">Explore the eight ideas <span aria-hidden="true">&darr;</span></a><a href="#choosing">How to choose</a></nav></div>${art(g)}</div>
<section class="choosing" id="choosing" aria-labelledby="choosing-title"><div><p class="eyebrow">Before you choose</p><h2 id="choosing-title">A few things<br>worth knowing.</h2></div><ul>${g.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>
<section id="gift-ideas" aria-labelledby="ideas-title">
<div class="ideas-heading"><div><p class="eyebrow">The possibilities</p><h2 id="ideas-title">Eight ideas to consider</h2></div><p>Gift concepts, not tested products.<br>Check the details before buying.</p></div>
<p class="disclosure">Ad: we earn a commission from qualifying Amazon purchases. These links search Amazon UK, not a specific verified product. Prices and availability can change. Editorial imagery is AI-created, not a photograph of a tested product.</p>
<div class="idea-grid">
${g.ideas.map(([name, why, q, note], i) => {
    if (!note) throw new Error(`Missing buying advice: ${g.slug} / ${name}`);
    return `<article class="idea"><span class="idea-number">${String(i + 1).padStart(2, "0")}</span><h3>${esc(name)}</h3><p class="idea-why">${esc(why)}</p><p class="buying-note"><strong>What to look for</strong>${esc(note)}</p><a href="${esc(amazon(q))}" rel="sponsored noopener" target="_blank" aria-label="${esc(`Search Amazon UK for ${name} (affiliate link, opens in a new tab)`)}">Search Amazon UK <span aria-hidden="true">&nearr;</span></a></article>`;
  }).join("\n")}
</div></section>
<aside class="finder-cta"><div><p class="eyebrow">Make it more personal</p><h2>Not quite their thing?</h2><p>Add their interests, what they already own and your budget. Our AI finder can suggest a different direction.</p></div><a href="/#form">Find a gift for them <span aria-hidden="true">&rarr;</span></a></aside>
<section class="related-guides" aria-labelledby="more-guides"><div class="ideas-heading"><h2 id="more-guides">Another direction to explore</h2><a href="/gifts/">All gift guides <span aria-hidden="true">&rarr;</span></a></div><ul class="related-shelf">${related.map(guideLink).join("")}</ul></section>
</main>
${FOOTER}
</body>
</html>
`;
}

function indexPage() {
  return head("Gift guides | Santa's Helper", "Original gift guides for children, new babies, hobbyists, mum, dad and Secret Santa.", "/gifts/") +
`<div class="directory-intro"><div><p class="eyebrow">The Christmas edit</p><h1>The gift guides</h1><p class="standfirst">For the lifelong hobbies, the new arrivals and the people who are impossible to buy for. Start with someone you know.</p></div><p class="directory-count"><strong>${GUIDES.length}</strong> guides to explore<br>Eight possibilities in each.</p></div>
<nav class="directory-jumps" aria-label="Browse guides by"><a href="#interests">Their interests <span aria-hidden="true">&darr;</span></a><a href="#family">Your people <span aria-hidden="true">&darr;</span></a><a href="#budget">A smaller budget <span aria-hidden="true">&darr;</span></a></nav>
<p class="disclosure">Editorial imagery is AI-created for inspiration, not a photograph of a tested product.</p>
${[["interests", "Start with what they love", "From a garden full of plans to a shelf full of books."], ["family", "For the people on your list", "A few starting points. Their interests make the difference."], ["budget", "A little gift goes a long way", "Secret Santa ideas to check against your agreed limit."]].map(([group, title, description]) => `<section class="directory-section" id="${group}" aria-labelledby="${group}-title"><div class="directory-section-heading"><h2 id="${group}-title">${title}</h2><p>${description}</p></div><ul class="guide-directory">${GUIDES.filter((g) => EDITS[g.slug].group === group).map(guideLink).join("")}</ul></section>`).join("\n")}
<aside class="finder-cta"><div><p class="eyebrow">For someone specific</p><h2>Tell us a little about them.</h2><p>Combine their interests, age and your budget for a more personal set of AI-generated ideas.</p></div><a href="/#form">Try the gift finder <span aria-hidden="true">&rarr;</span></a></aside>
</main>
${FOOTER}
</body>
</html>
`;
}

function notFoundPage() {
  return head("Page not found | Santa's Helper", "That page could not be found.", "/404.html").replace(
    '<link rel="canonical" href="https://christmasidea.co.uk/404.html">\n', "<meta name=\"robots\" content=\"noindex\">\n") +
`<div class="not-found"><p class="eyebrow">Page not found &middot; 404</p><h1>This one's gone<br>off the list.</h1><p>That page may have moved. There are still plenty of good places to start.</p><div class="guide-jumps"><a href="/#form">Find a gift <span aria-hidden="true">&rarr;</span></a><a href="/gifts/">Explore the guides</a></div></div>
</main>
${FOOTER}
</body>
</html>
`;
}

mkdirSync(join(SITE, "gifts"), { recursive: true });
writeFileSync(join(SITE, "404.html"), notFoundPage());
writeFileSync(join(SITE, "gifts", "index.html"), indexPage());
for (const g of GUIDES) writeFileSync(join(SITE, "gifts", `${g.slug}.html`), guidePage(g));

// Legal copy stays authored; only the common site shell is synchronised.
for (const name of ["about", "privacy"]) {
  const path = join(SITE, `${name}.html`);
  const page = readFileSync(path, "utf8")
    .replace(/<header\b[\s\S]*?<\/header>/, header(`/${name}`))
    .replace(/\n?<footer class="site-footer">[\s\S]*?<\/footer>\n?/, "\n")
    .replace(/<script type="module" src="\/site-shell\.js"><\/script>\s*/, "")
    .replace(/<link rel="icon"[^>]*>\s*/g, "")
    .replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, "")
    .replace(/<meta name="theme-color"[^>]*>\s*/g, "")
    .replace("</head>", '<meta name="theme-color" content="#FBF7F0" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#1C1518" media="(prefers-color-scheme: dark)">\n</head>')
    .replace("</head>", '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n</head>')
    .replace("</head>", '<script type="module" src="/site-shell.js"></script>\n</head>')
    .replace('class="wrap" id="guide-content"', 'class="wrap legal-page" id="guide-content" tabindex="-1"')
    .replace("</body>", `${FOOTER}\n</body>`);
  writeFileSync(path, page);
}

const today = new Date().toISOString().slice(0, 10);
const urls = ["/", "/gifts/", ...GUIDES.map((g) => `/gifts/${g.slug}`), "/about", "/privacy"];
writeFileSync(
  join(SITE, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`
);
console.log(`Wrote ${GUIDES.length} guides, index, 404 and sitemap.xml`);
