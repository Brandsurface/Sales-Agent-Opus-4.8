# Prospect Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Prospect Radar" feature to Neura Studio that deep-researches one target company from just a name/URL and produces a Danish call-prep briefing (dossier + concrete gaps + reason to call + opening line) seen through Exemplar's 1:1 packaging-mockup seller lens.

**Architecture:** Two-phase engine mirroring existing patterns: phase 1 gathers intel via Claude `web_search` (Sonnet), phase 2 synthesises a structured `ProspectBrief` via `generateStructured` (Opus). Exposed as an SSE route `/api/prospect-scan`, consumed by a self-contained domain hook + panel rendered in the right workspace column (like `HumanizerPanel`/`LogoPanel`).

**Tech Stack:** Express 4 + `@anthropic-ai/sdk` (server), React 19 + TypeScript + Tailwind 4 (client), Vitest 4 (tests).

## Global Constraints

- Node.js ≥ 20; TypeScript strict mode; avoid `any` except where the Anthropic SDK forces it.
- Only automated quality gates: `npm run lint` (`tsc --noEmit`) and `npm test` (Vitest). Both must pass before every commit.
- Branding: user-visible text, UI labels, export files and AI prompts may say only "Neura Studio" / "Prospect Radar" — never "Content Machine", "Brand Surface" or "Brandsurface".
- Branch: `claude/prospect-radar`. Commit per logical change.
- Version bump `1.25.1` → `1.26.0` (minor, new feature) in THREE places on the final task: `package.json` `"version"`, `src/components/AppHeader.tsx` subtitle span, `src/App.tsx` footer tagline.
- Tests are co-located with source (`foo.test.ts` next to `foo.ts`).
- localStorage keys use the `brand_surface_` prefix (legacy identifier kept for compatibility; not user-visible).
- Briefing output language is Danish, even for international target companies.
- Path alias `@/` resolves to project root; existing modules import with relative paths — follow the neighbouring file's style.

---

### Task 1: Backend — types, seller-profile serialisation & output schema

**Files:**
- Create: `server/ai/prospectScan.ts`
- Test: `server/ai/prospectScan.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - Types `SellerProfile`, `ProspectSignal`, `ProspectGap`, `DecisionMaker`, `ProspectCompetitor`, `ProspectConfidence`, `ProspectCompany`, `ProspectBrief`.
  - `const EXEMPLAR_DEFAULT_SELLER: SellerProfile`
  - `function sellerProfileText(p: SellerProfile): string`
  - `const prospectBriefTool: Anthropic.Tool` (name `'submit_prospect_brief'`)

- [ ] **Step 1: Write the failing test**

Create `server/ai/prospectScan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { prospectBriefTool, sellerProfileText, EXEMPLAR_DEFAULT_SELLER } from './prospectScan';

describe('prospectBriefTool schema', () => {
  it('is named submit_prospect_brief and requires the core fields', () => {
    expect(prospectBriefTool.name).toBe('submit_prospect_brief');
    const req = (prospectBriefTool.input_schema as any).required as string[];
    for (const key of ['company', 'signals', 'gaps', 'reasonToCall', 'openingLine', 'talkingPoints', 'confidence']) {
      expect(req).toContain(key);
    }
  });
});

