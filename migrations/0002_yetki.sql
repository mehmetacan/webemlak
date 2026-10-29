-- Yetkili danışman: kendi ilanları dışındaki tüm ilanları da görüp yönetebilir
ALTER TABLE users ADD COLUMN tum_ilan INTEGER NOT NULL DEFAULT 0;
