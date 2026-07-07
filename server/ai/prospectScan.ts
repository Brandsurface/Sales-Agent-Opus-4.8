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

export interface CallAngle {
  angle: string;
  openingLine: string;
  rationale: string;
}

export interface ProspectObjection {
  objection: string;
  response: string;
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

export type ProspectMarket = 'DK' | 'SE' | 'DE' | 'NO';

export interface ProspectBrief {
  company: ProspectCompany;
  signals: ProspectSignal[];
  gaps: ProspectGap[];
  reasonToCall: string;
  openingLine: string;
  whyNow: string;
  callAngles: CallAngle[];
  objections: ProspectObjection[];
  talkingPoints: string[];
  smartQuestions: string[];
  decisionMakers: DecisionMaker[];
  competitors: ProspectCompetitor[];
  sources: string[];
  confidence: ProspectConfidence;
  researchedAt: string;
  market: ProspectMarket;
}

const MARKET_LANGUAGE: Record<ProspectMarket, string> = {
  DK: 'dansk', SE: 'svensk', DE: 'tysk', NO: 'norsk',
};
const MARKET_LABEL: Record<ProspectMarket, string> = {
  DK: 'Danmark', SE: 'Sverige', DE: 'Tyskland', NO: 'Norge',
};

export function marketLanguage(market: ProspectMarket): string {
  return MARKET_LANGUAGE[market] ?? 'dansk';
}

export interface ProspectEngineOptions {
  synthesisModel?: string;
  maxTokens?: number;
}

export const PROSPECT_MODEL_ALLOWLIST = [
  'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5',
] as const;

const MAX_TOKENS_MIN = 2000;
const MAX_TOKENS_MAX = 16000;

export function sanitizeEngineOptions(raw: unknown): ProspectEngineOptions {
  const out: ProspectEngineOptions = {};
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (typeof r.synthesisModel === 'string' && (PROSPECT_MODEL_ALLOWLIST as readonly string[]).includes(r.synthesisModel)) {
      out.synthesisModel = r.synthesisModel;
    }
    const n = Number(r.maxTokens);
    if (Number.isFinite(n)) {
      out.maxTokens = Math.min(Math.max(Math.round(n), MAX_TOKENS_MIN), MAX_TOKENS_MAX);
    }
  }
  return out;
}

export interface ProspectCritique {
  specificityScore: number;
  evidenceScore: number;
  relevanceScore: number;
  genericPhrases: string[];
  verdict: string;
}

