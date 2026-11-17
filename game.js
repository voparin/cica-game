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
const ROAD_HALF = 52;            // az úttest fél-szélessége (az útvonaltól mérve) – 2× szélesebb út

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

// Házak vizuális változatossága (ADR-0008) – a seedből, az ütközéstől függetlenül.
const HOUSE_WALLS = ['#b85c4a', '#d9a05b', '#6f8f6a', '#5b7fa6', '#c9b47e', '#9a6fa0', '#c77f9e', '#7a8a99'];
const HOUSE_ROOFS = ['#8a3b2e', '#5a4632', '#394a5a', '#6b5641', '#3f5e46'];
const ROOF_TYPES = ['nyereg', 'sator', 'lapos'];
const HOUSE_TYPES = ['lakohaz', 'gyar', 'iskola', 'iroda', 'bolt', 'etterem'];
// determinisztikus típus a seedből: a lakóház ~50%, a másik öt a maradékon osztozik
function houseType(seed) {
  const r = (seed >>> 12) % 10;
  if (r < 5) return 'lakohaz';
  return HOUSE_TYPES[1 + ((seed >>> 16) % 5)];     // gyar..etterem
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
    const seed = hash32(gx * 101 + c, gy * 101 + r);
    out.push({
      x: cx, y: cy, w, h, door, seed,
      wall: HOUSE_WALLS[seed % HOUSE_WALLS.length],
      roof: HOUSE_ROOFS[(seed >>> 3) % HOUSE_ROOFS.length],
      roofType: ROOF_TYPES[(seed >>> 6) % ROOF_TYPES.length],
      height: 34 + ((seed >>> 9) % 4) * 14,              // 34..76 px „magasság" (izo z)
      type: houseType(seed),
    });
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
// Kivétel a determinisztikus világ alól (ADR-0009): a mozgatott járművek az új helyükön
// maradnak, és localStorage-ba mentődnek. A kulcs a jármű formula-ID-je.
const movedVehicles = new Map();                     // id → { x, y, angle, speed, kind, color }
const VEH_KEY = 'szofi.vehicles';
function loadVehicles() {
  try {
    const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(VEH_KEY)) || null;
    if (!raw) return;
    const o = JSON.parse(raw);
    for (const id of Object.keys(o)) movedVehicles.set(id, o[id]);
  } catch (e) { /* hibás/üres mentés – a formula-helyeket használjuk */ }
}
function saveVehicles() {
  try {
    if (typeof localStorage === 'undefined') return;
    const o = {}; for (const [id, v] of movedVehicles) o[id] = v;
    localStorage.setItem(VEH_KEY, JSON.stringify(o));
  } catch (e) { /* a mentés nem kritikus */ }
}
function setVehicleMoved(id, v) { movedVehicles.set(id, { x: v.x, y: v.y, angle: v.angle, speed: v.speed || 0, kind: v.kind, color: v.color }); }

function vehiclesInCell(gx, gy) {
  if (rand01(gx, gy, 31) < 0.45) return [];                 // nem minden kereszteződésnél van jármű
  const rx = gx * ROAD_SPACING, ry = gy * ROAD_SPACING;     // a kereszteződés
  const kind = rand01(gx, gy, 32) < 0.5 ? 'auto' : 'lo';
  const along = rand01(gx, gy, 33) < 0.5;                   // vízszintes vagy függőleges út mentén parkol
  const off = 120 + Math.floor(rand01(gx, gy, 34) * 200);
  const x = along ? rx + off : rx, y = along ? ry : ry + off;
  const a = along ? 0 : Math.PI / 2;
  const id = 'v_' + gx + '_' + gy;
  const m = movedVehicles.get(id);                          // ha mozgattuk, az új helyén áll
  if (m) return [{ x: m.x, y: m.y, a: m.angle, kind: m.kind, speed: m.speed, angle: m.angle, color: m.color, id }];
  return [{ x, y, a, kind, speed: 0, angle: a,
            color: kind === 'auto' ? '#d42020' : '#8a5a2b', id }];
}
function vehiclesIn(cx, cy, radius) {
  const out = [], seen = new Set();
  const add = v => { if (!seen.has(v.id) && Math.hypot(v.x - cx, v.y - cy) <= radius) { seen.add(v.id); out.push(v); } };
  const g0x = Math.floor((cx - radius) / ROAD_SPACING), g1x = Math.floor((cx + radius) / ROAD_SPACING);
  const g0y = Math.floor((cy - radius) / ROAD_SPACING), g1y = Math.floor((cy + radius) / ROAD_SPACING);
  for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++)
    for (const v of vehiclesInCell(gx, gy)) add(v);
  // a mozgatott járművek más cellába is sodródhattak, mint amiben a formula-ID-jük iterál – ezeket külön is nézzük
  for (const [id, m] of movedVehicles) if (!seen.has(id)) add({ x: m.x, y: m.y, a: m.angle, kind: m.kind, speed: m.speed, angle: m.angle, color: m.color, id });
  return out;
}

