'use strict';
// Asya Emlak ön yüzü — veriler sunucudaki API'den gelir (/api/*)

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>';
const SHR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const GAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';

const TUR = ['Daire', 'Müstakil', 'Villa', 'Dubleks', 'Tarla', 'Parsel'];
const OZ = ['Balkon', 'Otopark', 'Eşyalı', 'Güvenlik', 'Havuz'];
const STEPS = ['Başlık', 'Fotoğraflar', 'Bilgiler', 'Açıklama'];
const ARSA = (t) => t === 'Tarla' || t === 'Parsel';

// ---------- Durum ----------
let me = null, kurulum = false, fotoOk = false;
let L = [], DAN = 0, MY = null, USERS = null;
let SS = { hero: '', sub: '', tel: '', mail: '', adr: '', saat: '', hak: '' };
let tab = 'il', W = null, ws = 0;
let F = { tip: '', q: '', pmin: '', pmax: '', amin: '', amax: '', oda: [], kat: '', as: '', s: '', tur: '', yas: '', oz: [], il: '' };
const role = () => (!me ? 'v' : me.rol === 'admin' ? 'm' : 'a');
const own = (l) => !!me && (me.rol === 'admin' || l.u === me.id);

// ---------- Yardımcılar ----------
async function api(path, { method = 'GET', body, raw, type } = {}) {
  const headers = { 'x-asya': '1' };
  let data = body;
  if (raw) { data = raw; headers['content-type'] = type; }
  else if (body !== undefined) { data = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  let r;
  try { r = await fetch('/api' + path, { method, headers, body: data, credentials: 'same-origin' }); }
  catch { throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.hata || 'Bir hata oluştu.'); e.status = r.status; throw e; }
  return j;
}
const TL = (n) => Number(n).toLocaleString('tr-TR') + ' ₺';
const ph = (x, c = '') => typeof x === 'string'
  ? `<div class="ph ${c}" style="background-image:url('${esc(x)}')"></div>`
  : `<div class="ph ${c}" style="--h:${x ?? 210}">${HS}</div>`;