describe('sellerProfileText', () => {
  it('renders the seller company, offering and triggers so the model can focus', () => {
    const text = sellerProfileText(EXEMPLAR_DEFAULT_SELLER);
    expect(text).toContain('Exemplar');
    expect(text).toContain('mockups');
    expect(text).toContain('Emballage-redesign eller rebranding');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prospectScan`
Expected: FAIL — "Cannot find module './prospectScan'".

- [ ] **Step 3: Write minimal implementation**

Create `server/ai/prospectScan.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

export interface SellerProfile {
  company: string;
  offering: string;
  packagingTypes: string[];
  valueMoments: string[];
  triggers: string[];
  idealCustomerHints: string;
}

export interface ProspectSignal {
  signal: string;
  timeframe: string;
  sourceUrl: string;
  whyItMatters: string;
}

export interface ProspectGap {
  gap: string;
  evidence: string;
  sellerAngle: string;
  valueForThem: string;
}

export interface DecisionMaker {
  role: string;
  name?: string;
  rationale: string;
}

export interface ProspectCompetitor {
  name: string;
  packagingNote: string;
}

export interface ProspectConfidence {
  level: 'høj' | 'middel' | 'lav';
  note: string;
}

export interface ProspectCompany {
  name: string;
  website: string;
  category: string;
  whatTheyDo: string;
  sizeSignal: string;
  keyProducts: string[];
  packagingContext: string;
}

export interface ProspectBrief {
  company: ProspectCompany;
  signals: ProspectSignal[];
  gaps: ProspectGap[];
  reasonToCall: string;
  openingLine: string;
  talkingPoints: string[];
  smartQuestions: string[];
  decisionMakers: DecisionMaker[];
  competitors: ProspectCompetitor[];
  sources: string[];
  confidence: ProspectConfidence;
  researchedAt: string;
}

// ---------------------------------------------------------------------------
// Sælger-profil (Exemplar som standard)
// ---------------------------------------------------------------------------

export const EXEMPLAR_DEFAULT_SELLER: SellerProfile = {
  company: 'Exemplar',
  offering: '1:1 fysiske prøver/mockups af emballage — se og hold det færdige produkt før tryk og produktion',
  packagingTypes: [
    'Foldeæsker/kartonnage', 'Etiketter', 'Flasker & glas', 'Pouches/poser',
    'Displays & POS', 'Bæreposer', 'Sleeves & banderoler',
  ],
  valueMoments: [
    'Kunde- og salgspræsentationer', 'Retail- og investor-møder',
    'Designvalidering før dyr produktion/tryk', 'Messer og events', 'Fotoshoots/PR',
  ],
  triggers: [
    'Emballage-redesign eller rebranding', 'Ny produktlancering',
    'Skift til ny/bæredygtig emballage', 'Retail-pitch eller ny distributionsaftale',
    'Ekspansion til nyt marked',
  ],
  idealCustomerHints: 'Brands/producenter med fysiske produkter, hvor emballagen sælger på hylden',
};

export function sellerProfileText(p: SellerProfile): string {
  return `SÆLGER: ${p.company}
Tilbud: ${p.offering}
Emballage-typer vi dækker: ${(p.packagingTypes || []).join(', ')}
Skaber værdi ved: ${(p.valueMoments || []).join(', ')}
Typiske købs-triggers hos kunden: ${(p.triggers || []).join(', ')}
Ideel kunde: ${p.idealCustomerHints}`;
}

// ---------------------------------------------------------------------------
// Struktureret output-schema
// ---------------------------------------------------------------------------

export const prospectBriefTool: Anthropic.Tool = {
  name: 'submit_prospect_brief',
  description: 'Aflever den færdige opkalds-briefing som strukturerede fund.',
  input_schema: {
    type: 'object',
    properties: {
      company: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          website: { type: 'string' },
          category: { type: 'string', description: 'Branche/kategori.' },
          whatTheyDo: { type: 'string' },
          sizeSignal: { type: 'string', description: 'Størrelse-hint (medarbejdere/omsætning) eller "ukendt".' },
          keyProducts: { type: 'array', items: { type: 'string' } },
          packagingContext: { type: 'string', description: 'Nuværende emballage-situation så vidt fundet.' },
        },
        required: ['name', 'website', 'category', 'whatTheyDo', 'sizeSignal', 'keyProducts', 'packagingContext'],
      },
      signals: {
        type: 'array',
        description: '3-6 nylige begivenheder (launch, rebrand, bæredygtighed, ekspansion, award).',
        items: {
          type: 'object',
          properties: {
            signal: { type: 'string' },
            timeframe: { type: 'string', description: 'Hvornår, så præcist som fundet.' },
            sourceUrl: { type: 'string', description: 'Kilde-URL. Tom hvis ikke web-verificeret.' },
            whyItMatters: { type: 'string', description: 'Hvorfor det er en åbning for sælgeren.' },
          },
          required: ['signal', 'timeframe', 'sourceUrl', 'whyItMatters'],
        },
      },
      gaps: {
        type: 'array',
        description: '3-5 konkrete mangler/behov hvor sælgerens tilbud udfylder hullet.',
        items: {
          type: 'object',
          properties: {
            gap: { type: 'string' },
            evidence: { type: 'string', description: 'Hvad i researchen peger på det (fakta, ikke gæt).' },
            sellerAngle: { type: 'string', description: 'Hvordan sælgerens tilbud udfylder det.' },
            valueForThem: { type: 'string' },
          },
          required: ['gap', 'evidence', 'sellerAngle', 'valueForThem'],
        },
      },
      reasonToCall: { type: 'string', description: 'Den skarpe, konkrete grund til at ringe.' },
      openingLine: { type: 'string', description: 'Foreslået første sætning på dansk, klar til brug.' },
      talkingPoints: { type: 'array', items: { type: 'string' }, description: '3-5 talking points.' },
      smartQuestions: { type: 'array', items: { type: 'string' }, description: '3-5 spørgsmål at stille.' },
      decisionMakers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            name: { type: 'string', description: 'Kun hvis konkret fundet.' },
            rationale: { type: 'string' },
          },
          required: ['role', 'rationale'],
        },
      },
      competitors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            packagingNote: { type: 'string' },
          },
          required: ['name', 'packagingNote'],
        },
      },
      sources: { type: 'array', items: { type: 'string' }, description: 'Alle brugte kilde-URL\'er.' },
      confidence: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['høj', 'middel', 'lav'] },
          note: { type: 'string', description: 'Hvad er web-verificeret vs. antaget.' },
        },
        required: ['level', 'note'],
      },
      researchedAt: { type: 'string', description: 'ISO 8601-tidsstempel.' },
    },
    required: [
      'company', 'signals', 'gaps', 'reasonToCall', 'openingLine',
      'talkingPoints', 'smartQuestions', 'decisionMakers', 'competitors',
      'sources', 'confidence', 'researchedAt',
    ],
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prospectScan`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add server/ai/prospectScan.ts server/ai/prospectScan.test.ts
git commit -m "feat(prospect): add ProspectBrief types, seller profile & output schema"
```

---

### Task 2: Backend — intel-gathering phase (web_search)

**Files:**
- Modify: `server/ai/prospectScan.ts`
- Test: `server/ai/prospectScan.test.ts`

**Interfaces:**
- Consumes: `SellerProfile`, `sellerProfileText` (Task 1).
- Produces:
  - `interface GatherResult { memo: string; sources: string[]; webSearchUsed: boolean }`
  - `async function gatherIntel(company: string, sellerProfile: SellerProfile, onProgress?: (step: string) => void, signal?: AbortSignal): Promise<GatherResult>`

- [ ] **Step 1: Write the failing test**

Append to `server/ai/prospectScan.test.ts` (add imports for `vi`, `beforeEach` and the mock at the TOP of the file):

```ts
// --- add to the top of the file, before other imports ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./anthropic', () => ({ anthropic: { messages: { create: vi.fn() } } }));
import { anthropic } from './anthropic';
import { gatherIntel } from './prospectScan';

const mockedCreate = vi.mocked(anthropic.messages.create);
```

```ts
// --- add as new describe block ---
describe('gatherIntel', () => {
  beforeEach(() => mockedCreate.mockReset());

  it('returns the memo and extracted source URLs when the model finishes', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Acme lancerede ny linje (https://acme.dk/news).' }],
      stop_reason: 'end_turn',
    } as any);

    const result = await gatherIntel('Acme', EXEMPLAR_DEFAULT_SELLER);

    expect(result.webSearchUsed).toBe(true);
    expect(result.memo).toContain('Acme lancerede');
    expect(result.sources).toContain('https://acme.dk/news');
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('falls back gracefully when web search is unavailable', async () => {
    mockedCreate.mockRejectedValueOnce(Object.assign(new Error('web_search not supported on this tier'), { status: 400 }));

    const result = await gatherIntel('Acme', EXEMPLAR_DEFAULT_SELLER);

    expect(result.webSearchUsed).toBe(false);
    expect(result.memo).toBe('');
    expect(result.sources).toEqual([]);
  });
});
```

Note: `EXEMPLAR_DEFAULT_SELLER` is already imported from Task 1's assertions — reuse that import; do not import it twice.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prospectScan`
Expected: FAIL — "gatherIntel is not exported" / not a function.

- [ ] **Step 3: Write minimal implementation**

Add to `server/ai/prospectScan.ts` (imports at top, plus the code below at the end of the file):

```ts
// --- add to the imports at the top ---
import { anthropic } from './anthropic';
import { config } from './config';
import { cacheableSystem } from './prompts';
```

