# ADR-0014: Megosztott, perzisztens letett tárgyak (az első közös világállapot)

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-18

## Kontextus
A felvett tárgyakat (könyv, ceruza, társas, maci) a felhasználó bárhol le akarja
tenni a földre úgy, hogy ott maradjanak, bárki felvehesse, és a többi játékos is
lássa. A szervernek eddig nem volt közös világállapota – csak a játékosok
pillanatnyi állapotát (`cleanState`) továbbította. A letett tárgyak ezzel szemben
közös, perzisztens világobjektumok.

## Döntés
- **Szerver-oldali közös lista:** `dropped` – `{ id, name, x, y }` elemek, a
  `createServer` closure-jében. Csatlakozáskor a kliens megkapja a teljes listát
  (`{ t:'items', list }`), és minden változásnál a frissített listát.
- **Üzenetek:** `{ t:'drop', name, x, y }` (letétel), `{ t:'take', id }` (felvétel).
  Bárki letehet és bárki felvehet bármit.
- **Biztonság:** `MAX_DROPPED = 300` (a legrégebbi kiesik), `DROP_PER_MIN = 20`
  játékosonkénti ráta-korlát, `ITEM_NAMES` whitelist, az `x,y` a `num()` határaira
  vágva. Így a `/ws`-t nem lehet elárasztani (a projekt többi rate-limitjének
  mintájára).
- **Mentés:** a store új `getItems`/`setItems` metódusával (JSON-string), a
  `secret` mintájára (fileStore: `db.items`; firestoreStore: `config/items` doc).
  Így túléli a szerver-újraindulást.
- **Offline (GitHub Pages, nincs szerver):** a kliens a letett tárgyakat helyben,
  localStorage-ban tartja (`localDropped`), egységes API-val (`dropHere`/`takeItem`/
  `groundItems`), így egyjátékos módban is működik (csak nem megosztott).
- A **kézben tartott** tárgy továbbra is a játékos `hold` mezőjén utazik (0.5.0).

## Elvetett alternatívák
- Csak kliensoldali letett tárgyak: nem megosztott, a többiek nem látnák.
- Korlát/ráta nélküli lista szerver-mentéssel: nyilvános játékban elárasztható és
  költséges (Firestore) – ezért a `MAX_DROPPED` + `DROP_PER_MIN`.
- Külön Firestore-dokumentum tárgyanként: bonyolultabb; az egyetlen JSON-string
  elég és olcsó.

## Következmények
- (+) Megosztott, mentett, bárki által szerkeszthető tárgyak; offline is működik.
- (−) Ez a szerver első közös világállapota; a korlát/ráta karbantartandó. Sok
  letétel esetén a lista a `MAX_DROPPED`-nél elkezdi ejteni a legrégebbit (nem
  „örök" tárgyak). A felvehetőség szabad (bárki felveheti bárkiét).
