# Prospect Radar — Design (spec)

- **Dato:** 2026-07-01
- **Branch:** `claude/prospect-radar`
- **Status:** Til godkendelse
- **Version efter implementering:** `1.25.1` → `1.26.0` (minor — ny feature)

---

## 1. Formål & baggrund

Exemplar (exemplar.dk) laver 1:1 fysiske prøver/mockups af emballage. Salget er
konkurrencepræget, og kolde opkald uden kontekst konverterer dårligt. Formålet med
**Prospect Radar** er at give sælgeren en *varm, konkret grund til at ringe*: en
dyb, web-baseret research af én målvirksomhed, der ender i en **opkalds-briefing**
med konkrete mangler/behov, hvor Exemplars 1:1 mockups skaber værdi — plus en
klar-til-brug åbningsreplik.

Neura Studio har allerede den nødvendige infrastruktur: `culturalScan.ts` viser
web_search-mønsteret (multi-turn loop → struktureret output + fallback), og
`deliberate.ts` viser to-fase deep-mode. Prospect Radar kombinerer de to mønstre
til én ny, dedikeret funktion.

## 2. Mål & ikke-mål

**Mål**
- Input: ét felt (firmanavn eller website). Ingen anden obligatorisk indtastning.
- Output: en samlet opkalds-briefing (dossier + mangler + grund til at ringe +
  åbningsreplik + talking points), med kilder og en konfidens-note.
- Konfigurerbar sælger-profil (Exemplar forudfyldt), gemt lokalt.
- Passer 1:1 ind i eksisterende arkitektur (server/ai-modul, `/api`-rute, domæne-hook,
  panel, export-lag).

**Ikke-mål (YAGNI for v1)**
- Ingen CRM-integration, ingen batch/liste-kørsel af mange firmaer, ingen
  auto-udsendelse af emails.
- Ingen multi-agent fan-out (motor "C") — noteres som fremtidig opgradering.
- Ingen scraping-infrastruktur ud over Claudes indbyggede `web_search`-værktøj.
- Ingen kontaktperson-input i v1 (kun firma/website). Kan tilføjes senere.

## 3. Brugerflow

1. Bruger åbner fanen **Prospect Radar**.
2. Skriver firmanavn eller website i ét felt. (Sælger-profil er forudfyldt med
   Exemplar; kan foldes ud og redigeres én gang — gemmes i localStorage.)
3. Trykker **Research**.
4. Panelet viser live fremdrift via SSE ("Søger: emballage-situation …",
   "Syntetiserer briefing …").
5. Den færdige opkalds-briefing renderes med klikbare kilde-links.
6. Bruger kan kopiere sektioner og eksportere hele briefingen (Markdown/DOCX/print)
   via det eksisterende export-lag.

## 4. Arkitektur — to-faset motor (B)

### Fase 1 — Indsamling (`web_search`)
Multi-turn loop efter samme mønster som `runCulturalScan`, men med Sonnet
(`config.model`) og en fast **facet-tjekliste** i system-prompten, så dækningen er
konsistent:

1. Firma-overblik (hvad laver de, kategori, størrelse, marked)
2. Produktlinjer / nøgle-SKU'er
3. Emballage-situation (materialer, format, bæredygtighed, seneste redesigns)
4. Retail/distribution & listinger
5. Nyheder (launches, rebrands, ekspansion, kapital, awards, bæredygtighedsløfter)
6. Sandsynlige beslutningstagere (brand/marketing/emballage/indkøb)
7. Konkurrenter og hvordan de præsenterer emballage

Søger på **dansk + engelsk**. Højere turn-loft end cultural-scan (fx `maxTurns = 14`)
for dybde. Fasen returnerer en rå tekst-syntese af fundene + en liste af kilde-URL'er.

### Fase 2 — Syntese (struktureret, Opus)
Et separat kald med `generateStructured` på `config.creativeModel` (Opus 4.8) tager
(a) råfundene fra fase 1 og (b) sælger-profilen, og producerer den strukturerede
`ProspectBrief` via værktøjet `submit_prospect_brief`. Syntesen ser alt gennem
sælger-linsen: *"hvor ville fysiske 1:1 mockups konkret hjælpe NETOP denne virksomhed?"*

### Fallback
Hvis `web_search` ikke er tilgængelig (tier/region), fald tilbage til vidensbaseret
struktureret output (som `culturalScan`), men sæt `confidence.level = 'lav'` og skriv
eksplicit i noten at det ikke er web-verificeret.