// Fák a háztömbökben, determinisztikusan a seedből, az úttól és a házaktól távol.
const TREE_R = 16;               // a törzs ütközési sugara
function treesInBlock(gx, gy) {
  const bx = gx * ROAD_SPACING, by = gy * ROAD_SPACING;
  const out = [];
  for (let i = 0; i < 3; i++) {                         // tömbönként pár fa
    const rx = rand01(gx * 13 + i, gy * 13, 71), ry = rand01(gx * 13, gy * 13 + i, 72);
    const x = bx + HOUSE_MARGIN + rx * (ROAD_SPACING - 2 * HOUSE_MARGIN);
    const y = by + HOUSE_MARGIN + ry * (ROAD_SPACING - 2 * HOUSE_MARGIN);
    if (onRoad(x, y)) continue;                          // ne az úton
    out.push({ x, y, r: TREE_R, big: rand01(gx + i, gy, 73) > 0.5 });
  }
  return out;
}
function treesIn(cx, cy, radius) {
  const out = [];
  const g0x = Math.floor((cx - radius) / ROAD_SPACING), g1x = Math.floor((cx + radius) / ROAD_SPACING);
  const g0y = Math.floor((cy - radius) / ROAD_SPACING), g1y = Math.floor((cy + radius) / ROAD_SPACING);
  for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++)
    for (const t of treesInBlock(gx, gy)) if (Math.hypot(t.x - cx, t.y - cy) <= radius) out.push(t);
  return out;
}
function collideTrees(p, pad) {                          // kör-akadály: kitol a sugáron kívülre
  for (const t of treesIn(p.x, p.y, ROAD_SPACING)) {
    const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy), min = t.r + pad;
    if (d < min) {                                       // belül (a középpontban is: adott irányba tolunk)
      const ux = d > 0 ? dx / d : 1, uy = d > 0 ? dy / d : 0;
      p.x = t.x + ux * min; p.y = t.y + uy * min;
    }
  }
}

// minden háznak egy kutya vagy macska, determinisztikusan a seedből; a kezdőpont a ház mellett
const ANIMAL_ROAM = 60;          // ennyit kóborol a kezdőpont körül
function animalFor(h) {
  const kind = (h.seed >>> 20) % 2 ? 'kutya' : 'macska';
  const color = kind === 'kutya' ? '#8a6b4a' : '#9a9a9a';
  return { kind, color, hx: h.x + h.w / 2 + 26, hy: h.y, seed: h.seed };
}
// determinisztikus „séta" a kezdőpont körül (az időből + seedből), korlátos távolságon belül
function animalPose(an, t) {
  const p1 = (an.seed % 7) * 0.3 + 0.6, p2 = ((an.seed >>> 4) % 5) * 0.3 + 0.5;
  return { x: an.hx + Math.sin(t * p1) * ANIMAL_ROAM * 0.8, y: an.hy + Math.cos(t * p2) * ANIMAL_ROAM * 0.8,
           a: Math.atan2(Math.cos(t * p2 + 0.1) - Math.cos(t * p2), Math.sin(t * p1 + 0.1) - Math.sin(t * p1)) };
}
function animalsIn(cx, cy, radius) {                     // a közeli házak állatai (a mostani pózukban)
  const out = [];
  for (const h of housesIn(cx, cy, radius)) { const an = animalFor(h); const p = animalPose(an, time); out.push({ an, x: p.x, y: p.y, a: p.a }); }
  return out;
}

// ===== Játékos =====
// A világ koordináta-rendszere független a képernyőtől; a kamera a játékost követi.
const SPEED = 240;                                   // px / mp
const player = { x: 0, y: 0, a: 0, name: 'Szofi', color: '#2f6fd0', riding: null, inHouse: null, ix: 0, iy: 0, inBed: false, holding: '', sleepT: 0 };
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
    const w = screenToWorldDir(dx, dy);              // a nyilak a képernyőhöz igazodnak
    player.x += w.x * SPEED * dt;
    player.y += w.y * SPEED * dt;
    player.a = Math.atan2(w.y, w.x);
  }
  if (!player.inHouse && !player.riding) { collideHouses(player, 12); collideTrees(player, 10); }
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
  collideTrees(v, 12);
}

