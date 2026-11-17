# ADR-0013: Szoba-interakciók és a hold/bed hálózati mezők

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A lakószobában interakció kell: az ágyba E-vel be lehessen feküdni (alvás), a
szekrény tárgyait E-vel fel lehessen venni (a kézben látszik), és az ajtónál
E-vel ki lehessen lépni. A felhasználó azt is kérte, hogy a kézben tartott tárgy
és az ágyban fekvés **a többi játékosnak is látsszon** – ez a szerver bővítését
igényli, amit eddig szándékosan elkerültünk.

## Döntés
- **Egy forrás a rajzhoz és az interakcióhoz:** `bedroomLayout(rw, rh)` adja az
  ágy, a szekrény és a tárgyak (könyv, ceruza, társas, maci) zónáit. A
  `drawBedroom` ebből rajzol, az `onUse` ebből számolja a közelséget.
- **Ágy (E):** `player.inBed = true`, rövid alvás (`sleepT` a `frame` dt-jéből),
  majd magától felkel; alvás alatt sötét réteg + „Zzz".
- **Szekrény (E):** a legközelebbi tárgyat felveszi → `player.holding` (egyszerre
  egy); a `drawPerson` a kézben rajzolja (`drawItem`), kint is nálad marad. Újra
  E-vel leteszi.
- **Kilépés (E):** a kijárat zónájában `leaveHouse()`; a szoba kijárati ajtaja
  nagy és feliratos.
- **Hálózat (a szerver bővül):** a `netState` `hold` (kézben tartott tárgy) és
  `bed` (alszik) mezőt is küld; a `server.js` `cleanState`-je átengedi
  (`hold: str(s.hold, 12), bed: !!s.bed`). A többiek a házban lévőt az ajtónál
  látják (ADR-0005), alváskor „alszik" jelzéssel, és a kézben tartott tárgyat a
  kinti világban is. A `server.test.js` egy teszttel védi az átvitelt.

## Elvetett alternatívák
- Külön rajz- és interakció-koordináták: elcsúszhatnának; az egy forrás tartja
  szinkronban.
- A szerver érintetlenül hagyása: akkor a tárgy/alvás nem látszana a többieknek,
  amit a felhasználó kért.

## Következmények
- (+) Teljes szoba-interakció; a tárgy és az alvás a többieknek is látszik.
- (−) Ez az **első szerver-módosítás** a projektben (`cleanState` + egy új
  szerverteszt). A tárgy/alvás a munkamenetig él (nincs localStorage-mentés),
  és egyszerre egy tárgy vihető.
