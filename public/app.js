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
const canAll = () => !!me && (me.rol === 'admin' || !!me.tumIlan);
const own = (l) => !!me && (canAll() || l.u === me.id);
const NO_OFFSET = 100000;
const setTitle = (t) => { document.title = t ? `${t} | Asya Emlak` : 'Asya Emlak | Satılık ve Kiralık Daire, Villa, Arsa İlanları'; };
// Favoriler (bu cihazda saklanır)
let FAV = (() => { try { return (JSON.parse(localStorage.getItem('asya-fav') || '[]') || []).map(Number).filter(Boolean); } catch { return []; } })();
const saveFav = () => { try { localStorage.setItem('asya-fav', JSON.stringify(FAV)); } catch {} renderNav(); };
const isFav = (id) => FAV.includes(id);
function toggleFav(id) {
  FAV = isFav(id) ? FAV.filter((x) => x !== id) : [id, ...FAV]; saveFav();
  document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => { b.classList.toggle('on', isFav(id)); b.setAttribute('aria-pressed', isFav(id)); const sp = b.querySelector('span'); if (sp) sp.textContent = isFav(id) ? 'Favorilerde' : 'Favorilere ekle'; });
  toast(isFav(id) ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
  if (cur === '/favoriler') favoriler();
}

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
  $('#pl').textContent = canAll() ? 'İlan yönetimi' : 'İlanlarım';
  const fc = $('#fcn'); if (fc) fc.textContent = FAV.length ? String(FAV.length) : '';
  $('#nav').classList.remove('open'); $('#mb').setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
}

// ---------- Kartlar ----------
function card(l) {
  return `<div class="cdw"><a class="cd" href="${esc(l.url)}"><div class="cimg">${ph(l.p[0])}<span class="ctg">${esc(l.tip)}</span></div><div class="b"><div class="pc">${fiyat(l)}</div><div class="ct">${esc(l.t)}</div><div class="mu">${yer(l)}</div><div class="sp2"><span>${l.m2} m²</span>${ARSA(l.tur) ? `<span>${esc(l.tur)}</span>` : `<span>${esc(l.oda)}</span><span>${kt(l)}</span><span>${l.as ? 'Asansörlü' : 'Asansörsüz'}</span>`}</div></div></a>${favBtn(l)}</div>`;
}

