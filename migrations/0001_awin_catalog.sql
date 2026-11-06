CREATE TABLE IF NOT EXISTS awin_catalogue_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_generation TEXT NOT NULL,
  published_at TEXT NOT NULL
);

INSERT OR IGNORE INTO awin_catalogue_state (id, active_generation, published_at)
VALUES (1, '', '1970-01-01T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS awin_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation TEXT NOT NULL,
  product_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  merchant_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  price_gbp REAL NOT NULL,
  delivery_cost_gbp REAL,
  delivery_known INTEGER NOT NULL CHECK (delivery_known IN (0, 1)),
  currency TEXT NOT NULL CHECK (currency = 'GBP'),
  image_url TEXT NOT NULL DEFAULT '',
  merchant_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  gtin TEXT NOT NULL DEFAULT '',
  in_stock INTEGER NOT NULL CHECK (in_stock IN (0, 1)),
  UNIQUE (generation, product_id)
);

CREATE INDEX IF NOT EXISTS awin_products_generation_stock
ON awin_products (generation, in_stock, advertiser_id);

CREATE VIRTUAL TABLE IF NOT EXISTS awin_products_fts USING fts5(
  product_id UNINDEXED,
  generation UNINDEXED,
  advertiser_id UNINDEXED,
  title,
  brand,
  description,
  category
);

CREATE TRIGGER IF NOT EXISTS awin_products_fts_insert AFTER INSERT ON awin_products BEGIN
  INSERT INTO awin_products_fts (product_id, generation, advertiser_id, title, brand, description, category)
  VALUES (new.product_id, new.generation, new.advertiser_id, new.title, new.brand, new.description, new.category);
END;

CREATE TRIGGER IF NOT EXISTS awin_products_fts_update AFTER UPDATE ON awin_products BEGIN
  DELETE FROM awin_products_fts
  WHERE product_id = old.product_id AND generation = old.generation;
  INSERT INTO awin_products_fts (product_id, generation, advertiser_id, title, brand, description, category)
  VALUES (new.product_id, new.generation, new.advertiser_id, new.title, new.brand, new.description, new.category);
END;

CREATE TRIGGER IF NOT EXISTS awin_products_fts_delete AFTER DELETE ON awin_products BEGIN
  DELETE FROM awin_products_fts
  WHERE product_id = old.product_id AND generation = old.generation;
END;
