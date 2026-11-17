'use strict';
// Füstteszt: a game.js-t egy kamu böngészőkörnyezetben futtatja, és ellenőrzi a csonk fő funkcióit.
// Futtatás: node tests/smoke.test.js   (kilépési kód 0 = minden rendben, függőség nélkül)

const fs = require('fs');
const path = require('path');

// --- kamu böngésző (canvas, window, requestAnimationFrame) ---
const ctxStub = new Proxy({}, {
  get: (t, p) => {
    if (p in t) return t[p];
    if (p === 'measureText') return txt => ({ width: String(txt).length * 7 });
    return () => {};
  },
  set: (t, p, v) => { t[p] = v; return true; },
});
const mkCanvas = () => ({ width: 0, height: 0, getContext: () => ctxStub });
const listeners = Object.create(null);
let rafCb = null, now = 0;
const lsStore = Object.create(null);                 // kamu localStorage a mentés-teszthez
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; },
};
global.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener: (e, f) => (listeners[e] = f),
  location: { hostname: 'localhost', host: 'localhost:8080', protocol: 'http:' },
  WebSocket: undefined,   // a smoke tesztben nincs valódi hálózat; a kapcsolatot a szerverteszt fedi
  localStorage: global.localStorage,
};
global.document = { getElementById: mkCanvas, createElement: mkCanvas };
global.performance = { now: () => now };
global.requestAnimationFrame = f => (rafCb = f);

let failed = 0;
function check(name, cond) { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) failed++; }

// --- a játék betöltése ---
const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
eval(src);
const G = global.G;

check('a game.js lefut és közzéteszi a felületét (G)', !!G && !!G.player && !!G.net);

// --- Világ: utcarács ---
check('a hash determinisztikus és stabil', G.hash32(3, 7) === G.hash32(3, 7) && G.hash32(3, 7) !== G.hash32(7, 3));
check('ROAD_SPACING rácsán az út felismerhető', G.onRoad(0, 0) === true && G.onRoad(G.ROAD_SPACING, 0) === true);
check('a háztömb közepén nincs út', G.onRoad(G.ROAD_SPACING / 2, G.ROAD_SPACING / 2) === false);
check('az úttest kétszer szélesebb (ROAD_HALF >= 50), de nem lóg a házakra', G.ROAD_HALF >= 50 && G.ROAD_HALF < G.HOUSE_MARGIN);
check('nearestRoad a legközelebbi rácsvonalra tesz', (() => { const r = G.nearestRoad(G.ROAD_SPACING / 2 + 5, 123); return Math.abs(r.x - G.ROAD_SPACING) < 1e-6; })());

// --- Izometrikus vetítés ---
check('iso a sík pontját képernyő-eltolásra képezi (origó = 0,0)', (() => { const p = G.iso(0, 0, 0); return p.x === 0 && p.y === 0; })());
check('iso a magasságot (z) felfelé tolja', (() => { const a = G.iso(100, 100, 0), b = G.iso(100, 100, 50); return b.y < a.y && b.x === a.x; })());
check('iso +x és +y ellentétes vízszintes irányba visz (izometria)', (() => { const px = G.iso(100, 0, 0), py = G.iso(0, 100, 0); return Math.sign(px.x) !== Math.sign(py.x) && px.y > 0 && py.y > 0; })());
check('worldToScreen a játékost a képernyő közepére teszi', (() => { const sx = G.player.x, sy = G.player.y; G.player.x = 500; G.player.y = -300; const s = G.worldToScreen(500, -300); G.player.x = sx; G.player.y = sy; return Math.abs(s[0] - G.W / 2) < 1 && Math.abs(s[1] - G.H / 2) < 1; })());

// --- Bemenet a képernyőhöz forgatva ---
check('screenToWorldDir(0,0) nulla', (() => { const d = G.screenToWorldDir(0, 0); return d.x === 0 && d.y === 0; })());
check('a képernyőn „fel" a világban -x,-y felé visz (a kamera felé)', (() => { const d = G.screenToWorldDir(0, -1); return d.x < 0 && d.y < 0; })());
check('a képernyőn „jobbra" +x,-y felé visz', (() => { const d = G.screenToWorldDir(1, 0); return d.x > 0 && d.y < 0; })());
check('az irány egységnyi hosszú (normált)', (() => { const d = G.screenToWorldDir(1, 1); return Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-6; })());