const R = () => { F = { tip: '', q: '', pmin: '', pmax: '', amin: '', amax: '', oda: [], kat: '', as: '', s: F.s, tur: '', yas: '', oz: [], il: '' }; };
// ---------- Ana sayfa ----------
const SRCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>';
const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CAT_IC = {
  Daire: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="4" width="18" height="24" rx="1.5"/><path d="M11 9h3M18 9h3M11 14h3M18 14h3M11 19h3M18 19h3M14 28v-4h4v4"/></svg>',
  Villa: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 15l9-7 9 7"/><path d="M5 13.5V26h14V13.5"/><path d="M19 18h10v8H19"/><path d="M10 26v-6h4v6M3 29h26"/></svg>',
  Müstakil: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15L16 5l12 10"/><path d="M7 12.5V27h18V12.5"/><path d="M13 27v-7h6v7"/><path d="M22 7v4"/></svg>',
  Dubleks: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 13L16 5l11 8"/><path d="M7 11.5V27h18V11.5"/><path d="M7 19h18"/><path d="M11 14h3M18 14h3M14 27v-4h4v4"/></svg>',
  Arsa: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 23l8-7 6 5 5-4 7 6"/><path d="M3 27h26"/><path d="M22 5v8M22 5l5 2-5 2"/></svg>',
};
let HXT = 0;
function home() {
  setTitle('');
  const a = L, n = a.length;
  const shots = a.filter((l) => typeof l.p[0] === 'string').slice(0, 4);
  const cnt = (f) => a.filter(f).length;
  const cats = [['Daire', cnt((l) => l.tur === 'Daire')], ['Villa', cnt((l) => l.tur === 'Villa')], ['Müstakil', cnt((l) => l.tur === 'Müstakil')], ['Dubleks', cnt((l) => l.tur === 'Dubleks')], ['Arsa', cnt((l) => ARSA(l.tur))]];
  const reg = [...a.reduce((m, l) => { const k = l.ilce + '|' + l.il; m.set(k, (m.get(k) || 0) + 1); return m; }, new Map())].sort((x, y) => y[1] - x[1]).slice(0, 8);
  const tel = (SS.tel || '').trim(), wa = tel.replace(/\D/g, '').replace(/^0/, '').replace(/^90/, '');
  $('#app').innerHTML = `<section class="hx ${shots.length ? '' : 'light'}"><div class="hxbg ${shots.length ? '' : 'empty'}" id="hxbg">${shots.map((l, i) => `<img src="${esc(l.p[0])}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} class="${i ? '' : 'on'}" decoding="async">`).join('')}</div>
   <div class="hxc"><h1>${esc(SS.hero || 'Yaşamak istediğiniz evi birlikte bulalım.')}</h1><p>${esc(SS.sub)}</p>
    <form class="sx" id="hs" role="search"><div class="seg" role="group" aria-label="İlan tipi"><button type="button" data-tip="" class="on">Tümü</button><button type="button" data-tip="Satılık">Satılık</button><button type="button" data-tip="Kiralık">Kiralık</button></div><select name="tur" aria-label="Emlak türü"><option value="">Tüm türler</option>${['Daire', 'Villa', 'Müstakil', 'Dubleks', 'Arsa'].map((t) => `<option>${t}</option>`).join('')}</select><input name="q" placeholder="İl, ilçe, mahalle veya ilan no" aria-label="Konum veya ilan numarası" enterkeyhint="search"><button class="go">${SRCH}<span>Ara</span></button></form>
    <div class="hxm"><span><b>${n}</b> güncel ilan${DAN ? ` · <b>${DAN}</b> danışman` : ''}</span>${shots.length ? `<span style="display:flex;align-items:center;gap:14px;min-width:0"><a class="hxcap" id="hxcap" href="${esc(shots[0].url)}"><span>${esc(shots[0].t)} · ${fiyat(shots[0])}</span>${ARR}</a>${shots.length > 1 ? `<span class="dots">${shots.map((_, i) => `<button type="button" data-hx="${i}" class="${i ? '' : 'on'}" aria-label="Fotoğraf ${i + 1}"></button>`).join('')}</span>` : ''}</span>` : ''}</div>
   </div></section>
  <section class="sec"><div class="sech"><div><h2>Ne arıyorsunuz?</h2><p>Emlak türüne göre ilanlara göz atın.</p></div></div><div class="cats">${cats.map(([t, c]) => `<button type="button" class="cat" data-cat="${t}">${CAT_IC[t]}<span><b>${t === 'Arsa' ? 'Arsa ve tarla' : t}</b><span>${c ? c + ' ilan' : 'Yakında'}</span></span></button>`).join('')}</div></section>
  <section class="sec"><div class="sech"><div><h2>Yeni ilanlar</h2><p>Danışmanlarımızın son eklediği ilanlar.</p></div>${n ? `<a href="/ilanlar">Tümünü gör ${ARR}</a>` : ''}</div>${n ? `<div class="rail">${a.slice(0, 6).map(card).join('')}</div>` : '<div class="pn mu">Henüz yayında ilan yok. Danışmanlarımız ilan ekledikçe burada görünecek.</div>'}</section>
  ${reg.length ? `<section class="sec"><div class="sech"><div><h2>Bölgeler</h2><p>İlanların bulunduğu ilçeler.</p></div></div><div class="rgn">${reg.map(([k, c]) => { const [ilce, il] = k.split('|'); return `<button type="button" class="rgi" data-rg="${esc(k)}"><span><b>${esc(ilce)}</b><small>${esc(il)}</small></span><i>${c} ilan ›</i></button>`; }).join('')}</div></section>` : ''}
  <section class="band"><div class="bandi"><div><h2>Mülkünüzü satmak ya da kiraya vermek mi istiyorsunuz?</h2><p>Danışmanlarımızla görüşün; mülkünüzü doğru fiyatla, doğru kişilere ulaştıralım.</p></div><div class="bbtn">${tel ? `<a class="g" href="tel:${esc(tel)}">${PHONE} ${esc(tel)}</a>` : ''}${wa ? `<a class="wa" href="https://wa.me/90${esc(wa)}" target="_blank" rel="noopener">${WAI} WhatsApp ile yazın</a>` : ''}<a href="/iletisim">İletişim bilgileri ${ARR}</a></div></div></section>`;

  // vitrin
  let tip = '';
  document.querySelectorAll('[data-tip]').forEach((b) => (b.onclick = () => { tip = b.dataset.tip; document.querySelectorAll('[data-tip]').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#hs').onsubmit = (e) => {
    e.preventDefault();
    const d = new FormData(e.target), q = String(d.get('q') || '').trim();
    const byNo = /^\d{6}$/.test(q) && L.find((l) => String(l.no) === q);
    if (byNo) return go(byNo.url);
    R(); F.tip = tip; F.tur = d.get('tur') || ''; F.q = q; go('/ilanlar');
  };
  document.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { R(); F.tur = b.dataset.cat; go('/ilanlar'); }));
  document.querySelectorAll('[data-rg]').forEach((b) => (b.onclick = () => { const [ilce, il] = b.dataset.rg.split('|'); R(); F.il = il; F.q = ilce; go('/ilanlar'); }));
  clearInterval(HXT);
  if (shots.length > 1) {
    let i = 0;
    const show = (k) => {
      i = (k + shots.length) % shots.length;
      document.querySelectorAll('#hxbg img').forEach((im, j) => { if (j === i) { im.classList.remove('on'); void im.offsetWidth; } im.classList.toggle('on', j === i); });
      document.querySelectorAll('[data-hx]').forEach((d, j) => d.classList.toggle('on', j === i));
      const c = $('#hxcap'); if (c) { c.href = shots[i].url; c.querySelector('span').textContent = `${shots[i].t} · ${fiyat(shots[i])}`; }
    };
    document.querySelectorAll('[data-hx]').forEach((d) => (d.onclick = () => { show(+d.dataset.hx); clearInterval(HXT); }));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) HXT = setInterval(() => { if (!document.hidden && $('#hxbg')) show(i + 1); else if (!$('#hxbg')) clearInterval(HXT); }, 6500);
  }
}

// ---------- İlanlar ve filtre ----------
function filt() {
  const q = (F.q || '').toLocaleLowerCase('tr'), oz = F.oz || [];
  const r = L.filter((l) => (!F.tip || l.tip === F.tip) && (!F.il || l.il === F.il) && (!F.tur || l.tur === F.tur || (F.tur === 'Arsa' && ARSA(l.tur)))
    && (!F.pmin || l.f >= +F.pmin) && (!F.pmax || l.f <= +F.pmax) && (!F.amin || l.m2 >= +F.amin) && (!F.amax || l.m2 <= +F.amax)
    && (!F.oda.length || F.oda.includes(String(Math.min(parseInt(l.oda) || 0, 4))))
    && (!F.kat || (F.kat === 'z' ? l.kat <= 0 : F.kat === '1' ? l.kat >= 1 && l.kat <= 3 : l.kat >= 4))
    && (!F.yas || (F.yas === '0' ? l.yas <= 5 : F.yas === '1' ? l.yas > 5 && l.yas <= 15 : l.yas > 15))
    && (F.as === '' || String(l.as) === F.as) && oz.every((o) => (l.oz || []).includes(o))
    && (l.il + ' ' + l.ilce + ' ' + (l.mah || '') + ' ' + l.t + ' ' + l.no).toLocaleLowerCase('tr').includes(q));
  if (F.s === 'pa') r.sort((a, b) => a.f - b.f);
  if (F.s === 'pd') r.sort((a, b) => b.f - a.f);
  if (F.s === 'm') r.sort((a, b) => b.m2 - a.m2);
  return r;
}
function rs() {
  const r = filt();
  if ($('#ftg')) { const act = ['tip', 'tur', 'il', 'q', 'pmin', 'pmax', 'amin', 'amax', 'yas', 'kat', 'as'].filter((k) => F[k]).length + (F.oda.length ? 1 : 0) + ((F.oz || []).length ? 1 : 0); $('#ftg').lastChild.textContent = 'Filtrele' + (act ? ` (${act})` : ''); }
  $('#rs').innerHTML = `<div class="tp"><span class="mu">${r.length} ilan bulundu</span><select id="so">${[['', 'En yeni'], ['pa', 'Fiyat: artan'], ['pd', 'Fiyat: azalan'], ['m', 'm²: büyükten küçüğe']].map((o) => `<option value="${o[0]}" ${S(F.s, o[0])}>${o[1]}</option>`).join('')}</select></div>${r.length ? `<div class="grid">${r.map(card).join('')}</div>` : `<p class="mu">${L.length ? 'Filtreye uyan ilan yok. Fiyat veya m² aralığını genişletin.' : 'Henüz yayında ilan yok.'}</p>`}`;
  $('#so').onchange = (e) => { F.s = e.target.value; rs(); };
}
const opt = (a, v) => a.map((o) => `<option value="${esc(o[0])}" ${S(v, o[0])}>${esc(o[1])}</option>`).join('');
const chk = (n, a, v) => `<span class="ck">${a.map((o) => `<label><input type="checkbox" name="${n}" value="${esc(o[0])}" ${(v || []).includes(o[0]) ? 'checked' : ''}>${esc(o[1])}</label>`).join('')}</span>`;
function ilanlar() {
  const rg = (a, b) => `<span class="rg"><input name="${a}" type="number" min="0" placeholder="En az" value="${esc(F[a])}"><input name="${b}" type="number" min="0" placeholder="En çok" value="${esc(F[b])}"></span>`;
  const ils = [...new Set(L.map((l) => l.il))].sort((a, b) => a.localeCompare(b, 'tr')).map((x) => [x, x]);
  const act = ['tip', 'tur', 'il', 'q', 'pmin', 'pmax', 'amin', 'amax', 'yas', 'kat', 'as'].filter((k) => F[k]).length + (F.oda.length ? 1 : 0) + ((F.oz || []).length ? 1 : 0);
  $('#app').innerHTML = `<div class="w"><h2>İlanlar</h2><button type="button" class="ftg" id="ftg" aria-expanded="false" aria-controls="fpn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtrele${act ? ` (${act})` : ''}</button><div class="ly"><div id="rs"></div><aside class="pn fp" id="fpn"><form id="ff"><h4 style="margin-top:0">İlan tipi</h4>${chk('tip', [['Satılık', 'Satılık'], ['Kiralık', 'Kiralık']], [F.tip])}<h4>Emlak türü</h4><select name="tur">${opt([['', 'Tümü'], ...TUR.map((t) => [t, t]), ['Arsa', 'Arsa (tarla ve parsel)']], F.tur)}</select><h4>Konum</h4><select name="il">${opt([['', 'Tüm şehirler'], ...ils], F.il)}</select><input name="q" placeholder="İlçe, mahalle, kelime veya ilan no" value="${esc(F.q)}" style="margin-top:8px"><h4>Fiyat aralığı (₺)</h4>${rg('pmin', 'pmax')}<h4>Brüt alan (m²)</h4>${rg('amin', 'amax')}<h4>Oda sayısı</h4>${chk('oda', [['1', '1+1'], ['2', '2+1'], ['3', '3+1'], ['4', '4+']], F.oda)}<h4>Bina yaşı</h4><select name="yas">${opt([['', 'Fark etmez'], ['0', '0 - 5 yaş'], ['1', '6 - 15 yaş'], ['2', '16 ve üzeri']], F.yas)}</select><h4>Bulunduğu kat</h4><select name="kat">${opt([['', 'Fark etmez'], ['z', 'Zemin / giriş'], ['1', '1 - 3. kat'], ['4', '4. kat ve üzeri']], F.kat)}</select><h4>Asansör</h4><select name="as">${opt([['', 'Fark etmez'], ['1', 'Var'], ['0', 'Yok']], F.as)}</select><h4>Özellikler</h4>${chk('oz', OZ.map((o) => [o, o]), F.oz)}<button type="button" id="fc" style="width:100%;margin-top:18px">Filtreleri temizle</button></form></aside></div></div>`;
  const f = $('#ff');
  f.oninput = f.onchange = () => { const d = new FormData(f), t = d.getAll('tip'); F = { ...F, tip: t.length === 1 ? t[0] : '', tur: d.get('tur'), il: d.get('il'), q: d.get('q'), pmin: d.get('pmin'), pmax: d.get('pmax'), amin: d.get('amin'), amax: d.get('amax'), oda: d.getAll('oda'), yas: d.get('yas'), kat: d.get('kat'), as: d.get('as'), oz: d.getAll('oz') }; rs(); };
  $('#fc').onclick = () => { R(); ilanlar(); };
  $('#ftg').onclick = () => { const o = $('#fpn').classList.toggle('open'); $('#ftg').setAttribute('aria-expanded', String(o)); };
  rs();
}