## 5. Backend-komponenter

| Fil | Ansvar |
|---|---|
| `server/ai/prospectScan.ts` | **Ny.** Facet-system-prompt, `submit_prospect_brief`-schema, to-fase `runProspectScan(input, sellerProfile, onProgress, signal)`, fallback, serialisering til export-tekst. |
| `server.ts` | **Ny rute** `POST /api/prospect-scan` (SSE). Læser `{ company, sellerProfile }`; emitterer progress-events; skriver til sidst `{done:true, brief}` og `[DONE]`. Følger nøjagtig samme SSE-header/heartbeat-mønster som `/api/generate-deep`. |
| `src/types.ts` | **Nye typer** (se §6): `ProspectBrief`, `ProspectSignal`, `ProspectGap`, `DecisionMaker`, `ProspectCompetitor`, `ProspectConfidence`, `SellerProfile`. |

**SSE-event-protokol** (udvider husets format):
```
data: {"phase":"gathering","step":"Søger: emballage-situation"}\n\n
data: {"phase":"synthesizing"}\n\n
data: {"done":true,"brief":{ … ProspectBrief … }}\n\n
data: [DONE]\n\n
```
Ved fejl: `data: {"error":"…"}\n\n` derefter `[DONE]`.

## 6. Datamodel — output-schema

```ts
export interface SellerProfile {
  company: string;          // "Exemplar"
  offering: string;         // "1:1 fysiske emballage-mockups / prototyper"
  valueMoments: string[];   // fx kundepræsentationer, retail-/investor-møder,
                            //     designvalidering før tryk, messer, fotoshoots
  triggers: string[];       // fx redesign, nyt produkt, ny emballagelinje,
                            //     bæredygtighedsskift, retail-pitch, rebranding
  idealCustomerHints: string; // hvem passer tilbuddet til
}

export interface ProspectSignal {
  signal: string;      // hvad er sket
  timeframe: string;   // hvornår (så præcist som fundet)
  sourceUrl: string;   // kilde
  whyItMatters: string; // hvorfor det er en åbning for Exemplar
}

export interface ProspectGap {
  gap: string;          // konkret mangel/behov
  evidence: string;     // hvad i researchen peger på det (fakta)
  sellerAngle: string;  // hvordan Exemplars 1:1 mockups udfylder det
  valueForThem: string; // værdien for kunden
}

export interface DecisionMaker {
  role: string;         // fx "Head of Brand / Marketing"
  name?: string;        // hvis fundet
  rationale: string;    // hvorfor netop denne rolle
}

export interface ProspectCompetitor {
  name: string;
  packagingNote: string;
}

export interface ProspectConfidence {
  level: 'høj' | 'middel' | 'lav';
  note: string; // hvad er web-verificeret vs. antaget
}

export interface ProspectBrief {
  company: {
    name: string;
    website: string;
    category: string;
    whatTheyDo: string;
    sizeSignal: string;       // størrelse-hint eller "ukendt"
    keyProducts: string[];
    packagingContext: string; // nuværende emballage-situation
  };
  signals: ProspectSignal[];        // 3-6
  gaps: ProspectGap[];              // 3-5 (kernen: mangler/behov)
  reasonToCall: string;            // den skarpe, konkrete åbning
  openingLine: string;             // foreslået første sætning (dansk)
  talkingPoints: string[];         // 3-5
  smartQuestions: string[];        // 3-5 spørgsmål at stille på opkaldet
  decisionMakers: DecisionMaker[];
  competitors: ProspectCompetitor[]; // valgfri
  sources: string[];               // alle brugte URL'er
  confidence: ProspectConfidence;
  researchedAt: string;            // ISO 8601
}
```

Anthropic tool-schemaet (`submit_prospect_brief`) defineres lokalt i
`prospectScan.ts` (som `culturalScanTool`), med `required` på alle kernefelter.

## 7. Sælger-profil (konfigurerbar, Exemplar default)

Default-profilen defineres som en konstant i frontend og persisteres i localStorage
under `brand_surface_seller_profile`. Sendes med i request-body, så backend altid
syntetiserer gennem den aktuelle linse. Default-værdi (redigerbar i UI):