const toast = (m) => { const e = document.createElement('div'); e.className = 'ok'; e.textContent = m; document.body.append(e); setTimeout(() => e.remove(), 2200); };
const kt = (l) => (l.kat < 0 ? 'Bodrum ' + -l.kat : l.kat == 0 ? 'Zemin kat' : l.kat + '. kat');
const S = (a, b) => (a === b ? 'selected' : '');
const yer = (l) => [l.mah, l.ilce, l.il].filter(Boolean).map(esc).join(', ');
const fiyat = (l) => TL(l.f) + (l.tip === 'Kiralık' ? ' / ay' : '');
const lk = (id) => location.origin + location.pathname + '#ilan-' + id;
const mapEmbed = (a, o) => `https://www.openstreetmap.org/export/embed.html?bbox=${o - 0.004},${a - 0.003},${+o + 0.004},${+a + 0.003}&layer=mapnik&marker=${a},${o}`;
const mapLink = (l) => l.lat
  ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.adr, l.mah, l.ilce, l.il].filter(Boolean).join(', '))}`;
const loading = (t = 'Yükleniyor…') => { $('#app').innerHTML = `<div class="w"><p class="mu">${t}</p></div>`; };
const errBox = (m) => { $('#app').innerHTML = `<div class="w"><div class="pn"><p>${esc(m)}</p><a class="tg" href="#ana">Ana sayfaya dön</a></div></div>`; };
const needLogin = () => { go('#giris'); };

async function shareIt(title, text, url) {
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı'); }
  catch { window.open('https://wa.me/?text=' + encodeURIComponent(title + '\n' + url), '_blank'); }
}

async function refreshPublic() {
  const r = await api('/listings');
  L = r.ilanlar; DAN = r.danisman;
}

// ---------- Menü ----------
function renderNav() {
  const r = role();
  $('#pl').hidden = r === 'v';
  $('#al').hidden = $('#sl').hidden = r !== 'm';
  $('#gl').hidden = r !== 'v';
  $('#hl').hidden = r === 'v';
  if (me) $('#hl').textContent = me.ad.split(' ')[0] || 'Hesabım';
}

// ---------- Kartlar ----------
function card(l) {
  return `<a class="cd" href="#ilan-${l.id}">${ph(l.p[0])}<div class="b"><span class="tg">${esc(l.tip)}</span><div class="pc">${fiyat(l)}</div><div>${esc(l.t)}</div><div class="mu">${yer(l)}</div><div class="sp2"><span>${l.m2} m²</span>${ARSA(l.tur) ? `<span>${esc(l.tur)}</span>` : `<span>${esc(l.oda)}</span><span>${kt(l)}</span><span>${l.as ? 'Asansörlü' : 'Asansörsüz'}</span>`}</div></div></a>`;
}

// ---------- Ana sayfa ----------
const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.12 });
const rv = () => document.querySelectorAll('.rv').forEach((e) => io.observe(e));
const cu = () => document.querySelectorAll('[data-n]').forEach((e) => { const t = +e.dataset.n; let i = 0; const s = () => { e.textContent = Math.round((t * ++i) / 36); if (i < 36) requestAnimationFrame(s); }; s(); });
const R = () => { F = { tip: '', q: '', pmin: '', pmax: '', amin: '', amax: '', oda: [], kat: '', as: '', s: F.s, tur: '', yas: '', oz: [], il: '' }; };

function home() {
  const a = L, n = (t, v) => `<div><b data-n="${v}">0</b><span class="mu">${t}</span></div>`;
  const vc = (c, l) => (l ? `<div class="vc ${c}">${ph(l.p[0])}<div class="b"><b class="pc" style="font-size:15px">${fiyat(l)}</b><br>${esc(l.ilce)}, ${esc(l.il)}</div></div>` : '');
  const yerler = [...new Set(L.map((l) => l.ilce + ', ' + l.il))];
  const ds = yerler.map((x) => `<span>${esc(x)}</span>`).join('');
  $('#app').innerHTML = `<section class="hero"><i class="ob o1"></i><i class="ob o2"></i><div class="hg"><div><h1>${esc(SS.hero)}</h1><p>${esc(SS.sub)}</p><form class="sr" id="hs"><select name="tip"><option value="">Satılık ve kiralık</option><option>Satılık</option><option>Kiralık</option></select><input name="q" placeholder="Şehir, ilçe veya kelime"><button class="pr">İlanları göster</button></form><div class="st">${n('güncel ilan', a.length)}${n('satılık', a.filter((l) => l.tip === 'Satılık').length)}${n('kiralık', a.filter((l) => l.tip === 'Kiralık').length)}${n('danışman', DAN)}</div></div><div class="vis">${vc('v1', a[0])}${vc('v2', a[1])}${vc('v3', a[2])}</div></div></section>${yerler.length ? `<div class="mq"><div>${ds}${ds}</div></div>` : ''}<div class="w rv"><h2>Öne çıkan ilanlar</h2>${a.length ? `<div class="grid">${a.slice(0, 3).map(card).join('')}</div><p><a class="tg" href="#ilanlar">Tüm ilanları gör</a></p>` : '<div class="pn mu">Henüz yayında ilan yok. Danışmanlarımız ilan ekledikçe burada görünecek.</div>'}</div><div class="w rv"><h2>Neden Asya Emlak?</h2><div class="ft"><div class="pn"><h3>Kontrol edilmiş ilanlar</h3><span class="mu">Her ilan yönetici denetiminden geçer, gerektiğinde yayından kaldırılır.</span></div><div class="pn"><h3>Doğrudan danışman</h3><span class="mu">İlan sahibine telefon, e-posta veya WhatsApp ile tek adımda ulaşın.</span></div><div class="pn"><h3>Net filtreler</h3><span class="mu">Fiyat, alan, oda, kat, bina yaşı ve özelliklerle aradığınızı daraltın.</span></div></div></div><div class="w rv"><div class="pn cta"><div><h2 style="margin:0">Mülkünüzü satmak veya kiralamak mı istiyorsunuz?</h2><span class="mu">Danışmanlarımızla görüşün, size uygun yol haritasını birlikte çıkaralım.</span></div><a class="ba" href="#iletisim">Bize ulaşın</a></div></div>`;
  $('#hs').onsubmit = (e) => { e.preventDefault(); const d = new FormData(e.target); R(); F.tip = d.get('tip'); F.q = d.get('q'); go('#ilanlar'); };
  rv(); cu();
}

// ---------- İlanlar ve filtre ----------
function filt() {
  const q = (F.q || '').toLocaleLowerCase('tr'), oz = F.oz || [];
  const r = L.filter((l) => (!F.tip || l.tip === F.tip) && (!F.il || l.il === F.il) && (!F.tur || l.tur === F.tur)
    && (!F.pmin || l.f >= +F.pmin) && (!F.pmax || l.f <= +F.pmax) && (!F.amin || l.m2 >= +F.amin) && (!F.amax || l.m2 <= +F.amax)
    && (!F.oda.length || F.oda.includes(String(Math.min(parseInt(l.oda) || 0, 4))))
    && (!F.kat || (F.kat === 'z' ? l.kat <= 0 : F.kat === '1' ? l.kat >= 1 && l.kat <= 3 : l.kat >= 4))
    && (!F.yas || (F.yas === '0' ? l.yas <= 5 : F.yas === '1' ? l.yas > 5 && l.yas <= 15 : l.yas > 15))
    && (F.as === '' || String(l.as) === F.as) && oz.every((o) => (l.oz || []).includes(o))
    && (l.il + ' ' + l.ilce + ' ' + (l.mah || '') + ' ' + l.t).toLocaleLowerCase('tr').includes(q));
  if (F.s === 'pa') r.sort((a, b) => a.f - b.f);
  if (F.s === 'pd') r.sort((a, b) => b.f - a.f);
  if (F.s === 'm') r.sort((a, b) => b.m2 - a.m2);
  return r;
}
function rs() {
  const r = filt();
  $('#rs').innerHTML = `<div class="tp"><span class="mu">${r.length} ilan bulundu</span><select id="so">${[['', 'En yeni'], ['pa', 'Fiyat: artan'], ['pd', 'Fiyat: azalan'], ['m', 'm²: büyükten küçüğe']].map((o) => `<option value="${o[0]}" ${S(F.s, o[0])}>${o[1]}</option>`).join('')}</select></div>${r.length ? `<div class="grid">${r.map(card).join('')}</div>` : `<p class="mu">${L.length ? 'Filtreye uyan ilan yok. Fiyat veya m² aralığını genişletin.' : 'Henüz yayında ilan yok.'}</p>`}`;
  $('#so').onchange = (e) => { F.s = e.target.value; rs(); };
}
const opt = (a, v) => a.map((o) => `<option value="${esc(o[0])}" ${S(v, o[0])}>${esc(o[1])}</option>`).join('');
const chk = (n, a, v) => `<span class="ck">${a.map((o) => `<label><input type="checkbox" name="${n}" value="${esc(o[0])}" ${(v || []).includes(o[0]) ? 'checked' : ''}>${esc(o[1])}</label>`).join('')}</span>`;
function ilanlar() {
  const rg = (a, b) => `<span class="rg"><input name="${a}" type="number" min="0" placeholder="En az" value="${esc(F[a])}"><input name="${b}" type="number" min="0" placeholder="En çok" value="${esc(F[b])}"></span>`;
  const ils = [...new Set(L.map((l) => l.il))].sort((a, b) => a.localeCompare(b, 'tr')).map((x) => [x, x]);
  $('#app').innerHTML = `<div class="w"><h2>İlanlar</h2><div class="ly"><div id="rs"></div><aside class="pn fp"><form id="ff"><h4 style="margin-top:0">İlan tipi</h4>${chk('tip', [['Satılık', 'Satılık'], ['Kiralık', 'Kiralık']], [F.tip])}<h4>Emlak türü</h4><select name="tur">${opt([['', 'Tümü'], ...TUR.map((t) => [t, t])], F.tur)}</select><h4>Konum</h4><select name="il">${opt([['', 'Tüm şehirler'], ...ils], F.il)}</select><input name="q" placeholder="İlçe, mahalle veya kelime" value="${esc(F.q)}" style="margin-top:8px"><h4>Fiyat aralığı (₺)</h4>${rg('pmin', 'pmax')}<h4>Brüt alan (m²)</h4>${rg('amin', 'amax')}<h4>Oda sayısı</h4>${chk('oda', [['1', '1+1'], ['2', '2+1'], ['3', '3+1'], ['4', '4+']], F.oda)}<h4>Bina yaşı</h4><select name="yas">${opt([['', 'Fark etmez'], ['0', '0 - 5 yaş'], ['1', '6 - 15 yaş'], ['2', '16 ve üzeri']], F.yas)}</select><h4>Bulunduğu kat</h4><select name="kat">${opt([['', 'Fark etmez'], ['z', 'Zemin / giriş'], ['1', '1 - 3. kat'], ['4', '4. kat ve üzeri']], F.kat)}</select><h4>Asansör</h4><select name="as">${opt([['', 'Fark etmez'], ['1', 'Var'], ['0', 'Yok']], F.as)}</select><h4>Özellikler</h4>${chk('oz', OZ.map((o) => [o, o]), F.oz)}<button type="button" id="fc" style="width:100%;margin-top:18px">Filtreleri temizle</button></form></aside></div></div>`;
  const f = $('#ff');
  f.oninput = f.onchange = () => { const d = new FormData(f), t = d.getAll('tip'); F = { ...F, tip: t.length === 1 ? t[0] : '', tur: d.get('tur'), il: d.get('il'), q: d.get('q'), pmin: d.get('pmin'), pmax: d.get('pmax'), amin: d.get('amin'), amax: d.get('amax'), oda: d.getAll('oda'), yas: d.get('yas'), kat: d.get('kat'), as: d.get('as'), oz: d.getAll('oz') }; rs(); };
  $('#fc').onclick = () => { R(); ilanlar(); };
  rs();
}

// ---------- İlan detayı ----------
const privBox = (l) => `<div class="pn pvb"><div class="prv" style="margin:0 0 8px"><span>Açık adres</span><b>Sadece siz görüyorsunuz</b></div><p style="margin:0 0 6px">${esc(l.adr) || '<span class="mu">Açık adres girilmemiş.</span>'}</p><p class="mu" style="margin:0">${yer(l)}</p>${l.lat ? `<iframe class="wmap" title="İlan konumu" loading="lazy" src="${mapEmbed(l.lat, l.lon)}"></iframe>` : ''}<div class="sh2"><a href="${mapLink(l)}" target="_blank" rel="noopener"><button type="button" style="width:100%">Haritada aç</button></a><button type="button" id="shl" class="pr">${SHR} Konumu paylaş</button></div>${l.on ? '' : '<p class="mu" style="margin:10px 0 0">Bu ilan şu an yayında değil; ziyaretçiler göremez.</p>'}</div>`;
async function detail(id) {
  let l = L.find((x) => x.id == id);
  if (me || !l) {
    if (!l) loading();
    try { l = await api('/listings/' + Number(id)); }
    catch (e) { return errBox(e.status === 404 ? 'İlan bulunamadı ya da yayından kaldırılmış.' : e.message); }
    if (cur !== 'ilan-' + id) return;
  }
  const u = l.sahip || {};
  let k = 0;
  const draw = () => { $('#gm').innerHTML = ph(l.p[k]); $('#gt').innerHTML = l.p.map((x, i) => ph(x, i === k ? 'a' : '')).join(''); [...$('#gt').children].forEach((e, i) => (e.onclick = () => { k = i; draw(); })); };
  const wa = (u.tel || '').replace(/\D/g, '').replace(/^0/, '');
  $('#app').innerHTML = `<div class="w"><a class="mu" href="#ilanlar">← Tüm ilanlar</a><div class="dt" style="margin-top:12px"><div><div id="gm"></div><div class="th" id="gt"></div><h2 style="margin-top:18px">${esc(l.t)}</h2><div class="pc" style="font-size:26px">${fiyat(l)}</div><div class="sp2"><span>${yer(l)}</span><span>${l.m2} m²</span>${ARSA(l.tur) ? '' : `<span>${esc(l.oda)}</span><span>${kt(l)}</span><span>${l.as ? 'Asansörlü' : 'Asansörsüz'}</span>`}<span>${esc(l.tip)}</span><span>${esc(l.tur)}</span>${ARSA(l.tur) ? '' : `<span>${l.yas ? l.yas + ' yaşında' : 'Yeni bina'}</span>`}</div><div class="sp2">${(l.oz || []).map((o) => `<span class="tg">${esc(o)}</span>`).join('')}</div><p style="white-space:pre-line">${esc(l.d)}</p></div><aside style="align-self:start;display:grid;gap:14px"><div class="pn"><div class="mu">İlan sahibi</div><h3 style="margin:4px 0 12px">${esc(u.ad)}</h3>${u.tel ? `<p style="margin:0 0 6px">Telefon: <a href="tel:${esc(u.tel)}">${esc(u.tel)}</a></p>` : ''}<p style="margin:0 0 14px">E-posta: <a href="mailto:${esc(u.mail)}">${esc(u.mail)}</a></p>${wa ? `<a href="https://wa.me/90${esc(wa)}" target="_blank" rel="noopener"><button class="pr" style="width:100%">WhatsApp ile yaz</button></a>` : ''}<button type="button" id="shr" style="width:100%;margin-top:10px">${SHR} İlanı paylaş</button></div>${own(l) ? privBox(l) : ''}</aside></div></div>`;
  draw();
  $('#shr').onclick = () => shareIt(l.t + ' · ' + fiyat(l), [l.mah, l.ilce, l.il].filter(Boolean).join(', '), lk(l.id));
  if ($('#shl')) $('#shl').onclick = () => shareIt('Konum: ' + l.t, l.adr || [l.mah, l.ilce, l.il].join(', '), mapLink(l));
}

// ---------- Kurumsal sayfalar ----------
function about() {
  $('#app').innerHTML = `<div class="w"><h2>Hakkımızda</h2><div class="pn" style="max-width:760px">${String(SS.hak || '').split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`;
}
function contact() {
  const r = (t, v, h) => (v ? `<p class="mu" style="margin:0">${t}</p><p style="margin:0 0 14px">${h || esc(v)}</p>` : '');
  $('#app').innerHTML = `<div class="w"><h2>İletişim</h2><div class="cg"><div class="pn">${r('Telefon', SS.tel, `<a href="tel:${esc(SS.tel)}">${esc(SS.tel)}</a>`)}${r('E-posta', SS.mail, `<a href="mailto:${esc(SS.mail)}">${esc(SS.mail)}</a>`)}${r('Adres', SS.adr)}${r('Çalışma saatleri', SS.saat)}${SS.adr ? `<a class="ba" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SS.adr)}" target="_blank" rel="noopener">Google Haritalar'da aç</a>` : ''}${!SS.tel && !SS.mail && !SS.adr ? '<p class="mu">İletişim bilgileri yakında eklenecek.</p>' : ''}</div>${SS.adr ? `<iframe class="mp" title="Konum" loading="lazy" src="https://www.google.com/maps?q=${encodeURIComponent(SS.adr)}&output=embed"></iframe>` : ''}</div></div>`;
}

// ---------- Giriş / kurulum / hesap ----------
function giris() {
  if (me) return go('#panel');
  const kur = kurulum;
  $('#app').innerHTML = `<div class="wz"><h2>${kur ? 'İlk kurulum' : 'Danışman girişi'}</h2><p class="mu" style="margin:0 0 6px">${kur ? 'Henüz hiç kullanıcı yok. Yönetici hesabınızı oluşturun. Bu formu yalnızca bir kez görürsünüz.' : 'İlan eklemek ve yönetmek için hesabınızla giriş yapın.'}</p><form id="lgf" class="pn" style="margin-top:14px">${kur ? `<div class="fld"><span>Kurulum kodu</span><input name="kod" autocomplete="off" required></div><div class="fld"><span>Ad soyad</span><input name="ad" autocomplete="name" required></div><div class="fld"><span>Telefon</span><input name="tel" type="tel" autocomplete="tel" placeholder="05xx xxx xx xx"></div>` : ''}<div class="fld"><span>E-posta</span><input name="mail" type="email" autocomplete="${kur ? 'email' : 'username'}" required></div><div class="fld"><span>Şifre</span><input name="sifre" type="password" autocomplete="${kur ? 'new-password' : 'current-password'}" minlength="${kur ? 8 : 1}" required></div>${kur ? '<div class="fld"><span>Şifre (tekrar)</span><input name="sifre2" type="password" autocomplete="new-password" minlength="8" required></div><p class="mu">En az 8 karakter. Şifreniz sunucuda geri çözülemeyecek şekilde (özetlenerek) saklanır.</p>' : ''}<div class="err" id="lge" role="alert"></div><button class="pr" style="width:100%;padding:14px;font-size:16px;margin-top:6px">${kur ? 'Yönetici hesabını oluştur' : 'Giriş yap'}</button></form></div>`;
  $('#lgf').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)), btn = e.target.querySelector('button');
    if (kur && d.sifre !== d.sifre2) return ($('#lge').textContent = 'Şifreler aynı değil.');
    btn.disabled = true;
    try {
      await api(kur ? '/setup' : '/login', { method: 'POST', body: d });
      await boot(false);
      toast(kur ? 'Yönetici hesabı oluşturuldu' : 'Giriş yapıldı');
      go('#panel');
    } catch (err) { $('#lge').textContent = err.message; btn.disabled = false; }
  };
}

function hesap() {
  if (!me) return needLogin();
  $('#app').innerHTML = `<div class="wz"><h2>Hesabım</h2><span class="mu">${esc(me.mail)} · ${me.rol === 'admin' ? 'Yönetici' : 'Danışman'}</span><form id="pf" class="pn" style="margin-top:14px"><h3 style="margin:0">Bilgilerim</h3><p class="mu" style="margin:4px 0 0">İlanlarınızda ziyaretçilere bu ad ve telefon gösterilir.</p><div class="fld"><span>Ad soyad</span><input name="ad" value="${esc(me.ad)}" required></div><div class="fld"><span>Telefon</span><input name="tel" type="tel" value="${esc(me.tel)}"></div><button class="pr" style="margin-top:14px">Kaydet</button></form><form id="pwf" class="pn" style="margin-top:14px"><h3 style="margin:0">Şifre değiştir</h3><div class="fld"><span>Mevcut şifre</span><input name="eski" type="password" autocomplete="current-password" required></div><div class="fld"><span>Yeni şifre</span><input name="yeni" type="password" autocomplete="new-password" minlength="8" required></div><div class="fld"><span>Yeni şifre (tekrar)</span><input name="yeni2" type="password" autocomplete="new-password" minlength="8" required></div><div class="err" id="pwe" role="alert"></div><button class="pr">Şifreyi değiştir</button></form><button id="lo" class="dg" style="width:100%;margin-top:18px;padding:13px">Çıkış yap</button></div>`;
  $('#pf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/profile', { method: 'PUT', body: d }); me.ad = d.ad; me.tel = d.tel; renderNav(); toast('Bilgiler kaydedildi'); } catch (err) { toast(err.message); } };
  $('#pwf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d.yeni !== d.yeni2) return ($('#pwe').textContent = 'Yeni şifreler aynı değil.'); try { await api('/password', { method: 'POST', body: d }); e.target.reset(); $('#pwe').textContent = ''; toast('Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.'); } catch (err) { $('#pwe').textContent = err.message; } };
  $('#lo').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch {} me = null; MY = USERS = null; W = null; renderNav(); toast('Çıkış yapıldı'); go('#ana'); };
}

// ---------- İlanlarım ----------
const gd = () => { try { return JSON.parse(localStorage.getItem('asya-draft') || 'null'); } catch { return null; } };
const draft = () => { try { localStorage.setItem('asya-draft', JSON.stringify({ W, ws })); } catch {} };
const nod = () => { try { localStorage.removeItem('asya-draft'); } catch {} };
const blank = () => ({ t: '', tip: 'Satılık', tur: 'Daire', p: [], f: '', m2: '', il: '', ilce: '', mah: '', adr: '', lat: null, lon: null, oda: '2+1', kat: 1, yas: 0, as: 1, oz: [], d: '' });

async function panel() {
  if (!me) return needLogin();
  if (W) return wiz();
  if (!MY) { loading(); try { MY = await api('/my-listings'); } catch (e) { return errBox(e.message); } if (cur !== 'panel') return; }
  const m = me.rol === 'admin' ? MY.filter((l) => l.u === me.id) : MY, dr = gd();
  $('#app').innerHTML = `<div class="wz"><h2>İlanlarım</h2><span class="mu">${m.length} ilan · ${m.filter((l) => l.on).length} yayında</span>${!fotoOk ? '<div class="pn dbn" style="border-color:#ff8b8b"><span>Fotoğraf depolama henüz etkin değil; şimdilik yeni ilan eklenemez.</span></div>' : ''}${dr && dr.W ? `<div class="pn dbn"><span>Yarım kalan ilan: <b>${esc(dr.W.t || 'Başlıksız')}</b></span><span><button id="dg" class="pr">Devam et</button> <button id="dx" class="dg">Sil</button></span></div>` : ''}<div class="ml">${m.map((l) => `<div class="mi">${ph(l.p[0])}<div class="in"><div><b>${esc(l.t)}</b></div><div class="pc" style="font-size:15px">${fiyat(l)}</div><div class="mu">${yer(l)} · ${l.on ? 'Yayında' : 'Gizli'}</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button data-e="${l.id}">Düzenle</button><button data-g="${l.id}">Gör</button><button data-v="${l.id}">${l.on ? 'Gizle' : 'Yayınla'}</button><button class="dg" data-d="${l.id}">Sil</button></div></div></div>`).join('') || '<div class="pn mu">Henüz ilanınız yok. Sağ alttaki butonla ilk ilanınızı ekleyin.</div>'}</div></div><button class="pr fab" id="nw">+ Yeni ilan</button>`;
  $('#nw').onclick = () => { W = blank(); ws = 0; wiz(); };
  if ($('#dg')) $('#dg').onclick = () => { W = dr.W; ws = dr.ws || 0; wiz(); };
  if ($('#dx')) $('#dx').onclick = () => { nod(); panel(); };
  bindListingActions(panel);
}

function bindListingActions(again) {
  document.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { const l = MY.find((x) => x.id == b.dataset.e); W = { ...blank(), ...JSON.parse(JSON.stringify(l)), _edit: l.id }; ws = 0; go('#panel'); }));
  document.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => go('#ilan-' + b.dataset.g)));
  document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = async () => {
    const l = MY.find((x) => x.id == b.dataset.v); b.disabled = true;
    try { await api('/listings/' + l.id, { method: 'PATCH', body: { on: !l.on } }); l.on = l.on ? 0 : 1; await refreshPublic(); toast(l.on ? 'İlan yayında' : 'İlan gizlendi'); } catch (e) { toast(e.message); }
    again();
  }));
  document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Bu ilan ve fotoğrafları kalıcı olarak silinsin mi?')) return;
    b.disabled = true;
    try { await api('/listings/' + b.dataset.d, { method: 'DELETE' }); MY = MY.filter((x) => x.id != b.dataset.d); await refreshPublic(); toast('İlan silindi'); } catch (e) { toast(e.message); }
    again();
  }));
}

// ---------- İlan sihirbazı ----------
const shrink = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = () => r(null); im.src = fr.result; }; fr.onerror = () => r(null); fr.readAsDataURL(f); });
const ch = (k, a) => `<div class="chips">${a.map((v) => `<button type="button" class="chip ${W[k] == v ? 'on' : ''}" data-k="${k}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
const kv = (k, v) => (k === 'kat' ? (v < 0 ? 'Bodrum ' + -v : v == 0 ? 'Zemin' : v + '. kat') : v == 0 ? 'Yeni' : v + ' yaş');
const stp = (k, a, b) => `<div class="stp"><button type="button" data-sk="${k}" data-sd="-1" data-a="${a}" data-b="${b}" aria-label="Azalt">−</button><output id="o-${k}">${kv(k, W[k])}</output><button type="button" data-sk="${k}" data-sd="1" data-a="${a}" data-b="${b}" aria-label="Arttır">+</button></div>`;
const wsync = () => { const g = (i) => document.getElementById(i); if (g('w-t')) W.t = g('w-t').value; if (g('w-f')) W.f = +g('w-f').value.replace(/\D/g, '') || ''; if (g('w-m2')) W.m2 = +g('w-m2').value.replace(/\D/g, '') || ''; if (g('w-il')) W.il = g('w-il').value.trim(); if (g('w-ilce')) W.ilce = g('w-ilce').value.trim(); if (g('w-mah')) W.mah = g('w-mah').value.trim(); if (g('w-adr')) W.adr = g('w-adr').value.trim(); if (g('w-d')) W.d = g('w-d').value; };

function gps() {
  const st = $('#w-gs'), b = $('#w-gps');
  if (!navigator.geolocation) { st.textContent = 'Bu cihaz konum vermiyor. Adresi elle girin.'; return; }
  b.disabled = true; st.textContent = 'Konum alınıyor… Telefon izin isterse "İzin ver" deyin.';
  navigator.geolocation.getCurrentPosition(async (p) => {
    W.lat = +p.coords.latitude.toFixed(6); W.lon = +p.coords.longitude.toFixed(6); st.textContent = 'Adres bulunuyor…';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${W.lat}&lon=${W.lon}&zoom=18&addressdetails=1&accept-language=tr`);
      const a = (await r.json()).address || {};
      W.il = (a.province || a.state || a.city || '').replace(/ İli$/, '');
      W.ilce = a.town || a.county || a.city_district || a.district || a.city || '';
      W.mah = (a.suburb || a.neighbourhood || a.quarter || a.village || '').trim();
      W.adr = [a.road, a.house_number ? 'No:' + a.house_number : ''].filter(Boolean).join(' ') || W.adr;
    } catch { toast('Adres bulunamadı, harita konumu kaydedildi'); }
    draft(); wiz();
  }, (e) => { b.disabled = false; st.textContent = e.code === 1 ? 'Konum izni verilmedi. Telefon ayarlarından tarayıcıya konum izni verin ya da adresi elle girin.' : 'Konum alınamadı. Açık alanda tekrar deneyin ya da elle girin.'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

function wiz() {
  const s = ws, ar = ARSA(W.tur);
  let body = '';
  if (s === 0) body = `<h2>İlan başlığı</h2><p class="mu" style="margin:0">Kısa ve dikkat çekici olsun. Örnek: Deniz manzaralı 3+1 daire</p><div class="fld"><input id="w-t" maxlength="80" placeholder="İlan başlığı" value="${esc(W.t)}" enterkeyhint="next"><div class="mu" style="text-align:right;font-size:12px;margin-top:4px"><span id="w-c">${W.t.length}</span>/80</div></div><div class="fld"><span>İlan tipi</span>${ch('tip', ['Satılık', 'Kiralık'])}</div>`;
  if (s === 1) body = `<h2>Fotoğraflar</h2><p class="mu" style="margin:0">En fazla 15 fotoğraf. İlk fotoğraf vitrin görseli olur.</p>${fotoOk ? '' : '<p class="err">Fotoğraf depolama henüz etkin değil; ilan şu an kaydedilemez.</p>'}<div class="pb"><label>${CAM}Kamerayla çek<input type="file" accept="image/*" capture="environment" id="w-cam"></label><label>${GAL}Galeriden seç<input type="file" accept="image/*" multiple id="w-gal"></label></div><div id="w-st" class="mu" style="margin-top:12px">${W.p.length} / 15 fotoğraf</div><div class="tgrid">${W.p.map((x, i) => `<div class="t" style="background-image:url('${esc(x)}')">${i === 0 ? '<b>Vitrin</b>' : ''}<button type="button" class="x" data-rm="${i}" aria-label="Fotoğrafı kaldır">✕</button>${i ? `<button type="button" class="cv" data-cv="${i}">Vitrin yap</button>` : ''}</div>`).join('')}</div>`;
  if (s === 2) body = `<h2>İlan bilgileri</h2><div class="fld"><span>Emlak türü</span>${ch('tur', TUR)}</div><div class="fld"><span>Fiyat (₺)${W.tip === 'Kiralık' ? ' / aylık' : ''}</span><input id="w-f" inputmode="numeric" placeholder="Örn. 2.500.000" value="${W.f ? Number(W.f).toLocaleString('tr-TR') : ''}"></div><div class="fld"><span>${ar ? 'Arsa alanı' : 'Brüt alan'} (m²)</span><input id="w-m2" inputmode="numeric" placeholder="Örn. 120" value="${W.m2}"></div><div class="fld"><span>Konum</span><button type="button" class="pr gps" id="w-gps">${PIN}Mevcut konumumu kullan</button><div class="mu" id="w-gs" style="margin:8px 0">${W.lat ? 'Konum alındı. Gerekirse aşağıdan düzeltebilirsiniz.' : 'Mülkün yanındaysanız tek dokunuşla adres doldurulur.'}</div><div class="rg"><input id="w-il" placeholder="İl" list="w-ils" value="${esc(W.il)}"><input id="w-ilce" placeholder="İlçe" value="${esc(W.ilce)}"></div><input id="w-mah" placeholder="Mahalle" value="${esc(W.mah)}" style="margin-top:8px"><div class="prv"><span>Açık adres</span><b>Sadece siz görürsünüz</b></div><textarea id="w-adr" rows="2" placeholder="Sokak, bina no, daire (ziyaretçilere gösterilmez)">${esc(W.adr)}</textarea>${W.lat ? `<iframe class="wmap" title="Seçilen konum" loading="lazy" src="${mapEmbed(W.lat, W.lon)}"></iframe>` : ''}<datalist id="w-ils">${[...new Set(['Antalya', 'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Muğla', 'Mersin', 'Aydın', ...L.map((l) => l.il)])].map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>` + (ar ? '' : `<div class="fld"><span>Oda sayısı</span>${ch('oda', ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1'])}</div><div class="fld"><span>Bulunduğu kat</span>${stp('kat', -2, 60)}</div><div class="fld"><span>Bina yaşı</span>${stp('yas', 0, 100)}</div><div class="fld"><span>Asansör</span><div class="chips"><button type="button" class="chip ${W.as ? 'on' : ''}" data-as="1">Var</button><button type="button" class="chip ${W.as ? '' : 'on'}" data-as="0">Yok</button></div></div><div class="fld"><span>Özellikler</span><div class="chips">${OZ.map((o) => `<button type="button" class="chip ${W.oz.includes(o) ? 'on' : ''}" data-oz="${o}">${o}</button>`).join('')}</div></div>`);
  if (s === 3) body = `<h2>Açıklama</h2><p class="mu" style="margin:0">Evin öne çıkan yönlerini, çevresini ve ulaşımı anlatın.</p><div class="fld"><textarea id="w-d" rows="8" maxlength="3000" placeholder="Örn. Güney cephe, yeni tadilatlı, okula 5 dakika yürüme mesafesinde...">${esc(W.d)}</textarea></div><div class="pn" style="margin-top:18px"><h3 style="margin:0 0 12px">Özet</h3><dl class="sum"><dt>Başlık</dt><dd>${esc(W.t)}</dd><dt>Tip</dt><dd>${esc(W.tip)} · ${esc(W.tur)}</dd><dt>Fiyat</dt><dd>${W.f ? TL(W.f) : '-'}</dd><dt>Alan</dt><dd>${W.m2 || '-'} m²</dd><dt>Konum</dt><dd>${yer(W)}</dd>${W.adr ? `<dt>Açık adres</dt><dd>${esc(W.adr)} <span class="mu">(sadece siz)</span></dd>` : ''}${ar ? '' : `<dt>Oda</dt><dd>${esc(W.oda)}</dd><dt>Kat</dt><dd>${kv('kat', W.kat)}</dd>`}<dt>Fotoğraf</dt><dd>${W.p.length} adet</dd></dl></div>`;
  $('#app').innerHTML = `<div class="wz"><div class="sh"><span>Adım ${s + 1}/4 · ${STEPS[s]}${W._edit ? ' · Düzenleme' : ''}</span><button type="button" id="w-x" style="padding:6px 12px;font-size:13px">Kapat</button></div><div class="pg"><i style="width:${(s + 1) * 25}%"></i></div>${body}<div class="err" id="w-e" role="alert"></div></div><div class="bar">${s ? '<button type="button" id="w-b">Geri</button>' : ''}<button type="button" class="pr" id="w-n">${s === 3 ? (W._edit ? 'Kaydet' : 'İlanı yayınla') : 'Devam'}</button></div>`;
  const A = $('#app'), er = (t) => { $('#w-e').textContent = t; }, re = () => { wsync(); draft(); wiz(); };
  A.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { wsync(); W[b.dataset.k] = b.dataset.v; draft(); wiz(); }));
  A.querySelectorAll('[data-as]').forEach((b) => (b.onclick = () => { wsync(); W.as = +b.dataset.as; draft(); wiz(); }));
  A.querySelectorAll('[data-oz]').forEach((b) => (b.onclick = () => { wsync(); const o = b.dataset.oz; W.oz = W.oz.includes(o) ? W.oz.filter((x) => x !== o) : [...W.oz, o]; draft(); wiz(); }));
  A.querySelectorAll('[data-sk]').forEach((b) => (b.onclick = () => { const k = b.dataset.sk; W[k] = Math.max(+b.dataset.a, Math.min(+b.dataset.b, (+W[k] || 0) + +b.dataset.sd)); $('#o-' + k).textContent = kv(k, W[k]); draft(); }));
  A.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { wsync(); W.p.splice(+b.dataset.rm, 1); re(); }));
  A.querySelectorAll('[data-cv]').forEach((b) => (b.onclick = () => { wsync(); const [x] = W.p.splice(+b.dataset.cv, 1); W.p.unshift(x); re(); }));
  if ($('#w-t')) $('#w-t').oninput = (e) => { $('#w-c').textContent = e.target.value.length; };
  if ($('#w-f')) $('#w-f').oninput = (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 12); e.target.value = v ? Number(v).toLocaleString('tr-TR') : ''; };
  const add = async (fl) => { const room = 15 - W.p.length, fs = [...fl].filter((f) => f.type.startsWith('image/')).slice(0, room); if (!room) return er('En fazla 15 fotoğraf ekleyebilirsiniz.'); if (!fs.length) return; $('#w-st').textContent = `${fs.length} fotoğraf hazırlanıyor…`; for (const f of fs) { const d = await shrink(f); if (d) W.p.push(d); } re(); };
  if ($('#w-gps')) $('#w-gps').onclick = () => { wsync(); gps(); };
  if ($('#w-cam')) $('#w-cam').onchange = (e) => add(e.target.files);
  if ($('#w-gal')) $('#w-gal').onchange = (e) => add(e.target.files);
  $('#w-x').onclick = () => { wsync(); if (!W._edit) { draft(); toast('Taslak kaydedildi'); } W = null; panel(); };
  if ($('#w-b')) $('#w-b').onclick = () => { wsync(); ws--; draft(); wiz(); scrollTo(0, 0); };
  $('#w-n').onclick = async () => {
    wsync();
    if (s === 0 && W.t.trim().length < 5) return er('Başlık en az 5 karakter olmalı.');
    if (s === 1 && !W.p.length) return er('En az bir fotoğraf ekleyin.');
    if (s === 2) { if (!W.f) return er('Fiyatı girin.'); if (!W.m2) return er('Alanı (m²) girin.'); if (!W.il || !W.ilce) return er('İl ve ilçeyi girin ya da Mevcut konumumu kullan butonuna dokunun.'); }
    if (s < 3) { ws++; draft(); wiz(); scrollTo(0, 0); return; }
    await kaydet($('#w-n'), er);
  };
}