// ---------- İlan detayı ----------
const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.7 3.3 4.5 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"/></svg>';
const PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
const WAI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c.3 2 2.3 4.4 5 5l1.3-1.2 1.7.8-.4 1.6c-3.6.4-8.2-3.6-8.4-7.4L9.8 7.9l.9 1.6z"/></svg>';
const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const favBtn = (l, big) => big
  ? `<button type="button" class="${isFav(l.id) ? 'on' : ''}" data-fav="${l.id}" aria-pressed="${isFav(l.id)}">${HEART}<span>${isFav(l.id) ? 'Favorilerde' : 'Favorilere ekle'}</span></button>`
  : `<button type="button" class="fav ${isFav(l.id) ? 'on' : ''}" data-fav="${l.id}" aria-pressed="${isFav(l.id)}" aria-label="Favorilere ekle">${HEART}</button>`;
const tarih = (t) => (t ? new Date(t * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const initials = (ad) => String(ad || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toLocaleUpperCase('tr')).join('');
const privBox = (l) => `<div class="pn pvb"><div class="prv" style="margin:0 0 8px"><span>Açık adres</span><b>${l.u === me.id ? 'Sadece siz görüyorsunuz' : 'Yalnızca yetkililer görür'}</b></div><p style="margin:0 0 6px">${esc(l.adr) || '<span class="mu">Açık adres girilmemiş.</span>'}</p><p class="mu" style="margin:0">${yer(l)}</p>${l.lat ? `<iframe class="wmap" title="İlan konumu" loading="lazy" src="${mapEmbed(l.lat, l.lon)}"></iframe>` : ''}<div class="sh2"><a href="${mapLink(l)}" target="_blank" rel="noopener"><button type="button" style="width:100%">Haritada aç</button></a><button type="button" id="shl" class="pr">${SHR} Konumu paylaş</button></div>${l.on ? '' : '<p class="mu" style="margin:10px 0 0">Bu ilan şu an yayında değil; ziyaretçiler göremez.</p>'}${canEdit(l) ? `<button type="button" class="ed" data-e2="${l.id}" style="width:100%;margin-top:10px">İlanı düzenle</button>` : ''}</div>`;
const canEdit = (l) => !!me && (canAll() || l.u === me.id);
let LB = null;

async function detail(no) {
  const id = Number(no) - NO_OFFSET;
  let l = L.find((x) => x.id === id);
  const here = cur;
  if (me || !l) {
    if (!l) loading();
    try { l = await api('/listings/' + id); }
    catch (e) { setTitle('İlan bulunamadı'); return errBox(e.status === 404 ? 'İlan bulunamadı ya da yayından kaldırılmış.' : e.message); }
    if (cur !== here) return;
  }
  if (location.pathname !== l.url) history.replaceState(history.state, '', l.url);
  cur = l.url;
  setTitle(`${l.t} – ${fiyat(l)}`);
  const u = l.sahip || {}, n = l.p.length, ar = ARSA(l.tur);
  const wa = (u.tel || '').replace(/\D/g, '').replace(/^0/, '');
  const msg = `Merhaba, ${l.no} numaralı "${l.t}" ilanınız hakkında bilgi almak istiyorum. ${location.origin + l.url}`;
  const facts = [['İlan No', l.no], ['Fiyat', fiyat(l)], [ar ? 'Arsa alanı' : 'Brüt alan', l.m2 + ' m²'],
    ...(ar ? [] : [['Oda sayısı', l.oda], ['Bulunduğu kat', kt(l)], ['Bina yaşı', l.yas ? l.yas + ' yıl' : 'Yeni bina'], ['Asansör', l.as ? 'Var' : 'Yok']]),
    ['Emlak türü', l.tur], ['İlan tipi', l.tip], ['İlan tarihi', tarih(l.tarih)]];
  const m2f = l.tip === 'Satılık' && l.m2 ? `<div class="mu">m² fiyatı ≈ ${TL(Math.round(l.f / l.m2))}</div>` : '';
  const benzer = L.filter((x) => x.id !== l.id && x.tip === l.tip).sort((a, b) => (b.il === l.il) - (a.il === l.il) || (b.ilce === l.ilce) - (a.ilce === l.ilce)).slice(0, 3);
  const img = (x, i, lazy) => (typeof x === 'string' ? `<img src="${esc(x)}" alt="${esc(l.t)} – fotoğraf ${i + 1}" ${lazy ? 'loading="lazy"' : ''} decoding="async">` : ph(x));
  const contact = `<div class="pn"><div class="agent"><div class="av">${esc(initials(u.ad))}</div><div><b>${esc(u.ad)}</b><div class="mu">Asya Emlak danışmanı</div></div></div>${u.tel ? `<a href="tel:${esc(u.tel)}"><button class="pr cbtn">${PHONE} ${esc(u.tel)}</button></a>` : ''}${wa ? `<a href="https://wa.me/90${esc(wa)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><button class="cbtn wa">${WAI} WhatsApp ile yaz</button></a>` : ''}<a href="mailto:${esc(u.mail)}?subject=${encodeURIComponent('İlan ' + l.no + ': ' + l.t)}&body=${encodeURIComponent(msg)}"><button class="cbtn">${MAIL} E-posta gönder</button></a><p class="mu" style="margin:12px 0 0;text-align:center">Ararken <b>İlan No ${l.no}</b> belirtin.</p></div>`;
  $('#app').innerHTML = `<div class="w dtw"><div class="bc" role="navigation" aria-label="Konum"><a href="/ilanlar">İlanlar</a><span>›</span><a href="/ilanlar" data-il="${esc(l.il)}">${esc(l.il)}</a><span>›</span><span>${esc(l.ilce)}</span></div>
  <div class="dt"><div class="dmain">
   <div class="gal"><div class="gtrack" id="gtr">${l.p.map((x, i) => `<button type="button" class="gsl" data-lb="${i}" aria-label="Fotoğraf ${i + 1} / ${n}, büyüt">${img(x, i, i > 0)}</button>`).join('')}</div>${n > 1 ? `<button type="button" class="gnav gp" data-gd="-1" aria-label="Önceki fotoğraf">‹</button><button type="button" class="gnav gn" data-gd="1" aria-label="Sonraki fotoğraf">›</button>` : ''}<span class="gct" id="gct">1 / ${n}</span>${favBtn(l)}</div>
   ${n > 1 ? `<div class="gth" id="gth">${l.p.map((x, i) => `<button type="button" data-gi="${i}" class="${i ? '' : 'a'}" aria-label="Fotoğraf ${i + 1}">${img(x, i, true)}</button>`).join('')}</div>` : ''}
   <div class="dh"><div><div class="sp2" style="margin:0"><span class="tg">${esc(l.tip)}</span><span class="tg">${esc(l.tur)}</span>${l.on ? '' : '<span class="tg" style="border-color:#ff8b8b;color:#ff8b8b">Yayında değil</span>'}</div><h1 class="dtt">${esc(l.t)}</h1><p class="loc">${PIN}${yer(l)}</p></div><div class="dpr"><div class="pc">${fiyat(l)}</div>${m2f}</div></div>
   <div class="dact">${favBtn(l, true)}<button type="button" id="shr">${SHR}<span>Paylaş</span></button><span class="ino">İlan No <b>${l.no}</b> · ${esc(tarih(l.tarih))}</span></div>
   <div class="facts">${facts.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
   ${(l.oz || []).length ? `<section class="dsec"><h2>Özellikler</h2><div class="sp2">${l.oz.map((o) => `<span class="tg">✓ ${esc(o)}</span>`).join('')}</div></section>` : ''}
   <section class="dsec"><h2>Açıklama</h2><p class="desc ${String(l.d).length > 600 ? 'clip' : ''}" id="dsc">${esc(l.d)}</p>${String(l.d).length > 600 ? '<button type="button" id="dmore" class="lnk">Devamını oku</button>' : ''}</section>
  </div>
  <aside class="asd">${contact}${own(l) ? privBox(l) : ''}</aside></div>
  ${benzer.length ? `<section class="dsec"><h2>Benzer ilanlar</h2><div class="grid">${benzer.map(card).join('')}</div></section>` : ''}
  </div>
  <div class="cbar">${u.tel ? `<a href="tel:${esc(u.tel)}"><button class="pr">${PHONE} Ara</button></a>` : ''}${wa ? `<a href="https://wa.me/90${esc(wa)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><button class="wa">${WAI} WhatsApp</button></a>` : ''}</div>
  <div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Fotoğraflar" hidden><div class="lbtop"><span id="lbc"></span><button type="button" class="lbx" id="lbx" aria-label="Kapat">✕</button></div><div class="lbtr" id="lbtr">${l.p.map((x, i) => `<figure>${img(x, i, true)}</figure>`).join('')}</div>${n > 1 ? `<button type="button" class="gnav gp" data-ld="-1" aria-label="Önceki">‹</button><button type="button" class="gnav gn" data-ld="1" aria-label="Sonraki">›</button>` : ''}</div>`;

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
  // Diğer
  $('#shr').onclick = () => shareIt(l.t + ' · ' + fiyat(l), `İlan No ${l.no} · ${[l.mah, l.ilce, l.il].filter(Boolean).join(', ')}`, location.origin + l.url);
  if ($('#shl')) $('#shl').onclick = () => shareIt('Konum: ' + l.t, l.adr || [l.mah, l.ilce, l.il].join(', '), mapLink(l));
  if ($('#dmore')) $('#dmore').onclick = (e) => { $('#dsc').classList.remove('clip'); e.target.remove(); };
  document.querySelectorAll('[data-il]').forEach((a) => (a.onclick = () => { R(); F.il = a.dataset.il; }));
  document.querySelectorAll('[data-e2]').forEach((b) => (b.onclick = () => { W = { ...blank(), ...JSON.parse(JSON.stringify(l)), _edit: l.id }; ws = 0; go('/panel'); }));
}

// ---------- Favoriler ----------
function favoriler() {
  setTitle('Favorilerim');
  const list = FAV.map((id) => L.find((l) => l.id === id)).filter(Boolean), kayip = FAV.length - list.length;
  $('#app').innerHTML = `<div class="w"><h2>Favorilerim</h2><p class="mu" style="margin-top:-6px">Favorileriniz bu cihazda saklanır.</p>${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : '<div class="pn"><p style="margin:0 0 12px">Henüz favori ilanınız yok. İlanlardaki kalp simgesine dokunarak ekleyebilirsiniz.</p><a class="ba" href="/ilanlar">İlanlara göz at</a></div>'}${kayip ? `<p class="mu">${kayip} favori ilan yayından kaldırıldığı için gösterilmiyor. <button type="button" id="fclr" class="lnk">Listeden temizle</button></p>` : ''}</div>`;
  if ($('#fclr')) $('#fclr').onclick = () => { FAV = FAV.filter((id) => L.some((l) => l.id === id)); saveFav(); favoriler(); };
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
  if (me) return go('/panel', true);
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
      go('/panel', true);
    } catch (err) { $('#lge').textContent = err.message; btn.disabled = false; }
  };
}