// --- Világ: házak ---
check('housesIn determinisztikus (ugyanaz a terület → ugyanaz a ház)', (() => {
  const a = G.housesIn(0, 0, 1200), b = G.housesIn(0, 0, 1200);
  return a.length > 0 && a.length === b.length && a[0].x === b[0].x && a[0].y === b[0].y;
})());
check('a ház nincs az úttesten (a háztömb belsejében van)', G.housesIn(0, 0, 1800).every(h => !G.onRoad(h.x, h.y)));
check('a ház ajtaja a házon kívül, az út felé esik', (() => {
  const h = G.housesIn(0, 0, 1800)[0];
  return h.door && Math.hypot(h.door.x - h.x, h.door.y - h.y) > h.w / 2;
})());

// --- Házak vizuális mezői ---
check('a ház falszíne és tetőszíne a palettából való', (() => {
  const h = G.housesIn(0, 0, 2400)[0];
  return G.HOUSE_WALLS.includes(h.wall) && G.HOUSE_ROOFS.includes(h.roof);
})());
check('a tetőtípus a három érték egyike, a magasság pozitív', (() => {
  return G.housesIn(0, 0, 3000).every(h => ['nyereg', 'sator', 'lapos'].includes(h.roofType) && h.height > 0);
})());
check('a vizuális mezők determinisztikusak (ugyanaz a ház → ugyanaz a szín)', (() => {
  const a = G.housesIn(0, 0, 2400)[0], b = G.housesIn(0, 0, 2400)[0];
  return a.wall === b.wall && a.roofType === b.roofType && a.height === b.height;
})());

// --- Háztípusok ---
check('houseType determinisztikus és a hat érték egyike', (() => {
  const t = G.houseType(12345);
  return G.houseType(12345) === t && ['lakohaz', 'gyar', 'iskola', 'iroda', 'bolt', 'etterem'].includes(t);
})());
check('a lakóház a leggyakoribb típus', (() => {
  const cnt = {}; for (let s = 0; s < 4000; s++) { const t = G.houseType(s); cnt[t] = (cnt[t] || 0) + 1; }
  return cnt.lakohaz > (cnt.gyar || 0) && cnt.lakohaz > (cnt.bolt || 0);
})());
check('minden háznak van type mezője (a hat érték egyike)', (() => {
  return G.housesIn(0, 0, 3000).every(h => ['lakohaz', 'gyar', 'iskola', 'iroda', 'bolt', 'etterem'].includes(h.type));
})());
check('houseSign a típushoz címkét és színt ad', (() => {
  const s = G.houseSign('gyar');
  return s && typeof s.label === 'string' && s.label.length >= 1 && typeof s.color === 'string';
})());
check('minden speciális típushoz van jel, a lakóházhoz nincs', (() => {
  const special = ['gyar', 'iskola', 'iroda', 'bolt', 'etterem'];
  return special.every(t => { const s = G.houseSign(t); return s && s.label && s.color; }) && G.houseSign('lakohaz') === null;
})());

// --- Házrajz (tömör, nem átlátszó) ---
check('visibleWalls a két kamera felőli falat adja (a -x és -y irányút)', (() => {
  const walls = G.visibleWalls();     // oldalak nevei, hátulról előre
  return Array.isArray(walls) && walls.length === 2 && walls.includes('nx') && walls.includes('ny');
})());

// --- Ütközés a házakkal ---
check('pushOutOfRect kitol egy ponton belülről a legközelebbi él felé', (() => {
  const p = { x: 5, y: 1 };                 // egy 0,0 középpontú 20x20 téglalap belsejében
  G.pushOutOfRect(p, 0, 0, 20, 20, 0);
  return Math.abs(p.x) >= 10 - 1e-6 || Math.abs(p.y) >= 10 - 1e-6;
})());
check('collideHouses a házba lépő pontot kitolja', (() => {
  const h = G.housesIn(0, 0, 1800)[0];
  const p = { x: h.x, y: h.y };             // pont a ház közepén
  G.collideHouses(p, 0);
  return Math.abs(p.x - h.x) > 0 || Math.abs(p.y - h.y) > 0;
})());
check('a drawCity függvény létezik', typeof G.drawCity === 'function');

