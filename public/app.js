'use strict';
// Asya Emlak ön yüzü — veriler sunucudaki API'den gelir (/api/*)

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>';
const SHR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const GAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';

const VID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>';
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const TUR = ['Daire', 'Müstakil', 'Villa', 'Dubleks', 'Dükkan', 'Ofis', 'Depo', 'Tarla', 'Parsel'];
const ISY = (t) => t === 'Dükkan' || t === 'Ofis' || t === 'Depo';
const OZ_IS = ['Otopark', 'Güvenlik', 'Cadde üzeri', 'Köşe başı', 'Vitrinli', 'Yüksek tavan', 'Kamyon girişi'];
const OZ = ['Balkon', 'Otopark', 'Eşyalı', 'Güvenlik', 'Havuz'];
const STEPS = ['Başlık', 'Fotoğraf ve video', 'Bilgiler', 'Başlık ve açıklama'];
const ARSA = (t) => t === 'Tarla' || t === 'Parsel';

// ---------- Durum ----------
let me = null, kurulum = false, fotoOk = false;
let L = [], MY = null, USERS = null;
let SS = { hero: '', sub: '', tel: '', mail: '', adr: '', saat: '', hak: '', bolge: '', foto: '', harita: '', harita_e: '' };
let tab = 'il', W = null, ws = 0;
let F = { tip: '', q: '', pmin: '', pmax: '', amin: '', amax: '', oda: [], kat: '', as: '', s: '', tur: '', yas: '', oz: [], il: '', du: 'acik' };
const role = () => (!me ? 'v' : me.rol === 'admin' ? 'm' : 'a');
const canAll = () => !!me && (me.rol === 'admin' || !!me.tumIlan);
const own = (l) => !!me && (canAll() || l.u === me.id);
const NO_OFFSET = 100000;
const setTitle = (t) => { document.title = t ? `${t} | Asya Emlak` : 'Asya Emlak | Emlak Danışmanlığı'; };
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
const mapEmbed = (a, o) => `https://www.openstreetmap.org/export/embed.html?bbox=${o - 0.004},${a - 0.003},${+o + 0.004},${+a + 0.003}&layer=mapnik&marker=${a},${o}`;
const mapLink = (l) => l.lat
  ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.adr, l.mah, l.ilce, l.il].filter(Boolean).join(', '))}`;
const loading = (t = 'Yükleniyor…') => { $('#app').innerHTML = `<div class="w"><p class="mu">${t}</p></div>`; };
const errBox = (m) => { $('#app').innerHTML = `<div class="w"><div class="pn"><p>${esc(m)}</p><a class="tg" href="/">Ana sayfaya dön</a></div></div>`; };
const needLogin = () => { go('/giris', true); };

async function shareIt(title, text, url) {
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı'); }
  catch { window.open('https://wa.me/?text=' + encodeURIComponent(title + '\n' + url), '_blank'); }
}

async function refreshPublic() {
  if (!me) { L = []; return; }
  L = (await api('/listings')).ilanlar;
}

// ---------- Menü ----------
function renderNav() {
  const r = role();
  document.body.classList.toggle('ekip', r !== 'v');
  $('#pf2').hidden = $('#pl').hidden = r === 'v';
  $('#al').hidden = $('#sl').hidden = r !== 'm';
  $('#gl').hidden = $('#tl').hidden = r !== 'v';
  $('#hl').hidden = r === 'v';
  if (me) $('#hl').textContent = me.ad.split(' ')[0] || 'Hesabım';
  $('#pl').textContent = canAll() ? 'İlan yönetimi' : 'İlanlarım';
  $('#nav').classList.remove('open'); $('#mb').setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
}

// ---------- Durumlar ----------
const DUR = { aktif: 'Aktif', opsiyon: 'Opsiyonlu', satildi: 'Satıldı', kiralandi: 'Kiralandı', pasif: 'Pasif' };
const durTag = (l) => `<span class="dur d-${esc(l.durum)}">${DUR[l.durum] || 'Aktif'}</span>`;
const acik = (l) => l.durum === 'aktif' || l.durum === 'opsiyon';
const gunKaldi = (d) => (d ? Math.ceil((new Date(d + 'T23:59:59') - Date.now()) / 86400000) : null);
const ybTag = (l) => { const g = gunKaldi(l.yb); if (g === null || !acik(l)) return ''; return g < 0 ? '<span class="dur d-uyari">Yetki süresi doldu</span>' : g <= 15 ? `<span class="dur d-uyari">Yetki ${g} gün</span>` : ''; };

// ---------- Kartlar ----------
function card(l) {
  return `<div class="cdw"><a class="cd" href="${esc(l.url)}"><div class="cimg">${ph(l.p[0])}<span class="ctg">${esc(l.tip)}</span>${l.v ? '<span class="ctv">▶ Video</span>' : ''}${l.durum !== 'aktif' ? `<span class="cdu">${durTag(l)}</span>` : ''}</div><div class="b"><div class="pc">${fiyat(l)}</div><div class="ct">${esc(l.t)}</div><div class="mu">${yer(l)}</div><div class="sp2"><span>${l.m2} m²</span>${ARSA(l.tur) ? `<span>${esc(l.tur)}</span>` : ISY(l.tur) ? `<span>${esc(l.tur)}</span><span>${kt(l)}</span>` : `<span>${esc(l.oda)}</span><span>${kt(l)}</span>`}<span>No ${l.no}</span></div><div class="mu cown">${esc(l.sahip.ad)}</div></div></a></div>`;
}

const R = () => { F = { tip: '', q: '', pmin: '', pmax: '', amin: '', amax: '', oda: [], kat: '', as: '', s: F.s, tur: '', yas: '', oz: [], il: '', du: 'acik' }; };
// ---------- Ana sayfa (talep odaklı, sade) ----------
const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const AMAC = [
  ['al', 'Satın almak', 'Ev, işyeri ya da arsa arıyorum', '<path d="M4 15L16 5l12 10"/><path d="M7 12.5V27h18V12.5"/><path d="M13 27v-7h6v7"/>'],
  ['kirala', 'Kiralamak', 'Kiralık ev ya da işyeri arıyorum', '<circle cx="11" cy="16" r="5"/><path d="M16 16h12M24 16v5M28 16v4"/>'],
  ['sat', 'Satmak', 'Mülkümü satmak istiyorum', '<path d="M5 9h14l8 8-10 10-12-12z"/><circle cx="11" cy="14" r="2"/>'],
  ['kiraver', 'Kiraya vermek', 'Evimi ya da işyerimi kiraya vereceğim', '<rect x="5" y="9" width="22" height="16" rx="3"/><path d="M11 9V6h10v3M5 16h22"/>'],
];
const svgI = (p, c = '') => `<svg class="${c}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const waOfis = () => waNo(SS.tel);
function home() {
  setTitle('');
  const tel = (SS.tel || '').trim(), wa = waOfis();
  const bolge = String(SS.bolge || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const hak = String(SS.hak || '').split(/\n\s*\n/)[0];
  const quick = `<div class="qk"><div class="qkh"><b>Ne yapmak istiyorsunuz?</b><span>Birini seçin, 1 dakikada talebinizi oluşturun.</span></div><div class="qkg">${AMAC.map(([k, t, d, ic]) => `<a class="qki" href="/talep?amac=${k}">${svgI(ic)}<span><b>${t}</b><small>${d}</small></span></a>`).join('')}</div></div>`;
  $('#app').innerHTML = `${me ? `<div class="ekb"><span>Ekip görünümü: ziyaretçiler bu sayfayı görür.</span><a href="/ilanlar">Portföye git ${ARR}</a></div>` : ''}
  <section class="h2o ${SS.foto ? 'ft' : ''}"><div class="h2t"><span class="eyb">Asya Emlak · Antalya</span><h1>${esc(SS.hero || 'Aradığınız evi anlatın, biz bulalım.')}</h1><p>${esc(SS.sub)}</p><div class="pls"><a class="pill pr" href="/talep">Talep oluşturun ${ARR}</a>${wa ? `<a class="pill" href="https://wa.me/90${esc(wa)}?text=${encodeURIComponent('Merhaba, bilgi almak istiyorum.')}" target="_blank" rel="noopener">${WAI} WhatsApp</a>` : tel ? `<a class="pill" href="tel:${esc(tel)}">${PHONE} Arayın</a>` : ''}</div></div>
   <div class="h2r">${SS.foto ? `<div class="h2f" style="background-image:url('${esc(SS.foto)}')" role="img" aria-label="Asya Emlak"></div>` : ''}${quick}</div></section>
  <section class="s2"><div class="s2h"><span class="eyb">Nasıl çalışıyoruz</span><h2>İlan aramakla uğraşmayın.<br>Ne istediğinizi söyleyin.</h2></div>
   <div class="stp3">${[['Talebinizi oluşturun', 'Nasıl bir ev, hangi bölge, ne kadar bütçe? Birkaç dokunuşla anlatın.'], ['WhatsApp\'tan bize ulaşsın', 'Talebiniz hazır bir mesaj olarak doğrudan WhatsApp\'ımıza gelir.'], ['Size uygun olanları sunalım', 'Danışmanımız arar, size uyan seçenekleri fotoğraf ve videolarıyla iletir.']].map(([t, d], i) => `<div><b>0${i + 1}</b><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>
  <section class="s2"><div class="s2h"><span class="eyb">Neler yapıyoruz</span><h2>Alırken de satarken de yanınızdayız.</h2></div>
   <div class="srv">${SVC.map(([t, d, ic]) => `<div>${svgI(ic)}<h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>
  ${bolge.length ? `<section class="s2"><div class="s2h"><span class="eyb">Bölgeler</span><h2>Hizmet verdiğimiz yerler</h2></div><div class="bol">${bolge.map((b) => `<span>${PIN}${esc(b)}</span>`).join('')}</div></section>` : ''}
  ${hak ? `<section class="s2"><div class="hk"><span class="eyb">Hakkımızda</span><p>${esc(hak)}</p><a class="lnk" href="/hakkimizda">Bizi tanıyın ${ARR}</a></div></section>` : ''}
  <section class="cta2"><div><h2>Hayalinizdeki evi birlikte bulalım.</h2><p>Talebinizi bırakın, sizi arayalım. Hiçbir ücret ya da yükümlülük yok.</p></div><a class="pill pr" href="/talep">Talep oluşturun ${ARR}</a></section>`;
}
const SVC = [
  ['Konut', 'Daire, villa ve müstakil evlerde doğru fiyatı belirler, alıcı ve kiracıyla buluşturur, tapuya kadar süreci yönetiriz.', '<path d="M4 15L16 5l12 10"/><path d="M7 12.5V27h18V12.5"/><path d="M13 27v-7h6v7"/>'],
  ['İşyeri', 'Dükkan, ofis ve depo alım-satım ve kiralamada konum, cadde ve ciro potansiyeline göre danışmanlık veririz.', '<path d="M4 12l2-6h20l2 6"/><path d="M4 12h24v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M6 17v10h20V17M13 27v-6h6v6"/>'],
  ['Arsa ve tarla', 'İmar durumu ve bölge değerine göre yatırım odaklı danışmanlık veririz.', '<path d="M3 23l8-7 6 5 5-4 7 6"/><path d="M3 27h26"/><path d="M22 5v8M22 5l5 2-5 2"/>'],
  ['Değerleme ve yetki', 'Piyasa verisiyle fiyat analizi yapar, e-Devlet yetkilendirmesinde yol gösteririz.', '<path d="M16 3l11 5v7c0 7-5 12-11 14C10 27 5 22 5 15V8z"/><path d="M11 16l4 4 7-8"/>'],
];

// ---------- Talep oluşturma: her amaç için özel sayfa (WhatsApp'a iletilir, sitede saklanmaz) ----------
const KAT = {
  konut: ['Konut', 'Daire, villa, müstakil ev', '<path d="M4 15L16 5l12 10"/><path d="M7 12.5V27h18V12.5"/><path d="M13 27v-7h6v7"/>'],
  isyeri: ['İşyeri', 'Dükkan, ofis, depo', '<path d="M4 12l2-6h20l2 6"/><path d="M4 12h24v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M6 17v10h20V17M13 27v-6h6v6"/>'],
  arsa: ['Arsa / tarla', 'İmarlı arsa, tarla, bahçe', '<path d="M3 23l8-7 6 5 5-4 7 6"/><path d="M3 27h26"/><path d="M22 5v8M22 5l5 2-5 2"/>'],
};
const KTUR = { konut: ['Daire', 'Müstakil ev', 'Villa', 'Dubleks', 'Rezidans'], isyeri: ['Dükkan / mağaza', 'Ofis / büro', 'Depo', 'Plaza katı', 'Komple bina'], arsa: ['İmarlı arsa', 'Tarla', 'Bağ / bahçe', 'Zeytinlik'] };
const KOZ = {
  konut: ['Asansör', 'Otopark', 'Site içinde', 'Balkon', 'Bahçe', 'Havuz', 'Güvenlik', 'Manzara', 'Okula yakın', 'Ulaşıma yakın'],
  isyeri: ['Cadde üzeri', 'Köşe başı', 'Vitrinli', 'Otopark', 'Asansör', 'Yüksek tavan', 'Kamyon girişi', 'Güvenlik'],
  arsa: ['İmarlı', 'Yola cepheli', 'Elektrik var', 'Su var', 'Yerleşime yakın', 'Manzaralı'],
};
const T_ODA = ['1+0', '1+1', '2+1', '3+1', '4+1 ve üzeri'];
const AM = {
  al: { ad: 'Satın alma talebi', ic: AMAC[0][3], intro: 'Aradığınız mülkü anlatın; portföyümüzden ve bölgedeki fırsatlardan size uyanları seçip iletelim.', kats: ['konut', 'isyeri', 'arsa'], ara: 1,
    t: ['Nasıl bir mülk arıyorsunuz?', 'Nerede ve hangi bütçeyle?', 'Sizin için önemli olanlar'] },
  kirala: { ad: 'Kiralama talebi', ic: AMAC[1][3], intro: 'Kiralık ev ya da işyeri arayışınızı anlatın; uygun seçenekleri fotoğraflarıyla size gönderelim.', kats: ['konut', 'isyeri'], ara: 1,
    t: ['Nasıl bir yer kiralamak istiyorsunuz?', 'Nerede ve aylık ne kadar?', 'Birkaç detay daha'] },
  sat: { ad: 'Satış talebi', ic: AMAC[2][3], intro: 'Mülkünüzü tanıyalım; doğru fiyatı birlikte belirleyip ciddi alıcılarla buluşturalım. Değerleme ücretsizdir.', kats: ['konut', 'isyeri', 'arsa'], ara: 0,
    t: ['Satmak istediğiniz mülk', 'Konum, fiyat ve tapu', 'Son detaylar'] },
  kiraver: { ad: 'Kiraya verme talebi', ic: AMAC[3][3], intro: 'Mülkünüzü güvenilir kiracılarla buluşturalım; ön görüşme, sözleşme ve teslimde yanınızdayız.', kats: ['konut', 'isyeri'], ara: 0,
    t: ['Kiraya vereceğiniz mülk', 'Konum ve kira beklentisi', 'Kiracı tercihleriniz'] },
};
// Alan tanımları: ch = seçenek, tx = yazı; m = çoklu seçim, req = zorunlu
function tAdimlar() {
  const a = TQ.amac, k = TQ.kat, ara = AM[a].ara, ev = k === 'konut', ar = k === 'arsa';
  const kat = { t: 'kat', k: 'kat', lbl: ara ? 'Ne arıyorsunuz?' : 'Mülkünüz ne?', ml: 'Kategori', req: 1 };
  const tur = k && { t: 'ch', k: 'tur', lbl: ara ? 'Türü (birden fazla seçebilirsiniz)' : 'Türü', ml: 'Tür', o: KTUR[k], m: ara, req: 1 };
  const oda = ev && { t: 'ch', k: 'oda', lbl: 'Oda sayısı', ml: 'Oda', o: T_ODA, m: ara };
  const m2 = k && { t: 'tx', k: 'm2', lbl: ara ? 'En az kaç m²? (isteğe bağlı)' : 'Yaklaşık kaç m²? (isteğe bağlı)', ml: 'Alan', ph: ar ? 'Örn. 1.000' : 'Örn. 120', num: 1, pre: ara ? 'en az ' : '', suf: ' m²' };
  const yas = k && !ar && { t: 'ch', k: 'yas', lbl: 'Bina yaşı', ml: 'Bina yaşı', o: ara ? ['Yeni / 0 – 5 yıl', '15 yıla kadar', 'Fark etmez'] : ['0 – 5 yıl', '6 – 15 yıl', '16 yıl ve üzeri', 'Bilmiyorum'] };
  const bolge = { t: 'tx', k: 'bolge', lbl: ara ? 'Tercih ettiğiniz bölgeler' : 'Mülk nerede?', ml: ara ? 'Bölge' : 'Konum', ph: ara ? 'Örn. Konyaaltı, Lara, Kepez Varsak' : 'Örn. Kepez, Kültür Mahallesi', req: 1 };
  const zaman = (lbl, o) => ({ t: 'ch', k: 'zaman', lbl, ml: 'Zaman', o });
  const oz = k && { t: 'ch', k: 'oz', lbl: ara ? 'Olmazsa olmazlar' : 'Öne çıkan özellikler', ml: ara ? 'Olmazsa olmaz' : 'Özellikler', o: KOZ[k], m: 1 };
  const not = { t: 'tx', k: 'not', lbl: 'Eklemek istedikleriniz', ml: 'Not', area: 1, ph: '' };
  const ad = { t: 'tx', k: 'ad', lbl: 'Adınız', ml: 'Adım', ph: 'Size nasıl hitap edelim?' };
  if (a === 'al') return [
    [kat, tur, oda, m2, yas],
    [bolge, { t: 'ch', k: 'butce', lbl: 'Bütçe', ml: 'Bütçe', o: ar ? ['1 milyon ₺ altı', '1 – 3 milyon ₺', '3 – 6 milyon ₺', '6 milyon ₺ üzeri'] : ['2 milyon ₺ altı', '2 – 4 milyon ₺', '4 – 7 milyon ₺', '7 – 12 milyon ₺', '12 milyon ₺ üzeri'], ozel: 'ya da tutarı yazın' },
      { t: 'ch', k: 'odeme', lbl: 'Ödeme şekli', ml: 'Ödeme', o: ['Peşin', 'Kredi kullanacağım', 'Takas düşünüyorum'], m: 1 }, zaman('Ne zaman almayı düşünüyorsunuz?', ['Hemen', '1 – 3 ay içinde', 'Acelem yok'])],
    [oz, ar ? null : { t: 'ch', k: 'amac2', lbl: 'Ne için alıyorsunuz?', ml: 'Amaç', o: ev ? ['Oturmak için', 'Yatırım için'] : ['Kendi işim için', 'Yatırım / kiraya vermek için'] }, { ...not, ph: ev ? 'Örn. Ara kat olsun, çocuklarımızın okuluna yakın olsun.' : 'Örn. Ana cadde üzerinde, en az 3 m cephe.' }, ad],
  ];
  if (a === 'kirala') return [
    [kat, tur, oda, m2],
    [bolge, { t: 'ch', k: 'butce', lbl: 'Aylık bütçe', ml: 'Aylık bütçe', o: ev ? ['15.000 ₺ altı', '15 – 25 bin ₺', '25 – 40 bin ₺', '40 bin ₺ üzeri'] : ['25.000 ₺ altı', '25 – 50 bin ₺', '50 – 100 bin ₺', '100 bin ₺ üzeri'], ozel: 'ya da tutarı yazın' },
      zaman('Ne zaman taşınmak istiyorsunuz?', ['Hemen', '1 ay içinde', '1 – 3 ay içinde'])],
    ev ? [{ t: 'ch', k: 'esya', lbl: 'Eşya durumu', ml: 'Eşya', o: ['Eşyalı', 'Eşyasız', 'Fark etmez'] }, { t: 'ch', k: 'kimler', lbl: 'Kimler oturacak?', ml: 'Oturacaklar', o: ['Aile', 'Bekâr / çift', 'Öğrenci', 'Emekli'] }, { t: 'ch', k: 'evcil', lbl: 'Evcil hayvanınız var mı?', ml: 'Evcil hayvan', o: ['Var', 'Yok'] }, oz, { ...not, ph: 'Örn. Doğalgazlı olsun, iş yerime yakın olsun.' }, ad]
      : [{ t: 'tx', k: 'faaliyet', lbl: 'Ne iş yapacaksınız?', ml: 'Faaliyet', ph: 'Örn. Kafe, eczane, muhasebe ofisi' }, oz, { ...not, ph: 'Örn. Kira sözleşmesi en az 3 yıllık olsun.' }, ad],
  ];
  if (a === 'sat') return [
    [kat, tur, oda, m2, yas],
    [bolge, { t: 'tx', k: 'fiyat', lbl: 'Beklediğiniz fiyat (isteğe bağlı)', ml: 'Beklenen fiyat', ph: 'Bilmiyorsanız boş bırakın, birlikte belirleyelim', num: 1, suf: ' ₺' },
      { t: 'ch', k: 'tapu', lbl: 'Tapu durumu', ml: 'Tapu', o: ar ? ['Müstakil tapu', 'Hisseli tapu', 'Bilmiyorum'] : ['Kat mülkiyeti', 'Kat irtifakı', 'Hisseli', 'Bilmiyorum'] },
      ar ? null : { t: 'ch', k: 'durum', lbl: 'Mülk şu an', ml: 'Mülk şu an', o: ['Boş', 'Kiracılı', 'Kendimiz oturuyoruz'] }],
    [oz, zaman('Ne zaman satmak istiyorsunuz?', ['Hemen', '1 – 3 ay içinde', 'Fiyat uygunsa']), { t: 'ch', k: 'kredi', lbl: 'Krediye uygun mu?', ml: 'Krediye uygun', o: ['Evet', 'Hayır', 'Bilmiyorum'] }, { ...not, ph: 'Örn. Hafta sonları gösterilebilir, ipotek yok.' }, ad],
  ];
  return [ // kiraver
    [kat, tur, oda, m2, ev ? { t: 'ch', k: 'esya', lbl: 'Eşya durumu', ml: 'Eşya', o: ['Eşyalı', 'Eşyasız', 'Yarı eşyalı'] } : null],
    [bolge, { t: 'tx', k: 'fiyat', lbl: 'Beklediğiniz aylık kira (isteğe bağlı)', ml: 'Beklenen kira', ph: 'Örn. 25.000', num: 1, suf: ' ₺ / ay' },
      { t: 'ch', k: 'zaman', lbl: 'Mülk ne zaman boş?', ml: 'Boşalma', o: ['Şu an boş', '1 ay içinde', 'Daha sonra'] }],
    [ev ? { t: 'ch', k: 'kiraci', lbl: 'Kiracı tercihiniz', ml: 'Kiracı tercihi', o: ['Aile', 'Bekâr / çift', 'Öğrenci', 'Fark etmez'], m: 1 } : { t: 'tx', k: 'faaliyet', lbl: 'Hangi işler için uygun?', ml: 'Uygun faaliyet', ph: 'Örn. Kafe, ofis, mağaza' },
      ev ? { t: 'ch', k: 'evcil', lbl: 'Evcil hayvan kabul eder misiniz?', ml: 'Evcil hayvan', o: ['Evet', 'Hayır'] } : null, oz, { ...not, ph: 'Örn. Depozito 2 kira, en az 1 yıllık sözleşme.' }, ad],
  ];
}
let TQ = null, TS = 0;
const tNew = (amac = '') => ({ amac, kat: '' });
const tVal = (f) => { const v = TQ[f.k]; return Array.isArray(v) ? v.join(', ') : v || ''; };
function talepMesaj() {
  const c = AM[TQ.amac], l = [`Merhaba Asya Emlak, sitenizden talep oluşturdum.`, '', `📌 *${c ? c.ad : 'Talep'}*`];
  let notTx = '', adTx = '';
  if (c) tAdimlar().flat().filter(Boolean).forEach((f) => {
    let v = f.t === 'kat' ? (KAT[TQ.kat] || [])[0] : tVal(f);
    if (f.k === 'butce' && TQ.butceX) v = TQ.butceX + ' ₺';
    if (!v) return;
    if (f.k === 'not') { notTx = v.trim(); return; }
    if (f.k === 'ad') { adTx = v.trim(); return; }
    if (f.num) v = (f.pre || '') + v + (f.suf || '');
    l.push(`• ${f.ml}: ${String(v).trim()}`);
  });
  if (notTx) l.push('', `📝 ${notTx}`);
  if (adTx) l.push('', `Adım: ${adTx}`);
  return l.join('\n');
}
function talep() {
  setTitle('Talep oluşturun');
  if (!TQ) { const q = new URLSearchParams(location.search).get('amac'); TQ = tNew(AM[q] ? q : ''); TS = TQ.amac ? 1 : 0; }
  const wa = waOfis(), N = 4, c = AM[TQ.amac];
  const fh = (f) => {
    if (!f) return '';
    if (f.t === 'kat') return `<div class="tf"><span>${f.lbl}</span><div class="tkt">${c.kats.map((k) => `<button type="button" class="${TQ.kat === k ? 'on' : ''}" data-kat="${k}">${svgI(KAT[k][2])}<b>${KAT[k][0]}</b><small>${KAT[k][1]}</small></button>`).join('')}</div></div>`;
    if (f.t === 'ch') { const v = TQ[f.k]; return `<div class="tf"><span>${f.lbl}</span><div class="chips tch">${f.o.map((o) => `<button type="button" class="chip ${(Array.isArray(v) ? v.includes(o) : v === o) ? 'on' : ''}" data-tk="${f.k}" data-tv="${esc(o)}" data-tm="${f.m ? 1 : 0}">${esc(o)}</button>`).join('')}</div>${f.ozel ? `<input data-tx="butceX" data-num="1" inputmode="numeric" maxlength="20" placeholder="${f.ozel}" value="${esc(TQ.butceX || '')}" style="margin-top:10px">` : ''}</div>`; }
    return `<div class="tf"><span>${f.lbl}</span>${f.area ? `<textarea data-tx="${f.k}" rows="3" maxlength="600" placeholder="${esc(f.ph)}">${esc(TQ[f.k] || '')}</textarea>` : `<input data-tx="${f.k}" ${f.num ? 'data-num="1" inputmode="numeric"' : ''} maxlength="${f.k === 'bolge' ? 200 : 60}" placeholder="${esc(f.ph)}" value="${esc(TQ[f.k] || '')}" ${f.k === 'ad' ? 'autocomplete="name"' : ''}>`}</div>`;
  };
  let body = '';
  if (TS === 0) body = `<h1 class="tq">Ne yapmak istiyorsunuz?</h1><p class="tqs">Seçiminize göre size özel sorular soracağız.</p><div class="tam">${AMAC.map(([k, t, d, ic]) => `<button type="button" class="${TQ.amac === k ? 'on' : ''}" data-am="${k}">${svgI(ic)}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>`;
  else {
    const steps = tAdimlar();
    body = `<div class="thd">${svgI(c.ic)}<div><b>${c.ad}</b><p>${c.intro}</p></div><button type="button" class="lnk" id="t-ch">Değiştir</button></div><h1 class="tq">${c.t[TS - 1]}</h1>${TS === 1 && !TQ.kat ? '<p class="tqs">Önce kategoriyi seçin.</p>' : ''}${steps[TS - 1].map(fh).join('')}`;
    if (TS === 3) body += `<div class="tpv"><span>WhatsApp mesajınız</span><pre id="t-pv">${esc(talepMesaj())}</pre></div><p class="tkv">🔒 Bilgileriniz sitemizde saklanmaz; mesaj kendi WhatsApp'ınızdan doğrudan bize iletilir.</p>`;
  }
  $('#app').innerHTML = `<div class="tw2 t-${TQ.amac || 'yok'}"><div class="tpg"><i style="width:${((TS + 1) / N) * 100}%"></i></div><div class="tst">Adım ${TS + 1} / ${N}</div>${body}<div class="err" id="t-e" role="alert"></div></div>
   <div class="tbar">${TS ? '<button type="button" class="pill" id="t-b">Geri</button>' : '<span></span>'}${TS < 3 ? `<button type="button" class="pill pr" id="t-n" ${TS === 0 && !TQ.amac ? 'disabled' : ''}>Devam ${ARR}</button>` : wa ? `<a class="pill wa" id="t-go" href="https://wa.me/90${esc(wa)}?text=${encodeURIComponent(talepMesaj())}" target="_blank" rel="noopener">${WAI} WhatsApp ile gönder</a>` : `<a class="pill pr" id="t-go" href="${SS.mail ? `mailto:${esc(SS.mail)}?subject=${encodeURIComponent('Emlak talebi')}&body=${encodeURIComponent(talepMesaj())}` : '/iletisim'}">Gönder ${ARR}</a>`}</div>`;
  const A = $('#app');
  const sync = () => A.querySelectorAll('[data-tx]').forEach((i) => { let v = i.value; if (i.dataset.num) { v = v.replace(/\D/g, ''); v = v ? Number(v).toLocaleString('tr-TR') : ''; } TQ[i.dataset.tx] = v; });
  const pv = () => { sync(); const p = $('#t-pv'); if (p) p.textContent = talepMesaj(); const go = $('#t-go'); if (go && go.href.startsWith('https://wa.me')) go.href = `https://wa.me/90${wa}?text=${encodeURIComponent(talepMesaj())}`; };
  const re = () => { const y = scrollY; talep(); scrollTo(0, y); };
  A.querySelectorAll('[data-am]').forEach((b) => (b.onclick = () => { if (TQ.amac !== b.dataset.am) { const ad = TQ.ad; TQ = tNew(b.dataset.am); TQ.ad = ad; } TS = 1; try { history.replaceState(history.state, '', '/talep?amac=' + TQ.amac); } catch {} talep(); scrollTo(0, 0); }));
  A.querySelectorAll('[data-kat]').forEach((b) => (b.onclick = () => { sync(); if (TQ.kat !== b.dataset.kat) { const keep = { amac: TQ.amac, kat: b.dataset.kat, bolge: TQ.bolge, ad: TQ.ad, zaman: TQ.zaman }; TQ = keep; } re(); }));
  A.querySelectorAll('[data-tk]').forEach((b) => (b.onclick = () => {
    sync(); const k = b.dataset.tk, v = b.dataset.tv;
    if (b.dataset.tm === '1') { const cur = Array.isArray(TQ[k]) ? TQ[k] : []; TQ[k] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; }
    else { TQ[k] = TQ[k] === v ? '' : v; if (k === 'butce') TQ.butceX = ''; }
    re();
  }));
  A.querySelectorAll('[data-tx]').forEach((i) => (i.oninput = pv));
  A.querySelectorAll('[data-num]').forEach((i) => (i.onchange = () => { pv(); i.value = TQ[i.dataset.tx]; if (i.dataset.tx === 'butceX' && TQ.butceX && TQ.butce) { TQ.butce = ''; A.querySelectorAll('[data-tk=butce]').forEach((x) => x.classList.remove('on')); pv(); } }));
  if ($('#t-ch')) $('#t-ch').onclick = () => { sync(); TS = 0; talep(); scrollTo(0, 0); };
  if ($('#t-b')) $('#t-b').onclick = () => { sync(); TS--; talep(); scrollTo(0, 0); };
  if ($('#t-n')) $('#t-n').onclick = () => {
    sync();
    if (TS > 0) {
      const miss = tAdimlar()[TS - 1].filter(Boolean).find((f) => f.req && !(Array.isArray(TQ[f.k]) ? TQ[f.k].length : String(TQ[f.k] || '').trim()));
      if (miss) { $('#t-e').textContent = miss.k === 'kat' ? 'Lütfen bir kategori seçin.' : miss.k === 'tur' ? 'Lütfen türü seçin.' : 'Lütfen ' + miss.lbl.toLocaleLowerCase('tr') + ' alanını doldurun.'; const i = A.querySelector(`[data-tx="${miss.k}"]`); if (i) i.focus(); return; }
    }
    TS++; talep(); scrollTo(0, 0);
  };
  if ($('#t-go')) $('#t-go').onclick = () => { pv(); setTimeout(() => toast('Teşekkürler! Mesajı WhatsApp\'ta göndermeyi unutmayın.'), 400); };
}

// ---------- İlanlar ve filtre ----------
function filt() {
  const q = (F.q || '').toLocaleLowerCase('tr'), oz = F.oz || [];
  const r = L.filter((l) => (F.du === 'hepsi' || (F.du === 'acik' ? acik(l) : F.du === 'benim' ? l.u === me.id && acik(l) : l.durum === F.du)) && (!F.tip || l.tip === F.tip) && (!F.il || l.il === F.il) && (!F.tur || l.tur === F.tur || (F.tur === 'Arsa' && ARSA(l.tur)) || (F.tur === 'İşyeri' && ISY(l.tur)))
    && (!F.pmin || l.f >= +F.pmin) && (!F.pmax || l.f <= +F.pmax) && (!F.amin || l.m2 >= +F.amin) && (!F.amax || l.m2 <= +F.amax)
    && (!F.oda.length || F.oda.includes(String(Math.min(parseInt(l.oda) || 0, 4))))
    && (!F.kat || (F.kat === 'z' ? l.kat <= 0 : F.kat === '1' ? l.kat >= 1 && l.kat <= 3 : l.kat >= 4))
    && (!F.yas || (F.yas === '0' ? l.yas <= 5 : F.yas === '1' ? l.yas > 5 && l.yas <= 15 : l.yas > 15))
    && (F.as === '' || String(l.as) === F.as) && oz.every((o) => (l.oz || []).includes(o))
    && (l.il + ' ' + l.ilce + ' ' + (l.mah || '') + ' ' + l.t + ' ' + l.no + ' ' + l.sahip.ad).toLocaleLowerCase('tr').includes(q));
  if (F.s === 'pa') r.sort((a, b) => a.f - b.f);
  if (F.s === 'pd') r.sort((a, b) => b.f - a.f);
  if (F.s === 'm') r.sort((a, b) => b.m2 - a.m2);
  return r;
}
function rs() {
  const r = filt();
  if ($('#ftg')) { const act = ['tip', 'tur', 'il', 'q', 'pmin', 'pmax', 'amin', 'amax', 'yas', 'kat', 'as'].filter((k) => F[k]).length + (F.oda.length ? 1 : 0) + ((F.oz || []).length ? 1 : 0); $('#ftg').lastChild.textContent = 'Filtrele' + (act ? ` (${act})` : ''); }
  $('#rs').innerHTML = `<div class="tp"><span class="mu">${r.length} ilan bulundu</span><select id="so">${[['', 'En yeni'], ['pa', 'Fiyat: artan'], ['pd', 'Fiyat: azalan'], ['m', 'm²: büyükten küçüğe']].map((o) => `<option value="${o[0]}" ${S(F.s, o[0])}>${o[1]}</option>`).join('')}</select></div>${r.length ? `<div class="grid">${r.map(card).join('')}</div>` : `<p class="mu">${L.length ? 'Filtreye uyan ilan yok. Fiyat veya m² aralığını genişletin.' : 'Portföyde henüz ilan yok. İlan yönetiminden ilk ilanı ekleyin.'}</p>`}`;
  $('#so').onchange = (e) => { F.s = e.target.value; rs(); };
}
const opt = (a, v) => a.map((o) => `<option value="${esc(o[0])}" ${S(v, o[0])}>${esc(o[1])}</option>`).join('');
const chk = (n, a, v) => `<span class="ck">${a.map((o) => `<label><input type="checkbox" name="${n}" value="${esc(o[0])}" ${(v || []).includes(o[0]) ? 'checked' : ''}>${esc(o[1])}</label>`).join('')}</span>`;
function ilanlar() {
  if (!me) return needLogin();
  const rg = (a, b) => `<span class="rg"><input name="${a}" type="number" min="0" placeholder="En az" value="${esc(F[a])}"><input name="${b}" type="number" min="0" placeholder="En çok" value="${esc(F[b])}"></span>`;
  const ils = [...new Set(L.map((l) => l.il))].sort((a, b) => a.localeCompare(b, 'tr')).map((x) => [x, x]);
  const act = ['tip', 'tur', 'il', 'q', 'pmin', 'pmax', 'amin', 'amax', 'yas', 'kat', 'as'].filter((k) => F[k]).length + (F.oda.length ? 1 : 0) + ((F.oz || []).length ? 1 : 0);
  $('#app').innerHTML = `<div class="w"><div class="pth"><div><h2 style="margin:0">Portföy</h2><p class="mu" style="margin:4px 0 0">Ofisin tüm ilanları. Bir ilanı açıp müşterinize WhatsApp'tan gönderin.</p></div><a class="ba" href="/panel">+ Yeni ilan</a></div><div class="seg pseg" role="group" aria-label="Durum">${[['acik', 'Aktif + opsiyonlu'], ['benim', 'Benim ilanlarım'], ['satildi', 'Satıldı'], ['kiralandi', 'Kiralandı'], ['pasif', 'Pasif'], ['hepsi', 'Tümü']].map(([k, t]) => `<button type="button" data-fdu="${k}" class="${F.du === k ? 'on' : ''}">${t}</button>`).join('')}</div><button type="button" class="ftg" id="ftg" aria-expanded="false" aria-controls="fpn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtrele${act ? ` (${act})` : ''}</button><div class="ly"><div id="rs"></div><aside class="pn fp" id="fpn"><form id="ff"><h4 style="margin-top:0">İlan tipi</h4>${chk('tip', [['Satılık', 'Satılık'], ['Kiralık', 'Kiralık']], [F.tip])}<h4>Emlak türü</h4><select name="tur">${opt([['', 'Tümü'], ...TUR.map((t) => [t, t]), ['İşyeri', 'İşyeri (dükkan, ofis, depo)'], ['Arsa', 'Arsa (tarla ve parsel)']], F.tur)}</select><h4>Konum</h4><select name="il">${opt([['', 'Tüm şehirler'], ...ils], F.il)}</select><input name="q" placeholder="İlçe, mahalle, kelime veya ilan no" value="${esc(F.q)}" style="margin-top:8px"><h4>Fiyat aralığı (₺)</h4>${rg('pmin', 'pmax')}<h4>Brüt alan (m²)</h4>${rg('amin', 'amax')}<h4>Oda sayısı</h4>${chk('oda', [['1', '1+1'], ['2', '2+1'], ['3', '3+1'], ['4', '4+']], F.oda)}<h4>Bina yaşı</h4><select name="yas">${opt([['', 'Fark etmez'], ['0', '0 - 5 yaş'], ['1', '6 - 15 yaş'], ['2', '16 ve üzeri']], F.yas)}</select><h4>Bulunduğu kat</h4><select name="kat">${opt([['', 'Fark etmez'], ['z', 'Zemin / giriş'], ['1', '1 - 3. kat'], ['4', '4. kat ve üzeri']], F.kat)}</select><h4>Asansör</h4><select name="as">${opt([['', 'Fark etmez'], ['1', 'Var'], ['0', 'Yok']], F.as)}</select><h4>Özellikler</h4>${chk('oz', [...OZ, ...OZ_IS.filter((o) => !OZ.includes(o))].map((o) => [o, o]), F.oz)}<button type="button" id="fc" style="width:100%;margin-top:18px">Filtreleri temizle</button></form></aside></div></div>`;
  const f = $('#ff');
  f.oninput = f.onchange = () => { const d = new FormData(f), t = d.getAll('tip'); F = { ...F, tip: t.length === 1 ? t[0] : '', tur: d.get('tur'), il: d.get('il'), q: d.get('q'), pmin: d.get('pmin'), pmax: d.get('pmax'), amin: d.get('amin'), amax: d.get('amax'), oda: d.getAll('oda'), yas: d.get('yas'), kat: d.get('kat'), as: d.get('as'), oz: d.getAll('oz') }; rs(); };
  $('#fc').onclick = () => { R(); ilanlar(); };
  document.querySelectorAll('[data-fdu]').forEach((b) => (b.onclick = () => { F.du = b.dataset.fdu; document.querySelectorAll('[data-fdu]').forEach((x) => x.classList.toggle('on', x === b)); rs(); }));
  $('#ftg').onclick = () => { const o = $('#fpn').classList.toggle('open'); $('#ftg').setAttribute('aria-expanded', String(o)); };
  rs();
}

// ---------- İlan detayı ----------
const PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
const WAI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c.3 2 2.3 4.4 5 5l1.3-1.2 1.7.8-.4 1.6c-3.6.4-8.2-3.6-8.4-7.4L9.8 7.9l.9 1.6z"/></svg>';
const LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
const tarih = (t) => (t ? new Date(t * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const tarihSaat = (t) => (t ? new Date(t * 1000).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const initials = (ad) => String(ad || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toLocaleUpperCase('tr')).join('');
const canEdit = (l) => !!me && (canAll() || l.u === me.id);
const waNo = (t) => String(t || '').replace(/\D/g, '').replace(/^0/, '').replace(/^90/, '');
const privBox = (l) => `<div class="pn pvb"><h3 class="ph3">Ofis içi bilgiler <small>${l.u === me.id ? 'siz ve yetkililer görür' : 'yalnızca yetkililer görür'}</small></h3>
  <div class="prv" style="margin:0 0 6px"><span>Açık adres</span></div><p style="margin:0 0 6px">${esc(l.adr) || '<span class="mu">Açık adres girilmemiş.</span>'}</p><p class="mu" style="margin:0">${yer(l)}</p>${l.lat ? `<iframe class="wmap" title="İlan konumu" loading="lazy" src="${mapEmbed(l.lat, l.lon)}"></iframe>` : ''}<div class="sh2"><a href="${mapLink(l)}" target="_blank" rel="noopener"><button type="button" style="width:100%">Haritada aç</button></a><button type="button" id="shl">${SHR} Konumu gönder</button></div>
  <dl class="sum" style="margin-top:14px"><dt>Mal sahibi</dt><dd>${esc(l.ms) || '-'}${l.mt ? ` · <a href="tel:${esc(l.mt)}">${esc(l.mt)}</a>` : ''}</dd><dt>Yetki bitişi</dt><dd>${l.yb ? esc(new Date(l.yb + 'T12:00').toLocaleDateString('tr-TR')) + ' ' + ybTag(l) : '-'}</dd>${l.nt ? `<dt>Notlar</dt><dd style="white-space:pre-line">${esc(l.nt)}</dd>` : ''}</dl></div>`;
let LB = null;

// Paylaşım metni (WhatsApp'a uygun)
function paylasMetni(l, link) {
  const ar = ARSA(l.tur), u = me || l.sahip || {};
  const ln = [`*${l.t}*`, `💰 ${fiyat(l)}`, `📐 ${nf(l.m2)} m²${ar ? ' · ' + l.tur : ISY(l.tur) ? ` · ${l.tur} · ${kt(l)}` : ` · ${l.oda} · ${kt(l)}`}`, `📍 ${[mahK(l.mah), l.ilce, l.il].filter(Boolean).join(', ')}`];
  if (!ar && (l.oz || []).length) ln.push(`✓ ${l.oz.join(', ')}`);
  ln.push(`İlan No: ${l.no}`);
  if (link) ln.push('', `Fotoğraf ve detaylar: ${link}`);
  else if (l.d) ln.push('', clipT(l.d, 400));
  ln.push('', `${u.ad || ''} · Asya Emlak${u.tel ? '\n📞 ' + u.tel : ''}`);
  return ln.join('\n');
}
const clipT = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };

// Fotoğraflarla birlikte WhatsApp'a gönder (telefonun paylaşım menüsü)
async function fotoluGonder(l, btn) {
  const text = paylasMetni(l);
  const urls = l.p.filter((x) => typeof x === 'string').slice(0, 10);
  if (navigator.canShare && urls.length) {
    const old = btn.innerHTML;
    try {
      if (!l._files) {
        btn.disabled = true; btn.textContent = 'Fotoğraflar hazırlanıyor…';
        l._files = await Promise.all(urls.map(async (u, i) => new File([await (await fetch(u)).blob()], `asya-emlak-${l.no}-${i + 1}.jpg`, { type: 'image/jpeg' })));
      }
      if (navigator.canShare({ files: l._files, text })) {
        btn.disabled = false; btn.innerHTML = old;
        try { await navigator.share({ files: l._files, text }); return; }
        catch (e) { if (e.name === 'AbortError') return; if (e.name === 'NotAllowedError') { toast('Fotoğraflar hazır, gönder düğmesine tekrar dokunun.'); return; } throw e; }
      }
    } catch { /* aşağıda metinle devam */ } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  toast('Bu cihaz fotoğraflı paylaşımı desteklemiyor; bilgiler metin olarak gönderiliyor.');
}

// Müşteriye özel, süreli bağlantı
function ozelBaglanti(l, sonra) {
  const ov = document.createElement('div');
  ov.className = 'sht'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Müşteriye özel bağlantı');
  ov.innerHTML = `<div class="shb"><div class="shh"><h3>Müşteriye özel bağlantı</h3><button type="button" class="lbx" id="sx" aria-label="Kapat">✕</button></div><p class="mu" style="margin:0 0 12px;font-size:14px">Müşteriniz bağlantıyla ilanın fotoğraflarını, videosunu ve detaylarını görür. Açık adres ve ofis içi bilgiler gösterilmez. Bağlantı arama motorlarında çıkmaz ve süresi dolunca kapanır.</p><form id="sf"><div class="fld" style="margin-top:0"><span>Müşteri adı (isteğe bağlı, takip için)</span><input name="musteri" maxlength="80" placeholder="Örn. Ayşe Hanım"></div><div class="fld"><span>Geçerlilik süresi</span><div class="chips">${[[1, '1 gün'], [3, '3 gün'], [7, '1 hafta'], [15, '15 gün'], [30, '30 gün']].map(([g, t]) => `<label class="chip rc"><input type="radio" name="gun" value="${g}" ${g === 7 ? 'checked' : ''}>${t}</label>`).join('')}</div></div><div class="err" id="se" role="alert"></div><button class="pr" style="width:100%;padding:14px;margin-top:8px">Bağlantı oluştur</button></form></div>`;
  document.body.append(ov); document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); document.body.style.overflow = ''; LB = null; };
  try { history.pushState({ sh: 1 }, '', location.href); } catch {}
  LB = close;
  ov.querySelector('#sx').onclick = () => history.back();
  ov.onclick = (e) => { if (e.target === ov) history.back(); };
  ov.querySelector('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('button');
    b.disabled = true;
    try {
      const r = await api(`/listings/${l.id}/paylas`, { method: 'POST', body: { musteri: d.musteri, gun: +d.gun } });
      const url = location.origin + r.url;
      const msg = `Merhaba${d.musteri ? ' ' + d.musteri.trim() : ''}, sizin için seçtiğim ilan:\n\n${paylasMetni(l, url)}\n\n(Bağlantı ${tarih(r.bitis)} tarihine kadar geçerlidir.)`;
      ov.querySelector('.shb').innerHTML = `<div class="shh"><h3>Bağlantı hazır</h3><button type="button" class="lbx" id="sx" aria-label="Kapat">✕</button></div><p class="mu" style="margin:0 0 10px;font-size:14px">${tarih(r.bitis)} tarihine kadar geçerli.</p><input class="lnkbox" readonly value="${esc(url)}"><a class="cbtn2 wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${WAI} WhatsApp'ta gönder</a><button type="button" class="cbtn2" id="scp">${LINK} Mesajı kopyala</button>${navigator.share ? `<button type="button" class="cbtn2" id="ssh">${SHR} Diğer uygulamalar</button>` : ''}`;
      ov.querySelector('#sx').onclick = () => history.back();
      ov.querySelector('#scp').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Mesaj kopyalandı'); } catch { ov.querySelector('.lnkbox').select(); toast('Bağlantıyı seçip kopyalayın'); } };
      if (ov.querySelector('#ssh')) ov.querySelector('#ssh').onclick = () => navigator.share({ text: msg }).catch(() => {});
      if (sonra) sonra();
    } catch (err) { ov.querySelector('#se').textContent = err.message; b.disabled = false; }
  };
}

async function baglantilar(l) {
  const box = $('#plist'); if (!box) return;
  let a;
  try { a = await api(`/listings/${l.id}/paylas`); } catch { box.innerHTML = ''; return; }
  if (!document.body.contains(box)) return;
  const t = Date.now() / 1000;
  box.innerHTML = a.length ? `<h3 class="ph3">Gönderilen bağlantılar</h3>${a.map((p) => `<div class="pli ${p.bitis < t ? 'bitti' : ''}"><div><b>${esc(p.musteri) || 'İsimsiz müşteri'}</b><div class="mu">${esc(p.ad)} · ${tarihSaat(p.tarih)}</div><div class="mu">${p.gor ? `👁 ${p.gor} kez açıldı · son ${tarihSaat(p.son)}` : 'Henüz açılmadı'}</div><div class="mu">${p.bitis < t ? 'Süresi doldu / iptal' : 'Geçerli: ' + tarih(p.bitis)}</div></div>${p.bitis >= t ? `<button type="button" class="dg" data-pi="${p.id}">İptal et</button>` : ''}</div>`).join('')}` : '';
  box.querySelectorAll('[data-pi]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Bu bağlantı iptal edilsin mi? Müşteri artık ilanı göremez.')) return;
    try { await api('/paylasim/' + b.dataset.pi, { method: 'DELETE' }); toast('Bağlantı iptal edildi'); baglantilar(l); } catch (e) { toast(e.message); }
  }));
}

