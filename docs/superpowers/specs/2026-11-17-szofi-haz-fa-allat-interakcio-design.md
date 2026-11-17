# Szofi – ház-javítás, fák, állatok, szoba-interakciók (0.5.0) – terv

- **Dátum:** 2026-11-17
- **Státusz:** Elfogadva

## Cél

Több látvány- és interakció-javítás:
- a házak ne tűnjenek átlátszónak (teljes, tömör falak), és a ház ajtaja legyen
  nagy, egyértelmű;
- fák a házak mellett (ütközéssel);
- minden háznál egy kóborló kutya vagy macska;
- a szobában: az ágyba E-vel be lehet feküdni (rövid alvás), a szekrény tárgyait
  E-vel fel lehet venni (a kézben látszik), és az ajtónál E-vel ki lehet lépni;
- **a kézben tartott tárgy és az ágyban fekvés a többi játékosnak is látszik**
  (ehhez a szerver is bővül).

## Felhasználói döntések
- Átlátszó ház: javítani (teljes falak). Ajtó: nagy, egyértelmű.
- Fák: ütközéssel. Állat: kóborló, **a háza körül** (nem távolodik el).
- Ágy: lefekvés + rövid alvás (a képernyő elsötétül, majd magától felébred).
- Szekrény: egyszerre **egy** tárgy, felvéve **a kézben látszik**, kint is nálad marad.
- Többjátékos: a **kézben tartott tárgy és az ágyban fekvés is látszik** a
  többieknek; a házban lévő a többieknek az ajtónál áll, alváskor „alszik" jelzéssel.

## A) Házrajz javítás + nagy ajtó (ADR-0011)

**Gyökérok (átlátszó ház):** a `drawHouse` mind a 4 oldalfalat kirajzolja fix
sorrendben; izometrikus nézetben a 2 „hátsó" fal átfesti a 2 elülsőt.
- `visibleWalls(h)` tiszta függvény: a 2 kamera felőli oldalfal (a `-x` és a `-y`
  irányú), helyes hátulról-előre sorrendben. A `drawHouse` csak ezeket rajzolja,
  a tetőt utánuk; minden laphoz vékony **körvonal** (sötét él) → tömör ház.
- A ház **ajtaja** a külső (kamera felőli) falon: nagyobb, keretes téglalap,
  világos kerettel, hogy messziről egyértelmű legyen.

## B) Fák (ütközéssel) (ADR-0012)

- `treesIn(cx, cy, r)` – determinisztikusan a seedből, a háztömbök üres helyeire,
  az úttól és a házaktól távol. Minden fa: `{x, y, r}` (törzs-sugár).
- `collideTrees(p, pad)` – a `collideHouses` mintájára kör-akadályként kitolja a
  gyalogost/járművet; az `updatePlayer` és az `updateVehiclePhysics` hívja.
- Rajz: törzs + lombkorona, a rajzlistába (`buildDrawList`) kerül a helyes
  takaráshoz (fatípus `'fa'`).

## C) Kóborló kutya/macska (ADR-0012)

- `animalFor(h)` – determinisztikusan a ház seedjéből: faj (`kutya`/`macska`),
  szín, kezdőpont (a ház mellett). Nincs házankénti tárolás.
- `animalPose(animal, t)` tiszta függvény – a kezdőpont körüli kis körzetben
  mozgó, az időből (`t`) és a seedből számolt determinisztikus „séta" (korlátos
  távolság a kezdőponttól). Minden kliensnél ugyanaz.
- Rajz: kis kutya/macska sprite, a rajzlistába kerül (típus `'allat'`).

## D) Szoba-interakciók: egy forrásból (ADR-0013)

- `bedroomLayout(rw, rh)` tiszta függvény: az ágy, a szekrény és a tárgyak
  (könyv, ceruza, társas, maci) téglalapjai/zónái. A `drawBedroom` EBBŐL rajzol,
  és az interakció is EBBŐL számolja a közelséget – egyetlen forrás.
- **Nagy, egyértelmű kijárati ajtó** az alsó falon (keretes, feliratos).

### Ágy (E)
- Az ágy zónájában E: `player.inBed = true`; a játékost fekve rajzoljuk, a
  képernyő rövid elsötétülés (`sleepT` számláló a `frame` dt-jéből), majd magától
  `inBed=false`. Alvás alatt E nem lép ki (a kijárathoz kell menni).