// --- Mélység szerinti rajzolás ---
check('depthKey monoton: a kamerától távolabbi (kisebb x+y) kisebb kulcsot ad', (() => {
  return G.depthKey(0, 0) < G.depthKey(100, 100);
})());
check('buildDrawList a játékost és a közeli házakat tartalmazza, y szerint rendezve', (() => {
  G.player.inHouse = null; G.player.riding = null; G.player.x = 0; G.player.y = 0;
  const list = G.buildDrawList();
  const hasPlayer = list.some(e => e.type === 'player');
  const hasHouse = list.some(e => e.type === 'house');
  let sorted = true; for (let i = 1; i < list.length; i++) if (list[i].key < list[i - 1].key) sorted = false;
  return hasPlayer && hasHouse && sorted;
})());
check('járművön ülve a rajzlista a járművet ÉS a rajta ülő személyt is tartalmazza', (() => {
  G.player.inHouse = null; G.player.x = 0; G.player.y = 0;
  G.player.riding = { id: 'teszt', kind: 'lo', x: 0, y: 0, a: 0, angle: 0, speed: 0, color: '#8a5a2b' };
  const list = G.buildDrawList();
  G.player.riding = null;
  const hasHorse = list.some(e => e.type === 'horse' && e.self);
  const hasRider = list.some(e => e.type === 'person' && e.rider);
  return hasHorse && hasRider;
})());

// --- Járművek a világban ---
check('vehiclesIn determinisztikus', (() => {
  const a = G.vehiclesIn(0, 0, 1800), b = G.vehiclesIn(0, 0, 1800);
  return a.length === b.length && (a.length === 0 || (a[0].x === b[0].x && a[0].kind === b[0].kind));
})());
check('a járművek az úton vannak, és van köztük ló és autó is', (() => {
  const v = G.vehiclesIn(0, 0, 4000);
  return v.length > 0 && v.every(x => G.onRoad(x.x, x.y)) && v.some(x => x.kind === 'auto') && v.some(x => x.kind === 'lo');
})());

// --- Jármű a helyén marad (mozgatott pozíció + mentés) ---
check('egy mozgatott jármű a saját ID-jén az új helyen jelenik meg (nem a formula-helyen)', (() => {
  const v0 = G.vehiclesIn(0, 0, 6000)[0];
  const ox = v0.x, oy = v0.y;
  G.setVehicleMoved(v0.id, { x: ox + 777, y: oy + 555, angle: 1, speed: 0, kind: v0.kind, color: v0.color });
  const found = G.vehiclesIn(0, 0, 8000).find(w => w.id === v0.id);
  return !!found && Math.abs(found.x - (ox + 777)) < 1 && Math.abs(found.y - (oy + 555)) < 1;
})());
check('a mozgatott járművek mentődnek és visszaolvashatók (localStorage)', (() => {
  G.saveVehicles();
  const raw = global.localStorage.getItem('szofi.vehicles');
  return typeof raw === 'string' && raw.length > 2;
})());

// --- Járműfizika (irányított) ---
check('előre gyorsít', (() => { const v = { x: 0, y: 0, angle: 0, speed: 0, kind: 'auto' }; G.updateVehiclePhysics(v, { fwd: 1, turn: 0 }, 0.1); return v.speed > 0; })());
check('a forgatás változtatja a szöget és mozog', (() => { const v = { x: 0, y: 0, angle: 0, speed: 100, kind: 'auto' }; const a0 = v.angle; G.updateVehiclePhysics(v, { fwd: 0, turn: 1 }, 0.1); return v.angle !== a0 && (v.x !== 0 || v.y !== 0); })());
check('súrlódás lassít bemenet nélkül', (() => { const v = { x: 0, y: 0, angle: 0, speed: 100, kind: 'auto' }; G.updateVehiclePhysics(v, { fwd: 0, turn: 0 }, 0.1); return v.speed < 100; })());

