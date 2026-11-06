// Generates the static gift-guide pages, 404 page and sitemap into site/.
// Run with: npm run build:pages
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { retailerLinks } from "../site/affiliateRouter.js";
import { publicMonetizationConfig } from "./monetization-settings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const ORIGIN = "https://christmasidea.co.uk";

// Single source of truth for the affiliate tag: the home page config.
const home = readFileSync(join(SITE, "index.html"), "utf8");
const PUBLIC_CONFIG = publicMonetizationConfig();
const TAG = PUBLIC_CONFIG.AMAZON_TAG || (home.match(/AMAZON_TAG:\s*"([^"]*)"/) || [])[1] || "";
const EBAY_CAMPAIGN_ID = PUBLIC_CONFIG.EBAY_CAMPAIGN_ID || (home.match(/EBAY_CAMPAIGN_ID:\s*"([^"]*)"/) || [])[1] || "";
const AFFILIATE_CONFIG = { ...PUBLIC_CONFIG, AMAZON_TAG: TAG, EBAY_CAMPAIGN_ID };
writeFileSync(join(SITE, "monetization-config.js"), `// Generated public settings; secret API credentials never belong in this file.\nexport const MONETIZATION_CONFIG = ${JSON.stringify(PUBLIC_CONFIG, null, 2)};\n`);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const GUIDES = [
  {
    slug: "gifts-for-4-year-olds",
    h1: "Gift ideas for 4-year-olds",
    desc: "Eight gift ideas for 4-year-olds, with advice on puzzle difficulty, toy storage, sizing and what to ask the parents.",
    intro: "At four, a favourite game might be building a tower, running a pretend cafe or asking for the same story again. Choose something that joins in with their play. Here are eight ideas, with advice on finding the right level of challenge.",
    tips: [
      "Check the age label on the box. If the child has younger siblings, keep small-part toys well away from them.",
      "Ask what they already enjoy and which building blocks or characters they have. An addition to a much-used set can be more welcome than a new system.",
      "Think about the parents too: noise, storage and how much help a toy needs all affect whether it gets used.",
    ],
    ideas: [
      ["Chunky wooden jigsaw puzzle", "A good choice if they enjoy matching shapes and seeing a picture come together.", "chunky wooden jigsaw puzzle 4 years", "Ask what size puzzle they can finish now, then choose a similar challenge. A clear picture and a tray help them get started without an adult sorting every piece."],
      ["Dressing-up costume", "A firefighter, a dragon or a character of their own invention: choose a costume they can make a story around.", "kids dressing up costume 4-5 years", "A simple tabard they can put on themselves leaves more time for playing. Buy by the child's measurements, and look for easy fastenings and a washable fabric."],
      ["Large building blocks", "For making the garage, castle or very tall tower they have in mind.", "large building blocks preschool", "Match the block system they already use: similar-looking pieces are not always compatible. Check the age label and the number of building pieces, not just the accessories."],
      ["Picture book", "Pick a story about something they currently love, whether that is dinosaurs, trains or a mischievous dog.", "picture book age 4", "Read a few pages aloud if you can: rhythm, repetition and things to spot give you plenty to share. Ask which titles the family already has before ordering."],
      ["Play-dough set", "They can make a bakery today and a dinosaur tomorrow, using the same tubs.", "play dough set kids", "Check the age label, ingredients and allergy guidance. Resealable tubs and a few sturdy tools are more useful than lots of small accessories to lose."],
      ["Children's watercolour paint set", "For a child who likes choosing colours and making their own pictures.", "kids washable watercolour paint set", "Look for age-appropriate paints with clear washing guidance, and include thick paper. Check that the set has a usable brush and a lid or tray for mixing colours."],
      ["Balance bike", "Worth considering if they enjoy being outdoors and are ready for their first bike.", "kids balance bike 4 year old", "Agree this one with the parents before buying. Fit depends on the child's height and the bike's minimum seat height, not just the age on the listing. Allow for storage and protective equipment."],
      ["First board game", "A game to play together, with short rounds so they can ask for another go.", "first board game preschool 4 years", "Choose rules you can explain in a few sentences. Check the player count, playing time and whether every turn needs reading, counting or help from an adult."],
    ],
  },
  {
    slug: "gifts-for-new-babies",
    h1: "Gift ideas for a new baby",
    desc: "New-baby gifts for shared reading, everyday use and family keepsakes, with practical advice before you buy.",
    intro: "A spare for the changing bag, a book to read together or somewhere to keep the first photographs: a new-baby gift need not be elaborate. Ask what the parents would find useful. This guide covers everyday gifts and keepsakes, rather than sleep, feeding or medical equipment.",
    tips: [
      "Ask before buying feeding, travel or sleep equipment. Those choices need to fit the family's routine and current safety guidance.",
      "If buying clothes, ask which sizes they need and consider the season when the baby will wear them. They may already have plenty of newborn outfits.",
      "Books and toys are for supervised time together, not for leaving in a baby's sleep space. Keepsake boxes and photo props belong with the adults.",
    ],
    ideas: [
      ["Soft crinkle cloth book", "A book to hold and explore together, with pictures to talk about as the baby grows.", "soft crinkle cloth baby book high contrast", "Check the stated age suitability and how it can be washed. Avoid loose accessories, long cords or detachable small parts, and choose a size that is easy for an adult to hold open."],
      ["Muslin squares", "An extra supply for the changing bag or laundry rotation, if the parents use them.", "muslin cloth squares baby pack", "Follow the parents' lead on fabric and size. Frequent washing is part of the job, so choose a pack whose care instructions fit their usual laundry routine."],
      ["Baby keepsake box", "Somewhere for first cards, photographs and the small things the family wants to keep.", "baby keepsake memory box", "Check the internal dimensions rather than the size of the packaging. Leave room for cards and photographs. This is storage for adults to keep out of the baby's reach, not a toy."],
      ["Soft rattle", "A simple toy for a grown-up to use during short play sessions with the baby.", "soft fabric baby rattle", "Choose a toy with clear age guidance and care instructions from an identifiable seller. Avoid loose parts and check stitching regularly; a soft covering alone does not establish suitability."],
      ["Hooded baby bath towel", "A spare for bath time, without having to predict how quickly the baby will outgrow an outfit.", "hooded baby bath towel", "Use the towel's unfolded measurements, not the age range or packaging, to judge its size. Ask whether the family needs another, and choose one that fits their washing routine."],
      ["Baby milestone cards", "For parents who enjoy taking photographs to remember the first year.", "baby milestone cards", "Read the milestones included in the pack and consider whether they suit the family. These are photo props for adults to handle, not objects to leave with the baby."],
      ["Board book for shared reading", "A short story or book of pictures that the family can return to together.", "baby board book high contrast", "Look for sturdy pages, a manageable size and clear age guidance. A few simple pictures may be easier to share than a busy book with flaps and loose extras."],
      ["Tea or coffee for the parents", "Something for the adults to enjoy as well as a present for the new arrival.", "tea coffee gift set", "Their usual tea or coffee is a useful clue; ask about decaf and any dietary needs. If choosing coffee, buy beans only if they have a grinder, otherwise match the grind to their brewer."],
    ],
  },
  {
    slug: "gifts-for-space-lovers",
    h1: "Gift ideas for space lovers",
    desc: "Space gifts for reading, model-making and stargazing, with advice on telescope mounts, UK star maps and kit contents.",
    intro: "Would they rather read about a mission, build a rocket model or spend a clear evening finding constellations? Start there. A telescope is one option, but a sky map or a book about the subject they keep coming back to may be the gift they use more.",
    tips: [
      "Find out whether they want to look at the sky or learn about it indoors. Outdoor equipment also needs storage and somewhere suitable to use it.",
      "For a telescope, ease of setup and a steady mount matter more than an impressive magnification figure. Ask an enthusiast what they need before adding equipment.",
      "Check the age guidance on model kits and allow for adult help, tools and a place to leave a half-finished build.",
    ],
    ideas: [
      ["Glow-in-the-dark star stickers", "A space-themed bedroom detail for someone who would like stars above their bed.", "glow in the dark star stickers ceiling", "Ask permission before buying anything adhesive for a child's room. Compare sticker sizes and surface guidance; choose a constellation layout if they would enjoy arranging recognisable patterns."],
      ["Beginner telescope", "For someone who wants to spend time learning their way around the night sky.", "beginner telescope", "Look for a stable mount and clear setup instructions, and consider where it will be stored. Do not buy on magnification alone. Never point a telescope at the sun."],
      ["Solar system model kit", "Build the planets in order, then find a place for the finished solar system.", "solar system model kit", "A hanging model needs different space from a tabletop one. Use the finished dimensions to choose, then allow for any paint, glue or tools listed separately and follow the kit's age guidance."],
      ["Illustrated book about space", "Choose a subject they keep asking about: planets, space missions or what lies beyond our solar system.", "illustrated space book", "Read a sample to judge the level of detail, and check the publication date for recent missions. A child learning planet names and an adult interested in astronomy need different books."],
      ["Planisphere", "Turn the discs to the date and time to see which constellations to look for.", "planisphere star finder uk", "Choose a chart for UK latitudes, with labels large enough to read in dim light. A rotating planisphere is for using outdoors; a decorative constellation print serves a different purpose."],
      ["Rocket display model kit", "A building project for someone interested in spacecraft, with a model to keep at the end.", "rocket display model kit", "Choose a non-launching display model and match the skill level. Check the age guidance, finished height and whether glue, paint or tools must be bought separately."],
      ["Space-themed jigsaw", "Planets, spacecraft or a crowded star field to piece together on a cloudy evening.", "space jigsaw puzzle", "The image affects difficulty as much as the piece count: a large area of dark sky can be surprisingly demanding. Allow enough table space for the finished puzzle and some room for sorting."],
      ["Binoculars for stargazing", "An option for exploring the sky without setting up a telescope each time.", "binoculars for stargazing beginners", "Consider weight as well as magnification: they need to be comfortable to hold, or used with a suitable support. Check the return policy for fit. Never point binoculars at the sun."],
    ],
  },
  {
    slug: "gifts-for-gardeners",
    h1: "Gift ideas for gardeners",
    desc: "Gifts for gardeners, from hand tools to seeds and planting journals, with advice on fit, growing space and avoiding duplicates.",
    intro: "Before buying a gardener another tool, find out what they reach for every weekend and what they wish worked better. Someone tending balcony pots has different needs from an allotment holder. These ideas include replacements for worn favourites and things to plan next season with.",
    tips: [
      "Handle shape, weight and grip are personal. If you cannot try a tool with them, keep the receipt rather than assuming a larger set is an upgrade.",
      "For plants or seeds, find out about light, soil and growing space. A packet suited to an allotment may be no use on a shaded windowsill.",
      "Ask what needs replacing. A well-used pair of gloves or a full planting notebook gives you a better clue than a generic gardener's hamper.",
    ],
    ideas: [
      ["Hand trowel and fork", "A replacement for the worn hand tools they still reach for every weekend.", "stainless steel hand trowel fork set", "Use their favourite tools as a guide to handle shape and weight. A narrow trowel suits transplanting; a wider one suits digging. If possible, let them try the grip before you buy."],
      ["Gardening gloves", "Useful to replace a tired pair, provided the size and type of work are right.", "gardening gloves", "Fine planting needs dexterity; handling thorny stems needs different protection. Check the size chart and intended use rather than relying on a one-size label or a general protection claim."],
      ["Seed collection", "Next season's tomatoes, herbs or flowers, chosen for the space they have to grow them.", "gardener seed collection", "Individual labelled packets let them plan when and where to sow. For pots, choose varieties described for containers; for an allotment, ask which crops they want to try next year."],
      ["Garden kneeler and seat", "Worth asking about if they spend long stretches planting and weeding at ground level.", "garden kneeler seat", "Ask whether they want a pad or a folding seat before buying. Check dimensions, weight limits and folding mechanism, and consider the paths and surfaces where they would use it."],
      ["Hand cream", "An extra tube of a favourite cream to keep by the sink after gardening.", "gardener hand cream", "Choose a product they already use or ask about ingredients and fragrance. The 'gardener' label tells you less about whether it suits them than their existing tube does."],
      ["Bird feeder", "A way to watch garden visitors from a favourite window, if feeding birds is something they want to take on.", "garden bird feeder", "Cleaning is part of owning a feeder, so look for one that comes apart easily. Agree a suitable place to hang it, and consult current wildlife guidance on feeding and hygiene."],
      ["Gardening journal", "Somewhere to record sowing dates, successful varieties and what to change next year.", "garden planner journal", "Look inside before buying: planting plans, blank notes and harvest records serve different habits. An undated layout avoids wasted pages and lets them start whenever they choose."],
      ["Fine garden snips", "A tool for picking herbs and cutting flowers without borrowing the kitchen scissors.", "fine garden snips", "Fine snips are for soft stems, not woody branches. A comfortable grip, an easy-to-use catch and a blade cover matter more here than a large tool set."],
    ],
  },
  {
    slug: "gifts-for-history-lovers",
    h1: "Gift ideas for history lovers",
    desc: "Books, maps, models and games for history lovers, with help choosing the right period, level of detail and format.",
    intro: "Find out which period or place has caught their attention before searching for a history gift. A reader interested in Roman Britain may have little use for a general world-history book. The same clue can guide you towards a map, model or game if their shelves are already full.",
    tips: [
      "Check their shelves or wish list. A newly published title can still repeat a subject they already know well.",
      "Match how they enjoy history: reading about it, visiting places, building models or discussing it with other people.",
      "For a map, chart or model, check the finished dimensions and display space. A frame or extra modelling materials may need a separate budget.",
    ],
    ideas: [
      ["Narrative history book", "Follow the people and decisions behind an event they want to understand better.", "narrative history book", "Read a sample from their chosen period. Some accounts tell a broad story; others follow one argument in depth. The introduction and bibliography help you judge which kind of reader the book is written for."],
      ["Historical atlas", "A companion for following changing borders, journeys and the places mentioned in a history book.", "historical atlas", "Start with the region and period, then look at sample maps. Readable labels and an index make the book easier to use; fitting more maps into a pocket edition can come at the expense of detail."],
      ["Historical model kit", "A project for someone who enjoys recreating a building, ship or scene from a particular era.", "historical model kit", "Match the subject and skill level before choosing a scale. Check the finished dimensions and whether paints, glue and tools are included; the box price may not cover the whole build."],
      ["History trivia game", "Put their accumulated facts to use over a game with friends or family.", "history trivia board game", "Read some example questions: a broad world-history quiz and one centred on British monarchs will suit different groups. Choose a difficulty and playing time the other players will enjoy too."],
      ["Reproduction map print", "Choose a place with a connection to them: a home town, a favourite city or a journey.", "reproduction historical map print", "Check the map date, area covered and print size. Make sure it is described as a reproduction, and find out whether a frame is included or needs to be bought separately."],
      ["History or museum jigsaw", "Spend an afternoon piecing together a favourite painting, historic scene or collection.", "museum history jigsaw puzzle", "A familiar image gives this more meaning than a generic historic scene. Match the piece count and finished size to puzzles they enjoy, and look for a separate reference picture to work from."],
      ["History timeline chart", "See which events were happening at the same time in different parts of the world.", "history timeline wall chart", "A chart with readable text is worth more than one that crams in every date. Choose the regions and period first, then a wall poster or folding format to suit how they will use it."],
      ["Biography of a historical figure", "A closer look at someone from history they keep wanting to know more about.", "biography historical figure", "An accessible life story and an academic reassessment are different gifts. Read the introduction for the author's approach, and note the original publication date: a new cover may be a reissue."],
    ],
  },
  {
    slug: "gifts-for-tea-and-coffee-lovers",
    h1: "Gift ideas for tea and coffee lovers",
    desc: "Tea and coffee gifts chosen around how they brew, with checks for filters, grinders, cup sizes and tasting sets.",
    intro: "The most useful clue is how they make their usual drink. Loose-leaf tea, filter coffee and espresso need different equipment, and an enthusiast may already have a setup they like. Check what they use before adding to it.",
    tips: [
      "Check the brewing method before buying filters, beans or accessories. For ground coffee, the grind needs to suit their equipment.",
      "For mugs and travel cups, look at the size they actually use and whether they want a handle, a bag-safe lid or dishwasher cleaning.",
      "Ask about caffeine, flavours and dietary requirements before choosing a tasting set. Decaf and unflavoured options are worth checking too.",
    ],
    ideas: [
      ["Pour-over coffee dripper set", "For someone who enjoys weighing, pouring and adjusting their morning brew.", "pour over coffee dripper set", "Start with the brewer they use now, so you do not duplicate it. Filter shape and size vary between drippers; choose one with readily available filters that fits their mug or server."],
      ["Insulated travel mug", "For a slow coffee drinker or a journey that takes them away from the kettle.", "insulated travel mug", "Choose for the journey: a cup-holder mug can have a different lid from one intended for a bag. Look for a closure suited to how they carry it and a lid that comes apart for cleaning."],
      ["Loose-leaf teapot with infuser", "Make enough loose-leaf tea for a second cup or someone else at the table.", "teapot infuser loose leaf", "Work in cups rather than the size of the pot in a photograph. A removable basket lets them take the leaves out once brewed, and a wide opening makes washing up easier."],
      ["Hand coffee grinder", "For a coffee drinker who wants to grind a small batch of beans just before brewing.", "manual coffee grinder", "Match the adjustment range to their brewing method, especially for espresso. Check how much it holds and how it is adjusted; manual grinding also takes time and effort they may not want."],
      ["Handmade ceramic mug", "Choose a shape and glaze they would enjoy using for their usual tea or coffee.", "handmade ceramic mug", "Compare capacity and handle shape with a mug they already like. Confirm dishwasher and microwave suitability, and check whether you are buying the pictured item or one with handmade variations."],
      ["Handheld milk frother", "A small whisk for adding frothed milk to a home coffee or hot chocolate.", "handheld milk frother", "This type whisks milk but does not heat it. Choose a jug-style machine instead if they want both jobs done automatically; for a handheld whisk, allow for batteries if they are sold separately."],
      ["Tea tasting set", "Small portions let a tea drinker try several blends without committing to a large tin.", "tea tasting sampler gift set", "Match bagged or loose-leaf tea to what they use, then check caffeine, flavourings and allergens. Read how many servings are included; gift-box size tells you little about the amount of tea."],
      ["Coffee storage canister", "A dedicated home for the beans or grounds they buy regularly.", "coffee storage canister airtight", "Match the capacity to their usual bag of coffee. An easy-to-open seal is useful every morning; an oversized canister takes up cupboard space without helping someone who buys small batches."],
    ],
  },
  {
    slug: "gifts-for-mum",
    h1: "Gift ideas for mum",
    desc: "Gift ideas for mum based on her reading, cooking, home and downtime, with advice on fit, preferences and personalisation.",
    intro: "Think about what your mum looks forward to doing: reading a new novel, trying a recipe or getting stuck into a puzzle. A title she has mentioned or a photograph she wants to print gives you somewhere to start. Choose around her interests, rather than a label saying 'for mum'.",
    tips: [
      "Listen for a title, hobby or worn-out favourite she mentions. Specific clues are more useful than choosing something simply because it is labelled 'for mum'.",
      "For a personalised gift, check the spelling, photograph and order deadline yourself. Allow time to approve a proof rather than rushing the final step.",
      "Keep a receipt for clothing or comfort items. For scented products, ask what she uses rather than guessing from the packaging.",
    ],
    ideas: [
      ["Sofa throw", "A blanket for her favourite reading or television spot, in a colour she would choose herself.", "soft throw blanket sofa", "Choose a size she can get under, not just drape over the sofa arm. A washable fabric suits everyday use; a delicate decorative throw may need more care than she wants."],
      ["Personalised photo book", "Bring together photographs from a holiday, family occasion or another time she would enjoy looking back on.", "personalised photo book", "Use the original image files where possible and check every crop, caption and spelling. Leave time to review a proof, and read the seller's rules on corrections and returns for personalised orders."],
      ["Bath salts", "Something to add to a bath she already enjoys taking, rather than a new routine to adopt.", "bath salts gift set", "Use a familiar product as your guide to fragrance and ingredients. Read the use instructions, and choose a different gift if scented bath products are not something she likes."],
      ["Tea and mug gift set", "Her preferred tea and a mug she can wrap her hands around.", "mug tea gift set", "The tea matters more than the box. If no set has her usual blend and a mug of the right size, buy them separately. Read ingredients and allergen information for any added treats."],
      ["Book by a favourite author", "A new title from a writer she already enjoys, rather than a guess based on a bestseller list.", "novel paperback", "Check her shelves, e-reader or wish list before ordering. Match her preferred format and print size, and confirm the exact title and edition rather than buying by cover alone."],
      ["Cookbook in a cuisine she enjoys", "New recipes to explore if cooking is something she does for pleasure.", "cookbook", "Browse a few recipes: would she enjoy making them, and can she get the ingredients? Match her dietary preferences and available time, rather than choosing a book for the meals you hope she will cook."],
      ["Slippers", "A replacement for a worn pair, in the style she already finds comfortable.", "womens slippers", "Ask about open or closed backs, size and sole preference. Check the size chart and return policy, and keep the receipt: padding and fit are difficult to judge from a photograph."],
      ["Jigsaw puzzle", "Choose a picture she would enjoy spending time with, whether that is art, nature or a favourite place.", "jigsaw puzzle", "Match the piece count to puzzles she already enjoys and check the finished size against her table. Look for a clear reference image, particularly if she likes sorting pieces away between sessions."],
    ],
  },
  {
    slug: "gifts-for-dad",
    h1: "Gift ideas for dad",
    desc: "Gift ideas for dad, with practical checks for hobby equipment, books, storage, outdoor accessories and games.",
    intro: "Think about how your dad spends a free afternoon. A project he is working on, a subject he keeps reading about or an everyday item that is wearing out can point you towards a gift. Here are eight options, from something to take on a walk to a game you can play together.",
    tips: [
      "Ask which part of a hobby he enjoys before buying equipment. Owning a set of tools does not mean he wants another one.",
      "Check compatibility with what he owns: charging connections, storage sizes and existing speaker systems can rule out an otherwise useful gift.",
      "For food, drink or an experience, check preferences, dietary needs and dates. None is automatically a safer choice than a physical gift.",
    ],
    ideas: [
      ["Small-parts organiser", "For the screws, fittings or spare pieces that need a better home than a mixed drawer.", "compact tool organiser small parts", "Measure what he needs to store and where the box will live. Removable dividers help with different-sized parts; check that small items cannot spill between compartments when it is carried."],
      ["Insulated flask", "For a drink on a walk, at an outdoor match or during a day away from the kettle.", "insulated flask", "Choose capacity around the number of drinks he wants to take. Check empty weight, lid design and cleaning instructions; a large flask with a cup lid serves a different purpose from a travel mug."],
      ["History book", "More on the period or event he stops to read about whenever it comes up.", "history book non fiction", "Ask what he wants to know more about, then look through sample pages. A readable account of one event may suit him better than a broad overview; a glance at his shelves will help avoid duplicates."],
      ["Rechargeable head torch", "Light for a job or outdoor activity where he needs both hands free.", "rechargeable head torch", "Simple controls and a useful low setting can matter more than maximum brightness. Choose a weight he will be happy wearing, and confirm the charging connection fits the cables he uses."],
      ["Whisky tasting glasses", "A pair of glasses for comparing whiskies he already enjoys.", "whisky tasting glasses", "Take a cue from the glasses he uses: a tasting shape and a heavy tumbler feel quite different. Confirm the quantity and washing instructions. The search is for glasses, not whisky."],
      ["Wallet", "A replacement if his current one is worn and you know which layout he likes.", "mens wallet", "Check whether he uses notes, coins and cards, then compare dimensions with his current wallet. Keep the receipt and match his material preference rather than assuming leather or a slimmer design is better."],
      ["Two-player board game", "A game to open and play together, with no need to gather a large group.", "two player board game", "Look for accounts of playing with exactly two people, not just a box marked 'two or more'. Choose a theme and rules both of you will enjoy, with time for a full game."],
      ["Portable Bluetooth speaker", "For music or spoken-word audio somewhere his usual speakers do not reach.", "portable bluetooth speaker", "Ask what he uses now and whether it needs to connect to an existing system. Compare weight, charging connection and stated battery life; check any water-resistance rating for the intended location."],
    ],
  },
  {
    slug: "secret-santa-gifts-under-10",
    h1: "Secret Santa ideas for a £10 budget",
    desc: "Eight Secret Santa ideas to look for within a £10 budget. These are not verified offers: check the full price, including delivery.",
    intro: "Start with one thing you know about them: the tea they bring to work, a desk full of plants or a fondness for puzzles. These are gift types to look for, not checked offers at today's prices. Include delivery in your £10 limit, and choose a different idea if the suitable options cost too much.",
    tips: [
      "Use one thing you know about them, such as their tea break, desk plants or favourite kind of puzzle. Avoid personal jokes unless you are certain they will enjoy them.",
      "Spend on the gift rather than elaborate packaging. One useful item is enough; there is no need to add extras that take you over the limit.",
      "Check allergies before buying food, and sizes before buying socks. If you cannot ask, choose something that does not depend on either.",
    ],
    ideas: [
      ["Small plant pot", "Room for the next cutting on a plant lover's desk or windowsill.", "mini desk plant pot", "Choose around the pot they want to put inside it: the internal width matters more than the outside measurement. A decorative cover pot needs an inner pot with drainage. Plants are not necessarily included."],
      ["Notebook and pen", "Somewhere for lists, meeting notes or the idea that turns up on the bus home.", "notebook pen gift set", "Pick lined, dotted or plain paper to suit how they write. A simple set avoids spending most of the budget on packaging; include delivery when comparing the total."],
      ["Tea infuser basket", "An extra infuser for someone who likes loose-leaf tea at work as well as at home.", "tea infuser basket", "A basket that rests on the mug rim is easy to lift out after brewing. Measure the mug opening for fit, and look for a lid that doubles as somewhere to put the wet basket."],
      ["Pocket card game", "A game to bring out over lunch or take home for the holidays.", "pocket card game", "Read sample cards to judge whether the humour and rules suit the group. A short playing time helps at lunch; enough players for their usual gathering matters more than the size of the box."],
      ["Small unscented candle", "An option if you know they use candles but do not know their favourite fragrance.", "small unscented candle", "Confirm it is unscented and check its actual size, not the scale of the display photo. Choose one with clear safe-use instructions. A candle still needs a suitable place to burn and supervision."],
      ["Festive socks", "A seasonal pattern for someone who gets out their Christmas jumper every year.", "festive socks", "Buy only if you know their size and would expect them to wear the pattern. Fibre content and washing instructions are worth reading: a festive pair still needs to be comfortable."],
      ["Puzzle cube", "A hands-on challenge for someone who enjoys working out patterns and sequences.", "puzzle cube", "Check the puzzle type and difficulty against what they already enjoy. Look for clear instructions or access to a solution, and check age guidance if the gift exchange includes children."],
      ["Reusable coffee cup", "A spare for someone who regularly takes a cup on their coffee run.", "reusable coffee cup lid", "Match the capacity to their usual order. A sip lid may be fine carried upright but unsuitable loose in a bag. If the right type costs more than £10 delivered, choose another idea."],
    ],
  },
  {
    slug: "gifts-for-book-lovers",
    h1: "Gift ideas for book lovers",
    desc: "Gifts for readers, from book lights to journals, with practical advice on book sizes, reading habits and shelf space.",
    intro: "Think about where you usually find them with a book. A paperback tucked into a commuting bag, a hardback at the kitchen table and an e-reader at bedtime call for different extras. These ideas work best when they fit the way someone already reads.",
    tips: [
      "Check whether they mostly read paper books, e-books or audiobooks before choosing an accessory.",
      "For anything that holds or covers a book, measure the format they actually use. A large hardback can rule out a sleeve or support.",
      "If you would rather give a book, use their wish list or ask for a recommendation in a subject they enjoy. Keep a gift receipt to avoid duplicates.",
    ],
    ideas: [
      ["Clip-on reading light", "Light that can travel with a paper book from the armchair to the bedside.", "clip on book reading light rechargeable", "A light clip is kinder to paperback pages than a heavy lamp pulling on the cover. Look for an adjustable low setting for bedtime and a power source they can recharge or replace easily."],
      ["Flat bookmark", "A favourite colour, book cover or illustration to mark their place.", "flat bookmark", "Keep it thin enough for the book to close comfortably. Thick charms and long decorations can get in the way inside a bag, even when they look attractive in the gift box."],
      ["Padded book sleeve", "A cover for the paperback that shares a bag with keys, lunch and everything else.", "book sleeve padded", "Measure a book they carry and compare the sleeve's internal dimensions, leaving room for its thickness. 'Standard book size' varies between sellers; a closure helps keep the book inside."],
      ["Book-support cushion", "A resting place for a heavy book during a long reading session.", "book support cushion", "Ask whether they would use a support before choosing one. The angle and page-holding design need to suit their reading position and book size, and a removable washable cover is useful."],
      ["Literary tote bag", "Something to take to the library, with a design from a book or writer they love.", "literary tote bag canvas", "Think about the books going inside: a tall hardback needs depth, and a full bag needs sturdy stitching. Choose handles long enough for how they carry it; an inner pocket can keep keys separate."],
      ["Bookends", "For a shelf of books that needs support at one end or room to grow.", "bookends", "Match the height and weight to their books and check shelf depth. A non-marking base is useful, but very light decorative bookends may not support a row of large hardbacks."],
      ["Reading throw", "A blanket for reading at home when the story is good but the room is chilly.", "washable throw blanket", "Choose enough length to cover their legs rather than a small decorative square. A familiar fabric and a straightforward care label make this easier to use than a delicate throw that needs special washing."],
      ["Reading journal", "Somewhere to remember a favourite line, record a recommendation or work out what to read next.", "reading journal book log", "Look inside: some journals are full of ratings and targets, while others leave room for notes. Choose the layout that suits them, with enough entries for the amount they read."],
    ],
  },
];

