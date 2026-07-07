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