// --- Be-/felszállás ---
check('a közeli járműbe beszáll, majd kiszáll', (() => {
  G.player.riding = null; G.player.inHouse = null;
  const v = G.vehiclesIn(0, 0, 6000)[0];
  G.player.x = v.x + 10; G.player.y = v.y;               // a jármű mellé
  G.toggleVehicle();
  const inside = G.player.riding && G.player.riding.id === v.id;
  G.toggleVehicle();
  return inside && !G.player.riding;
})());
check('messziről nincs beszállás', (() => {
  G.player.riding = null; G.player.x = 1e6; G.player.y = 1e6; G.toggleVehicle(); return !G.player.riding;
})());

// --- Házba belépés ---
check('ajtónál E-re bemegy, majd a kijáraton kijön az ajtó elé', (() => {
  G.player.riding = null; G.player.inHouse = null;
  const h = G.housesIn(0, 0, 1800)[0];
  G.player.x = h.door.x; G.player.y = h.door.y;
  G.onUse();                                              // belépés
  const inside = !!G.player.inHouse && G.player.inHouse.house.x === h.x && G.player.inHouse.house.y === h.y;
  // a belső szoba kijáratához megyünk, és E-vel kilépünk
  G.player.ix = G.player.inHouse.exit.x; G.player.iy = G.player.inHouse.exit.y;
  G.onUse();
  const outside = !G.player.inHouse && Math.hypot(G.player.x - h.door.x, G.player.y - h.door.y) < 40;
  return inside && outside;
})());

// --- Szoba típus szerint ---
check('roomFor a lakóháznak berendezést ad (nincs felirat), a többinek feliratot', (() => {
  const lak = G.roomFor('lakohaz'), gyar = G.roomFor('gyar');
  return lak.furnished === true && !lak.label && gyar.furnished === false && typeof gyar.label === 'string' && gyar.label.length > 0;
})());
check('belépéskor a szoba megkapja a ház típusát', (() => {
  G.player.riding = null; G.player.inHouse = null;
  const h = G.housesIn(0, 0, 3000)[0];
  G.enterHouse(h);
  const t = G.player.inHouse.type;
  G.leaveHouse();
  return t === h.type;
})());
check('drawBedroom létezik és a lakószoba nem dob hibát', (() => {
  G.player.riding = null; const h = G.housesIn(0, 0, 3000)[0]; h.type = 'lakohaz'; G.enterHouse(h);
  let ok = true; try { G.drawInterior(); } catch (e) { ok = false; console.error(e); }
  G.leaveHouse(); return ok && typeof G.drawBedroom === 'function';
})());
check('a speciális típusok belseje sem dob hibát (mind az 5)', (() => {
  let ok = true;
  for (const t of ['gyar', 'iskola', 'iroda', 'bolt', 'etterem']) {
    const h = G.housesIn(0, 0, 3000)[0]; h.type = t; G.enterHouse(h);
    try { G.drawInterior(); } catch (e) { ok = false; console.error(e); }
    G.leaveHouse();
  }
  return ok;
})());

// --- Többjátékos: jármű és házban lét ---
check('netState járműben a car/kind mezőt küldi', (() => {
  G.player.inHouse = null; G.player.riding = { x: 10, y: 20, a: 0.5, angle: 0.5, kind: 'auto' };
  G.player.x = 10; G.player.y = 20;
  const s = G.netState();
  G.player.riding = null;
  return s.car === true && s.kind === 'auto';
})());
check('netState házban a bejárati ajtó pozícióját küldi (nem a belső koordinátát)', (() => {
  const h = G.housesIn(0, 0, 1800)[0];
  G.enterHouse(h);
  const s = G.netState();
  G.leaveHouse();
  return Math.abs(s.x - h.door.x) < 1 && Math.abs(s.y - h.door.y) < 1 && s.car === false;
})());
check('a netConnect függvény létezik (a szerver ezt várja a kiszolgált fájlban)', /netConnect/.test(src));
check('a vászon méretet kapott (resize lefutott)', G.W === 1280 && G.H === 720);

// mozgás: a jobbra nyíl nyomva a játékos x nő, és a GitHub Pages-en nincs kapcsolat
const x0 = G.player.x;
G.keys.ArrowRight = true;
G.updatePlayer(0.1);
check('a jobbra nyílra a játékos jobbra mozog', G.player.x > x0);
G.keys.ArrowRight = false;