export const prospectCritiqueTool: Anthropic.Tool = {
  name: 'submit_prospect_critique',
  description: 'Aflever pres-testen af opkalds-briefingen som strukturerede scorer.',
  input_schema: {
    type: 'object',
    properties: {
      specificityScore: { type: 'number', description: '0-100: hvor konkret og ikke-generisk er grund-til-at-ringe, åbningsreplik og vinkler?' },
      evidenceScore: { type: 'number', description: '0-100: hvor godt er påstandene forankret i researchens fund og kilder?' },
      relevanceScore: { type: 'number', description: '0-100: hvor relevant er det hele for NETOP sælgerens tilbud og triggers?' },
      genericPhrases: { type: 'array', items: { type: 'string' }, description: 'Floskler/generiske formuleringer fundet i briefingen.' },
      verdict: { type: 'string', description: 'Kort dom: hvad er svagest, og hvad ville en travl beslutningstager afvise?' },
    },
    required: ['specificityScore', 'evidenceScore', 'relevanceScore', 'genericPhrases', 'verdict'],
  },
};

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
      openingLine: { type: 'string', description: 'Foreslået første sætning på kundens sprog (markedets sprog), klar til brug.' },
      whyNow: { type: 'string', description: 'Hvorfor ringe NETOP NU: timing-vindue forankret i konkrete fund (lancering, messe, deadline, sæson). Dansk.' },
      callAngles: {
        type: 'array',
        description: '2-3 markant forskellige ringe-vinkler (fx nyhedsvinkel, smertevinkel, konkurrentvinkel). Den bedste vinkels openingLine SKAL også stå i topfeltet openingLine.',
        items: {
          type: 'object',
          properties: {
            angle: { type: 'string', description: 'Vinklens navn/type. Dansk.' },
            openingLine: { type: 'string', description: 'Klar-til-brug første sætning på kundens sprog.' },
            rationale: { type: 'string', description: 'Hvorfor denne vinkel kan virke — forankret i fundene. Dansk.' },
          },
          required: ['angle', 'openingLine', 'rationale'],
        },
      },
      objections: {
        type: 'array',
        description: '2-3 sandsynlige indvendinger med foreslået svar.',
        items: {
          type: 'object',
          properties: {
            objection: { type: 'string', description: 'Den sandsynlige indvending. Dansk.' },
            response: { type: 'string', description: 'Foreslået svar på kundens sprog.' },
          },
          required: ['objection', 'response'],
        },
      },
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
      'whyNow', 'callAngles', 'objections',
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
8. Jobopslag: ansætter de emballage-, brand-, marketing- eller indkøbsfolk? (karrieresider, LinkedIn, jobportaler)
9. Messer og events: kommende deltagelse i messer eller udstillinger (stande kræver fysiske prøver)
10. Bæredygtighedsløfter og -rapporter med konkrete mål/deadlines for emballage
11. Fagpresse/brancheomtale

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
  market: ProspectMarket,
  onProgress?: (step: string) => void,
  signal?: AbortSignal,
): Promise<GatherResult> {
  const initialPrompt = `Research målvirksomheden "${company}" grundigt via websøgning.

Målvirksomheden hører til på markedet ${MARKET_LABEL[market]}. Søg primært på ${marketLanguage(market)} og engelsk, og prioritér lokale kilder for det marked.

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
- whyNow skal forankres i konkrete, daterede fund — aldrig generisk "markedet bevæger sig hurtigt".
- callAngles skal være 2-3 MARKANT forskellige vinkler (fx nyhedsvinkel, smertevinkel, konkurrentvinkel); den stærkeste vinkels openingLine gentages i topfeltet openingLine. objections skal være de 2-3 mest sandsynlige indvendinger med konkrete svar.

Afslut ved at kalde submit_prospect_brief med den fulde, strukturerede briefing.`;

export type ProspectProgress =
  | { phase: 'gathering'; step: string }
  | { phase: 'synthesizing' }
  | { phase: 'critiquing' }
  | { phase: 'sharpening' };

export async function synthesizeBrief(
  company: string,
  gather: GatherResult,
  sellerProfile: SellerProfile,
  market: ProspectMarket,
  signal?: AbortSignal,
  options?: ProspectEngineOptions,
): Promise<ProspectBrief> {
  const knowledgeOnlyNote = gather.webSearchUsed
    ? ''
    : '\n\nBEMÆRK: Websøgning var ikke tilgængelig. Basér briefingen på din videnbase, sæt confidence.level = "lav", og skriv i noten at fundene ikke er web-verificerede.';

  const lang = marketLanguage(market);
  const languageInstruction = market === 'DK'
    ? 'Skriv HELE briefingen på dansk.'
    : `Skriv analysen (company, signals, gaps, reasonToCall, whyNow, confidence, decisionMakers, competitors, callAngles[].angle/rationale, objections[].objection) på dansk. Skriv openingLine, talkingPoints, smartQuestions, callAngles[].openingLine og objections[].response på ${lang} (kundens sprog), så sælgeren kan bruge dem direkte i opkaldet.`;

  const user = `MÅLVIRKSOMHED: ${company}

${sellerProfileText(sellerProfile)}

RESEARCH-MEMO FRA INDSAMLINGEN:
${gather.memo.trim() || '(ingen web-fund tilgængelige)'}

KENDTE KILDER: ${gather.sources.length ? gather.sources.join(', ') : 'ingen'}

Syntetisér nu den fulde opkalds-briefing. ${languageInstruction} Aflever via submit_prospect_brief.${knowledgeOnlyNote}`;

  const brief = await generateStructured<ProspectBrief>({
    system: cacheableSystem([SYNTHESIS_SYSTEM]),
    userContent: [{ type: 'text', text: user }],
    tool: prospectBriefTool,
    model: options?.synthesisModel ?? config.creativeModel,
    maxTokens: options?.maxTokens ?? 6000,
    signal,
  });

  brief.researchedAt = brief.researchedAt || new Date().toISOString();
  if ((!brief.sources || brief.sources.length === 0) && gather.sources.length) {
    brief.sources = gather.sources;
  }
  brief.market = market;
  return brief;
}

// ---------------------------------------------------------------------------
// Pres-test (Haiku) + skærpning (Opus)
// ---------------------------------------------------------------------------

const CRITIQUE_SYSTEM = `Du er en kynisk salgsdirektør der pres-tester en opkalds-briefing før den når sælgeren.
Du ved at generiske vinkler ("jeg så I har travlt", "spændende virksomhed") dræber kolde opkald.
Døm HÅRDT: ville en travl beslutningstager blive hængende efter første sætning?
Scor konkrethed, bevis-forankring og relevans for sælgerens tilbud 0-100. List alle floskler. Aflever via submit_prospect_critique.`;

const SHARPEN_SYSTEM = `Du er senior B2B-salgsstrateg. Du modtager en opkalds-briefing plus en hård pres-test-kritik.
Skriv briefingen om så kritikken er adresseret: erstat hver floskel med noget konkret fra researchen, skærp vinklerne og gør whyNow tidsspecifik.
Du må IKKE ændre fakta: company, signals, sources, decisionMakers og confidence skal bevares som de er. Opfind intet nyt.
Sprogreglerne er uændrede (analyse på dansk; talte felter på kundens sprog). Aflever HELE den skærpede briefing via submit_prospect_brief.`;

const CRITIQUE_THRESHOLD = 75;

export async function critiqueBrief(
  brief: ProspectBrief,
  sellerProfile: SellerProfile,
  signal?: AbortSignal,
): Promise<ProspectCritique> {
  const user = `${sellerProfileText(sellerProfile)}

BRIEFING DER SKAL PRES-TESTES:
${JSON.stringify(brief, null, 2)}

Pres-test briefingen og aflever via submit_prospect_critique.`;
  return generateStructured<ProspectCritique>({
    system: cacheableSystem([CRITIQUE_SYSTEM]),
    userContent: [{ type: 'text', text: user }],
    tool: prospectCritiqueTool,
    model: config.fastModel,
    maxTokens: 1500,
    signal,
  });
}

export async function sharpenBrief(
  brief: ProspectBrief,
  critique: ProspectCritique,
  sellerProfile: SellerProfile,
  market: ProspectMarket,
  signal?: AbortSignal,
  options?: ProspectEngineOptions,
): Promise<ProspectBrief> {
  const user = `${sellerProfileText(sellerProfile)}

MARKED: ${MARKET_LABEL[market]} (talte felter på ${marketLanguage(market)})

NUVÆRENDE BRIEFING:
${JSON.stringify(brief, null, 2)}

PRES-TEST-KRITIK (skal adresseres):
- Konkrethed: ${critique.specificityScore}/100, Bevis: ${critique.evidenceScore}/100, Relevans: ${critique.relevanceScore}/100
- Floskler der SKAL erstattes: ${critique.genericPhrases.join(' · ') || 'ingen'}
- Dom: ${critique.verdict}

Skriv den skærpede briefing og aflever via submit_prospect_brief.`;
  const sharpened = await generateStructured<ProspectBrief>({
    system: cacheableSystem([SHARPEN_SYSTEM]),
    userContent: [{ type: 'text', text: user }],
    tool: prospectBriefTool,
    model: options?.synthesisModel ?? config.creativeModel,
    maxTokens: options?.maxTokens ?? 6000,
    signal,
  });
  sharpened.researchedAt = sharpened.researchedAt || brief.researchedAt;
  if (!sharpened.sources || sharpened.sources.length === 0) sharpened.sources = brief.sources;
  sharpened.market = market;
  return sharpened;
}

export async function runProspectScan(
  company: string,
  sellerProfile: SellerProfile,
  market: ProspectMarket,
  onProgress: (e: ProspectProgress) => void,
  signal?: AbortSignal,
  options?: ProspectEngineOptions,
): Promise<ProspectBrief> {
  if (signal?.aborted) throw new Error('Annulleret.');
  const gather = await gatherIntel(
    company,
    sellerProfile,
    market,
    (step) => onProgress({ phase: 'gathering', step }),
    signal,
  );
  onProgress({ phase: 'synthesizing' });
  const brief = await synthesizeBrief(company, gather, sellerProfile, market, signal, options);
  try {
    onProgress({ phase: 'critiquing' });
    const critique = await critiqueBrief(brief, sellerProfile, signal);
    const passed =
      critique.specificityScore >= CRITIQUE_THRESHOLD &&
      critique.evidenceScore >= CRITIQUE_THRESHOLD &&
      critique.relevanceScore >= CRITIQUE_THRESHOLD;
    if (passed) return brief;
    onProgress({ phase: 'sharpening' });
    return await sharpenBrief(brief, critique, sellerProfile, market, signal, options);
  } catch (err) {
    // Pres-testen er en forbedring, ikke en port: fejler den, leveres den gode briefing.
    console.warn('[prospect-scan] Pres-test fejlede — leverer uskærpet briefing:', (err as Error)?.message);
    return brief;
  }
}
