/** Minimal PrepResult validation on Nest side (mirrors Python schema.py P0). */
export function enforceContactPolicy(result: Record<string, unknown>): Record<string, unknown> {
  return {
    ...result,
    contact_profile: {
      found: false,
      summary:
        typeof (result.contact_profile as Record<string, unknown> | undefined)?.summary === 'string'
          ? (result.contact_profile as Record<string, unknown>).summary
          : 'Không research profile cá nhân liên hệ (policy).',
      facts: [],
    },
  };
}

export function validatePrepResultShape(result: Record<string, unknown>): void {
  const contact = result.contact_profile as Record<string, unknown> | undefined;
  if (!contact || contact.found !== false) {
    throw new Error('contact_profile.found must be false');
  }
  const company = result.company_profile as Record<string, unknown> | undefined;
  if (!company || !String(company.summary ?? '').trim()) {
    throw new Error('company_profile.summary required');
  }
  const script = result.consulting_script as Record<string, unknown> | undefined;
  if (!script || !String(script.opening ?? '').trim()) {
    throw new Error('consulting_script.opening required');
  }
  const services = result.recommended_services;
  if (!Array.isArray(services) || services.length < 1 || services.length > 3) {
    throw new Error('recommended_services must have 1..3 items');
  }
}
