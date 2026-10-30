// Asya Emlak — Cloudflare Worker (API + fotoğraf sunumu)
// Statik site public/ klasöründen ASSETS ile sunulur; /api/* ve /img/* bu dosyada işlenir.

const PBKDF2_ITER = 100000; // Workers'ta izin verilen en yüksek değer
const SESSION_DAYS = 30;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 90 * 1024 * 1024; // Cloudflare ücretsiz planda istek sınırı 100 MB
const MAX_PHOTOS = 15;
const LOGIN_MAX_TRIES = 5;
const LOGIN_WINDOW_SEC = 15 * 60;

const TIPLER = ['Satılık', 'Kiralık'];
const TURLER = ['Daire', 'Müstakil', 'Villa', 'Dubleks', 'Dükkan', 'Ofis', 'Depo', 'Tarla', 'Parsel'];
const ISYERI = ['Dükkan', 'Ofis', 'Depo'];
const OZELLIKLER = ['Balkon', 'Otopark', 'Eşyalı', 'Güvenlik', 'Havuz', 'Cadde üzeri', 'Köşe başı', 'Vitrinli', 'Yüksek tavan', 'Kamyon girişi'];
const AYAR_ANAHTARLARI = ['hero', 'sub', 'tel', 'mail', 'adr', 'saat', 'hak', 'bolge', 'foto', 'harita', 'harita_e'];
const DURUMLAR = ['aktif', 'opsiyon', 'satildi', 'kiralandi', 'pasif'];
const PAYLASIM_GUN = [1, 3, 7, 15, 30];
const AYAR_VARSAYILAN = {
  hero: 'Aradığınız evi anlatın, biz bulalım.',
  sub: 'Nasıl bir ev istediğinizi birkaç dokunuşla anlatın; size uygun seçenekleri danışmanımız WhatsApp\'tan iletsin.',
  tel: '',
  mail: '',
  adr: '',
  saat: 'Hafta içi 09:00 - 18:00',
  hak: 'Asya Emlak, alıcı ve kiracıları doğru mülkle buluşturmak için çalışan bir emlak danışmanlığı firmasıdır.',
  bolge: '',
  foto: '',
  harita: '',
  harita_e: '',
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
const vidKey = (u) => {
  const m = /^(?:\/img\/)?(v\/[A-Za-z0-9_-]{10,64}\.(?:mp4|webm))$/.exec(String(u || ''));
  return m ? m[1] : null;
};
const keyFromUrl = (u) => {
  const m = /^(?:\/img\/)?(p\/[A-Za-z0-9_-]{10,64}\.jpg)$/.exec(String(u || ''));
  return m ? m[1] : null;
};

function toFront(r, withPrivate) {
  const o = {
    id: r.id, no: ilanNo(r.id), url: ilanPath(r.id, r.baslik), u: r.user_id, t: r.baslik, tip: r.tip, tur: r.tur, f: r.fiyat, m2: r.m2,
    il: r.il, ilce: r.ilce, mah: r.mah, oda: r.oda, kat: r.kat, yas: r.yas, as: r.asansor,
    oz: JSON.parse(r.ozellik || '[]'), d: r.aciklama,
    p: JSON.parse(r.fotolar || '[]').map(imgUrl), v: r.video ? imgUrl(r.video) : '', durum: r.durum || 'aktif',
    tarih: r.olusturma, gun: r.guncelleme,
    sahip: { ad: r.sahip_ad, tel: r.sahip_tel, mail: r.sahip_mail },
  };
  if (withPrivate) Object.assign(o, { adr: r.adres, lat: r.lat, lon: r.lon, ms: r.mal_sahibi, mt: r.mal_tel, yb: r.yetki_bitis, nt: r.notlar, priv: 1 });
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
    oda: arsa || ISYERI.includes(tur) ? '-' : str(b.oda, 10, { name: 'Oda' }),
    kat: arsa ? 0 : int(b.kat ?? 0, -5, 200, 'Kat'),
    yas: arsa ? 0 : int(b.yas ?? 0, 0, 300, 'Bina yaşı'),
    asansor: arsa ? 0 : (Number(b.as) ? 1 : 0),
    ozellik: JSON.stringify(arsa ? [] : oz),
    aciklama: str(b.d, 3000, { name: 'Açıklama' }) || 'Detaylı bilgi için danışmanımızla iletişime geçin.',
    fotolar: JSON.stringify(p),
    video: (() => { if (!b.v) return ''; const k = vidKey(b.v); if (!k) throw new HttpError(400, 'Video geçersiz.'); return k; })(),
    durum: DURUMLAR.includes(b.durum) ? b.durum : 'aktif',
    mal_sahibi: str(b.ms, 100, { name: 'Mal sahibi' }),
    mal_tel: str(b.mt, 30, { name: 'Mal sahibi telefonu' }),
    yetki_bitis: (() => { const y = str(b.yb, 10); if (y && !/^\d{4}-\d{2}-\d{2}$/.test(y)) throw new HttpError(400, 'Yetki bitiş tarihi geçersiz.'); return y; })(),
    notlar: str(b.nt, 2000, { name: 'Notlar' }),
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

// Google Haritalar işletme bağlantısını çözer: kısa bağlantıyı açar, işletme kimliğini (cid) ya da koordinatı bulur
async function haritaCoz(raw) {
  let u = String(raw || '').trim();
  if (!u) return { link: '', embed: '' };
  const m0 = /https?:\/\/\S+/.exec(u); if (m0) u = m0[0];
  const hata = () => new HttpError(400, "Google Haritalar bağlantısı anlaşılamadı. İşletmenizi Google Haritalar'da açıp Paylaş → Bağlantıyı kopyala ile aldığınız bağlantıyı yapıştırın.");
  let url; try { url = new URL(u); } catch { throw hata(); }
  if (!/(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i.test(url.hostname)) throw hata();
  for (let i = 0; i < 4 && /goo\.gl$|g\.page$/i.test(url.hostname); i++) {
    const r = await fetch(url.toString(), { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0' } });
    const loc = r.headers.get('location'); if (!loc) break;
    url = new URL(loc, url);
  }
  const s = decodeURIComponent(url.toString());
  let cid = url.searchParams.get('cid');
  const ft = /(?:ftid=|!1s)0x[0-9a-f]+:0x([0-9a-f]+)/i.exec(s);
  if (!cid && ft) cid = BigInt('0x' + ft[1]).toString();
  if (cid && !/^\d{5,25}$/.test(cid)) cid = null;
  const ll = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s) || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s);
  const ad = (/\/place\/([^/@]+)/.exec(s) || [])[1];
  const q = url.searchParams.get('q');
  if (cid) return { link: `https://www.google.com/maps?cid=${cid}`, embed: `https://www.google.com/maps?cid=${cid}&z=16&output=embed&hl=tr` };
  if (ll) { const lat = ll[1], lng = ll[2], name = ad ? ad.replace(/\+/g, ' ') : `${lat},${lng}`;
    return { link: url.toString(), embed: `https://www.google.com/maps?q=${encodeURIComponent(name)}&ll=${lat},${lng}&z=17&output=embed&hl=tr` }; }
  if (q) return { link: url.toString(), embed: `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed&hl=tr` };
  throw hata();
}

async function sharedListing(env, token) {
  const p = await env.DB.prepare(`SELECT p.*, u.ad, u.tel, u.mail, u.aktif FROM paylasim p JOIN users u ON u.id = p.user_id WHERE p.token_hash = ?`)
    .bind(await sha256(token)).first();
  if (!p) return { status: 404, hata: 'Bağlantı bulunamadı.' };
  if (p.bitis < now()) return { status: 410, hata: 'Bu bağlantının süresi dolmuş. Güncel bilgi için danışmanınızla iletişime geçin.' };
  const row = await getListingRow(env, p.listing_id);
  if (!row || !['aktif', 'opsiyon'].includes(row.durum || 'aktif') || !p.aktif)
    return { status: 410, hata: 'Bu ilan artık geçerli değil. Benzer seçenekler için danışmanınızla iletişime geçin.' };
  return { p, row };
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
    delete b.harita_e;
    if ('harita' in b) { const hm = await haritaCoz(b.harita); b.harita = hm.link; b.harita_e = hm.embed; }
    const stmts = AYAR_ANAHTARLARI.filter((k) => k in b).map((k) =>
      env.DB.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind(k, k === 'foto' ? (b.foto ? (keyFromUrl(b.foto) ? imgUrl(keyFromUrl(b.foto)) : (() => { throw new HttpError(400, 'Görsel geçersiz.'); })()) : '') : str(b[k], k === 'hak' ? 5000 : k === 'bolge' ? 1000 : k.startsWith('harita') ? 600 : 300))
    );
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true });
  }

  // --- İlanlar ---
  // İlanlar kamuya açık değildir: yalnızca giriş yapmış ekip üyeleri portföyü görür.
  if (path === '/listings' && method === 'GET') {
    requireUser(user);
    const { results } = await env.DB.prepare(`${LISTING_SELECT} ORDER BY l.olusturma DESC LIMIT 2000`).all();
    return json({ ilanlar: results.map((r) => toFront(r, canManage(user, r))) });
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
    requireUser(user);
    const manage = row && canManage(user, row);
    if (!row) throw new HttpError(404, 'İlan bulunamadı.');

    if (method === 'GET') return json(toFront(row, manage));
    if (!manage) throw new HttpError(403, 'Bu ilanı değiştirme yetkiniz yok.');

    if (method === 'PUT') {
      const v = parseListing(await body());
      await env.DB.prepare(
        `UPDATE listings SET baslik=?, tip=?, tur=?, fiyat=?, m2=?, il=?, ilce=?, mah=?, adres=?, lat=?, lon=?,
         oda=?, kat=?, yas=?, asansor=?, ozellik=?, aciklama=?, fotolar=?, video=?, durum=?, mal_sahibi=?, mal_tel=?,
         yetki_bitis=?, notlar=?, guncelleme=? WHERE id=?`
      ).bind(v.baslik, v.tip, v.tur, v.fiyat, v.m2, v.il, v.ilce, v.mah, v.adres, v.lat, v.lon,
        v.oda, v.kat, v.yas, v.asansor, v.ozellik, v.aciklama, v.fotolar, v.video, v.durum, v.mal_sahibi, v.mal_tel,
        v.yetki_bitis, v.notlar, now(), id).run();
      const eski = JSON.parse(row.fotolar || '[]'), yeni = JSON.parse(v.fotolar);
      const sil = eski.filter((k) => !yeni.includes(k));
      if (row.video && row.video !== v.video) sil.push(row.video);
      await deletePhotos(env, sil);
      return json(toFront(await getListingRow(env, id), true));
    }
    if (method === 'PATCH') {
      const b = await body();
      if (!DURUMLAR.includes(b.durum)) throw new HttpError(400, 'Durum geçersiz.');
      await env.DB.prepare('UPDATE listings SET durum = ?, guncelleme = ? WHERE id = ?').bind(b.durum, now(), id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.batch([env.DB.prepare('DELETE FROM paylasim WHERE listing_id = ?').bind(id), env.DB.prepare('DELETE FROM listings WHERE id = ?').bind(id)]);
      await deletePhotos(env, [...JSON.parse(row.fotolar || '[]'), ...(row.video ? [row.video] : [])]);
      return json({ ok: true });
    }
  }

  // --- Müşteriye özel, süreli paylaşım bağlantıları ---
  if ((m = /^\/listings\/(\d+)\/paylas$/.exec(path))) {
    requireUser(user);
    const id = Number(m[1]);
    const row = await getListingRow(env, id);
    if (!row) throw new HttpError(404, 'İlan bulunamadı.');
    if (method === 'POST') {
      if (!['aktif', 'opsiyon'].includes(row.durum || 'aktif')) throw new HttpError(400, 'Yalnızca aktif veya opsiyonlu ilanlar paylaşılabilir.');
      const b = await body();
      const gun = PAYLASIM_GUN.includes(Number(b.gun)) ? Number(b.gun) : 7;
      const token = b64url(crypto.getRandomValues(new Uint8Array(18)));
      const bitis = now() + gun * 86400;
      await env.DB.prepare('INSERT INTO paylasim (token_hash, listing_id, user_id, musteri, bitis, olusturma) VALUES (?,?,?,?,?,?)')
        .bind(await sha256(token), id, user.id, str(b.musteri, 80, { name: 'Müşteri' }), bitis, now()).run();
      return json({ url: '/p/' + token, bitis }, 201);
    }
    if (method === 'GET') {
      const all = canManage(user, row);
      const { results } = await env.DB.prepare(
        `SELECT p.id, p.musteri, p.bitis, p.goruntulenme, p.son_gorulme, p.olusturma, p.user_id, u.ad FROM paylasim p JOIN users u ON u.id = p.user_id
         WHERE p.listing_id = ? ${all ? '' : 'AND p.user_id = ?'} ORDER BY p.olusturma DESC LIMIT 50`
      ).bind(...(all ? [id] : [id, user.id])).all();
      return json(results.map((r) => ({ id: r.id, musteri: r.musteri, bitis: r.bitis, gor: r.goruntulenme, son: r.son_gorulme, tarih: r.olusturma, ad: r.ad, benim: r.user_id === user.id })));
    }
  }
  if ((m = /^\/paylasim\/(\d+)$/.exec(path)) && method === 'DELETE') {
    requireUser(user);
    const p = await env.DB.prepare('SELECT p.*, l.user_id AS sahip FROM paylasim p JOIN listings l ON l.id = p.listing_id WHERE p.id = ?').bind(Number(m[1])).first();
    if (!p) throw new HttpError(404, 'Bağlantı bulunamadı.');
    if (p.user_id !== user.id && !canAll(user) && p.sahip !== user.id) throw new HttpError(403, 'Bu bağlantıyı iptal etme yetkiniz yok.');
    await env.DB.prepare('UPDATE paylasim SET bitis = ? WHERE id = ?').bind(now() - 1, p.id).run();
    return json({ ok: true });
  }
  // Müşterinin açtığı bağlantı: yalnızca vitrin bilgileri (açık adres, mal sahibi, notlar asla gönderilmez)
  if ((m = /^\/p\/([A-Za-z0-9_-]{16,40})$/.exec(path)) && method === 'GET') {
    const r = await sharedListing(env, m[1]);
    if (!r.row) throw new HttpError(r.status, r.hata);
    await env.DB.prepare('UPDATE paylasim SET goruntulenme = goruntulenme + 1, son_gorulme = ? WHERE id = ?').bind(now(), r.p.id).run();
    const o = toFront(r.row, false);
    delete o.u; delete o.url; delete o.id;
    o.sahip = { ad: r.p.ad, tel: r.p.tel, mail: r.p.mail };
    o.bitis = r.p.bitis;
    return json(o);
  }

  if (path === '/listings' && method === 'POST') {
    requireUser(user);
    const v = parseListing(await body());
    const t = now();
    const r = await env.DB.prepare(
      `INSERT INTO listings (user_id, baslik, tip, tur, fiyat, m2, il, ilce, mah, adres, lat, lon, oda, kat, yas,
       asansor, ozellik, aciklama, fotolar, video, durum, mal_sahibi, mal_tel, yetki_bitis, notlar, yayinda, olusturma, guncelleme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`
    ).bind(user.id, v.baslik, v.tip, v.tur, v.fiyat, v.m2, v.il, v.ilce, v.mah, v.adres, v.lat, v.lon,
      v.oda, v.kat, v.yas, v.asansor, v.ozellik, v.aciklama, v.fotolar, v.video, v.durum, v.mal_sahibi, v.mal_tel,
      v.yetki_bitis, v.notlar, t, t).run();
    return json(toFront(await getListingRow(env, r.meta.last_row_id), true), 201);
  }

  // --- Video yükleme (tarayıcıda 720p'ye küçültülmüş olarak gelir) ---
  if (path === '/videos' && method === 'POST') {
    requireUser(user);
    if (!env.FOTO) throw new HttpError(503, 'Dosya depolama henüz etkin değil.');
    const type = (req.headers.get('content-type') || '').toLowerCase();
    const ext = type.startsWith('video/mp4') ? 'mp4' : type.startsWith('video/webm') ? 'webm' : null;
    if (!ext) throw new HttpError(415, 'Video MP4 veya WebM olmalı.');
    const len = Number(req.headers.get('content-length') || 0);
    if (!len || !req.body) throw new HttpError(400, 'Boş video.');
    if (len > MAX_VIDEO_BYTES) throw new HttpError(413, 'Video çok büyük (en fazla 90 MB).');
    const key = `v/${b64url(crypto.getRandomValues(new Uint8Array(18)))}.${ext}`;
    await env.FOTO.put(key, req.body, { httpMetadata: { contentType: 'video/' + ext }, customMetadata: { user: String(user.id) } });
    // Dosya imzasını doğrula (MP4: 'ftyp', WebM: EBML)
    const head = await env.FOTO.get(key, { range: { offset: 0, length: 12 } });
    const b = head ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array();
    const ok = ext === 'mp4' ? String.fromCharCode(...b.slice(4, 8)) === 'ftyp' : b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    if (!ok) { await env.FOTO.delete(key); throw new HttpError(415, 'Geçersiz video dosyası.'); }
    return json({ url: imgUrl(key) }, 201);
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
const APP_PAGES = { '/giris': 'Danışman girişi', '/panel': 'İlan yönetimi', '/ilanlar': 'Portföy', '/hesap': 'Hesabım', '/yonetim': 'Kullanıcılar', '/ayarlar': 'Site ayarları' };

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
    title = `${SITE_NAME} | Emlak Danışmanlığı – Satılık ve Kiralık Konut, Villa, Arsa`;
    desc = clip(`${S.hero} ${S.sub}`, 160);
    ld.push(agentLd(S, base));
    const bolge = String(S.bolge || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    body = `<section class="w"><h1>${h(S.hero)}</h1><p>${h(S.sub)}</p><p><a href="/talep">Talep oluşturun</a></p><h2>Hizmetlerimiz</h2><ul><li>Satış danışmanlığı</li><li>Kiralama danışmanlığı</li><li>Arsa ve tarla danışmanlığı</li><li>Değerleme ve e-Devlet yetkilendirme desteği</li></ul>${bolge.length ? `<h2>Hizmet bölgelerimiz</h2><p>${bolge.map(h).join(', ')}</p>` : ''}${S.tel ? `<p>Telefon: ${h(S.tel)}</p>` : ''}</section>`;
  } else if (path === '/talep') {
    title = `Ev talebi oluşturun | ${SITE_NAME}`;
    desc = 'Satın almak, kiralamak, satmak ya da kiraya vermek için talebinizi 1 dakikada oluşturun; WhatsApp ile doğrudan Asya Emlak\'a iletin.';
    body = '<section class="w"><h1>Talep oluşturun</h1><p>Nasıl bir ev aradığınızı, bölgenizi ve bütçenizi anlatın; talebiniz WhatsApp ile bize iletilsin.</p></section>';
  } else if (/^\/ilan\/\d+/.test(path)) {
    // İlan sayfaları yalnızca ekip içindir; içerik sunucuda yazılmaz, arama motorlarına kapalıdır.
    title = `İlan | ${SITE_NAME}`; desc = S.sub; index = false;
  } else if ((m = /^\/p\/([A-Za-z0-9_-]{16,40})$/.exec(path))) {
    index = false; canon = base + path;
    const r = await sharedListing(env, m[1]);
    if (!r.row) { status = r.status; title = `Bağlantı geçersiz | ${SITE_NAME}`; desc = r.hata; }
    else {
      const f = JSON.parse(r.row.fotolar || '[]');
      title = `${r.row.baslik} – ${trPrice(r.row.fiyat)}${r.row.tip === 'Kiralık' ? '/ay' : ''}`;
      desc = clip(`${factLine(r.row)}. ${SITE_NAME} danışmanınız ${r.p.ad} tarafından size özel paylaşıldı.`, 160);
      img = f[0] ? base + imgUrl(f[0]) : null;
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
    status === 200 && index ? `<link rel="canonical" href="${h(canon)}">` : '',
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
  const urls = [['/', '1.0'], ['/talep', '0.9'], ['/hakkimizda', '0.6'], ['/iletisim', '0.6']];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr]) =>
    `<url><loc>${h(base + p)}</loc><priority>${pr}</priority></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}

function robotsTxt(env, url) {
  const base = baseUrl(env, url);
  const txt = isCanonicalHost(env, url)
    ? `User-agent: *\nDisallow: /api/\nDisallow: /p/\nDisallow: /ilan/\nDisallow: /ilanlar\nDisallow: /panel\nDisallow: /giris\nDisallow: /hesap\nDisallow: /yonetim\nDisallow: /ayarlar\n\nSitemap: ${base}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(txt, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

// ---------- Fotoğraf sunumu ----------
async function serveImage(req, env, url) {
  const key = keyFromUrl(url.pathname) || vidKey(url.pathname);
  if (!key || !env.FOTO) return new Response('Bulunamadı', { status: 404 });
  const isVid = key.startsWith('v/');
  const wantRange = isVid && req.headers.has('range');
  const obj = await env.FOTO.get(key, wantRange ? { range: req.headers } : undefined);
  if (!obj) return new Response('Bulunamadı', { status: 404 });
  const headers = {
    'content-type': isVid ? (key.endsWith('.mp4') ? 'video/mp4' : 'video/webm') : 'image/jpeg',
    'cache-control': 'public, max-age=31536000, immutable',
    etag: obj.httpEtag,
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
  };
  if (wantRange && obj.range) {
    const r = obj.range, size = obj.size;
    const start = 'suffix' in r && r.suffix != null ? size - r.suffix : r.offset ?? 0;
    const end = 'suffix' in r && r.suffix != null ? size - 1 : r.length != null ? start + r.length - 1 : size - 1;
    headers['content-range'] = `bytes ${start}-${end}/${size}`;
    headers['content-length'] = String(end - start + 1);
    return new Response(req.method === 'HEAD' ? null : obj.body, { status: 206, headers });
  }
  headers['content-length'] = String(obj.size);
  return new Response(req.method === 'HEAD' ? null : obj.body, { headers });
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
