import { deriveRecipient } from "./recipient.js";
import { CATEGORIES } from "./constants.js";
import { curateIdeas } from "./validate.js";

export const CATALOGUE = [
  {
    "p": "coffee beans",
    "t": "Speciality coffee sampler",
    "q": "speciality coffee beans gift set",
    "c": "Food & treats",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "coffee",
      "espresso",
      "barista",
      "cafe"
    ],
    "w": "A tour of roasts they wouldn't pick up themselves, perfect for a coffee lover who already has the kit."
  },
  {
    "p": "pour over coffee",
    "t": "Manual pour-over coffee kit",
    "q": "pour over coffee set dripper",
    "c": "Kitchen",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "coffee",
      "barista",
      "slow mornings"
    ],
    "w": "Turns the morning brew into a small ritual and makes a noticeably better cup."
  },
  {
    "p": "loose leaf tea",
    "t": "Loose-leaf tea discovery box",
    "q": "loose leaf tea gift set",
    "c": "Food & treats",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "tea",
      "calm",
      "reading",
      "cosy"
    ],
    "w": "A curated mix of teas to try, ideal for someone who unwinds with a pot on the go."
  },
  {
    "p": "hot sauce",
    "t": "Hot sauce tasting set",
    "q": "hot sauce gift set",
    "c": "Food & treats",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "spicy",
      "chilli",
      "hot sauce",
      "bbq",
      "cooking",
      "food"
    ],
    "w": "Several heat levels to work through, great for anyone who puts chilli on everything."
  },
  {
    "p": "sourdough bread",
    "t": "Sourdough baking starter kit",
    "q": "sourdough starter kit banneton",
    "c": "Kitchen",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "baking",
      "bread",
      "sourdough",
      "cooking",
      "bake off"
    ],
    "w": "Everything they need to get going with proper bread, with a banneton for that bakery look."
  },
  {
    "p": "cast iron skillet",
    "t": "Cast iron skillet",
    "q": "cast iron skillet pre seasoned",
    "c": "Kitchen",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "cooking",
      "steak",
      "camping",
      "chef",
      "food"
    ],
    "w": "A pan that lasts a lifetime and gets better with use, loved by keen home cooks."
  },
  {
    "p": "fresh pasta",
    "t": "Pasta making kit",
    "q": "pasta maker machine",
    "c": "Kitchen",
    "a": [
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "italian",
      "pasta",
      "cooking",
      "italy",
      "food"
    ],
    "w": "Fresh pasta from scratch is a fun weekend project and a real step up from dried."
  },
  {
    "p": "cocktail shaker",
    "t": "Cocktail shaker set",
    "q": "cocktail shaker set bar tools",
    "c": "Kitchen",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "cocktails",
      "hosting",
      "parties",
      "gin",
      "mixology"
    ],
    "w": "Bar tools for the friend who loves hosting, ready for mocktails or cocktails."
  },
  {
    "p": "homemade pizza",
    "t": "Pizza oven peel and stone set",
    "q": "pizza stone and peel set",
    "c": "Kitchen",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "pizza",
      "cooking",
      "bbq",
      "garden"
    ],
    "w": "Crisp-based pizza in a normal oven or on the barbecue, an easy upgrade for pizza fans."
  },
  {
    "p": "sea swimming",
    "t": "Dry robe style changing poncho",
    "q": "waterproof changing robe swimming",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "wild swimming",
      "swimming",
      "sea",
      "surf",
      "surfing",
      "beach",
      "paddleboard",
      "cold water"
    ],
    "w": "Keeps them warm and covered when getting changed on a windy beach after a swim."
  },
  {
    "p": "thermos flask",
    "t": "Insulated flask",
    "q": "insulated stainless steel flask 500ml",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "walking",
      "hiking",
      "camping",
      "fishing",
      "swimming",
      "outdoors",
      "commute"
    ],
    "w": "Hot drinks for hours on cold walks, swims or early starts. A gift that gets used every week."
  },
  {
    "p": "headlamp night",
    "t": "Head torch",
    "q": "rechargeable head torch",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "running",
      "camping",
      "hiking",
      "fishing",
      "outdoors",
      "night"
    ],
    "w": "Hands-free light for winter runs, camping and finding things in the dark."
  },
  {
    "p": "hiking backpack",
    "t": "Hiking day pack",
    "q": "hiking daypack 20l",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "hiking",
      "walking",
      "outdoors",
      "mountains",
      "travel"
    ],
    "w": "A comfortable, well-organised bag for long days on the trails."
  },
  {
    "p": "night running",
    "t": "Running belt and reflective kit",
    "q": "running belt reflective",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "running",
      "marathon",
      "parkrun",
      "jogging",
      "fitness"
    ],
    "w": "Keeps phone and keys secure and makes them visible on dark winter runs."
  },
  {
    "p": "foam roller",
    "t": "Foam roller and massage ball set",
    "q": "foam roller massage ball set",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "running",
      "gym",
      "fitness",
      "cycling",
      "yoga",
      "football"
    ],
    "w": "Helps sore muscles recover after training. Useful for anyone who exercises a lot."
  },
  {
    "p": "yoga mat",
    "t": "Yoga mat and block set",
    "q": "yoga mat with blocks strap",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "yoga",
      "pilates",
      "stretching",
      "fitness",
      "wellness"
    ],
    "w": "A good grippy mat makes practice at home far more comfortable."
  },
  {
    "p": "bicycle repair",
    "t": "Bike multitool and repair kit",
    "q": "bike multi tool puncture repair kit",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "cycling",
      "bike",
      "mountain biking",
      "commute"
    ],
    "w": "Fixes most roadside problems so they're never stranded mid ride."
  },
  {
    "p": "garden bird feeder",
    "t": "Bird feeder with camera",
    "q": "smart bird feeder camera",
    "c": "Outdoors & sport",
    "a": [
      "adult"
    ],
    "b": [
      "hi"
    ],
    "k": [
      "birds",
      "birdwatching",
      "nature",
      "wildlife",
      "garden"
    ],
    "w": "Captures close-up photos of garden visitors, a delight for any bird lover."
  },
  {
    "p": "binoculars nature",
    "t": "Binoculars for nature watching",
    "q": "compact binoculars 10x42",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "birds",
      "birdwatching",
      "nature",
      "wildlife",
      "hiking"
    ],
    "w": "Brings wildlife and views up close on walks and holidays."
  },
  {
    "p": "gardening tools",
    "t": "Gardening tool set with kneeler",
    "q": "gardening tool set kneeler",
    "c": "Outdoors & sport",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "gardening",
      "garden",
      "plants",
      "allotment",
      "growing"
    ],
    "w": "Sturdy hand tools and a kneeler to save their knees in the garden."
  },
  {
    "p": "herb pots",
    "t": "Grow-your-own herb kit",
    "q": "indoor herb growing kit",
    "c": "Home",
    "a": [
      "kid",
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "gardening",
      "plants",
      "cooking",
      "growing",
      "nature"
    ],
    "w": "Fresh herbs on the windowsill, satisfying to grow and handy in the kitchen."
  },
  {
    "p": "fishing tackle",
    "t": "Fishing tackle box organiser",
    "q": "fishing tackle box organiser",
    "c": "Outdoors & sport",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "fishing",
      "angling",
      "carp",
      "sea fishing"
    ],
    "w": "Keeps lures and hooks sorted so less time is spent untangling and more time fishing."
  },
  {
    "p": "football training",
    "t": "Football training set",
    "q": "football training cones ladder set",
    "c": "Outdoors & sport",
    "a": [
      "kid",
      "teen"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "football",
      "soccer",
      "sport",
      "training"
    ],
    "w": "Cones and an agility ladder for practising skills in the garden or park."
  },
  {
    "p": "wireless earbuds",
    "t": "Wireless earbuds",
    "q": "wireless earbuds noise cancelling",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "music",
      "podcasts",
      "running",
      "gym",
      "commute",
      "tech"
    ],
    "w": "Freedom from tangled cables for music, podcasts and calls on the go."
  },
  {
    "p": "bluetooth speaker",
    "t": "Portable Bluetooth speaker",
    "q": "portable bluetooth speaker waterproof",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "music",
      "parties",
      "beach",
      "camping",
      "festivals"
    ],
    "w": "Good sound anywhere, from the kitchen to the beach."
  },
  {
    "p": "mechanical keyboard",
    "t": "Mechanical keyboard",
    "q": "mechanical keyboard",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "gaming",
      "coding",
      "programming",
      "pc",
      "computers",
      "writing",
      "tech"
    ],
    "w": "Satisfying to type on, a favourite upgrade for gamers, coders and writers."
  },
  {
    "p": "gaming headset",
    "t": "Gaming headset",
    "q": "gaming headset with microphone",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "gaming",
      "xbox",
      "playstation",
      "ps5",
      "pc",
      "fortnite",
      "minecraft"
    ],
    "w": "Clear chat and immersive sound for online games with friends."
  },
  {
    "p": "game controller",
    "t": "Controller charging dock",
    "q": "controller charging station",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "gaming",
      "xbox",
      "playstation",
      "ps5",
      "console"
    ],
    "w": "No more flat controllers mid game, and a tidier setup."
  },
  {
    "p": "smart home",
    "t": "Smart plug starter pack",
    "q": "smart plug alexa compatible 4 pack",
    "c": "Tech",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "smart home",
      "tech",
      "gadgets",
      "alexa",
      "home"
    ],
    "w": "An easy first step into a smart home, controlling lamps and gadgets from their phone."
  },
  {
    "p": "arduino electronics",
    "t": "Electronics starter kit",
    "q": "arduino starter kit",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "electronics",
      "coding",
      "programming",
      "arduino",
      "raspberry pi",
      "engineering",
      "maker",
      "robotics"
    ],
    "w": "Hands-on projects with lights, sensors and motors, a brilliant way to learn by building."
  },
  {
    "p": "smartphone tripod",
    "t": "Phone tripod with remote",
    "q": "phone tripod bluetooth remote",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "photography",
      "tiktok",
      "youtube",
      "content",
      "vlogging",
      "travel"
    ],
    "w": "Steady shots and group photos without asking strangers, handy for creators."
  },
  {
    "p": "instant camera",
    "t": "Instant camera",
    "q": "instant camera film",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "photography",
      "photos",
      "memories",
      "travel",
      "parties",
      "scrapbook"
    ],
    "w": "Prints photos on the spot, a fun way to capture nights out and trips."
  },
  {
    "p": "ereader reading",
    "t": "E-reader",
    "q": "e reader waterproof",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "hi"
    ],
    "k": [
      "reading",
      "books",
      "novels",
      "travel",
      "commute"
    ],
    "w": "A whole library in one light device, easy on the eyes and perfect for travel."
  },
  {
    "p": "handheld game console",
    "t": "Retro handheld games console",
    "q": "retro handheld game console",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "retro",
      "gaming",
      "nintendo",
      "arcade",
      "nostalgia"
    ],
    "w": "Classic-style gaming they can play anywhere, a nostalgic treat."
  },
  {
    "p": "watercolour painting",
    "t": "Watercolour starter set",
    "q": "watercolour paint set beginners",
    "c": "Hobbies & crafts",
    "a": [
      "kid",
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "art",
      "painting",
      "drawing",
      "watercolour",
      "creative",
      "sketching"
    ],
    "w": "Quality paints, brushes and paper for someone who'd love to try painting properly."
  },
  {
    "p": "calligraphy pen",
    "t": "Brush pen calligraphy kit",
    "q": "calligraphy brush pen set beginners",
    "c": "Hobbies & crafts",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "calligraphy",
      "lettering",
      "journaling",
      "art",
      "stationery",
      "bullet journal"
    ],
    "w": "A relaxing hobby with instant results, lovely for cards and journals."
  },
  {
    "p": "embroidery hoop",
    "t": "Embroidery starter kit",
    "q": "embroidery kit beginners",
    "c": "Hobbies & crafts",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "sewing",
      "embroidery",
      "crafts",
      "stitching",
      "knitting",
      "creative"
    ],
    "w": "A calming project with everything included, ending in something they can hang or gift."
  },
  {
    "p": "knitting yarn",
    "t": "Knitting kit for beginners",
    "q": "knitting kit beginners",
    "c": "Hobbies & crafts",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "knitting",
      "crochet",
      "wool",
      "crafts",
      "cosy"
    ],
    "w": "Needles, yarn and a pattern so they can make their first scarf or hat."
  },
  {
    "p": "pottery clay",
    "t": "Air-dry clay sculpting set",
    "q": "air dry clay kit with tools",
    "c": "Hobbies & crafts",
    "a": [
      "kid",
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "pottery",
      "clay",
      "sculpting",
      "art",
      "crafts",
      "creative"
    ],
    "w": "Pottery-style making without a kiln, great for trinket dishes and small figures."
  },
  {
    "p": "wooden model",
    "t": "Model building kit",
    "q": "wooden 3d model kit adults",
    "c": "Hobbies & crafts",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "models",
      "building",
      "engineering",
      "lego",
      "puzzles",
      "trains",
      "history"
    ],
    "w": "A detailed build that keeps hands busy for hours and looks great finished."
  },
  {
    "p": "jigsaw puzzle",
    "t": "1000-piece jigsaw puzzle",
    "q": "1000 piece jigsaw puzzle adults",
    "c": "Games & toys",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "puzzles",
      "jigsaw",
      "cosy",
      "calm",
      "art"
    ],
    "w": "A slow, satisfying project for winter evenings."
  },
  {
    "p": "film camera",
    "t": "Film camera starter kit",
    "q": "35mm film camera reusable",
    "c": "Hobbies & crafts",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid"
    ],
    "k": [
      "photography",
      "film",
      "vintage",
      "retro",
      "analogue"
    ],
    "w": "Brings back the anticipation of developing film, a fun creative challenge."
  },
  {
    "p": "ukulele",
    "t": "Ukulele starter pack",
    "q": "ukulele beginner kit",
    "c": "Music & film",
    "a": [
      "kid",
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "music",
      "guitar",
      "singing",
      "instruments",
      "ukulele"
    ],
    "w": "The friendliest instrument to learn, with a tuner and bag included."
  },
  {
    "p": "acoustic guitar",
    "t": "Guitar accessories bundle",
    "q": "guitar accessories kit capo tuner",
    "c": "Music & film",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "guitar",
      "music",
      "band",
      "gigs",
      "bass"
    ],
    "w": "Capo, tuner and picks, the bits every guitarist loses and is glad to have."
  },
  {
    "p": "vinyl records",
    "t": "Vinyl record cleaning kit",
    "q": "vinyl record cleaning kit",
    "c": "Music & film",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "vinyl",
      "records",
      "music",
      "turntable",
      "hi fi"
    ],
    "w": "Keeps their records sounding their best, a thoughtful pick for collectors."
  },
  {
    "p": "cookbook kitchen",
    "t": "Hardback cookbook",
    "q": "bestselling cookbook hardback",
    "c": "Books",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "cooking",
      "food",
      "baking",
      "recipes",
      "chef"
    ],
    "w": "New recipes to try, and a lovely book to flick through on the sofa."
  },
  {
    "p": "wrapped book",
    "t": "Blind date with a book",
    "q": "blind date with a book",
    "c": "Books",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "reading",
      "books",
      "novels",
      "book club"
    ],
    "w": "A surprise read wrapped up so they choose by the clues, not the cover."
  },
  {
    "p": "board game",
    "t": "Strategy board game",
    "q": "strategy board game adults",
    "c": "Games & toys",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "board games",
      "games",
      "strategy",
      "catan",
      "family",
      "game night"
    ],
    "w": "A great reason to get everyone round the table on a quiet evening."
  },
  {
    "p": "card game friends",
    "t": "Party card game",
    "q": "party card game adults",
    "c": "Games & toys",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "parties",
      "games",
      "friends",
      "hosting",
      "funny"
    ],
    "w": "Easy to learn and guaranteed laughs at gatherings."
  },
  {
    "p": "board game couple",
    "t": "Two-player puzzle game",
    "q": "two player board game couples",
    "c": "Games & toys",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "couples",
      "games",
      "board games",
      "date night",
      "partner"
    ],
    "w": "Designed for two, a nice way to spend an evening together without screens."
  },
  {
    "p": "escape room puzzle",
    "t": "Escape room in a box",
    "q": "escape room game box",
    "c": "Games & toys",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "puzzles",
      "mystery",
      "detective",
      "escape room",
      "games"
    ],
    "w": "A ready-made mystery to solve at home with friends or family."
  },
  {
    "p": "cozy blanket",
    "t": "Weighted blanket",
    "q": "weighted blanket adult",
    "c": "Home",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "sleep",
      "anxiety",
      "calm",
      "cosy",
      "relaxing",
      "wellbeing"
    ],
    "w": "A comforting, cosy blanket many people find helps them settle in the evenings."
  },
  {
    "p": "essential oil diffuser",
    "t": "Aroma diffuser with oils",
    "q": "aroma diffuser essential oils set",
    "c": "Beauty & wellbeing",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "relaxing",
      "self care",
      "wellbeing",
      "calm",
      "yoga",
      "spa"
    ],
    "w": "Fills a room with a calming scent, a nice wind-down touch."
  },
  {
    "p": "bath products",
    "t": "Luxury bath and body set",
    "q": "bath and body gift set",
    "c": "Beauty & wellbeing",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "self care",
      "spa",
      "pamper",
      "baths",
      "beauty",
      "relaxing"
    ],
    "w": "A proper pamper night in a box."
  },
  {
    "p": "cozy throw blanket",
    "t": "Heated throw",
    "q": "electric heated throw",
    "c": "Home",
    "a": [
      "adult"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "cosy",
      "cold",
      "winter",
      "tv",
      "reading"
    ],
    "w": "Instant warmth on the sofa without heating the whole house."
  },
  {
    "p": "houseplant pot",
    "t": "Plant care kit and stylish planter",
    "q": "ceramic plant pot with saucer set",
    "c": "Home",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "plants",
      "houseplants",
      "interiors",
      "home",
      "gardening"
    ],
    "w": "For the person whose windowsill is a jungle, a smart new home for a favourite plant."
  },
  {
    "p": "night sky stars",
    "t": "Personalised star map print",
    "q": "personalised star map print",
    "c": "Home",
    "a": [
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "anniversary",
      "romantic",
      "partner",
      "space",
      "astronomy",
      "stars"
    ],
    "w": "Shows the night sky from a date that matters to you both, a keepsake with meaning."
  },
  {
    "p": "scented candle",
    "t": "Scented candle set",
    "q": "scented candle gift set",
    "c": "Home",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "candles",
      "cosy",
      "home",
      "relaxing",
      "interiors"
    ],
    "w": "Instant cosiness for winter evenings."
  },
  {
    "p": "wool beanie",
    "t": "Merino wool beanie",
    "q": "merino wool beanie hat",
    "c": "Fashion & accessories",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "walking",
      "outdoors",
      "winter",
      "cold",
      "fashion"
    ],
    "w": "Warm without being itchy, a winter staple they'll actually wear."
  },
  {
    "p": "leather wallet",
    "t": "Leather card holder",
    "q": "leather card holder wallet slim",
    "c": "Fashion & accessories",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "minimal",
      "fashion",
      "style",
      "work",
      "office"
    ],
    "w": "A slim, smart upgrade from a bulky wallet."
  },
  {
    "p": "cozy slippers",
    "t": "Cosy slipper boots",
    "q": "slipper boots warm",
    "c": "Fashion & accessories",
    "a": [
      "kid",
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "cosy",
      "winter",
      "cold",
      "comfort"
    ],
    "w": "Warm feet all winter, a reliable crowd pleaser."
  },
  {
    "p": "silk pillow",
    "t": "Silk pillowcase",
    "q": "mulberry silk pillowcase",
    "c": "Beauty & wellbeing",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "beauty",
      "hair",
      "skincare",
      "sleep",
      "self care"
    ],
    "w": "Gentler on hair and skin overnight, a small touch of luxury."
  },
  {
    "p": "notebook pen",
    "t": "Dotted notebook and pen set",
    "q": "a5 dotted notebook hardcover",
    "c": "Stationery",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "journaling",
      "writing",
      "bullet journal",
      "stationery",
      "planning",
      "notes"
    ],
    "w": "A good notebook is always welcome for lists, ideas or journaling."
  },
  {
    "p": "desk organiser",
    "t": "Desk organiser",
    "q": "wooden desk organiser",
    "c": "Stationery",
    "a": [
      "adult"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "work",
      "office",
      "working from home",
      "wfh",
      "organised",
      "tidy"
    ],
    "w": "A tidy, good-looking home for the bits that clutter a desk."
  },
  {
    "p": "desk setup light",
    "t": "Monitor light bar",
    "q": "monitor light bar",
    "c": "Tech",
    "a": [
      "teen",
      "adult"
    ],
    "b": [
      "mid"
    ],
    "k": [
      "working from home",
      "wfh",
      "gaming",
      "office",
      "computers",
      "desk"
    ],
    "w": "Lights the desk without screen glare, great for late working or gaming."
  },
  {
    "p": "magnetic tiles",
    "t": "Magnetic building tiles",
    "q": "magnetic building tiles kids",
    "c": "Games & toys",
    "a": [
      "kid"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "building",
      "lego",
      "construction",
      "creative",
      "stem"
    ],
    "w": "Open-ended building that grows with them, from simple shapes to big structures."
  },
  {
    "p": "kids science",
    "t": "Kids science experiment kit",
    "q": "science kit for kids",
    "c": "Games & toys",
    "a": [
      "kid"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "science",
      "experiments",
      "stem",
      "space",
      "chemistry",
      "learning"
    ],
    "w": "Fizzing, glowing experiments that make science feel like magic."
  },
  {
    "p": "dinosaur fossil",
    "t": "Dinosaur excavation kit",
    "q": "dinosaur dig kit",
    "c": "Games & toys",
    "a": [
      "kid"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "dinosaurs",
      "fossils",
      "digging",
      "nature",
      "history"
    ],
    "w": "Chip away to uncover dinosaur skeletons, a hit with young dinosaur fans."
  },
  {
    "p": "children picture book",
    "t": "Children's picture book collection",
    "q": "picture book collection children",
    "c": "Books",
    "a": [
      "kid"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "reading",
      "books",
      "bedtime",
      "stories"
    ],
    "w": "A stack of new bedtime stories to share together."
  },
  {
    "p": "wooden toys",
    "t": "Wooden toddler activity cube",
    "q": "wooden activity cube toddler",
    "c": "Games & toys",
    "a": [
      "kid"
    ],
    "b": [
      "mid"
    ],
    "k": [
      "toddler",
      "learning",
      "sensory",
      "montessori",
      "development"
    ],
    "w": "Lots to twist, slide and explore, building fine motor skills through play."
  },
  {
    "p": "walkie talkie",
    "t": "Kids walkie talkies",
    "q": "walkie talkies for kids",
    "c": "Games & toys",
    "a": [
      "kid"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "outdoors",
      "spies",
      "adventure",
      "camping",
      "pretend"
    ],
    "w": "Hours of garden adventures and secret missions."
  },
  {
    "p": "kids scooter",
    "t": "Kids scooter",
    "q": "kids scooter 3 wheel",
    "c": "Outdoors & sport",
    "a": [
      "kid"
    ],
    "b": [
      "mid"
    ],
    "k": [
      "active",
      "outdoors",
      "scooter",
      "park",
      "sport"
    ],
    "w": "Gets them outside and zooming to the park."
  },
  {
    "p": "kids drawing",
    "t": "Art caddy for kids",
    "q": "kids art set case",
    "c": "Hobbies & crafts",
    "a": [
      "kid"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "art",
      "drawing",
      "colouring",
      "creative",
      "crafts"
    ],
    "w": "Pens, pencils and paints in one case, for budding artists."
  },
  {
    "p": "star projector",
    "t": "Space projector night light",
    "q": "star projector night light",
    "c": "Home",
    "a": [
      "kid",
      "teen"
    ],
    "b": [
      "lo",
      "mid"
    ],
    "k": [
      "space",
      "stars",
      "planets",
      "bedroom",
      "sleep",
      "astronomy"
    ],
    "w": "Turns the bedroom ceiling into a starry sky at bedtime."
  },
  {
    "p": "toy robot",
    "t": "Coding robot for kids",
    "q": "coding robot for kids",
    "c": "Games & toys",
    "a": [
      "kid"
    ],
    "b": [
      "mid",
      "hi"
    ],
    "k": [
      "coding",
      "robots",
      "stem",
      "programming",
      "technology",
      "science"
    ],
    "w": "Teaches the basics of coding through play, no screen required for younger ones."
  },
  {
    "p": "led lights bedroom",
    "t": "Teen room LED strip lights",
    "q": "led strip lights bedroom app",
    "c": "Home",
    "a": [
      "teen"
    ],
    "b": [
      "lo"
    ],
    "k": [
      "gaming",
      "bedroom",
      "tiktok",
      "aesthetic",
      "decor"
    ],
    "w": "Colour-changing lights to make their room feel like their own space."
  }
];