async function kaydet(btn, er) {
  if (!fotoOk && W.p.some((x) => x.startsWith('data:'))) return er('Fotoğraf depolama henüz etkin değil; ilan kaydedilemiyor.');
  btn.disabled = true;
  try {
    const yeni = W.p.filter((x) => x.startsWith('data:')).length;
    let i = 0;
    for (let k = 0; k < W.p.length; k++) {
      if (!W.p[k].startsWith('data:')) continue;
      btn.textContent = `Fotoğraf yükleniyor ${++i}/${yeni}…`;
      const blob = await (await fetch(W.p[k])).blob();
      const r = await api('/photos', { method: 'POST', raw: blob, type: 'image/jpeg' });
      W.p[k] = r.url; draft();
    }
    btn.textContent = 'Kaydediliyor…';
    const l = W._edit
      ? await api('/listings/' + W._edit, { method: 'PUT', body: W })
      : await api('/listings', { method: 'POST', body: W });
    const nw = !W._edit;
    nod(); W = null; MY = null;
    await refreshPublic();
    toast(nw ? 'İlan yayınlandı' : 'Kaydedildi');
    go('#ilan-' + l.id);
  } catch (e) {
    btn.disabled = false; btn.textContent = W && W._edit ? 'Kaydet' : 'İlanı yayınla';
    if (e.status === 401) { toast('Oturumunuz kapanmış. Tekrar giriş yapın; taslağınız saklandı.'); me = null; renderNav(); W = null; return go('#giris'); }
    er(e.message);
  }
}

