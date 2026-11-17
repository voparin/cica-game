# ADR-0010: Háztípusok és berendezett lakószoba

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A felhasználó hatféle házat kért (lakóház, gyár, iskola, iroda, bolt, étterem),
kívülről is megkülönböztethetően, és a lakóháznak egy konkrétan berendezett
belsővel. A város determinisztikus, képletből generált (ADR-0003), ezért a
típusnak is a seedből kell jönnie, és nem befolyásolhatja az ütközést (ADR-0008
mintájára).

## Döntés
- `houseType(seed)` – determinisztikus típus a seedből: a lakóház ~50%, a másik öt
  a maradékon osztozik. A `housesInBlock` minden háznak `type` mezőt ad.
- `houseSign(type)` – a speciális típusok (gyár/iskola/iroda/bolt/étterem) kis
  táblát kapnak az ajtó fölött (rövid címke + szín); a `drawHouse` rajzolja. A
  lakóházhoz nincs jel.
- `roomFor(type)` – a belső leírása: a lakóház berendezett (`furnished: true`,
  felirat nélkül), a többi egyszerű szoba a típus magyar nevével (`label`).
  Az `enterHouse` a `player.inHouse`-ba teszi a `type`-ot és a `room`-ot.
- `drawBedroom(...)` – a lakószoba berendezése felülnézetben: bal oldalon ágy,
  középen szőnyeg, jobb oldalon szekrény; a szekrény tetején 3 könyv + egy társas,
  alatta a padlón egy könyv, 3 színes ceruza és egy maci.
- Az **ütközés a típustól független** (a `w`/`h` alaprajz dönt).

## Elvetett alternatívák
- Minden típushoz azonnal külön berendezés: sok munka; most csak a lakóház kell.
- Textúra-képek a házakhoz/bútorokhoz: fájl-függőség (ADR-0001 ellen).

## Következmények
- (+) Változatos, kívülről felismerhető város; a lakóház belül „otthonos".
- (−) A típusoknak még nincs funkciójuk (a bolt nem ad el, az iskola nem tanít);
  a másik öt belseje egyelőre csak a típus neve. A berendezés fix (nem a seedből
  változik) – később bővíthető.
