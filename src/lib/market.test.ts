import { describe, it, expect } from 'vitest';
import { MARKETS, marketLabel, detectMarketFromInput } from './market';

describe('market helpers', () => {
  it('lists the four markets in order with labels', () => {
    expect(MARKETS.map((m) => m.code)).toEqual(['DK', 'SE', 'DE', 'NO']);
    expect(marketLabel('SE')).toBe('Sverige');
  });

  it('detects the market from a website/domain TLD', () => {
    expect(detectMarketFromInput('exempel.se')).toBe('SE');
    expect(detectMarketFromInput('https://acme.de/produkte')).toBe('DE');
    expect(detectMarketFromInput('firma.no')).toBe('NO');
    expect(detectMarketFromInput('brand.dk')).toBe('DK');
    expect(detectMarketFromInput('globalbrand.com')).toBeNull();
  });
});