const ENTER_RANGE = 46;          // ennyin belül lehet be-/felszállni
function toggleVehicle() {
  if (player.inHouse) return;                             // házban nincs jármű
  if (player.riding) {                                    // kiszállás a jármű mellé
    const v = player.riding;
    setVehicleMoved(v.id, v); saveVehicles();             // a jármű az aktuális helyén marad (mentve)
    player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 24;
    player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 24;
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
function nearestDoor(x, y, range) {
  let best = null, bestD = range;
  for (const h of housesIn(x, y, range * 2)) {
    const d = Math.hypot(h.door.x - x, h.door.y - y);
    if (d < bestD) { bestD = d; best = h; }
  }
  return best;
}
// a szoba leírása a ház típusa szerint: a lakóház berendezett (felirat nélkül),
// a többi egyszerű szoba a típus magyar nevével
const TYPE_LABEL = { gyar: 'Gyár', iskola: 'Iskola', iroda: 'Iroda', bolt: 'Bolt', etterem: 'Étterem' };
function roomFor(type) {
  if (type === 'lakohaz') return { furnished: true, label: '' };
  return { furnished: false, label: TYPE_LABEL[type] || 'Ház' };
}
// belső szoba a ház seedjéből: méret determinisztikus, a kijárat az alsó fal közepén
function enterHouse(h) {
  const rw = 300 + (h.seed % 160), rh = 220 + ((h.seed >> 8) % 140);
  player.inHouse = { house: h, type: h.type || 'lakohaz', room: roomFor(h.type || 'lakohaz'), rw, rh, exit: { x: rw / 2, y: rh - 10 }, back: { x: h.door.x, y: h.door.y } };
  player.ix = rw / 2; player.iy = rh - 40;               // a szobában, a kijárat közelében
}
function leaveHouse() {
  const b = player.inHouse.back;
  player.inHouse = null;
  player.x = b.x; player.y = b.y + 18;                   // az ajtó elé, kifelé
}
function onUse() {
  if (player.inHouse) {
    if (player.inBed) return;                            // alvás alatt nincs más
    const r = player.inHouse, L = bedroomLayout(r.rw, r.rh);
    const near = (z, d) => Math.hypot(player.ix - z.x, player.iy - z.y) < d;
    if (r.room && r.room.furnished) {                    // lakószoba: ágy / szekrény / kijárat
      if (near(L.exit, 40)) { leaveHouse(); return; }
      if (near(L.bed, 44)) { player.inBed = true; player.sleepT = 0; return; }
      let best = null, bd = 42;                          // a legközelebbi tárgy a szekrény körül
      for (const it of L.items) { const d = Math.hypot(player.ix - it.x, player.iy - it.y); if (d < bd) { bd = d; best = it; } }
      if (best) { player.holding = (player.holding === best.name) ? '' : best.name; return; }
      if (near(L.exit, 60)) leaveHouse();
      return;
    }
    if (Math.hypot(player.ix - r.exit.x, player.iy - r.exit.y) < 40) leaveHouse();   // nem lakószoba
    return;
  }
  if (player.riding) { toggleVehicle(); return; }        // járműből kiszállás
  const h = nearestDoor(player.x, player.y, 40);
  if (h) { enterHouse(h); return; }
  toggleVehicle();                                       // különben jármű be-/felszállás
}
// mozgás a belső szobában (külön koordináták: player.ix, player.iy)
function updateInterior(dt) {
  if (!player.inHouse) return;
  const r = player.inHouse;
  if (player.inBed) { player.sleepT += dt; if (player.sleepT > 2.2) player.inBed = false; return; }   // rövid alvás, majd felkel
  let dx = 0, dy = 0;
  if (keys.ArrowLeft) dx -= 1; if (keys.ArrowRight) dx += 1;
  if (keys.ArrowUp) dy -= 1; if (keys.ArrowDown) dy += 1;
  if (dx || dy) { const n = Math.hypot(dx, dy); player.ix += (dx / n) * 180 * dt; player.iy += (dy / n) * 180 * dt; }
  player.ix = Math.max(16, Math.min(r.rw - 16, player.ix));   // a falakon belül
  player.iy = Math.max(16, Math.min(r.rh - 16, player.iy));
}
// a lakószoba bútor-zónái EGY forrásból (rajz + interakció): szoba-lokális koordináták
function bedroomLayout(rw, rh) {
  return {
    bed: { x: 65, y: rh / 2, w: 70, h: rh - 80 },
    rug: { x: rw / 2, y: rh / 2, w: 110, h: 76 },
    wardrobe: { x: rw - 65, y: 90, w: 70, h: 90 },
    items: [
      { name: 'konyv', x: rw - 92, y: 196 },
      { name: 'ceruza', x: rw - 60, y: 196 },
      { name: 'tarsas', x: rw - 40, y: 60 },
      { name: 'maci', x: rw - 40, y: 210 },
    ],
    exit: { x: rw / 2, y: rh - 10 },
  };
}
// egy tárgy kis ikonja (a szobában és a kézben is ezt használjuk)
function drawItem(sx, sy, name) {
  if (name === 'konyv') { ctx.fillStyle = '#8a4fb0'; ctx.fillRect(sx - 10, sy - 7, 20, 14); }
  else if (name === 'ceruza') { const cs = ['#d4453b', '#3f8f54', '#3a6fb0']; cs.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 10, sy - 4 + i * 4); ctx.lineTo(sx + 10, sy - 4 + i * 4); ctx.stroke(); }); }
  else if (name === 'tarsas') { ctx.fillStyle = '#e0b43a'; ctx.fillRect(sx - 10, sy - 10, 20, 20); ctx.strokeStyle = '#7a5e1f'; ctx.lineWidth = 1; ctx.strokeRect(sx - 6, sy - 6, 12, 12); }
  else if (name === 'maci') { ctx.fillStyle = '#9a6b3f'; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(sx, sy - 13, 7, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(sx - 6, sy - 18, 2.5, 0, Math.PI * 2); ctx.arc(sx + 6, sy - 18, 2.5, 0, Math.PI * 2); ctx.fill(); }
}
// a berendezett lakószoba (felülnézet): ox/oy a szoba bal-felső sarka a képernyőn, rw/rh a mérete
function drawBedroom(ox, oy, rw, rh) {
  const L = bedroomLayout(rw, rh);
  // ágy
  const b = L.bed; ctx.fillStyle = '#5a3e2b'; ctx.fillRect(ox + b.x - b.w / 2, oy + b.y - b.h / 2, b.w, b.h);
  ctx.fillStyle = '#c9d6e5'; ctx.fillRect(ox + b.x - b.w / 2 + 6, oy + b.y - b.h / 2 + 6, b.w - 12, 30);
  ctx.fillStyle = '#7fa6d8'; ctx.fillRect(ox + b.x - b.w / 2 + 6, oy + b.y - b.h / 2 + 40, b.w - 12, b.h - 48);
  // szőnyeg
  const g = L.rug; ctx.fillStyle = '#a23c4b'; ctx.fillRect(ox + g.x - g.w / 2, oy + g.y - g.h / 2, g.w, g.h);
  ctx.fillStyle = '#d98a97'; ctx.fillRect(ox + g.x - g.w / 2 + 12, oy + g.y - g.h / 2 + 10, g.w - 24, g.h - 20);
  // szekrény
  const w = L.wardrobe; ctx.fillStyle = '#6b4a30'; ctx.fillRect(ox + w.x - w.w / 2, oy + w.y - w.h / 2, w.w, w.h);
  ctx.fillStyle = '#4a3220'; ctx.fillRect(ox + w.x - 1, oy + w.y - w.h / 2, 2, w.h);
  // tárgyak (amit épp nem tartunk a kézben)
  for (const it of L.items) {
    if (player.holding === it.name) continue;
    drawItem(ox + it.x, oy + it.y, it.name);
  }
}
function drawInterior() {
  const r = player.inHouse;
  ctx.fillStyle = '#2a2320'; ctx.fillRect(0, 0, W, H);
  const ox = W / 2 - r.rw / 2, oy = H / 2 - r.rh / 2;         // a szoba középre
  ctx.fillStyle = '#4b3f36'; ctx.fillRect(ox, oy, r.rw, r.rh);
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(ox + r.exit.x - 26, oy + r.exit.y - 14, 52, 20);   // ajtókeret (nagy)
  ctx.fillStyle = '#4a2f1c'; ctx.fillRect(ox + r.exit.x - 22, oy + r.exit.y - 10, 44, 16);   // ajtólap
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('KIJÁRAT (E)', ox + r.exit.x, oy + r.exit.y + 20);
  if (r.room && r.room.furnished) drawBedroom(ox, oy, r.rw, r.rh);          // lakóház: berendezés (felirat nélkül)
  else if (r.room && r.room.label) {                                        // speciális ház: a típus neve középen
    ctx.fillStyle = '#e8e2d4'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.room.label, ox + r.rw / 2, oy + r.rh / 2);
  }
  drawPerson(ox + player.ix, oy + player.iy, 0, player.color, player.name);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('E: kijárat', 12, 24);
}

