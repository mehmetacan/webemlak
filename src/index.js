// Asya Emlak — Cloudflare Worker (API + fotoğraf sunumu)
// Statik site public/ klasöründen ASSETS ile sunulur; /api/* ve /img/* bu dosyada işlenir.

const PBKDF2_ITER = 100000; // Workers'ta izin verilen en yüksek değer
const SESSION_DAYS = 30;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS = 15;
const LOGIN_MAX_TRIES = 5;
const LOGIN_WINDOW_SEC = 15 * 60;

const TIPLER = ['Satılık', 'Kiralık'];
const TURLER = ['Daire', 'Müstakil', 'Villa', 'Dubleks', 'Tarla', 'Parsel'];
const OZELLIKLER = ['Balkon', 'Otopark', 'Eşyalı', 'Güvenlik', 'Havuz'];
const AYAR_ANAHTARLARI = ['hero', 'sub', 'tel', 'mail', 'adr', 'saat', 'hak'];
const AYAR_VARSAYILAN = {
  hero: 'Yaşamak istediğiniz evi birlikte bulalım.',
  sub: 'Asya Emlak danışmanlarının güncel ilanlarını konuma, fiyata, odaya ve kata göre saniyeler içinde filtreleyin.',
  tel: '',
  mail: '',
  adr: '',
  saat: 'Hafta içi 09:00 - 18:00',
  hak: 'Asya Emlak, alıcı ve kiracıları doğru mülkle buluşturmak için çalışan bir emlak danışmanlığı firmasıdır.',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const now = () => Math.floor(Date.now() / 1000);

// ---------- Şifreleme yardımcıları ----------
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2-sha256$${PBKDF2_ITER}$${b64(salt)}$${b64(bits)}`;
}

function sameBytes(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(a, b);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2-sha256') return false;
  const bits = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter)));
  return sameBytes(bits, unb64(hash));
}

async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

// Kullanıcı yokken bile aynı sürede yanıt vermek için sabit bir sahte özet
let DUMMY_HASH = null;
async function dummyHash() {
  if (!DUMMY_HASH) DUMMY_HASH = await hashPassword('sahte-sifre-zamanlama');
  return DUMMY_HASH;
}

// ---------- Doğrulama ----------
const str = (v, max, { required = false, name = 'Alan' } = {}) => {
  const s = String(v ?? '').trim();
  if (required && !s) throw new HttpError(400, `${name} boş bırakılamaz.`);
  if (s.length > max) throw new HttpError(400, `${name} en fazla ${max} karakter olabilir.`);
  return s;
};
const int = (v, min, max, name) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${name} geçersiz.`);
  return n;
};
const mailOk = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);

function checkPassword(p) {
  const s = String(p ?? '');
  if (s.length < 8) throw new HttpError(400, 'Şifre en az 8 karakter olmalı.');
  if (s.length > 200) throw new HttpError(400, 'Şifre çok uzun.');
  return s;
}

// ---------- Oturum ----------
function getCookie(req, name) {
  const c = req.headers.get('cookie') || '';
  for (const part of c.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

function sessionCookie(token, maxAge, secure) {
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

async function createSession(env, userId, secure) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const exp = now() + SESSION_DAYS * 86400;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, bitis) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, exp).run();
  // Süresi dolmuş oturumları ara sıra temizle
  await env.DB.prepare('DELETE FROM sessions WHERE bitis < ?').bind(now()).run();
  return sessionCookie(token, SESSION_DAYS * 86400, secure);
}

