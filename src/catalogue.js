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
    "w": "Small batches to compare at home. Match beans or ground coffee to the equipment they use, and check roast and caffeine preferences."
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
    "w": "Make filter coffee by hand, adjusting the pour between brews. Choose a dripper that fits their mug or server, with filters they can easily replace."
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
    "w": "Several teas to compare rather than a large supply of one blend. Check loose-leaf or bagged format, caffeine and any added flavourings."
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
    "w": "Compare different chillies and styles of sauce. Pick around the flavours and heat they enjoy, and read the ingredients for dietary requirements."
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
    "w": "A project for a cook interested in sourdough. A proving basket alone is not a full starter kit, so read the contents for starter, tools and instructions."
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
    "w": "A cast iron pan for someone who wants to cook with one. Weight and seasoning care are part of the choice, alongside size and hob compatibility."
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
    "w": "Make pasta from scratch as a weekend cooking project. Rolling, cutting and shaping need different tools; choose the part they want to try."
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
    "w": "Tools for mixing cocktails or alcohol-free drinks at home. Start with what they lack: a shaker, measuring jigger and strainer each do a different job."
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
    "w": "A pizza-making addition to a home kitchen. The stone needs to fit their oven and its temperatures; use it on a barbecue only if the manufacturer permits it."
  },
  {
    "p": "sea swimming",
    "t": "Outdoor changing poncho",
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
    "w": "Space to change after an outdoor swim. Towelling ponchos and weather-resistant robes serve different purposes, so ask which type and fit they want."
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
    "w": "Take a drink on a walk or a day out. Choose a capacity they will carry; a cup lid is useful outdoors but adds bulk compared with a travel mug."
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
    "w": "Hands-free light for outdoor activities or practical jobs. Match weight, beam settings and power source to where they will use it."
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
    "w": "Carry the essentials for a day walk. Capacity matters, but back length and straps determine the fit: trying it with some weight inside is worth doing."
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
    "w": "Somewhere for a runner's phone and keys. Match the pocket and belt to their phone and waist; reflective extras do not replace lights or other precautions."
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
    "w": "Only if they already use or have asked for this type of exercise accessory. Check firmness and dimensions; do not buy it on promises to treat pain or injuries."
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
    "w": "For someone building a home yoga setup. Ask about mat thickness, surface and block preference rather than assuming a starter set is an upgrade."
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
    "w": "Portable tools for a cyclist who wants to do their own basic repairs. Match fittings and tyre type to their bike; no small kit covers every roadside problem."
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
    "w": "Watch garden birds through a feeder camera. Choose around its power and connection needs, ongoing subscription costs and how easily the feeder comes apart for cleaning."
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
    "w": "Get a closer view of wildlife on walks. Weight and fit matter alongside magnification, especially for someone who wears glasses."
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
    "w": "Tools and a kneeler for planting at ground level. Ask what needs replacing first: one comfortable tool can be more useful than a large set."
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
    "w": "Grow herbs to use in the kitchen. Choose varieties for their available light and space, and read the contents to see whether pots and compost are included."
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
    "w": "Give fishing tackle a place rather than another tangled pocket. The compartments need to suit their equipment, with catches that stay closed while carrying it."
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
    "w": "Set up football drills at home or in a suitable outdoor space. Choose around the skills they want to practise and the equipment actually included."
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
    "w": "Listen without a cable to the phone. Device compatibility comes first; keep the receipt because ear fit and controls are difficult to judge from a listing."
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
    "w": "Take music or spoken-word audio away from the usual speakers. Choose for the location: weight, charging and any stated water-resistance rating all affect where it is useful."
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
    "w": "A keyboard change for someone who wants one. Ask about UK layout and switch feel first: the sound and resistance of mechanical keys are personal preferences."
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
    "w": "Audio and voice chat for games with friends. Match the connection to their console or computer, then consider microphone controls and fit rather than appearance alone."
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
    "w": "A dedicated place to charge compatible controllers. Match the exact controller model and check whether rechargeable batteries or extra cables are needed."
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
    "w": "Control suitable lamps or appliances remotely. The plugs must work with their Wi-Fi and smart-home system, and stay within the manufacturer's electrical limits."
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
    "w": "Learn electronics by assembling small projects. Choose a kit at their level, noting age guidance and whether it needs a computer, soldering or extra components."
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
    "w": "Support a phone for group photos or filming. Match the clamp width and remote to their device, and choose a height suited to what they photograph."
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
    "w": "For someone who likes keeping a physical photograph. Check the film format and cost per picture, and whether the camera comes with any film."
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
    "w": "Carry digital books in a dedicated reader. Choose around the bookshop or library service they use; not every device supports the same sources."
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
    "w": "Older-style games in a handheld format. The included licensed games matter more than the advertised game count; look at the controls and any extra purchase requirements."
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
    "w": "Try watercolour painting with a manageable set of colours. Suitable paper and a usable brush matter more than a box filled with accessories."
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
    "w": "Practise lettering for cards or journals. Flexible brush tips need a different technique from ordinary pens, so clear exercises and suitable practice paper are useful."
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
    "w": "Stitch a design to keep or give away. Choose a pattern at their level, with the fabric, thread, needle and hoop included or clearly listed separately."
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
    "w": "Work towards a first knitted project. A beginner kit needs instructions for the stitches used, the right needles and enough yarn to finish, not just an attractive pattern."
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
    "w": "For making small decorative objects without a kiln. Check drying and finishing instructions; do not assume air-dry clay is waterproof or suitable for food."
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
    "w": "Build a model of a subject they enjoy. Match the difficulty to their experience and leave room in the budget for any separately listed glue, paint or tools."
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
    "w": "A longer puzzle to return to over several sittings. Choose the image as carefully as the piece count, and allow space for sorting as well as the finished picture."
  },
  {
    "p": "film camera",
    "t": "Reusable film camera",
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
    "w": "Try taking photographs on film. Allow for film, developing and scans as well as the camera: those ongoing costs are part of the gift."
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
    "w": "A first ukulele for someone who wants to learn. Choose the instrument size and read the bundle contents; a tuner, bag and lessons are not automatically included."
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
    "w": "Replace the guitar accessories they actually need. Ask what is missing, then match the capo, strings or other included pieces to their instrument."
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
    "w": "An addition to a vinyl collector's cleaning setup. Find out what they already use so the brush or fluid complements their routine rather than duplicating it."
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
    "w": "New recipes for someone who enjoys cooking. Sample pages tell you more than the cover: look for food they want to make with ingredients and time they have."
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
    "w": "A wrapped surprise for a reader who enjoys taking a chance on a title. Use the genre clues, but bear in mind that duplicates are harder to rule out."
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
    "w": "Plan moves and try a new strategy around the table. Choose a player count, rules complexity and playing time that fit their usual group."
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
    "w": "A game to bring to a gathering. Read sample cards first: the humour, language and number of players need to suit the people at the table."
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
    "w": "A game for an evening as a pair. Look for reviews of playing with exactly two people rather than relying on a box marked 'two or more'."
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
    "w": "Solve a boxed mystery together at home. Choose the difficulty for the group, and find out whether the puzzles can be reset or used only once."
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
    "w": "Only if they have asked for a weighted blanket. Check the manufacturer's suitability guidance, size, weight and care instructions; do not choose it as a treatment for sleep or anxiety."
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
    "w": "A home-fragrance option for someone who already uses oils. Choose a familiar scent and follow safe-use guidance, including household considerations around children or pets."
  },
  {
    "p": "bath products",
    "t": "Bath and body set",
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
    "w": "Bath and body products in scents they already enjoy. Use their current favourites as a guide to ingredients and fragrance rather than buying on gift packaging."
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
    "w": "A heated throw for someone who has asked for one. Choose a useful size with controls they can operate, and follow the manufacturer's suitability and safety instructions."
  },
  {
    "p": "houseplant pot",
    "t": "Plant pot with saucer",
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
    "w": "A new home for a houseplant. Match internal dimensions and drainage to the plant: a decorative cover pot is different from the pot it grows in."
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
    "w": "A print based on a date and place they want to remember. Check the location, time, spelling and proof, plus whether a frame is included."
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
    "w": "A candle in a fragrance they already like. Compare the candle's actual size rather than the box, and look for clear safe-use instructions."
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
    "w": "A wool hat for winter outings. Follow their preference on fit and fabric; merino still needs a care routine and texture they are happy with."
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
    "w": "Carry cards without a full wallet, if that is how they prefer to pay. Count the slots they need and ask whether they still carry notes or coins."
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
    "w": "An indoor boot-style slipper for someone who likes a higher fit. Match their size and preferred sole, and keep the receipt so they can try them on."
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
    "w": "A change of bedding texture for someone who likes silk. Match their pillow size and laundry routine rather than choosing it for unverified hair or skincare promises."
  },
  {
    "p": "notebook pen",
    "t": "Dotted notebook",
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
    "w": "Dotted pages leave room for lists, diagrams or journal layouts. Choose their preferred notebook size and binding; a pen is not necessarily included."
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
    "w": "Give everyday desk items a place. Choose compartments for the things they actually use, measured against the space beside their keyboard or notebook."
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
    "w": "Add light above a desk without a separate lamp base. Match the mount to their monitor's shape; reflections depend on the light and its position."
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
    "w": "Build shapes, towers or a garage for favourite toy cars. Choose age-appropriate tiles compatible with any existing set, counting building pieces rather than accessories."
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
    "w": "Try experiments together with instructions to follow. Pick activities at the child's level, and read the age and supervision guidance plus any household supplies needed."
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
    "w": "Dig through a block to uncover a dinosaur-themed find. Read what is buried inside, the age guidance and whether tools are included before choosing the kit."
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
    "w": "Stories to read together. Check the titles, reading level and format, and ask which books the child already owns."
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
    "w": "Moving parts and activities to explore during play. Choose the activities and size for the child, following the age label rather than relying on developmental promises."
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
    "w": "Talk across the garden during make-believe missions. Simple controls help younger users; follow the age guidance and expect range to vary around buildings."
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
    "w": "Ask a parent before buying a scooter. Check rider height, weight limits, storage and suitable protective equipment rather than choosing by age alone."
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
    "w": "Keep a child's art materials together between projects. Choose space for the supplies they own, and read the contents: an empty caddy and a filled art set are different gifts."
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
    "w": "Space-themed light patterns for a room. Choose brightness and controls suited to the user, follow age guidance and treat it as decoration rather than an accurate sky map."
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
    "w": "Give a robot instructions and see how it moves. Choose activities at the child's level, with age guidance and any phone, tablet or computer requirements made clear."
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
    "w": "Decorative lighting for a teenager who wants to change their room. Measure the length and power route first, and get permission before attaching adhesive strips."
  }
];