const BABY_CATALOGUE = [
  { p: "soft cloth book", t: "Soft cloth book for babies", q: "soft cloth baby book", c: "Books", a: ["baby"], b: ["lo"], k: ["books", "reading", "new baby"], w: "A simple book to share together." },
  { p: "high contrast board book", t: "High-contrast baby board book", q: "high contrast baby board book", c: "Books", a: ["baby"], b: ["lo"], k: ["books", "reading", "new baby"], w: "A book to look through together." },
  { p: "baby keepsake album", t: "Baby keepsake photo album", q: "baby keepsake photo album", c: "Home", a: ["baby"], b: ["lo"], k: ["new baby", "keepsake", "family"], w: "A place for the family to keep photographs and memories." },
  { p: "baby name storybook", t: "Personalised baby storybook", q: "personalised baby name storybook", c: "Books", a: ["baby"], b: ["lo"], k: ["books", "reading", "new baby", "personalised"], w: "A storybook made to mark a new arrival." },
];
const PRICE_BAND_MAX = { xs: 10, lo: 30, mid: 50, hi: 100 };

// Items that are reliably inexpensive, so small budgets (£10 and up) still get a recipient-aware fallback.
const BUDGET_CATALOGUE = [
  { p: "notebook and pen", t: "Notebook and pen set", q: "notebook and pen gift set", c: "Stationery", a: ["teen", "adult"], b: ["xs"], k: ["writing", "journal", "notes", "stationery", "work", "planning"], w: "A well-made notebook is used every day and suits almost anyone who likes to jot things down." },
  { p: "tea infuser", t: "Tea infuser mug", q: "tea infuser mug with lid", c: "Kitchen", a: ["teen", "adult"], b: ["xs"], k: ["tea", "cosy", "calm", "office"], w: "A simple way to enjoy proper loose-leaf tea at home or at work." },
  { p: "cactus pot", t: "Mini desk plant", q: "mini desk plant in pot", c: "Home", a: ["teen", "adult"], b: ["xs"], k: ["plants", "garden", "office", "desk", "home"], w: "A cheerful, low-effort bit of greenery for a desk or windowsill." },
  { p: "puzzle cube", t: "Brain-teaser puzzle cube", q: "puzzle cube brain teaser", c: "Games & toys", a: ["kid", "teen", "adult"], b: ["xs"], k: ["puzzles", "games", "logic", "fidget"], w: "A pocket-sized challenge that keeps hands and minds busy." },
  { p: "pack of playing cards", t: "Card game for friends or family", q: "family card game pocket", c: "Games & toys", a: ["kid", "teen", "adult"], b: ["xs"], k: ["games", "cards", "family", "party"], w: "Quick to learn and easy to take anywhere for a sociable evening." },
  { p: "reading light", t: "Clip-on book light", q: "clip on book reading light", c: "Books", a: ["teen", "adult"], b: ["xs"], k: ["books", "reading", "bed", "novel"], w: "Lets a keen reader enjoy a book in bed without disturbing anyone." },
  { p: "bookmark", t: "Pretty bookmark set", q: "bookmark gift set", c: "Books", a: ["kid", "teen", "adult"], b: ["xs"], k: ["books", "reading", "library", "novel"], w: "A small, thoughtful extra for someone who always has a book on the go." },
  { p: "colouring pencils", t: "Colouring pencils and pad", q: "colouring pencils and drawing pad", c: "Hobbies & crafts", a: ["kid", "teen", "adult"], b: ["xs"], k: ["drawing", "art", "colouring", "creative", "craft"], w: "Everything needed to start drawing or colouring, whatever their age." },
  { p: "kids sticker book", t: "Reusable sticker activity book", q: "reusable sticker activity book kids", c: "Games & toys", a: ["kid"], b: ["xs"], k: ["stickers", "creative", "quiet", "art", "craft"], w: "Quiet, tidy creative play that suits long car journeys and rainy days." },
  { p: "picture book", t: "Illustrated picture book", q: "illustrated picture book children", c: "Books", a: ["kid"], b: ["xs"], k: ["books", "stories", "reading", "bedtime"], w: "A story to share together at bedtime." },
  { p: "bubble wand", t: "Bubble mixture and wands", q: "bubble mixture wands kids", c: "Outdoors & sport", a: ["kid"], b: ["xs"], k: ["outdoors", "garden", "play", "park"], w: "Simple outdoor fun that needs no batteries and makes no noise." },
  { p: "chalk", t: "Giant pavement chalk set", q: "jumbo pavement chalk set", c: "Hobbies & crafts", a: ["kid"], b: ["xs"], k: ["art", "outdoors", "creative", "drawing"], w: "A big, open-ended drawing project for the driveway or park." },
  { p: "festive socks", t: "Cosy patterned socks", q: "cosy patterned socks gift", c: "Fashion & accessories", a: ["teen", "adult"], b: ["xs"], k: ["cosy", "winter", "comfort"], w: "A practical, low-risk gift that is nice to receive." },
  { p: "baby muslin", t: "Baby muslin squares", q: "baby muslin squares pack", c: "Home", a: ["baby"], b: ["xs"], k: ["new baby", "baby"], w: "Soft, washable and endlessly useful for new parents." },
  { p: "hand cream", t: "Hand cream gift", q: "hand cream gift unscented", c: "Beauty & wellbeing", a: ["teen", "adult"], b: ["xs"], k: ["gardening", "kitchen", "cold", "self-care", "wellbeing"], w: "A small treat for hard-working hands; the unscented kind suits almost everyone." },
];