// İlan görünümü: mod 'ekip' (giriş yapmış kullanıcı) veya 'musteri' (özel bağlantı)
function ilanGoster(l, mod) {
  const ekip = mod === 'ekip';
  setTitle(`${l.t} – ${fiyat(l)}`);
  const u = l.sahip || {}, n = l.p.length, ar = ARSA(l.tur), wa = waNo(u.tel);
  const facts = [['İlan No', l.no], ['Fiyat', fiyat(l)], [ar ? 'Arsa alanı' : 'Brüt alan', nf(l.m2) + ' m²'],
    ...(ar ? [] : [...(ISY(l.tur) ? [] : [['Oda sayısı', l.oda]]), ['Bulunduğu kat', kt(l)], ['Bina yaşı', l.yas ? l.yas + ' yıl' : 'Yeni bina'], ['Asansör', l.as ? 'Var' : 'Yok']]),
    ['Emlak türü', l.tur], ['İlan tipi', l.tip], ...(ekip ? [['Eklenme', tarih(l.tarih)]] : [])];
  const m2f = l.tip === 'Satılık' && l.m2 ? `<div class="mu">m² fiyatı ≈ ${TL(Math.round(l.f / l.m2))}</div>` : '';
  const img = (x, i, lazy) => (typeof x === 'string' ? `<img src="${esc(x)}" alt="${esc(l.t)} – fotoğraf ${i + 1}" ${lazy ? 'loading="lazy"' : ''} decoding="async">` : ph(x));
  const msg = `Merhaba ${u.ad || ''}, ${l.no} numaralı "${l.t}" ilanı hakkında bilgi almak istiyorum.`;
  const yan = ekip
    ? `<div class="pn snd"><h3 class="ph3">Müşteriye gönder</h3>${acik(l) ? `<button type="button" class="cbtn2 wa" id="sfo">${WAI} Fotoğraflarla WhatsApp'ta gönder</button><button type="button" class="cbtn2 pr" id="sol">${LINK} Müşteriye özel bağlantı</button><p class="mu" style="margin:8px 0 0;font-size:13px">Fotoğraflı gönderimde telefonun paylaşım menüsü açılır; WhatsApp'ta kişiyi seçin. Özel bağlantı süreli olup açılma sayısını burada görürsünüz.</p>` : `<p class="mu" style="margin:0">Bu ilan "${DUR[l.durum]}" durumunda olduğu için müşteriye gönderilemez.</p>`}<div id="plist"></div></div>
       ${canEdit(l) ? `<div class="pn"><h3 class="ph3">Durum</h3><div class="chips">${Object.entries(DUR).map(([k, t]) => `<button type="button" class="chip ${l.durum === k ? 'on' : ''}" data-du="${k}">${t}</button>`).join('')}</div><button type="button" class="ed" data-e2="${l.id}" style="width:100%;margin-top:14px">İlanı düzenle</button></div>` : ''}
       ${l.priv ? privBox(l) : ''}
       <div class="pn"><div class="agent" style="margin:0"><div class="av">${esc(initials(u.ad))}</div><div><b>${esc(u.ad)}</b><div class="mu">İlan sorumlusu${u.tel ? ' · ' + esc(u.tel) : ''}</div></div></div></div>`
    : `<div class="pn"><div class="agent"><div class="av">${esc(initials(u.ad))}</div><div><b>${esc(u.ad)}</b><div class="mu">Asya Emlak danışmanınız</div></div></div>${u.tel ? `<a href="tel:${esc(u.tel)}"><button class="pr cbtn">${PHONE} ${esc(u.tel)}</button></a>` : ''}${wa ? `<a href="https://wa.me/90${esc(wa)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><button class="cbtn wa">${WAI} WhatsApp ile yazın</button></a>` : ''}<p class="mu" style="margin:12px 0 0;text-align:center;font-size:13px">Bu sayfa size özel hazırlanmıştır${l.bitis ? ` ve <b>${tarih(l.bitis)}</b> tarihine kadar geçerlidir` : ''}.</p></div>`;
  const benzer = ekip ? L.filter((x) => x.id !== l.id && x.tip === l.tip && acik(x)).sort((a, b) => (b.il === l.il) - (a.il === l.il) || (b.ilce === l.ilce) - (a.ilce === l.ilce)).slice(0, 3) : [];
  $('#app').innerHTML = `<div class="w dtw">${ekip ? `<div class="bc" role="navigation" aria-label="Konum"><a href="/ilanlar">Portföy</a><span>›</span><span>${esc(l.il)}</span><span>›</span><span>${esc(l.ilce)}</span></div>` : '<div class="mzel">Size özel hazırlanmış ilan</div>'}
  <div class="dt"><div class="dmain">
   <div class="gal"><div class="gtrack" id="gtr">${l.p.map((x, i) => `<button type="button" class="gsl" data-lb="${i}" aria-label="Fotoğraf ${i + 1} / ${n}, büyüt">${img(x, i, i > 0)}</button>`).join('')}</div>${n > 1 ? `<button type="button" class="gnav gp" data-gd="-1" aria-label="Önceki fotoğraf">‹</button><button type="button" class="gnav gn" data-gd="1" aria-label="Sonraki fotoğraf">›</button>` : ''}<span class="gct" id="gct">1 / ${n}</span>${l.v ? '<button type="button" class="gvid" id="gvid">▶ Video</button>' : ''}</div>
   ${n > 1 ? `<div class="gth" id="gth">${l.p.map((x, i) => `<button type="button" data-gi="${i}" class="${i ? '' : 'a'}" aria-label="Fotoğraf ${i + 1}">${img(x, i, true)}</button>`).join('')}</div>` : ''}
   <div class="dh"><div><div class="sp2" style="margin:0"><span class="tg">${esc(l.tip)}</span><span class="tg">${esc(l.tur)}</span>${ekip ? durTag(l) + ybTag(l) : ''}</div><h1 class="dtt">${esc(l.t)}</h1><p class="loc">${PIN}${yer(l)}</p></div><div class="dpr"><div class="pc">${fiyat(l)}</div>${m2f}</div></div>
   <div class="dact"><span class="ino">İlan No <b>${l.no}</b>${ekip ? ' · ' + esc(tarih(l.tarih)) : ''}</span></div>
   <div class="facts">${facts.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
   ${l.v ? `<section class="dsec" id="vsec"><h2>Video</h2><video class="dvid" src="${esc(l.v)}" controls playsinline preload="metadata"${typeof l.p[0] === 'string' ? ` poster="${esc(l.p[0])}"` : ''}></video></section>` : ''}
   ${(l.oz || []).length ? `<section class="dsec"><h2>Özellikler</h2><div class="sp2">${l.oz.map((o) => `<span class="tg">✓ ${esc(o)}</span>`).join('')}</div></section>` : ''}
   <section class="dsec"><h2>Açıklama</h2><p class="desc ${String(l.d).length > 600 ? 'clip' : ''}" id="dsc">${esc(l.d)}</p>${String(l.d).length > 600 ? '<button type="button" id="dmore" class="lnk">Devamını oku</button>' : ''}</section>
  </div>
  <aside class="asd">${yan}</aside></div>
  ${benzer.length ? `<section class="dsec"><h2>Benzer ilanlar</h2><div class="grid">${benzer.map(card).join('')}</div></section>` : ''}
  </div>
  <div class="cbar">${ekip ? (acik(l) ? `<button class="wa" id="sfo2">${WAI} Fotoğraflı</button><button class="pr" id="sol2">${LINK} Özel bağlantı</button>` : '') : `${u.tel ? `<a href="tel:${esc(u.tel)}"><button class="pr">${PHONE} Ara</button></a>` : ''}${wa ? `<a href="https://wa.me/90${esc(wa)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><button class="wa">${WAI} WhatsApp</button></a>` : ''}`}</div>
  <div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Fotoğraflar" hidden><div class="lbtop"><span id="lbc"></span><button type="button" class="lbx" id="lbx" aria-label="Kapat">✕</button></div><div class="lbtr" id="lbtr">${l.p.map((x, i) => `<figure>${img(x, i, true)}</figure>`).join('')}</div>${n > 1 ? `<button type="button" class="gnav gp" data-ld="-1" aria-label="Önceki">‹</button><button type="button" class="gnav gn" data-ld="1" aria-label="Sonraki">›</button>` : ''}</div>`;

  if ($('#gvid')) $('#gvid').onclick = () => { const v = $('#vsec'); v.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => { try { v.querySelector('video').play(); } catch {} }, 500); };
  // Galeri
  const tr = $('#gtr'), ct = $('#gct');
  const gi = () => Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
  const gto = (i, sm = true) => tr.scrollTo({ left: ((i + n) % n) * tr.clientWidth, behavior: sm ? 'smooth' : 'auto' });
  let raf = 0;
  tr.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = gi(); ct.textContent = `${i + 1} / ${n}`; document.querySelectorAll('#gth button').forEach((b, k) => b.classList.toggle('a', k === i)); const t = document.querySelector(`#gth button[data-gi="${i}"]`); if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }); }, { passive: true });
  document.querySelectorAll('[data-gd]').forEach((b) => (b.onclick = () => gto(gi() + +b.dataset.gd)));
  document.querySelectorAll('[data-gi]').forEach((b) => (b.onclick = () => gto(+b.dataset.gi)));
  // Tam ekran
  const lb = $('#lb'), lt = $('#lbtr'), lc = $('#lbc');
  const li = () => Math.round(lt.scrollLeft / Math.max(1, lt.clientWidth));
  const lto = (i, sm = true) => lt.scrollTo({ left: ((i + n) % n) * lt.clientWidth, behavior: sm ? 'smooth' : 'auto' });
  lt.addEventListener('scroll', () => { lc.textContent = `${li() + 1} / ${n}`; }, { passive: true });
  const close = () => { lb.hidden = true; document.body.style.overflow = ''; gto(li(), false); LB = null; };
  const key = (e) => { if (lb.hidden) return; if (e.key === 'Escape') history.back(); if (e.key === 'ArrowRight') lto(li() + 1); if (e.key === 'ArrowLeft') lto(li() - 1); };
  LB = null;
  document.querySelectorAll('[data-lb]').forEach((b) => (b.onclick = () => {
    lb.hidden = false; document.body.style.overflow = 'hidden'; lto(+b.dataset.lb, false); lc.textContent = `${+b.dataset.lb + 1} / ${n}`;
    history.pushState({ lb: 1 }, '', location.href); LB = close; $('#lbx').focus();
  }));
  $('#lbx').onclick = () => history.back();
  document.querySelectorAll('[data-ld]').forEach((b) => (b.onclick = () => lto(li() + +b.dataset.ld)));
  document.onkeydown = key;
  if ($('#dmore')) $('#dmore').onclick = (e) => { $('#dsc').classList.remove('clip'); e.target.remove(); };
  if (!ekip) return;
  // Ekip işlemleri
  ['#sfo', '#sfo2'].forEach((s) => { if ($(s)) $(s).onclick = (e) => fotoluGonder(l, e.currentTarget); });
  ['#sol', '#sol2'].forEach((s) => { if ($(s)) $(s).onclick = () => ozelBaglanti(l, () => baglantilar(l)); });
  if ($('#shl')) $('#shl').onclick = () => shareIt('Konum: ' + l.t, l.adr || [l.mah, l.ilce, l.il].join(', '), mapLink(l));
  document.querySelectorAll('[data-e2]').forEach((b) => (b.onclick = () => { W = { ...blank(), ...JSON.parse(JSON.stringify(l)), _edit: l.id }; delete W._files; ws = 0; go('/panel'); }));
  document.querySelectorAll('[data-du]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.du === l.durum) return;
    try { await api('/listings/' + l.id, { method: 'PATCH', body: { durum: b.dataset.du } }); l.durum = b.dataset.du; const x = L.find((y) => y.id === l.id); if (x) x.durum = l.durum; MY = null; toast('Durum: ' + DUR[l.durum]); ilanGoster(l, 'ekip'); }
    catch (e) { toast(e.message); }
  }));
  baglantilar(l);
}

