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