```ts
// --- add at the end of the file ---

const WEB_SEARCH_BETA = 'web-search-2025-03-05';

export interface GatherResult {
  memo: string;
  sources: string[];
  webSearchUsed: boolean;
}

const GATHER_SYSTEM = `Du er B2B-salgsanalytiker og research-specialist. Din opgave er at grave dybt i ÉN målvirksomhed via websøgning, så en sælger kan ringe dem op med en konkret, velinformeret grund.

Søg systematisk efter (søg på både dansk og engelsk):
1. Firma-overblik: hvad laver de, kategori, marked, størrelse
2. Produktlinjer og nøgleprodukter/SKU'er
3. Emballage-situation: materialer, format, bæredygtighed, seneste redesigns
4. Retail/distribution og listinger
5. Nyheder de seneste 6-18 mdr.: lanceringer, rebrands, ekspansion, kapital, awards, bæredygtighedsløfter
6. Sandsynlige beslutningstagere (brand, marketing, emballage, indkøb)
7. Konkurrenter og hvordan de præsenterer emballage

Principper:
- Brug web_search til konkrete, aktuelle fund — ikke generelle betragtninger fra din træningsdata.
- Angiv en kilde-URL efter hvert konkret fund.
- Gæt aldrig navne eller tal. Markér det du IKKE kunne finde.

Når du har søgt bredt nok, SKRIV en grundig research-memo på dansk med de konkrete fund og kilder i parentes. Skriv KUN memoen som almindelig tekst — kald ingen værktøjer i din afsluttende besked.`;

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;]+$/, ''))));
}

export async function gatherIntel(
  company: string,
  sellerProfile: SellerProfile,
  onProgress?: (step: string) => void,
  signal?: AbortSignal,
): Promise<GatherResult> {
  const initialPrompt = `Research målvirksomheden "${company}" grundigt via websøgning.

${sellerProfileText(sellerProfile)}

Brug sælger-konteksten til at prioritere: led især efter tegn på købs-triggers og på emballage-typer sælgeren dækker.

Søg systematisk efter firma-overblik, produkter, emballage-situation, retail, nyheder, beslutningstagere og konkurrenter. Afslut med en grundig research-memo på dansk med kilder.`;

  const systemBlocks = cacheableSystem([GATHER_SYSTEM]);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: [{ type: 'text', text: initialPrompt }] },
  ];
  const webSearchTool = { type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool;

  onProgress?.('Firma-overblik & produkter');

  let memo = '';
  let maxTurns = 14;
  let searchTurns = 0;

  while (maxTurns-- > 0) {
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create(
        {
          model: config.model,
          max_tokens: 4000,
          system: systemBlocks,
          tools: [webSearchTool],
          messages,
        },
        { signal, headers: { 'anthropic-beta': WEB_SEARCH_BETA } } as any,
      );
    } catch (err: any) {
      if (err?.status === 400 && String(err?.message ?? '').includes('web_search')) {
        console.warn('[prospect-scan] Web search utilgængelig — falder tilbage til videnbaseret.');
        return { memo, sources: extractUrls(memo), webSearchUsed: false };
      }
      throw err;
    }

    const textBlocks = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text);
    if (textBlocks.length) memo = textBlocks.join('\n');

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      if (memo.trim()) return { memo, sources: extractUrls(memo), webSearchUsed: true };
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: 'Skriv nu den samlede research-memo på dansk med kilder.' }],
      });
      continue;
    }

    // pause_turn / server-tool-turn: fortsæt løkken med den akkumulerede samtale.
    searchTurns++;
    if (searchTurns === 3) onProgress?.('Nyheder, emballage & beslutningstagere');
    if (searchTurns === 6) onProgress?.('Konkurrenter & retail');
  }

  return { memo, sources: extractUrls(memo), webSearchUsed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prospectScan`
Expected: PASS (all Task 1 + Task 2 assertions).

- [ ] **Step 5: Commit**

```bash
git add server/ai/prospectScan.ts server/ai/prospectScan.test.ts
git commit -m "feat(prospect): add web_search intel-gathering phase with fallback"
```

---

### Task 3: Backend — synthesis + orchestration

**Files:**
- Modify: `server/ai/prospectScan.ts`
- Test: `server/ai/prospectScan.test.ts`

**Interfaces:**
- Consumes: `gatherIntel`, `GatherResult`, `SellerProfile`, `sellerProfileText`, `prospectBriefTool`, `ProspectBrief` (Tasks 1–2); `generateStructured` (existing `./structured`), `cacheableSystem`, `config`.
- Produces:
  - `type ProspectProgress = { phase: 'gathering'; step: string } | { phase: 'synthesizing' }`
  - `async function synthesizeBrief(company: string, gather: GatherResult, sellerProfile: SellerProfile, signal?: AbortSignal): Promise<ProspectBrief>`
  - `async function runProspectScan(company: string, sellerProfile: SellerProfile, onProgress: (e: ProspectProgress) => void, signal?: AbortSignal): Promise<ProspectBrief>`

- [ ] **Step 1: Write the failing test**

Add the `./structured` mock next to the `./anthropic` mock at the top of `server/ai/prospectScan.test.ts`:

```ts
// --- add near the other vi.mock at the top ---
vi.mock('./structured', () => ({ generateStructured: vi.fn() }));
import { generateStructured } from './structured';
import { config } from './config';
import { runProspectScan } from './prospectScan';

const mockedStructured = vi.mocked(generateStructured);

const fakeBrief = {
  company: { name: 'Acme', website: 'acme.dk', category: 'FMCG', whatTheyDo: 'x', sizeSignal: 'ukendt', keyProducts: [], packagingContext: 'x' },
  signals: [], gaps: [], reasonToCall: 'r', openingLine: 'o', talkingPoints: [], smartQuestions: [],
  decisionMakers: [], competitors: [], sources: [], confidence: { level: 'middel', note: 'n' }, researchedAt: '',
};
```