async function detail(no) {
  if (!me) return needLogin();
  const id = Number(no) - NO_OFFSET, here = cur;
  let l;
  loading();
  try { l = await api('/listings/' + id); }
  catch (e) { setTitle('İlan bulunamadı'); return errBox(e.status === 404 ? 'İlan bulunamadı ya da silinmiş.' : e.message); }
  if (cur !== here) return;
  if (location.pathname !== l.url) history.replaceState(history.state, '', l.url);
  cur = l.url;
  ilanGoster(l, 'ekip');
}

async function musteri(token) {
  const here = cur;
  loading();
  let l;
  try { l = await api('/p/' + token); }
  catch (e) { setTitle('Bağlantı geçersiz'); const t = (SS.tel || '').trim(); $('#app').innerHTML = `<div class="wz"><div class="pn" style="text-align:center"><h2 style="margin-top:0">Bu bağlantı artık geçerli değil</h2><p class="mu">${esc(e.message)}</p>${t ? `<a href="tel:${esc(t)}"><button class="pr">${PHONE} ${esc(t)}</button></a>` : ''} <a href="/"><button>Asya Emlak'ı tanıyın</button></a></div></div>`; return; }
  if (cur !== here) return;
  ilanGoster(l, 'musteri');
}

// ---------- Kurumsal sayfalar ----------
function about() {
  $('#app').innerHTML = `<div class="w"><h2>Hakkımızda</h2><div class="pn" style="max-width:760px">${String(SS.hak || '').split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`;
}
const harLink = () => SS.harita || (SS.adr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Asya Emlak ' + SS.adr)}` : '');
const harEmbed = () => SS.harita_e || (SS.adr ? `https://www.google.com/maps?q=${encodeURIComponent(SS.adr)}&z=16&output=embed&hl=tr` : '');
function contact() {
  const tel = (SS.tel || '').trim(), wa = waOfis(), hl = harLink(), he = harEmbed();
  const row = (ic, t, v) => (v ? `<div class="crw">${ic}<div><span>${t}</span><b>${v}</b></div></div>` : '');
  const MAILI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
  const CLK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  $('#app').innerHTML = `<div class="s2 cpg"><div class="s2h"><span class="eyb">İletişim</span><h2>Bize ulaşın, kahvemizi için.</h2></div><div class="cg2"><div class="cinf">
   ${row(PHONE, 'Telefon', tel ? `<a href="tel:${esc(tel)}">${esc(tel)}</a>` : '')}${row(MAILI, 'E-posta', SS.mail ? `<a href="mailto:${esc(SS.mail)}">${esc(SS.mail)}</a>` : '')}${row(PIN, 'Adres', SS.adr ? esc(SS.adr) : '')}${row(CLK, 'Çalışma saatleri', SS.saat ? esc(SS.saat) : '')}
   ${!tel && !SS.mail && !SS.adr ? '<p class="mu">İletişim bilgileri yakında eklenecek.</p>' : ''}
   <div class="pls" style="margin-top:22px">${wa ? `<a class="pill wa" href="https://wa.me/90${esc(wa)}" target="_blank" rel="noopener">${WAI} WhatsApp</a>` : ''}${hl ? `<a class="pill" href="${esc(hl)}" target="_blank" rel="noopener">${PIN} Yol tarifi al</a>` : ''}</div></div>
   ${he ? `<iframe class="mp2" title="Asya Emlak konumu" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(he)}"></iframe>` : ''}</div></div>`;
}

