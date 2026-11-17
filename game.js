'use strict';
// Szofi – minimális játék-csonk (ADR-0001). Tiszta Canvas 2D, nincs build, nincs függőség.
// Ez még nem a kész játék: egy nyilakkal mozgatható játékos-négyzet, és a többi játékos
// kirajzolása a szerverről (ADR-0002). Erre a vázra épül majd a tényleges Szofi-játék.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ===== Világ (végtelen, determinisztikus generálás) – ADR-0003 =====
// Minden a pozícióból számolódik: nincs világbejárás, mindig csak a kamera körüli cellák.
const ROAD_SPACING = 600;        // az utak (rácsvonalak) távolsága px-ben
const ROAD_HALF = 26;            // az úttest fél-szélessége (az útvonaltól mérve)

// pozíció-alapú egész hash → 0..2^32-1, determinisztikus (ugyanaz a bemenet → ugyanaz a kimenet)
function hash32(ix, iy) {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const rand01 = (ix, iy, salt = 0) => hash32(ix * 2654435761 + salt, iy) / 4294967296;   // 0..1

// a legközelebbi vízszintes és függőleges rácsvonal
function nearestRoad(x, y) {
  return { x: Math.round(x / ROAD_SPACING) * ROAD_SPACING, y: Math.round(y / ROAD_SPACING) * ROAD_SPACING };
}
// úton van-e (bármelyik rácsvonal úttestjén belül)
function onRoad(x, y) {
  const r = nearestRoad(x, y);
  return Math.abs(x - r.x) <= ROAD_HALF || Math.abs(y - r.y) <= ROAD_HALF;
}

// Egy háztömb (két szomszédos rácsvonal közötti négyzet) determinisztikus házai.
// A tömböt a bal-felső sarkának rácsindexe (gx, gy) azonosítja.
const HOUSE_MARGIN = 70;         // a tömb szélétől (úttól) befelé ennyivel kezdődnek a házak
function housesInBlock(gx, gy) {
  const bx = gx * ROAD_SPACING, by = gy * ROAD_SPACING;     // a tömb bal-felső sarka (rácsvonal)
  const x0 = bx + HOUSE_MARGIN, y0 = by + HOUSE_MARGIN;
  const inner = ROAD_SPACING - 2 * HOUSE_MARGIN;
  const out = [];
  const cols = 2, rows = 2, cw = inner / cols, ch = inner / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (rand01(gx * 7 + c, gy * 7 + r, 11) < 0.25) continue;   // néhány üres telek
    const w = 90 + Math.floor(rand01(gx + c, gy + r, 1) * 40);
    const h = 90 + Math.floor(rand01(gx + c, gy + r, 2) * 40);
    const cx = x0 + c * cw + cw / 2, cy = y0 + r * ch + ch / 2;
    // az ajtó a tömb legközelebbi széle (út) felé néz
    const toTop = cy - by, toBottom = (by + ROAD_SPACING) - cy, toLeft = cx - bx, toRight = (bx + ROAD_SPACING) - cx;
    const m = Math.min(toTop, toBottom, toLeft, toRight);
    let door;
    if (m === toTop) door = { x: cx, y: cy - h / 2 - 16 };
    else if (m === toBottom) door = { x: cx, y: cy + h / 2 + 16 };
    else if (m === toLeft) door = { x: cx - w / 2 - 16, y: cy };
    else door = { x: cx + w / 2 + 16, y: cy };
    out.push({ x: cx, y: cy, w, h, door, seed: hash32(gx * 101 + c, gy * 101 + r) });
  }
  return out;
}
// a (cx, cy) körüli sugárban lévő összes ház (csak a közeli tömböket nézzük)
function housesIn(cx, cy, radius) {
  const out = [];
  const g0x = Math.floor((cx - radius) / ROAD_SPACING), g1x = Math.floor((cx + radius) / ROAD_SPACING);
  const g0y = Math.floor((cy - radius) / ROAD_SPACING), g1y = Math.floor((cy + radius) / ROAD_SPACING);
  for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++)
    for (const h of housesInBlock(gx, gy)) if (Math.hypot(h.x - cx, h.y - cy) <= radius) out.push(h);
  return out;
}

