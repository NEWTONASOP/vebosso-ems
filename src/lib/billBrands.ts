// ============================================================================
// VEBOSSO EMS — Bill brands
// Bills are made for VEBOSSO or Navgrah. Each brand has its own logo,
// watermark, colours and business details (bill_settings row). Client bills
// carry the brand colours as a gradient border; estimates stay neutral.
// ============================================================================

import { BillBrand } from '../types/database';

export interface BrandTheme {
  label: string;
  /** bill_settings.id holding this brand's business details. */
  settingsId: number;
  /** Brand colours, darkest first — the client-bill gradient runs through them. */
  colors: [string, string, string];
  /** Main colour for headings, table heads and totals on client bills. */
  primary: string;
  /** Second colour, for accents on client bills. */
  accent: string;
  /** The logo is light (made for a dark background) — header goes dark. */
  logoOnDark: boolean;
}

export const BRANDS: Record<BillBrand, BrandTheme> = {
  vebosso: {
    label: 'VEBOSSO',
    settingsId: 1,
    colors: ['#2E1846', '#EFA498', '#DCCFF0'],
    primary: '#2E1846',
    accent: '#EFA498',
    logoOnDark: true,
  },
  navgrah: {
    label: 'Navgrah',
    settingsId: 2,
    colors: ['#A61380', '#F29EC4', '#F9D2E5'],
    primary: '#A61380',
    accent: '#F29EC4',
    logoOnDark: false,
  },
};

export const BRAND_KEYS: BillBrand[] = ['vebosso', 'navgrah'];

export const brandOf = (b: { brand?: BillBrand | null }): BillBrand => (b.brand === 'navgrah' ? 'navgrah' : 'vebosso');
