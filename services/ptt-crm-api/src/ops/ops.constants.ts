export const OPS_PACKAGE_TIERS = ['basic', 'standard', 'premium'] as const;

export const OPS_LEGACY_SLUG_ALIASES: Record<string, string> = {
  'seo-retainer': 'DV05',
  'meta-lead-gen': 'DV04',
  'bds-lead-gen': 'DV04',
  'google-ads': 'DV04',
  'email-marketing': 'DV20',
  'lead-gen': 'DV04',
};

export const OPS_DEFAULT_PILOT_DV = 'DV02,DV05,DV04,DV20';