async function currentUser(req, env) {
  const token = getCookie(req, 'sid');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.ad, u.mail, u.tel, u.rol, u.aktif, u.tum_ilan FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.bitis > ?`
  ).bind(await sha256(token), now()).first();
  if (!row || !row.aktif) return null;
  return row;
}

const canAll = (u) => !!u && (u.rol === 'admin' || !!u.tum_ilan);
const publicUser = (u) => u && { id: u.id, ad: u.ad, mail: u.mail, tel: u.tel, rol: u.rol, tumIlan: canAll(u) };
// Yetki seviyeleri: danisman (yalnız kendi ilanları), yetkili (tüm ilanlar), admin (tüm ilanlar + kullanıcılar + ayarlar)
function yetkiCols(y) {
  if (y === 'admin') return { rol: 'admin', tum_ilan: 1 };
  if (y === 'yetkili') return { rol: 'danisman', tum_ilan: 1 };
  return { rol: 'danisman', tum_ilan: 0 };
}

function requireUser(user) {
  if (!user) throw new HttpError(401, 'Bu işlem için giriş yapmalısınız.');
  return user;
}
function requireAdmin(user) {
  requireUser(user);
  if (user.rol !== 'admin') throw new HttpError(403, 'Bu işlem yalnızca yöneticiler içindir.');
  return user;
}

// ---------- Giriş denemesi sınırı ----------
async function tooManyAttempts(env, key) {
  const r = await env.DB.prepare('SELECT sayi, ilk FROM login_attempts WHERE anahtar = ?').bind(key).first();
  return r && now() - r.ilk < LOGIN_WINDOW_SEC && r.sayi >= LOGIN_MAX_TRIES;
}
async function noteFailure(env, key) {
  const r = await env.DB.prepare('SELECT sayi, ilk FROM login_attempts WHERE anahtar = ?').bind(key).first();
  if (!r || now() - r.ilk >= LOGIN_WINDOW_SEC) {
    await env.DB.prepare('INSERT OR REPLACE INTO login_attempts (anahtar, sayi, ilk) VALUES (?, 1, ?)').bind(key, now()).run();
  } else {
    await env.DB.prepare('UPDATE login_attempts SET sayi = sayi + 1 WHERE anahtar = ?').bind(key).run();
  }
}
const clearFailures = (env, key) => env.DB.prepare('DELETE FROM login_attempts WHERE anahtar = ?').bind(key).run();

// ---------- İlan dönüşümleri ----------
const imgUrl = (key) => `/img/${key}`;
const NO_OFFSET = 100000;
const ilanNo = (id) => NO_OFFSET + Number(id);
const TRMAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
const slugify = (s) => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => TRMAP[c] || c)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'ilan';
const ilanPath = (id, baslik) => `/ilan/${ilanNo(id)}-${slugify(baslik)}`;
const keyFromUrl = (u) => {
  const m = /^(?:\/img\/)?(p\/[A-Za-z0-9_-]{10,64}\.jpg)$/.exec(String(u || ''));
  return m ? m[1] : null;
};

function toFront(r, withPrivate) {
  const o = {
    id: r.id, no: ilanNo(r.id), url: ilanPath(r.id, r.baslik), u: r.user_id, t: r.baslik, tip: r.tip, tur: r.tur, f: r.fiyat, m2: r.m2,
    il: r.il, ilce: r.ilce, mah: r.mah, oda: r.oda, kat: r.kat, yas: r.yas, as: r.asansor,
    oz: JSON.parse(r.ozellik || '[]'), d: r.aciklama,
    p: JSON.parse(r.fotolar || '[]').map(imgUrl), on: r.yayinda,
    tarih: r.olusturma,
    sahip: { ad: r.sahip_ad, tel: r.sahip_tel, mail: r.sahip_mail },
  };
  if (withPrivate) Object.assign(o, { adr: r.adres, lat: r.lat, lon: r.lon });
  return o;
}

const canManage = (user, row) => !!user && (canAll(user) || user.id === row.user_id);

function parseListing(b) {
  const tip = str(b.tip, 20, { required: true, name: 'İlan tipi' });
  const tur = str(b.tur, 20, { required: true, name: 'Emlak türü' });
  if (!TIPLER.includes(tip)) throw new HttpError(400, 'İlan tipi geçersiz.');
  if (!TURLER.includes(tur)) throw new HttpError(400, 'Emlak türü geçersiz.');
  const arsa = tur === 'Tarla' || tur === 'Parsel';
  const p = Array.isArray(b.p) ? b.p.map(keyFromUrl) : [];
  if (p.some((k) => !k)) throw new HttpError(400, 'Fotoğraf listesi geçersiz.');
  if (!p.length) throw new HttpError(400, 'En az bir fotoğraf ekleyin.');
  if (p.length > MAX_PHOTOS) throw new HttpError(400, `En fazla ${MAX_PHOTOS} fotoğraf eklenebilir.`);
  const oz = (Array.isArray(b.oz) ? b.oz : []).filter((x) => OZELLIKLER.includes(x));
  const lat = b.lat == null || b.lat === '' ? null : Number(b.lat);
  const lon = b.lon == null || b.lon === '' ? null : Number(b.lon);
  if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lon !== null && !(lon >= -180 && lon <= 180)))
    throw new HttpError(400, 'Konum geçersiz.');
  const baslik = str(b.t, 80, { required: true, name: 'Başlık' });
  if (baslik.length < 5) throw new HttpError(400, 'Başlık en az 5 karakter olmalı.');
  return {
    baslik, tip, tur,
    fiyat: int(b.f, 1, 1e12, 'Fiyat'),
    m2: int(b.m2, 1, 10000000, 'Alan'),
    il: str(b.il, 60, { required: true, name: 'İl' }),
    ilce: str(b.ilce, 60, { required: true, name: 'İlçe' }),
    mah: str(b.mah, 100, { name: 'Mahalle' }),
    adres: str(b.adr, 300, { name: 'Açık adres' }),
    lat, lon,
    oda: arsa ? '-' : str(b.oda, 10, { name: 'Oda' }),
    kat: arsa ? 0 : int(b.kat ?? 0, -5, 200, 'Kat'),
    yas: arsa ? 0 : int(b.yas ?? 0, 0, 300, 'Bina yaşı'),
    asansor: arsa ? 0 : (Number(b.as) ? 1 : 0),
    ozellik: JSON.stringify(arsa ? [] : oz),
    aciklama: str(b.d, 3000, { name: 'Açıklama' }) || 'Detaylı bilgi için danışmanımızla iletişime geçin.',
    fotolar: JSON.stringify(p),
  };
}

const LISTING_SELECT = `SELECT l.*, u.ad AS sahip_ad, u.tel AS sahip_tel, u.mail AS sahip_mail, u.aktif AS sahip_aktif
  FROM listings l JOIN users u ON u.id = l.user_id`;

async function getListingRow(env, id) {
  return env.DB.prepare(`${LISTING_SELECT} WHERE l.id = ?`).bind(id).first();
}

async function deletePhotos(env, keys) {
  if (!env.FOTO || !keys.length) return;
  await env.FOTO.delete(keys);
}

// ---------- API ----------
async function api(req, env, url) {
  const path = url.pathname.replace(/^\/api/, '');
  const method = req.method;
  const secure = url.protocol === 'https:';

  // Basit CSRF koruması: değişiklik yapan istekler aynı siteden ve JSON/foto olmalı
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) throw new HttpError(403, 'Geçersiz istek kaynağı.');
    if (req.headers.get('x-asya') !== '1') throw new HttpError(403, 'Geçersiz istek.');
  }

  const user = await currentUser(req, env);
  const body = async () => {
    try { return await req.json(); } catch { throw new HttpError(400, 'Geçersiz veri.'); }
  };
  let m;

  // --- Oturum ---
  if (path === '/me' && method === 'GET') {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    return json({ user: publicUser(user), kurulum: c.n === 0, foto: !!env.FOTO });
  }

  if (path === '/setup' && method === 'POST') {
    const b = await body();
    const ad = str(b.ad, 80, { required: true, name: 'Ad soyad' });
    const mail = str(b.mail, 120, { required: true, name: 'E-posta' }).toLowerCase();
    if (!mailOk(mail)) throw new HttpError(400, 'E-posta geçersiz.');
    const tel = str(b.tel, 30, { name: 'Telefon' });
    // Tek kullanımlık kurulum kodu (veritabanında yalnızca özeti tutulur)
    const kod = await env.DB.prepare("SELECT v FROM settings WHERE k = '_kurulum'").first();
    if (!kod || (await sha256(String(b.kod || '').trim())) !== kod.v) {
      const ip = req.headers.get('cf-connecting-ip') || 'ip';
      if (await tooManyAttempts(env, `k:${ip}`)) throw new HttpError(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
      await noteFailure(env, `k:${ip}`);
      throw new HttpError(403, 'Kurulum kodu hatalı.');
    }
    const pw = await hashPassword(checkPassword(b.sifre));
    // Yalnızca hiç kullanıcı yokken çalışır (koşullu ekleme, yarış durumuna karşı)
    const r = await env.DB.prepare(
      `INSERT INTO users (ad, mail, tel, rol, aktif, pw, olusturma)
       SELECT ?, ?, ?, 'admin', 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`
    ).bind(ad, mail, tel, pw, now()).run();
    if (!r.meta.changes) throw new HttpError(409, 'Kurulum zaten yapılmış. Giriş yapın.');
    await env.DB.prepare("DELETE FROM settings WHERE k = '_kurulum'").run();
    const cookie = await createSession(env, r.meta.last_row_id, secure);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (path === '/login' && method === 'POST') {
    const b = await body();
    const mail = String(b.mail || '').trim().toLowerCase();
    const ip = req.headers.get('cf-connecting-ip') || 'ip';
    const keys = [`m:${mail}`, `i:${ip}`];
    for (const k of keys)
      if (await tooManyAttempts(env, k))
        throw new HttpError(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
    const row = await env.DB.prepare('SELECT id, pw, aktif FROM users WHERE mail = ?').bind(mail).first();
    const ok = await verifyPassword(String(b.sifre || ''), row ? row.pw : await dummyHash());
    if (!row || !ok || !row.aktif) {
      for (const k of keys) await noteFailure(env, k);
      throw new HttpError(401, row && ok && !row.aktif ? 'Hesabınız devre dışı. Yöneticinize başvurun.' : 'E-posta veya şifre hatalı.');
    }
    for (const k of keys) await clearFailures(env, k);
    const cookie = await createSession(env, row.id, secure);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (path === '/logout' && method === 'POST') {
    const token = getCookie(req, 'sid');
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, secure) });
  }

  if (path === '/password' && method === 'POST') {
    requireUser(user);
    const b = await body();
    const row = await env.DB.prepare('SELECT pw FROM users WHERE id = ?').bind(user.id).first();
    if (!(await verifyPassword(String(b.eski || ''), row.pw))) throw new HttpError(400, 'Mevcut şifre hatalı.');
    const pw = await hashPassword(checkPassword(b.yeni));
    await env.DB.prepare('UPDATE users SET pw = ? WHERE id = ?').bind(pw, user.id).run();
    // Diğer cihazlardaki oturumları kapat, bu cihaz için yeni oturum aç
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
    const cookie = await createSession(env, user.id, secure);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  if (path === '/profile' && method === 'PUT') {
    requireUser(user);
    const b = await body();
    const ad = str(b.ad, 80, { required: true, name: 'Ad soyad' });
    const tel = str(b.tel, 30, { name: 'Telefon' });
    await env.DB.prepare('UPDATE users SET ad = ?, tel = ? WHERE id = ?').bind(ad, tel, user.id).run();
    return json({ ok: true });
  }

  // --- Site ayarları ---
  if (path === '/settings' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT k, v FROM settings').all();
    const s = { ...AYAR_VARSAYILAN };
    for (const r of results) if (AYAR_ANAHTARLARI.includes(r.k)) s[r.k] = r.v;
    return json(s);
  }
  if (path === '/settings' && method === 'PUT') {
    requireAdmin(user);
    const b = await body();
    const stmts = AYAR_ANAHTARLARI.filter((k) => k in b).map((k) =>
      env.DB.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind(k, str(b[k], k === 'hak' ? 5000 : 300))
    );
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true });
  }

  // --- İlanlar ---
  if (path === '/listings' && method === 'GET') {
    const { results } = await env.DB.prepare(
      `${LISTING_SELECT} WHERE l.yayinda = 1 AND u.aktif = 1 ORDER BY l.olusturma DESC LIMIT 1000`
    ).all();
    const d = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE aktif = 1 AND rol = 'danisman'`).first();
    return json({ ilanlar: results.map((r) => toFront(r, false)), danisman: d.n });
  }

  if (path === '/my-listings' && method === 'GET') {
    requireUser(user);
    const q = canAll(user)
      ? env.DB.prepare(`${LISTING_SELECT} ORDER BY l.olusturma DESC`)
      : env.DB.prepare(`${LISTING_SELECT} WHERE l.user_id = ? ORDER BY l.olusturma DESC`).bind(user.id);
    const { results } = await q.all();
    return json(results.map((r) => toFront(r, true)));
  }

  if ((m = /^\/listings\/(\d+)$/.exec(path))) {
    const id = Number(m[1]);
    const row = await getListingRow(env, id);
    const manage = row && canManage(user, row);
    if (!row || ((!row.yayinda || !row.sahip_aktif) && !manage)) throw new HttpError(404, 'İlan bulunamadı.');

    if (method === 'GET') return json(toFront(row, manage));
    if (!manage) throw new HttpError(403, 'Bu ilanı değiştirme yetkiniz yok.');

    if (method === 'PUT') {
      const v = parseListing(await body());
      await env.DB.prepare(
        `UPDATE listings SET baslik=?, tip=?, tur=?, fiyat=?, m2=?, il=?, ilce=?, mah=?, adres=?, lat=?, lon=?,
         oda=?, kat=?, yas=?, asansor=?, ozellik=?, aciklama=?, fotolar=?, guncelleme=? WHERE id=?`
      ).bind(v.baslik, v.tip, v.tur, v.fiyat, v.m2, v.il, v.ilce, v.mah, v.adres, v.lat, v.lon,
        v.oda, v.kat, v.yas, v.asansor, v.ozellik, v.aciklama, v.fotolar, now(), id).run();
      const eski = JSON.parse(row.fotolar || '[]'), yeni = JSON.parse(v.fotolar);
      await deletePhotos(env, eski.filter((k) => !yeni.includes(k)));
      return json(toFront(await getListingRow(env, id), true));
    }
    if (method === 'PATCH') {
      const b = await body();
      await env.DB.prepare('UPDATE listings SET yayinda = ?, guncelleme = ? WHERE id = ?')
        .bind(b.on ? 1 : 0, now(), id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM listings WHERE id = ?').bind(id).run();
      await deletePhotos(env, JSON.parse(row.fotolar || '[]'));
      return json({ ok: true });
    }
  }

  if (path === '/listings' && method === 'POST') {
    requireUser(user);
    const v = parseListing(await body());
    const t = now();
    const r = await env.DB.prepare(
      `INSERT INTO listings (user_id, baslik, tip, tur, fiyat, m2, il, ilce, mah, adres, lat, lon, oda, kat, yas,
       asansor, ozellik, aciklama, fotolar, yayinda, olusturma, guncelleme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`
    ).bind(user.id, v.baslik, v.tip, v.tur, v.fiyat, v.m2, v.il, v.ilce, v.mah, v.adres, v.lat, v.lon,
      v.oda, v.kat, v.yas, v.asansor, v.ozellik, v.aciklama, v.fotolar, t, t).run();
    return json(toFront(await getListingRow(env, r.meta.last_row_id), true), 201);
  }

  // --- Fotoğraf yükleme ---
  if (path === '/photos' && method === 'POST') {
    requireUser(user);
    if (!env.FOTO) throw new HttpError(503, 'Fotoğraf depolama henüz etkin değil.');
    const type = req.headers.get('content-type') || '';
    if (!type.startsWith('image/jpeg')) throw new HttpError(415, 'Fotoğraf JPEG olmalı.');
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) throw new HttpError(400, 'Boş fotoğraf.');
    if (buf.byteLength > MAX_PHOTO_BYTES) throw new HttpError(413, 'Fotoğraf çok büyük (en fazla 3 MB).');
    const head = new Uint8Array(buf, 0, 3);
    if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) throw new HttpError(415, 'Geçersiz fotoğraf.');
    const key = `p/${b64url(crypto.getRandomValues(new Uint8Array(18)))}.jpg`;
    await env.FOTO.put(key, buf, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { user: String(user.id) } });
    return json({ url: imgUrl(key) }, 201);
  }

  // --- Kullanıcı yönetimi (yönetici) ---
  if (path === '/users' && method === 'GET') {
    requireAdmin(user);
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.ad, u.mail, u.tel, u.rol, u.aktif, u.tum_ilan, (SELECT COUNT(*) FROM listings l WHERE l.user_id = u.id) AS ilan
       FROM users u ORDER BY u.id`
    ).all();
    return json(results);
  }
  if (path === '/users' && method === 'POST') {
    requireAdmin(user);
    const b = await body();
    const ad = str(b.ad, 80, { required: true, name: 'Ad soyad' });
    const mail = str(b.mail, 120, { required: true, name: 'E-posta' }).toLowerCase();
    if (!mailOk(mail)) throw new HttpError(400, 'E-posta geçersiz.');
    const tel = str(b.tel, 30, { name: 'Telefon' });
    const y = yetkiCols(b.yetki || (b.rol === 'admin' ? 'admin' : 'danisman'));
    const pw = await hashPassword(checkPassword(b.sifre));
    try {
      await env.DB.prepare('INSERT INTO users (ad, mail, tel, rol, tum_ilan, aktif, pw, olusturma) VALUES (?,?,?,?,?,1,?,?)')
        .bind(ad, mail, tel, y.rol, y.tum_ilan, pw, now()).run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e))) throw new HttpError(409, 'Bu e-posta ile kayıtlı bir kullanıcı var.');
      throw e;
    }
    return json({ ok: true }, 201);
  }
  if ((m = /^\/users\/(\d+)$/.exec(path)) && method === 'PATCH') {
    requireAdmin(user);
    const id = Number(m[1]);
    const b = await body();
    const hedef = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!hedef) throw new HttpError(404, 'Kullanıcı bulunamadı.');
    if (id === user.id && ('aktif' in b || 'rol' in b || 'yetki' in b))
      throw new HttpError(400, 'Kendi hesabınızın durumunu veya rolünü değiştiremezsiniz.');
    const stmts = [];
    if ('aktif' in b) {
      stmts.push(env.DB.prepare('UPDATE users SET aktif = ? WHERE id = ?').bind(b.aktif ? 1 : 0, id));
      if (!b.aktif) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
    }
    if ('yetki' in b) {
      const y = yetkiCols(b.yetki);
      stmts.push(env.DB.prepare('UPDATE users SET rol = ?, tum_ilan = ? WHERE id = ?').bind(y.rol, y.tum_ilan, id));
    } else if ('rol' in b) stmts.push(env.DB.prepare('UPDATE users SET rol = ? WHERE id = ?').bind(b.rol === 'admin' ? 'admin' : 'danisman', id));
    if ('sifre' in b) {
      stmts.push(env.DB.prepare('UPDATE users SET pw = ? WHERE id = ?').bind(await hashPassword(checkPassword(b.sifre)), id));
      stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true });
  }

  throw new HttpError(404, 'Bulunamadı.');
}


// ---------- Sayfa (arama motorları için sunucu tarafı başlık/açıklama) ----------
const SITE_NAME = 'Asya Emlak';
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ldJson = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const trPrice = (n) => Number(n).toLocaleString('tr-TR') + ' ₺';
const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
const APP_PAGES = { '/favoriler': 'Favorilerim', '/giris': 'Danışman girişi', '/panel': 'İlanlarım', '/hesap': 'Hesabım', '/yonetim': 'Yönetim', '/ayarlar': 'Site ayarları' };

async function siteSettings(env) {
  const { results } = await env.DB.prepare('SELECT k, v FROM settings').all();
  const s = { ...AYAR_VARSAYILAN };
  for (const r of results) if (AYAR_ANAHTARLARI.includes(r.k)) s[r.k] = r.v;
  return s;
}
function baseUrl(env, url) { return String(env.SITE_URL || url.origin).replace(/\/+$/, ''); }
function isCanonicalHost(env, url) { try { return new URL(baseUrl(env, url)).host === url.host; } catch { return true; } }

function agentLd(S, base) {
  const o = { '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: SITE_NAME, url: base + '/', logo: base + '/logo.png' };
  if (S.tel) o.telephone = S.tel;
  if (S.mail) o.email = S.mail;
  if (S.adr) o.address = S.adr;
  return o;
}
const factLine = (r) => [r.tip, r.tur, r.m2 + ' m²', r.oda && r.oda !== '-' ? r.oda : '', [r.mah, r.ilce, r.il].filter(Boolean).join(', ')].filter(Boolean).join(' · ');

async function renderPage(req, env, url) {
  const base = baseUrl(env, url);
  const canonicalHost = isCanonicalHost(env, url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const S = await siteSettings(env);
  let status = 200, title, desc, canon = base + (path === '/' ? '/' : path), img = null, type = 'website', index = true, body = '';
  const ld = [];
  let m;
  if (path === '/') {
    title = `${SITE_NAME} | Satılık ve Kiralık Daire, Villa, Arsa İlanları`;
    desc = clip(S.sub || S.hero, 160);
    ld.push(agentLd(S, base));
    const { results } = await env.DB.prepare(`${LISTING_SELECT} WHERE l.yayinda = 1 AND u.aktif = 1 ORDER BY l.olusturma DESC LIMIT 12`).all();
    body = `<section class="w"><h1>${h(S.hero)}</h1><p>${h(S.sub)}</p><h2>Son ilanlar</h2><ul>${results.map((r) => `<li><a href="${ilanPath(r.id, r.baslik)}">${h(r.baslik)} – ${trPrice(r.fiyat)}</a></li>`).join('')}</ul></section>`;
  } else if (path === '/ilanlar') {
    const { results } = await env.DB.prepare(`${LISTING_SELECT} WHERE l.yayinda = 1 AND u.aktif = 1 ORDER BY l.olusturma DESC LIMIT 500`).all();
    title = `Satılık ve Kiralık Emlak İlanları | ${SITE_NAME}`;
    desc = `${SITE_NAME} güncel ${results.length} ilan: satılık ve kiralık daire, müstakil ev, villa, tarla ve parsel. Fiyat, m², oda ve konuma göre filtreleyin.`;
    body = `<section class="w"><h1>Emlak ilanları</h1><ul>${results.map((r) => `<li><a href="${ilanPath(r.id, r.baslik)}">${h(r.baslik)}</a> – ${h(factLine(r))} – ${trPrice(r.fiyat)}</li>`).join('')}</ul></section>`;
  } else if ((m = /^\/ilan\/(\d+)(?:-[a-z0-9-]*)?$/.exec(path))) {
    const id = Number(m[1]) - NO_OFFSET;
    const r = id > 0 ? await env.DB.prepare(`${LISTING_SELECT} WHERE l.id = ? AND l.yayinda = 1 AND u.aktif = 1`).bind(id).first() : null;
    if (!r) {
      status = 404; index = false; title = `İlan bulunamadı | ${SITE_NAME}`; desc = 'Aradığınız ilan yayından kaldırılmış olabilir.';
      body = '<section class="w"><h1>İlan bulunamadı</h1><p>Bu ilan yayından kaldırılmış olabilir. <a href="/ilanlar">Tüm ilanlara göz atın</a>.</p></section>';
    } else {
      const cpath = ilanPath(r.id, r.baslik);
      if (cpath !== path) return Response.redirect(url.origin + cpath + url.search, 301);
      canon = base + cpath;
      const fotolar = JSON.parse(r.fotolar || '[]').map((k) => base + imgUrl(k));
      const yer = [r.mah, r.ilce, r.il].filter(Boolean).join(', ');
      title = `${r.baslik} – ${trPrice(r.fiyat)}${r.tip === 'Kiralık' ? '/ay' : ''} | ${SITE_NAME}`;
      desc = clip(`${r.tip} ${r.tur.toLocaleLowerCase('tr')}, ${r.m2} m²${r.oda && r.oda !== '-' ? ', ' + r.oda : ''}, ${yer}. ${r.aciklama}`, 160);
      img = fotolar[0] || null; type = 'article';
      ld.push({
        '@context': 'https://schema.org', '@type': 'RealEstateListing', name: r.baslik, description: clip(r.aciklama, 500),
        url: canon, image: fotolar, datePosted: new Date(r.olusturma * 1000).toISOString(), identifier: String(ilanNo(r.id)),
        offers: { '@type': 'Offer', price: r.fiyat, priceCurrency: 'TRY', availability: 'https://schema.org/InStock', businessFunction: r.tip === 'Kiralık' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell' },
        contentLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: r.ilce, addressRegion: r.il, addressCountry: 'TR', ...(r.mah ? { streetAddress: r.mah } : {}) } },
        floorSize: { '@type': 'QuantitativeValue', value: r.m2, unitCode: 'MTK' },
      });
      ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'İlanlar', item: base + '/ilanlar' },
        { '@type': 'ListItem', position: 2, name: r.baslik, item: canon }] });
      body = `<article class="w"><p><a href="/ilanlar">İlanlar</a> / ${h(r.il)} / ${h(r.ilce)}</p><h1>${h(r.baslik)}</h1><p><strong>${trPrice(r.fiyat)}${r.tip === 'Kiralık' ? ' / ay' : ''}</strong> · İlan No ${ilanNo(r.id)}</p><p>${h(factLine(r))}</p>${img ? `<img src="${h(img)}" alt="${h(r.baslik)}" width="800">` : ''}<p>${h(r.aciklama)}</p><p>Danışman: ${h(r.sahip_ad)}</p></article>`;
    }
  } else if (path === '/hakkimizda') {
    title = `Hakkımızda | ${SITE_NAME}`; desc = clip(S.hak, 160); ld.push(agentLd(S, base));
    body = `<section class="w"><h1>Hakkımızda</h1>${String(S.hak || '').split(/\n\s*\n/).map((p) => `<p>${h(p)}</p>`).join('')}</section>`;
  } else if (path === '/iletisim') {
    title = `İletişim | ${SITE_NAME}`; desc = clip(`${SITE_NAME} iletişim bilgileri${S.tel ? ': ' + S.tel : ''}${S.adr ? ', ' + S.adr : ''}.`, 160); ld.push(agentLd(S, base));
    body = `<section class="w"><h1>İletişim</h1>${S.tel ? `<p>Telefon: ${h(S.tel)}</p>` : ''}${S.mail ? `<p>E-posta: ${h(S.mail)}</p>` : ''}${S.adr ? `<p>Adres: ${h(S.adr)}</p>` : ''}</section>`;
  } else if (APP_PAGES[path]) {
    title = `${APP_PAGES[path]} | ${SITE_NAME}`; desc = S.sub; index = false;
  } else {
    status = 404; index = false; title = `Sayfa bulunamadı | ${SITE_NAME}`; desc = 'Aradığınız sayfa bulunamadı.';
    body = '<section class="w"><h1>Sayfa bulunamadı</h1><p><a href="/">Ana sayfaya dönün</a>.</p></section>';
  }
  if (!canonicalHost) index = false;
  const robots = index ? 'index,follow,max-image-preview:large' : 'noindex,follow';
  const head = [
    `<title>${h(title)}</title>`,
    `<meta name="description" content="${h(desc)}">`,
    `<meta name="robots" content="${robots}">`,
    status === 200 ? `<link rel="canonical" href="${h(canon)}">` : '',
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="tr_TR">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${h(title)}">`,
    `<meta property="og:description" content="${h(desc)}">`,
    `<meta property="og:url" content="${h(canon)}">`,
    `<meta property="og:image" content="${h(img || base + '/og.jpg')}">`,
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    ...ld.map(ldJson),
  ].filter(Boolean).join('\n');
  const shellRes = await env.ASSETS.fetch(new Request(new URL('/shell.html', url)));
  let html = await shellRes.text();
  html = html.replace('<title>Asya Emlak</title>', head).replace('<main id="app"></main>', `<main id="app">${body}</main>`);
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' };
  if (!index) headers['x-robots-tag'] = 'noindex';
  return new Response(html, { status, headers });
}