// ---------- Giriş / kurulum / hesap ----------
function giris() {
  if (me) return go('/panel', true);
  const kur = kurulum;
  $('#app').innerHTML = `<div class="wz"><h2>${kur ? 'İlk kurulum' : 'Ekip girişi'}</h2><p class="mu" style="margin:0 0 6px">${kur ? 'Henüz hiç kullanıcı yok. Yönetici hesabınızı oluşturun. Bu formu yalnızca bir kez görürsünüz.' : 'Portföyü görmek, ilan eklemek ve müşterilere göndermek için giriş yapın.'}</p><form id="lgf" class="pn" style="margin-top:14px">${kur ? `<div class="fld"><span>Kurulum kodu</span><input name="kod" autocomplete="off" required></div><div class="fld"><span>Ad soyad</span><input name="ad" autocomplete="name" required></div><div class="fld"><span>Telefon</span><input name="tel" type="tel" autocomplete="tel" placeholder="05xx xxx xx xx"></div>` : ''}<div class="fld"><span>E-posta</span><input name="mail" type="email" autocomplete="${kur ? 'email' : 'username'}" required></div><div class="fld"><span>Şifre</span><input name="sifre" type="password" autocomplete="${kur ? 'new-password' : 'current-password'}" minlength="${kur ? 8 : 1}" required></div>${kur ? '<div class="fld"><span>Şifre (tekrar)</span><input name="sifre2" type="password" autocomplete="new-password" minlength="8" required></div><p class="mu">En az 8 karakter. Şifreniz sunucuda geri çözülemeyecek şekilde (özetlenerek) saklanır.</p>' : ''}<div class="err" id="lge" role="alert"></div><button class="pr" style="width:100%;padding:14px;font-size:16px;margin-top:6px">${kur ? 'Yönetici hesabını oluştur' : 'Giriş yap'}</button></form></div>`;
  $('#lgf').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)), btn = e.target.querySelector('button');
    if (kur && d.sifre !== d.sifre2) return ($('#lge').textContent = 'Şifreler aynı değil.');
    btn.disabled = true;
    try {
      await api(kur ? '/setup' : '/login', { method: 'POST', body: d });
      await boot(false);
      toast(kur ? 'Yönetici hesabı oluşturuldu' : 'Giriş yapıldı');
      go('/panel', true);
    } catch (err) { $('#lge').textContent = err.message; btn.disabled = false; }
  };
}