// ---------- Yönetim ----------
async function admin() {
  if (!me) return needLogin();
  if (me.rol !== 'admin') return errBox('Bu sayfa yalnızca yöneticiler içindir.');
  if (!MY || !USERS) {
    loading();
    try { [MY, USERS] = await Promise.all([api('/my-listings'), api('/users')]); } catch (e) { return errBox(e.message); }
    if (cur !== 'yonetim') return;
  }
  const ul = `<table><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>İlan</th><th>İşlemler</th></tr>${USERS.map((u) => `<tr><td>${esc(u.ad)}<div class="mu">${esc(u.tel)}</div></td><td>${esc(u.mail)}</td><td>${u.rol === 'admin' ? 'Yönetici' : 'Danışman'}</td><td>${u.ilan}</td><td style="white-space:nowrap">${u.id === me.id ? '<span class="mu">Siz</span>' : `<button data-ua="${u.id}">${u.aktif ? 'Devre dışı bırak' : 'Etkinleştir'}</button> <button data-ur="${u.id}">${u.rol === 'admin' ? 'Danışman yap' : 'Yönetici yap'}</button> <button data-up="${u.id}">Şifre sıfırla</button>`}${u.aktif ? '' : ' <span class="tg" style="border-color:#ff8b8b;color:#ff8b8b">Pasif</span>'}</td></tr>`).join('')}</table><form id="uf" class="pn" style="margin-top:16px"><h3 style="margin:0">Yeni kullanıcı ekle</h3><p class="mu" style="margin:4px 0 0">Belirlediğiniz ilk şifreyi kişiye iletin; giriş yaptıktan sonra Hesabım sayfasından değiştirebilir.</p><div class="fm"><input name="ad" placeholder="Ad soyad" required><input name="mail" type="email" placeholder="E-posta" required><input name="tel" type="tel" placeholder="Telefon"><select name="rol"><option value="danisman">Danışman</option><option value="admin">Yönetici</option></select><input name="sifre" type="password" autocomplete="new-password" minlength="8" placeholder="İlk şifre (en az 8 karakter)" required><button class="pr">Kullanıcı ekle</button></div><div class="err" id="ue" role="alert"></div></form>`;
  const il = `<table><tr><th>İlan</th><th>Sahip</th><th>Fiyat</th><th>Durum</th><th></th></tr>${MY.map((l) => `<tr><td><a href="#ilan-${l.id}">${esc(l.t)}</a><div class="mu">${yer(l)}</div></td><td>${esc(l.sahip.ad)}</td><td>${fiyat(l)}</td><td>${l.on ? 'Yayında' : 'Gizli'}</td><td style="white-space:nowrap"><button data-e="${l.id}">Düzenle</button> <button data-v="${l.id}">${l.on ? 'Yayından kaldır' : 'Yayınla'}</button> <button class="dg" data-d="${l.id}">Sil</button></td></tr>`).join('') || '<tr><td colspan="5" class="mu">Henüz ilan yok.</td></tr>'}</table>`;
  $('#app').innerHTML = `<div class="w"><h2>Yönetim</h2><div class="tb"><button class="${tab === 'il' ? 'on' : ''}" data-t="il">İlanlar (${MY.length})</button><button class="${tab === 'us' ? 'on' : ''}" data-t="us">Kullanıcılar (${USERS.length})</button></div><div class="pn tw">${tab === 'il' ? il : ul}</div></div>`;
  document.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; admin(); }));
  bindListingActions(admin);
  const patch = async (id, body, msg) => { try { await api('/users/' + id, { method: 'PATCH', body }); USERS = await api('/users'); await refreshPublic(); toast(msg); } catch (e) { toast(e.message); } admin(); };
  document.querySelectorAll('[data-ua]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.ua); patch(u.id, { aktif: !u.aktif }, u.aktif ? 'Kullanıcı devre dışı; ilanları gizlendi' : 'Kullanıcı etkinleştirildi'); }));
  document.querySelectorAll('[data-ur]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.ur); if (confirm(`${u.ad} ${u.rol === 'admin' ? 'danışman' : 'yönetici'} yapılsın mı?`)) patch(u.id, { rol: u.rol === 'admin' ? 'danisman' : 'admin' }, 'Rol değiştirildi'); }));
  document.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.up); const p = prompt(`${u.ad} için yeni şifre (en az 8 karakter). Kişinin açık oturumları kapatılır.`); if (p) patch(u.id, { sifre: p }, 'Şifre sıfırlandı'); }));
  if ($('#uf')) $('#uf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/users', { method: 'POST', body: d }); USERS = await api('/users'); toast('Kullanıcı eklendi'); admin(); } catch (err) { $('#ue').textContent = err.message; } };
}

