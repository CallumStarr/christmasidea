// Deterministic lexicons used by the post-generation checks.
// These are a safety net behind the prompt, not a replacement for it: each rule is
// deliberately narrow so the validator rejects clear problems without turning into
// a blanket "no". Everything here is plain data so rules are easy to review and extend.

const i = (source) => new RegExp(source, "i");

// Narrow product identities, not recipient interests. Unknown types retain the existing lexical checks.
export const PRODUCT_CONCEPTS = [
  { id: "kneeling_aid", terms: i("\\bkneelers?\\b|\\bkneeling\\s+(?:(?:garden|foam|padded|folding|foldable)\\s+)*(?:pads?|mats?|cushions?|benches|bench|seats?)\\b|\\b(?:garden|gardening)\\b.*\\bknee\\s+pads?\\b|\\bknee\\s+pads?\\b.*\\b(?:garden|gardening)\\b") },
  { id: "apron", terms: i("\\baprons?\\b") },
  { id: "moka", terms: i("\\bmoka\\b|\\bstove\\s*top\\s+(?:coffee\\s+)?espresso\\s+(?:makers?|pots?|brewers?)\\b") },
  { id: "enamel_coffee_pot", terms: i("\\benamel\\b.*\\b(?:coffee|camp|camping)\\b.*\\b(?:pots?|percolators?)\\b|\\benamel\\b.*\\b(?:pots?|percolators?)\\b.*\\b(?:coffee|camp|camping)\\b") },
];
export const PRODUCT_CONFLICTS = [
  ["kneeling_aid", "apron"],
  ["moka", "enamel_coffee_pot"],
];

/** Things the site never recommends, for any recipient. Reject outright. */
export const ALWAYS_BLOCKED = [
  ["gift_card_or_voucher", i("\\b(gift ?cards?|e-?gift|vouchers?|gift certificates?)\\b")],
  ["service_or_subscription", i("\\b(subscriptions?|memberships?|(?:event|concert|theatre|museum|cinema|show|train) tickets?|experience days?|online courses?)\\b")],
  ["alcohol", i("\\b(wine|beer|whisk(?:e)?y|gin|vodka|rum|prosecco|champagne|liqueur|cider|brandy|cocktails?)\\b(?!\\s*(?:glass(?:es)?|racks?|stoppers?|openers?|coolers?|holders?|decanters?|aerators?|books?|journals?|maps?|bags?|totes?|tasting (?:notes|journal|glass(?:es)?)))")],
  ["tobacco_or_vape", i("\\b(tobacco|cigars?|cigarettes?|vapes?|vaping|e-?cigs?|e-?liquids?|shisha|hookah)\\b")],
  ["weapon", i("\\b(firearms?|air ?guns?|airsoft|bb guns?|tasers?|stun guns?|pepper spray|brass knuckles|crossbows?|nunchucks?|throwing (?:knives|stars))\\b")],
  ["gambling", i("\\b(gambling|casino|lottery|scratch ?cards?|betting)\\b")],
  ["adult_product", i("\\b(adult toys?|lingerie|erotic|vibrators?)\\b")],
  ["medical_or_supplement", i("\\b(medicines?|medication|supplements?|vitamins?|probiotics?|melatonin|cbd|painkillers?|ointments?)\\b")],
];

/** Extra blocks for anyone under 18. */
export const MINOR_BLOCKED = [
  ["sharp_or_fire_item", i("\\b(kni(?:fe|ves)|penknife|pocket ?knife|multi-?tool|swiss army|blades?|axes?|hatchets?|machetes?|lighters?|fire[- ]?(?:starters?|steel)|firesteel|flint|matches|slingshots?|catapults?)\\b")],
  ["stimulant", i("\\b(caffeine|energy drinks?)\\b")],
];