function hesap() {
  if (!me) return needLogin();
  $('#app').innerHTML = `<div class="wz"><h2>Hesabım</h2><span class="mu">${esc(me.mail)} · ${me.rol === 'admin' ? 'Yönetici' : me.tumIlan ? 'Yetkili danışman' : 'Danışman'}</span><form id="pf" class="pn" style="margin-top:14px"><h3 style="margin:0">Bilgilerim</h3><p class="mu" style="margin:4px 0 0">İlanlarınızda ziyaretçilere bu ad ve telefon gösterilir.</p><div class="fld"><span>Ad soyad</span><input name="ad" value="${esc(me.ad)}" required></div><div class="fld"><span>Telefon</span><input name="tel" type="tel" value="${esc(me.tel)}"></div><button class="pr" style="margin-top:14px">Kaydet</button></form><form id="pwf" class="pn" style="margin-top:14px"><h3 style="margin:0">Şifre değiştir</h3><div class="fld"><span>Mevcut şifre</span><input name="eski" type="password" autocomplete="current-password" required></div><div class="fld"><span>Yeni şifre</span><input name="yeni" type="password" autocomplete="new-password" minlength="8" required></div><div class="fld"><span>Yeni şifre (tekrar)</span><input name="yeni2" type="password" autocomplete="new-password" minlength="8" required></div><div class="err" id="pwe" role="alert"></div><button class="pr">Şifreyi değiştir</button></form><button id="lo" class="dg" style="width:100%;margin-top:18px;padding:13px">Çıkış yap</button></div>`;
  $('#pf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/profile', { method: 'PUT', body: d }); me.ad = d.ad; me.tel = d.tel; renderNav(); toast('Bilgiler kaydedildi'); } catch (err) { toast(err.message); } };
  $('#pwf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d.yeni !== d.yeni2) return ($('#pwe').textContent = 'Yeni şifreler aynı değil.'); try { await api('/password', { method: 'POST', body: d }); e.target.reset(); $('#pwe').textContent = ''; toast('Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.'); } catch (err) { $('#pwe').textContent = err.message; } };
  $('#lo').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch {} me = null; MY = USERS = null; W = null; renderNav(); toast('Çıkış yapıldı'); go('/'); };
}