// ===== Rajzolás =====
// Izometrikus vetítés (ADR-0006): a világ (x,y) síkját 2:1 izo-ra képezi, a z felfelé tol.
const ISO_X = 0.5, ISO_Y = 0.25;     // vízszintes / függőleges arány (2:1 izometria)
function iso(wx, wy, wz = 0) {
  return { x: (wx - wy) * ISO_X, y: (wx + wy) * ISO_Y - wz };
}
// egy világ-heading (a szög) izometrikus KÉPERNYŐ-szöge – ettől áll mindig a kerekén/lábán
// egy jármű talaj-téglalapjának 4 VILÁG-sarka: len = hossz (menetirány), wid = szélesség;
// a szöggel (a) forgatva. Sorrend: elöl-bal, elöl-jobb, hátul-jobb, hátul-bal.
function vehicleQuad(wx, wy, a, len, wid) {
  const c = Math.cos(a), s = Math.sin(a), hl = len / 2, hw = wid / 2;
  const pt = (lx, ly) => [wx + lx * c - ly * s, wy + lx * s + ly * c];
  return [pt(hl, -hw), pt(hl, hw), pt(-hl, hw), pt(-hl, -hw)];
}
// a világpontot képernyő-koordinátára: a kamera a játékosra centrál (szintén izo)
function worldToScreen(x, y, z = 0) {
  const p = iso(x, y, z), c = iso(player.x, player.y, 0);
  return [p.x - c.x + W / 2, p.y - c.y + H / 2];
}
// képernyő-irány (dx jobbra, dy lefelé) → normált világ-irány, az izo inverze.
// iso: sx=(wx-wy)*ISO_X, sy=(wx+wy)*ISO_Y  → wx = sx/(2*ISO_X)+sy/(2*ISO_Y), wy = sy/(2*ISO_Y)-sx/(2*ISO_X)
function screenToWorldDir(dx, dy) {
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  const wx = dx / (2 * ISO_X) + dy / (2 * ISO_Y);
  const wy = dy / (2 * ISO_Y) - dx / (2 * ISO_X);
  const n = Math.hypot(wx, wy) || 1;
  return { x: wx / n, y: wy / n };
}

