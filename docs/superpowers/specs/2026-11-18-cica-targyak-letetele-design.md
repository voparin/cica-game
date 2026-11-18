# Cica game – tárgyak felvétele/letétele bárhol, megosztva (0.8.0) – terv

- **Dátum:** 2026-11-18
- **Státusz:** Elfogadva

## Cél

A felvett tárgyakat (könyv, ceruza, társas, maci) bárhová el lehessen vinni, és
**E-vel bárhol le lehessen tenni a földre**, ahol ott maradnak és később (bárki
által) felvehetők. A letett tárgyak **megosztottak**: a szerver közös listában
tartja, minden játékos látja, és bárki felveheti bárkiét.

## Felhasználói döntések
- Kint E → a tárgy a földre kerül, ott marad, később E-vel felvehető.
- A letett tárgy **mentődik** (túléli a szerver-újraindulást).
- Kint, ha nálad van tárgy: az E **először leteszi** (a ház/jármű másodsorban).
- A letett tárgy **a többieknek is látszik**; **közös szerver-állapot**, bárki felveheti.
- **Korlát + ráta-korlát** (biztonság): max. tárgyszám (a legrégebbi kiesik) és
  letétel-ráta, hogy a `/ws`-t ne lehessen elárasztani.

## Áttekintés: mi ez és miért

Eddig a szerver csak **játékos-állapotot** (`cleanState`) továbbított. A letett
tárgyak **közös, perzisztens világobjektumok** – ez a szerver első megosztott
világállapota. Ehhez: új WS-üzenetek, egy szerver-oldali tárgy-lista, mentés a
meglévő tárba (Firestore / fájl, a profilok mintájára), és szigorú korlátok.

## Szerver (`server.js`)

- **Közös tárgy-lista:** `droppedItems` – `{ id, name, x, y }` elemek. Memóriában,
  és a meglévő tárba (profilok mellé) mentve; indításkor visszaolvasva.
- **Korlátok (biztonság):**
  - `MAX_DROPPED` (pl. 300) – a lista felső korlátja; túllépéskor a legrégebbi esik ki.
  - letétel-ráta: játékosonként `DROP_PER_MIN` (pl. 20/perc), a fiók-rate-limit mintájára.
  - a `name` csak a négy ismert érték egyike lehet; az `x,y` számhatárokra vágva
    (mint a `cleanState`-ben); hibás üzenet csendben eldobva.
- **Új WS-üzenetek (kliens → szerver):**
  - `{ t:'drop', name, x, y }` – letétel: a szerver ellenőriz (ráta, korlát, mezők),
    felveszi a listába új `id`-vel, menti, és szétküldi.
  - `{ t:'take', id }` – felvétel: a szerver kiveszi az `id`-t a listából (ha van),
    menti, és szétküldi.
- **Szerver → kliens:** csatlakozáskor a teljes lista (`{ t:'items', list }`), és
  minden változásnál a frissített lista (vagy delta). A `TICK`-hez hasonlóan a
  változások szétküldve mindenkinek.
- A **profil/fiók/PvP rész változatlan**; a tárgy-lista ettől független.

## Kliens (`game.js`)

- `netDrop(name, x, y)` / `netTake(id)` – a két új üzenet küldése.
- `net.items` – a szerverről kapott közös lista (Map vagy tömb, `id`-vel).
- `netReceive` kezeli az `items` üzenetet.
- **Letétel (E) kint:** ha `player.holding`, az `onUse` a városi ágban ELŐSZÖR
  leteszi: `netDrop(holding, player.x, player.y)`, majd `player.holding = ''`.
- **Felvétel (E) kint:** ha `player.holding` üres, és van a közelben letett tárgy,
  E-vel felveszi: `netTake(id)`, `player.holding = name`.
- **Offline (GitHub Pages, nincs szerver):** ha nincs kapcsolat, a letett tárgyak
  helyben (localStorage) élnek, csak a saját kliensnél – így a funkció egyjátékos
  módban is működik, csak nem megosztott. (A szerver a megosztott, mentett eset.)
- **Rajz:** a letett tárgyak a rajzlistába (`buildDrawList`) kerülnek (`drawItem`),
  a helyes takarással; a HUD jelzi: „E: letesz / felvesz".

## E-prioritás (a városi `onUse`)
1. Ha `player.holding` → **letesz** (`netDrop` vagy offline helyi), `holding=''`.
2. Különben ha közeli letett tárgy → **felvesz** (`netTake`).
3. Különben a mostani sorrend: ajtó (belépés) / jármű (be-/felszállás).

## Tesztek (függőség nélkül)
- **Szerver (`tests/server.test.js`):** két kliens; az egyik `drop`-ot küld, a másik
  megkapja az `items` listában a tárgyat a helyes `name`/`x`/`y`-nal; `take` után
  eltűnik mindkettőnél; a `MAX_DROPPED` korlát tartja a méretet; a ráta-korlát a
  túl sok `drop`-ot eldobja; hibás `name`/mezők eldobva.
- **Füstteszt (`tests/smoke.test.js`):** `netDrop`/`netTake` a helyes üzenetet
  küldi; a városi `onUse` tárgy nálad → letesz (holding ürül); üres kéz + közeli
  letett tárgy → felvesz; a letett tárgyak a rajzlistában megjelennek;
  offline (nincs ws) a letétel a helyi listába kerül.
- A meglévő tesztek változatlanul zöldek.

## ADR
- **0014**: Megosztott, perzisztens világobjektumok (letett tárgyak) a szerveren –
  az első közös világállapot; `drop`/`take`/`items` üzenetek; korlát + ráta-korlát;
  mentés a meglévő tárba; a `hold` (kézben) marad a játékos-állapotban.

## Amit NEM csinálunk most (YAGNI)
Csak a négy meglévő tárgy (könyv/ceruza/társas/maci) tehető le. Nincs tárgy-
tulajdonjog/zárolás (bárki felveheti). Nincs hang. A kézben tartás a `hold` mezőn
marad (változatlan).

## Ellenőrzés
`node --check game.js server.js`, `node tests/smoke.test.js`, `node tests/server.test.js`
(a bővített szerverrel is zöld). Helyi próba: `node server.js`, két böngészőfül –
az egyik felvesz egy tárgyat a szekrényből, kimegy, E-vel leteszi; a másik fülön
megjelenik a tárgy a földön, és fel is veheti. Végül push → CI → Pages.
