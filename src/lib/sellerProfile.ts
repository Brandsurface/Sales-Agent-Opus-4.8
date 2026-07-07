/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SellerProfile } from '../types';

const KEY = 'brand_surface_seller_profile';

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

export function loadSellerProfile(): SellerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EXEMPLAR_DEFAULT_SELLER;
    const parsed = JSON.parse(raw) as Partial<SellerProfile>;
    return { ...EXEMPLAR_DEFAULT_SELLER, ...parsed };
  } catch {
    return EXEMPLAR_DEFAULT_SELLER;
  }
}

export function saveSellerProfile(p: SellerProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignoreres (quota / privat browsing) */
  }
}