// mélység-kulcs a takaráshoz: a vetített y (wx+wy) szerint – kisebb = távolabb = előbb rajzolva
function depthKey(wx, wy) { return (wx + wy) * ISO_Y; }
// a kamera körüli rajzolandók listája (ház/jármű/másik/saját), mélység szerint rendezve
function buildDrawList() {
  const R = (Math.hypot(W, H)) / (2 * ISO_Y) + ROAD_SPACING;   // izo-látótér sugara világban
  const list = [];
  for (const h of housesIn(player.x, player.y, R)) list.push({ type: 'house', wx: h.x, wy: h.y, key: depthKey(h.x, h.y), h });
  for (const t of treesIn(player.x, player.y, R)) list.push({ type: 'fa', wx: t.x, wy: t.y, big: t.big, key: depthKey(t.x, t.y) });
  for (const g of animalsIn(player.x, player.y, R)) list.push({ type: 'allat', wx: g.x, wy: g.y, a: g.a, kind: g.an.kind, color: g.an.color, key: depthKey(g.x, g.y) });
  for (const v of vehiclesIn(player.x, player.y, R)) {
    if (player.riding && player.riding.id === v.id) continue;
    list.push({ type: v.kind === 'lo' ? 'horse' : 'car', wx: v.x, wy: v.y, a: v.a, color: v.color, key: depthKey(v.x, v.y) });
  }
  for (const o of net.others.values()) {
    const key = depthKey(o.x, o.y);
    if (o.car) {                                         // jármű + a rajta ülő másik játékos
      list.push({ type: o.kind === 'lo' ? 'horse' : 'car', wx: o.x, wy: o.y, a: o.a, color: o.color || '#d42020', key });
      list.push({ type: 'person', wx: o.x, wy: o.y, a: o.a, color: o.color || '#d42020', name: o.name, key, rider: true });
    } else {
      list.push({ type: 'person', wx: o.x, wy: o.y, a: o.a, color: o.color || '#d42020', name: o.name, key });
    }
  }
  const pkey = depthKey(player.x, player.y);
  if (player.riding) {                                   // a saját jármű + rajta mi magunk
    const vt = player.riding.kind === 'lo' ? 'horse' : 'car';
    list.push({ type: vt, wx: player.x, wy: player.y, a: player.a, color: player.riding.color, key: pkey, self: true });
    list.push({ type: 'person', wx: player.x, wy: player.y, a: player.a, color: player.color, name: player.name, key: pkey, self: true, rider: true });
  } else {
    list.push({ type: 'player', wx: player.x, wy: player.y, a: player.a, color: player.color, name: player.name, key: pkey, self: true });
  }
  list.sort((a, b) => a.key - b.key);
  return list;
}

// a kereszteződés burkolat-stílusa (0..2), determinisztikusan a rácsindexből
function streetStyle(gx, gy) { return hash32(gx, gy) % 3; }

