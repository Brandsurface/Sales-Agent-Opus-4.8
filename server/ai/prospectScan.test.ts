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
