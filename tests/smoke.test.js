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
global.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener: (e, f) => (listeners[e] = f),
  location: { hostname: 'localhost', host: 'localhost:8080', protocol: 'http:' },
  WebSocket: undefined,   // a smoke tesztben nincs valódi hálózat; a kapcsolatot a szerverteszt fedi
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
check('nearestRoad a legközelebbi rácsvonalra tesz', (() => { const r = G.nearestRoad(G.ROAD_SPACING / 2 + 5, 123); return Math.abs(r.x - G.ROAD_SPACING) < 1e-6; })());

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

// --- Járművek a világban ---
check('vehiclesIn determinisztikus', (() => {
  const a = G.vehiclesIn(0, 0, 1800), b = G.vehiclesIn(0, 0, 1800);
  return a.length === b.length && (a.length === 0 || (a[0].x === b[0].x && a[0].kind === b[0].kind));
})());
check('a járművek az úton vannak, és van köztük ló és autó is', (() => {
  const v = G.vehiclesIn(0, 0, 4000);
  return v.length > 0 && v.every(x => G.onRoad(x.x, x.y)) && v.some(x => x.kind === 'auto') && v.some(x => x.kind === 'lo');
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

// egy képkocka lerajzolása nem dob hibát (kamu ctx)
let drewOk = true;
try { rafCb && rafCb(16); } catch (e) { drewOk = false; console.error(e); }
check('egy képkocka lerajzolása nem dob hibát', drewOk);

console.log(failed ? `\n${failed} teszt elbukott` : '\nMinden füstteszt sikeres');
process.exit(failed ? 1 : 0);
