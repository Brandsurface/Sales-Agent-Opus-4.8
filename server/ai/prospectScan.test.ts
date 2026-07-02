import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./anthropic', () => ({ anthropic: { messages: { create: vi.fn() } } }));
import { anthropic } from './anthropic';
import { prospectBriefTool, sellerProfileText, EXEMPLAR_DEFAULT_SELLER, gatherIntel } from './prospectScan';

const mockedCreate = vi.mocked(anthropic.messages.create);

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