// ha a (p.x,p.y) pont a (cx,cy) középpontú, w×h téglalapon (pad ráhagyással) belül van,
// a legkisebb elmozdulással kitolja a legközelebbi élre
function pushOutOfRect(p, cx, cy, w, h, pad) {
  const hw = w / 2 + pad, hh = h / 2 + pad;
  const dx = p.x - cx, dy = p.y - cy;
  if (Math.abs(dx) >= hw || Math.abs(dy) >= hh) return false;   // kívül
  const ox = hw - Math.abs(dx), oy = hh - Math.abs(dy);          // átfedés mindkét tengelyen
  if (ox < oy) p.x = cx + Math.sign(dx || 1) * hw;               // a kisebbik átfedés mentén tolunk ki
  else p.y = cy + Math.sign(dy || 1) * hh;
  return true;
}
// a pontot (játékos/jármű) kitolja minden közeli házból
function collideHouses(p, pad) {
  for (const h of housesIn(p.x, p.y, ROAD_SPACING)) pushOutOfRect(p, h.x, h.y, h.w, h.h, pad);
}

// Elérhető (parkoló) járművek az útkereszteződések közelében, determinisztikusan.
// Nincs AI-forgalom; ezek csak be-/felszállható járművek (ADR-0004).
function vehiclesInCell(gx, gy) {
  if (rand01(gx, gy, 31) < 0.45) return [];                 // nem minden kereszteződésnél van jármű
  const rx = gx * ROAD_SPACING, ry = gy * ROAD_SPACING;     // a kereszteződés
  const kind = rand01(gx, gy, 32) < 0.5 ? 'auto' : 'lo';
  const along = rand01(gx, gy, 33) < 0.5;                   // vízszintes vagy függőleges út mentén parkol
  const off = 120 + Math.floor(rand01(gx, gy, 34) * 200);
  const x = along ? rx + off : rx, y = along ? ry : ry + off;
  const a = along ? 0 : Math.PI / 2;
  return [{ x, y, a, kind, speed: 0, angle: a,
            color: kind === 'auto' ? '#d42020' : '#8a5a2b', id: 'v_' + gx + '_' + gy }];
}
function vehiclesIn(cx, cy, radius) {
  const out = [];
  const g0x = Math.floor((cx - radius) / ROAD_SPACING), g1x = Math.floor((cx + radius) / ROAD_SPACING);
  const g0y = Math.floor((cy - radius) / ROAD_SPACING), g1y = Math.floor((cy + radius) / ROAD_SPACING);
  for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++)
    for (const v of vehiclesInCell(gx, gy)) if (Math.hypot(v.x - cx, v.y - cy) <= radius) out.push(v);
  return out;
}

// ===== Játékos =====
// A világ koordináta-rendszere független a képernyőtől; a kamera a játékost követi.
const SPEED = 240;                                   // px / mp
const player = { x: 0, y: 0, a: 0, name: 'Szofi', color: '#2f6fd0', riding: null, inHouse: null };
const keys = Object.create(null);
window.addEventListener('keydown', e => {
  if ((e.key === 'e' || e.key === 'E') && !keys._e) { keys._e = true; onUse(); }
  keys[e.key] = true;
});
window.addEventListener('keyup', e => { if (e.key === 'e' || e.key === 'E') keys._e = false; keys[e.key] = false; });

function updatePlayer(dt) {
  if (player.riding || player.inHouse) return;        // vezetés közben / házban nem gyalogos
  let dx = 0, dy = 0;
  if (keys.ArrowLeft) dx -= 1;
  if (keys.ArrowRight) dx += 1;
  if (keys.ArrowUp) dy -= 1;
  if (keys.ArrowDown) dy += 1;
  if (dx || dy) {
    const n = Math.hypot(dx, dy);                    // átló is egységnyi sebesség
    player.x += (dx / n) * SPEED * dt;
    player.y += (dy / n) * SPEED * dt;
    player.a = Math.atan2(dy, dx);
  }
  if (!player.inHouse && !player.riding) collideHouses(player, 12);
}

// ===== Közös járműfizika (autó + ló), irányított – ADR-0004 =====
const VEH = {
  auto: { accel: 420, max: 520, turn: 2.6, friction: 1.4 },
  lo:   { accel: 520, max: 380, turn: 3.4, friction: 2.2 },
};
// input: { fwd: -1..1 (gyorsít/fékez-hátramenet), turn: -1..1 (bal/jobb) }
function updateVehiclePhysics(v, input, dt) {
  const k = VEH[v.kind] || VEH.auto;
  v.speed += input.fwd * k.accel * dt;
  v.speed -= Math.sign(v.speed) * k.friction * dt * 60;          // súrlódás (bemenet nélkül is lassít)
  if (Math.abs(v.speed) < 2 && input.fwd === 0) v.speed = 0;
  v.speed = Math.max(-k.max * 0.4, Math.min(k.max, v.speed));    // hátramenet lassabb
  if (Math.abs(v.speed) > 1) v.angle += input.turn * k.turn * dt * (v.speed >= 0 ? 1 : -1);
  v.x += Math.cos(v.angle) * v.speed * dt;
  v.y += Math.sin(v.angle) * v.speed * dt;
  v.a = v.angle;
  collideHouses(v, 14);
}

