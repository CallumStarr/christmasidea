export const INTEREST_GROUPS = [
  ["Food & drink", ["Cooking", "Baking", "Sourdough", "Barbecuing", "Coffee", "Tea", "Chocolate", "Cheese", "Spicy food", "World cuisines", "Cocktail making", "Wine", "Craft beer"]],
  ["Gardening & nature", ["Gardening", "Houseplants", "Growing vegetables", "Growing herbs", "Flowers", "Birdwatching", "Wildlife", "Foraging", "Stargazing", "Conservation"]],
  ["Outdoors & adventure", ["Walking", "Hiking", "Camping", "Cycling", "Running", "Wild swimming", "Fishing", "Climbing", "Kayaking", "Surfing", "Skiing", "Travel", "Beach trips"]],
  ["Sport & fitness", ["Football", "Rugby", "Cricket", "Tennis", "Golf", "Badminton", "Basketball", "Formula 1", "Gym workouts", "Yoga", "Pilates", "Dancing", "Martial arts"]],
  ["Arts & making", ["Drawing", "Painting", "Pottery", "Knitting", "Crochet", "Sewing", "Embroidery", "Jewellery making", "Woodworking", "DIY", "Origami", "Scrapbooking", "Calligraphy", "Photography"]],
  ["Books & learning", ["Reading", "Crime novels", "Fantasy books", "Science fiction", "Romance novels", "Historical fiction", "Poetry", "Comics", "Manga", "History", "Science", "Astronomy", "Languages", "Geography", "Puzzles"]],
  ["Games & technology", ["Video games", "PC gaming", "PlayStation", "Xbox", "Nintendo", "Minecraft", "Roblox", "Board games", "Card games", "Chess", "Jigsaws", "Dungeons & Dragons", "Warhammer", "Coding", "Electronics", "Robotics", "Gadgets"]],
  ["Music & performing", ["Listening to music", "Vinyl records", "Pop music", "Rock music", "Indie music", "Hip-hop", "Jazz", "Classical music", "K-pop", "Taylor Swift", "Playing guitar", "Playing piano", "Drumming", "Singing", "Musical theatre"]],
  ["Film, TV & fandoms", ["Cinema", "Comedy", "Horror films", "Documentaries", "Anime", "Disney", "Marvel", "DC superheroes", "Star Wars", "Star Trek", "Harry Potter", "Lord of the Rings", "Doctor Who", "Friends", "Studio Ghibli"]],
  ["Home & everyday comforts", ["Home decor", "Cosy nights in", "Candles", "Organisation", "Stationery", "Journaling", "Antiques", "Vintage style", "Architecture", "Interior design"]],
  ["Style & self-care", ["Fashion", "Trainers", "Jewellery", "Watches", "Bags", "Skincare", "Makeup", "Nail art", "Hair styling", "Bath time", "Relaxation", "Meditation"]],
  ["Animals & pets", ["Dogs", "Cats", "Horses", "Horse riding", "Aquariums", "Small pets", "Farm animals"]],
  ["Children & play", ["LEGO", "Building toys", "Trains", "Cars", "Dinosaurs", "Space", "Unicorns", "Fairies", "Pirates", "Princesses", "Superheroes", "Dolls", "Soft toys", "Pretend play", "Sensory play", "Messy play", "Science experiments", "Outdoor play"]],
  ["Collecting & niche hobbies", ["Model building", "Model railways", "Remote-control cars", "Planes", "Motorbikes", "Car maintenance", "Coin collecting", "Stamp collecting", "Trading cards", "Metal detecting", "Genealogy", "Maps"]],
];

export const ABOUT_GROUPS = [
  ["Personality & gift style", ["They're creative", "They're curious", "They're practical", "They're adventurous", "They're sociable", "They enjoy quiet time", "They have a playful sense of humour", "They're sentimental", "They enjoy a challenge", "They like learning new skills"]],
  ["What would suit them", ["They prefer useful gifts", "They prefer consumable gifts", "They like handmade gifts", "They like personalised gifts", "They enjoy little luxuries", "They appreciate eco-friendly gifts", "They like trying new hobbies", "They prefer familiar favourites", "They like sharing activities", "They enjoy screen-free activities"]],
  ["Their day-to-day life", ["They work from home", "They commute", "They spend time outdoors", "They travel often", "They host friends", "They enjoy time with family", "They have limited storage space", "They enjoy a cosy home"]],
  ["What they already have", ["They already own plenty of hobby equipment", "They already own lots of books", "They already own lots of board games", "They already own plenty of mugs", "They already own plenty of candles", "They already own lots of kitchen gadgets", "They already own plenty of stationery", "They already own lots of beauty products"]],
  ["Things to avoid", ["Avoid alcohol", "Avoid food gifts", "Avoid sweets", "Avoid coffee", "Avoid tea", "Avoid candles", "Avoid fragrances", "Avoid skincare", "Avoid makeup", "Avoid jewellery", "Avoid clothing", "Avoid socks", "Avoid mugs", "Avoid novelty gifts", "Avoid noisy toys", "Avoid messy activities", "Avoid single-use plastic", "Avoid subscriptions"]],
];

export function selectedValues(root, name) {
  return [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

export function renderCheckboxGroups(root, name, groups) {
  for (const [title, options] of groups) {
    const section = document.createElement("fieldset");
    section.className = "choice-category";
    const legend = document.createElement("legend");
    const heading = document.createElement("span");
    heading.textContent = title;
    const count = document.createElement("span");
    count.className = "choice-count";
    legend.append(heading, count);
    const list = document.createElement("div");
    list.className = "checkbox-options";
    for (const value of options) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox"; input.name = name; input.value = value;
      const text = document.createElement("span");
      text.textContent = value;
      const tile = document.createElement("span");
      tile.className = "checkbox-tile";
      tile.append(text);
      label.append(input, tile); list.append(label);
    }
    section.append(legend, list); root.append(section);
  }
}

export function updateCheckboxSummary(root, name, output) {
  for (const section of root.querySelectorAll(".choice-category")) {
    const count = selectedValues(section, name).length;
    section.querySelector(".choice-count").textContent = count ? `${count} selected` : "";
  }
  const selected = selectedValues(root, name);
  output.textContent = selected.length ? `${selected.length} selected` : "Tick any that sound like them";
}
