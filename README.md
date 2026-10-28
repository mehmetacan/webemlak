# Asya Emlak

Asya Emlak web sitesi — Cloudflare Workers üzerinde çalışır.

- `public/` — ön yüz (`index.html`, `app.js`)
- `src/index.js` — API: giriş/oturum, ilanlar, kullanıcı yönetimi, site ayarları, fotoğraflar
- `migrations/` — D1 veritabanı şeması
- `wrangler.jsonc` — Cloudflare ayarları (D1 `webemlak-db`, R2 `webemlak-foto`)

## Güvenlik

- Şifreler PBKDF2-SHA256 (100.000 tur, kullanıcıya özel rastgele tuz) ile özetlenerek saklanır; düz şifre hiçbir yerde tutulmaz.
- Oturum anahtarı yalnızca tarayıcıdaki HttpOnly çerezde durur; veritabanında özeti tutulur.
- Art arda hatalı girişler 15 dakika engellenir.
- İlanın açık adresi ve koordinatları yalnızca ilan sahibine ve yöneticilere gönderilir.

`main` dalına gönderilen her değişiklik Cloudflare tarafından otomatik yayınlanır.
