// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require('../../../../scripts/lib/spc-pricing-parse.js');

export const parseVndRange = lib.parseVndRange as (t: string) => { min_vnd: number; max_vnd: number };
export const parsePricingText = lib.parsePricingText as (t: string, st: string) => Record<string, unknown>;
export const inferServiceTypeFromAppendix = lib.inferServiceTypeFromAppendix as (t: string) => string;