const BABY_CATALOGUE = [
  { p: "soft cloth book", t: "Soft cloth book for babies", q: "soft cloth baby book", c: "Books", a: ["baby"], b: ["lo"], k: ["books", "reading", "new baby"], w: "A book to explore together during supervised play. Check the age label, washing instructions and any attached parts." },
  { p: "high contrast board book", t: "High-contrast baby board book", q: "high contrast baby board book", c: "Books", a: ["baby"], b: ["lo"], k: ["books", "reading", "new baby"], w: "Pictures to look at and talk about together. Check page size, age guidance and whether the family already has the title." },
  { p: "baby keepsake album", t: "Baby keepsake photo album", q: "baby keepsake photo album", c: "Home", a: ["baby"], b: ["lo"], k: ["new baby", "keepsake", "family"], w: "For the adults to keep photographs of a new arrival. Check print sizes and whether they want pockets or pages for sticking photos in." },
  { p: "baby name storybook", t: "Personalised baby storybook", q: "personalised baby name storybook", c: "Books", a: ["baby"], b: ["lo"], k: ["books", "reading", "new baby", "personalised"], w: "A storybook to mark a new arrival. Confirm the name with the parents and check the preview, delivery deadline and personalisation terms." },
];
const PRICE_BAND_MAX = { xs: 10, lo: 30, mid: 50, hi: 100 };

