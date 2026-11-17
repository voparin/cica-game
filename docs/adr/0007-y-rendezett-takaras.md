# ADR-0007: Y-rendezett (mélység szerinti) rajzolás a takaráshoz

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
Izometrikus nézetben (ADR-0006) egy ház eltakarja a mögötte lévő dolgokat, és a
játékos is eltűnhet egy ház mögött. Ehhez helyes kirajzolási sorrend kell.

## Döntés
A `draw()` minden képkockán egy rendezett rajzlistát rajzol:
- `buildDrawList()` összegyűjti a kamera körüli házakat, járműveket, a többi
  játékost és a saját játékost (mindegyik világ-pozícióval).
- `depthKey(wx, wy) = (wx+wy)*ISO_Y` – a vetített mélység; a lista eszerint
  rendeződik (kisebb = távolabb = előbb rajzolva).
- Így a közelebbi (lentebbi) dolgok a távoliak fölé kerülnek.

## Elvetett alternatívák
- Fix rétegek (házak alul, szereplők felül): kevesebb kód, de a játékos a ház
  előtt látszik, amikor mögötte áll.

## Következmények
- (+) Helyes takarás; a szereplők és házak természetesen fedik egymást.
- (−) Képkockánkénti rendezés (a kamera körüli elemekre; a korlátos látótér miatt
  olcsó). Új, a világban megjelenő dolgot a `buildDrawList`-be is fel kell venni.