// ---------- İlanlarım ----------
const gd = () => { try { return JSON.parse(localStorage.getItem('asya-draft') || 'null'); } catch { return null; } };
const draft = () => { try { localStorage.setItem('asya-draft', JSON.stringify({ W, ws })); } catch {} };
const nod = () => { try { localStorage.removeItem('asya-draft'); } catch {} };
const blank = () => ({ t: '', tip: 'Satılık', tur: 'Daire', p: [], f: '', m2: '', il: '', ilce: '', mah: '', adr: '', lat: null, lon: null, oda: '2+1', kat: 1, yas: 0, as: 1, oz: [], d: '' });
let PT = 'mine', PQ = { q: '', sahip: '', durum: '' };

async function panel() {
  if (!me) return needLogin();
  if (W) return wiz();
  setTitle('İlanlarım');
  if (!MY) { loading(); try { MY = await api('/my-listings'); } catch (e) { return errBox(e.message); } if (cur !== '/panel' || W) return; }
  const all = canAll(), mine = MY.filter((l) => l.u === me.id), dr = gd();
  if (!all) PT = 'mine';
  const sahipler = [...new Map(MY.map((l) => [l.u, l.sahip.ad])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'tr'));
  const q = PQ.q.trim().toLocaleLowerCase('tr');
  const src = PT === 'all' ? MY : mine;
  const list = src.filter((l) => (!PQ.sahip || String(l.u) === PQ.sahip) && (!PQ.durum || (PQ.durum === 'on' ? l.on : !l.on))
    && (!q || (l.t + ' ' + l.no + ' ' + l.il + ' ' + l.ilce + ' ' + (l.mah || '') + ' ' + l.sahip.ad).toLocaleLowerCase('tr').includes(q)));
  const item = (l) => `<div class="mi">${ph(l.p[0])}<div class="in"><div><b>${esc(l.t)}</b></div><div class="pc" style="font-size:15px">${fiyat(l)}</div><div class="mu">No ${l.no} · ${yer(l)}</div><div class="mu">${PT === 'all' ? esc(l.sahip.ad) + ' · ' : ''}${l.on ? 'Yayında' : '<span style="color:#ff8b8b">Gizli</span>'}</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button data-e="${l.id}">Düzenle</button><button data-g="${l.id}">Gör</button><button data-v="${l.id}">${l.on ? 'Gizle' : 'Yayınla'}</button><button class="dg" data-d="${l.id}">Sil</button></div></div></div>`;
  $('#app').innerHTML = `<div class="wz"><h2>${all ? 'İlan yönetimi' : 'İlanlarım'}</h2>${all ? `<div class="tb" style="margin:6px 0 4px"><button class="${PT === 'mine' ? 'on' : ''}" data-pt="mine">İlanlarım (${mine.length})</button><button class="${PT === 'all' ? 'on' : ''}" data-pt="all">Tüm ilanlar (${MY.length})</button></div>` : `<span class="mu">${mine.length} ilan · ${mine.filter((l) => l.on).length} yayında</span>`}
  ${!fotoOk ? '<div class="pn dbn" style="border-color:#ff8b8b"><span>Fotoğraf depolama henüz etkin değil; şimdilik yeni ilan eklenemez.</span></div>' : ''}${dr && dr.W ? `<div class="pn dbn"><span>Yarım kalan ilan: <b>${esc(dr.W.t || 'Başlıksız')}</b></span><span><button id="dg" class="pr">Devam et</button> <button id="dx" class="dg">Sil</button></span></div>` : ''}
  ${src.length > 3 || PQ.q || PQ.sahip || PQ.durum ? `<div class="pflt"><input id="pq" type="search" placeholder="Başlık, ilan no veya konum ara" value="${esc(PQ.q)}">${PT === 'all' ? `<select id="ps"><option value="">Tüm danışmanlar</option>${sahipler.map(([id, ad]) => `<option value="${id}" ${PQ.sahip === String(id) ? 'selected' : ''}>${esc(ad)}</option>`).join('')}</select>` : ''}<select id="pd"><option value="">Tümü</option><option value="on" ${PQ.durum === 'on' ? 'selected' : ''}>Yayında</option><option value="off" ${PQ.durum === 'off' ? 'selected' : ''}>Gizli</option></select></div>` : ''}
  <div class="ml" id="pml">${list.map(item).join('') || `<div class="pn mu">${src.length ? 'Aramaya uyan ilan yok.' : 'Henüz ilanınız yok. Sağ alttaki butonla ilk ilanınızı ekleyin.'}</div>`}</div></div><button class="pr fab" id="nw">+ Yeni ilan</button>`;
  $('#nw').onclick = () => { W = blank(); ws = 0; wiz(); };
  if ($('#dg')) $('#dg').onclick = () => { W = dr.W; ws = dr.ws || 0; wiz(); };
  if ($('#dx')) $('#dx').onclick = () => { nod(); panel(); };
  document.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = () => { PT = b.dataset.pt; PQ.sahip = ''; panel(); }));
  if ($('#pq')) $('#pq').oninput = (e) => { PQ.q = e.target.value; clearTimeout(panel.t); panel.t = setTimeout(() => { panel(); const i = $('#pq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  if ($('#ps')) $('#ps').onchange = (e) => { PQ.sahip = e.target.value; panel(); };
  if ($('#pd')) $('#pd').onchange = (e) => { PQ.durum = e.target.value; panel(); };
  bindListingActions(panel);
}

function bindListingActions(again) {
  document.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { const l = MY.find((x) => x.id == b.dataset.e); W = { ...blank(), ...JSON.parse(JSON.stringify(l)), _edit: l.id }; ws = 0; go('/panel'); }));
  document.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { const l = MY.find((x) => x.id == b.dataset.g); go(l.url); }));
  document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = async () => {
    const l = MY.find((x) => x.id == b.dataset.v); b.disabled = true;
    try { await api('/listings/' + l.id, { method: 'PATCH', body: { on: !l.on } }); l.on = l.on ? 0 : 1; await refreshPublic(); toast(l.on ? 'İlan yayında' : 'İlan gizlendi'); } catch (e) { toast(e.message); }
    again();
  }));
  document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
    const l = MY.find((x) => x.id == b.dataset.d);
    if (!confirm(`"${l.t}" (No ${l.no}) ilanı ve fotoğrafları kalıcı olarak silinsin mi?`)) return;
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