function settings() {
  if (!me) return needLogin();
  if (me.rol !== 'admin') return errBox('Bu sayfa yalnızca yöneticiler içindir.');
  const f = (k, l) => `<label>${l}<input name="${k}" value="${esc(SS[k])}"></label>`;
  $('#app').innerHTML = `<div class="w"><h2>Site ayarları</h2><div class="pn"><form id="sf2"><div class="fm">${f('hero', 'Ana sayfa başlığı')}${f('sub', 'Ana sayfa alt metni')}${f('tel', 'Telefon')}${f('mail', 'E-posta')}${f('adr', 'Adres (haritada gösterilir)')}${f('saat', 'Çalışma saatleri')}</div><label class="mu" style="display:grid;gap:4px;margin-top:12px">Hakkımızda metni (paragraflar arasında boş satır bırakın)<textarea name="hak" style="min-height:160px">${esc(SS.hak)}</textarea></label><p><button class="pr">Kaydet</button></p></form></div></div>`;
  $('#sf2').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/settings', { method: 'PUT', body: d }); SS = { ...SS, ...d }; toast('Ayarlar kaydedildi'); } catch (err) { toast(err.message); } };
}

// ---------- Yönlendirme ----------
let cur = location.hash.slice(1) || 'ana';
function go(h) { cur = String(h).replace(/^#/, '') || 'ana'; try { history.replaceState(null, '', '#' + cur); } catch {} route(); }
function route() {
  const h = cur;
  renderNav();
  document.querySelectorAll('nav a.l').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + h));
  if (h.startsWith('ilan-')) detail(h.slice(5));
  else if (h === 'panel') panel();
  else if (h === 'yonetim') admin();
  else if (h === 'ayarlar') settings();
  else if (h === 'ilanlar') ilanlar();
  else if (h === 'hakkimizda') about();
  else if (h === 'iletisim') contact();
  else if (h === 'giris') giris();
  else if (h === 'hesap') hesap();
  else home();
  scrollTo(0, 0);
}
document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault(); go(a.getAttribute('href')); });
addEventListener('hashchange', () => { const h = location.hash.slice(1) || 'ana'; if (h !== cur) { cur = h; route(); } });

async function boot(render = true) {
  const [m, s, l] = await Promise.all([api('/me'), api('/settings'), api('/listings')]);
  me = m.user; kurulum = m.kurulum; fotoOk = m.foto; SS = s; L = l.ilanlar; DAN = l.danisman; MY = USERS = null;
  if (render) route(); else renderNav();
}
loading();
boot().catch((e) => errBox(e.message));
