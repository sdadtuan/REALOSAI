import {
  canViewSeoAeo,
  canViewSeoAuthority,
  canViewSeoAutomations,
  canViewSeoBi,
  canViewSeoCms,
  canViewSeoContent,
  canViewSeoExperiments,
  canViewSeoFreshness,
  canViewSeoGateA,
  canViewSeoGovernance,
  canViewSeoHub,
  canViewSeoRanks,
  canViewSeoReports,
  canViewSeoResearch,
  canViewSeoStrategy,
  canViewSeoTechnical,
} from '@/lib/seo/caps';
import {
  seoAeoEnabled,
  seoAuthorityEnabled,
  seoAutomationsEnabled,
  seoBiEnabled,
  seoCmsEnabled,
  seoContentEnabled,
  seoExperimentsEnabled,
  seoFreshnessEnabled,
  seoGateAEnabled,
  seoGovernanceEnabled,
  seoHubEnabled,
  seoRanksEnabled,
  seoReportsEnabled,
  seoResearchEnabled,
  seoStrategyEnabled,
  seoTechnicalEnabled,
} from '@/lib/seo/flags';
import type { StoredStaffUser } from '@/lib/auth';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildSeoModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!seoHubEnabled() || !canViewSeoHub(user)) return [];

  const links: ModuleNavLink[] = [
    { href: '/seo/hub', label: 'Hub' },
    { href: '/seo/clients', label: 'Clients' },
  ];

  if (seoResearchEnabled() && canViewSeoResearch(user)) {
    links.push({ href: '/seo/research', label: 'Research' });
  }
  if (seoContentEnabled() && canViewSeoContent(user)) {
    links.push({ href: '/seo/content', label: 'Content' });
  }
  if (seoTechnicalEnabled() && canViewSeoTechnical(user)) {
    links.push({ href: '/seo/technical', label: 'Technical' });
  }
  if (seoReportsEnabled() && canViewSeoReports(user)) {
    links.push({ href: '/seo/reports', label: 'Reports' });
  }
  if (seoStrategyEnabled() && canViewSeoStrategy(user)) {
    links.push({ href: '/seo/strategy', label: 'Strategy' });
  }
  if (seoGovernanceEnabled() && canViewSeoGovernance(user)) {
    links.push({ href: '/seo/governance', label: 'Governance' });
  }
  if (seoAeoEnabled() && canViewSeoAeo(user)) {
    links.push({ href: '/seo/aeo', label: 'AEO' });
  }
  if (seoAuthorityEnabled() && canViewSeoAuthority(user)) {
    links.push({ href: '/seo/authority', label: 'Authority' });
  }
  if (seoRanksEnabled() && canViewSeoRanks(user)) {
    links.push({ href: '/seo/ranks', label: 'Ranks' });
  }
  if (seoAutomationsEnabled() && canViewSeoAutomations(user)) {
    links.push({ href: '/seo/automations', label: 'Automations' });
  }
  if (seoFreshnessEnabled() && canViewSeoFreshness(user)) {
    links.push({ href: '/seo/freshness', label: 'Freshness' });
  }
  if (seoExperimentsEnabled() && canViewSeoExperiments(user)) {
    links.push({ href: '/seo/experiments', label: 'Experiments' });
  }
  if (seoBiEnabled() && canViewSeoBi(user)) {
    links.push({ href: '/seo/bi', label: 'BI' });
  }
  if (seoCmsEnabled() && canViewSeoCms(user)) {
    links.push({ href: '/seo/cms', label: 'CMS' });
  }
  if (seoGateAEnabled() && canViewSeoGateA(user)) {
    links.push({ href: '/seo/gate-a', label: 'Gate A' });
  }

  return links;
}
