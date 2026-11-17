# ADR-0011: Házrajz javítás (csak a kamera felőli falak) és nagy ajtó

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A házak átlátszónak tűntek: a `drawHouse` mind a négy oldalfalat kirajzolta fix
sorrendben, és izometrikus nézetben a két „hátsó" fal átfestette a két elülsőt.
Emellett a ház ajtaja túl kicsi volt, nem volt egyértelmű, hol lehet belépni.

## Döntés
- Csak a **két kamera felőli (elülső) oldalfalat** rajzoljuk: `visibleWalls()` →
  `['px','py']` (x = cx+hw és y = cy+hh), hátulról előre (előbb `px`, majd a
  legközelebbi `py`), majd a tetőt – így a ház tömör, zárt doboz, nem féloldalas.
  (Korábban tévesen a kamerától elfelé néző `nx`/`ny` falakat rajzoltuk, ettől
  nézett ki „kinyitott könyvként", és az ajtó a befelé néző falra került.)
- A tető a falakhoz igazodik: nyeregnél két lap (elülső/hátsó), sátornál négy lap
  egy csúcsba, lapos tető egy lap; mindegyik körvonallal.
- Minden laphoz vékony sötét **körvonal** (`stroke`).
- A ház **ajtaja a valódi bejárat (`h.door`) oldalán** jelenik meg (`doorSide(h)`):
  ha elülső (`px`/`py`) falon van, a nagy, keretes ajtót oda rajzoljuk; ha hátsó
  (`nx`/`ny`) falon (nem látható), a ház fölé egy sárga nyíl + „bejárat" jelző
  mutat a `h.door` irányába, hogy egyértelmű legyen, hova kell állni (E-vel belépni).

## Elvetett alternatívák
- Mind a négy fal kirajzolása: ez okozta az átlátszóságot.
- A kamerától elfelé néző falak rajzolása (a korábbi hibás állapot): féloldalas ház,
  rossz helyen lévő ajtó.
- Az ajtó fix falra rajzolása: nem egyezett a valódi bejárattal („ki kell találni,
  hova álljak").
- Teljes z-buffer / mélységi takarás pixelenként: túl bonyolult egy 2D Canvas-hoz.

## Következmények
- (+) Tömör, hihető házak; a látható ajtó = a valódi bejárat, vagy jelző mutat rá.
- (−) A látható falak a kamera fix (−x,−y) irányára épülnek; ha a nézet valaha
  forogna, a `visibleWalls`/`doorSide` logikát frissíteni kellene. A hátsó ajtó
  maga nem látszik, csak a jelző.