```ts
// --- add as new describe block ---
describe('runProspectScan', () => {
  beforeEach(() => { mockedCreate.mockReset(); mockedStructured.mockReset(); });

  it('gathers then synthesises with Opus through the seller lens', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Fund om Acme (https://acme.dk).' }],
      stop_reason: 'end_turn',
    } as any);
    mockedStructured.mockResolvedValueOnce(fakeBrief as any);

    const phases: string[] = [];
    const brief = await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, (e) => phases.push(e.phase));

    expect(phases).toContain('gathering');
    expect(phases).toContain('synthesizing');
    expect(brief.company.name).toBe('Acme');

    const opts = mockedStructured.mock.calls[0][0];
    expect(opts.model).toBe(config.creativeModel);
    expect(opts.tool.name).toBe('submit_prospect_brief');
    const userText = (opts.userContent[0] as any).text as string;
    expect(userText).toContain('Exemplar');
    expect(userText).toContain('Fund om Acme');
  });

  it('tells synthesis to use knowledge-only when web search failed', async () => {
    mockedCreate.mockRejectedValueOnce(Object.assign(new Error('web_search not supported'), { status: 400 }));
    mockedStructured.mockResolvedValueOnce(fakeBrief as any);

    await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, () => {});

    const userText = (mockedStructured.mock.calls[0][0].userContent[0] as any).text as string;
    expect(userText).toContain('Websøgning var ikke tilgængelig');
  });

  it('throws without calling the model when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, () => {}, controller.signal),
    ).rejects.toThrow();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedStructured).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prospectScan`
Expected: FAIL — "runProspectScan is not exported".

- [ ] **Step 3: Write minimal implementation**

Add to the imports and end of `server/ai/prospectScan.ts`:

```ts
// --- add to the imports at the top ---
import { generateStructured } from './structured';
```

```ts
// --- add at the end of the file ---

const SYNTHESIS_SYSTEM = `Du er senior B2B-salgsstrateg. Du modtager en research-memo om én målvirksomhed og en sælger-profil, og du forvandler det til en skarp opkalds-briefing på dansk.

Regler (kritiske — briefingen bruges til rigtige opkald):
- Hver faktapåstand om virksomheden og hvert signal skal kunne spores til memoen. Opfind aldrig navne, tal eller citater.
- Er noget ikke fundet, så skriv "ukendt" — gæt aldrig. Udfyld kun decisionMakers.name ved konkret fund.
- Skeln bevis fra antagelse: gap.evidence skal referere til noget fra memoen; sellerAngle og valueForThem må være ræsonnement.
- Se ALT gennem sælger-linsen: hvor ville sælgerens tilbud konkret hjælpe NETOP denne virksomhed?
- confidence.level afspejler mængden af verificerbar evidens (høj/middel/lav).
- Skriv alt på dansk, også for internationale virksomheder.

Afslut ved at kalde submit_prospect_brief med den fulde, strukturerede briefing.`;

export type ProspectProgress =
  | { phase: 'gathering'; step: string }
  | { phase: 'synthesizing' };

export async function synthesizeBrief(
  company: string,
  gather: GatherResult,
  sellerProfile: SellerProfile,
  signal?: AbortSignal,
): Promise<ProspectBrief> {
  const knowledgeOnlyNote = gather.webSearchUsed
    ? ''
    : '\n\nBEMÆRK: Websøgning var ikke tilgængelig. Basér briefingen på din videnbase, sæt confidence.level = "lav", og skriv i noten at fundene ikke er web-verificerede.';

  const user = `MÅLVIRKSOMHED: ${company}

${sellerProfileText(sellerProfile)}

RESEARCH-MEMO FRA INDSAMLINGEN:
${gather.memo.trim() || '(ingen web-fund tilgængelige)'}

KENDTE KILDER: ${gather.sources.length ? gather.sources.join(', ') : 'ingen'}

Syntetisér nu den fulde opkalds-briefing. Skriv på dansk. Aflever via submit_prospect_brief.${knowledgeOnlyNote}`;

  const brief = await generateStructured<ProspectBrief>({
    system: cacheableSystem([SYNTHESIS_SYSTEM]),
    userContent: [{ type: 'text', text: user }],
    tool: prospectBriefTool,
    model: config.creativeModel,
    maxTokens: 6000,
    signal,
  });

  brief.researchedAt = brief.researchedAt || new Date().toISOString();
  if ((!brief.sources || brief.sources.length === 0) && gather.sources.length) {
    brief.sources = gather.sources;
  }
  return brief;
}

export async function runProspectScan(
  company: string,
  sellerProfile: SellerProfile,
  onProgress: (e: ProspectProgress) => void,
  signal?: AbortSignal,
): Promise<ProspectBrief> {
  if (signal?.aborted) throw new Error('Annulleret.');
  const gather = await gatherIntel(
    company,
    sellerProfile,
    (step) => onProgress({ phase: 'gathering', step }),
    signal,
  );
  onProgress({ phase: 'synthesizing' });
  return synthesizeBrief(company, gather, sellerProfile, signal);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prospectScan`
Expected: PASS (all Task 1–3 assertions).

- [ ] **Step 5: Type-check and commit**

```bash
npm run lint
git add server/ai/prospectScan.ts server/ai/prospectScan.test.ts
git commit -m "feat(prospect): add Opus synthesis + two-phase orchestration"
```

---

### Task 4: Backend — SSE API route

**Files:**
- Modify: `server.ts` (add import near the other `./server/ai/*` imports; add route in the `/api` route group)

**Interfaces:**
- Consumes: `runProspectScan`, `EXEMPLAR_DEFAULT_SELLER` (Task 1/3).
- Produces: `POST /api/prospect-scan` (SSE) — request `{ company: string, sellerProfile?: SellerProfile }`; emits `data: {phase,...}`, then `data: {done:true, brief}`, then `data: [DONE]`.

- [ ] **Step 1: Add the import**

At the top of `server.ts`, alongside the existing `./server/ai/...` imports (e.g. next to the `culturalScan` import), add:

```ts
import { runProspectScan, EXEMPLAR_DEFAULT_SELLER } from './server/ai/prospectScan';
```

(If server.ts imports ai modules via a different relative path, match that path — the module lives at `server/ai/prospectScan.ts`.)

- [ ] **Step 2: Add the route**

Immediately after the `app.post('/api/cultural-scan', ...)` handler in `server.ts`, add:

```ts
  // Prospect Radar: dyb salgs-research af én målvirksomhed (streaming via SSE)
  app.post('/api/prospect-scan', async (req, res) => {
    const { company, sellerProfile } = req.body;
    if (!company || !String(company).trim()) {
      return res.status(400).json({ error: 'Firmanavn eller website er påkrævet.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': keep-alive\n\n');
    }, 15000);

    try {
      const brief = await runProspectScan(
        String(company).trim(),
        sellerProfile ?? EXEMPLAR_DEFAULT_SELLER,
        (e) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); },
      );
      res.write(`data: ${JSON.stringify({ done: true, brief })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      console.error('Fejl under prospect-scan:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Prospect-scan fejlede.' });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.write('data: [DONE]\n\n');
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });
```

- [ ] **Step 3: Type-check and build**

Run: `npm run lint`
Expected: PASS (no type errors).

Run: `npm run build`
Expected: PASS (esbuild bundles `server.ts` without error).

- [ ] **Step 4: Manual smoke test (optional, requires ANTHROPIC_API_KEY)**

Run: `npm run dev`, then in another terminal:
`curl -N -X POST http://localhost:3000/api/prospect-scan -H "Content-Type: application/json" -d '{"company":"exemplar.dk"}'`
Expected: SSE stream with `data: {"phase":"gathering",...}` lines, then a `data: {"done":true,"brief":{...}}` line, then `data: [DONE]`.

- [ ] **Step 5: Commit**

```bash
git add server.ts
git commit -m "feat(prospect): add /api/prospect-scan SSE route"
```

---

### Task 5: Frontend — shared types + Markdown export lib

**Files:**
- Modify: `src/types.ts` (append the Prospect Radar interfaces)
- Create: `src/lib/prospectExport.ts`
- Test: `src/lib/prospectExport.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (mirrors the server types for the client).
- Produces:
  - In `src/types.ts`: `SellerProfile`, `ProspectSignal`, `ProspectGap`, `DecisionMaker`, `ProspectCompetitor`, `ProspectConfidence`, `ProspectCompany`, `ProspectBrief` (identical shape to the server types).
  - `function prospectBriefToMarkdown(brief: ProspectBrief): string`
  - `function downloadProspectMarkdown(brief: ProspectBrief): void`

- [ ] **Step 1: Add the shared types**

Append to `src/types.ts`:

```ts
// ---------------------------------------------------------------------------
// Prospect Radar (salgs-research)
// ---------------------------------------------------------------------------

export interface SellerProfile {
  company: string;
  offering: string;
  packagingTypes: string[];
  valueMoments: string[];
  triggers: string[];
  idealCustomerHints: string;
}

export interface ProspectSignal {
  signal: string;
  timeframe: string;
  sourceUrl: string;
  whyItMatters: string;
}

export interface ProspectGap {
  gap: string;
  evidence: string;
  sellerAngle: string;
  valueForThem: string;
}

export interface DecisionMaker {
  role: string;
  name?: string;
  rationale: string;
}

export interface ProspectCompetitor {
  name: string;
  packagingNote: string;
}

export interface ProspectConfidence {
  level: 'høj' | 'middel' | 'lav';
  note: string;
}

export interface ProspectCompany {
  name: string;
  website: string;
  category: string;
  whatTheyDo: string;
  sizeSignal: string;
  keyProducts: string[];
  packagingContext: string;
}