function hesap() {
  if (!me) return needLogin();
  $('#app').innerHTML = `<div class="wz"><h2>Hesabım</h2><span class="mu">${esc(me.mail)} · ${me.rol === 'admin' ? 'Yönetici' : me.tumIlan ? 'Yetkili danışman' : 'Danışman'}</span><form id="pf" class="pn" style="margin-top:14px"><h3 style="margin:0">Bilgilerim</h3><p class="mu" style="margin:4px 0 0">Müşterilere gönderdiğiniz ilanlarda bu ad ve telefon gösterilir.</p><div class="fld"><span>Ad soyad</span><input name="ad" value="${esc(me.ad)}" required></div><div class="fld"><span>Telefon</span><input name="tel" type="tel" value="${esc(me.tel)}"></div><button class="pr" style="margin-top:14px">Kaydet</button></form><form id="pwf" class="pn" style="margin-top:14px"><h3 style="margin:0">Şifre değiştir</h3><div class="fld"><span>Mevcut şifre</span><input name="eski" type="password" autocomplete="current-password" required></div><div class="fld"><span>Yeni şifre</span><input name="yeni" type="password" autocomplete="new-password" minlength="8" required></div><div class="fld"><span>Yeni şifre (tekrar)</span><input name="yeni2" type="password" autocomplete="new-password" minlength="8" required></div><div class="err" id="pwe" role="alert"></div><button class="pr">Şifreyi değiştir</button></form><button id="lo" class="dg" style="width:100%;margin-top:18px;padding:13px">Çıkış yap</button></div>`;
  $('#pf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/profile', { method: 'PUT', body: d }); me.ad = d.ad; me.tel = d.tel; renderNav(); toast('Bilgiler kaydedildi'); } catch (err) { toast(err.message); } };
  $('#pwf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d.yeni !== d.yeni2) return ($('#pwe').textContent = 'Yeni şifreler aynı değil.'); try { await api('/password', { method: 'POST', body: d }); e.target.reset(); $('#pwe').textContent = ''; toast('Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.'); } catch (err) { $('#pwe').textContent = err.message; } };
  $('#lo').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch {} me = null; MY = USERS = null; W = null; L = []; renderNav(); toast('Çıkış yapıldı'); go('/'); };
}

// ---------- İlanlarım ----------
const gd = () => { try { return JSON.parse(localStorage.getItem('asya-draft') || 'null'); } catch { return null; } };
const wrep = (k, v) => (k.startsWith('_v') ? undefined : v);
const draft = () => { try { localStorage.setItem('asya-draft', JSON.stringify({ W, ws }, wrep)); } catch {} };
const nod = () => { try { localStorage.removeItem('asya-draft'); } catch {} };
const blank = () => ({ t: '', tip: 'Satılık', tur: 'Daire', p: [], f: '', m2: '', il: '', ilce: '', mah: '', adr: '', lat: null, lon: null, oda: '2+1', kat: 1, yas: 0, as: 1, oz: [], d: '', v: '', durum: 'aktif', ms: '', mt: '', yb: '', nt: '' });
let PT = 'mine', PQ = { q: '', sahip: '', durum: '' };