function wiz() {
  const s = ws, ar = ARSA(W.tur);
  let body = '';
  if (s === 0) body = `<h2>İlan başlığı</h2><p class="mu" style="margin:0">Kısa ve dikkat çekici olsun. Örnek: Deniz manzaralı 3+1 daire</p><div class="fld"><input id="w-t" maxlength="80" placeholder="İlan başlığı" value="${esc(W.t)}" enterkeyhint="next"><div class="mu" style="text-align:right;font-size:12px;margin-top:4px"><span id="w-c">${W.t.length}</span>/80</div></div><div class="fld"><span>İlan tipi</span>${ch('tip', ['Satılık', 'Kiralık'])}</div>`;
  if (s === 1) body = `<h2>Fotoğraflar</h2><p class="mu" style="margin:0">En fazla 15 fotoğraf. İlk fotoğraf vitrin görseli olur.</p>${fotoOk ? '' : '<p class="err">Fotoğraf depolama henüz etkin değil; ilan şu an kaydedilemez.</p>'}<div class="pb"><button type="button" class="pbb" id="w-camb">${CAM}Kamerayla çek<small>Art arda çekin</small></button><label>${GAL}Galeriden seç<small>Birden fazla seçin</small><input type="file" accept="image/*" multiple id="w-gal"></label><input type="file" accept="image/*" capture="environment" multiple id="w-cam" hidden></div><div id="w-st" class="mu" style="margin-top:12px">${W.p.length} / 15 fotoğraf</div><p class="mu" style="font-size:12px;margin:4px 0 0">İpucu: Galeride birden fazla fotoğrafa dokunarak hepsini tek seferde ekleyebilirsiniz. Seçim açılmazsa ilk fotoğrafa basılı tutun.</p><div class="tgrid">${W.p.map((x, i) => `<div class="t" style="background-image:url('${esc(x)}')">${i === 0 ? '<b>Vitrin</b>' : ''}<button type="button" class="x" data-rm="${i}" aria-label="Fotoğrafı kaldır">✕</button>${i ? `<button type="button" class="cv" data-cv="${i}">Vitrin yap</button>` : ''}</div>`).join('')}</div>`;
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
    go(l.url);
  } catch (e) {
    btn.disabled = false; btn.textContent = W && W._edit ? 'Kaydet' : 'İlanı yayınla';
    if (e.status === 401) { toast('Oturumunuz kapanmış. Tekrar giriş yapın; taslağınız saklandı.'); me = null; renderNav(); W = null; return go('/giris'); }
    er(e.message);
  }
}

