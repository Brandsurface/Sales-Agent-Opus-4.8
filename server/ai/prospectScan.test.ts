import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./anthropic', () => ({ anthropic: { messages: { create: vi.fn() } } }));
vi.mock('./structured', () => ({ generateStructured: vi.fn() }));
import { anthropic } from './anthropic';
import { generateStructured } from './structured';
import { config } from './config';
import { prospectBriefTool, sellerProfileText, EXEMPLAR_DEFAULT_SELLER, gatherIntel, runProspectScan, marketLanguage } from './prospectScan';

const mockedCreate = vi.mocked(anthropic.messages.create);
const mockedStructured = vi.mocked(generateStructured);

const fakeBrief = {
  company: { name: 'Acme', website: 'acme.dk', category: 'FMCG', whatTheyDo: 'x', sizeSignal: 'ukendt', keyProducts: [], packagingContext: 'x' },
  signals: [], gaps: [], reasonToCall: 'r', openingLine: 'o', talkingPoints: [], smartQuestions: [],
  whyNow: 'w',
  callAngles: [], objections: [],
  decisionMakers: [], competitors: [], sources: [], confidence: { level: 'middel', note: 'n' }, researchedAt: '',
};

const strongCritique = { specificityScore: 92, evidenceScore: 90, relevanceScore: 95, genericPhrases: [], verdict: 'skarp' };
const weakCritique = { specificityScore: 40, evidenceScore: 55, relevanceScore: 60, genericPhrases: ['spændende rejse'], verdict: 'generisk' };
const sharpenedBrief = { ...fakeBrief, openingLine: 'skærpet replik' };

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

    const result = await gatherIntel('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK');

    expect(result.webSearchUsed).toBe(true);
    expect(result.memo).toContain('Acme lancerede');
    expect(result.sources).toContain('https://acme.dk/news');
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('falls back gracefully when web search is unavailable', async () => {
    mockedCreate.mockRejectedValueOnce(Object.assign(new Error('web_search not supported on this tier'), { status: 400 }));

    const result = await gatherIntel('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK');

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
    mockedStructured
      .mockResolvedValueOnce(fakeBrief as any)
      .mockResolvedValueOnce(strongCritique as any);

    const phases: string[] = [];
    const brief = await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', (e) => phases.push(e.phase));

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
    mockedStructured
      .mockResolvedValueOnce(fakeBrief as any)
      .mockResolvedValueOnce(strongCritique as any);

    await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', () => {});

    const userText = (mockedStructured.mock.calls[0][0].userContent[0] as any).text as string;
    expect(userText).toContain('Websøgning var ikke tilgængelig');
  });

  it('throws without calling the model when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', () => {}, controller.signal),
    ).rejects.toThrow();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedStructured).not.toHaveBeenCalled();
  });
});

describe('multi-market', () => {
  beforeEach(() => { mockedCreate.mockReset(); mockedStructured.mockReset(); });

  it('maps each market to its language', () => {
    expect(marketLanguage('DK')).toBe('dansk');
    expect(marketLanguage('SE')).toBe('svensk');
    expect(marketLanguage('DE')).toBe('tysk');
    expect(marketLanguage('NO')).toBe('norsk');
  });

  it('gather searches in the market language and names the market (non-DK)', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
    } as any);
    await gatherIntel('Acme', EXEMPLAR_DEFAULT_SELLER, 'SE');
    const sentText = (mockedCreate.mock.calls[0][0] as any).messages[0].content[0].text as string;
    expect(sentText).toContain('svensk');
    expect(sentText).toContain('Sverige');
  });

  it('synthesis localises the spoken fields for non-DK markets', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
    } as any);
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)
      .mockResolvedValueOnce(strongCritique as any);
    await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DE', () => {});
    const userText = (mockedStructured.mock.calls[0][0].userContent[0] as any).text as string;
    expect(userText).toContain('tysk');
    expect(userText).toContain('openingLine');
  });

  it('keeps DK all-Danish', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
    } as any);
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)
      .mockResolvedValueOnce(strongCritique as any);
    await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', () => {});
    const userText = (mockedStructured.mock.calls[0][0].userContent[0] as any).text as string;
    expect(userText).toContain('HELE briefingen på dansk');
  });

  it('stamps brief.market from the requested market', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
    } as any);
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)
      .mockResolvedValueOnce(strongCritique as any);
    const brief = await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'NO', () => {});
    expect(brief.market).toBe('NO');
  });
});

