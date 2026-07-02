/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './anthropic';
import { config } from './config';
import { cacheableSystem } from './prompts';
import { generateStructured } from './structured';

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

// ---------------------------------------------------------------------------
// Efterretningsindsamling (multi-turn web_search)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Syntese (Opus) + to-fase orkestrering
// ---------------------------------------------------------------------------

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