GUIDES.push(
  {
    slug: "gifts-for-coffee-lovers-under-30", h1: "Gift ideas for coffee lovers under £30",
    desc: "Coffee gift ideas to search for within £30, with advice on equipment compatibility, roast preferences and the delivered total.",
    intro: "A £30 cap can go further when you know their daily coffee routine. Start with what they brew, not an expensive machine upgrade. These are ideas to search for, not confirmed offers under £30; include delivery in the final total.",
    finderTopic: "coffee", budget: 30, category: "Kitchen",
    tips: [
      "Ask whether they use whole beans, ground coffee, capsules or instant. A gift in the wrong format can become an unused extra.",
      "For brewing accessories, check their machine or dripper model. Basket size, filter shape and capsule systems are not interchangeable.",
      "Keep the delivered total within £30. If the correct accessory costs more, choose a small sampler rather than a cheaper incompatible version.",
    ],
    ideas: [
      ["Small coffee sampler", "A few coffees to try without committing to a large bag.", "coffee sampler small gift", "Choose beans or the correct grind for their brewer. Check bag weights, roast dates and whether any delivery subscription is attached."],
      ["Manual pour-over dripper", "A different brewing method for someone who enjoys making coffee by hand.", "manual pour over coffee dripper", "Check filter availability and mug fit. A dripper may need separate filters and a pouring kettle; do not treat those extras as included."],
      ["Coffee bean storage tin", "Somewhere to keep a modest bag of their usual beans.", "coffee storage tin airtight", "Compare usable capacity with their regular bag. Avoid unverified promises that the tin will keep coffee fresh for a particular number of weeks."],
      ["Coffee scoop", "A simple accessory for the person who makes the same cup every morning.", "coffee measuring scoop", "Check the handle length and jar opening. Scoop volume is not a precise substitute for weighing coffee."],
      ["Coffee brewing notebook", "A place to note beans, grind settings and recipes they want to repeat.", "coffee brewing notebook", "Look inside for useful spaces rather than pages of advertising. Choose this only if they enjoy recording a brew."],
      ["Small milk frothing jug", "An accessory for someone whose espresso setup already steams milk.", "stainless steel milk frothing jug", "Check jug capacity and the space under their steam wand. The jug does not froth milk on its own."],
      ["Reusable takeaway cup", "A cup for their regular coffee run.", "reusable coffee cup", "Match capacity, cleaning requirements and how they carry it. A sip lid may not be leakproof inside a bag."],
      ["Coffee tasting book", "Ideas for exploring coffee without adding more kitchen equipment.", "coffee tasting guide book", "Read a sample to judge whether it suits a beginner or experienced brewer. Books can overlap with one they already own."],
    ],
  },
  {
    slug: "gifts-for-gardeners-under-30", h1: "Gift ideas for gardeners under £30",
    desc: "Small gardening gifts to look for within £30, with advice on plot size, tools they own and practical material choices.",
    intro: "For a gardener who already owns the big tools, a small useful extra can be enough. Match the gift to their containers, borders or allotment. These suggestions are not live price offers: check the correct size and delivery before treating anything as within £30.",
    finderTopic: "gardening", budget: 30, category: "Outdoors & sport",
    tips: [
      "Find out whether they grow indoors, on a balcony or in a larger garden. Storage space and weather exposure change what is useful.",
      "Check which tools and gloves they already use. A small accessory is not automatically a welcome replacement for a favourite tool.",
      "For seeds, check their growing space, sowing season and preferences. Choose packets for plants they actually want to grow.",
    ],
    ideas: [
      ["Weatherproof plant labels", "Markers for rows or pots whose contents are easy to forget.", "weatherproof plant labels", "Check label length, writing surface and whether a suitable marker is included. Labels should suit the pots or beds they use."],
      ["Garden twine tin", "Twine for tying in plants, with a container to keep it together.", "garden twine tin", "Compare twine length and material, not just the decoration on the tin. Check whether the container is refillable."],
      ["Seed storage envelopes", "Somewhere to organise the seeds they collect.", "seed storage envelopes", "Paper envelopes need dry storage; they are not weatherproof. Choose a size that leaves room for labelling and dates."],
      ["Plant pot brush", "A small brush for cleaning pots before they are reused.", "plant pot cleaning brush", "Check brush dimensions and bristle material against the pots they own. Follow their normal cleaning routine rather than claiming the brush disinfects."],
      ["Garden kneeling pad", "Padding for jobs carried out close to the ground.", "garden kneeling pad", "Check dimensions, material and ease of cleaning. Do not imply medical benefits or confuse a pad with a kneeler-seat."],
      ["Gardening notebook", "A record of sowing dates, successes and things to try next season.", "gardening notebook", "Choose a layout suited to notes or plans, not just a decorative cover. A notebook is not a substitute for local planting guidance."],
      ["Small watering can", "A can suited to indoor plants or a compact growing space.", "small watering can indoor plants", "Check capacity and spout access around their plants. A decorative can may be inconvenient to fill or clean."],
      ["Personalised herb markers", "Labels for herbs they grow and use in the kitchen.", "personalised herb garden markers", "Check spelling, number of markers and outdoor suitability. Personalisation can add cost and dispatch time; confirm the delivered total."],
    ],
  },
  {
    slug: "gifts-for-personalised-gifts-under-30", h1: "Personalised gift ideas under £30",
    desc: "Personalised gift ideas to search for within £30, with advice on spelling, customisation charges, dispatch dates and cancellation rights.",
    intro: "A personal touch works best when it improves something they already enjoy. Independent makers offer different materials and layouts, so compare the finished item rather than the preview image alone. None of these are verified £30 offers: personalisation and delivery can change the total.",
    finderTopic: "personalised", budget: 30, category: "Stationery",
    tips: [
      "Check the spelling and design directly with the seller. Do not enter names into Santa's Helper; personalisation details belong in the retailer's checkout.",
      "Read dispatch estimates before ordering. Custom-made items may take longer and have different cancellation rights.",
      "Check whether engraving, extra characters, proofs and gift packaging cost more. Keep the entire delivered order within your cap.",
    ],
    ideas: [
      ["Personalised notebook", "A cover design for someone who already enjoys keeping notes.", "personalised notebook", "Check page ruling, size and binding before choosing the cover. Look for a preview or proof process and a clear character limit."],
      ["Personalised bookmark", "A small marker for a regular paper-book reader.", "personalised flat bookmark", "Keep it thin enough for the book to close. Check whether the lettering is engraved, printed or applied and whether a tassel adds bulk."],
      ["Personalised herb markers", "Named markers for the herbs they grow.", "personalised herb garden markers", "Choose only the herb names they need. Check outdoor suitability and whether the quoted price is per marker or for the full set."],
      ["Personalised pencil case", "A case for the pens or art supplies they use.", "personalised pencil case", "Compare internal dimensions with their longest tools. Check whether supplies are included; most listings sell only the case."],
      ["Personalised reading journal", "A place to record books and recommendations.", "personalised reading journal", "Read sample pages to check the layout. Some readers prefer blank notes to ratings and reading targets."],
      ["Personalised keyring", "A small design associated with a hobby or shared memory.", "personalised keyring", "Check the size and attachment hardware. Avoid adding identifying address details, and make sure it will not be cumbersome in a pocket."],
      ["Personalised mug", "A design for their usual tea or coffee break.", "personalised ceramic mug", "Check capacity, handle shape and care instructions. Personalised printing may have different dishwasher guidance from the underlying mug."],
      ["Personalised tote bag", "A bag for a hobby, library visit or everyday errands.", "personalised cotton tote bag", "Check fabric weight, handle length and usable depth. A printed mock-up does not show the bag's carrying capacity."],
    ],
  },
);

