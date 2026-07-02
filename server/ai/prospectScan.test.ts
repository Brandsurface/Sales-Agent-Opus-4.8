import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./anthropic', () => ({ anthropic: { messages: { create: vi.fn() } } }));
vi.mock('./structured', () => ({ generateStructured: vi.fn() }));
import { anthropic } from './anthropic';
import { generateStructured } from './structured';
import { config } from './config';
import { prospectBriefTool, sellerProfileText, EXEMPLAR_DEFAULT_SELLER, gatherIntel, runProspectScan } from './prospectScan';

const mockedCreate = vi.mocked(anthropic.messages.create);
const mockedStructured = vi.mocked(generateStructured);

const fakeBrief = {
  company: { name: 'Acme', website: 'acme.dk', category: 'FMCG', whatTheyDo: 'x', sizeSignal: 'ukendt', keyProducts: [], packagingContext: 'x' },
  signals: [], gaps: [], reasonToCall: 'r', openingLine: 'o', talkingPoints: [], smartQuestions: [],
  decisionMakers: [], competitors: [], sources: [], confidence: { level: 'middel', note: 'n' }, researchedAt: '',
};

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