async function panel() {
  if (!me) return needLogin();
  if (W) return wiz();
  setTitle(canAll() ? 'İlan yönetimi' : 'İlanlarım');
  if (!MY) { loading(); try { MY = await api('/my-listings'); } catch (e) { return errBox(e.message); } if (cur !== '/panel' || W) return; }
  const all = canAll(), mine = MY.filter((l) => l.u === me.id), dr = gd();
  if (!all) PT = 'mine';
  const sahipler = [...new Map(MY.map((l) => [l.u, l.sahip.ad])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'tr'));
  const q = PQ.q.trim().toLocaleLowerCase('tr');
  const src = PT === 'all' ? MY : mine;
  const uyari = src.filter((l) => acik(l) && gunKaldi(l.yb) !== null && gunKaldi(l.yb) <= 15);
  const list = src.filter((l) => (!PQ.sahip || String(l.u) === PQ.sahip) && (!PQ.durum || (PQ.durum === 'yetki' ? uyari.includes(l) : l.durum === PQ.durum))
    && (!q || (l.t + ' ' + l.no + ' ' + l.il + ' ' + l.ilce + ' ' + (l.mah || '') + ' ' + l.sahip.ad + ' ' + (l.ms || '')).toLocaleLowerCase('tr').includes(q)));
  const cnt = (k) => src.filter((l) => l.durum === k).length;
  const item = (l) => `<div class="mi">${ph(l.p[0])}<div class="in"><div><b>${esc(l.t)}</b></div><div class="pc" style="font-size:15px">${fiyat(l)}</div><div class="mu">No ${l.no} · ${yer(l)}</div><div class="mu">${PT === 'all' ? esc(l.sahip.ad) + ' · ' : ''}${l.ms ? 'Mal sahibi: ' + esc(l.ms) : ''}</div><div class="sp2" style="margin:6px 0 0">${durTag(l)}${ybTag(l)}</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button data-g="${l.id}" class="pr">Aç / gönder</button><button data-e="${l.id}">Düzenle</button><select data-dv="${l.id}" aria-label="Durum">${Object.entries(DUR).map(([k, t]) => `<option value="${k}" ${l.durum === k ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="dg" data-d="${l.id}">Sil</button></div></div></div>`;
  $('#app').innerHTML = `<div class="wz"><h2>${all ? 'İlan yönetimi' : 'İlanlarım'}</h2>${all ? `<div class="tb" style="margin:6px 0 4px"><button class="${PT === 'mine' ? 'on' : ''}" data-pt="mine">İlanlarım (${mine.length})</button><button class="${PT === 'all' ? 'on' : ''}" data-pt="all">Tüm ilanlar (${MY.length})</button></div>` : ''}
  <div class="dsum">${[['', 'Tümü', src.length], ...Object.entries(DUR).map(([k, t]) => [k, t, cnt(k)]), ...(uyari.length ? [['yetki', 'Yetkisi biten', uyari.length]] : [])].map(([k, t, c]) => `<button type="button" class="${PQ.durum === k ? 'on' : ''} ${k === 'yetki' ? 'uy' : ''}" data-pd="${k}"><b>${c}</b>${t}</button>`).join('')}</div>
  ${!fotoOk ? '<div class="pn dbn" style="border-color:#ff8b8b"><span>Fotoğraf depolama henüz etkin değil; şimdilik yeni ilan eklenemez.</span></div>' : ''}${dr && dr.W ? `<div class="pn dbn"><span>Yarım kalan ilan: <b>${esc(dr.W.t || 'Başlıksız')}</b></span><span><button id="dg" class="pr">Devam et</button> <button id="dx" class="dg">Sil</button></span></div>` : ''}
  ${src.length > 3 || PQ.q || PQ.sahip ? `<div class="pflt"><input id="pq" type="search" placeholder="Başlık, ilan no, konum veya mal sahibi ara" value="${esc(PQ.q)}">${PT === 'all' ? `<select id="ps"><option value="">Tüm danışmanlar</option>${sahipler.map(([id, ad]) => `<option value="${id}" ${PQ.sahip === String(id) ? 'selected' : ''}>${esc(ad)}</option>`).join('')}</select>` : ''}</div>` : ''}
  <div class="ml" id="pml">${list.map(item).join('') || `<div class="pn mu">${src.length ? 'Bu filtreye uyan ilan yok.' : 'Henüz ilanınız yok. Sağ alttaki butonla ilk ilanınızı ekleyin.'}</div>`}</div></div><button class="pr fab" id="nw">+ Yeni ilan</button>`;
  $('#nw').onclick = () => { W = blank(); ws = 0; wiz(); };
  if ($('#dg')) $('#dg').onclick = () => { W = dr.W; ws = dr.ws || 0; wiz(); };
  if ($('#dx')) $('#dx').onclick = () => { nod(); panel(); };
  document.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = () => { PT = b.dataset.pt; PQ.sahip = ''; panel(); }));
  document.querySelectorAll('[data-pd]').forEach((b) => (b.onclick = () => { PQ.durum = b.dataset.pd; panel(); }));
  if ($('#pq')) $('#pq').oninput = (e) => { PQ.q = e.target.value; clearTimeout(panel.t); panel.t = setTimeout(() => { panel(); const i = $('#pq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  if ($('#ps')) $('#ps').onchange = (e) => { PQ.sahip = e.target.value; panel(); };
  bindListingActions(panel);
}

function bindListingActions(again) {
  document.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { const l = MY.find((x) => x.id == b.dataset.e); W = { ...blank(), ...JSON.parse(JSON.stringify(l)), _edit: l.id }; ws = 0; go('/panel'); }));
  document.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { const l = MY.find((x) => x.id == b.dataset.g); go(l.url); }));
  document.querySelectorAll('[data-dv]').forEach((s) => (s.onchange = async () => {
    const l = MY.find((x) => x.id == s.dataset.dv); s.disabled = true;
    try { await api('/listings/' + l.id, { method: 'PATCH', body: { durum: s.value } }); l.durum = s.value; await refreshPublic(); toast('Durum: ' + DUR[l.durum]); } catch (e) { toast(e.message); }
    again();
  }));
  document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
    const l = MY.find((x) => x.id == b.dataset.d);
    if (!confirm(`"${l.t}" (No ${l.no}) ilanı, fotoğrafları ve paylaşım bağlantıları kalıcı olarak silinsin mi?`)) return;
    b.disabled = true;
    try { await api('/listings/' + l.id, { method: 'DELETE' }); MY = MY.filter((x) => x.id !== l.id); await refreshPublic(); toast('İlan silindi'); } catch (e) { toast(e.message); }
    again();
  }));
}

// ---------- İlan sihirbazı ----------
const shrink = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = () => r(null); im.src = fr.result; }; fr.onerror = () => r(null); fr.readAsDataURL(f); });
const ch = (k, a) => `<div class="chips">${a.map((v) => `<button type="button" class="chip ${W[k] == v ? 'on' : ''}" data-k="${k}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
const kv = (k, v) => (k === 'kat' ? (v < 0 ? 'Bodrum ' + -v : v == 0 ? 'Zemin' : v + '. kat') : v == 0 ? 'Yeni' : v + ' yaş');
const stp = (k, a, b) => `<div class="stp"><button type="button" data-sk="${k}" data-sd="-1" data-a="${a}" data-b="${b}" aria-label="Azalt">−</button><output id="o-${k}">${kv(k, W[k])}</output><button type="button" data-sk="${k}" data-sd="1" data-a="${a}" data-b="${b}" aria-label="Arttır">+</button></div>`;
const wsync = () => { const g = (i) => document.getElementById(i); if (g('w-t')) W.t = g('w-t').value; if (g('w-f')) W.f = +g('w-f').value.replace(/\D/g, '') || ''; if (g('w-m2')) W.m2 = +g('w-m2').value.replace(/\D/g, '') || ''; if (g('w-il')) W.il = g('w-il').value.trim(); if (g('w-ilce')) W.ilce = g('w-ilce').value.trim(); if (g('w-mah')) W.mah = g('w-mah').value.trim(); if (g('w-adr')) W.adr = g('w-adr').value.trim(); if (g('w-d')) W.d = g('w-d').value; if (g('w-ms')) { W.ms = g('w-ms').value.trim(); W.mt = g('w-mt').value.trim(); W.yb = g('w-yb').value; W.nt = g('w-nt').value; } };

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

// Uygulama içi kamera: bir kez açılır, art arda çekim yapılır
async function camOpen() {
  const fallback = () => $('#w-cam') && $('#w-cam').click();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fallback();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false });
  } catch (e) {
    if (e && e.name === 'NotAllowedError') toast('Kamera izni verilmedi. Telefonun kendi kamerası açılıyor.');
    return fallback();
  }
  const ov = document.createElement('div');
  ov.className = 'cam'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Kamera');
  ov.innerHTML = `<video playsinline autoplay muted></video><i class="camfl"></i><div class="camtop"><span id="camc"></span><button type="button" class="lbx" id="camx" aria-label="Kapat">✕</button></div><div class="cambar"><div class="camstrip" id="cams"></div><button type="button" class="shut" id="camsh" aria-label="Fotoğraf çek"></button><button type="button" class="pr camok" id="camok">Bitti</button></div>`;
  document.body.append(ov); document.body.style.overflow = 'hidden';
  const v = ov.querySelector('video'); v.srcObject = stream;
  const upd = () => {
    ov.querySelector('#camc').textContent = `${W.p.length} / 15 fotoğraf`;
    ov.querySelector('#cams').innerHTML = W.p.slice(-3).map((x) => `<i style="background-image:url('${x}')"></i>`).join('');
    ov.querySelector('#camsh').disabled = W.p.length >= 15;
  };
  upd();
  const close = () => { stream.getTracks().forEach((t) => t.stop()); ov.remove(); document.body.style.overflow = ''; LB = null; draft(); wiz(); };
  try { history.pushState({ cam: 1 }, '', location.href); } catch {}
  LB = close;
  ov.querySelector('#camx').onclick = ov.querySelector('#camok').onclick = () => history.back();
  ov.querySelector('#camsh').onclick = () => {
    if (W.p.length >= 15) return toast('En fazla 15 fotoğraf ekleyebilirsiniz.');
    const w = v.videoWidth, h = v.videoHeight; if (!w || !h) return;
    const k = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    W.p.push(c.toDataURL('image/jpeg', 0.82));
    const fl = ov.querySelector('.camfl'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
    if (navigator.vibrate) navigator.vibrate(25);
    upd(); draft();
    if (W.p.length >= 15) toast('15 fotoğraf sınırına ulaşıldı');
  };
}

// ---------- Video (ücretsiz: tarayıcıda 720p'ye küçültülür) ----------
const VMAX = 180, VBPS = 1800000, VRAW = 25 * 1024 * 1024, VLIM = 90 * 1024 * 1024;
const vMime = () => {
  const M = window.MediaRecorder; if (!M || !M.isTypeSupported) return '';
  return ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => { try { return M.isTypeSupported(t); } catch { return false; } }) || '';
};
const vBase = (t) => (String(t).startsWith('video/mp4') ? 'video/mp4' : String(t).startsWith('video/webm') ? 'video/webm' : '');
const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
const MB = (b) => (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',') + ' MB';
function setVid(blob) { if (W._vu) URL.revokeObjectURL(W._vu); W._vb = blob || null; W._vu = blob ? URL.createObjectURL(blob) : ''; }
const vRecorder = (st, mt) => { try { return new MediaRecorder(st, { mimeType: mt, videoBitsPerSecond: VBPS, audioBitsPerSecond: 96000 }); } catch { return new MediaRecorder(st); } };

// Uygulama içi video çekimi (720p, en fazla 3 dk)
async function vidRec() {
  const mt = vMime(), fallback = () => $('#w-vf') && $('#w-vf').click();
  if (!mt || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fallback();
  const vc = { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
  let st;
  try { st = await navigator.mediaDevices.getUserMedia({ video: vc, audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) {
    try { st = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false }); toast('Mikrofon izni yok; video sessiz çekilecek.'); }
    catch (e2) { if (e2 && e2.name === 'NotAllowedError') toast('Kamera izni verilmedi. Telefonun kendi kamerası açılıyor.'); return fallback(); }
  }
  const ov = document.createElement('div');
  ov.className = 'cam'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Video çek');
  ov.innerHTML = `<video playsinline autoplay muted></video><div class="camtop"><span id="vrt" class="vrt">0:00 / ${mmss(VMAX)}</span><button type="button" class="lbx" id="vrx" aria-label="Kapat">✕</button></div><div class="cambar"><span class="mu" id="vrh" style="color:#fff;font-size:13px">Telefonu yatay tutmanız önerilir</span><button type="button" class="shut rec" id="vrb" aria-label="Kaydı başlat"></button><span></span></div>`;
  document.body.append(ov); document.body.style.overflow = 'hidden';
  ov.querySelector('video').srcObject = st;
  let rec = null, chunks = [], t0 = 0, iv = 0, keep = false;
  const btn = ov.querySelector('#vrb'), tm = ov.querySelector('#vrt');
  const end = () => { clearInterval(iv); st.getTracks().forEach((t) => t.stop()); ov.remove(); document.body.style.overflow = ''; LB = null; wiz(); };
  const close = () => { if (rec && rec.state !== 'inactive') { rec.stop(); } else end(); };
  try { history.pushState({ cam: 1 }, '', location.href); } catch {}
  LB = close;
  ov.querySelector('#vrx').onclick = () => history.back();
  btn.onclick = () => {
    if (!rec) {
      rec = vRecorder(st, mt); chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (keep && chunks.length) { const b = new Blob(chunks, { type: vBase(rec.mimeType || mt) || 'video/webm' }); setVid(b); W._vd = Math.round((Date.now() - t0) / 1000); toast(`Video eklendi (${MB(b.size)})`); }
        end();
      };
      rec.start(1000); t0 = Date.now(); btn.classList.add('on'); btn.setAttribute('aria-label', 'Kaydı bitir'); ov.querySelector('#vrh').textContent = 'Kaydediliyor… bitirmek için dokunun';
      iv = setInterval(() => { const sec = (Date.now() - t0) / 1000; tm.textContent = `● ${mmss(sec)} / ${mmss(VMAX)}`; if (sec >= VMAX) { keep = true; history.back(); } }, 250);
      if (navigator.vibrate) navigator.vibrate(30);
    } else { keep = true; history.back(); }
  };
}

// Galeriden seçilen videoyu 720p'ye küçültür (gerçek zamanlı yeniden kayıt)
async function compressVideo(file, onp) {
  const ok = vBase(file.type), mt = vMime();
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', '');
  v.style.cssText = 'position:fixed;left:-9999px;width:2px;height:2px';
  document.body.append(v);
  const clean = () => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); URL.revokeObjectURL(url); };
  try {
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('Video okunamadı (desteklenmeyen biçim).')); setTimeout(() => rej(new Error('Video okunamadı.')), 20000); });
    const dur = v.duration;
    if (isFinite(dur) && dur > VMAX + 1) throw new Error(`Video ${mmss(dur)} dakika. En fazla 3 dakikalık video ekleyebilirsiniz; telefonunuzda kırpıp tekrar deneyin.`);
    const small = Math.max(v.videoWidth, v.videoHeight) <= 1280;
    if (ok && (file.size <= VRAW || (small && file.size <= VLIM))) { clean(); return { blob: file, dur }; }
    if (!mt || !HTMLCanvasElement.prototype.captureStream) {
      if (ok && file.size <= VLIM) { clean(); return { blob: file, dur }; }
      throw new Error('Bu tarayıcı videoyu küçültemiyor. "Video çek" ile doğrudan çekin.');
    }
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k / 2) * 2; c.height = Math.round(v.videoHeight * k / 2) * 2;
    const g = c.getContext('2d');
    const st = c.captureStream(30);
    let ac = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC(); const src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination();
      src.connect(dst); dst.stream.getAudioTracks().forEach((t) => st.addTrack(t)); await ac.resume();
    } catch { ac = null; v.muted = true; }
    const rec = vRecorder(st, mt), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = res; });
    let live = true;
    const draw = () => { if (!live) return; g.drawImage(v, 0, 0, c.width, c.height); if (onp && isFinite(dur) && dur) onp(Math.min(1, v.currentTime / dur)); if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw); else requestAnimationFrame(draw); };
    try { await v.play(); } catch { v.muted = true; await v.play(); }
    rec.start(1000); draw();
    await new Promise((res) => { v.onended = res; v.onerror = res; });
    live = false; rec.stop(); await done;
    st.getTracks().forEach((t) => t.stop()); if (ac) ac.close();
    const out = new Blob(chunks, { type: vBase(rec.mimeType || mt) || 'video/webm' });
    clean();
    if (!out.size) throw new Error('Video küçültülemedi.');
    if (ok && file.size <= out.size && file.size <= VLIM) return { blob: file, dur };
    if (out.size > VLIM) throw new Error('Video çok büyük. Daha kısa bir video seçin.');
    return { blob: out, dur };
  } catch (e) { clean(); throw e; }
}

function upVid(blob, onp) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/videos'); x.withCredentials = true;
    x.setRequestHeader('x-asya', '1'); x.setRequestHeader('content-type', vBase(blob.type) || 'video/mp4');
    x.upload.onprogress = (e) => { if (e.lengthComputable && onp) onp(e.loaded / e.total); };
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} if (x.status >= 200 && x.status < 300 && j.url) res(j.url); else { const e = new Error(j.hata || 'Video yüklenemedi.'); e.status = x.status; rej(e); } };
    x.onerror = () => rej(new Error('Video yüklenemedi. İnternet bağlantınızı kontrol edin.'));
    x.send(blob);
  });
}

// ---------- Başlık yardımı: sesle yazma + öneriler ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let REC = null;
const micBtn = (id) => (SR ? `<button type="button" class="mic" data-mic="${id}" aria-label="Sesle yaz">${MIC}<span>Sesle yaz</span></button>` : '');
const bas1 = (x) => (x ? x.charAt(0).toLocaleUpperCase('tr-TR') + x.slice(1) : x);
function micStop() { if (!REC) return; const r = REC; REC = null; r.onend = r.onresult = r.onerror = null; try { r.abort(); } catch {} }
function micBind(A) {
  A.querySelectorAll('[data-mic]').forEach((b) => (b.onclick = () => {
    if (REC) { const was = REC._b === b; REC.stop(); if (was) return; }
    const el = document.getElementById(b.dataset.mic), ta = el.tagName === 'TEXTAREA';
    const r = new SR(); r.lang = 'tr-TR'; r.interimResults = true; r.continuous = ta; r.maxAlternatives = 1; r._b = b;
    const base = el.value.trim() ? el.value.replace(/\s*$/, ta ? '\n' : ' ') : '';
    let fin = '';
    r.onresult = (e) => {
      let im = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t.trim() + ' '; else im += t; }
      let v = base + bas1((fin + im).replace(/\s+/g, ' ').trimStart());
      if (!ta) v = v.trim();
      el.value = v.slice(0, el.maxLength > 0 ? el.maxLength : 3000); el.dispatchEvent(new Event('input'));
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofona izin verin.'); else if (e.error === 'no-speech') toast('Ses algılanamadı, tekrar deneyin.'); else if (e.error === 'network') toast('Sesle yazma için internet gerekli.'); };
    r.onend = () => { if (REC === r) REC = null; b.classList.remove('on'); b.querySelector('span').textContent = 'Sesle yaz'; if (!ta && el.value) el.value = el.value.replace(/[.\s]+$/, ''); wsync(); draft(); };
    try { r.start(); REC = r; b.classList.add('on'); b.querySelector('span').textContent = 'Dinliyorum… bitirmek için dokunun'; el.focus({ preventScroll: true }); }
    catch { toast('Sesle yazma başlatılamadı.'); }
  }));
}
const mahK = (m) => { const x = String(m || '').replace(/\s+(Mahallesi|Mahalle|Mah\.?|Mh\.?)$/i, '').trim(); return x ? x + ' Mah.' : ''; };
const turAd = (t) => (t === 'Müstakil' ? 'Müstakil Ev' : t);
const nf = (n) => Number(n).toLocaleString('tr-TR');
function oneriler() {
  const out = [], add = (x) => { x = x.replace(/\s+/g, ' ').trim(); if (x.length >= 5 && x.length <= 80 && !out.includes(x)) out.push(x); };
  const tip = W.tip, tur = turAd(W.tur), yer1 = W.mah ? mahK(W.mah) : W.ilce || W.il, yer2 = [W.ilce, mahK(W.mah)].filter(Boolean).join(' ');
  const m2 = W.m2 ? nf(W.m2) + ' m²' : '';
  if (ARSA(W.tur)) {
    add(`${yer2 || yer1} ${m2} ${tip} ${tur}`);
    if (tip === 'Satılık') add(`Yatırımlık ${m2} ${tip} ${tur}`);
    add(`${W.il || ''} ${W.ilce || ''} ${tip} ${m2} ${tur}`);
    if (W.mah) add(`${mahK(W.mah)} ${tip} ${tur}`);
  } else if (ISY(W.tur)) {
    const f = ['Cadde üzeri', 'Köşe başı', 'Vitrinli'].filter((o) => (W.oz || []).includes(o));
    add(`${yer1} ${tip} ${m2} ${tur}`);
    if (f.length) add(`${f[0]} ${f[1] ? f[1] + ' ' : ''}${tip} ${tur}`);
    add(`${yer2} ${f[0] || ''} ${m2} ${tip} ${tur}`);
    add(`${W.ilce || W.il} ${tip} ${tur}`);
  } else {
    const ad = { Havuz: 'Havuzlu', Güvenlik: 'Güvenlikli', Eşyalı: 'Eşyalı', Otopark: 'Otoparklı', Balkon: 'Balkonlu' };
    const f = ['Havuz', 'Güvenlik', 'Eşyalı', 'Otopark', 'Balkon'].filter((o) => (W.oz || []).includes(o)).map((o) => ad[o]);
    if (W.as && !['Villa', 'Müstakil'].includes(W.tur)) f.push('Asansörlü');
    const yeni = +W.yas === 0 ? 'Sıfır ' : '';
    add(`${yer1} ${W.oda} ${tip} ${tur}`);
    if (f.length) add(`${f.slice(0, 2).join(' ')} ${W.oda} ${tip} ${tur}`);
    add(`${yer2} ${yeni}${m2} ${W.oda} ${tip} ${tur}`);
    if (yeni || f.length) add(`${yer1} ${yeni}${f[0] || ''} ${W.oda} ${tur}`);
    add(`${W.ilce || W.il} ${W.oda} ${tip} ${tur}`);
  }
  return out.slice(0, 4);
}
function taslak() {
  const ar = ARSA(W.tur), lo = (x) => String(x).toLocaleLowerCase('tr-TR');
  const yr = [mahK(W.mah), W.ilce, W.il].filter(Boolean).join(', ');
  const ln = [`${yr ? yr + ' konumunda ' : ''}${lo(W.tip)} ${ar || ISY(W.tur) ? '' : W.oda + ' '}${lo(turAd(W.tur))}.`, ''];
  if (W.m2) ln.push(`• ${ar ? 'Arsa alanı' : 'Brüt alan'}: ${nf(W.m2)} m²`);
  if (!ar) {
    if (!ISY(W.tur)) ln.push(`• Oda sayısı: ${W.oda}`);
    if (!['Villa', 'Müstakil'].includes(W.tur)) ln.push(`• Bulunduğu kat: ${kv('kat', W.kat)}`);
    ln.push(`• Bina yaşı: ${+W.yas ? W.yas + ' yıl' : 'Yeni bina'}`);
    ln.push(`• Asansör: ${W.as ? 'Var' : 'Yok'}`);
    if ((W.oz || []).length) ln.push(`• Özellikler: ${W.oz.join(', ')}`);
  }
  if (W.f) ln.push(`• Fiyat: ${TL(W.f)}${W.tip === 'Kiralık' ? ' / ay' : ''}`);
  ln.push('', 'Detaylı bilgi almak ve yerinde görmek için bizi arayabilirsiniz.');
  return bas1(ln.join('\n'));
}

function vidSec() {
  const has = W._vb || W.v;
  let in_ = '';
  if (W._vbusy) in_ = `<div class="vbusy"><div class="pg"><i id="w-vp" style="width:0"></i></div><b id="w-vt">Video hazırlanıyor…</b><p class="mu" style="margin:6px 0 0;font-size:13px">Video küçültülüyor; video süresi kadar sürer. Bu sırada ekranı açık tutun ve sayfadan çıkmayın.</p></div>`;
  else if (has) in_ = `<div class="vprev"><video src="${esc(W._vu || W.v)}" controls playsinline preload="metadata"></video><div class="vmeta"><span>${W._vb ? `Hazır · ${MB(W._vb.size)}${W._vd ? ' · ' + mmss(W._vd) : ''} · yayınlarken yüklenecek` : 'Yüklü video'}</span><button type="button" class="lnk" id="w-vx">Videoyu kaldır</button></div></div>`;
  else in_ = `<div class="pb"><button type="button" class="pbb" id="w-vr">${VID}Video çek<small>720p · en fazla 3 dk</small></button><label>${GAL}Galeriden video<small>Otomatik küçültülür</small><input type="file" accept="video/*" id="w-vg"></label></div>`;
  return `<div class="vsec"><h3>Video <small>isteğe bağlı · 1 video · en fazla 3 dakika</small></h3>${in_}<input type="file" accept="video/*" capture="environment" id="w-vf" hidden></div>`;
}
function vidBind(A, er) {
  const pick = async (inp) => {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v|3gp)$/i.test(f.name)) return er('Lütfen bir video dosyası seçin.');
    wsync(); W._vbusy = 1; wiz();
    try {
      const r = await compressVideo(f, (p) => { const b = $('#w-vp'), t = $('#w-vt'); if (b) b.style.width = Math.round(p * 100) + '%'; if (t) t.textContent = `Video küçültülüyor %${Math.round(p * 100)}`; });
      if (!W) return;
      setVid(r.blob); W._vd = isFinite(r.dur) ? Math.round(r.dur) : 0;
      W._vbusy = 0; if (ws === 1) wiz();
      toast(`Video eklendi (${MB(f.size)} → ${MB(r.blob.size)})`);
    } catch (e) { if (!W) return; W._vbusy = 0; if (ws === 1) { wiz(); $('#w-e').textContent = e.message; } else toast(e.message); }
  };
  if ($('#w-vg')) $('#w-vg').onchange = (e) => pick(e.target);
  if ($('#w-vf')) $('#w-vf').onchange = (e) => pick(e.target);
  if ($('#w-vr')) $('#w-vr').onclick = () => { wsync(); vidRec(); };
  if ($('#w-vx')) $('#w-vx').onclick = () => { if (!confirm('Video kaldırılsın mı?')) return; wsync(); setVid(null); W.v = ''; W._vd = 0; draft(); wiz(); };
}

function wiz() {
  micStop();
  const s = ws, ar = ARSA(W.tur);
  let body = '';
  if (s === 0) body = `<h2>İlan başlığı</h2><p class="mu" style="margin:0">Kısa ve dikkat çekici olsun. Örnek: Deniz manzaralı 3+1 daire</p><div class="tip0">💡 Şimdi yazmak zorunda değilsiniz. Boş bırakırsanız son adımda, girdiğiniz bilgilere göre hazır başlık önerileri çıkar; birine dokunmanız yeterli.</div><div class="fld"><div class="fh"><span>Başlık (isteğe bağlı)</span>${micBtn('w-t')}</div><input id="w-t" maxlength="80" placeholder="İlan başlığı" value="${esc(W.t)}" enterkeyhint="next"><div class="mu" style="text-align:right;font-size:12px;margin-top:4px"><span id="w-c">${W.t.length}</span>/80</div></div><div class="fld"><span>İlan tipi</span>${ch('tip', ['Satılık', 'Kiralık'])}</div>`;
  if (s === 1) body = `<h2>Fotoğraflar</h2><p class="mu" style="margin:0">En fazla 15 fotoğraf. İlk fotoğraf vitrin görseli olur.</p>${fotoOk ? '' : '<p class="err">Fotoğraf depolama henüz etkin değil; ilan şu an kaydedilemez.</p>'}<div class="pb"><button type="button" class="pbb" id="w-camb">${CAM}Kamerayla çek<small>Art arda çekin</small></button><label>${GAL}Galeriden seç<small>Birden fazla seçin</small><input type="file" accept="image/*" multiple id="w-gal"></label><input type="file" accept="image/*" capture="environment" multiple id="w-cam" hidden></div><div id="w-st" class="mu" style="margin-top:12px">${W.p.length} / 15 fotoğraf</div><p class="mu" style="font-size:12px;margin:4px 0 0">İpucu: Galeride birden fazla fotoğrafa dokunarak hepsini tek seferde ekleyebilirsiniz. Seçim açılmazsa ilk fotoğrafa basılı tutun.</p><div class="tgrid">${W.p.map((x, i) => `<div class="t" style="background-image:url('${esc(x)}')">${i === 0 ? '<b>Vitrin</b>' : ''}<button type="button" class="x" data-rm="${i}" aria-label="Fotoğrafı kaldır">✕</button>${i ? `<button type="button" class="cv" data-cv="${i}">Vitrin yap</button>` : ''}</div>`).join('')}</div>${vidSec()}`;
  if (s === 2) body = `<h2>İlan bilgileri</h2><div class="fld"><span>Emlak türü</span>${ch('tur', TUR)}</div><div class="fld"><span>Fiyat (₺)${W.tip === 'Kiralık' ? ' / aylık' : ''}</span><input id="w-f" inputmode="numeric" placeholder="Örn. 2.500.000" value="${W.f ? Number(W.f).toLocaleString('tr-TR') : ''}"></div><div class="fld"><span>${ar ? 'Arsa alanı' : 'Brüt alan'} (m²)</span><input id="w-m2" inputmode="numeric" placeholder="Örn. 120" value="${W.m2}"></div><div class="fld"><span>Konum</span><button type="button" class="pr gps" id="w-gps">${PIN}Mevcut konumumu kullan</button><div class="mu" id="w-gs" style="margin:8px 0">${W.lat ? 'Konum alındı. Gerekirse aşağıdan düzeltebilirsiniz.' : 'Mülkün yanındaysanız tek dokunuşla adres doldurulur.'}</div><div class="rg"><input id="w-il" placeholder="İl" list="w-ils" value="${esc(W.il)}"><input id="w-ilce" placeholder="İlçe" value="${esc(W.ilce)}"></div><input id="w-mah" placeholder="Mahalle" value="${esc(W.mah)}" style="margin-top:8px"><div class="prv"><span>Açık adres</span><b>Sadece siz görürsünüz</b></div><textarea id="w-adr" rows="2" placeholder="Sokak, bina no, daire (ziyaretçilere gösterilmez)">${esc(W.adr)}</textarea>${W.lat ? `<iframe class="wmap" title="Seçilen konum" loading="lazy" src="${mapEmbed(W.lat, W.lon)}"></iframe>` : ''}<datalist id="w-ils">${[...new Set(['Antalya', 'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Muğla', 'Mersin', 'Aydın', ...L.map((l) => l.il)])].map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>` + (ar ? '' : `${ISY(W.tur) ? '' : `<div class="fld"><span>Oda sayısı</span>${ch('oda', ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1'])}</div>`}<div class="fld"><span>Bulunduğu kat</span>${stp('kat', -2, 60)}</div><div class="fld"><span>Bina yaşı</span>${stp('yas', 0, 100)}</div><div class="fld"><span>Asansör</span><div class="chips"><button type="button" class="chip ${W.as ? 'on' : ''}" data-as="1">Var</button><button type="button" class="chip ${W.as ? '' : 'on'}" data-as="0">Yok</button></div></div><div class="fld"><span>Özellikler</span><div class="chips">${(ISY(W.tur) ? OZ_IS : OZ).map((o) => `<button type="button" class="chip ${W.oz.includes(o) ? 'on' : ''}" data-oz="${o}">${o}</button>`).join('')}</div></div>`);
  if (s === 3) body = `<h2>Başlık ve açıklama</h2><div class="fld"><div class="fh"><span>İlan başlığı</span>${micBtn('w-t')}</div><input id="w-t" maxlength="80" placeholder="Yazın, söyleyin ya da aşağıdan seçin" value="${esc(W.t)}"><div class="mu" style="text-align:right;font-size:12px;margin-top:4px"><span id="w-c">${W.t.length}</span>/80</div>${(() => { const o = oneriler(); return o.length ? `<div class="sug"><span>Öneriler · dokunup seçin, sonra dilediğiniz gibi düzenleyin</span><div class="chips">${o.map((x) => `<button type="button" class="chip sg ${x === W.t ? 'on' : ''}" data-sg="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>` : ''; })()}</div><div class="fld"><div class="fh"><span>Açıklama</span>${micBtn('w-d')}</div><p class="mu" style="margin:0 0 8px;font-size:13px">Evin öne çıkan yönlerini, çevresini ve ulaşımı anlatın.</p><button type="button" class="lnk dtas" id="w-dt">✨ Bilgilerden açıklama taslağı oluştur</button><textarea id="w-d" rows="8" maxlength="3000" placeholder="Örn. Güney cephe, yeni tadilatlı, okula 5 dakika yürüme mesafesinde...">${esc(W.d)}</textarea></div><details class="ofis" ${W.ms || W.mt || W.yb || W.nt ? 'open' : ''}><summary>Ofis içi takip bilgileri <small>Müşteriye asla gösterilmez</small></summary><div class="fld"><span>Mal sahibi adı</span><input id="w-ms" maxlength="100" value="${esc(W.ms)}" autocomplete="off"></div><div class="fld"><span>Mal sahibi telefonu</span><input id="w-mt" type="tel" maxlength="30" value="${esc(W.mt)}" autocomplete="off"></div><div class="fld"><span>Yetki sözleşmesi bitiş tarihi</span><input id="w-yb" type="date" value="${esc(W.yb)}"><p class="mu" style="margin:6px 0 0;font-size:12px">Bitişe 15 gün kala ilan yönetiminde uyarı çıkar.</p></div><div class="fld"><span>Notlar</span><textarea id="w-nt" rows="3" maxlength="2000" placeholder="Pazarlık payı, anahtar kimde, gösterim saatleri…">${esc(W.nt)}</textarea></div></details><div class="pn" style="margin-top:18px"><h3 style="margin:0 0 12px">Özet</h3><dl class="sum"><dt>Tip</dt><dd>${esc(W.tip)} · ${esc(W.tur)}</dd><dt>Fiyat</dt><dd>${W.f ? TL(W.f) : '-'}</dd><dt>Alan</dt><dd>${W.m2 || '-'} m²</dd><dt>Konum</dt><dd>${yer(W)}</dd>${W.adr ? `<dt>Açık adres</dt><dd>${esc(W.adr)} <span class="mu">(sadece siz)</span></dd>` : ''}${ar ? '' : `${ISY(W.tur) ? '' : `<dt>Oda</dt><dd>${esc(W.oda)}</dd>`}<dt>Kat</dt><dd>${kv('kat', W.kat)}</dd>`}<dt>Fotoğraf</dt><dd>${W.p.length} adet</dd><dt>Video</dt><dd>${W._vb ? 'Var (' + MB(W._vb.size) + ')' : W.v ? 'Var' : 'Yok'}</dd></dl></div>`;
  $('#app').innerHTML = `<div class="wz"><div class="sh"><span>Adım ${s + 1}/4 · ${STEPS[s]}${W._edit ? ' · Düzenleme' : ''}</span><button type="button" id="w-x" style="padding:6px 12px;font-size:13px">Kapat</button></div><div class="pg"><i style="width:${(s + 1) * 25}%"></i></div>${body}<div class="err" id="w-e" role="alert"></div></div><div class="bar">${s ? '<button type="button" id="w-b">Geri</button>' : ''}<button type="button" class="pr" id="w-n">${s === 3 ? (W._edit ? 'Kaydet' : 'İlanı kaydet') : 'Devam'}</button></div>`;
  const A = $('#app'), er = (t) => { $('#w-e').textContent = t; }, re = () => { wsync(); draft(); wiz(); };
  A.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { wsync(); W[b.dataset.k] = b.dataset.v; if (b.dataset.k === 'tur') { const ok = ISY(W.tur) ? OZ_IS : OZ; W.oz = (W.oz || []).filter((o) => ok.includes(o)); } draft(); wiz(); }));
  A.querySelectorAll('[data-as]').forEach((b) => (b.onclick = () => { wsync(); W.as = +b.dataset.as; draft(); wiz(); }));
  A.querySelectorAll('[data-oz]').forEach((b) => (b.onclick = () => { wsync(); const o = b.dataset.oz; W.oz = W.oz.includes(o) ? W.oz.filter((x) => x !== o) : [...W.oz, o]; draft(); wiz(); }));
  A.querySelectorAll('[data-sk]').forEach((b) => (b.onclick = () => { const k = b.dataset.sk; W[k] = Math.max(+b.dataset.a, Math.min(+b.dataset.b, (+W[k] || 0) + +b.dataset.sd)); $('#o-' + k).textContent = kv(k, W[k]); draft(); }));
  A.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { wsync(); W.p.splice(+b.dataset.rm, 1); re(); }));
  A.querySelectorAll('[data-cv]').forEach((b) => (b.onclick = () => { wsync(); const [x] = W.p.splice(+b.dataset.cv, 1); W.p.unshift(x); re(); }));
  if ($('#w-t')) $('#w-t').oninput = (e) => { $('#w-c').textContent = e.target.value.length; A.querySelectorAll('[data-sg]').forEach((c) => c.classList.toggle('on', c.dataset.sg === e.target.value)); };
  A.querySelectorAll('[data-sg]').forEach((b) => (b.onclick = () => { const t = $('#w-t'); t.value = b.dataset.sg; t.dispatchEvent(new Event('input')); wsync(); draft(); er(''); }));
  if ($('#w-dt')) $('#w-dt').onclick = () => { const d = $('#w-d'); if (d.value.trim() && !confirm('Yazdığınız açıklamanın yerine taslak yazılsın mı?')) return; d.value = taslak(); wsync(); draft(); d.focus(); d.setSelectionRange(0, 0); d.scrollTop = 0; toast('Taslak hazır, dilediğiniz gibi düzenleyin'); };
  if (SR) micBind(A);
  vidBind(A, er);
  if ($('#w-f')) $('#w-f').oninput = (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 12); e.target.value = v ? Number(v).toLocaleString('tr-TR') : ''; };
  const add = async (fl, inp) => {
    const all = [...fl].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)), room = 15 - W.p.length, fs = all.slice(0, room);
    if (inp) inp.value = '';
    if (!room) return er('En fazla 15 fotoğraf ekleyebilirsiniz.');
    if (!fs.length) return;
    let ok = 0, bad = 0;
    for (const [i, f] of fs.entries()) { $('#w-st').textContent = `Fotoğraflar hazırlanıyor ${i + 1} / ${fs.length}…`; const d = await shrink(f); if (d) { W.p.push(d); ok++; } else bad++; }
    re();
    if (all.length > room) toast(`En fazla 15 fotoğraf: ${all.length - room} fotoğraf eklenmedi.`);
    else if (bad) toast(`${bad} fotoğraf okunamadı (desteklenmeyen biçim).`);
    else if (ok > 1) toast(`${ok} fotoğraf eklendi`);
  };
  if ($('#w-gps')) $('#w-gps').onclick = () => { wsync(); gps(); };
  if ($('#w-cam')) $('#w-cam').onchange = (e) => add(e.target.files, e.target);
  if ($('#w-gal')) $('#w-gal').onchange = (e) => add(e.target.files, e.target);
  if ($('#w-camb')) $('#w-camb').onclick = () => { if (W.p.length >= 15) return er('En fazla 15 fotoğraf ekleyebilirsiniz.'); wsync(); camOpen(); };
  $('#w-x').onclick = () => { if (W._vbusy && !confirm('Video hâlâ hazırlanıyor. Çıkarsanız video eklenmez. Çıkılsın mı?')) return; W._vbusy = 0; setVid(null); wsync(); if (!W._edit) { draft(); toast('Taslak kaydedildi'); } W = null; panel(); };
  if ($('#w-b')) $('#w-b').onclick = () => { if (W._vbusy) return er('Video hazırlanıyor, lütfen bitmesini bekleyin.'); wsync(); ws--; draft(); wiz(); scrollTo(0, 0); };
  $('#w-n').onclick = async () => {
    wsync();
    if (W._vbusy) return er('Video hazırlanıyor, lütfen bitmesini bekleyin.');
    if (s === 0 && W.t.trim() && W.t.trim().length < 5) return er('Başlık en az 5 karakter olmalı ya da boş bırakın.');
    if (s === 3 && W.t.trim().length < 5) { $('#w-t').focus(); return er('İlan başlığını yazın ya da önerilerden birine dokunun (en az 5 karakter).'); }
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
    if (W._vb) {
      btn.textContent = 'Video yükleniyor %0…';
      W.v = await upVid(W._vb, (p) => { btn.textContent = `Video yükleniyor %${Math.round(p * 100)}…`; });
      setVid(null); draft();
    }
    btn.textContent = 'Kaydediliyor…';
    const body = JSON.parse(JSON.stringify(W, wrep));
    const l = W._edit
      ? await api('/listings/' + W._edit, { method: 'PUT', body })
      : await api('/listings', { method: 'POST', body });
    const nw = !W._edit;
    nod(); setVid(null); W = null; MY = null;
    await refreshPublic();
    toast(nw ? 'İlan kaydedildi' : 'Kaydedildi');
    go(l.url);
  } catch (e) {
    btn.disabled = false; btn.textContent = W && W._edit ? 'Kaydet' : 'İlanı kaydet';
    if (e.status === 401) { toast('Oturumunuz kapanmış. Tekrar giriş yapın; taslağınız saklandı.'); me = null; renderNav(); W = null; return go('/giris'); }
    er(e.message);
  }
}

