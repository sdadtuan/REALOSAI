import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import {
  filterCatalogServicesForSlug,
  loadDealRoomServiceDvMap,
  resolveServiceDvMapping,
} from '../proposals/deal-room-quote.util';
import { QUOTE_PACKAGE_TIERS } from '../proposals/quote-pricing.util';
import { buildLegacyTierPricingFromOffers } from './spc-pricing-sync.util';
import {
  pickSpawnPhaseIndex,
  resolveProcessPhasesForSku,
  tasksFromProcessPhase,
} from './spc-process.util';
import { resolveQuotePriceFromPricingModel } from './spc-quote-pricing.util';
import { dvCodeFromSku, skuFromDvTier, tierFromSkuCode } from './spc-sku.util';
import { SpcPgRepository } from './spc-pg.repository';
import {
  getDocBundleFamily,
  listDocBundleFamiliesWithComponents,
  loadSpcDocBundle,
} from './spc-doc-bundle.loader';
import { auditBundlePrice } from './spc-bundle-audit.util';
import type {
  SpcPatchOfferBody,
  SpcPublishBody,
  SpcPutProcessPhaseBody,
  SpcQuoteCatalogResponse,
  SpcOfferProcessResponse,
  SpcCreateComponentBody,
  SpcPatchComponentBody,
  SpcPutOfferBundleBody,
  SpcFamilyTreeResponse,
  SpcImportDocBundleResponse,
  SpcImportDocBundleResult,
  SpcBundlePriceAudit,
} from './spc.types';

@Injectable()
export class SpcService {
  constructor(
    private readonly repo: SpcPgRepository,
    private readonly routeMap: OpsRouteMapLoader,
  ) {}

  private assertPg(): void {
    if (!this.repo.canUsePg()) {
      throw new ServiceUnavailableException({ error: 'spc_pg_unavailable' });
    }
  }

  async getPortfolio(publishedOnly: boolean) {
    this.assertPg();
    const items = await this.repo.listPortfolio(!publishedOnly);
    return {
      schema_version: '1.0.0',
      count: items.length,
      items,
    };
  }

  async getFamily(dvCode: string, publishedOnly: boolean) {
    this.assertPg();
    const code = String(dvCode ?? '').trim().toUpperCase();
    const family = await this.repo.getFamily(code, publishedOnly);
    if (!family) throw new NotFoundException({ error: 'spc_family_not_found', dv_code: code });
    return family;
  }

  async getOffer(skuCode: string, publishedOnly: boolean) {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(sku, publishedOnly);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    return offer;
  }

  async patchOffer(skuCode: string, body: SpcPatchOfferBody) {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const existing = await this.repo.getOffer(sku, false);
    if (!existing) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    const updated = await this.repo.patchOffer(sku, body);
    if (!updated) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    return updated;
  }

  async publish(body: SpcPublishBody, actorEmail: string) {
    this.assertPg();
    const entity = String(body?.entity ?? '').trim();
    const key = String(body?.key ?? '').trim().toUpperCase();
    if (!entity || !key) {
      throw new BadRequestException({ error: 'spc_publish_invalid_body' });
    }
    if (entity === 'offer') {
      const published = await this.repo.publishOffer(key, actorEmail);
      if (!published) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: key });

