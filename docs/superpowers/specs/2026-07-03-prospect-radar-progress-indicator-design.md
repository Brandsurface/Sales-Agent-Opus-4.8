# Prospect Radar — Progress Indicator (spec)

- **Dato:** 2026-07-03
- **Branch:** `claude/prospect-radar` (samme branch/PR som resten af Prospect Radar)
- **Status:** Godkendt af bruger

## 1. Problem

Prospect Radar's research-kørsel er en flerfaset SSE-strøm (indsamling → syntese →
pres-test → evt. skærpning), men brugeren har ingen tydelig visning af, hvad der sker
undervejs. Panelet viser i dag kun én lille pulserende tekstlinje
(`ProspectRadarPanel.tsx:98`) med en statisk, oversat fase-label. Samtidig sender
backend'en allerede finkornede status-beskeder under selve indsamlings-fasen
(`server/ai/prospectScan.ts`'s `onProgress` i `gatherIntel`, fx "Firma-overblik &
produkter" → "Nyheder, emballage & beslutningstagere" → "Konkurrenter & retail"), men
klienten (`useProspectScan.ts:86`) smider dem væk og viser kun en statisk label pr. fase.

Bruger vil have et **visuelt trin-for-trin-overblik**, der viser både at appen arbejder
og hvor langt den er nået.

## 2. Løsning (godkendt)

Ren frontend-ændring. **Ingen backend-ændringer** — al nødvendig information findes
allerede i SSE-strømmen.

### 2.1 Trin-definition (`src/lib/prospectSteps.ts`, ny)

Definerer de 4 faser i rækkefølge og en ren status-funktion:

```ts
export type ProspectPhase = 'gathering' | 'synthesizing' | 'critiquing' | 'sharpening';

export interface ProspectStepDef {
  key: ProspectPhase;
  label: string;
}

export const PROSPECT_STEPS: ProspectStepDef[] = [
  { key: 'gathering', label: 'Indsamler' },
  { key: 'synthesizing', label: 'Syntetiserer' },
  { key: 'critiquing', label: 'Pres-tester' },
  { key: 'sharpening', label: 'Skærper' },
];

export type StepStatus = 'pending' | 'active' | 'done';

export function stepStatus(stepKey: ProspectPhase, currentPhase: ProspectPhase | null): StepStatus
```

`stepStatus` sammenligner indekset af `stepKey` og `currentPhase` i `PROSPECT_STEPS`:
tidligere indeks end current → `done`; samme indeks → `active`; senere indeks (eller
`currentPhase === null`) → `pending`. Da "Skærper" kun kører betinget (pres-testen kan
finde briefingen god nok), forbliver dens chip `pending` for et helt kørsels-forløb, hvor
den aldrig aktiveres — det er korrekt, for den blev reelt ikke kørt.

Co-located test `prospectSteps.test.ts` dækker alle tre statusser + `null`-input.

### 2.2 Hook-udvidelse (`src/hooks/useProspectScan.ts`)

- Nyt state: `const [phase, setPhase] = useState<ProspectPhase | null>(null);`
- I SSE-parse-løkken: når `parsed.phase` modtages, sættes `phase` til den rå værdi
  (`setPhase(parsed.phase)`), UDOVER den eksisterende `setProgress(...)`-linje (som
  bevares uændret for baglæns kompatibilitet af den finkornede tekstlinje).
- **Finkornet detalje-tekst:** når `parsed.phase === 'gathering'` OG `parsed.step` er
  til stede (den rå sub-label serveren allerede sender for indsamlings-fasen), brug
  `parsed.step` i stedet for den statiske `PROGRESS_LABELS.gathering`-tekst i `progress`.
  For de øvrige faser er der ingen sub-step fra serveren, så den eksisterende statiske
  label bruges som i dag.
- `phase` nulstilles til `null` i `finally`-blokken (samme sted som `progress`).
- `phase` tilføjes til hookets returnerede objekt.

### 2.3 Wiring (`useContentMachine.ts`, `App.tsx`)

`phase` føres igennem på nøjagtig samme måde som `market`/`synthesisModel` allerede
gør: `prospectPhase: prospect.phase` i `useContentMachine`'s retur-objekt →
destruktureret i `App.tsx` → sendt som ny prop `phase={prospectPhase}` til
`<ProspectRadarPanel>`.

### 2.4 Visning (`ProspectRadarPanel.tsx`)

Ny prop `phase: ProspectPhase | null`. Linjen `{progress && <p ...>{progress}</p>}`
(linje 98) erstattes af:

1. En vandret række af 4 små "chips" (samme visuelle sprog som marked-vælgeren:
   `px-2 py-1 rounded text-xs border`), én pr. `PROSPECT_STEPS`-indgang:
   - `pending`: grå kant/tekst (`border-slate-700 text-slate-500`), tomt cirkel-ikon
     (`Circle` fra lucide-react)
   - `active`: orange kant/baggrund (`border-orange-500 bg-orange-500/15
     text-orange-200`), roterende `Loader2`-ikon (samme visuelle sprog som
     `WorkingOverlay`)
   - `done`: orange, dæmpet baggrund, `Check`-ikon
   Rækken vises kun når `isResearching` er sand (samme betingelse som i dag).
2. Under chip-rækken: den eksisterende finkornede tekstlinje (`progress`), uændret
   styling, nu med det forbedrede indhold fra §2.2.

Ingen ændring af `ProspectList`-komponenten eller resultat-sektionen.

## 3. Fejlhåndtering

Uændret — dette er en ren visnings-forbedring oven på eksisterende, allerede
fejlhåndteret SSE-parsing. Går noget galt undervejs, rammer det samme `catch`/`finally`
som i dag, og chip-rækken forsvinder sammen med resten af progress-visningen.

## 4. Test

- `src/lib/prospectSteps.test.ts` (ny): dækker `stepStatus` for alle status-udfald.
- Ingen test af hook/panel (etableret konvention i dette repo — kun `src/lib`-hjælpere
  testes; `useProspectScan.ts`/`ProspectRadarPanel.tsx` verificeres via `npm run lint`).
- Kvalitetsgate: `npm run lint`, `npm test` (fuld suite), `npm run build` — alle skal
  være grønne.

## 5. Version

Dette er en synlig, om end lille, adfærdsændring (ny visuel komponent). Efter
CLAUDE.md's regel bumpes **patch**-version: `1.27.0` → `1.27.1` (tre steder +
lockfil), da det ikke er en ny bruger-facing feature i sig selv, men en forbedring af
en eksisterende.

## 6. Ikke i scope

- Ingen backend-ændringer.
- Ingen ændring af `WorkingOverlay` (den fuldskærms-modal blev bevidst fravalgt af
  brugeren til fordel for panel-visningen).
- Ingen persistens af trin-historik — kun live status under en aktiv kørsel.
