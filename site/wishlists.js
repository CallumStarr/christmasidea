import { normaliseSavedList, readLocalGiftList } from "./monetization-data.js";

export const WISHLISTS_KEY = "ci-wishlists";
export const MAX_WISHLISTS = 20;

export class WishlistStorageError extends TypeError {
  constructor(message, recovered) {
    super(`${message} Original saved data is preserved; changes are available for this visit only.`);
    this.name = "WishlistStorageError";
    this.recovered = recovered;
  }
}

export function wishlistName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new TypeError("Give your wishlist a name of 1 to 60 characters.");
  }
  return name;
}

function normaliseCollection(data, recover = false) {
  if (data?.version !== 1 || !Array.isArray(data.lists) || !data.lists.length || data.lists.length > MAX_WISHLISTS) {
    throw new TypeError("Invalid wishlist storage.");
  }
  const ids = new Set();
  const lists = data.lists.map((list) => {
    if (typeof list?.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(list.id) || ids.has(list.id)) {
      throw new TypeError("Invalid wishlist identifier.");
    }
    ids.add(list.id);
    return {
      id: list.id, name: wishlistName(list.name),
      items: recover ? readLocalGiftList(Array.isArray(list.items) ? list.items : []) : normaliseSavedList(list.items),
    };
  });
  if (!ids.has(data.activeId)) throw new TypeError("The selected wishlist is missing.");
  return { version: 1, activeId: data.activeId, lists };
}

export function readWishlists(storage) {
  const raw = storage.getItem(WISHLISTS_KEY);
  const legacy = raw === null ? storage.getItem("ci-shortlist") : null;
  let data;
  try {
    data = raw === null
      ? { version: 1, activeId: "default", lists: [{ id: "default", name: "My gift shortlist", items: JSON.parse(legacy || "[]") }] }
      : JSON.parse(raw);
    return normaliseCollection(data);
  } catch (error) {
    let recovered;
    try { recovered = normaliseCollection(data, true); } catch {}
    throw new WishlistStorageError(error instanceof SyntaxError ? "Invalid wishlist storage." : error.message, recovered);
  }
}

export function activeWishlist(collection) {
  const list = collection.lists.find((item) => item.id === collection.activeId);
  if (!list) throw new TypeError("Choose an existing wishlist.");
  return list;
}

export function addWishlist(collection, name, id = crypto.randomUUID()) {
  name = wishlistName(name);
  if (collection.lists.length >= MAX_WISHLISTS) throw new RangeError("You can keep up to 20 wishlists on this device.");
  if (collection.lists.some((list) => list.name.toLowerCase() === name.toLowerCase())) {
    throw new TypeError("A wishlist with that name already exists.");
  }
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || collection.lists.some((list) => list.id === id)) {
    throw new TypeError("Invalid wishlist identifier.");
  }
  return { ...collection, activeId: id, lists: [...collection.lists, { id, name, items: [] }] };
}

export function writeWishlists(storage, collection) {
  // Never replace unreadable originals with a recovered or empty in-memory list.
  readWishlists(storage);
  const safe = normaliseCollection(collection);
  storage.setItem(WISHLISTS_KEY, JSON.stringify(safe));
  // Keep the original key as a backwards-compatible copy for older open pages.
  try {
    storage.setItem("ci-shortlist", JSON.stringify(activeWishlist(safe).items));
    return { persistent: true, compatibilityUpdated: true };
  } catch {
    return { persistent: true, compatibilityUpdated: false };
  }
}