/** Baby (under 1): conservative. Sleep, medical, carrier/seat and similar items are not casual gifts. */
export const BABY_BLOCKED = [
  ["baby_sleep_product", i("\\b(sleep(?!suits?\\b|wear\\b)\\w*|swaddl\\w*|cots?|cribs?|bassinets?|moses baskets?|baby nests?|pillows?|bumpers?|positioners?|wedges?|weighted|white noise|co-?sleep\\w*)\\b")],
  ["baby_travel_or_carrier", i("\\b(car ?seats?|isofix|baby carriers?|slings?|harness|strollers?|prams?|pushchairs?|high ?chairs?|travel systems?|baby walkers?|bath seats?|bath supports?)\\b")],
  ["baby_medical_or_feeding", i("\\b(teething (?:gels?|powders?|necklaces?|bracelets?)|amber|(?<!bath |room |bath/room )thermometers?|nasal|saline|formula|weaning|baby food|snacks?|dummy clips?|bottles?|sterili[sz]\\w*)\\b")],
  ["baby_small_or_choking", i("\\b(necklaces?|bracelets?|jewell?ery|balloons?|beads?|marbles?|buttons?|small parts)\\b")],
];

/** Small loose pieces: under 4, or wherever the shopper asks to avoid them. */
export const SMALL_PARTS = [
  ["small_loose_parts", i("\\b(dice|story (?:cubes|dice)|beads?|marbles?|magnets?|magnetic (?:letters|numbers|puzzles?|sets?|building)|buttons?|balloons?|sequins?|glitter|small parts|tiny|loose pieces|mini (?:figures?|figurines?)|small dolls?|dolls? houses?|dollhouses?|doll famil(?:y|ies)(?: sets?)?|slime|water beads|putty|stickers? sets?|button batter\\w+|tiddlywinks?|counters|excavation (?:kits?|sets?)|(?:dinosaur|fossil) dig kits?)\\b")],
  ["small_loose_parts", i("^(?!.*duplo).*\\blego\\b")],
];

/** Fine for children in general but needs an adult nearby for younger ones. */
export const SUPERVISION = i("\\b(chemistry|soldering|hot glue|glue guns?|craft knife|scalpel|wood ?burn\\w*|pyrography|candle[- ]making|crystal growing|growing crystals|model rockets?|rocket launch\\w*|power tools?|sewing machines?|needle felting|electronics? kits?|circuit kits?)\\b");

/** Specialist or safety-critical equipment. Rejected unless the shopper asked for that thing. */
export const SPECIALIST = [
  { id: "climbing_training_or_safety", terms: i("\\b(hang ?boards?|finger ?boards?|campus boards?|finger[- ]?(?:strength|trainers?|training)|grip (?:strength )?trainers?|crash ?pads?|harness(?:es)?|belay\\w*|quickdraws?|carabiners?|climbing ropes?|dynamic ropes?|ice axes?|crampons?|via ferrata)\\b"), unless: i("hang ?board|finger ?board|campus|crash ?pad|harness|belay|rope|carabiner|quickdraw|crampon|ice axe|training board") },
  { id: "protective_or_vehicle_safety", terms: i("\\b(helmets?|visors?|body armou?r|airbags?|brake (?:pads?|fluid|discs?)|tyres?|tires?|chain (?:and )?sprockets?|crash (?:bungs?|protectors?)|life ?jackets?|buoyancy aids?|riding (?:jackets?|gloves|boots|trousers))\\b"), unless: i("helmet|visor|armou?r|brake|tyre|tire|sprocket|life ?jacket|buoyancy|riding (?:jacket|gloves|boots)") },
  { id: "vehicle_fitment", terms: i("\\b(model[- ]specific|bike[- ]specific|fits? (?:your|a specific|specific)|compatible with (?:your )?(?:model|bike|car)|exhausts?|fairings?|number plate holders?|wing mirrors?|sprockets?)\\b"), unless: i("fitment|specific model|exhaust|fairing|number plate|mirror|sprocket") },
];

