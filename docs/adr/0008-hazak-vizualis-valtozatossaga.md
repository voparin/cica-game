# ADR-0008: Házak vizuális változatossága a seedből

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A felhasználó változatos, többszínű, szép tetős házakat kért. A város
determinisztikusan generált (ADR-0003), ezért a változatosságnak is a seedből
kell jönnie, és nem befolyásolhatja az ütközést.

## Döntés
A `housesInBlock` a ház seedjéből determinisztikus vizuális mezőket ad:
- `wall` – falszín a `HOUSE_WALLS` palettából;
- `roof` – tetőszín a `HOUSE_ROOFS` palettából;
- `roofType` – `'nyereg'` / `'sator'` / `'lapos'` (`ROOF_TYPES`);
- `height` – falmagasság (izo z), néhány változatban.
- **Típus szerinti elkülönítés (0.11.0):** a lakóház kisebb/alacsonyabb, meleg
  paletta (`HOUSE_WALLS`), változatos tetővel + otthonos jegyek (kémény, kertkapu,
  `drawHomeDetails`); a speciális épületek (gyár/iskola/iroda/bolt/étterem)
  nagyobbak/magasabbak, hűvös paletta (`SPECIAL_WALLS`), mindig lapos tetővel. A
  pozíció és az ütközés (`w`/`h` alaprajz) ettől függetlenül determinisztikus.
Az indexek előjeltelen eltolással (`>>>`) számolódnak, hogy a nagy seedeknél se
legyen negatív index. A `drawHouse` ezek szerint rajzolja az oldalfalakat (eltérő
árnyalat a mélységért) és a tetőt. Az **ütközés továbbra is a `w`/`h` alaprajzzal**
számol – a vizuális mezők nem érintik.

## Elvetett alternatívák
- Egységes szín minden házon: egyszerű, de egyhangú.
- Textúra-képek: szebb lehet, de fájl-függőség (ADR-0001 ellen).

## Következmények
- (+) Változatos, színes város, függőség nélkül, determinisztikusan (tesztelhető).
- (−) A vizuális mezőket csak a lista végén bővítsd (különben változik a meglévő
  házak kinézete); a tetőtípus-számnál ügyelj az előjeltelen eltolásra.