// ---------- Yönetim ----------
const YETKI = [['danisman', 'Danışman', 'Yalnızca kendi ilanlarını görür ve yönetir.'], ['yetkili', 'Yetkili danışman', 'Tüm ilanları görür, düzenler, gizler ve siler.'], ['admin', 'Yönetici', 'Tüm ilanlar + kullanıcılar ve site ayarları.']];
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
  <p class="mu">Tüm ilanları <a href="/panel" style="color:var(--au)">İlanlarım → Tüm ilanlar</a> sekmesinden yönetebilirsiniz.</p></div>`;
  const patch = async (id, body, msg) => { try { await api('/users/' + id, { method: 'PATCH', body }); USERS = await api('/users'); MY = null; await refreshPublic(); toast(msg); } catch (e) { toast(e.message); } admin(); };
  document.querySelectorAll('[data-uy]').forEach((s) => (s.onchange = () => { const u = USERS.find((x) => x.id == s.dataset.uy); if (confirm(`${u.ad} için yetki "${yetkiAd(s.value)}" olarak değiştirilsin mi?`)) patch(u.id, { yetki: s.value }, 'Yetki değiştirildi'); else s.value = yetkiOf(u); }));
  document.querySelectorAll('[data-ua]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.ua); patch(u.id, { aktif: !u.aktif }, u.aktif ? 'Kullanıcı devre dışı; ilanları gizlendi' : 'Kullanıcı etkinleştirildi'); }));
  document.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { const u = USERS.find((x) => x.id == b.dataset.up); const p = prompt(`${u.ad} için yeni şifre (en az 8 karakter). Kişinin açık oturumları kapatılır.`); if (p) patch(u.id, { sifre: p }, 'Şifre sıfırlandı'); }));
  $('#uf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/users', { method: 'POST', body: d }); USERS = await api('/users'); toast('Kullanıcı eklendi'); admin(); } catch (err) { $('#ue').textContent = err.message; } };
}

function settings() {
  if (!me) return needLogin();
  if (me.rol !== 'admin') return errBox('Bu sayfa yalnızca yöneticiler içindir.');
  const f = (k, l) => `<label>${l}<input name="${k}" value="${esc(SS[k])}"></label>`;
  $('#app').innerHTML = `<div class="w"><h2>Site ayarları</h2><div class="pn"><form id="sf2"><div class="fm">${f('hero', 'Ana sayfa başlığı')}${f('sub', 'Ana sayfa alt metni')}${f('tel', 'Telefon')}${f('mail', 'E-posta')}${f('adr', 'Adres (haritada gösterilir)')}${f('saat', 'Çalışma saatleri')}</div><label class="mu" style="display:grid;gap:4px;margin-top:12px">Hakkımızda metni (paragraflar arasında boş satır bırakın)<textarea name="hak" style="min-height:160px">${esc(SS.hak)}</textarea></label><p><button class="pr">Kaydet</button></p></form></div></div>`;
  $('#sf2').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/settings', { method: 'PUT', body: d }); SS = { ...SS, ...d }; renderFooter(); toast('Ayarlar kaydedildi'); } catch (err) { toast(err.message); } };
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
  if (LB && !document.getElementById('lb')) LB = null;
  document.onkeydown = null;
  clearInterval(HXT);
  document.querySelectorAll('nav a.l').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === h));
  const m = /^\/ilan\/(\d+)/.exec(h);
  if (m) return detail(m[1]);
  if (h === '/') setTitle('');
  if (h === '/panel') panel();
  else if (h === '/yonetim') admin();
  else if (h === '/ayarlar') { setTitle('Site ayarları'); settings(); }
  else if (h === '/ilanlar') { setTitle('Satılık ve Kiralık İlanlar'); ilanlar(); }
  else if (h === '/hakkimizda') { setTitle('Hakkımızda'); about(); }
  else if (h === '/iletisim') { setTitle('İletişim'); contact(); }
  else if (h === '/favoriler') favoriler();
  else if (h === '/giris') { setTitle('Danışman girişi'); giris(); }
  else if (h === '/hesap') { setTitle('Hesabım'); hesap(); }
  else if (h === '/') home();
  else { setTitle('Sayfa bulunamadı'); errBox('Aradığınız sayfa bulunamadı.'); }
}
document.addEventListener('click', (e) => {
  const fb = e.target.closest && e.target.closest('[data-fav]');
  if (fb) { e.preventDefault(); e.stopPropagation(); toggleFav(Number(fb.dataset.fav)); return; }
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
  if (SS.adr) it.push(`<li><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SS.adr)}" target="_blank" rel="noopener">${esc(SS.adr)}</a></li>`);
  if (SS.saat) it.push(`<li class="mu">${esc(SS.saat)}</li>`);
  $('#ftc').innerHTML = it.join('') || '<li><a href="/iletisim">İletişim bilgileri</a></li>';
  $('#fty').textContent = new Date().getFullYear();
}
$('#mb').onclick = () => { const o = $('#nav').classList.toggle('open'); $('#mb').setAttribute('aria-expanded', String(o)); document.body.style.overflow = o ? 'hidden' : ''; };
async function boot(render = true) {
  const [m, s, l] = await Promise.all([api('/me'), api('/settings'), api('/listings')]);
  me = m.user; kurulum = m.kurulum; fotoOk = m.foto; SS = s; L = l.ilanlar; DAN = l.danisman; MY = USERS = null;
  renderFooter();
  if (render) route(); else renderNav();
}
if (location.hash && location.pathname === '/') { try { history.replaceState(null, '', fromHash(location.hash)); } catch {} cur = pathOf(); }
if (!$('#app').children.length) loading();
boot().catch((e) => errBox(e.message));