const ENTER_RANGE = 46;          // ennyin belül lehet be-/felszállni
function toggleVehicle() {
  if (player.inHouse) return;                             // házban nincs jármű
  if (player.riding) {                                    // kiszállás a jármű mellé
    player.x = player.riding.x + Math.cos(player.riding.angle + Math.PI / 2) * 24;
    player.y = player.riding.y + Math.sin(player.riding.angle + Math.PI / 2) * 24;
    player.riding = null;
    return;
  }
  let best = null, bestD = ENTER_RANGE;                   // a legközelebbi jármű a sugáron belül
  for (const v of vehiclesIn(player.x, player.y, ENTER_RANGE * 2)) {
    const d = Math.hypot(v.x - player.x, v.y - player.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  if (best) { best.speed = 0; best.angle = best.a; player.riding = best; }
}
// vezetés: a nyilak a járművet irányítják, a kamera a járművet követi
function updateDriving(dt) {
  const v = player.riding; if (!v) return;
  const fwd = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  const turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  updateVehiclePhysics(v, { fwd, turn }, dt);
  player.x = v.x; player.y = v.y; player.a = v.a;         // a kamera a járművet követi
}
function onUse() { toggleVehicle(); }    // Task 8: előbb a ház-be/ki, ha ajtó közelében

// ===== Rajzolás =====
function worldToScreen(x, y) { return [x - player.x + W / 2, y - player.y + H / 2]; }

function drawCity() {
  // háttér már kész (draw() tölti); most az utak
  const left = player.x - W / 2, top = player.y - H / 2;
  ctx.fillStyle = '#394a5a';
  const g0x = Math.floor((left) / ROAD_SPACING) - 1, g1x = Math.floor((left + W) / ROAD_SPACING) + 1;
  const g0y = Math.floor((top) / ROAD_SPACING) - 1, g1y = Math.floor((top + H) / ROAD_SPACING) + 1;
  for (let gx = g0x; gx <= g1x; gx++) { const [sx] = worldToScreen(gx * ROAD_SPACING, 0); ctx.fillRect(sx - ROAD_HALF, 0, ROAD_HALF * 2, H); }
  for (let gy = g0y; gy <= g1y; gy++) { const [, sy] = worldToScreen(0, gy * ROAD_SPACING); ctx.fillRect(0, sy - ROAD_HALF, W, ROAD_HALF * 2); }
  // házak
  for (const h of housesIn(player.x, player.y, Math.hypot(W, H) / 2 + ROAD_SPACING)) {
    const [sx, sy] = worldToScreen(h.x, h.y);
    ctx.fillStyle = '#6b5641'; ctx.fillRect(sx - h.w / 2, sy - h.h / 2, h.w, h.h);
    ctx.fillStyle = '#caa36f'; const [dx, dy] = worldToScreen(h.door.x, h.door.y); ctx.fillRect(dx - 6, dy - 6, 12, 12);   // ajtó
  }
  // elérhető járművek (lovak, autók)
  for (const v of vehiclesIn(player.x, player.y, Math.hypot(W, H) / 2 + ROAD_SPACING)) {
    if (player.riding && player.riding.id === v.id) continue;   // amiben ülünk, azt a játékosként rajzoljuk
    const [sx, sy] = worldToScreen(v.x, v.y);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(v.a);
    ctx.fillStyle = v.color;
    if (v.kind === 'auto') ctx.fillRect(-20, -11, 40, 22); else ctx.fillRect(-16, -7, 32, 14);
    ctx.restore();
  }
}

function drawPlayer(x, y, a, color, name) {
  const [sx, sy] = worldToScreen(x, y);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.fillRect(-12, -12, 24, 24);
  ctx.fillStyle = '#fff';
  ctx.fillRect(8, -3, 6, 6);                          // kis „orr”: merre néz
  ctx.restore();
  if (name) {
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, sx, sy - 18);
  }
}

function draw() {
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0, 0, W, H);
  drawCity();
  for (const o of net.others.values()) drawPlayer(o.x, o.y, o.a, o.color || '#d42020', o.name);
  drawPlayer(player.x, player.y, player.a, player.color, player.name);
  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(net.online ? `Online – ${net.others.size + 1} játékos` : 'Offline (egyjátékos)', 12, 22);
}

