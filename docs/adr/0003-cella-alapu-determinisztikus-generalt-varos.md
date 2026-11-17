# ADR-0003: Cella-alapú, determinisztikus, generált város

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A Szofi végtelen várost kér: a játékos bármeddig mehet. Nem tárolhatunk egy
végtelen pályát, és világbejárás sem fér bele (lassú lenne, és nincs „egész
pálya"). A gta-game bevált mintája: mindent képletből, pozíció-alapú hashből.

## Döntés
A világ determinisztikus, a pozícióból számolt:
- `hash32(ix, iy)` / `rand01(ix, iy, salt)` – pozíció-alapú véletlen, stabil.
- `ROAD_SPACING` rácsú utak; `nearestRoad(x, y)`, `onRoad(x, y)` tiszta függvények.
- Házak háztömbönként (`housesInBlock(gx, gy)`), ajtóval az út felé; elérhető
  járművek kereszteződésenként (`vehiclesInCell(gx, gy)`).
- Minden lekérdezés korlátos sugarú: `housesIn(cx, cy, r)`, `vehiclesIn(cx, cy, r)`
  csak a kamera körüli cellákat nézi – soha nem járjuk be az egész világot.

## Elvetett alternatívák
- Véges, kézzel meghatározott pálya: egyszerűbb, de nem végtelen, és határokat kell kezelni.
- Teljes tömb-bejárás lekérdezésenként: lassú, ahogy nő a világ.

## Következmények
- (+) Örök tér, nulla tárhely, determinisztikus (tesztelhető) generálás.
- (−) Nincs tartós globális állapot; minden a képletből jön (változtatás = más világ).
- Új generált dolgot (fa, lámpa) is cellánként, a meglévő sorsolások UTÁN sorsolj,
  hogy a többi változatlan maradjon.
