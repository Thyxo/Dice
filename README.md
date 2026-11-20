# Magix Dices – to røde terninger med skjult force

En PWA med to realistiske røde 3D-terninger på en sort close-up-måtte. For tilskueren er det en helt almindelig terning-app: tryk, terningerne ruller, summen vises. I hemmelighed kan du bestemme resultatet. Ren vanilla JS, ingen afhængigheder, intet build-trin (samme opbygning som Stopwatchplus og Calcplus).

---

## 1. Opsætning

### Kør lokalt
```bash
npm run dev     # http://localhost:5173 (bruger npx serve)
npm test        # tests af kaste-/force-logikken
npm run icons   # tegn app-ikonerne igen (kræver Pillow)
```

### Udgivelse (Vercel)
Statisk site. Vercel-projektet er koblet til GitHub, så hvert push udgives automatisk:
- push til `main` → produktion
- push til andre branches → preview-link

Ingen build-kommando og ingen output-mappe (roden udgives som den er). `vercel.json` sørger for, at `sw.js` aldrig caches af CDN'et.

### Installér på iPhone
1. Åbn adressen i **Safari**.
2. Del-knappen → **Føj til hjemmeskærm** → navnet er "Terninger".
3. Åbn fra hjemmeskærmen: fuld skærm, virker offline, skærmen slukker ikke under brug.

---

## 2. For tilskueren

| Handling | Hvad sker der |
|---|---|
| **Tryk hvor som helst** | Terningerne kastes nedefra, tumler, hopper og lander. Summen vises under dem. |
| **Tryk igen og igen** | Nyt kast hver gang ("kast én eller to gange … indtil du har dit tal"). Tryk under et kast ignoreres. |

Telefonen kan ligge fladt på bordet. Lyd (syntetisk "klak") og vibration (kun Android) ved nedslag.

---

## 3. Hemmelige gestusser

| Gestus | Hvor | Virkning |
|---|---|---|
| **5 hurtige tryk** (inden for 2½ sek.) | Øverst til højre | Åbner panelet |
| **Tryk 2-12 gange** | Nederst til venstre | **Hurtig-force:** næste kast får den sum. 1 tryk rydder. Kvittering: kort vibration + prikken blinker svagt. |
| **Hold 1 sek.** | Øverst til venstre | **Panik:** force fra med det samme, intet synligt |
| **Swipe ned** | Måtten | **Rolig tilstand:** skærmen dæmpes, summen forsvinder, force slås fra. Tryk for at vække (kaster ikke). |
| **Hold fingeren** (½ sek.) | Måtten | **Peek:** sidste kast vises svagt nederst, mens du holder |

Hjørnetryk kaster aldrig terningerne.

---

## 4. Panelet

Øverst et mærke: **FORCE KLAR** (grøn), **VENTER** (ærlige kast tilbage), **FORCE BRUGT**, **HURTIG-FORCE** eller **FORCE FRA**. Panelet gemmes på telefonen.

**Mål**
| Tilstand | Eksempel |
|---|---|
| **Sum** | 7 → 1+6, 2+5 eller 3+4 (tilfældig kombination, aldrig præcis samme kast to gange i træk) |
| **Par** | 5+6 (venstre/højre blandes) |
| **Række** | `11, 3, 8, 7` eller `5+6, 1+2` – ét mål pr. kast, derefter ærlige kast |

**Hvornår**
| Valg | Brug |
|---|---|
| **Næste kast** | Kun næste kast rammer. Derefter ærligt. |
| **Efter ærlige** (1-9) | "Prøv lige et par gange først" – de første kast er ægte, så rammer det. |
| **Alle kast** | Hvert kast rammer (ved sum med skiftende kombinationer). Til "kast så tit du vil og stop når du vil": summen er altid din, uanset hvornår de stopper. |

At **lukke panelet** (Færdig) genstarter tællerne og gen-armerer engangs-force.

**Øvrige kontakter:** Ærlige kast undgår målet (så forcen føles særlig) · Vis sum · Lyd · Vibration · Diskret prik øverst til venstre når force er klar · Hurtig-force til/fra · Rolig tilstand slår force fra.

Nederst: log over seneste kast (forcede i grønt), oversigt over gestusser, **PANIK** og **Rolig tilstand nu**.

---

## 5. Rutine-idéer
- **Forudsigelse:** skriv "11" på en seddel. Panel → Sum 11 · Efter ærlige 2. Tilskueren kaster tre gange – det tredje er 11.
- **Stop når du vil (blind):** Sum 7 · Alle kast. Vend ryggen til; tilskueren kaster så længe de vil og dækker telefonen. Du "læser" 7.
- **Live-valg:** Tilskueren nævner et tal; du tager telefonen og trykker diskret det antal gange nederst til venstre, mens du forklarer. Giv den tilbage.
- **Afslutning:** swipe ned → rolig tilstand. Nu kan alle undersøge en helt almindelig terning-app.

---

## 6. Kode

| Fil | Indhold |
|---|---|
| `src/dice.js` | 3D-terning i CSS (preserve-3d) og kasteanimation (Web Animations API) |
| `src/engine.js` | Kastelogik og force (ingen DOM – testes med `node --test`) |
| `src/settings.js` | Indstillinger i localStorage |
| `src/sound.js` | Syntetisk terningelyd (Web Audio) |
| `src/app.js` | Gestusser, panel, rolig tilstand, peek |
| `sw.js` | Offline-cache. **Hæv `VERSION` ved hver ændring.** |