export const BUDGET_TITLES = new Set(BUDGET_CATALOGUE.map((item) => item.t));

function ageAudience(recipient, input) {
  if (recipient.ageBand === "baby") return "baby";
  if (recipient.ageYears !== null) return recipient.ageYears < 13 ? "kid" : recipient.ageYears < 18 ? "teen" : "adult";
  if (input.relation === "child") return "kid";
  if (input.relation === "teen") return "teen";
  if (input.relation !== "other") return "adult";
  return "unknown";
}

function matchedKeywords(item, text) {
  const lower = text.toLowerCase();
  return item.k.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

/** Age- and budget-eligible catalogue entries as raw ideas, keyword matches first. */
export function catalogueCandidates(input, recipient = deriveRecipient(input)) {
  const audience = ageAudience(recipient, input);
  const text = recipient.text;
  const allItems = [...CATALOGUE, ...BABY_CATALOGUE, ...BUDGET_CATALOGUE];
  const filtered = [];
  const candidates = allItems.flatMap((item, index) => {
    const ageMatches = audience === "unknown"
      ? item.a.includes("kid") && item.a.includes("teen") && item.a.includes("adult")
      : item.a.includes(audience);
    if (!ageMatches) {
      filtered.push({ index, title: item.t, codes: ["catalogue_age_mismatch"] });
      return [];
    }
    if (!item.b.some((band) => recipient.budget.max == null || PRICE_BAND_MAX[band] <= recipient.budget.max)) {
      filtered.push({ index, title: item.t, codes: ["catalogue_budget_not_verified"] });
      return [];
    }
    const candidate = (() => {
      const matched = matchedKeywords(item, text);
      return { item, matched, score: matched.length * 10 };
    })();
    return [candidate];
  })
    .sort((a, b) => b.score - a.score || a.item.t.localeCompare(b.item.t))
    .map(({ item, matched }) => ({
      title: item.t,
      concept: item.t,
      why: matched.length ? item.w : "A versatile gift idea that may suit someone with varied interests.",
      based_on: matched.join(" "),
      search_query: item.q,
      photo_query: item.p,
      category: CATEGORIES.includes(item.c) ? item.c : "Home",
      angle: "practical",
      estimated_max_price_gbp: Math.min(...item.b.map((band) => PRICE_BAND_MAX[band])),
      matched: matched.length,
    }));
  return { candidates, filtered, total: allItems.length };
}

/**
 * Produces fallback ideas from the curated catalogue and subjects every candidate to the same
 * recipient-aware validator as model output. Price bands are only used when the budget can cover
 * their stated upper bound; entries without a suitable band are not shown.
 */
export function catalogueFallback(input) {
  const { candidates, filtered, total } = catalogueCandidates(input);
  const result = curateIdeas({ recipient_summary: "", ideas: candidates }, input, { limit: 8 });
  result.diagnostics.catalogue_count = total;
  result.diagnostics.raw_count = total;
  result.diagnostics.rejected_count += filtered.length;
  result.diagnostics.rejected.push(...filtered);
  return result;
}