/** Topics where a gift depends on tastes or sizes nobody supplied. Allowed only if the shopper mentioned the topic. */
export const PREFERENCE_TOPICS = [
  {
    id: "fragrance",
    terms: i("\\b(fragranc\\w*|perfumes?|colognes?|aftershave|scented|candles?|diffusers?|incense|aroma\\w*|essential oils?|room sprays?|potpourri|bath bombs?)\\b"),
    mentioned: i("scent|fragranc|perfum|candle|aroma|incense|diffuser"),
  },
  {
    id: "personal_care",
    terms: i("\\b(skin ?care|lotions?|moisturi[sz]\\w*|body (?:butter|scrub|lotion)|shower gels?|soaps?|hand cream|face (?:masks?|cream)|lip balm|toiletr\\w+|spa sets?|pamper\\w*|bath salts?|shampoo|make-?up|cosmetics?|nail (?:polish|kits?)|hair (?:masks?|oils?))\\b"),
    mentioned: i("skin ?care|self[- ]?care|pamper|\\bspa\\b|beauty|bath|cosmetic|make-?up|grooming|wellbeing|hair|toiletr"),
  },
  {
    id: "sized_clothing",
    terms: i("\\b(t-?shirts?|shirts?|jumpers?|sweaters?|sweatshirts?|hoodies?|trousers|jeans|dress(?:es)?(?![- ]up)|pyjamas?|jackets?|coats?|underwear|bras?|trainers|shoes|boots|leggings|shorts)\\b"),
    mentioned: i("cloth|fashion|wardrobe|outfit|wear\\b|apparel|sewing|knit|garment|jumper|hoodie|style"),
  },
  {
    id: "consumables",
    terms: i("\\b(chocolates?|biscuits?|sweets?|hampers?|snack boxes?|cheese|cake mix|jams?|honey|nuts|tea bags?|loose[- ]leaf|coffee beans|ground coffee|sampler boxes?|(?<!play |pretend |toy |plastic )food(?! wraps?| storage| containers?| prep| boxes?| jars?| savers?| covers?| processors?| scales?| thermometers?| mats?| tins?| bags?)|edible)\\b"),
    mentioned: i("food|cook|bak(?:e|ing)|chocolate|coffee|tea\\b|treat|snack|foodie|cheese|bread|cake|sweet|brew|drink|vegan|kitchen|chef"),
    categories: ["Food & treats"],
  },
];

/**
 * Things a shopper says the person dislikes or must avoid, mapped to the product words that
 * would contradict them. `trigger` is tested against the shopper's phrase; `terms` against the idea.
 */
export const DISLIKE_GROUPS = [
  { id: "fragrance", trigger: i("fragranc|scent|perfum|aroma|smell"), terms: PREFERENCE_TOPICS[0].terms },
  { id: "personal_care", trigger: i("personal.?care|toiletr|skin ?care|cosmetic|beauty|make-?up|pamper"), terms: PREFERENCE_TOPICS[1].terms },
  {
    id: "technology",
    trigger: i("\\btech|electronic|gadget|digital|\\bapps?\\b|screens?\\b"),
    terms: i("\\b(electronics?|digital|apps?|bluetooth|wireless|smart|batter(?:y|ies)|rechargeable|usb|led|gadgets?|speakers?|headphones?|earbuds?|cameras?|trackers?|robots?)\\b"),
    categories: ["Tech"],
  },
  {
    id: "clutter_or_novelty",
    trigger: i("clutter|ornament|decorat|novelty|gimmick|knick|trinket|useless"),
    terms: i("\\b(ornaments?|decorative|figurines?|trinkets?|knick-?knacks?|novelty|gimmick\\w*|jokes?|souvenirs?|statuettes?|wall art)\\b"),
  },
  {
    id: "food",
    trigger: i("\\bfood|edible|consumable|snack|sweets?\\b|chocolate|treats?\\b"),
    terms: PREFERENCE_TOPICS[3].terms,
    categories: ["Food & treats"],
  },
  { id: "knives_or_fire", trigger: i("kni(?:fe|ves)|blade|\\bfire|lighter|flint|matches"), terms: i("\\b(kni(?:fe|ves)|blades?|axes?|hatchets?|machetes?|lighters?|fire[- ]?(?:starters?|steel|starting)|flint|matches|ferro rods?)\\b") },
  { id: "branded_clothing", trigger: i("clothing|branded|apparel|merch"), terms: i("\\b(t-?shirts?|hoodies?|jumpers?|sweatshirts?|clothing|apparel|caps?|hats?|merch\\w*|branded)\\b") },
  { id: "alcohol", trigger: i("alcohol|drink"), terms: i("\\b(wine|beer|whisk(?:e)?y|gin|spirits?|liqueur|cocktail|prosecco)\\b") },
];

