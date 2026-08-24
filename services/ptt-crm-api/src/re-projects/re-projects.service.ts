import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { isBdsPackEnabled } from '../bds/bds.flags';
import { isReProjectsPgPrimary } from '../bds/inventory/bds-dual-write.util';
import { BdsInventoryService } from '../bds/inventory/bds-inventory.service';
import { BdsReProductPgRepository } from '../bds/inventory/bds-re-product-pg.repository';
import { BdsReProjectPgRepository } from '../bds/inventory/bds-re-project-pg.repository';
import { computeProductInventoryStats } from './re-projects-inventory.util';
import { ReProjectsKpiBudgetPgRepository } from './re-projects-kpi-budget-pg.repository';
import { PRODUCT_LINE_LABELS } from './re-projects.types';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import { ReProjectsPriceListPgRepository } from './re-projects-price-list-pg.repository';
import { buildProjectSummaryFromParts } from './re-projects-summary.util';
import {
  CreateReProjectBody,
  DEFAULT_PROJECT_TYPE_LABELS,
  SavePriceListBody,
  SaveProductBody,
  SaveProjectTypeBody,
  type ReProjectTypeRow,
} from './re-projects.types';

const PACK_CREATE_STATUSES = new Set(['available', 'locked']);

@Injectable()
export class ReProjectsService {
  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly pgOltp?: ReProjectsPgRepository,
    @Optional() private readonly priceListPg?: ReProjectsPriceListPgRepository,
    @Optional() private readonly pgRepo?: BdsReProjectPgRepository,
    @Optional() private readonly productPg?: BdsReProductPgRepository,
    @Optional() private readonly inventory?: BdsInventoryService,
    @Optional() private readonly kpiBudgetPg?: ReProjectsKpiBudgetPgRepository,
  ) {}

  private pgPrimary(): boolean {
    return isReProjectsPgPrimary() && this.pgOltp != null;
  }

  private requirePgPrimary(): void {
    if (this.config.sqliteDisabled && !this.pgPrimary()) {
      throw new ServiceUnavailableException({
        error: 'bds_re_projects_pg_required',
        message: 'BĐS re-projects requires PostgreSQL when SQLite is disabled',
        hint: 'Set PTT_BDS_PACK=1 and PTT_BDS_PG=1',
      });
    }
    if (!this.pgPrimary()) {
      throw new ServiceUnavailableException({
        error: 'bds_re_projects_pg_required',
        message: 'BĐS re-projects requires PostgreSQL',
        hint: 'Set PTT_BDS_PACK=1 and PTT_BDS_PG=1',
      });
    }
  }

  listTypes(includeInactive = false) {
    this.requirePgPrimary();
    const types: ReProjectTypeRow[] = Object.entries(DEFAULT_PROJECT_TYPE_LABELS).map(
      ([code, name], i) => ({
        id: i + 1,
        code,
        name,
        description: '',
        sort_order: (i + 1) * 10,
        active: true,
        project_count: 0,
        created_at: '',
        updated_at: '',
      }),
    );
    const visible = includeInactive ? types : types.filter((t) => t.active);
    const labels: Record<string, string> = { ...DEFAULT_PROJECT_TYPE_LABELS };
    return { types: visible, labels };
  }

  createType(_body: SaveProjectTypeBody) {
    this.requirePgPrimary();
    throw new BadRequestException({
      error: 'Loại dự án dùng catalog mặc định khi PostgreSQL là nguồn chính.',
    });
  }

  updateType(_typeId: number, _body: SaveProjectTypeBody) {
    this.requirePgPrimary();
    throw new BadRequestException({
      error: 'Loại dự án dùng catalog mặc định khi PostgreSQL là nguồn chính.',
    });
  }

  deleteType(_typeId: number) {
    this.requirePgPrimary();
    throw new BadRequestException({
      error: 'Loại dự án dùng catalog mặc định khi PostgreSQL là nguồn chính.',
    });
  }

  async listProjects(q?: string) {
    this.requirePgPrimary();
    return { projects: await this.pgOltp!.listProjects(q) };
  }

  async createProject(body: CreateReProjectBody) {
    this.requirePgPrimary();
    try {
      return await this.pgOltp!.createProject(body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getProject(id: number) {
    this.requirePgPrimary();
    const proj = await this.pgOltp!.fetchProject(id);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    return proj;
  }

  async updateProject(id: number, body: CreateReProjectBody) {
    this.requirePgPrimary();
    try {
      return await this.pgOltp!.updateProject(id, body);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async deleteProject(id: number) {
    this.requirePgPrimary();
    try {
      await this.pgOltp!.deleteProject(id);
      return { ok: true };
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async projectSummary(id: number) {
    this.requirePgPrimary();
    try {
      const proj = await this.pgOltp!.fetchProject(id);
      if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
      const products = await this.productPg!.listEnrichedByProject(id);
      const [kpis, risks, budget] = await Promise.all([
        this.kpiBudgetPg!.listKpis(id),
        this.kpiBudgetPg!.listRisks(id),
        this.kpiBudgetPg!.listBudgetLines(id),
      ]);
      return buildProjectSummaryFromParts(proj, products, kpis, risks, budget);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new NotFoundException({ error: String((e as Error).message) });
    }
  }

  async listProducts(projectId: number) {
    this.requirePgPrimary();
    const products = await this.productPg!.listEnrichedByProject(projectId);
    return { products, inventory: computeProductInventoryStats(products) };
  }

  async createProduct(projectId: number, body: SaveProductBody) {
    if (isBdsPackEnabled() && body.status !== undefined && !PACK_CREATE_STATUSES.has(body.status)) {
      throw new BadRequestException({ error: 'invalid_create_status' });
    }
    this.requirePgPrimary();
    try {
      return await this.productPg!.saveProduct(projectId, body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateProduct(projectId: number, productId: number, body: SaveProductBody) {
    if (isBdsPackEnabled() && body.status !== undefined) {
      throw new ConflictException({ error: 'status_via_transition' });
    }
    this.requirePgPrimary();
    try {
      return await this.productPg!.saveProduct(projectId, body, productId);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async deleteProduct(projectId: number, productId: number) {
    this.requirePgPrimary();
    try {
      await this.productPg!.deleteProduct(projectId, productId);
      return { ok: true };
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async listZones(projectId: number) {
    this.requirePgPrimary();
    return { zones: await this.productPg!.listZones(projectId) };
  }

  async inventoryByZone(projectId: number) {
    this.requirePgPrimary();
    const products = await this.productPg!.listEnrichedByProject(projectId);
    const inv = computeProductInventoryStats(products);
    const byZone = (inv.by_zone as Array<Record<string, unknown>>) ?? [];
    const byLine: Record<string, Record<string, unknown>> = {};
    for (const r of (inv.by_product_line as Array<Record<string, unknown>>) ?? []) {
      byLine[String(r.key)] = r;
    }
    const zones = byZone.map((z) => {
      const zoneKey = String(z.key ?? '');
      const zoneProducts = products.filter(
        (p) => (String(p.zone ?? '').trim() || 'Chưa phân khu') === zoneKey,
      );
      const lineCounts: Record<string, number> = {};
      for (const p of zoneProducts) {
        const lk = String(p.product_line ?? 'other');
        lineCounts[lk] = (lineCounts[lk] ?? 0) + 1;
      }
      const linesDetail = Object.entries(lineCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([lk, cnt]) => ({
          product_line: lk,
          label: PRODUCT_LINE_LABELS[lk] ?? lk,
          count: cnt,
          stats: byLine[lk],
        }));
      return { ...z, product_lines: linesDetail };
    });
    return { zones };
  }

  async priceBatches(projectId: number) {
    this.requirePgPrimary();
    return {
      batches: await this.productPg!.listPriceBatches(projectId),
      summary: await this.productPg!.inventoryByPriceBatchSummary(projectId),
    };
  }

  async listPriceLists(projectId: number) {
    this.requirePgPrimary();
    return {
      price_lists: await this.priceListPg!.listPriceLists(projectId),
      version_codes: await this.priceListPg!.listAllVersionCodes(projectId),
    };
  }

  async createPriceList(projectId: number, body: SavePriceListBody, createdBy = '') {
    this.requirePgPrimary();
    try {
      return await this.priceListPg!.savePriceList(projectId, body, undefined, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getPriceList(projectId: number, listId: number) {
    this.requirePgPrimary();
    const row = await this.priceListPg!.fetchPriceList(projectId, listId);
    if (!row) throw new NotFoundException({ error: 'Không tìm thấy bảng giá.' });
    const { items, total } = await this.priceListPg!.listPriceListItems(listId, 500);
    return { price_list: row, items, items_total: total };
  }

  async updatePriceList(projectId: number, listId: number, body: SavePriceListBody, createdBy = '') {
    this.requirePgPrimary();
    try {
      return await this.priceListPg!.savePriceList(projectId, body, listId, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deletePriceList(projectId: number, listId: number) {
    this.requirePgPrimary();
    try {
      await this.priceListPg!.deletePriceList(projectId, listId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }
}