// ===== Többjátékos mód (ADR-0002) =====
// Csak a játékos helyzete utazik; a világ (itt még csak a rács) képletből mindenhol egyezik.
// A protokoll megegyezik a szerverével: küldés { t:'state', s:{...} }, fogadás
// { t:'hello', id } és { t:'players', list:[...] }.
const NET_SEND = 0.1;                                 // ennyi időnként küldjük a helyzetünket (mp)
// A felhős (Cloud Run) szerver címe – az első „gcloud run deploy” után töltsd ki a kapott
// wss://szofi-game-….run.app címmel, hogy a GitHub Pages-en is legyen többjátékos mód.
const NET_SERVER = '';
const net = { ws: null, id: 0, online: false, others: new Map(), sendT: 0, tries: 0 };

function netState() {                                 // amit a többiek látnak belőlünk
  return { name: player.name, x: Math.round(player.x), y: Math.round(player.y), a: player.a, shirt: player.color };
}

function netConnect() {                               // a GitHub Pages-en (statikus oldal) nincs saját szerver
  const loc = window.location, WS = window.WebSocket;
  if (!loc || !WS) return false;
  const pages = /github\.io$/.test(loc.hostname || '');
  if (pages && !NET_SERVER) return false;             // Pages + nincs felhős cím → egyjátékos
  const url = pages ? NET_SERVER.replace(/\/$/, '') + '/ws'
                    : (loc.protocol === 'https:' ? 'wss://' : 'ws://') + loc.host + '/ws';
  let ws;
  try { ws = new WS(url); } catch (e) { return false; }
  net.ws = ws;
  net.tries++;
  ws.onopen = () => { net.online = true; net.tries = 0; };
  ws.onmessage = ev => netReceive(ev.data);
  ws.onclose = () => {
    net.online = false; net.others.clear(); net.ws = null; net.id = 0;
    if (net.tries <= 20 && typeof setTimeout === 'function') setTimeout(netConnect, Math.min(30000, 2000 * net.tries));
  };
  ws.onerror = () => { try { ws.close(); } catch (e) { /* a close úgyis újrapróbál */ } };
  return true;
}

function netReceive(text) {                           // a szerver üzenetei: hello (saját azonosító), players (mindenki)
  let m;
  try { m = JSON.parse(text); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') { net.id = m.id; return; }
  if (m.t === 'players' && Array.isArray(m.list)) {
    const seen = new Set();
    for (const p of m.list) {
      if (!p || p.id === net.id) continue;            // magunkat nem rajzoljuk kétszer
      seen.add(p.id);
      const o = net.others.get(p.id) || {};
      o.x = p.x; o.y = p.y; o.a = p.a; o.name = p.name; o.color = p.shirt;
      net.others.set(p.id, o);
    }
    for (const id of net.others.keys()) if (!seen.has(id)) net.others.delete(id);   // kilépettek
  }
}

function updateNet(dt) {
  if (!net.online || !net.ws) return;
  net.sendT -= dt;
  if (net.sendT > 0) return;
  net.sendT = NET_SEND;
  try { net.ws.send(JSON.stringify({ t: 'state', s: netState() })); } catch (e) { /* a következő körben újra */ }
}

// ===== Fő ciklus =====
let last = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;   // nagy ugrásokat levágjuk (háttérből visszatérés)
  last = now;
  updatePlayer(dt);
  updateDriving(dt);
  updateNet(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

netConnect();                                         // többjátékos mód, ha a saját szerverről fut a játék

// a füstteszt számára (kamu böngészőkörnyezetben eval-eljük ezt a fájlt)
if (typeof global !== 'undefined') {
  global.G = { player, net, netState, netReceive, updatePlayer, keys,
    hash32, rand01, onRoad, nearestRoad, ROAD_SPACING, ROAD_HALF,
    housesIn, housesInBlock, HOUSE_MARGIN,
    pushOutOfRect, collideHouses,
    vehiclesIn, vehiclesInCell,
    updateVehiclePhysics, VEH,
    toggleVehicle, updateDriving, onUse, ENTER_RANGE,
    drawCity,
    get W() { return W; }, get H() { return H; } };
}