/** Claims the generator cannot know: certifications, age ratings, prices, stock, ratings. */
export const SAFETY_CLAIM = i("\\b(?:child|baby|toddler|kid|food|skin|dishwasher|microwave)[- ]?safe\\b|\\bsafe (?:for|to use|and)\\b|\\bsafety[- ](?:tested|certified|approved|standards?|checked)\\b|\\bcertified\\b|\\bcertifications?\\b|\\bcompliant\\b|\\bcomplies\\b|\\bCE[- ]?marked?\\b|\\bUKCA\\b|\\bBS ?EN\\b|\\bEN ?71\\b|\\bnon[- ]?toxic\\b|\\bBPA[- ]?free\\b|\\bhypoallergenic\\b|\\bdermatolog\\w+ tested\\b|\\bclinically\\b|\\bapproved by\\b|\\bflame[- ]retardant\\b|\\bmeets? (?:all )?(?:safety|regulations?|standards?)\\b");
export const AGE_RATING_CLAIM = i("\\b(?:suitable|recommended|designed|ideal|intended|made|safe|rated|appropriate) for (?:ages?|children|kids|toddlers|babies|those) ?(?:aged |from |over |under )?\\d|\\bages? \\d+\\s?(?:\\+|plus|and (?:up|over)|[-–]\\s?\\d+)|\\b\\d+\\s?\\+\\s?(?:years?|yrs?|months?)\\b|\\bfrom \\d+ (?:months?|years?)\\b|\\bage[- ]rated\\b|\\bage rating\\b");
export const PRICE_OR_STOCK_CLAIM = i("[£$€]\\s?\\d|\\b\\d+(?:\\.\\d+)?\\s?(?:pounds|quid|gbp)\\b|\\b(?:on sale|discount(?:ed)?|\\d+% off|half price|in stock|out of stock|currently available|best[- ]?sell\\w*|top[- ]rated|highly rated|amazon'?s choice|\\d(?:\\.\\d)? ?stars?|(?:five|4|5)[- ]star|customer reviews?|prime delivery|free delivery)\\b");
export const PREFERENCE_VERB = /\b(?:loves?|likes?|enjoys?|adores?|prefers?|(?:is|are) (?:a )?(?:big )?fan of|favou?rite|passionate about|obsessed with|into|keen on)\s+([^.,;!?]+)/gi;

/** Text that suggests the model was steered by instructions embedded in the recipient description. */
export const INJECTION_ECHO = i("ignore (?:all |any |the |your )?(?:previous|prior|above|earlier)|disregard (?:the |all |your )?(?:rules|instructions|above)|system prompt|these instructions|my instructions|as an ai\\b|api[_ -]?key|x-api-key|sk-ant|jailbreak|</?(?:recipient_details|already_shown)>|\\bnew (?:instructions|rules)\\b");

/** Words that add nothing to an Amazon search. */
export const QUERY_NOISE = new Set((
  "best top perfect amazing awesome ultimate premium luxury luxurious quality high-quality highest great unique special " +
  "cool fantastic beautiful stylish lovely nice ideal cheap affordable budget bargain gift gifts present presents " +
  "idea ideas christmas xmas birthday anniversary stocking filler"
).split(" "));
export const QUERY_FOR_PHRASE = /\bfor (?:him|her|them|dad|mum|mom|grandad|grandma|men|women|boys?|girls?|kids?)\b/gi;

/** Capitalised abbreviations and sizes that are not brands. */
export const QUERY_ACRONYMS = new Set([
  "LED", "USB", "DIY", "A3", "A4", "A5", "A6", "B5", "3D", "2D", "RC", "UK", "PC", "TV", "HD", "XL", "XXL", "LCD", "GPS", "STEM",
  "UV", "AAA", "AA", "DC", "AC", "CD", "DVD", "USB-C", "RPG", "DND", "D&D", "LP", "LPS", "XS", "MTB", "BBQ", "PVC", "SD", "HDMI",
  "RGB", "VR", "AI", "NFC", "WIFI", "DAB", "FM", "AM", "UK", "EU", "ABC", "NATO",
]);
