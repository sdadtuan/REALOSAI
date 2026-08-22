export type SodViolation = {
  id: string;
  message: string;
};

export function detectSodViolations(functions: string[]): SodViolation[] {
  const set = new Set(functions.map((f) => f.trim()).filter(Boolean));
  const violations: SodViolation[] = [];

  if (set.has('content') && set.has('compliance')) {
    violations.push({
      id: '02',
      message: 'Content và Compliance không nên gán cùng user (SoD-02).',
    });
  }

  if (set.has('design') && set.has('compliance')) {
    violations.push({
      id: '02',
      message: 'Design và Compliance không nên gán cùng user (SoD-02).',
    });
  }

  return violations;
}

export function detectContentApproveSod(grants: Record<string, string[]>): SodViolation | null {
  const contentWrite =
    (grants.crm_seo_aeo_write ?? []).includes('create') ||
    (grants.crm_seo_aeo_write ?? []).includes('edit');
  const canApprove = (grants.crm_seo_aeo_approve ?? []).includes('approve');
  if (contentWrite && canApprove) {
    return {
      id: '01',
      message: 'Không gán đồng thời content write và SEO approve (SoD-01).',
    };
  }
  return null;
}