// ---------- Yönetim ----------
const YETKI = [['danisman', 'Danışman', 'Portföyü görür ve müşterilere gönderir; yalnızca kendi ilanlarını düzenler.'], ['yetkili', 'Yetkili danışman', 'Tüm ilanları düzenler, durumunu değiştirir ve siler; ofis içi bilgileri görür.'], ['admin', 'Yönetici', 'Tüm ilanlar + kullanıcılar ve site ayarları.']];
const yetkiOf = (u) => (u.rol === 'admin' ? 'admin' : u.tum_ilan ? 'yetkili' : 'danisman');
const yetkiAd = (y) => (YETKI.find((x) => x[0] === y) || YETKI[0])[1];
async function admin() {
  if (!me) return needLogin();
  if (me.rol !== 'admin') return errBox('Bu sayfa yalnızca yöneticiler içindir.');
  setTitle('Kullanıcılar');
  if (!USERS) { loading(); try { USERS = await api('/users'); } catch (e) { return errBox(e.message); } if (cur !== '/yonetim') return; }
  const sel = (u) => `<select data-uy="${u.id}" aria-label="${esc(u.ad)} yetkisi">${YETKI.map(([v, t]) => `<option value="${v}" ${yetkiOf(u) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const rows = USERS.map((u) => `<tr><td><b>${esc(u.ad)}</b>${u.aktif ? '' : ' <span class="tg" style="border-color:#ff8b8b;color:#ff8b8b">Pasif</span>'}<div class="mu">${esc(u.mail)}${u.tel ? ' · ' + esc(u.tel) : ''}</div></td><td>${u.id === me.id ? `${yetkiAd(yetkiOf(u))} <span class="mu">(siz)</span>` : sel(u)}</td><td>${u.ilan}</td><td style="white-space:nowrap">${u.id === me.id ? '' : `<button data-ua="${u.id}">${u.aktif ? 'Devre dışı bırak' : 'Etkinleştir'}</button> <button data-up="${u.id}">Şifre sıfırla</button>`}</td></tr>`).join('');
  $('#app').innerHTML = `<div class="w"><h2>Kullanıcılar</h2><div class="yl">${YETKI.map(([, t, d]) => `<div class="pn"><b>${t}</b><div class="mu">${d}</div></div>`).join('')}</div><div class="pn tw" style="margin-top:14px"><table><tr><th>Kullanıcı</th><th>Yetki</th><th>İlan</th><th></th></tr>${rows}</table></div>
  <form id="uf" class="pn" style="margin-top:16px"><h3 style="margin:0">Yeni kullanıcı ekle</h3><p class="mu" style="margin:4px 0 0">Belirlediğiniz ilk şifreyi kişiye iletin; giriş yaptıktan sonra Hesabım sayfasından değiştirebilir.</p><div class="fm"><input name="ad" placeholder="Ad soyad" required><input name="mail" type="email" placeholder="E-posta" required><input name="tel" type="tel" placeholder="Telefon"><select name="yetki">${YETKI.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select><input name="sifre" type="password" autocomplete="new-password" minlength="8" placeholder="İlk şifre (en az 8 karakter)" required><button class="pr">Kullanıcı ekle</button></div><div class="err" id="ue" role="alert"></div></form>
  <p class="mu">Tüm ilanları <a href="/panel" style="color:var(--au)">İlan yönetimi → Tüm ilanlar</a> sekmesinden yönetebilirsiniz.</p></div>`;
  const patch = async (id, body, msg) => { try { await api('/users/' + id, { method: 'PATCH', body }); USERS = await api('/users'); MY = null; await refreshPublic(); toast(msg); } catch (e) { toast(e.message); } admin(); };
  document.querySelectorAll('[data-uy]').forEach((s) => (s.onchange = () => { const u = USERS.find((x) => x.id == s.dataset.uy); if (confirm(`${u.ad} için yetki "${yetkiAd(s.value)}" olarak değiştirilsin mi?`)) patch(u.id, { yetki: s.value }, 'Yetki değiştirildi'); else s.value = yetkiOf(u); }));
  document.querySelectorAll('[data-ua]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.ua); patch(u.id, { aktif: !u.aktif }, u.aktif ? 'Kullanıcı devre dışı bırakıldı' : 'Kullanıcı etkinleştirildi'); }));
  document.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.up); const p = prompt(`${u.ad} için yeni şifre (en az 8 karakter). Kişinin açık oturumları kapatılır.`); if (p) patch(u.id, { sifre: p }, 'Şifre sıfırlandı'); }));
  $('#uf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/users', { method: 'POST', body: d }); USERS = await api('/users'); toast('Kullanıcı eklendi'); admin(); } catch (err) { $('#ue').textContent = err.message; } };
}

