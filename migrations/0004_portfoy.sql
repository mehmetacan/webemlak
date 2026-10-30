-- İlanlar artık kamuya açık değil: ofis içi portföy + takip alanları + müşteriye özel paylaşım bağlantıları
ALTER TABLE listings ADD COLUMN durum TEXT NOT NULL DEFAULT 'aktif';
ALTER TABLE listings ADD COLUMN mal_sahibi TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN mal_tel TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN yetki_bitis TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN notlar TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS paylasim (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,   -- bağlantı anahtarının SHA-256 özeti
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  musteri TEXT NOT NULL DEFAULT '',
  bitis INTEGER NOT NULL,
  goruntulenme INTEGER NOT NULL DEFAULT 0,
  son_gorulme INTEGER,
  olusturma INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_paylasim_listing ON paylasim(listing_id);
