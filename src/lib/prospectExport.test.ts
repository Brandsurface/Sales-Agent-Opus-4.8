import { describe, it, expect } from 'vitest';
import { prospectBriefToMarkdown } from './prospectExport';
import type { ProspectBrief } from '../types';

const brief: ProspectBrief = {
  company: { name: 'Acme', website: 'acme.dk', category: 'FMCG', whatTheyDo: 'Snacks', sizeSignal: '50 ansatte', keyProducts: ['Chips'], packagingContext: 'Plastposer' },
  signals: [{ signal: 'Rebrand', timeframe: '2026', sourceUrl: 'https://acme.dk/news', whyItMatters: 'Nyt design skal valideres' }],
  gaps: [{ gap: 'Ingen fysiske prøver', evidence: 'Rebrand annonceret', sellerAngle: '1:1 mockup', valueForThem: 'Se før tryk' }],
  reasonToCall: 'Deres rebrand',
  openingLine: 'Hej, jeg så I er i gang med et rebrand …',
  whyNow: 'Rebrand går i tryk om 6 uger',
  callAngles: [{ angle: 'Nyhedsvinkel', openingLine: 'Hej…', rationale: 'Aktuelt' }],
  objections: [{ objection: 'Vi har leverandør', response: 'Forstår — …' }],
  talkingPoints: ['Rebrand-timing'],
  smartQuestions: ['Hvornår går I i tryk?'],
  decisionMakers: [{ role: 'Marketingchef', rationale: 'Ejer rebrandet' }],
  competitors: [{ name: 'BetaSnack', packagingNote: 'Nye pouches' }],
  sources: ['https://acme.dk/news'],
  confidence: { level: 'middel', note: 'Delvist verificeret' },
  researchedAt: '2026-07-01T10:00:00.000Z',
  market: 'DK',
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
    expect(md).toContain('Marked: Danmark');
    expect(md).toContain('Hvorfor nu');
    expect(md).toContain('Ringe-vinkler');
    expect(md).toContain('Nyhedsvinkel');
    expect(md).toContain('Sandsynlige indvendinger');
    expect(md).toContain('Vi har leverandør');
  });
});