const HEADER = home.match(/<header class="masthead">[\s\S]*?<\/header>/)?.[0];
const FOOTER = home.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
if (!HEADER || !FOOTER) throw new Error("The homepage must provide the shared masthead and footer.");

const EDITS = {
  "gifts-for-coffee-lovers-under-30": { art: "coffee", title: "Coffee gifts within £30", label: "Small coffee extras", description: "AI-created scene of a teapot, cafetiere and coffee brewing accessories", group: "budget", tone: "oat" },
  "gifts-for-gardeners-under-30": { art: "garden", title: "Garden gifts within £30", label: "Useful garden extras", description: "AI-created scene of garden secateurs, gloves, seed envelopes and potted rosemary", group: "budget", tone: "sage" },
  "gifts-for-personalised-gifts-under-30": { art: "books", title: "Personal touches within £30", label: "Independent maker ideas", description: "AI-created scene of books, a reading journal and stationery accessories", group: "budget", tone: "clay" },
  "gifts-for-4-year-olds": { art: "play", title: "For little imaginations", label: "Play & making", description: "AI-created scene of a wooden toy train, building blocks and colouring pencils", group: "family", tone: "clay" },
  "gifts-for-new-babies": { art: "baby", title: "For a new arrival", label: "The first Christmas", description: "AI-created scene of a teddy bear, picture book and wooden rattle on a folded blanket", group: "family", tone: "clay" },
  "gifts-for-space-lovers": { art: "space", title: "For the stargazer", label: "After dark", description: "AI-created scene of a cream telescope on a wooden tripod, brass globe and blue star journal", group: "interests", tone: "sage" },
  "gifts-for-gardeners": { art: "garden", title: "For the gardener", label: "Out in the garden", description: "AI-created scene of garden secateurs, gloves, seed envelopes and potted rosemary", group: "interests", tone: "sage" },
  "gifts-for-history-lovers": { art: "history", title: "For the history lover", label: "Another time & place", description: "AI-created scene of a classical temple model, old map, magnifying glass and leatherbound books", group: "interests", tone: "oat" },
  "gifts-for-tea-and-coffee-lovers": { art: "coffee", title: "For the tea & coffee lover", label: "The morning ritual", description: "AI-created scene of a cafetiere, green ceramic teapot and stoneware cup in morning light", group: "interests", tone: "oat" },
  "gifts-for-mum": { art: "mum", title: "For mum", label: "Her kind of Christmas", description: "AI-created scene of a linen journal, amber candle, cup of tea and ribbon-tied present", group: "family", tone: "clay" },
  "gifts-for-dad": { art: "dad", title: "For dad", label: "His kind of Christmas", description: "AI-created scene of an olive coffee flask, leather headphones, charcoal notebook and binoculars", group: "family", tone: "sage" },
  "secret-santa-gifts-under-10": { art: "gesture", title: "Secret Santa on a £10 budget", label: "A £10 budget", description: "AI-created scene of a small kraft-paper present, houseplant, mug and pocket notebook", group: "budget", tone: "clay" },
  "gifts-for-book-lovers": { art: "books", title: "For the book lover", label: "One more chapter", description: "AI-created scene of an open book, clothbound books, reading glasses and stoneware cup", group: "interests", tone: "oat" },
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
    : "(max-width: 600px) calc(100vw - 48px), (max-width: 760px) 92vw, (max-width: 1100px) 40vw, 512px";
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
<meta name="color-scheme" content="only light">
<meta name="theme-color" content="#FBF7F0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/theme.css">
<link rel="stylesheet" href="/guide.css">
<link rel="stylesheet" href="/monetization.css">
<script type="module" src="/site-shell.js"></script>
<script type="module" src="/monetization-shell.js"></script>
${extra}</head>
<body${path === "/gifts/" ? ' class="christmas-canvas"' : ""}>
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
<div class="guide-intro"><div><h1>${esc(g.h1)}</h1><p class="standfirst">${esc(g.intro)}</p><nav class="guide-jumps" aria-label="On this page"><a href="#gift-ideas">Browse the ideas <span aria-hidden="true">&darr;</span></a><a href="#choosing">Before you choose</a></nav></div>${art(g)}</div>
<section class="choosing" id="choosing" aria-labelledby="choosing-title"><div><h2 id="choosing-title">Narrow down<br>the options.</h2></div><ul>${g.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>
<section id="gift-ideas" aria-labelledby="ideas-title">
<div class="ideas-heading"><div><h2 id="ideas-title">Eight options to consider</h2></div></div>
<p class="disclosure">Ad: Amazon shopping links are affiliate links. We may earn a commission if you buy through affiliate links. eBay links ${EBAY_CAMPAIGN_ID ? "are also affiliate links" : "are ordinary search links until our Partner Network campaign is configured"}. Alternative retailer links may also use approved affiliate programmes. These links search the named retailer, not a specific product we have checked or tested. Check the listing and total price, including delivery. The images are AI-created illustrations, not photos of products we've tested.</p>
<div class="idea-grid">
${g.ideas.map(([name, why, q, note], i) => {
    if (!note) throw new Error(`Missing buying advice: ${g.slug} / ${name}`);
    const links = retailerLinks({ title: name, query: q }, AFFILIATE_CONFIG).map((link) => {
      const merchant = ["amazon", "ebay"].includes(link.merchantId) ? `${link.name} UK` : link.name;
      const recipient = g.recipient || (g.slug.includes("mum") ? "mum" : g.slug.includes("dad") ? "dad" : "other");
      return `<a href="${esc(link.href)}" rel="sponsored noopener noreferrer" target="_blank" data-query="${esc(q)}" data-network="${esc(link.network)}" data-category="${esc(g.category || "Home")}" data-recipient="${esc(recipient)}" aria-label="${esc(`Search ${merchant} for ${name} (${link.affiliate ? "affiliate link, " : ""}opens in a new tab)`)}">Search ${esc(merchant)} <span aria-hidden="true">&nearr;</span></a>`;
    }).join("");
    return `<article class="idea"><span class="idea-number">${String(i + 1).padStart(2, "0")}</span><h3>${esc(name)}</h3><p class="idea-why">${esc(why)}</p><p class="buying-note"><strong>What to look for</strong>${esc(note)}</p><div class="merchant-links">${links}</div></article>`;
  }).join("\n")}
</div></section>
<aside class="finder-cta"><div><h2>Tell us what they're like.</h2><p>The gift finder uses their interests, what they already own and your budget to suggest ideas. Leave out names and sensitive details.</p></div><a href="/#${g.finderTopic ? `finder=${esc(g.finderTopic)}&amp;budget=${g.budget}` : "form"}">Find ideas for them <span aria-hidden="true">&rarr;</span></a></aside>
<section class="related-guides" aria-labelledby="more-guides"><div class="ideas-heading"><h2 id="more-guides">Still looking? Try these</h2><a href="/gifts/">Browse all the guides <span aria-hidden="true">&rarr;</span></a></div><ul class="related-shelf">${related.map(guideLink).join("")}</ul></section>
</main>
${FOOTER}
</body>
</html>
`;
}

function indexPage() {
  return head("Gift guides | Santa's Helper", `${GUIDES.length} gift guides with eight ideas each, plus practical buying advice for interests, family gifts and smaller budgets.`, "/gifts/",
    '<link rel="preload" as="image" href="/images/guides-canvas-1000.webp" media="(max-width:1000px)" fetchpriority="high" imagesrcset="/images/guides-canvas-1000.webp 1x, /images/guides-canvas-2048.webp 2x">\n<link rel="preload" as="image" href="/images/guides-canvas-2048.webp" media="(min-width:1001px)" fetchpriority="high">\n').replace('class="wrap guide-page"', 'class="guide-page directory-page"') +
`<div class="directory-intro wrap"><div class="directory-banner-copy"><h1>Gift guides</h1><p class="directory-count">${GUIDES.length} guides to browse</p></div></div>
<div class="wrap">
<nav class="directory-jumps" aria-label="Browse guides by"><a href="#interests">Their interests <span aria-hidden="true">&darr;</span></a><a href="#family">Family gifts <span aria-hidden="true">&darr;</span></a><a href="#budget">A £10 budget <span aria-hidden="true">&darr;</span></a></nav>
<p class="disclosure">The guide images are AI-created illustrations, not photos of products we've tested.</p>
${[["interests", "Start with what they enjoy"], ["family", "Gifts for the family"], ["budget", "Secret Santa on a £10 budget"]].map(([group, title]) => `<section class="directory-section" id="${group}" aria-labelledby="${group}-title"><div class="directory-section-heading"><h2 id="${group}-title">${title}</h2></div><ul class="guide-directory">${GUIDES.filter((g) => EDITS[g.slug].group === group).map(guideLink).join("")}</ul></section>`).join("\n")}
<aside class="finder-cta"><div><h2>Try the gift finder.</h2><p>Describe what they enjoy, add your budget and mention anything they already own or would rather not receive.</p></div><a href="/#form">Find gift ideas <span aria-hidden="true">&rarr;</span></a></aside>
</div>
</main>
${FOOTER}
</body>
</html>
`;
}

function notFoundPage() {
  return head("Page not found | Santa's Helper", "That page could not be found.", "/404.html").replace(
    '<link rel="canonical" href="https://christmasidea.co.uk/404.html">\n', "<meta name=\"robots\" content=\"noindex\">\n") +
`<div class="not-found"><h1>We can't find<br>that page.</h1><div class="guide-jumps"><a href="/#form">Find a gift <span aria-hidden="true">&rarr;</span></a><a href="/gifts/">Browse the gift guides</a></div></div>
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
    .replace(/<meta name="color-scheme"[^>]*>\s*/g, "")
    .replace("</head>", '<meta name="color-scheme" content="only light">\n<meta name="theme-color" content="#FBF7F0">\n</head>')
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