      const offers = await this.repo.listOffersByDv(published.dv_code, true);
      const tierPricing = buildLegacyTierPricingFromOffers(offers);
      if (Object.keys(tierPricing).length > 0) {
        await this.repo.syncOpsProfileTierPricing(published.dv_code, tierPricing);
      }
      return {
        published,
        ops_profile_synced: Object.keys(tierPricing).length > 0,
        tier_pricing: tierPricing,
      };
    }
    if (entity === 'component') {
      const published = await this.repo.publishComponent(key, actorEmail);
      if (!published) {
        throw new NotFoundException({ error: 'spc_component_not_found', component_code: key });
      }
      return { published };
    }
    throw new BadRequestException({ error: 'spc_publish_entity_unsupported', entity });
  }

  async getPublishLog(limit?: number) {
    this.assertPg();
    const rows = await this.repo.listPublishLog(limit ?? 50);
    const draftCount = await this.repo.countDraftOffers();
    const draftComponentCount = await this.repo.countDraftComponents();
    return { draft_count: draftCount, draft_component_count: draftComponentCount, items: rows };
  }

  async getHubStats() {
    this.assertPg();
    const portfolio = await this.repo.listPortfolio(true);
    const draftCount = await this.repo.countDraftOffers();
    const publishedSkus = portfolio.reduce((sum, row) => sum + row.published_count, 0);
    return {
      family_count: portfolio.length,
      published_skus: publishedSkus,
      draft_offers: draftCount,
      pilot_dv: ['DV02', 'DV04', 'DV05', 'DV20'],
    };
  }

  async listPublishedOffersForOpsCatalog() {
    this.assertPg();
    return this.repo.listPublishedOffersForCatalog();
  }

  async getQuoteCatalog(serviceSlugRaw?: string): Promise<SpcQuoteCatalogResponse> {
    this.assertPg();
    const rows = await this.repo.listQuoteCatalogRows();
    const map = this.routeMap.getMap();
    const slug = String(serviceSlugRaw ?? '').trim();
    const comboWarnings: SpcQuoteCatalogResponse['combo_warnings'] = [];

    let primaryDv: string | null = null;
    let primarySku: string | null = null;
    let primaryName: string | null = null;
    let suggestedBundle: string[] = [];
    let allowedDv = new Set(rows.map((r) => r.family.dv_code));

    if (slug) {
      const dvMap = loadDealRoomServiceDvMap();
      const mapping = resolveServiceDvMapping(slug, map, dvMap);
      primaryDv = mapping.primary_dv;
      primaryName = mapping.primary_name;
      suggestedBundle = mapping.bundle_dv ?? [];
      const filtered = filterCatalogServicesForSlug(map, mapping).map((s) => s.dv_code);
      allowedDv = new Set([primaryDv, ...suggestedBundle, ...filtered]);
    }

    const componentRows = await this.repo.listComponents(undefined, true, true);
    const componentsByDv = new Map<string, typeof componentRows>();
    for (const component of componentRows) {
      const list = componentsByDv.get(component.dv_code) ?? [];
      list.push(component);
      componentsByDv.set(component.dv_code, list);
    }

    const families = rows
      .filter((row) => !slug || allowedDv.has(row.family.dv_code))
      .map((row) => {
        const routeEntry = map.services.find((s) => s.code === row.family.dv_code);
        const dependsOn = (row.family.depends_on_dv ?? []) as string[];
        for (const dep of dependsOn) {
          if (dep && !allowedDv.has(dep)) {
            comboWarnings.push({
              dv_code: row.family.dv_code,
              message_vi: `${row.family.dv_code} phụ thuộc ${dep} — cân nhắc combo.`,
            });
          }
        }
        const serviceSlug =
          row.service_slug ?? routeEntry?.service_slugs.primary ?? row.family.dv_code.toLowerCase();
        const defaultSku = row.default_sku_code ?? `${row.family.dv_code}-TC`;
        if (row.family.dv_code === primaryDv) {
          primarySku = defaultSku;
        }
        return {
          dv_code: row.family.dv_code,
          name_vi: row.family.name_vi,
          readiness: row.family.readiness,
          depends_on_dv: dependsOn.map(String),
          service_slug: serviceSlug,
          default_sku_code: defaultSku,
          is_primary: row.family.dv_code === primaryDv,
          is_bundle_suggested: suggestedBundle.includes(row.family.dv_code),
          components: (componentsByDv.get(row.family.dv_code) ?? []).map((c) => ({
            component_code: c.component_code,
            name_vi: c.name_vi,
            description_vi: c.description_vi,
            deliverable_vi: c.deliverable_vi,
            pricing_model: c.pricing_model,
            sort_order: c.sort_order,
          })),
          offers: row.offers.map((offer) => ({
            sku_code: offer.sku_code,
            tier: offer.tier,
            label_vi: offer.label_vi,
            scope_summary_vi: offer.scope_summary_vi,
            pricing_model: offer.pricing_model,
            lines: offer.lines.map((line) => ({
              line_code: line.line_code,
              label_vi: line.label_vi,
              description_vi: line.description_vi,
              included_by_default: line.included_by_default,
              component_code: line.component_code ?? null,
            })),
          })),
        };
      });

    if (!primarySku && primaryDv) {
      primarySku = skuFromDvTier(primaryDv, 'standard');
    }

    return {
      schema_version: map.schema_version ?? '1.0.0',
      package_tiers: [...QUOTE_PACKAGE_TIERS],
      service_slug: slug || undefined,
      primary_dv: primaryDv,
      primary_sku: primarySku,
      primary_name: primaryName,
      suggested_bundle: suggestedBundle,
      combo_warnings: comboWarnings,
      families,
    };
  }

  async resolveQuoteLineFromSku(skuCodeRaw: string, finalPriceVnd?: number, scopeNotes?: string) {
    this.assertPg();
    const skuCode = String(skuCodeRaw ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(skuCode, true);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: skuCode });
    const map = this.routeMap.getMap();
    const entry = map.services.find((s) => s.code === offer.dv_code);
    if (!entry) {
      throw new BadRequestException({ error: 'dv_not_found', dv_code: offer.dv_code });
    }
    const tier = tierFromSkuCode(skuCode);
    if (!tier) {
      throw new BadRequestException({ error: 'invalid_sku_tier', sku_code: skuCode });
    }
    const reference = resolveQuotePriceFromPricingModel(offer.pricing_model);
    const finalPrice =
      finalPriceVnd != null && Number.isFinite(Number(finalPriceVnd))
        ? Math.max(0, Number(finalPriceVnd))
        : reference.suggested_vnd;
    const scope =
      String(scopeNotes ?? '').trim() ||
      offer.scope_summary_vi ||
      offer.lines.map((l) => l.label_vi).join('; ');
    const component_lines = offer.lines
      .filter((l) => l.component_code)
      .map((l) => ({
        component_code: l.component_code,
        line_code: l.line_code,
        label_vi: l.label_vi,
        description_vi: l.description_vi,
      }));
    return {
      sku_code: skuCode,
      dv_code: offer.dv_code,
      package_tier: tier,
      service_slug: entry.service_slugs.primary,
      dv_name: entry.name_vi,
      reference_price_min: reference.min_vnd,
      reference_price_max: reference.max_vnd,
      final_price_vnd: finalPrice,
      scope_notes: scope.slice(0, 2000),
      component_lines,
    };
  }

  async resolveProcessPhases(dvCodeRaw: string, skuCodeRaw?: string | null) {
    this.assertPg();
    const dvCode = String(dvCodeRaw ?? '').trim().toUpperCase();
    const rows = await this.repo.listProcessPhases(dvCode);
    return resolveProcessPhasesForSku(rows, skuCodeRaw);
  }

  async getOfferProcess(skuCodeRaw: string): Promise<SpcOfferProcessResponse> {
    this.assertPg();
    const skuCode = String(skuCodeRaw ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(skuCode, true);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: skuCode });
    const phases = await this.resolveProcessPhases(offer.dv_code, skuCode);
    return {
      sku_code: skuCode,
      dv_code: offer.dv_code,
      phase_count: phases.length,
      phases: phases.map((phase) => ({
        phase_code: phase.phase_code,
        dv_code: phase.dv_code,
        sku_code: phase.sku_code,
        week_label_vi: phase.week_label_vi,
        ptt_work_vi: phase.ptt_work_vi,
        deliverable_vi: phase.deliverable_vi,
        client_action_vi: phase.client_action_vi,
        tasks_json: Array.isArray(phase.tasks_json) ? phase.tasks_json : [],
        sort_order: phase.sort_order,
        active: phase.active !== false,
      })),
    };
  }

  async listProcessLibrary(dvCode?: string) {
    this.assertPg();
    const rows = await this.repo.listProcessPhases(dvCode);
    return { count: rows.length, items: rows };
  }

  async putProcessPhase(phaseCode: string, body: SpcPutProcessPhaseBody) {
    this.assertPg();
    const code = String(phaseCode ?? '').trim().toUpperCase();
    const updated = await this.repo.putProcessPhase(code, body);
    if (!updated) throw new NotFoundException({ error: 'spc_phase_not_found', phase_code: code });
    return updated;
  }

  resolveSpawnPhaseTasks(
    phases: Awaited<ReturnType<SpcService['resolveProcessPhases']>>,
    spawnCount: number,
  ) {
    if (!phases.length) {
      throw new NotFoundException({ error: 'spc_process_phases_empty' });
    }
    const index = pickSpawnPhaseIndex(spawnCount, phases.length);
    const phase = phases[index];
    return {
      phase_code: phase.phase_code,
      phase_index: index,
      week_label_vi: phase.week_label_vi,
      tasks: tasksFromProcessPhase(phase),
    };
  }

  inferSkuForLifecycle(dvCode: string, skuCode?: string | null, packageTier = 'standard') {
    const sku = String(skuCode ?? '').trim().toUpperCase();
    if (sku) return sku;
    return skuFromDvTier(dvCode, (packageTier as 'basic' | 'standard' | 'premium') || 'standard');
  }

  inferDvFromSkuOrSlug(skuCode?: string | null, dvCode?: string | null) {
    const sku = String(skuCode ?? '').trim().toUpperCase();
    if (sku) return dvCodeFromSku(sku);
    return String(dvCode ?? '').trim().toUpperCase();
  }

  async listComponents(dvCode?: string, activeOnly = true) {
    this.assertPg();
    const items = await this.repo.listComponents(dvCode, activeOnly);
    return { count: items.length, items };
  }

  async getComponent(componentCode: string) {
    this.assertPg();
    const code = String(componentCode ?? '').trim().toUpperCase();
    const row = await this.repo.getComponent(code);
    if (!row) throw new NotFoundException({ error: 'spc_component_not_found', component_code: code });
    return row;
  }

  async createComponent(body: SpcCreateComponentBody) {
    this.assertPg();
    const dvCode = String(body.dv_code ?? '').trim().toUpperCase();
    const family = await this.repo.getFamily(dvCode, false);
    if (!family) throw new NotFoundException({ error: 'spc_family_not_found', dv_code: dvCode });
    if (!String(body.name_vi ?? '').trim()) {
      throw new BadRequestException({ error: 'spc_component_name_required' });
    }
    return this.repo.createComponent(body);
  }

  async patchComponent(componentCode: string, body: SpcPatchComponentBody) {
    this.assertPg();
    const code = String(componentCode ?? '').trim().toUpperCase();
    const updated = await this.repo.patchComponent(code, body);
    if (!updated) throw new NotFoundException({ error: 'spc_component_not_found', component_code: code });
    return updated;
  }

  async archiveComponent(componentCode: string) {
    return this.patchComponent(componentCode, { active: false });
  }

  async getOfferBundle(skuCode: string) {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(sku, false);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    const items = await this.repo.listBundleItems(sku);
    return { sku_code: sku, dv_code: offer.dv_code, items };
  }

  async putOfferBundle(skuCode: string, body: SpcPutOfferBundleBody) {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(sku, false);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    if (!Array.isArray(body.items)) {
      throw new BadRequestException({ error: 'spc_bundle_items_required' });
    }
    const items = await this.repo.replaceBundleItems(sku, body);
    return { sku_code: sku, items };
  }

  async getFamilyComponents(dvCode: string) {
    this.assertPg();
    const code = String(dvCode ?? '').trim().toUpperCase();
    const family = await this.repo.getFamily(code, true);
    if (!family) throw new NotFoundException({ error: 'spc_family_not_found', dv_code: code });
    const items = await this.repo.listComponents(code, true, true);
    return { dv_code: code, count: items.length, items };
  }

  async getOfferBundleAudit(skuCode: string): Promise<SpcBundlePriceAudit> {
    this.assertPg();
    const sku = String(skuCode ?? '').trim().toUpperCase();
    const offer = await this.repo.getOffer(sku, false);
    if (!offer) throw new NotFoundException({ error: 'spc_offer_not_found', sku_code: sku });
    const bundleItems = await this.repo.listBundleItems(sku);
    return auditBundlePrice(sku, offer.pricing_model, bundleItems);
  }

  async getFamilyTree(dvCode: string): Promise<SpcFamilyTreeResponse> {
    this.assertPg();
    const code = String(dvCode ?? '').trim().toUpperCase();
    const family = await this.repo.getFamily(code, false);
    if (!family) throw new NotFoundException({ error: 'spc_family_not_found', dv_code: code });
    const components = await this.repo.listComponents(code, true);
    const offers = await Promise.all(
      (family.offers ?? []).map(async (offer) => {
        const bundleRows = await this.repo.listBundleItems(offer.sku_code);
        return {
          sku_code: offer.sku_code,
          tier: offer.tier,
          label_vi: offer.label_vi,
          scope_summary_vi: offer.scope_summary_vi,
          pricing_model: offer.pricing_model,
          bundle: bundleRows
            .filter((row) => row.included)
            .map((row) => ({
              component_code: row.component_code,
              name_vi: row.name_vi ?? '',
              included: row.included,
              qty: row.qty,
              pricing_model: row.pricing_model ?? {},
            })),
        };
      }),
    );
    return {
      dv_code: code,
      name_vi: family.name_vi,
      source_doc: loadSpcDocBundle().source_doc,
      component_count: components.length,
      components,
      offers,
    };
  }

  async importDocBundle(dvCodeRaw?: string): Promise<SpcImportDocBundleResponse> {
    this.assertPg();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { importFamilyComponentsFromDoc } = require('../../../../scripts/lib/spc-component-import.js');
    const filter = String(dvCodeRaw ?? '').trim().toUpperCase();
    const docFamily = filter ? getDocBundleFamily(filter) : null;
    const docFamilies = filter
      ? docFamily
        ? [docFamily]
        : []
      : listDocBundleFamiliesWithComponents();
    if (!docFamilies.length) {
      throw new NotFoundException({
        error: 'spc_doc_bundle_components_missing',
        dv_code: filter || undefined,
      });
    }

    const bundle = loadSpcDocBundle();
    const results: SpcImportDocBundleResult[] = [];
    for (const familyDoc of docFamilies) {
      const code = String(familyDoc.dv_code ?? '').trim().toUpperCase();
      const family = await this.repo.getFamily(code, false);
      if (!family) {
        throw new NotFoundException({ error: 'spc_family_not_found', dv_code: code });
      }
      const summary = await this.repo.withClient((client) =>
        importFamilyComponentsFromDoc(client, familyDoc),
      );
      results.push({
        dv_code: String((summary as SpcImportDocBundleResult).dv_code ?? code),
        components: Number((summary as SpcImportDocBundleResult).components ?? 0),
        bundle_items: Number((summary as SpcImportDocBundleResult).bundle_items ?? 0),
        skus: Array.isArray((summary as SpcImportDocBundleResult).skus)
          ? (summary as SpcImportDocBundleResult).skus.map(String)
          : [],
      });
    }

    return {
      source_doc: bundle.source_doc,
      imported: results.length,
      results,
    };
  }
}
