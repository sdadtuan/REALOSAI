import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { isBdsPackEnabled } from '../bds/bds.flags';
import { isReProjectsPgPrimary, shouldDualWrite } from '../bds/inventory/bds-dual-write.util';
import { BdsInventoryService } from '../bds/inventory/bds-inventory.service';
import {
  BdsReProductPgRepository,
  type SqliteProductMirror,
} from '../bds/inventory/bds-re-product-pg.repository';
import { BdsReProjectPgRepository } from '../bds/inventory/bds-re-project-pg.repository';
import { computeKpiBoardStats, computeProductInventoryStats } from './re-projects-inventory.util';
import { ReProjectsKpiBudgetPgRepository } from './re-projects-kpi-budget-pg.repository';
import { PRODUCT_LINE_LABELS } from './re-projects.types';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import { ReProjectsPriceListPgRepository } from './re-projects-price-list-pg.repository';
import { buildProjectSummaryFromParts } from './re-projects-summary.util';
import { ReProjectsSqliteRepository } from './re-projects-sqlite.repository';
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
    private readonly sqlite: ReProjectsSqliteRepository,
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

  listTypes(includeInactive = false) {
    if (this.pgPrimary()) {
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
    const types = this.sqlite.listProjectTypes(includeInactive);
    const labels: Record<string, string> = {};
    for (const t of types) labels[t.code] = t.name;
    return { types, labels };
  }

  createType(body: SaveProjectTypeBody) {
    if (this.pgPrimary()) {
      throw new BadRequestException({
        error: 'Loại dự án dùng catalog mặc định khi PostgreSQL là nguồn chính.',
      });
    }
    try {
      return this.sqlite.saveProjectType(body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  updateType(typeId: number, body: SaveProjectTypeBody) {
    if (this.pgPrimary()) {
      throw new BadRequestException({
        error: 'Loại dự án dùng catalog mặc định khi PostgreSQL là nguồn chính.',
      });
    }
    try {
      return this.sqlite.saveProjectType(body, typeId);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  deleteType(typeId: number) {
    if (this.pgPrimary()) {
      throw new BadRequestException({
        error: 'Loại dự án dùng catalog mặc định khi PostgreSQL là nguồn chính.',
      });
    }
    try {
      this.sqlite.deleteProjectType(typeId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async listProjects(q?: string) {
    if (this.pgPrimary()) {
      return { projects: await this.pgOltp!.listProjects(q) };
    }
    return { projects: this.sqlite.listProjects(q) };
  }

  async createProject(body: CreateReProjectBody) {
    if (this.pgPrimary()) {
      try {
        return await this.pgOltp!.createProject(body);
      } catch (e) {
        throw new BadRequestException({ error: String((e as Error).message) });
      }
    }
    try {
      const row = this.sqlite.createProject(body);
      if (shouldDualWrite() && this.pgRepo) {
        try {
          await this.pgRepo.upsertFromSqlite(row);
        } catch (err) {
          console.error(err);
        }
      }
      return row;
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getProject(id: number) {
    if (this.pgPrimary()) {
      const proj = await this.pgOltp!.fetchProject(id);
      if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
      return proj;
    }
    const proj = this.sqlite.fetchProject(id);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    return proj;
  }

  async updateProject(id: number, body: CreateReProjectBody) {
    if (this.pgPrimary()) {
      try {
        return await this.pgOltp!.updateProject(id, body);
      } catch (e) {
        const msg = String((e as Error).message);
        if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
        throw new BadRequestException({ error: msg });
      }
    }
    try {
      const row = this.sqlite.updateProject(id, body);
      if (shouldDualWrite() && this.pgRepo) {
        try {
          await this.pgRepo.upsertFromSqlite(row);
        } catch (err) {
          console.error(err);
        }
      }
      return row;
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async deleteProject(id: number) {
    if (this.pgPrimary()) {
      try {
        await this.pgOltp!.deleteProject(id);
        return { ok: true };
      } catch (e) {
        const msg = String((e as Error).message);
        if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
        throw new BadRequestException({ error: msg });
      }
    }
    this.sqlite.deleteProject(id);
    return { ok: true };
  }

  async projectSummary(id: number) {
    if (this.pgPrimary()) {
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
    try {
      return this.sqlite.fetchProjectSummary(id);
    } catch (e) {
      throw new NotFoundException({ error: String((e as Error).message) });
    }
  }

  async listProducts(projectId: number) {
    if (this.pgPrimary() && this.productPg) {
      const products = await this.productPg.listEnrichedByProject(projectId);
      return { products, inventory: computeProductInventoryStats(products) };
    }
    const products = this.sqlite.listProducts(projectId);
    return { products, inventory: computeProductInventoryStats(products) };
  }

  async createProduct(projectId: number, body: SaveProductBody) {
    if (isBdsPackEnabled() && body.status !== undefined && !PACK_CREATE_STATUSES.has(body.status)) {
      throw new BadRequestException({ error: 'invalid_create_status' });
    }
    if (this.pgPrimary() && this.productPg) {
      try {
        return await this.productPg.saveProduct(projectId, body);
      } catch (e) {
        throw new BadRequestException({ error: String((e as Error).message) });
      }
    }
    try {
      const row = this.sqlite.saveProduct(projectId, body);
      await this.dualWriteProduct(row);
      return row;
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateProduct(projectId: number, productId: number, body: SaveProductBody) {
    if (isBdsPackEnabled() && body.status !== undefined) {
      throw new ConflictException({ error: 'status_via_transition' });
    }
    if (this.pgPrimary() && this.productPg) {
      try {
        return await this.productPg.saveProduct(projectId, body, productId);
      } catch (e) {
        const msg = String((e as Error).message);
        if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
        throw new BadRequestException({ error: msg });
      }
    }
    const row = this.sqlite.saveProduct(projectId, body, productId);
    await this.dualWriteProduct(row);
    return row;
  }

  async deleteProduct(projectId: number, productId: number) {
    if (this.pgPrimary() && this.productPg) {
      try {
        await this.productPg.deleteProduct(projectId, productId);
        return { ok: true };
      } catch (e) {
        const msg = String((e as Error).message);
        if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
        throw new BadRequestException({ error: msg });
      }
    }
    this.sqlite.deleteProduct(projectId, productId);
    return { ok: true };
  }

  private async dualWriteProduct(row: Record<string, unknown>): Promise<void> {
    if (shouldDualWrite() && this.productPg) {
      try {
        await this.productPg.upsertFromSqlite(row as SqliteProductMirror);
      } catch (err) {
        console.error(err);
      }
    }
  }

  async listZones(projectId: number) {
    if (this.pgPrimary() && this.productPg) {
      return { zones: await this.productPg.listZones(projectId) };
    }
    return { zones: this.sqlite.listProjectZones(projectId) };
  }

  async inventoryByZone(projectId: number) {
    if (this.pgPrimary() && this.productPg) {
      const products = await this.productPg.listEnrichedByProject(projectId);
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
    return { zones: this.sqlite.inventoryByZoneSummary(projectId) };
  }

  async priceBatches(projectId: number) {
    if (this.pgPrimary() && this.productPg) {
      return {
        batches: await this.productPg.listPriceBatches(projectId),
        summary: await this.productPg.inventoryByPriceBatchSummary(projectId),
      };
    }
    return {
      batches: this.sqlite.listPriceBatches(projectId),
      summary: this.sqlite.inventoryByPriceBatchSummary(projectId),
    };
  }

  async listPriceLists(projectId: number) {
    if (this.pgPrimary() && this.priceListPg) {
      return {
        price_lists: await this.priceListPg.listPriceLists(projectId),
        version_codes: await this.priceListPg.listAllVersionCodes(projectId),
      };
    }
    return {
      price_lists: this.sqlite.listPriceLists(projectId),
      version_codes: this.sqlite.listAllVersionCodes(projectId),
    };
  }

  async createPriceList(projectId: number, body: SavePriceListBody, createdBy = '') {
    if (this.pgPrimary() && this.priceListPg) {
      try {
        return await this.priceListPg.savePriceList(projectId, body, undefined, createdBy);
      } catch (e) {
        throw new BadRequestException({ error: String((e as Error).message) });
      }
    }
    try {
      return this.sqlite.savePriceList(projectId, body, undefined, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getPriceList(projectId: number, listId: number) {
    if (this.pgPrimary() && this.priceListPg) {
      const row = await this.priceListPg.fetchPriceList(projectId, listId);
      if (!row) throw new NotFoundException({ error: 'Không tìm thấy bảng giá.' });
      const { items, total } = await this.priceListPg.listPriceListItems(listId, 500);
      return { price_list: row, items, items_total: total };
    }
    const row = this.sqlite.fetchPriceList(projectId, listId);
    if (!row) throw new NotFoundException({ error: 'Không tìm thấy bảng giá.' });
    const { items, total } = this.sqlite.listPriceListItems(listId, 500);
    return { price_list: row, items, items_total: total };
  }

  async updatePriceList(projectId: number, listId: number, body: SavePriceListBody, createdBy = '') {
    if (this.pgPrimary() && this.priceListPg) {
      try {
        return await this.priceListPg.savePriceList(projectId, body, listId, createdBy);
      } catch (e) {
        throw new BadRequestException({ error: String((e as Error).message) });
      }
    }
    try {
      return this.sqlite.savePriceList(projectId, body, listId, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deletePriceList(projectId: number, listId: number) {
    if (this.pgPrimary() && this.priceListPg) {
      try {
        await this.priceListPg.deletePriceList(projectId, listId);
        return { ok: true };
      } catch (e) {
        throw new BadRequestException({ error: String((e as Error).message) });
      }
    }
    try {
      this.sqlite.deletePriceList(projectId, listId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }
}
