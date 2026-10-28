-- Asya Emlak veritabanı şeması (Cloudflare D1)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad TEXT NOT NULL,
  mail TEXT NOT NULL UNIQUE COLLATE NOCASE,
  tel TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL CHECK (rol IN ('admin','danisman')),
  aktif INTEGER NOT NULL DEFAULT 1,
  pw TEXT NOT NULL,                 -- pbkdf2-sha256$iterasyon$tuz$özet (düz şifre asla saklanmaz)
  olusturma INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,      -- oturum anahtarının SHA-256 özeti
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bitis INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  baslik TEXT NOT NULL,
  tip TEXT NOT NULL,
  tur TEXT NOT NULL,
  fiyat INTEGER NOT NULL,
  m2 INTEGER NOT NULL,
  il TEXT NOT NULL,
  ilce TEXT NOT NULL,
  mah TEXT NOT NULL DEFAULT '',
  adres TEXT NOT NULL DEFAULT '',   -- gizli: yalnızca ilan sahibi ve yönetici görür
  lat REAL,                         -- gizli
  lon REAL,                         -- gizli
  oda TEXT NOT NULL DEFAULT '',
  kat INTEGER NOT NULL DEFAULT 0,
  yas INTEGER NOT NULL DEFAULT 0,
  asansor INTEGER NOT NULL DEFAULT 0,
  ozellik TEXT NOT NULL DEFAULT '[]',
  aciklama TEXT NOT NULL DEFAULT '',
  fotolar TEXT NOT NULL DEFAULT '[]',
  yayinda INTEGER NOT NULL DEFAULT 1,
  olusturma INTEGER NOT NULL,
  guncelleme INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_pub ON listings(yayinda, olusturma);
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  anahtar TEXT PRIMARY KEY,         -- e-posta veya IP
  sayi INTEGER NOT NULL,
  ilk INTEGER NOT NULL
);
