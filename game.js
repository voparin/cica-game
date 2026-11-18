'use strict';
// Cica game – minimális játék-csonk (ADR-0001). Tiszta Canvas 2D, nincs build, nincs függőség.
// Ez még nem a kész játék: egy nyilakkal mozgatható játékos-négyzet, és a többi játékos
// kirajzolása a szerverről (ADR-0002). Erre a vázra épül majd a tényleges Cica game.

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
const SPECIAL_WALLS = ['#8a8f98', '#9aa6b2', '#7f93a8', '#86a0a6', '#9c9aa8'];   // hűvös/semleges: a speciális épületeknek
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
    const seed = hash32(gx * 101 + c, gy * 101 + r);
    const type = houseType(seed);
    const special = type !== 'lakohaz';
    // lakóház: kisebb/alacsonyabb + meleg paletta; speciális épület: nagyobb/magasabb + hűvös paletta
    const w = special ? 120 + Math.floor(rand01(gx + c, gy + r, 1) * 50) : 80 + Math.floor(rand01(gx + c, gy + r, 1) * 30);
    const h = special ? 120 + Math.floor(rand01(gx + c, gy + r, 2) * 50) : 80 + Math.floor(rand01(gx + c, gy + r, 2) * 30);
    const cx = x0 + c * cw + cw / 2, cy = y0 + r * ch + ch / 2;
    // az ajtó a tömb legközelebbi széle (út) felé néz
    const toTop = cy - by, toBottom = (by + ROAD_SPACING) - cy, toLeft = cx - bx, toRight = (bx + ROAD_SPACING) - cx;
    const m = Math.min(toTop, toBottom, toLeft, toRight);
    let door;
    if (m === toTop) door = { x: cx, y: cy - h / 2 - 16 };
    else if (m === toBottom) door = { x: cx, y: cy + h / 2 + 16 };
    else if (m === toLeft) door = { x: cx - w / 2 - 16, y: cy };
    else door = { x: cx + w / 2 + 16, y: cy };
    out.push({
      x: cx, y: cy, w, h, door, seed, type,
      wall: special ? SPECIAL_WALLS[seed % SPECIAL_WALLS.length] : HOUSE_WALLS[seed % HOUSE_WALLS.length],
      roof: HOUSE_ROOFS[(seed >>> 3) % HOUSE_ROOFS.length],
      roofType: special ? 'lapos' : ROOF_TYPES[(seed >>> 6) % ROOF_TYPES.length],   // a speciális épület lapos tetős (hivatalos jelleg)
      height: special ? 70 + ((seed >>> 9) % 3) * 16 : 34 + ((seed >>> 9) % 3) * 12,   // speciális magasabb
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
const BARK_RANGE = 130;          // ennyin belül két kutya egymásra ugat
function animalFor(h) {
  const kind = (h.seed >>> 20) % 2 ? 'kutya' : 'macska';
  const color = kind === 'kutya' ? '#8a6b4a' : '#9a9a9a';
  const hx = h.x + h.w / 2 + 26, hy = h.y;
  let tree = null;
  if (kind === 'macska') {                               // a macskához a legközelebbi fa (fára mászáshoz)
    let best = null, bd = 220;
    for (const tr of treesIn(hx, hy, 260)) { const d = Math.hypot(tr.x - hx, tr.y - hy); if (d < bd) { bd = d; best = tr; } }
    tree = best ? { x: best.x, y: best.y } : null;
  }
  return { kind, color, hx, hy, seed: h.seed, house: { x: h.x, y: h.y, w: h.w, h: h.h }, tree };
}
// determinisztikus „séta" a kezdőpont körül; fajfüggő jelleg + seedből vett fáziseltolás,
// hogy mindegyik máshol járjon és máshogy mozogjon; a ház alaprajzából kiszorítjuk (ne másszon a falra)
function animalPose(an, t) {
  const ph1 = (an.seed % 628) / 100, ph2 = ((an.seed >>> 5) % 628) / 100;   // 0..2π fázis
  const vary = 0.75 + (an.seed % 50) / 100;            // 0.75..1.25 egyéni tempó-szorzó
  let x, y, a, moving = true, phase = 0;
  if (an.kind === 'macska') {
    // cica: lassú, kis körzet, meg-megállással (dwell)
    const sp = 0.5 * vary, R = ANIMAL_ROAM * 0.45;
    const ex = Math.sin(t * sp + ph1), ey = Math.sin(t * sp * 0.7 + ph2);
    const dwellx = Math.sign(ex) * Math.pow(Math.abs(ex), 0.5), dwelly = Math.sign(ey) * Math.pow(Math.abs(ey), 0.5);
    x = an.hx + dwellx * R; y = an.hy + dwelly * R;
    const nx = an.hx + Math.sin(t * sp + 0.15 + ph1) * R; a = Math.atan2(0, nx - x);
    phase = t * sp * 4;
  } else {
    // kutya: céltudatos kocogás egy irányba, majd megáll szaglászni, aztán új irány (determinisztikus a seedből + ciklusból)
    const CYC = 4.2 / vary;                              // egy szakasz hossza (kocogás + megállás)
    const walk = 0.72;                                   // a szakasz ennyi hányadában kocog, utána megáll
    const seg = Math.floor(t / CYC), local = (t / CYC) - seg;   // hányadik szakasz, azon belül hol
    const heading = (hash32(an.seed, seg) / 4294967296) * Math.PI * 2;   // a szakasz iránya a seedből
    // a szakasz kezdőpontja: az előző szakaszok elmozdulásainak összege, a ház körül tartva
    const home = (sx, sy) => {                            // korlátos: a kezdőpont (hx,hy) körül
      const dx = sx - an.hx, dy = sy - an.hy, d = Math.hypot(dx, dy), max = ANIMAL_ROAM;
      return d > max ? [an.hx + dx / d * max, an.hy + dy / d * max] : [sx, sy];
    };
    // a szakaszon belül a kocogás-rész elején/vége között interpolálunk (ease), a megállás-részben állunk
    const prog = Math.min(1, local / walk);              // 0..1 a kocogás alatt, 1 a megálláskor
    const ease = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;   // sima gyorsulás/lassulás
    const base = segStart(an, seg);                      // a szakasz eleje (determinisztikus)
    const dist = ANIMAL_ROAM * 0.6;
    let px = base.x + Math.cos(heading) * dist * ease, py = base.y + Math.sin(heading) * dist * ease;
    [px, py] = home(px, py);
    x = px; y = py; a = heading;
    moving = local < walk;                               // a szakasz vége fele megáll (szaglászik)
    phase = moving ? (local / walk) * Math.PI * 6 : 0;   // lépésfázis csak kocogás közben
  }
  // a ház a kezdőponttól balra van; tartsuk a háztól jobbra (sima, egyoldali korlát – nincs átugrás)
  if (an.house) { const edge = an.house.x + an.house.w / 2 + 8; if (x < edge) x = edge; }
  // a macska időnként felmászik a legközelebbi fára (determinisztikus ciklus a seedből + időből)
  let onTree = false;
  if (an.kind === 'macska' && an.tree) {
    const cyc = (t * 0.12 + (an.seed % 100) / 100) % 1;    // ~8 mp-es ciklus, seedből eltolva
    if (cyc > 0.55 && cyc < 0.8) { onTree = true; x = an.tree.x; y = an.tree.y; a = 0; moving = false; }
  }
  return { x, y, a, onTree, moving, phase };
}
// egy kutya-szakasz kezdőpontja: az utóbbi néhány szakasz elmozdulásának összege a ház körül
// (a ház-körüli korlát miatt a régebbi szakaszok hatása elhanyagolható, ezért legfeljebb 8-at nézünk – korlátos költség)
function segStart(an, seg) {
  let x = an.hx, y = an.hy;
  for (let s = Math.max(0, seg - 8); s < seg; s++) {
    const heading = (hash32(an.seed, s) / 4294967296) * Math.PI * 2;
    x += Math.cos(heading) * ANIMAL_ROAM * 0.6; y += Math.sin(heading) * ANIMAL_ROAM * 0.6;
    const dx = x - an.hx, dy = y - an.hy, d = Math.hypot(dx, dy);
    if (d > ANIMAL_ROAM) { x = an.hx + dx / d * ANIMAL_ROAM; y = an.hy + dy / d * ANIMAL_ROAM; }   // a ház körül tartva
  }
  return { x, y };
}
function animalsIn(cx, cy, radius) {                     // a közeli házak állatai (a mostani pózukban)
  const out = [];
  for (const h of housesIn(cx, cy, radius)) { const an = animalFor(h); const p = animalPose(an, time); out.push({ an, x: p.x, y: p.y, a: p.a, onTree: p.onTree, moving: p.moving, phase: p.phase, barking: false }); }
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {   // két közeli kutya egymásra ugat
    if (out[i].an.kind === 'kutya' && out[j].an.kind === 'kutya' && Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < BARK_RANGE) {
      out[i].barking = out[j].barking = true;
      const ang = Math.atan2(out[j].y - out[i].y, out[j].x - out[i].x);   // egymás felé fordulnak
      out[i].a = ang; out[j].a = ang + Math.PI;
    }
  }
  return out;
}

// ===== Játékos =====
// A világ koordináta-rendszere független a képernyőtől; a kamera a játékost követi.
const SPEED = 240;                                   // px / mp
const player = { x: 0, y: 0, a: 0, name: 'Szofi', color: '#2f6fd0', riding: null, inHouse: null, ix: 0, iy: 0, inBed: false, holding: '', sleepT: 0, sitting: null };
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
  if (type === 'lakohaz') return { furnished: true, label: '', type };
  if (type === 'iskola') return { furnished: false, label: 'Iskola', school: true, type };
  if (type === 'etterem') return { furnished: false, label: 'Étterem', dining: true, type };
  if (type === 'bolt') return { furnished: false, label: 'Bolt', shop: true, type };
  if (type === 'iroda') return { furnished: false, label: 'Iroda', work: 'iroda', type };
  if (type === 'gyar') return { furnished: false, label: 'Gyár', work: 'gyar', type };
  return { furnished: false, label: TYPE_LABEL[type] || 'Ház', type };
}
// belső szoba a ház seedjéből: méret determinisztikus, a kijárat az alsó fal közepén
function enterHouse(h) {
  const rw = 300 + (h.seed % 160), rh = 220 + ((h.seed >> 8) % 140);
  player.inHouse = { house: h, type: h.type || 'lakohaz', room: roomFor(h.type || 'lakohaz'), rw, rh, exit: { x: rw / 2, y: rh - 10 }, back: { x: h.door.x, y: h.door.y } };
  player.ix = rw / 2; player.iy = rh - 40;               // a szobában, a kijárat közelében
  player.sitting = null; player.inBed = false;           // belépéskor állva kezdünk
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
    if (r.room && r.room.school) {                       // iskolaterem: pad / kijárat
      if (player.sitting != null) { player.sitting = null; return; }   // ül → feláll
      if (near(L.exit, 40)) { leaveHouse(); return; }
      const S = schoolLayout(r.rw, r.rh);
      let bi = -1, bd = 40;
      for (let i = 0; i < S.desks.length; i++) { const d = Math.hypot(player.ix - S.desks[i].x, player.iy - S.desks[i].y); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) { player.sitting = bi; return; }
      if (near(L.exit, 60)) leaveHouse();
      return;
    }
    if (r.room && r.room.dining) {                       // étterem: asztal / kijárat
      if (player.sitting != null) { player.sitting = null; return; }   // ül → feláll
      if (near(L.exit, 40)) { leaveHouse(); return; }
      const T = restaurantLayout(r.rw, r.rh);
      let bi = -1, bd = 44;
      for (let i = 0; i < T.tables.length; i++) { const d = Math.hypot(player.ix - T.tables[i].x, player.iy - T.tables[i].y); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) { player.sitting = bi; return; }
      if (near(L.exit, 60)) leaveHouse();
      return;
    }
    if (r.room && r.room.work) {                         // iroda/gyár: asztal / kijárat
      if (player.sitting != null) { player.sitting = null; return; }   // ül → feláll
      if (near(L.exit, 40)) { leaveHouse(); return; }
      const T = workLayout(r.rw, r.rh);
      let bi = -1, bd = 44;
      for (let i = 0; i < T.tables.length; i++) { const d = Math.hypot(player.ix - T.tables[i].x, player.iy - T.tables[i].y); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) { player.sitting = bi; return; }
      if (near(L.exit, 60)) leaveHouse();
      return;
    }
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
  // kint: a tárgy letétele/felvétele elsőbbséget élvez
  if (player.holding) { dropHere(player.holding, player.x, player.y); player.holding = ''; return; }
  {
    let best = null, bd = 44;                              // a legközelebbi letett tárgy
    for (const it of groundItems()) { const d = Math.hypot(it.x - player.x, it.y - player.y); if (d < bd) { bd = d; best = it; } }
    if (best) { takeItem(best.id); player.holding = best.name; return; }
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
  if (player.sitting != null) return;                    // ülés közben nincs mozgás (E-vel feláll)
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
// az iskolaterem elrendezése EGY forrásból (rajz + interakció): padok rácsban, tábla elöl, kijárat
function schoolLayout(rw, rh) {
  const cols = 3, rows = 2, desks = [];
  const x0 = 70, y0 = 90, dx = (rw - 140) / (cols - 1), dy = 54;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) desks.push({ x: x0 + c * dx, y: y0 + r * dy, w: 46, h: 26 });
  return { desks, board: { x: rw / 2, y: 34, w: Math.min(220, rw - 80), h: 26 }, exit: { x: rw / 2, y: rh - 10 } };
}
// az étterem elrendezése EGY forrásból (rajz + interakció): asztalok rácsban, kijárat
function restaurantLayout(rw, rh) {
  const tables = [];
  const y0 = 80, dyr = 80, perRow = 2, x0 = rw * 0.3, dxc = rw * 0.4;
  for (let i = 0; i < 4; i++) { const r = Math.floor(i / perRow), c = i % perRow; tables.push({ x: x0 + c * dxc, y: y0 + r * dyr, w: 56, h: 34 }); }
  return { tables, exit: { x: rw / 2, y: rh - 10 } };
}
// a bolt elrendezése: két polc + az áru a polcokon (répa, 3 paradicsom, 3 virsli, 2 uborka)
function shopLayout(rw, rh) {
  const shelves = [{ x: rw / 2, y: 60, w: rw - 120, h: 18 }, { x: rw / 2, y: 120, w: rw - 120, h: 18 }];
  const goods = [];
  const row = (names, sy) => { const n = names.length, x0 = rw / 2 - (n - 1) * 15; names.forEach((nm, i) => goods.push({ name: nm, x: x0 + i * 30, y: sy })); };
  row(['repa', 'repa', 'paradicsom', 'paradicsom', 'paradicsom'], 54);      // felső polc: répa + paradicsom
  row(['virsli', 'virsli', 'virsli', 'uborka', 'uborka'], 114);             // alsó polc: virsli + uborka
  return { shelves, goods, exit: { x: rw / 2, y: rh - 10 } };
}
// munkahely (iroda/gyár) elrendezése: asztalok + székek, leülhető
function workLayout(rw, rh) {
  const tables = [];
  for (let i = 0; i < 3; i++) tables.push({ x: rw * 0.3 + (i % 2) * rw * 0.4, y: 90 + Math.floor(i / 2) * 80, w: 56, h: 34 });
  return { tables, exit: { x: rw / 2, y: rh - 10 } };
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
function drawSchool(ox, oy, rw, rh) {
  const L = schoolLayout(rw, rh);
  // tábla a terem elején (dísz)
  const b = L.board; ctx.fillStyle = '#2f5a3a'; ctx.fillRect(ox + b.x - b.w / 2, oy + b.y - b.h / 2, b.w, b.h);
  ctx.strokeStyle = '#cfe6d2'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(ox + b.x - b.w / 2 + 10, oy + b.y - b.h / 2 + i * 6); ctx.lineTo(ox + b.x - b.w / 2 + 10 + i * 20, oy + b.y - b.h / 2 + i * 6); ctx.stroke(); }
  // padok
  for (const d of L.desks) {
    ctx.fillStyle = '#8a6b43'; ctx.fillRect(ox + d.x - d.w / 2, oy + d.y - d.h / 2, d.w, d.h);          // asztallap
    ctx.fillStyle = '#5a4630'; ctx.fillRect(ox + d.x - d.w / 2, oy + d.y + d.h / 2 - 4, d.w, 4);        // ülőke/él
  }
}
// nyitott könyv (két lap + gerinc), a lapokon az eddig tanult betűk
const BOOK_LETTERS = ['A', 'O', 'I', 'M', 'E'];
function drawOpenBook(cx, cy) {
  ctx.fillStyle = '#6b4a30'; ctx.fillRect(cx - 34, cy - 2, 68, 6);                 // könyvgerinc/alap
  ctx.fillStyle = '#fbf6e9'; ctx.fillRect(cx - 32, cy - 22, 30, 22); ctx.fillRect(cx + 2, cy - 22, 30, 22);   // két lap
  ctx.strokeStyle = '#caa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy); ctx.stroke();   // gerincvonal
  ctx.fillStyle = '#1b1410'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const left = BOOK_LETTERS.slice(0, 3).join(' '), right = BOOK_LETTERS.slice(3).join(' ');
  ctx.fillText(left, cx - 17, cy - 11); ctx.fillText(right, cx + 17, cy - 11);
  ctx.textBaseline = 'alphabetic';
}
function drawRestaurant(ox, oy, rw, rh) {
  const L = restaurantLayout(rw, rh);
  for (const t of L.tables) {
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(ox + t.x - t.w / 2, oy + t.y - t.h / 2, t.w, t.h);          // asztallap
    ctx.fillStyle = '#5a4026'; ctx.fillRect(ox + t.x - t.w / 2, oy + t.y + t.h / 2 - 4, t.w, 4);        // asztal-él
    ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.ellipse(ox + t.x, oy + t.y - 2, 10, 6, 0, 0, Math.PI * 2); ctx.fill();   // kis tányér (üres asztal)
  }
}
// terítés a játékos előtt: hús a tányéron, répa, pohár víz
function drawMeal(cx, cy) {
  // tányér
  ctx.fillStyle = '#f2ece0'; ctx.beginPath(); ctx.ellipse(cx, cy, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c9bfa8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, 20, 12, 0, 0, Math.PI * 2); ctx.stroke();
  // hús a tányéron
  ctx.fillStyle = '#8a4b32'; ctx.beginPath(); ctx.ellipse(cx - 3, cy - 1, 9, 6, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6e3a26'; ctx.beginPath(); ctx.ellipse(cx - 3, cy - 1, 4, 2.5, 0.3, 0, Math.PI * 2); ctx.fill();
  // répa (a tányér mellett jobbra)
  ctx.fillStyle = '#e07b2c'; ctx.beginPath(); ctx.moveTo(cx + 26, cy - 6); ctx.lineTo(cx + 40, cy + 2); ctx.lineTo(cx + 27, cy + 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3f7d46'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 26, cy - 6); ctx.lineTo(cx + 22, cy - 12); ctx.stroke();   // répazöld
  // pohár víz (a tányér mellett balra)
  ctx.fillStyle = '#bfe0ff'; ctx.fillRect(cx - 42, cy - 12, 12, 16);
  ctx.strokeStyle = '#8fb8dd'; ctx.lineWidth = 1; ctx.strokeRect(cx - 42, cy - 12, 12, 16);
}
// egy bolti áru kis ikonja
function drawGood(sx, sy, name) {
  if (name === 'repa') { ctx.fillStyle = '#e07b2c'; ctx.beginPath(); ctx.moveTo(sx - 5, sy - 7); ctx.lineTo(sx + 5, sy - 3); ctx.lineTo(sx - 4, sy + 7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3f7d46'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 5, sy - 7); ctx.lineTo(sx - 8, sy - 12); ctx.stroke(); }
  else if (name === 'paradicsom') { ctx.fillStyle = '#d6342b'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3f7d46'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx, sy - 9); ctx.stroke(); }
  else if (name === 'virsli') { ctx.fillStyle = '#c9705a'; ctx.beginPath(); ctx.ellipse(sx, sy, 8, 3.5, 0.4, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'uborka') { ctx.fillStyle = '#3f7d46'; ctx.beginPath(); ctx.ellipse(sx, sy, 9, 3.5, 0.5, 0, Math.PI * 2); ctx.fill(); }
}
// a bolt: polcok + az áru rajtuk (répa, paradicsom, virsli, uborka)
function drawShop(ox, oy, rw, rh) {
  const L = shopLayout(rw, rh);
  for (const s of L.shelves) { ctx.fillStyle = '#6b5641'; ctx.fillRect(ox + s.x - s.w / 2, oy + s.y - s.h / 2, s.w, s.h); }
  for (const g of L.goods) drawGood(ox + g.x, oy + g.y, g.name);
}
// iroda/gyár: asztalok + székek
function drawWork(ox, oy, rw, rh) {
  const L = workLayout(rw, rh);
  for (const t of L.tables) {
    ctx.fillStyle = '#7a6a52'; ctx.fillRect(ox + t.x - t.w / 2, oy + t.y - t.h / 2, t.w, t.h);          // asztallap
    ctx.fillStyle = '#5a4d3a'; ctx.fillRect(ox + t.x - t.w / 2, oy + t.y + t.h / 2 - 4, t.w, 4);        // asztal-él
    ctx.fillStyle = '#4a4036'; ctx.fillRect(ox + t.x - 8, oy + t.y + t.h / 2 + 4, 16, 10);              // szék
  }
}
// horgolás a játékos előtt: fonalgombolyag + horgolótű + félkész darab
function drawCrochet(cx, cy) {
  ctx.fillStyle = '#d98a3a'; ctx.beginPath(); ctx.arc(cx - 14, cy, 9, 0, Math.PI * 2); ctx.fill();      // fonalgombolyag
  ctx.strokeStyle = '#b06f28'; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx - 23, cy + i * 3); ctx.lineTo(cx - 5, cy + i * 3); ctx.stroke(); }   // fonalvonalak
  ctx.fillStyle = '#e8d9c0'; ctx.fillRect(cx + 2, cy - 6, 20, 12);                                      // félkész horgolt darab
  ctx.strokeStyle = '#c9b48f'; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx + 2 + i * 5, cy - 6); ctx.lineTo(cx + 2 + i * 5, cy + 6); ctx.stroke(); }
  ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 24, cy + 6); ctx.lineTo(cx + 34, cy - 4); ctx.stroke();   // horgolótű
}
// a szoba fejléce: a speciális típus teljes neve + ikon a szoba tetején; a lakóházhoz nincs.
// visszaadja, hogy rajzolt-e fejlécet (igaz = speciális)
function drawRoomHeader(ox, oy, rw, room) {
  const sign = room && room.type ? houseSign(room.type) : null;
  if (!sign) return false;
  ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(sign.label).width, icon = 22, pad = 12, bw = icon + 8 + tw + pad * 2;
  const bx = ox + rw / 2 - bw / 2, by = oy - 30;
  ctx.fillStyle = 'rgba(20,16,12,0.9)'; ctx.fillRect(bx, by, bw, 26);
  ctx.strokeStyle = sign.color; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 26);
  drawHouseIcon(bx + pad + icon / 2, by + 13, icon / 2, sign.icon);
  ctx.fillStyle = '#fff'; ctx.fillText(sign.label, bx + pad + icon + 8, by + 13);
  ctx.textBaseline = 'alphabetic';
  return true;
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
  else if (r.room && r.room.school) drawSchool(ox, oy, r.rw, r.rh);         // iskolaterem: padok + tábla
  else if (r.room && r.room.dining) drawRestaurant(ox, oy, r.rw, r.rh);     // étterem: asztalok
  else if (r.room && r.room.shop) drawShop(ox, oy, r.rw, r.rh);            // bolt: polcok + áru
  else if (r.room && r.room.work) drawWork(ox, oy, r.rw, r.rh);            // iroda/gyár: asztalok
  else if (r.room && r.room.label) {                                        // egyéb speciális ház: a típus neve középen
    ctx.fillStyle = '#e8e2d4'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.room.label, ox + r.rw / 2, oy + r.rh / 2);
  }
  drawRoomHeader(ox, oy, r.rw, r.room);                                      // fejléc: teljes név + ikon (speciális típusnál)
  if (player.inBed) {
    const L = bedroomLayout(r.rw, r.rh);
    drawPerson(ox + L.bed.x, oy + L.bed.y, 0, player.color, player.name, player.holding);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Zzz…', W / 2, H / 2);
  } else if (player.sitting != null && r.room && r.room.school) {
    const S = schoolLayout(r.rw, r.rh), d = S.desks[player.sitting] || S.desks[0];
    drawPerson(ox + d.x, oy + d.y - 14, 0, player.color, player.name, player.holding);   // a padnál ülve
    drawOpenBook(ox + d.x, oy + d.y);                                                     // előtte a nyitott könyv
  } else if (player.sitting != null && r.room && r.room.dining) {
    const T = restaurantLayout(r.rw, r.rh), t = T.tables[player.sitting] || T.tables[0];
    drawPerson(ox + t.x, oy + t.y - 14, 0, player.color, player.name, player.holding);   // az asztalnál ülve
    drawMeal(ox + t.x, oy + t.y);                                                         // előtte a terítés (hús, répa, víz)
  } else if (player.sitting != null && r.room && r.room.work) {
    const T = workLayout(r.rw, r.rh), t = T.tables[player.sitting] || T.tables[0];
    drawPerson(ox + t.x, oy + t.y - 14, 0, player.color, player.name, player.holding);   // az asztalnál ülve
    if (r.room.work === 'iroda') { drawOpenBook(ox + t.x - 10, oy + t.y); drawItem(ox + t.x + 22, oy + t.y, 'ceruza'); }   // iroda: nyitott könyv + ceruza
    else drawCrochet(ox + t.x, oy + t.y);                                                 // gyár: horgolás
  } else {
    drawPerson(ox + player.ix, oy + player.iy, 0, player.color, player.name, player.holding);
  }
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
  for (const g of animalsIn(player.x, player.y, R)) list.push({ type: 'allat', wx: g.x, wy: g.y, a: g.a, kind: g.an.kind, color: g.an.color, onTree: g.onTree, barking: g.barking, key: depthKey(g.x, g.y) });
  for (const it of groundItems()) list.push({ type: 'targy', wx: it.x, wy: it.y, name: it.name, key: depthKey(it.x, it.y) });   // földön lévő tárgyak
  for (const v of vehiclesIn(player.x, player.y, R)) {
    if (player.riding && player.riding.id === v.id) continue;
    list.push({ type: v.kind === 'lo' ? 'horse' : 'car', wx: v.x, wy: v.y, a: v.a, color: v.color, key: depthKey(v.x, v.y) });
  }
  for (const o of net.others.values()) {
    const key = depthKey(o.x, o.y);
    if (o.car) {                                         // jármű + a rajta ülő másik játékos
      list.push({ type: o.kind === 'lo' ? 'horse' : 'car', wx: o.x, wy: o.y, a: o.a, color: o.color || '#d42020', key, moving: true });
      list.push({ type: 'person', wx: o.x, wy: o.y, a: o.a, color: o.color || '#d42020', name: o.name, key, rider: true, hold: o.hold || '' });
    } else {
      list.push({ type: 'person', wx: o.x, wy: o.y, a: o.a, color: o.color || '#d42020', name: o.name, key, hold: o.hold || '', bed: !!o.bed });
    }
  }
  const pkey = depthKey(player.x, player.y);
  if (player.riding) {                                   // a saját jármű + rajta mi magunk
    const vt = player.riding.kind === 'lo' ? 'horse' : 'car';
    list.push({ type: vt, wx: player.x, wy: player.y, a: player.a, color: player.riding.color, key: pkey, self: true, moving: Math.abs(player.riding.speed || 0) > 5 });
    list.push({ type: 'person', wx: player.x, wy: player.y, a: player.a, color: player.color, name: player.name, key: pkey, self: true, rider: true, hold: player.holding });
  } else {
    list.push({ type: 'player', wx: player.x, wy: player.y, a: player.a, color: player.color, name: player.name, key: pkey, self: true, hold: player.holding });
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
const shade = (hex, f) => {                           // f>0 sötétít, f<0 világosít (0..255 közé vágva)
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const d = c => Math.max(0, Math.min(255, Math.round(c * (1 - f))));
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
// típusonkénti jel (az ajtó fölötti tábla): teljes név + szín + ikon-azonosító; a lakóházhoz nincs
function houseSign(type) {
  switch (type) {
    case 'gyar': return { label: 'Gyár', color: '#8a8f98', icon: 'gyar' };
    case 'iskola': return { label: 'Iskola', color: '#e0b43a', icon: 'iskola' };
    case 'iroda': return { label: 'Iroda', color: '#5b7fa6', icon: 'iroda' };
    case 'bolt': return { label: 'Bolt', color: '#3f9e5e', icon: 'bolt' };
    case 'etterem': return { label: 'Étterem', color: '#c7563f', icon: 'etterem' };
    default: return null;                            // lakóház: nincs jel
  }
}
// egy háztípus-ikon kirajzolása (sx,sy) köré, r sugárral – egyszerű, felismerhető vektor
function drawHouseIcon(sx, sy, r, icon) {
  ctx.save(); ctx.translate(sx, sy);
  if (icon === 'gyar') {                               // gyár: épület + kémény füsttel
    ctx.fillStyle = '#5a5f66'; ctx.fillRect(-r, 0, 2 * r, r); ctx.fillRect(r * 0.4, -r * 0.8, r * 0.4, r * 0.8);   // test + kémény
    ctx.fillStyle = '#cfd4da'; ctx.beginPath(); ctx.arc(r * 0.6, -r, r * 0.3, 0, Math.PI * 2); ctx.fill();           // füst
  } else if (icon === 'iskola') {                      // iskola: ballagó-kalap
    ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(r, 0); ctx.lineTo(0, r * 0.3); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();   // tető-rombusz
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-r * 0.5, 0, r, r * 0.4);                                                 // alja
    ctx.strokeStyle = '#e0b43a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r, r * 0.6); ctx.stroke();   // bojt
  } else if (icon === 'iroda') {                       // iroda: épület ablakokkal
    ctx.fillStyle = '#4f6a86'; ctx.fillRect(-r * 0.8, -r, r * 1.6, 2 * r);
    ctx.fillStyle = '#cfe0f0'; for (let yy = -r * 0.7; yy < r * 0.8; yy += r * 0.55) for (let xx = -r * 0.5; xx < r * 0.5; xx += r * 0.55) ctx.fillRect(xx, yy, r * 0.3, r * 0.3);
  } else if (icon === 'bolt') {                        // bolt: bevásárlókosár
    ctx.strokeStyle = '#2f7d4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.4); ctx.lineTo(-r * 0.6, -r * 0.4); ctx.lineTo(-r * 0.3, r * 0.5); ctx.lineTo(r * 0.7, r * 0.5); ctx.lineTo(r, -r * 0.2); ctx.lineTo(-r * 0.4, -r * 0.2); ctx.stroke();   // kosár
    ctx.fillStyle = '#2f7d4a'; ctx.beginPath(); ctx.arc(-r * 0.1, r * 0.8, 1.6, 0, Math.PI * 2); ctx.arc(r * 0.5, r * 0.8, 1.6, 0, Math.PI * 2); ctx.fill();   // kerekek
  } else if (icon === 'etterem') {                     // étterem: villa + kés
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r); ctx.lineTo(-r * 0.4, r); ctx.stroke();                                 // villa nyele
    ctx.beginPath(); ctx.moveTo(-r * 0.7, -r); ctx.lineTo(-r * 0.7, -r * 0.3); ctx.moveTo(-r * 0.1, -r); ctx.lineTo(-r * 0.1, -r * 0.3); ctx.stroke();   // villa foga
    ctx.beginPath(); ctx.moveTo(r * 0.5, -r); ctx.lineTo(r * 0.5, r); ctx.moveTo(r * 0.5, -r); ctx.lineTo(r * 0.8, -r * 0.4); ctx.stroke();               // kés
  }
  ctx.restore();
}

// az izometrikus kamera a -x,-y felől néz, így a kamera felőli (elülső) két oldalfal
// a 'px' (x = cx+hw) és 'py' (y = cy+hh). Hátulról előre: előbb 'px', majd 'py' (a py van elöl).
function visibleWalls() { return ['px', 'py']; }
// melyik oldalon van az ajtó a h.door helye alapján: px/py (elülső, látható) vagy nx/ny (hátsó)
function doorSide(h) {
  const dx = h.door.x - h.x, dy = h.door.y - h.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'px' : 'nx';
  return dy >= 0 ? 'py' : 'ny';
}
// az ajtó 4 VILÁG-sarka a fal síkjában (ezért fekszik a falon, nem áll ki)
const DOOR_W = 22, DOOR_H = 42;  // ajtó szélesség (a fal mentén) és magasság (z)
function doorQuad(h, side) {
  const hw = h.w / 2, hh = h.h / 2, d = DOOR_W / 2, Z = Math.min(DOOR_H, h.height - 4);
  if (side === 'py') { const y = h.y + hh; return [[h.x - d, y, 0], [h.x + d, y, 0], [h.x + d, y, Z], [h.x - d, y, Z]]; }
  if (side === 'px') { const x = h.x + hw; return [[x, h.y - d, 0], [x, h.y + d, 0], [x, h.y + d, Z], [x, h.y - d, Z]]; }
  if (side === 'ny') { const y = h.y - hh; return [[h.x - d, y, 0], [h.x + d, y, 0], [h.x + d, y, Z], [h.x - d, y, Z]]; }
  const x = h.x - hw; return [[x, h.y - d, 0], [x, h.y + d, 0], [x, h.y + d, Z], [x, h.y - d, Z]];   // nx
}

// a lakóház otthonos jegyei: kémény a tetőn + kis kertkapu az ajtó előtt
function drawHomeDetails(h) {
  const hw = h.w / 2, hh = h.h / 2, z = h.height;
  // kémény a tető hátsó sarka közelében (kis füsttel)
  const [kx, ky] = worldToScreen(h.x + hw * 0.5, h.y - hh * 0.5, z + 12);
  ctx.fillStyle = '#6b4a30'; ctx.fillRect(kx - 3, ky - 10, 6, 14);
  ctx.fillStyle = 'rgba(210,210,210,0.7)'; ctx.beginPath(); ctx.arc(kx, ky - 14, 4, 0, Math.PI * 2); ctx.fill();
  // kis kertkapu az ajtó (h.door) előtt
  const [gx, gy] = worldToScreen(h.door.x, h.door.y, 0);
  ctx.strokeStyle = '#caa36f'; ctx.lineWidth = 2;
  ctx.strokeRect(gx - 12, gy - 6, 24, 10);                                   // kerítés-keret
  ctx.beginPath(); for (let i = -8; i <= 8; i += 4) { ctx.moveTo(gx + i, gy - 6); ctx.lineTo(gx + i, gy + 4); } ctx.stroke();   // léckerítés
}
function drawHouse(h) {
  const hw = h.w / 2, hh = h.h / 2, z = h.height;
  const poly = (pts, fill, line) => { fillIsoPoly(pts, fill); if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke(); } };
  const wline = (a, b, col) => { const [ax, ay] = worldToScreen(a[0], a[1], a[2] || 0), [bx, by] = worldToScreen(b[0], b[1], b[2] || 0); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
  // csak a két kamera felőli (elülső) oldalfal – hátulról előre: px, majd py
  // px fal (x = cx+hw), a jobb oldali
  poly([[h.x + hw, h.y - hh, 0], [h.x + hw, h.y + hh, 0], [h.x + hw, h.y + hh, z], [h.x + hw, h.y - hh, z]], shade(h.wall, 0.22), '#1b1410');
  // py fal (y = cy+hh), a kamerához legközelebbi front-fal
  poly([[h.x - hw, h.y + hh, 0], [h.x + hw, h.y + hh, 0], [h.x + hw, h.y + hh, z], [h.x - hw, h.y + hh, z]], h.wall, '#1b1410');
  // tető
  if (h.roofType === 'lapos') {
    poly([[h.x - hw, h.y - hh, z], [h.x + hw, h.y - hh, z], [h.x + hw, h.y + hh, z], [h.x - hw, h.y + hh, z]], h.roof, '#1b1410');
    const lo = shade(h.roof, -0.12);                    // világosabb perem (tetőszegély)
    for (let k = 1; k <= 3; k++) { const yy = h.y - hh + (2 * hh) * k / 4; wline([h.x - hw, yy, z], [h.x + hw, yy, z], lo); }   // burkolat-vonalak
    wline([h.x - hw + 4, h.y - hh + 4, z], [h.x + hw - 4, h.y - hh + 4, z], lo);
  } else if (h.roofType === 'sator') {                  // négy lapú sátortető egy csúcsba
    const pk = z + 26;
    poly([[h.x - hw, h.y - hh, z], [h.x + hw, h.y - hh, z], [h.x, h.y, pk]], shade(h.roof, 0.25), '#1b1410');   // hátsó
    poly([[h.x - hw, h.y - hh, z], [h.x - hw, h.y + hh, z], [h.x, h.y, pk]], shade(h.roof, 0.12), '#1b1410');   // bal
    poly([[h.x + hw, h.y - hh, z], [h.x + hw, h.y + hh, z], [h.x, h.y, pk]], shade(h.roof, 0.18), '#1b1410');   // jobb
    poly([[h.x - hw, h.y + hh, z], [h.x + hw, h.y + hh, z], [h.x, h.y, pk]], h.roof, '#1b1410');                // elülső
    const ed = shade(h.roof, 0.4);                      // élek a sarkoktól a csúcsig
    for (const [cx2, cy2] of [[h.x - hw, h.y - hh], [h.x + hw, h.y - hh], [h.x - hw, h.y + hh], [h.x + hw, h.y + hh]]) wline([cx2, cy2, z], [h.x, h.y, pk], ed);
  } else {                                              // nyereg: gerinc az x tengely mentén (y=cy), két lap
    const pk = z + 22;
    poly([[h.x - hw, h.y - hh, z], [h.x + hw, h.y - hh, z], [h.x + hw, h.y, pk], [h.x - hw, h.y, pk]], shade(h.roof, 0.22), '#1b1410');  // hátsó lap
    poly([[h.x - hw, h.y + hh, z], [h.x + hw, h.y + hh, z], [h.x + hw, h.y, pk], [h.x - hw, h.y, pk]], h.roof, '#1b1410');               // elülső lap
    wline([h.x - hw, h.y, pk], [h.x + hw, h.y, pk], shade(h.roof, -0.2));   // gerinc (világos)
    const sh = shade(h.roof, 0.3);                      // cserépsorok az elülső lapon
    for (let k = 1; k <= 3; k++) { const yy = h.y + (hh) * k / 4, zz = pk - (pk - z) * k / 4; wline([h.x - hw, yy, zz], [h.x + hw, yy, zz], sh); }
  }
  if (h.type === 'lakohaz') drawHomeDetails(h);          // otthonos jegyek: kémény + kertkapu
  // NAGY ajtó a valódi bejárat (h.door) oldalán
  const side = doorSide(h);
  if (side === 'py' || side === 'px') {                 // látható (elülső) falon: a fal síkjában fekvő ajtó
    const q = doorQuad(h, side);
    fillIsoPoly(q, '#e8d9a0');                           // világos keret (a teljes ajtónyílás)
    const inset = q.map((p, i) => {                      // kicsit beljebb: az ajtólap
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4, cz = (q[0][2] + q[2][2]) / 2;
      return [p[0] + (cx - p[0]) * 0.18, p[1] + (cy - p[1]) * 0.18, p[2] + (cz - p[2]) * 0.18];
    });
    fillIsoPoly(inset, '#4a2f1c');                        // ajtólap
  } else {                                              // hátsó (nem látható) falon: jelző a bejárat irányába
    const [ax, ay] = worldToScreen(h.door.x, h.door.y, z + 18);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(ax, ay + 8); ctx.lineTo(ax - 7, ay - 4); ctx.lineTo(ax + 7, ay - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1410'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('bejárat', ax, ay - 8);
  }
  const sign = houseSign(h.type);
  if (sign) {                                           // tábla a tető fölött: ikon + teljes név
    const [lx, ly] = worldToScreen(h.x, h.y + hh, z + 10);
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(sign.label).width, pad = 8, icon = 16, bw = icon + 6 + tw + pad * 2, bx = lx - bw / 2, by = ly - 22;
    ctx.fillStyle = 'rgba(20,16,12,0.82)'; ctx.fillRect(bx, by, bw, 22);     // sötét tábla-háttér (olvasható)
    ctx.strokeStyle = sign.color; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 22);
    drawHouseIcon(bx + pad + icon / 2, by + 11, icon / 2, sign.icon);        // ikon balra
    ctx.fillStyle = '#fff'; ctx.fillText(sign.label, bx + pad + icon + 6, by + 11);   // teljes név
    ctx.textBaseline = 'alphabetic';
  }
}

function drawCity() {
  drawStreets();
  for (const e of buildDrawList()) {
    if (e.type === 'house') { drawHouse(e.h); continue; }
    const [sx, sy] = worldToScreen(e.wx, e.wy);
    if (e.type === 'fa') drawTree(sx, sy, e.big);
    else if (e.type === 'targy') drawItem(sx, sy, e.name);
    else if (e.type === 'allat') drawAnimal(sx, sy, e.a, e.kind, e.color, { onTree: e.onTree, barking: e.barking, phase: e.phase, moving: e.moving });
    else if (e.type === 'car') drawCarSprite(sx, sy, e.a, e.color, e.name);
    else if (e.type === 'horse') drawHorseSprite(sx, sy, e.a, e.color, e.name, { moving: e.moving });
    else if (e.rider) drawPerson(sx, sy - 14, e.a, e.color, e.name, e.hold);   // a járművön ülő: feljebb, hogy kilátszódjon
    else {
      drawPerson(sx, sy, e.a, e.color, e.name, e.hold);
      if (e.bed) { ctx.fillStyle = '#cfe'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('alszik', sx, sy + 16); }
    }
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
function drawAnimal(sx, sy, a, kind, color, flags) {
  flags = flags || {};
  if (kind === 'kutya') { drawDog(sx, sy, a, color, flags); return; }
  const up = flags.onTree ? 38 : 0;                      // a fán ülő macska a lombnál (feljebb)
  const y = sy - up;
  if (!flags.onTree) drawShadow(sx, sy, 10, 5);
  ctx.save(); ctx.translate(sx, y); ctx.rotate(a); ctx.scale(1, 0.7);
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();   // test
  ctx.beginPath(); ctx.arc(10, -2, 4, 0, Math.PI * 2); ctx.fill();          // fej
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-17, -7); ctx.stroke();   // macskafarok
  ctx.restore();
}
// kutya: a talajon álló, menetirányba forgatott, 4 lábbal (járás-animáció), test, fej, fülek, farok
function drawDog(sx, sy, a, color, flags) {
  flags = flags || {};
  const LEN = 54, WID = 22, Z = 20, col = color || '#8a6b4a';
  drawShadow(sx, sy, 24, 11);
  const P = (lx, ly, lz) => vehPt(sx, sy, a, lx, ly, lz);
  const ph = flags.phase || 0, amp = flags.moving === false ? 0 : 1;   // állóban nem lép
  // 4 láb: átlós párok ellenfázisban (ügetés), a lépéskor előre-hátra leng
  const legs = [[LEN * 0.3, -WID / 2, 0], [LEN * 0.3, WID / 2, Math.PI], [-LEN * 0.3, -WID / 2, Math.PI], [-LEN * 0.3, WID / 2, 0]];
  ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = 4;
  for (const [lx, ly, pp] of legs) {
    const swing = Math.sin(ph + pp) * 6 * amp;                              // a láb előre-hátra leng
    const foot = P(lx + swing, ly, 0), hip = P(lx, ly, Z * 0.6);
    ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(hip[0], hip[1]); ctx.stroke();
  }
  // test (felső lap, enyhén megemelve)
  fillPoly([P(LEN / 2, -WID / 2, Z), P(LEN / 2, WID / 2, Z), P(-LEN / 2, WID / 2, Z), P(-LEN / 2, -WID / 2, Z)], col);
  fillPoly([P(LEN / 2, WID / 2, Z * 0.6), P(-LEN / 2, WID / 2, Z * 0.6), P(-LEN / 2, WID / 2, Z), P(LEN / 2, WID / 2, Z)], shade(col, 0.22));   // oldal
  // nyak + fej (az orrnál, kissé lejjebb hajtva)
  const head = P(LEN * 0.6, 0, Z + 6);
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(head[0], head[1], 8, 6, 0, 0, Math.PI * 2); ctx.fill();   // fej
  const snout = P(LEN * 0.78, 0, Z + 3); ctx.beginPath(); ctx.ellipse(snout[0], snout[1], 4, 3, 0, 0, Math.PI * 2); ctx.fill();   // orr
  // fülek
  ctx.fillStyle = shade(col, 0.25);
  const e1 = P(LEN * 0.5, -6, Z + 12), e2 = P(LEN * 0.5, 6, Z + 12);
  ctx.beginPath(); ctx.arc(e1[0], e1[1], 3, 0, Math.PI * 2); ctx.arc(e2[0], e2[1], 3, 0, Math.PI * 2); ctx.fill();
  // farok (hátul, felfelé csapva; mozgás közben csóvál)
  const wag = Math.sin(ph * 1.5) * 4 * amp;
  const t0 = P(-LEN / 2, 0, Z), t1 = P(-LEN * 0.72, wag, Z + 10);
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
  if (flags.barking) {                                   // „Vau!" buborék
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(sx + 18, sy - 24, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1410'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Vau!', sx + 18, sy - 24); ctx.textBaseline = 'alphabetic';
  }
}
function nameTag(sx, sy, name) {
  if (!name) return;
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(name, sx, sy - 34);
}
// ember: árnyék, fej, törzs (ruha = color); az irány enyhén jelezve
function drawPerson(sx, sy, a, color, name, holding) {
  drawShadow(sx, sy, 10, 5);
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = color || '#2f6fd0'; ctx.beginPath(); ctx.ellipse(0, -10, 7, 11, 0, 0, Math.PI * 2); ctx.fill();   // törzs/kabát
  ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(0, -22, 6, 0, Math.PI * 2); ctx.fill();                       // fej
  ctx.fillStyle = '#3a2d22'; ctx.fillRect(Math.cos(a) * 3 - 2, -24 + Math.sin(a) * 2, 4, 2);                        // nézési jelzés
  ctx.restore();
  if (holding) drawItem(sx + 12, sy - 8, holding);       // a kézben tartott tárgy
  nameTag(sx, sy, name);
}
// egy jármű-lokális pontot (lx = menetirány, ly = oldal, lz = magasság) a képernyő-horgonyhoz
// képez: a szöggel a VILÁGBAN forgat, majd izometriába vetít – így a jármű a talajon fekszik (nem dől)
function vehPt(sx, sy, a, lx, ly, lz = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  const wx = lx * c - ly * s, wy = lx * s + ly * c;     // elforgatott világ-eltolás
  return [sx + (wx - wy) * ISO_X, sy + (wx + wy) * ISO_Y - lz];
}
function fillPoly(pts, fill) { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); }

// autó: rendes KABRIÓ a talajon, menetirányba forgatva (nem dől); test, motorháztető,
// nyitott utastér két üléssel, szélvédő, kerekek, fényszóró
function drawCarSprite(sx, sy, a, color, name) {
  const LEN = 120, WID = 60, col = color || '#d42020';
  const BELT = 20;                                       // a karosszéria „övvonala" (oldalmagasság)
  drawShadow(sx, sy, 46, 22);
  const P = (lx, ly, lz) => vehPt(sx, sy, a, lx, ly, lz);
  const hl = LEN / 2, hw = WID / 2;
  // kerekek (a talajon, a test alatt), kissé kiállva
  ctx.fillStyle = '#111';
  for (const [lx, ly] of [[hl * 0.6, -hw - 2], [hl * 0.6, hw + 2], [-hl * 0.6, -hw - 2], [-hl * 0.6, hw + 2]]) {
    const w = P(lx, ly, 3); ctx.beginPath(); ctx.ellipse(w[0], w[1], 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  }
  // oldalfalak (mind a 4, hátulról előre a kamerához: -y, -x, +x, +y) – legyen térfogata minden irányból
  const side = (p0, p1, dark) => fillPoly([P(p0[0], p0[1], 0), P(p1[0], p1[1], 0), P(p1[0], p1[1], BELT), P(p0[0], p0[1], BELT)], shade(col, dark));
  side([hl, -hw], [-hl, -hw], 0.1);                      // hátsó-bal oldal (távolabb)
  side([hl, -hw], [hl, hw], 0.18);                       // eleje (orr)
  side([-hl, -hw], [-hl, hw], 0.34);                     // hátulja (far)
  side([hl, hw], [-hl, hw], 0.26);                       // kamera felőli oldal
  // alsó karosszéria-lap (övvonal magasságában)
  fillPoly([P(hl, -hw, BELT), P(hl, hw, BELT), P(-hl, hw, BELT), P(-hl, -hw, BELT)], col);
  // motorháztető elöl + csomagtartó hátul (kissé lejtve, hogy legyen eleje/hátulja)
  fillPoly([P(hl, -hw, BELT), P(hl, hw, BELT), P(hl * 0.35, hw * 0.9, BELT + 6), P(hl * 0.35, -hw * 0.9, BELT + 6)], shade(col, -0.06));   // motorháztető
  fillPoly([P(-hl, -hw, BELT), P(-hl, hw, BELT), P(-hl * 0.35, hw * 0.9, BELT + 5), P(-hl * 0.35, -hw * 0.9, BELT + 5)], shade(col, 0.05)); // csomagtartó
  // NYITOTT utastér (a középső rész besüllyesztve, sötét belső) = kabrió
  fillPoly([P(hl * 0.32, -hw * 0.8, BELT + 6), P(hl * 0.32, hw * 0.8, BELT + 6), P(-hl * 0.32, hw * 0.8, BELT + 5), P(-hl * 0.32, -hw * 0.8, BELT + 5)], '#2a2320');
  ctx.fillStyle = '#5a4636';                             // két ülés
  for (const lx of [hl * 0.12, -hl * 0.12]) { const s0 = P(lx, 0, BELT + 10); ctx.beginPath(); ctx.ellipse(s0[0], s0[1], 7, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  // szélvédő (áttetsző, a utastér eleje, kissé megdöntve felfelé)
  fillPoly([P(hl * 0.34, -hw * 0.8, BELT + 6), P(hl * 0.34, hw * 0.8, BELT + 6), P(hl * 0.22, hw * 0.7, BELT + 20), P(hl * 0.22, -hw * 0.7, BELT + 20)], 'rgba(190,224,255,0.75)');
  // fényszórók az orron
  ctx.fillStyle = '#fff';
  for (const ly of [-hw * 0.6, hw * 0.6]) { const w = P(hl, ly, BELT * 0.6); ctx.fillRect(w[0] - 2.5, w[1] - 2.5, 5, 5); }
  nameTag(sx, sy, name);
}
// ló: a talajon álló, menetirányba forgatott test (nem dől); lábak, nyak+fej, farok. ~2×
// ló (Szilaj-szerű): ívelt nyak, fej orral, lobogó sörény + farok, 4 láb ügetés-animációval
function drawHorseSprite(sx, sy, a, color, name, flags) {
  flags = flags || {};
  const LEN = 104, WID = 40, Z = 36, col = color || '#c08a4a';   // meleg, Szilaj-szerű tónus
  const mane = '#5a3a1e';                                         // sötét sörény/farok
  drawShadow(sx, sy, 38, 18);
  const P = (lx, ly, lz) => vehPt(sx, sy, a, lx, ly, lz);
  const ph = flags.moving === false ? 0 : (time * 7);            // ügetés-fázis (állóban nincs lépés)
  const amp = flags.moving === false ? 0 : 1;
  // 4 láb: átlós párok ellenfázisban (ügetés), a lépéskor előre-hátra leng
  ctx.strokeStyle = shade(col, 0.35); ctx.lineWidth = 6;
  const legs = [[LEN * 0.32, -WID / 2, 0], [LEN * 0.32, WID / 2, Math.PI], [-LEN * 0.34, -WID / 2, Math.PI], [-LEN * 0.34, WID / 2, 0]];
  for (const [lx, ly, pp] of legs) {
    const swing = Math.sin(ph + pp) * 8 * amp, lift = Math.max(0, Math.sin(ph + pp)) * 5 * amp;
    const foot = P(lx + swing, ly, lift), hip = P(lx, ly, Z * 0.62);
    ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(hip[0], hip[1]); ctx.stroke();
  }
  // test (izmos törzs: felső lap + oldal)
  fillPoly([P(LEN / 2, -WID / 2, Z), P(LEN / 2, WID / 2, Z), P(-LEN / 2, WID / 2, Z), P(-LEN / 2, -WID / 2, Z)], col);
  fillPoly([P(LEN / 2, WID / 2, Z * 0.55), P(-LEN / 2, WID / 2, Z * 0.55), P(-LEN / 2, WID / 2, Z), P(LEN / 2, WID / 2, Z)], shade(col, 0.22));
  fillPoly([P(LEN / 2, -WID / 2, Z * 0.55), P(LEN / 2, WID / 2, Z * 0.55), P(LEN / 2, WID / 2, Z), P(LEN / 2, -WID / 2, Z)], shade(col, 0.12));   // mellkas eleje
  // ívelt nyak (a törzs elejétől felfelé-előre) + fej orral
  const base = P(LEN * 0.42, 0, Z), withers = P(LEN * 0.5, 0, Z + 18), poll = P(LEN * 0.66, 0, Z + 22), head = P(LEN * 0.78, 0, Z + 14), muzzle = P(LEN * 0.9, 0, Z + 6);
  ctx.strokeStyle = col; ctx.lineWidth = 13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(withers[0], withers[1]); ctx.lineTo(poll[0], poll[1]); ctx.stroke();   // ívelt nyak
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(poll[0], poll[1]); ctx.lineTo(head[0], head[1]); ctx.lineTo(muzzle[0], muzzle[1]); ctx.stroke();   // fej + orr
  ctx.lineCap = 'butt';
  // fülek
  ctx.fillStyle = col; const ear = P(LEN * 0.64, 0, Z + 30); ctx.beginPath(); ctx.moveTo(ear[0] - 3, ear[1]); ctx.lineTo(ear[0], ear[1] - 7); ctx.lineTo(ear[0] + 3, ear[1]); ctx.closePath(); ctx.fill();
  // sörény (a nyak ívén végig, lobog)
  ctx.strokeStyle = mane; ctx.lineWidth = 4;
  for (let k = 0; k <= 4; k++) { const u = k / 4, mx = base[0] + (poll[0] - base[0]) * u, my = base[1] + (poll[1] - base[1]) * u; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 4, my + 7 + Math.sin(ph + k) * 2 * amp); ctx.stroke(); }
  // farok (hátul, lobogó)
  const t0 = P(-LEN / 2, 0, Z), t1 = P(-LEN * 0.74, Math.sin(ph) * 3 * amp, Z * 0.2);
  ctx.strokeStyle = mane; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.quadraticCurveTo((t0[0] + t1[0]) / 2 - 6, (t0[1] + t1[1]) / 2, t1[0], t1[1]); ctx.stroke(); ctx.lineCap = 'butt';
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
  ctx.fillText('Nyilak: mozgás/vezetés   E: ' + (player.holding ? 'tárgy letétele' : 'ház/jármű/tárgy'), 12, 40);
}

// ===== Többjátékos mód (ADR-0002) =====
// Csak a játékos helyzete utazik; a világ (itt még csak a rács) képletből mindenhol egyezik.
// A protokoll megegyezik a szerverével: küldés { t:'state', s:{...} }, fogadás
// { t:'hello', id } és { t:'players', list:[...] }.
const NET_SEND = 0.1;                                 // ennyi időnként küldjük a helyzetünket (mp)
// A felhős (Cloud Run) szerver címe – az első „gcloud run deploy” után töltsd ki a kapott
// wss://cica-game-….run.app címmel, hogy a GitHub Pages-en is legyen többjátékos mód.
const NET_SERVER = 'wss://cica-game-666815233922.europe-west1.run.app';
const net = { ws: null, id: 0, online: false, others: new Map(), sendT: 0, tries: 0, items: [] };

function netState() {                                 // amit a többiek látnak belőlünk
  if (player.inHouse) {                                // házban: a többiek az ajtónál állva látnak
    const b = player.inHouse.back;
    return { name: player.name, x: Math.round(b.x), y: Math.round(b.y), a: 0, car: false, kind: '', shirt: player.color, hold: player.holding || '', bed: !!player.inBed };
  }
  const riding = player.riding;
  return {
    name: player.name, x: Math.round(player.x), y: Math.round(player.y), a: player.a,
    car: !!riding, kind: riding ? riding.kind : '', shirt: player.color, hold: player.holding || '', bed: false,
  };
}

// letett tárgyak hálózati rétege: a szerver megosztott listájához
function buildDrop(name, x, y) { return { t: 'drop', name, x: Math.round(x), y: Math.round(y) }; }
function buildTake(id) { return { t: 'take', id }; }
function netDrop(name, x, y) { if (net.online && net.ws) { try { net.ws.send(JSON.stringify(buildDrop(name, x, y))); return true; } catch (e) { /* a következő körben */ } } return false; }
function netTake(id) { if (net.online && net.ws) { try { net.ws.send(JSON.stringify(buildTake(id))); return true; } catch (e) { /* a következő körben */ } } return false; }

// offline (nincs szerver, pl. GitHub Pages): a letett tárgyak helyben, localStorage-ban
const LOCAL_ITEMS_KEY = 'cica.items';
let localDropped = [], localItemId = 1;
try { const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_ITEMS_KEY)) || null; if (raw) { localDropped = JSON.parse(raw) || []; localItemId = localDropped.reduce((m, it) => Math.max(m, it.id || 0), 0) + 1; } } catch (e) { /* üres/hibás */ }
function saveLocalItems() { try { if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(localDropped)); } catch (e) { /* nem kritikus */ } }
function groundItems() { return net.online ? net.items : localDropped; }   // amit a földön látunk / kereshetünk
function dropHere(name, x, y) {                        // egységes letétel: online → szerver; offline → helyi
  if (net.online && net.ws) { netDrop(name, x, y); return; }
  localDropped.push({ id: localItemId++, name, x: Math.round(x), y: Math.round(y) }); saveLocalItems();
}
function takeItem(id) {                                // egységes felvétel az id alapján
  if (net.online && net.ws) { netTake(id); return; }
  const i = localDropped.findIndex(it => it.id === id); if (i >= 0) { localDropped.splice(i, 1); saveLocalItems(); }
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
  if (m.t === 'items' && Array.isArray(m.list)) { net.items = m.list; return; }   // a földön lévő tárgyak megosztott listája
  if (m.t === 'players' && Array.isArray(m.list)) {
    const seen = new Set();
    for (const p of m.list) {
      if (!p || p.id === net.id) continue;            // magunkat nem rajzoljuk kétszer
      seen.add(p.id);
      const o = net.others.get(p.id) || {};
      o.x = p.x; o.y = p.y; o.a = p.a; o.name = p.name; o.color = p.shirt; o.car = p.car; o.kind = p.kind; o.hold = p.hold; o.bed = p.bed;
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
    buildDrop, buildTake, netDrop, netTake,
    get localDropped() { return localDropped; }, dropHere, takeItem, groundItems,
    hash32, rand01, onRoad, nearestRoad, ROAD_SPACING, ROAD_HALF,
    housesIn, housesInBlock, HOUSE_MARGIN,
    HOUSE_WALLS, HOUSE_ROOFS, ROOF_TYPES, SPECIAL_WALLS,
    HOUSE_TYPES, houseType, houseSign,
    pushOutOfRect, collideHouses,
    vehiclesIn, vehiclesInCell,
    treesIn, treesInBlock, collideTrees, TREE_R,
    animalFor, animalPose, animalsIn, ANIMAL_ROAM, BARK_RANGE, segStart,
    movedVehicles, setVehicleMoved, saveVehicles, loadVehicles,
    updateVehiclePhysics, VEH,
    toggleVehicle, updateDriving, onUse, ENTER_RANGE,
    enterHouse, leaveHouse, nearestDoor, updateInterior, drawInterior,
    roomFor, TYPE_LABEL, drawBedroom, bedroomLayout, drawItem, schoolLayout, drawSchool, drawOpenBook, BOOK_LETTERS, restaurantLayout, drawRestaurant, drawMeal, shopLayout, workLayout, drawShop, drawWork, drawCrochet, drawGood, drawRoomHeader,
    iso, worldToScreen, ISO_X, ISO_Y, screenToWorldDir, vehicleQuad,
    depthKey, buildDrawList,
    drawPerson, drawCarSprite, drawHorseSprite, drawShadow,
    drawTree, drawAnimal, drawDog,
    streetStyle, drawStreets, drawHouse, fillIsoPoly, visibleWalls, doorSide, doorQuad, drawHouseIcon, drawHomeDetails,
    drawCity,
    get W() { return W; }, get H() { return H; } };
}