// Items that are reliably inexpensive, so small budgets (£10 and up) still get a recipient-aware fallback.
const BUDGET_CATALOGUE = [
  { p: "notebook and pen", t: "Notebook and pen set", q: "notebook and pen gift set", c: "Stationery", a: ["teen", "adult"], b: ["xs"], k: ["writing", "journal", "notes", "stationery", "work", "planning"], w: "For someone who likes writing notes on paper. Check the ruling, page size and pen type rather than choosing by gift packaging." },
  { p: "tea infuser", t: "Tea infuser mug", q: "tea infuser mug with lid", c: "Kitchen", a: ["teen", "adult"], b: ["xs"], k: ["tea", "cosy", "calm", "office"], w: "For brewing loose-leaf tea one mug at a time. Check capacity and whether the infuser lifts out easily for emptying and cleaning." },
  { p: "cactus pot", t: "Mini desk plant", q: "mini desk plant in pot", c: "Home", a: ["teen", "adult"], b: ["xs"], k: ["plants", "garden", "office", "desk", "home"], w: "For someone who wants a small plant. Check the species, light requirements and household suitability, including pets, before choosing one for their desk." },
  { p: "puzzle cube", t: "Brain-teaser puzzle cube", q: "puzzle cube brain teaser", c: "Games & toys", a: ["kid", "teen", "adult"], b: ["xs"], k: ["puzzles", "games", "logic", "fidget"], w: "For someone who enjoys working out patterns by hand. Check difficulty and age guidance, and whether instructions or a solution are available." },
  { p: "pack of playing cards", t: "Card game for friends or family", q: "family card game pocket", c: "Games & toys", a: ["kid", "teen", "adult"], b: ["xs"], k: ["games", "cards", "family", "party"], w: "A game to take to a gathering. Read sample rules and check the player count, playing time and age guidance before choosing." },
  { p: "reading light", t: "Clip-on book light", q: "clip on book reading light", c: "Books", a: ["teen", "adult"], b: ["xs"], k: ["books", "reading", "bed", "novel"], w: "For a reader who wants a light attached to the book. Check clip weight, brightness settings and the power source." },
  { p: "bookmark", t: "Bookmark set", q: "bookmark gift set", c: "Books", a: ["kid", "teen", "adult"], b: ["xs"], k: ["books", "reading", "library", "novel"], w: "For someone who reads paper books. Choose a thin design that sits comfortably between pages, in a colour or motif they like." },
  { p: "colouring pencils", t: "Colouring pencils and pad", q: "colouring pencils and drawing pad", c: "Hobbies & crafts", a: ["kid", "teen", "adult"], b: ["xs"], k: ["drawing", "art", "colouring", "creative", "craft"], w: "For drawing or colouring on paper. Check age suitability, pencil colours and pad size, plus whether a sharpener is needed separately." },
  { p: "kids sticker book", t: "Reusable sticker activity book", q: "reusable sticker activity book kids", c: "Games & toys", a: ["kid"], b: ["xs"], k: ["stickers", "creative", "quiet", "art", "craft"], w: "For a child who enjoys arranging pictures and telling stories. Check the theme, age label and how the reusable stickers are stored." },
  { p: "picture book", t: "Illustrated picture book", q: "illustrated picture book children", c: "Books", a: ["kid"], b: ["xs"], k: ["books", "stories", "reading", "bedtime"], w: "A story to share together at bedtime." },
  { p: "bubble wand", t: "Bubble mixture and wands", q: "bubble mixture wands kids", c: "Outdoors & sport", a: ["kid"], b: ["xs"], k: ["outdoors", "garden", "play", "park"], w: "For supervised outdoor play. Check the age label, bottle size and included wands, and follow the instructions for use and storage." },
  { p: "chalk", t: "Giant pavement chalk set", q: "jumbo pavement chalk set", c: "Hobbies & crafts", a: ["kid"], b: ["xs"], k: ["art", "outdoors", "creative", "drawing"], w: "For drawing outdoors on a suitable, permitted surface. Check age guidance, chalk size and washing instructions, and ask a parent about where it can be used." },
  { p: "festive socks", t: "Cosy patterned socks", q: "cosy patterned socks gift", c: "Fashion & accessories", a: ["teen", "adult"], b: ["xs"], k: ["cosy", "winter", "comfort"], w: "For someone who likes patterned socks, if you know their size. Check fibre content and washing instructions rather than relying on a one-size label." },
  { p: "baby muslin", t: "Baby muslin squares", q: "baby muslin squares pack", c: "Home", a: ["baby"], b: ["xs"], k: ["new baby", "baby"], w: "A practical extra if the parents use muslins. Ask which fabric and size they prefer, and check washing instructions before buying a pack." },
  { p: "hand cream", t: "Hand cream gift", q: "hand cream gift unscented", c: "Beauty & wellbeing", a: ["teen", "adult"], b: ["xs"], k: ["gardening", "kitchen", "cold", "self-care", "wellbeing"], w: "For someone who already uses hand cream. Check ingredients and fragrance preferences; an unscented label does not mean a product suits everyone's skin." },
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
      why: item.w,
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