async function sitemap(env, url) {
  const base = baseUrl(env, url);
  const { results } = await env.DB.prepare(`SELECT l.id, l.baslik, l.guncelleme FROM listings l JOIN users u ON u.id = l.user_id
    WHERE l.yayinda = 1 AND u.aktif = 1 ORDER BY l.guncelleme DESC LIMIT 45000`).all();
  const d = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const urls = [['/', null, '1.0'], ['/ilanlar', results[0] ? d(results[0].guncelleme) : null, '0.9'], ['/hakkimizda', null, '0.4'], ['/iletisim', null, '0.4'],
    ...results.map((r) => [ilanPath(r.id, r.baslik), d(r.guncelleme), '0.8'])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, lm, pr]) =>
    `<url><loc>${h(base + p)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}<priority>${pr}</priority></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}

function robotsTxt(env, url) {
  const base = baseUrl(env, url);
  const txt = isCanonicalHost(env, url)
    ? `User-agent: *\nDisallow: /api/\nDisallow: /panel\nDisallow: /giris\nDisallow: /hesap\nDisallow: /yonetim\nDisallow: /ayarlar\nDisallow: /favoriler\n\nSitemap: ${base}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(txt, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

// ---------- Fotoğraf sunumu ----------
async function serveImage(req, env, url) {
  const key = keyFromUrl(url.pathname);
  if (!key || !env.FOTO) return new Response('Bulunamadı', { status: 404 });
  const obj = await env.FOTO.get(key);
  if (!obj) return new Response('Bulunamadı', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: obj.httpEtag,
      'x-content-type-options': 'nosniff',
    },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, env, url);
      if (url.pathname.startsWith('/img/')) return await serveImage(req, env, url);
      // www → ana alan adı
      if (url.hostname.startsWith('www.')) {
        url.hostname = url.hostname.slice(4);
        return Response.redirect(url.toString(), 301);
      }
      if (url.pathname === '/robots.txt') return robotsTxt(env, url);
      if (url.pathname === '/sitemap.xml') return await sitemap(env, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Bulunamadı', { status: 404 });
      if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return env.ASSETS.fetch(req);
      return await renderPage(req, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ hata: e.message }, e.status);
      console.error(e);
      return json({ hata: 'Sunucu hatası. Lütfen tekrar deneyin.' }, 500);
    }
  },
};
