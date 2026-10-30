-- İlan videosu (R2 anahtarı, boşsa video yok)
ALTER TABLE listings ADD COLUMN video TEXT NOT NULL DEFAULT '';