describe('quality fields', () => {
  beforeEach(() => { mockedCreate.mockReset(); mockedStructured.mockReset(); });

  it('requires whyNow, callAngles and objections in the schema', () => {
    const req = (prospectBriefTool.input_schema as any).required as string[];
    for (const key of ['whyNow', 'callAngles', 'objections']) expect(req).toContain(key);
  });

  it('gather checklist covers job postings, fairs, sustainability and trade press', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
    } as any);
    await gatherIntel('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK');
    const system = JSON.stringify((mockedCreate.mock.calls[0][0] as any).system);
    for (const probe of ['Jobopslag', 'messer', 'Bæredygtighedsløfter', 'Fagpresse']) {
      expect(system).toContain(probe);
    }
  });

  it('synthesis instructs angles, whyNow and objections, and localises spoken fields (non-DK)', async () => {
    mockedCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
    } as any);
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)
      .mockResolvedValueOnce(strongCritique as any);
    await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'SE', () => {});
    const userText = (mockedStructured.mock.calls[0][0].userContent[0] as any).text as string;
    expect(userText).toContain('callAngles');
    expect(userText).toContain('objections');
    expect(userText).toContain('svensk');
    const system = JSON.stringify(mockedStructured.mock.calls[0][0].system);
    expect(system).toContain('whyNow');
  });
});

describe('pres-test (critique → sharpen)', () => {
  beforeEach(() => { mockedCreate.mockReset(); mockedStructured.mockReset(); });

  const mockGather = () => mockedCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: 'memo' }], stop_reason: 'end_turn',
  } as any);

  it('skips sharpening when the critique scores high', async () => {
    mockGather();
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)      // syntese
      .mockResolvedValueOnce(strongCritique as any);        // kritik
    const phases: string[] = [];
    const brief = await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', (e) => phases.push(e.phase));
    expect(phases).toContain('critiquing');
    expect(phases).not.toContain('sharpening');
    expect(mockedStructured).toHaveBeenCalledTimes(2);
    expect(brief.openingLine).toBe(fakeBrief.openingLine);
    const critiqueOpts = mockedStructured.mock.calls[1][0];
    expect(critiqueOpts.model).toBe(config.fastModel);
    expect(critiqueOpts.tool.name).toBe('submit_prospect_critique');
  });

  it('sharpens once when the critique scores low, with Opus and fact-preservation', async () => {
    mockGather();
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)
      .mockResolvedValueOnce(weakCritique as any)
      .mockResolvedValueOnce({ ...sharpenedBrief } as any);
    const phases: string[] = [];
    const brief = await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', (e) => phases.push(e.phase));
    expect(phases).toContain('sharpening');
    expect(brief.openingLine).toBe('skærpet replik');
    expect(brief.market).toBe('DK');
    const sharpenOpts = mockedStructured.mock.calls[2][0];
    expect(sharpenOpts.model).toBe(config.creativeModel);
    expect(sharpenOpts.tool.name).toBe('submit_prospect_brief');
    const sharpenText = (sharpenOpts.userContent[0] as any).text as string;
    expect(sharpenText).toContain('spændende rejse');
  });

  it('returns the original brief when the pres-test itself fails', async () => {
    mockGather();
    mockedStructured
      .mockResolvedValueOnce({ ...fakeBrief } as any)
      .mockRejectedValueOnce(new Error('boom'));
    const brief = await runProspectScan('Acme', EXEMPLAR_DEFAULT_SELLER, 'DK', () => {});
    expect(brief.openingLine).toBe(fakeBrief.openingLine);
  });
});