### Szekrény (E)
- A szekrény zónájában E: a **legközelebbi** tárgyat felveszi →
  `player.holding = 'konyv'|'ceruza'|'tarsas'|'maci'` (egyszerre egy). A tárgy
  eltűnik a helyéről (a `drawBedroom` kihagyja, amit a kézben tartunk), és a
  `drawPerson` a kézben rajzolja. Újra E-vel leteszi (vissza a helyére).

### Kilépés (E)
- A kijárat zónájában E: `leaveHouse()` (már megvan). Az `onUse` a szobában
  a legközelebbi zóna szerint dönt: ágy / szekrény / kijárat.

## E) Többjátékos: a tárgy és az alvás látszik (ADR-0013, szerver bővül)

- `netState` két új mezőt küld: `hold` (a kézben tartott tárgy neve vagy `''`) és
  `bed` (igaz, ha az ágyban fekszik). Házban továbbra is a bejárati ajtó
  pozícióját küldjük.
- **Szerver (`server.js`):** a `cleanState` átengedi: `hold: str(s.hold, 12)`,
  `bed: !!s.bed`. **Ez az első szerver-módosítás a projektben.**
- `netReceive` eltárolja a többieknél; a `buildDrawList`/`drawOthers` kirajzolja:
  a kézben tartott tárgy a másik játékos kezében, és ha `bed`, „alszik" jelzéssel
  (az ajtónál álló pózban).
- **`tests/server.test.js` bővül:** egy teszt ellenőrzi, hogy a `hold`/`bed`
  átmegy és szűrve van (a 2 kliens lássa egymás `hold`/`bed` mezőjét).

## Vezérlés (E kontextusfüggő, bővül)
Szobában: ágy → le/felfekvés; szekrény → tárgy fel/letevés; kijárat → kilépés.
Kint: ajtó/jármű, mint eddig. A HUD súgó frissül.

## Tesztek (függőség nélkül)
- `visibleWalls(h)` a 2 helyes falat adja; `drawHouse` nem dob.
- `treesIn` determinisztikus, a fa nincs az úton; `collideTrees` kitol.
- `animalFor(h)` determinisztikus (faj/szín/kezdőpont); `animalPose` a kezdőpont
  körül marad (korlátos távolság), determinisztikus `t`-re.
- `bedroomLayout(rw,rh)` stabil; az ágy/szekrény/tárgyzónák a szobán belül.
- Interakció: ágynál E → `inBed`; szekrénynél E → `holding` a legközelebbi tárgy,
  újra E → leteszi; kijáratnál E → kilép.
- `netState` a `hold`/`bed` mezőt küldi; a `drawPerson` a `holding`-gal nem dob.
- **Szerver:** a `hold`/`bed` átmegy és szűrve van (`server.test.js`).
- A teljes képkocka (kint fákkal/állatokkal + bent berendezve) nem dob.
- A meglévő tesztek változatlanul zöldek.

## ADR-ek
- **0011**: Házrajz javítás (csak a kamera felőli falak + körvonal) és nagy ajtó.
- **0012**: Fák (seedből, ütközéssel) és kóborló állatok (determinisztikus séta a
  seedből + időből, tárolás nélkül).
- **0013**: Szoba-interakciók (`bedroomLayout` egy forrásból; ágy-alvás; tárgy a
  kézben) és a `hold`/`bed` hálózati mezők (a szerver bővítése).

## Amit NEM csinálunk most (YAGNI)
Az állatok nem interaktívak (nem simogathatók). A kézben tartott tárgy és az
alvás a munkamenetig él (nincs localStorage-mentés). Egyszerre egy tárgy.

## Ellenőrzés
`node --check game.js server.js`, `node tests/smoke.test.js`, `node tests/server.test.js`
(a bővített szerverrel is zöld). Helyi próba: `node server.js`, böngésző – tömör
házak nagy ajtóval, fák (ütközéssel), minden háznál kóborló állat; a szobában
E-vel lefekvés (alvás), tárgy felvétele (kézben), kilépés; két fülön a másik
kezében látszik a tárgy és az „alszik" jelzés. Végül push → CI → Pages.
