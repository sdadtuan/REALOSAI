import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { isBdsPackEnabled } from '../bds/bds.flags';
import { shouldDualWrite } from '../bds/inventory/bds-dual-write.util';
import { BdsInventoryService } from '../bds/inventory/bds-inventory.service';
import {
  BdsReProductPgRepository,
  type SqliteProductMirror,
} from '../bds/inventory/bds-re-product-pg.repository';
import { BdsReProjectPgRepository } from '../bds/inventory/bds-re-project-pg.repository';
import { computeProductInventoryStats } from './re-projects-inventory.util';
import { ReProjectsSqliteRepository } from './re-projects-sqlite.repository';
import {
  CreateReProjectBody,
  SavePriceListBody,
  SaveProductBody,
  SaveProjectTypeBody,
} from './re-projects.types';

const PACK_CREATE_STATUSES = new Set(['available', 'locked']);

@Injectable()
export class ReProjectsService {
  constructor(
    private readonly sqlite: ReProjectsSqliteRepository,
    @Optional() private readonly pgRepo?: BdsReProjectPgRepository,
    @Optional() private readonly productPg?: BdsReProductPgRepository,
    @Optional() private readonly inventory?: BdsInventoryService,
  ) {}

  listTypes(includeInactive = false) {
    const types = this.sqlite.listProjectTypes(includeInactive);
    const labels: Record<string, string> = {};
    for (const t of types) labels[t.code] = t.name;
    return { types, labels };
  }

  createType(body: SaveProjectTypeBody) {
    try {
      return this.sqlite.saveProjectType(body);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  updateType(typeId: number, body: SaveProjectTypeBody) {
    try {
      return this.sqlite.saveProjectType(body, typeId);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  deleteType(typeId: number) {
    try {
      this.sqlite.deleteProjectType(typeId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  listProjects(q?: string) {
    return { projects: this.sqlite.listProjects(q) };
  }

  async createProject(body: CreateReProjectBody) {
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

  getProject(id: number) {
    const proj = this.sqlite.fetchProject(id);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    return proj;
  }

  async updateProject(id: number, body: CreateReProjectBody) {
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

  deleteProject(id: number) {
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
