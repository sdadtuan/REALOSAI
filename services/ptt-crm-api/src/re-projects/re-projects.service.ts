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
import { computeProductInventoryStats } from './re-projects-inventory.util';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
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
    @Optional() private readonly pgRepo?: BdsReProjectPgRepository,
    @Optional() private readonly productPg?: BdsReProductPgRepository,
    @Optional() private readonly inventory?: BdsInventoryService,
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

  projectSummary(id: number) {
    try {
      return this.sqlite.fetchProjectSummary(id);
    } catch (e) {
      throw new NotFoundException({ error: String((e as Error).message) });
    }
  }

  listProducts(projectId: number) {
    const products = this.sqlite.listProducts(projectId);
    return { products, inventory: computeProductInventoryStats(products) };
  }

  async createProduct(projectId: number, body: SaveProductBody) {
    if (isBdsPackEnabled() && body.status !== undefined && !PACK_CREATE_STATUSES.has(body.status)) {
      throw new BadRequestException({ error: 'invalid_create_status' });
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
    const row = this.sqlite.saveProduct(projectId, body, productId);
    await this.dualWriteProduct(row);
    return row;
  }

  deleteProduct(projectId: number, productId: number) {
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

  listZones(projectId: number) {
    return { zones: this.sqlite.listProjectZones(projectId) };
  }

  inventoryByZone(projectId: number) {
    return { zones: this.sqlite.inventoryByZoneSummary(projectId) };
  }

  priceBatches(projectId: number) {
    return {
      batches: this.sqlite.listPriceBatches(projectId),
      summary: this.sqlite.inventoryByPriceBatchSummary(projectId),
    };
  }

  listPriceLists(projectId: number) {
    return {
      price_lists: this.sqlite.listPriceLists(projectId),
      version_codes: this.sqlite.listAllVersionCodes(projectId),
    };
  }

  createPriceList(projectId: number, body: SavePriceListBody, createdBy = '') {
    try {
      return this.sqlite.savePriceList(projectId, body, undefined, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  getPriceList(projectId: number, listId: number) {
    const row = this.sqlite.fetchPriceList(projectId, listId);
    if (!row) throw new NotFoundException({ error: 'Không tìm thấy bảng giá.' });
    const { items, total } = this.sqlite.listPriceListItems(listId, 500);
    return { price_list: row, items, items_total: total };
  }

  updatePriceList(projectId: number, listId: number, body: SavePriceListBody, createdBy = '') {
    try {
      return this.sqlite.savePriceList(projectId, body, listId, createdBy);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  deletePriceList(projectId: number, listId: number) {
    try {
      this.sqlite.deletePriceList(projectId, listId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }
}