// izo sokszög kitöltése világ-pontok tömbjéből (z-vel)
function fillIsoPoly(pts, fill) {
  ctx.fillStyle = fill; ctx.beginPath();
  pts.forEach(([wx, wy, wz], i) => { const [sx, sy] = worldToScreen(wx, wy, wz || 0); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
  ctx.closePath(); ctx.fill();
}
const shade = (hex, f) => {                           // szín sötétítése f (0..1) arányban
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const d = c => Math.max(0, Math.round(c * (1 - f)));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
};

// utak izometrikusan: aszfalt sávok a rácsvonalak mentén + felezővonal
function drawStreets() {
  const R = Math.hypot(W, H) / (2 * ISO_Y) + ROAD_SPACING;
  const g0 = Math.floor((player.x - R) / ROAD_SPACING), g1 = Math.ceil((player.x + R) / ROAD_SPACING);
  const h0 = Math.floor((player.y - R) / ROAD_SPACING), h1 = Math.ceil((player.y + R) / ROAD_SPACING);
  for (let gx = g0; gx <= g1; gx++) {                 // függőleges utak (állandó világ-x)
    const rx = gx * ROAD_SPACING;
    fillIsoPoly([[rx - ROAD_HALF, player.y - R], [rx + ROAD_HALF, player.y - R], [rx + ROAD_HALF, player.y + R], [rx - ROAD_HALF, player.y + R]], '#394a5a');
  }
  for (let gy = h0; gy <= h1; gy++) {                 // vízszintes utak (állandó világ-y)
    const ry = gy * ROAD_SPACING;
    fillIsoPoly([[player.x - R, ry - ROAD_HALF], [player.x + R, ry - ROAD_HALF], [player.x + R, ry + ROAD_HALF], [player.x - R, ry + ROAD_HALF]], '#39424d');
  }
}

// egy ház kirajzolása izometrikusan: látható oldalfalak + tető a típus szerint
// típusonkénti jel (az ajtó fölötti kis tábla): rövid címke + szín; a lakóházhoz nincs
function houseSign(type) {
  switch (type) {
    case 'gyar': return { label: 'GY', color: '#8a8f98' };
    case 'iskola': return { label: 'IS', color: '#e0b43a' };
    case 'iroda': return { label: 'IR', color: '#5b7fa6' };
    case 'bolt': return { label: 'BOLT', color: '#3f9e5e' };
    case 'etterem': return { label: 'ÉT', color: '#c7563f' };
    default: return null;                            // lakóház: nincs jel
  }
}

// az izometrikus kamera a -x,-y felől néz: a két kamera felőli oldalfal a 'nx' (x = cx-hw)
// és 'ny' (y = cy-hh). Hátulról előre: előbb 'ny', majd 'nx' (az nx van közelebb a kamerához).
function visibleWalls() { return ['ny', 'nx']; }

function drawHouse(h) {
  const hw = h.w / 2, hh = h.h / 2, z = h.height;
  const poly = (pts, fill, line) => { fillIsoPoly(pts, fill); if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke(); } };
  // csak a két kamera felőli oldalfal (hátulról előre: ny, majd nx) – így nem átlátszó
  // ny fal (y = cy-hh)
  poly([[h.x - hw, h.y - hh, 0], [h.x + hw, h.y - hh, 0], [h.x + hw, h.y - hh, z], [h.x - hw, h.y - hh, z]], h.wall, '#1b1410');
  // nx fal (x = cx-hw)
  poly([[h.x - hw, h.y - hh, 0], [h.x - hw, h.y + hh, 0], [h.x - hw, h.y + hh, z], [h.x - hw, h.y - hh, z]], shade(h.wall, 0.22), '#1b1410');
  // tető
  if (h.roofType === 'lapos') {
    poly([[h.x - hw, h.y - hh, z], [h.x + hw, h.y - hh, z], [h.x + hw, h.y + hh, z], [h.x - hw, h.y + hh, z]], h.roof, '#1b1410');
  } else if (h.roofType === 'sator') {
    const pk = z + 26;
    poly([[h.x - hw, h.y - hh, z], [h.x + hw, h.y - hh, z], [h.x, h.y, pk]], h.roof, '#1b1410');
    poly([[h.x - hw, h.y + hh, z], [h.x - hw, h.y - hh, z], [h.x, h.y, pk]], shade(h.roof, 0.2), '#1b1410');
  } else {
    const pk = z + 22;
    poly([[h.x - hw, h.y - hh, z], [h.x + hw, h.y - hh, z], [h.x + hw, h.y, pk], [h.x - hw, h.y, pk]], h.roof, '#1b1410');
    poly([[h.x - hw, h.y + hh, z], [h.x - hw, h.y, pk], [h.x - hw, h.y - hh, z]], shade(h.roof, 0.2), '#1b1410');
  }
  // NAGY, egyértelmű ajtó a front (ny) falon
  const [dx, dy] = worldToScreen(h.x, h.y - hh, 0);
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(dx - 15, dy - 40, 30, 40);        // világos keret
  ctx.fillStyle = '#4a2f1c'; ctx.fillRect(dx - 11, dy - 36, 22, 36);        // ajtólap
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(dx + 4, dy - 20, 3, 3);           // kilincs
  const sign = houseSign(h.type);
  if (sign) {
    const [lx, ly] = worldToScreen(h.x, h.y - hh, z + 6);
    ctx.fillStyle = sign.color; ctx.fillRect(lx - 14, ly - 12, 28, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(sign.label, lx, ly - 5); ctx.textBaseline = 'alphabetic';
  }
}

function drawCity() {
  drawStreets();
  for (const e of buildDrawList()) {
    if (e.type === 'house') { drawHouse(e.h); continue; }
    const [sx, sy] = worldToScreen(e.wx, e.wy);
    if (e.type === 'fa') drawTree(sx, sy, e.big);
    else if (e.type === 'allat') drawAnimal(sx, sy, e.a, e.kind, e.color);
    else if (e.type === 'car') drawCarSprite(sx, sy, e.a, e.color, e.name);
    else if (e.type === 'horse') drawHorseSprite(sx, sy, e.a, e.color, e.name);
    else if (e.rider) drawPerson(sx, sy - 14, e.a, e.color, e.name);   // a járművön ülő: feljebb, hogy kilátszódjon
    else drawPerson(sx, sy, e.a, e.color, e.name);
  }
}

function drawShadow(sx, sy, rx, ry) {
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx, sy + 6, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawTree(sx, sy, big) {
  drawShadow(sx, sy, big ? 20 : 15, big ? 9 : 7);
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(sx - 4, sy - 22, 8, 22);         // törzs
  ctx.fillStyle = '#3f7d46'; ctx.beginPath(); ctx.ellipse(sx, sy - 34, big ? 26 : 20, big ? 30 : 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4f9a57'; ctx.beginPath(); ctx.ellipse(sx - 6, sy - 40, big ? 14 : 11, big ? 16 : 13, 0, 0, Math.PI * 2); ctx.fill();
}
function drawAnimal(sx, sy, a, kind, color) {
  drawShadow(sx, sy, 10, 5);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(a); ctx.scale(1, 0.7);
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();   // test
  ctx.beginPath(); ctx.arc(10, -2, 4, 0, Math.PI * 2); ctx.fill();          // fej
  if (kind === 'macska') { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-17, -7); ctx.stroke(); }  // macskafarok
  else { ctx.fillRect(-14, -3, 5, 2); }                                     // kutyafarok
  ctx.restore();
}
function nameTag(sx, sy, name) {
  if (!name) return;
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(name, sx, sy - 34);
}
// ember: árnyék, fej, törzs (ruha = color); az irány enyhén jelezve
function drawPerson(sx, sy, a, color, name) {
  drawShadow(sx, sy, 10, 5);
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = color || '#2f6fd0'; ctx.beginPath(); ctx.ellipse(0, -10, 7, 11, 0, 0, Math.PI * 2); ctx.fill();   // törzs/kabát
  ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(0, -22, 6, 0, Math.PI * 2); ctx.fill();                       // fej
  ctx.fillStyle = '#3a2d22'; ctx.fillRect(Math.cos(a) * 3 - 2, -24 + Math.sin(a) * 2, 4, 2);                        // nézési jelzés
  ctx.restore(); nameTag(sx, sy, name);
}
// egy jármű-lokális pontot (lx = menetirány, ly = oldal, lz = magasság) a képernyő-horgonyhoz
// képez: a szöggel a VILÁGBAN forgat, majd izometriába vetít – így a jármű a talajon fekszik (nem dől)
function vehPt(sx, sy, a, lx, ly, lz = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  const wx = lx * c - ly * s, wy = lx * s + ly * c;     // elforgatott világ-eltolás
  return [sx + (wx - wy) * ISO_X, sy + (wx + wy) * ISO_Y - lz];
}
function fillPoly(pts, fill) { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); }

// autó: a talajon fekvő, menetirányba forgatott test (nem dől); kerekek, szélvédő, fényszóró. ~2×
function drawCarSprite(sx, sy, a, color, name) {
  const LEN = 120, WID = 64;                            // 2× akkora, mint korábban
  drawShadow(sx, sy, 44, 22);
  const P = (lx, ly, lz) => vehPt(sx, sy, a, lx, ly, lz);
  // kerekek (a talajon, a test alatt)
  ctx.fillStyle = '#111';
  for (const [lx, ly] of [[LEN * 0.32, -WID / 2], [LEN * 0.32, WID / 2], [-LEN * 0.32, -WID / 2], [-LEN * 0.32, WID / 2]]) {
    const w = P(lx, ly, 0); ctx.beginPath(); ctx.ellipse(w[0], w[1], 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
  // karosszéria teteje (kissé megemelve, hogy legyen térfogata)
  const Z = 16;
  fillPoly([P(LEN / 2, -WID / 2, Z), P(LEN / 2, WID / 2, Z), P(-LEN / 2, WID / 2, Z), P(-LEN / 2, -WID / 2, Z)], color || '#d42020');
  // oldalfalak a talajtól a tetőig (a két kamera felőli él) – sötétebb árnyalat
  fillPoly([P(LEN / 2, WID / 2, 0), P(-LEN / 2, WID / 2, 0), P(-LEN / 2, WID / 2, Z), P(LEN / 2, WID / 2, Z)], shade(color || '#d42020', 0.25));
  fillPoly([P(-LEN / 2, -WID / 2, 0), P(-LEN / 2, WID / 2, 0), P(-LEN / 2, WID / 2, Z), P(-LEN / 2, -WID / 2, Z)], shade(color || '#d42020', 0.4));
  // szélvédő (az első harmadban)
  fillPoly([P(LEN * 0.18, -WID * 0.4, Z), P(LEN * 0.18, WID * 0.4, Z), P(LEN * 0.02, WID * 0.4, Z), P(LEN * 0.02, -WID * 0.4, Z)], '#bfe0ff');
  // fényszórók (az orrnál)
  ctx.fillStyle = '#fff';
  for (const ly of [-WID * 0.3, WID * 0.3]) { const w = P(LEN / 2, ly, Z); ctx.fillRect(w[0] - 2, w[1] - 2, 4, 4); }
  nameTag(sx, sy, name);
}
// ló: a talajon álló, menetirányba forgatott test (nem dől); lábak, nyak+fej, farok. ~2×
function drawHorseSprite(sx, sy, a, color, name) {
  const LEN = 96, WID = 40;
  drawShadow(sx, sy, 34, 16);
  const P = (lx, ly, lz) => vehPt(sx, sy, a, lx, ly, lz);
  const Z = 30;                                         // a hát magassága
  // lábak (a talajtól a hasig, a 4 saroknál)
  ctx.strokeStyle = shade(color || '#8a5a2b', 0.3); ctx.lineWidth = 5;
  for (const [lx, ly] of [[LEN * 0.3, -WID / 2], [LEN * 0.3, WID / 2], [-LEN * 0.3, -WID / 2], [-LEN * 0.3, WID / 2]]) {
    const foot = P(lx, ly, 0), hip = P(lx, ly, Z * 0.7); ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(hip[0], hip[1]); ctx.stroke();
  }
  // test (felső lap, enyhén megemelve)
  fillPoly([P(LEN / 2, -WID / 2, Z), P(LEN / 2, WID / 2, Z), P(-LEN / 2, WID / 2, Z), P(-LEN / 2, -WID / 2, Z)], color || '#8a5a2b');
  fillPoly([P(LEN / 2, WID / 2, Z * 0.7), P(-LEN / 2, WID / 2, Z * 0.7), P(-LEN / 2, WID / 2, Z), P(LEN / 2, WID / 2, Z)], shade(color || '#8a5a2b', 0.25));
  // nyak + fej (az orrnál, feljebb)
  const neck = P(LEN / 2, 0, Z), head = P(LEN * 0.66, 0, Z + 16);
  ctx.strokeStyle = color || '#8a5a2b'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(head[0], head[1]); ctx.stroke();
  ctx.fillStyle = color || '#8a5a2b'; ctx.beginPath(); ctx.ellipse(head[0], head[1], 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  // farok (hátul)
  const tail0 = P(-LEN / 2, 0, Z), tail1 = P(-LEN * 0.66, 0, Z * 0.3);
  ctx.strokeStyle = '#3a2d22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tail0[0], tail0[1]); ctx.lineTo(tail1[0], tail1[1]); ctx.stroke();
  nameTag(sx, sy, name);
}
// visszafelé kompatibilis: a régi drawPlayer most embert rajzol
function drawPlayer(x, y, a, color, name) { const [sx, sy] = worldToScreen(x, y); drawPerson(sx, sy, a, color, name); }

function draw() {
  if (player.inHouse) { drawInterior(); return; }
  ctx.fillStyle = '#17202a'; ctx.fillRect(0, 0, W, H);   // ég/háttér
  drawCity();
  // HUD
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(net.online ? `Online – ${net.others.size + 1} játékos` : 'Offline (egyjátékos)', 12, 22);
  ctx.fillText('Nyilak: mozgás/vezetés   E: ház be/ki, jármű be/felszállás', 12, 40);
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
  if (player.inHouse) {                                // házban: a többiek az ajtónál állva látnak
    const b = player.inHouse.back;
    return { name: player.name, x: Math.round(b.x), y: Math.round(b.y), a: 0, car: false, kind: '', shirt: player.color };
  }
  const riding = player.riding;
  return {
    name: player.name, x: Math.round(player.x), y: Math.round(player.y), a: player.a,
    car: !!riding, kind: riding ? riding.kind : '', shirt: player.color,
  };
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
      o.x = p.x; o.y = p.y; o.a = p.a; o.name = p.name; o.color = p.shirt; o.car = p.car; o.kind = p.kind;
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
let last = 0, time = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;   // nagy ugrásokat levágjuk (háttérből visszatérés)
  last = now;
  time += dt;                                         // globális óra (állatok kóborlása, stb.)
  if (player.inHouse) updateInterior(dt);
  else { updatePlayer(dt); updateDriving(dt); }
  updateNet(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

loadVehicles();                                       // a korábban mozgatott járművek helye
netConnect();                                         // többjátékos mód, ha a saját szerverről fut a játék

// a füstteszt számára (kamu böngészőkörnyezetben eval-eljük ezt a fájlt)
if (typeof global !== 'undefined') {
  global.G = { player, net, netState, netReceive, updatePlayer, keys,
    hash32, rand01, onRoad, nearestRoad, ROAD_SPACING, ROAD_HALF,
    housesIn, housesInBlock, HOUSE_MARGIN,
    HOUSE_WALLS, HOUSE_ROOFS, ROOF_TYPES,
    HOUSE_TYPES, houseType, houseSign,
    pushOutOfRect, collideHouses,
    vehiclesIn, vehiclesInCell,
    treesIn, treesInBlock, collideTrees, TREE_R,
    animalFor, animalPose, animalsIn, ANIMAL_ROAM,
    movedVehicles, setVehicleMoved, saveVehicles, loadVehicles,
    updateVehiclePhysics, VEH,
    toggleVehicle, updateDriving, onUse, ENTER_RANGE,
    enterHouse, leaveHouse, nearestDoor, updateInterior, drawInterior,
    roomFor, TYPE_LABEL, drawBedroom, bedroomLayout, drawItem,
    iso, worldToScreen, ISO_X, ISO_Y, screenToWorldDir, vehicleQuad,
    depthKey, buildDrawList,
    drawPerson, drawCarSprite, drawHorseSprite, drawShadow,
    drawTree, drawAnimal,
    streetStyle, drawStreets, drawHouse, fillIsoPoly, visibleWalls,
    drawCity,
    get W() { return W; }, get H() { return H; } };
}