// a netState csak a helyzetet és a kinézetet adja ki (a szerver úgyis szűri)
const s = G.netState();
check('a netState a helyzetet és a nevet adja', typeof s.x === 'number' && typeof s.y === 'number' && s.name === 'Szofi');

// a szerver „players” üzenetét feldolgozza: megjelenik egy másik játékos
G.net.id = 1;
G.netReceive(JSON.stringify({ t: 'players', list: [
  { id: 1, x: 0, y: 0, a: 0, name: 'Szofi', shirt: '#2f6fd0' },      // mi magunk: kihagyva
  { id: 2, x: 300, y: 400, a: 1, name: 'Bence', shirt: '#d42020' },
] }));
check('a többi játékost felveszi a listába (magát kihagyva)', G.net.others.size === 1 && G.net.others.get(2).x === 300);

// a kilépett játékos eltűnik
G.netReceive(JSON.stringify({ t: 'players', list: [{ id: 1, x: 0, y: 0, a: 0, name: 'Szofi' }] }));
check('a kilépett játékos eltűnik a listából', G.net.others.size === 0);

// a hibás üzenet nem dob hibát
G.netReceive('nem json');
G.netReceive(JSON.stringify({ t: 'ismeretlen' }));
check('a hibás / ismeretlen üzenetet csendben kihagyja', true);

// --- Szereplő-sprite-ok ---
check('a sprite-rajzolók léteznek', typeof G.drawPerson === 'function' && typeof G.drawCarSprite === 'function' && typeof G.drawHorseSprite === 'function');
check('egy sprite rajzolása nem dob hibát (kamu ctx)', (() => { try { G.drawPerson(100, 100, 0, '#fff', 'A'); G.drawCarSprite(100, 100, 1, '#f00'); G.drawHorseSprite(100, 100, 2, '#8a5a2b'); return true; } catch (e) { return false; } })());
check('vehicleQuad a talajon fekvő téglalapot ad (szemközti oldalak egyenlők)', (() => {
  const q = G.vehicleQuad(0, 0, 0, 120, 60);        // 4 világ-sarok: [elöl-bal, elöl-jobb, hátul-jobb, hátul-bal]
  const d = (p, r) => Math.hypot(p[0] - r[0], p[1] - r[1]);
  const s01 = d(q[0], q[1]), s23 = d(q[2], q[3]), s12 = d(q[1], q[2]), s30 = d(q[3], q[0]);
  return Math.abs(s01 - s23) < 1e-6 && Math.abs(s12 - s30) < 1e-6 && q.length === 4;
})());
check('vehicleQuad a szöggel forgat (a=π/2 esetén más, mint a=0)', (() => {
  const a = G.vehicleQuad(0, 0, 0, 120, 60), b = G.vehicleQuad(0, 0, Math.PI / 2, 120, 60);
  return Math.abs(a[0][0] - b[0][0]) > 1 || Math.abs(a[0][1] - b[0][1]) > 1;
})());

// --- Ház- és utcarajz ---
check('streetStyle determinisztikus és 0..2 közötti', (() => { const a = G.streetStyle(2, 3), b = G.streetStyle(2, 3); return a === b && a >= 0 && a <= 2; })());
check('a drawHouse és drawStreets léteznek és nem dobnak', (() => {
  try { const h = G.housesIn(0, 0, 2400)[0]; G.drawHouse(h); G.drawStreets(); return true; } catch (e) { return false; }
})());

// egy képkocka lerajzolása nem dob hibát (kamu ctx)
let drewOk = true;
try { rafCb && rafCb(16); } catch (e) { drewOk = false; console.error(e); }
check('egy képkocka lerajzolása nem dob hibát', drewOk);
check('a teljes izometrikus képkocka (utcák + rajzlista) nem dob hibát', (() => {
  G.player.inHouse = null; try { rafCb && rafCb(32); return true; } catch (e) { console.error(e); return false; }
})());

console.log(failed ? `\n${failed} teszt elbukott` : '\nMinden füstteszt sikeres');
process.exit(failed ? 1 : 0);
