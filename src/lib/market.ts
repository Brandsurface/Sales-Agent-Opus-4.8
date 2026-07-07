/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProspectMarket } from '../types';

export interface MarketOption {
  code: ProspectMarket;
  label: string;
  flag: string;
}

export const MARKETS: MarketOption[] = [
  { code: 'DK', label: 'Danmark', flag: '🇩🇰' },
  { code: 'SE', label: 'Sverige', flag: '🇸🇪' },
  { code: 'DE', label: 'Tyskland', flag: '🇩🇪' },
  { code: 'NO', label: 'Norge', flag: '🇳🇴' },
];

export function marketLabel(code: ProspectMarket): string {
  return MARKETS.find((m) => m.code === code)?.label ?? code;
}

/** Gæt marked ud fra et website/domæne via TLD; null hvis ukendt. */
export function detectMarketFromInput(input: string): ProspectMarket | null {
  const s = input.toLowerCase();
  if (/\.se(\/|$|\s)/.test(s) || s.endsWith('.se')) return 'SE';
  if (/\.de(\/|$|\s)/.test(s) || s.endsWith('.de')) return 'DE';
  if (/\.no(\/|$|\s)/.test(s) || s.endsWith('.no')) return 'NO';
  if (/\.dk(\/|$|\s)/.test(s) || s.endsWith('.dk')) return 'DK';
  return null;
}