```ts
const EXEMPLAR_DEFAULT: SellerProfile = {
  company: 'Exemplar',
  offering: '1:1 fysiske prøver/mockups af emballage — se produktet i hånden før tryk',
  valueMoments: [
    'Kunde- og salgspræsentationer', 'Retail- og investor-møder',
    'Designvalidering før dyr produktion/tryk', 'Messer og events', 'Fotoshoots/PR',
  ],
  triggers: [
    'Emballage-redesign eller rebranding', 'Ny produktlancering',
    'Skift til ny/bæredygtig emballage', 'Retail-pitch eller ny distributionsaftale',
    'Ekspansion til nyt marked',
  ],
  idealCustomerHints: 'Brands/producenter med fysiske produkter, hvor emballagen sælger',
};
```

## 8. Frontend-komponenter

| Fil | Ansvar |
|---|---|
| `src/hooks/useProspectScan.ts` | **Ny domæne-hook.** State (`company`, `sellerProfile`, `status`, `progress`, `brief`, `error`), `run()` som fetch'er SSE og akkumulerer events, persistens af sælger-profil, seneste resultat. Følger mønsteret fra de øvrige domæne-hooks. |
| `src/components/ProspectRadarPanel.tsx` | **Ny.** Input-felt + foldbar sælger-profil-editor + Research-knap + fremdrifts-indikator + render af briefingen (sektioner, klikbare kilder, kopi-knapper). |
| `src/App.tsx` / `OutputWorkspace` | Tilføj fane-nøgle `'prospect'` til `activeTab`-håndteringen + fane-knap "Prospect Radar". |
| `src/lib/` (export) | Genbrug eksisterende export. Tilføj en serialiserings-funktion (`prospectBrief → markdown/tekst`) i `prospectScan.ts`/`lib`, så DOCX/Markdown/print-eksport virker uden nyt eksport-framework. |

localStorage-nøgler (samme `brand_surface_`-præfiks som resten):
`brand_surface_seller_profile`, valgfrit `brand_surface_prospect_history`.

## 9. Anti-hallucination & kilder

Kritisk, fordi output bruges til rigtige opkald:
- System-prompten kræver at **hver faktapåstand** i `company`/`signals` kan spores
  til et søgeresultat; ukendte felter markeres eksplicit ("ikke fundet"), aldrig gættet.
- Syntesen skal skelne **bevis vs. antagelse**: `gap.evidence` skal referere til noget
  fundet; `sellerAngle`/`valueForThem` må være ræsonnement.
- Ingen opfundne navne, tal eller citater. `decisionMakers.name` udfyldes kun ved fund.
- `confidence.level` afspejler mængden af verificerbar evidens.

## 10. Konfiguration, modeller & omkostning

- Fase 1 (indsamling): `config.model` (Sonnet 4.6) + `web_search` beta-header.
- Fase 2 (syntese): `config.creativeModel` (Opus 4.8) via `generateStructured`.
- Ingen nye env-variabler nødvendige (genbruger eksisterende). Evt. valgfri
  `PROSPECT_MAX_TURNS` kan tilføjes, men er ikke påkrævet for v1.
- **Omkostning:** dyb research + web_search + Opus-syntese koster mere pr. kørsel end
  de nuværende funktioner. Acceptabelt, da det er lav-frekvent (én kørsel pr. prospect).

## 11. Tests

- `server/ai/prospectScan.test.ts` (co-located, som resten): dækker
  (a) tool-schemaets form, (b) serialisering `prospectBrief → export-tekst`,
  (c) fallback-stien når `web_search` fejler (mock `anthropic`), (d) at
  sælger-profilen injiceres i syntese-prompten.
- Kvalitetsgate: `npm run lint` (tsc) + `npm test` skal være grønne før commit.

## 12. Versionering, branch & deploy

- Branch: `claude/prospect-radar`.
- Version-bump `1.25.1` → `1.26.0` **tre steder** (per CLAUDE.md): `package.json`,
  `AppHeader.tsx`, `App.tsx`-footer.
- Commit pr. logisk enhed; PR ind i `main`.
- Ingen deploy-ændringer: samme Node-service på Render serverer den nye rute + fane.
- Branding: kun "Neura Studio" i UI/prompts — aldrig "Brandsurface"/"Content Machine".

## 13. Fremtidige udvidelser (uden for v1)

- Motor "C" (parallelle facet-spejdere) for endnu dybere dækning.
- Kontaktperson-input (navn/titel/LinkedIn) så briefingen også rammer personen.
- Klar-til-send email/LinkedIn-udkast genereret fra briefingen (bro til det
  eksisterende content-lag).
- Batch-kørsel af en prospect-liste.