export interface ProspectBrief {
  company: ProspectCompany;
  signals: ProspectSignal[];
  gaps: ProspectGap[];
  reasonToCall: string;
  openingLine: string;
  talkingPoints: string[];
  smartQuestions: string[];
  decisionMakers: DecisionMaker[];
  competitors: ProspectCompetitor[];
  sources: string[];
  confidence: ProspectConfidence;
  researchedAt: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/prospectExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { prospectBriefToMarkdown } from './prospectExport';
import type { ProspectBrief } from '../types';

const brief: ProspectBrief = {
  company: { name: 'Acme', website: 'acme.dk', category: 'FMCG', whatTheyDo: 'Snacks', sizeSignal: '50 ansatte', keyProducts: ['Chips'], packagingContext: 'Plastposer' },
  signals: [{ signal: 'Rebrand', timeframe: '2026', sourceUrl: 'https://acme.dk/news', whyItMatters: 'Nyt design skal valideres' }],
  gaps: [{ gap: 'Ingen fysiske prøver', evidence: 'Rebrand annonceret', sellerAngle: '1:1 mockup', valueForThem: 'Se før tryk' }],
  reasonToCall: 'Deres rebrand',
  openingLine: 'Hej, jeg så I er i gang med et rebrand …',
  talkingPoints: ['Rebrand-timing'],
  smartQuestions: ['Hvornår går I i tryk?'],
  decisionMakers: [{ role: 'Marketingchef', rationale: 'Ejer rebrandet' }],
  competitors: [{ name: 'BetaSnack', packagingNote: 'Nye pouches' }],
  sources: ['https://acme.dk/news'],
  confidence: { level: 'middel', note: 'Delvist verificeret' },
  researchedAt: '2026-07-01T10:00:00.000Z',
};

describe('prospectBriefToMarkdown', () => {
  it('renders the headline sections a caller needs', () => {
    const md = prospectBriefToMarkdown(brief);
    expect(md).toContain('# Prospect Radar — Acme');
    expect(md).toContain('Grund til at ringe');
    expect(md).toContain('Deres rebrand');
    expect(md).toContain('Mangler & behov');
    expect(md).toContain('Ingen fysiske prøver');
    expect(md).toContain('https://acme.dk/news');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- prospectExport`
Expected: FAIL — "Cannot find module './prospectExport'".

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/prospectExport.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProspectBrief } from '../types';

export function prospectBriefToMarkdown(brief: ProspectBrief): string {
  const c = brief.company;
  const lines: string[] = [];

  lines.push(`# Prospect Radar — ${c.name}`);
  lines.push('');
  lines.push(`*Researchet ${new Date(brief.researchedAt).toLocaleString('da-DK')} · Konfidens: ${brief.confidence.level}*`);
  lines.push('');
  lines.push(`## Grund til at ringe`);
  lines.push(brief.reasonToCall);
  lines.push('');
  lines.push(`**Åbningsreplik:** ${brief.openingLine}`);
  lines.push('');

  lines.push(`## Firma`);
  lines.push(`- **Website:** ${c.website}`);
  lines.push(`- **Kategori:** ${c.category}`);
  lines.push(`- **Hvad de laver:** ${c.whatTheyDo}`);
  lines.push(`- **Størrelse:** ${c.sizeSignal}`);
  lines.push(`- **Nøgleprodukter:** ${c.keyProducts.join(', ') || 'ukendt'}`);
  lines.push(`- **Emballage-situation:** ${c.packagingContext}`);
  lines.push('');

  lines.push(`## Mangler & behov`);
  brief.gaps.forEach((g, i) => {
    lines.push(`${i + 1}. **${g.gap}**`);
    lines.push(`   - Bevis: ${g.evidence}`);
    lines.push(`   - Exemplar-vinkel: ${g.sellerAngle}`);
    lines.push(`   - Værdi for dem: ${g.valueForThem}`);
  });
  lines.push('');

  lines.push(`## Signaler`);
  brief.signals.forEach((s) => {
    lines.push(`- **${s.signal}** (${s.timeframe}) — ${s.whyItMatters}${s.sourceUrl ? ` [kilde](${s.sourceUrl})` : ''}`);
  });
  lines.push('');

  lines.push(`## Talking points`);
  brief.talkingPoints.forEach((t) => lines.push(`- ${t}`));
  lines.push('');

  lines.push(`## Smarte spørgsmål`);
  brief.smartQuestions.forEach((q) => lines.push(`- ${q}`));
  lines.push('');

  lines.push(`## Beslutningstagere`);
  brief.decisionMakers.forEach((d) => lines.push(`- **${d.role}**${d.name ? ` (${d.name})` : ''} — ${d.rationale}`));
  lines.push('');

  if (brief.competitors.length) {
    lines.push(`## Konkurrenter`);
    brief.competitors.forEach((k) => lines.push(`- **${k.name}** — ${k.packagingNote}`));
    lines.push('');
  }

  lines.push(`## Kilder`);
  brief.sources.forEach((u) => lines.push(`- ${u}`));
  lines.push('');
  lines.push(`> Konfidens-note: ${brief.confidence.note}`);

  return lines.join('\n');
}

export function downloadProspectMarkdown(brief: ProspectBrief): void {
  const md = prospectBriefToMarkdown(brief);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospect-${brief.company.name.replace(/[^\w-]+/g, '_').toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- prospectExport`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/prospectExport.ts src/lib/prospectExport.test.ts
git commit -m "feat(prospect): add shared types + Markdown export"
```

---

### Task 6: Frontend — seller-profile persistence

**Files:**
- Create: `src/lib/sellerProfile.ts`
- Test: `src/lib/sellerProfile.test.ts`

**Interfaces:**
- Consumes: `SellerProfile` (Task 5).
- Produces:
  - `const EXEMPLAR_DEFAULT_SELLER: SellerProfile`
  - `function loadSellerProfile(): SellerProfile`
  - `function saveSellerProfile(p: SellerProfile): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sellerProfile.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
});

import { loadSellerProfile, saveSellerProfile, EXEMPLAR_DEFAULT_SELLER } from './sellerProfile';

describe('sellerProfile persistence', () => {
  beforeEach(() => localStorage.clear());

  it('returns the Exemplar default when nothing is stored', () => {
    expect(loadSellerProfile().company).toBe('Exemplar');
    expect(EXEMPLAR_DEFAULT_SELLER.packagingTypes.length).toBeGreaterThan(0);
  });

  it('round-trips a saved profile and merges over the default', () => {
    saveSellerProfile({ ...EXEMPLAR_DEFAULT_SELLER, company: 'Nyt Firma' });
    const loaded = loadSellerProfile();
    expect(loaded.company).toBe('Nyt Firma');
    expect(loaded.offering).toBe(EXEMPLAR_DEFAULT_SELLER.offering);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sellerProfile`
Expected: FAIL — "Cannot find module './sellerProfile'".

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/sellerProfile.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SellerProfile } from '../types';

const KEY = 'brand_surface_seller_profile';

export const EXEMPLAR_DEFAULT_SELLER: SellerProfile = {
  company: 'Exemplar',
  offering: '1:1 fysiske prøver/mockups af emballage — se og hold det færdige produkt før tryk og produktion',
  packagingTypes: [
    'Foldeæsker/kartonnage', 'Etiketter', 'Flasker & glas', 'Pouches/poser',
    'Displays & POS', 'Bæreposer', 'Sleeves & banderoler',
  ],
  valueMoments: [
    'Kunde- og salgspræsentationer', 'Retail- og investor-møder',
    'Designvalidering før dyr produktion/tryk', 'Messer og events', 'Fotoshoots/PR',
  ],
  triggers: [
    'Emballage-redesign eller rebranding', 'Ny produktlancering',
    'Skift til ny/bæredygtig emballage', 'Retail-pitch eller ny distributionsaftale',
    'Ekspansion til nyt marked',
  ],
  idealCustomerHints: 'Brands/producenter med fysiske produkter, hvor emballagen sælger på hylden',
};

export function loadSellerProfile(): SellerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EXEMPLAR_DEFAULT_SELLER;
    const parsed = JSON.parse(raw) as Partial<SellerProfile>;
    return { ...EXEMPLAR_DEFAULT_SELLER, ...parsed };
  } catch {
    return EXEMPLAR_DEFAULT_SELLER;
  }
}

export function saveSellerProfile(p: SellerProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignoreres (quota / privat browsing) */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sellerProfile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sellerProfile.ts src/lib/sellerProfile.test.ts
git commit -m "feat(prospect): add seller-profile persistence with Exemplar default"
```

---

### Task 7: Frontend — `useProspectScan` domain hook

**Files:**
- Create: `src/hooks/useProspectScan.ts`

**Interfaces:**
- Consumes: `ProspectBrief`, `SellerProfile` (Task 5); `loadSellerProfile`, `saveSellerProfile`, `EXEMPLAR_DEFAULT_SELLER` (Task 6); `httpErrorMessage` (existing `./httpError`).
- Produces: `function useProspectScan(setErrorMsg: (m: string | null) => void)` returning `{ company, setCompany, sellerProfile, setSellerProfile, resetSellerProfile, brief, isResearching, progress, handleResearch, handleClearBrief }`.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useProspectScan.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ProspectBrief, SellerProfile } from '../types';
import { httpErrorMessage } from './httpError';
import { loadSellerProfile, saveSellerProfile, EXEMPLAR_DEFAULT_SELLER } from '../lib/sellerProfile';

const PROGRESS_LABELS: Record<string, string> = {
  gathering: 'Graver efter fund …',
  synthesizing: 'Syntetiserer briefing …',
};

/**
 * Prospect Radar som selvstændigt domæne: input er kun et firmanavn/website,
 * så hooket er uafhængigt af det kreative brief. Sælger-profilen persisteres
 * lokalt, så den kun skal redigeres én gang.
 */
export function useProspectScan(setErrorMsg: (m: string | null) => void) {
  const [company, setCompany] = useState('');
  const [sellerProfile, setSellerProfileState] = useState<SellerProfile>(() => loadSellerProfile());
  const [brief, setBrief] = useState<ProspectBrief | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const setSellerProfile = (p: SellerProfile) => {
    setSellerProfileState(p);
    saveSellerProfile(p);
  };
  const resetSellerProfile = () => setSellerProfile(EXEMPLAR_DEFAULT_SELLER);

  const handleResearch = async () => {
    if (!company.trim()) {
      setErrorMsg('Skriv et firmanavn eller website for at researche.');
      return;
    }
    setIsResearching(true);
    setErrorMsg(null);
    setProgress(PROGRESS_LABELS.gathering);
    try {
      const response = await fetch('/api/prospect-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim(), sellerProfile }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(httpErrorMessage(response.status, errData.error));
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalBrief: ProspectBrief | null = null;
      let streamErr: string | null = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break outer;
          let parsed: any;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (parsed.phase) setProgress(PROGRESS_LABELS[parsed.phase] ?? parsed.phase);
          if (parsed.error) streamErr = parsed.error;
          if (parsed.done && parsed.brief) finalBrief = parsed.brief as ProspectBrief;
        }
      }

      if (streamErr) throw new Error(streamErr);
      if (!finalBrief) throw new Error('Ingen briefing modtaget fra serveren.');
      setBrief(finalBrief);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Prospect-scan fejlede.');
    } finally {
      setIsResearching(false);
      setProgress(null);
    }
  };

  const handleClearBrief = () => setBrief(null);

  return {
    company, setCompany,
    sellerProfile, setSellerProfile, resetSellerProfile,
    brief, isResearching, progress,
    handleResearch, handleClearBrief,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProspectScan.ts
git commit -m "feat(prospect): add useProspectScan domain hook (SSE)"
```

---

### Task 8: Frontend — `ProspectRadarPanel` component

**Files:**
- Create: `src/components/ProspectRadarPanel.tsx`

**Interfaces:**
- Consumes: the return shape of `useProspectScan` (Task 7); `ProspectBrief`, `SellerProfile` (Task 5); `downloadProspectMarkdown`, `prospectBriefToMarkdown` (Task 5).
- Produces: `function ProspectRadarPanel(props: ProspectRadarPanelProps)` — a self-contained panel.

- [ ] **Step 1: Create the component**

Create `src/components/ProspectRadarPanel.tsx`:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Radar, Search, Copy, Download, X } from 'lucide-react';
import { ProspectBrief, SellerProfile } from '../types';
import { prospectBriefToMarkdown, downloadProspectMarkdown } from '../lib/prospectExport';

interface ProspectRadarPanelProps {
  company: string;
  setCompany: (v: string) => void;
  sellerProfile: SellerProfile;
  setSellerProfile: (p: SellerProfile) => void;
  resetSellerProfile: () => void;
  brief: ProspectBrief | null;
  isResearching: boolean;
  progress: string | null;
  onResearch: () => void;
  onClearBrief: () => void;
}

export function ProspectRadarPanel({
  company, setCompany, sellerProfile, setSellerProfile, resetSellerProfile,
  brief, isResearching, progress, onResearch, onClearBrief,
}: ProspectRadarPanelProps) {
  const [showProfile, setShowProfile] = useState(false);

  const copyAll = () => {
    if (brief) navigator.clipboard.writeText(prospectBriefToMarkdown(brief)).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">Prospect Radar</h2>
        <span className="text-[11px] text-slate-500">· varm grund til at ringe</span>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isResearching) onResearch(); }}
          placeholder="Firmanavn eller website (fx exemplar.dk)"
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
          disabled={isResearching}
        />
        <button
          onClick={onResearch}
          disabled={isResearching}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {isResearching ? 'Researcher…' : 'Research'}
        </button>
      </div>

      {progress && <p className="text-xs text-orange-300 font-mono animate-pulse">{progress}</p>}

      {/* Sælger-profil (foldbar) */}
      <div className="text-xs">
        <button onClick={() => setShowProfile((v) => !v)} className="text-slate-400 hover:text-slate-200 underline underline-offset-2">
          {showProfile ? 'Skjul' : 'Rediger'} sælger-profil ({sellerProfile.company})
        </button>
        {showProfile && (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <label className="block">
              <span className="text-slate-400">Firma</span>
              <input
                value={sellerProfile.company}
                onChange={(e) => setSellerProfile({ ...sellerProfile, company: e.target.value })}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Tilbud</span>
              <textarea
                value={sellerProfile.offering}
                onChange={(e) => setSellerProfile({ ...sellerProfile, offering: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Emballage-typer (komma-adskilt)</span>
              <input
                value={sellerProfile.packagingTypes.join(', ')}
                onChange={(e) => setSellerProfile({ ...sellerProfile, packagingTypes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Købs-triggers (komma-adskilt)</span>
              <input
                value={sellerProfile.triggers.join(', ')}
                onChange={(e) => setSellerProfile({ ...sellerProfile, triggers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-100"
              />
            </label>
            <button onClick={resetSellerProfile} className="text-slate-400 hover:text-orange-300 underline underline-offset-2">
              Nulstil til Exemplar-standard
            </button>
          </div>
        )}
      </div>

      {/* Resultat */}
      {brief && (
        <div className="space-y-4 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">{brief.company.name}</h3>
            <div className="flex items-center gap-2">
              <button onClick={copyAll} title="Kopiér alt" className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Copy className="w-4 h-4" /></button>
              <button onClick={() => downloadProspectMarkdown(brief)} title="Download .md" className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Download className="w-4 h-4" /></button>
              <button onClick={onClearBrief} title="Ryd" className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <section className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-orange-300">Grund til at ringe</p>
            <p className="mt-1 text-sm text-slate-100">{brief.reasonToCall}</p>
            <p className="mt-2 text-sm italic text-slate-300">“{brief.openingLine}”</p>
          </section>

          <ProspectList title="Mangler & behov" items={brief.gaps.map((g) => `${g.gap} — ${g.sellerAngle} (bevis: ${g.evidence})`)} />
          <ProspectList title="Signaler" items={brief.signals.map((s) => `${s.signal} (${s.timeframe}) — ${s.whyItMatters}`)} />
          <ProspectList title="Talking points" items={brief.talkingPoints} />
          <ProspectList title="Smarte spørgsmål" items={brief.smartQuestions} />
          <ProspectList title="Beslutningstagere" items={brief.decisionMakers.map((d) => `${d.role}${d.name ? ` (${d.name})` : ''} — ${d.rationale}`)} />

          {brief.sources.length > 0 && (
            <section>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Kilder</p>
              <ul className="mt-1 space-y-1">
                {brief.sources.map((u, i) => (
                  <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 break-all">{u}</a></li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11px] text-slate-500">Konfidens: <span className="text-slate-300">{brief.confidence.level}</span> · {brief.confidence.note}</p>
        </div>
      )}
    </div>
  );
}

function ProspectList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="mt-1 space-y-1 list-disc list-inside">
        {items.map((it, i) => <li key={i} className="text-sm text-slate-200">{it}</li>)}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProspectRadarPanel.tsx
git commit -m "feat(prospect): add ProspectRadarPanel component"
```

---

### Task 9: Wiring — compose hook, render panel, version bump

**Files:**
- Modify: `src/hooks/useContentMachine.ts` (compose `useProspectScan`, spread its return)
- Modify: `src/App.tsx` (import + render `ProspectRadarPanel`; bump footer version)
- Modify: `src/components/AppHeader.tsx` (bump subtitle version)
- Modify: `package.json` (bump `"version"`)

**Interfaces:**
- Consumes: `useProspectScan` (Task 7), `ProspectRadarPanel` (Task 8).
- Produces: the feature wired into the running app.

- [ ] **Step 1: Compose the hook in `useContentMachine.ts`**

Add the import near the other hook imports at the top of `src/hooks/useContentMachine.ts`:

```ts
import { useProspectScan } from './useProspectScan';
```

Inside the `useContentMachine` function body, after the other domain-hook compositions (e.g. after the `useCreativeFunnel(...)` call), add:

```ts
  const prospect = useProspectScan(setErrorMsg);
```

Then include its values in the object the hook returns (find the single large `return { ... }` and add these keys):

```ts
    // Prospect Radar
    prospectCompany: prospect.company,
    setProspectCompany: prospect.setCompany,
    prospectSellerProfile: prospect.sellerProfile,
    setProspectSellerProfile: prospect.setSellerProfile,
    resetProspectSellerProfile: prospect.resetSellerProfile,
    prospectBrief: prospect.brief,
    isResearchingProspect: prospect.isResearching,
    prospectProgress: prospect.progress,
    handleProspectResearch: prospect.handleResearch,
    handleClearProspectBrief: prospect.handleClearBrief,
```

Note: `setErrorMsg` already exists in this hook (it is passed to the other domain hooks). Reuse the existing one — do not create a second.

- [ ] **Step 2: Render the panel in `App.tsx`**

Add the import near the other component imports at the top of `src/App.tsx`:

```ts
import { ProspectRadarPanel } from './components/ProspectRadarPanel';
```

Destructure the new keys in the big `useContentMachine()` destructuring block (add alongside the existing entries):

```ts
    prospectCompany, setProspectCompany,
    prospectSellerProfile, setProspectSellerProfile, resetProspectSellerProfile,
    prospectBrief, isResearchingProspect, prospectProgress,
    handleProspectResearch, handleClearProspectBrief,
```

Render the panel in the right workspace column. Place it just above the `<PitchPanel ... />` block (around `src/App.tsx:326`):

```tsx
            {/* PROSPECT RADAR (uafhængigt af funnel) */}
            <ProspectRadarPanel
              company={prospectCompany}
              setCompany={setProspectCompany}
              sellerProfile={prospectSellerProfile}
              setSellerProfile={setProspectSellerProfile}
              resetSellerProfile={resetProspectSellerProfile}
              brief={prospectBrief}
              isResearching={isResearchingProspect}
              progress={prospectProgress}
              onResearch={handleProspectResearch}
              onClearBrief={handleClearProspectBrief}
            />
```

Also add prospect research to the `WorkingOverlay` `show` condition (optional but consistent): find the `show={ ... }` expression (around `src/App.tsx:128`) and add `|| isResearchingProspect`, and add a title branch `isResearchingProspect ? 'Prospect Radar' :` near the other title branches.

- [ ] **Step 3: Bump the version (three places)**

In `package.json`, change `"version": "1.25.1"` → `"version": "1.26.0"`.

In `src/App.tsx` footer (around `src/App.tsx:464`), change `&middot; v1.25.1` → `&middot; v1.26.0`.

In `src/components/AppHeader.tsx`, find the subtitle span showing the version (`v1.25.1`) and change it to `v1.26.0`. (Grep for `1.25.1` in that file to locate the exact span.)

- [ ] **Step 4: Verify the whole build**

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS (all suites, including the new `prospectScan`, `prospectExport`, `sellerProfile` tests).

Run: `npm run build`
Expected: PASS (Vite + esbuild).

- [ ] **Step 5: Manual verification (requires ANTHROPIC_API_KEY in `.env.local`)**

Run: `npm run dev`, open http://localhost:3000, find the **Prospect Radar** panel in the right column, type `exemplar.dk`, click **Research**. Confirm: progress text updates, then a briefing renders with a "Grund til at ringe", gaps, opening line, and clickable sources; Copy and Download `.md` work.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useContentMachine.ts src/App.tsx src/components/AppHeader.tsx package.json
git commit -m "feat(prospect): wire Prospect Radar into the app + bump to v1.26.0"
```

---

## After all tasks

- Confirm `npm run lint`, `npm test`, and `npm run build` are all green.
- Open a PR from `claude/prospect-radar` into `main` (per CLAUDE.md).
- Suggested manual QA: run a real prospect (e.g. exemplar.dk and one target brand); verify sources resolve and no invented facts appear; sanity-check the opening line reads naturally in Danish.

## Self-review notes (coverage vs. spec)

- Two-phase engine (gather → synthesise): Tasks 2–3. ✅
- Input = company/website only: Task 4 route + Task 7 hook. ✅
- Output = dossier + gaps + reason to call + opening line + talking points + questions + decision-makers + sources + confidence: Task 1 schema + Task 8 render. ✅
- Configurable seller profile, Exemplar default, persisted: Tasks 1/6/7/8. ✅
- Packaging-type checklist in seller profile (folded-in default): Tasks 1/6. ✅
- Anti-hallucination (source-required, evidence vs. inference, confidence): Task 3 synthesis system prompt. ✅
- Danish output incl. international targets: Task 3 system prompt. ✅
- SSE route mirroring `/api/generate-deep`: Task 4. ✅
- Self-contained panel like `HumanizerPanel`: Task 8, wired in Task 9. ✅
- Tests co-located; lint+test+build gates: every task. ✅
- Version bump three places; branch; branding rule: Task 9 + Global Constraints. ✅