function settings() {
  if (!me) return needLogin();
  if (me.rol !== 'admin') return errBox('Bu sayfa yalnızca yöneticiler içindir.');
  const f = (k, l) => `<label>${l}<input name="${k}" value="${esc(SS[k])}"></label>`;
  $('#app').innerHTML = `<div class="w"><h2>Site ayarları</h2><div class="pn"><form id="sf2"><div class="fm">${f('hero', 'Ana sayfa başlığı (örn. Aradığınız evi anlatın, biz bulalım.)')}${f('sub', 'Ana sayfa alt metni')}${f('bolge', 'Hizmet bölgeleri (virgülle ayırın)')}${f('tel', 'Telefon')}${f('mail', 'E-posta')}${f('adr', 'Adres (sayfada yazı olarak gösterilir)')}${f('harita', 'Google Haritalar işletme bağlantısı')}${f('saat', 'Çalışma saatleri')}</div><p class="mu" style="margin:10px 0 0">📍 Harita için: Google Haritalar'da işletmenizi açın → <b>Paylaş</b> → <b>Bağlantıyı kopyala</b> ve yukarıdaki "Google Haritalar işletme bağlantısı" alanına yapıştırın. İletişim sayfasındaki harita ve "Yol tarifi al" düğmesi doğrudan işletme kaydınızı gösterir.${SS.harita_e ? ' <b style="color:#1f9d55">✓ Harita bağlı</b>' : ''}</p><div class="mu" style="margin-top:14px">Ana sayfa görseli (isteğe bağlı; yatay bir ofis ya da ev fotoğrafı)</div><div class="sfo">${SS.foto ? `<img src="${esc(SS.foto)}" alt="">` : '<span class="mu">Görsel yok</span>'}<label class="pill">${SS.foto ? 'Değiştir' : 'Görsel seç'}<input type="file" accept="image/*" id="sfi" hidden></label>${SS.foto ? '<button type="button" class="pill" id="sfx">Kaldır</button>' : ''}</div><label class="mu" style="display:grid;gap:4px;margin-top:12px">Hakkımızda metni (paragraflar arasında boş satır bırakın)<textarea name="hak" style="min-height:160px">${esc(SS.hak)}</textarea></label><p><button class="pr">Kaydet</button></p></form></div></div>`;
  const setFoto = async (v) => { try { await api('/settings', { method: 'PUT', body: { foto: v } }); SS.foto = v; toast(v ? 'Görsel kaydedildi' : 'Görsel kaldırıldı'); settings(); } catch (err) { toast(err.message); } };
  $('#sfi').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast('Görsel yükleniyor…'); const d = await shrink(f); if (!d) return toast('Görsel okunamadı'); try { const r = await api('/photos', { method: 'POST', raw: await (await fetch(d)).blob(), type: 'image/jpeg' }); await setFoto(r.url); } catch (err) { toast(err.message); } };
  if ($('#sfx')) $('#sfx').onclick = () => setFoto('');
  $('#sf2').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/settings', { method: 'PUT', body: d }); SS = await api('/settings'); renderFooter(); toast('Ayarlar kaydedildi'); settings(); } catch (err) { toast(err.message); } };
}

// ---------- Yönlendirme ----------
const pathOf = () => location.pathname.replace(/\/+$/, '') || '/';
const fromHash = (h) => { h = String(h).replace(/^#/, ''); const m = /^ilan-(\d+)$/.exec(h); if (m) return '/ilan/' + (NO_OFFSET + Number(m[1])); return !h || h === 'ana' ? '/' : '/' + h; };
let cur = pathOf();
function go(p, replace = false) {
  p = String(p); if (p.startsWith('#')) p = fromHash(p);
  if (p !== location.pathname + location.search) { try { history[replace ? 'replaceState' : 'pushState'](null, '', p); } catch {} }
  cur = pathOf(); route(); scrollTo(0, 0);
}
function route() {
  const h = cur;
  renderNav();
  document.body.classList.toggle('tlp', h === '/talep');
  if (LB && !document.getElementById('lb')) LB = null;
  document.onkeydown = null;
  document.querySelectorAll('nav a.l').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === h));
  const m = /^\/ilan\/(\d+)/.exec(h);
  if (m) return detail(m[1]);
  const pm = /^\/p\/([A-Za-z0-9_-]{16,40})$/.exec(h);
  if (pm) return musteri(pm[1]);
  if (h === '/') setTitle('');
  if (h === '/panel') panel();
  else if (h === '/yonetim') admin();
  else if (h === '/ayarlar') { setTitle('Site ayarları'); settings(); }
  else if (h === '/ilanlar') { setTitle('Portföy'); ilanlar(); }
  else if (h === '/talep') { if (new URLSearchParams(location.search).get('amac')) TQ = null; talep(); }
  else if (h === '/hakkimizda') { setTitle('Hakkımızda'); about(); }
  else if (h === '/iletisim') { setTitle('İletişim'); contact(); }
  else if (h === '/giris') { setTitle('Ekip girişi'); giris(); }
  else if (h === '/hesap') { setTitle('Hesabım'); hesap(); }
  else if (h === '/') home();
  else { setTitle('Sayfa bulunamadı'); errBox('Aradığınız sayfa bulunamadı.'); }
}
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  const href = a.getAttribute('href');
  if (href.startsWith('#')) { e.preventDefault(); return go(fromHash(href)); }
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/img/') || /\.[a-z0-9]{2,5}$/i.test(href)) return;
  e.preventDefault(); go(href);
});
addEventListener('popstate', () => {
  if (LB) { LB(); return; }
  cur = pathOf(); route();
});

function renderFooter() {
  const tel = (SS.tel || '').trim(), it = [];
  if (tel) it.push(`<li><a href="tel:${esc(tel)}">${esc(tel)}</a></li>`);
  if (SS.mail) it.push(`<li><a href="mailto:${esc(SS.mail)}">${esc(SS.mail)}</a></li>`);
  if (SS.adr) it.push(`<li><a href="${esc(harLink())}" target="_blank" rel="noopener">${esc(SS.adr)}</a></li>`);
  if (SS.saat) it.push(`<li class="mu">${esc(SS.saat)}</li>`);
  $('#ftc').innerHTML = it.join('') || '<li><a href="/iletisim">İletişim bilgileri</a></li>';
  $('#fty').textContent = new Date().getFullYear();
}
$('#mb').onclick = () => { const o = $('#nav').classList.toggle('open'); $('#mb').setAttribute('aria-expanded', String(o)); document.body.style.overflow = o ? 'hidden' : ''; };
async function boot(render = true) {
  const [m, s] = await Promise.all([api('/me'), api('/settings')]);
  me = m.user; kurulum = m.kurulum; fotoOk = m.foto; SS = s; MY = USERS = null;
  await refreshPublic();
  renderFooter();
  if (render) route(); else renderNav();
}
if (location.hash && location.pathname === '/') { try { history.replaceState(null, '', fromHash(location.hash)); } catch {} cur = pathOf(); }
if (!$('#app').children.length) loading();
boot().catch((e) => errBox(e.message));
