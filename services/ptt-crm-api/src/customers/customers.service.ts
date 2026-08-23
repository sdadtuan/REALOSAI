import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { TimelineEventSource } from '../customer-timeline/customer-timeline.constants';
import { CustomersPgRepository } from './customers-pg.repository';
import { CustomersSqliteRepository } from './customers-sqlite.repository';
import {
  CreateCustomerBody,
  CreateIssueBody,
  CreatePurchaseBody,
  CreateRelationBody,
  GenerateBriefBody,
  PatchCustomerBody,
  PatchIssueBody,
  PatchPurchaseBody,
  PatchRelationBody,
} from './customers.types';

@Injectable()
export class CustomersService {
  constructor(
    private readonly sqlite: CustomersSqliteRepository,
    private readonly pg: CustomersPgRepository,
    private readonly config: AppConfigService,
    private readonly timeline: CustomerTimelineService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmCustomersPg;
  }

  async list(q?: string, limit?: number) {
    const lim = limit ? Number(limit) : 200;
    const customers = this.usePg
      ? await this.pg.listCustomers(q, Number.isFinite(lim) ? lim : 200)
      : this.sqlite.listCustomers(q, Number.isFinite(lim) ? lim : 200);
    return { customers };
  }

  async detail(id: number) {
    const customer = this.usePg
      ? await this.pg.getCustomerById(id)
      : this.sqlite.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException({ error: 'Không tìm thấy khách hàng' });
    }
    const relations = this.usePg
      ? await this.pg.fetchRelations(id)
      : this.sqlite.fetchRelations(id);
    const purchases = this.usePg
      ? await this.pg.fetchPurchases(id)
      : this.sqlite.fetchPurchases(id);
    const issues = this.usePg ? await this.pg.fetchIssues(id) : this.sqlite.fetchIssues(id);
    const stats = this.usePg
      ? this.pg.computeStats(relations, purchases, issues)
      : this.sqlite.computeStats(relations, purchases, issues);
    return { customer, relations, purchases, issues, stats };
  }

  async create(body: CreateCustomerBody) {
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const email = String(body.email ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Cần tên khách hàng' });
    }
    if (!phone && !email) {
      throw new BadRequestException({ error: 'Cần ít nhất số điện thoại hoặc email' });
    }
    return this.usePg
      ? this.pg.createCustomer(body)
      : this.sqlite.createCustomer(body);
  }

  async patch(id: number, body: PatchCustomerBody) {
    const existing = this.usePg
      ? await this.pg.getCustomerById(id)
      : this.sqlite.getCustomerById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Không tìm thấy khách hàng' });
    }
    const mergedName = 'name' in body ? String(body.name ?? '').trim() : existing.name;
    const mergedPhone = 'phone' in body ? String(body.phone ?? '').trim() : existing.phone;
    const mergedEmail = 'email' in body ? String(body.email ?? '').trim() : existing.email;
    if (!mergedName) {
      throw new BadRequestException({ error: 'Tên không được trống' });
    }
    if (!mergedPhone && !mergedEmail) {
      throw new BadRequestException({ error: 'Cần ít nhất SĐT hoặc email' });
    }
    const customer = this.usePg
      ? await this.pg.patchCustomer(id, body)
      : this.sqlite.patchCustomer(id, body);
    if (!customer) {
      throw new NotFoundException({ error: 'Không tìm thấy khách hàng' });
    }
    return customer;
  }

  private async ensureCustomer(id: number) {
    const customer = this.usePg
      ? await this.pg.getCustomerById(id)
      : this.sqlite.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException({ error: 'Không tìm thấy khách hàng' });
    }
    return customer;
  }

  async createRelation(customerId: number, body: CreateRelationBody) {
    await this.ensureCustomer(customerId);
    const fullName = String(body.full_name ?? '').trim();
    if (!fullName) {
      throw new BadRequestException({ error: 'Cần họ tên người liên quan' });
    }
    return this.usePg
      ? this.pg.createRelation(customerId, body)
      : this.sqlite.createRelation(customerId, body);
  }

  async patchRelation(customerId: number, relationId: number, body: PatchRelationBody) {
    await this.ensureCustomer(customerId);
    const mergedName = 'full_name' in body ? String(body.full_name ?? '').trim() : undefined;
    if (mergedName !== undefined && !mergedName) {
      throw new BadRequestException({ error: 'Họ tên không được trống' });
    }
    const relation = this.usePg
      ? await this.pg.patchRelation(customerId, relationId, body)
      : this.sqlite.patchRelation(customerId, relationId, body);
    if (!relation) {
      throw new NotFoundException({ error: 'Không tìm thấy quan hệ' });
    }
    return relation;
  }

  async deleteRelation(customerId: number, relationId: number) {
    await this.ensureCustomer(customerId);
    const ok = this.usePg
      ? await this.pg.deleteRelation(customerId, relationId)
      : this.sqlite.deleteRelation(customerId, relationId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy quan hệ' });
    }
    return { ok: true };
  }

  async createPurchase(customerId: number, body: CreatePurchaseBody) {
    await this.ensureCustomer(customerId);
    const product = String(body.product_name ?? '').trim();
    if (!product) {
      throw new BadRequestException({ error: 'Cần tên sản phẩm / dịch vụ' });
    }
    return this.usePg
      ? this.pg.createPurchase(customerId, body)
      : this.sqlite.createPurchase(customerId, body);
  }

  async patchPurchase(customerId: number, purchaseId: number, body: PatchPurchaseBody) {
    await this.ensureCustomer(customerId);
    const purchase = this.usePg
      ? await this.pg.patchPurchase(customerId, purchaseId, body)
      : this.sqlite.patchPurchase(customerId, purchaseId, body);
    if (!purchase) {
      throw new NotFoundException({ error: 'Không tìm thấy giao dịch' });
    }
    return purchase;
  }

  async deletePurchase(customerId: number, purchaseId: number) {
    await this.ensureCustomer(customerId);
    const ok = this.usePg
      ? await this.pg.deletePurchase(customerId, purchaseId)
      : this.sqlite.deletePurchase(customerId, purchaseId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy giao dịch' });
    }
    return { ok: true };
  }

  async createIssue(customerId: number, body: CreateIssueBody) {
    await this.ensureCustomer(customerId);
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Cần tiêu đề vấn đề' });
    }
    return this.usePg
      ? this.pg.createIssue(customerId, body)
      : this.sqlite.createIssue(customerId, body);
  }

  async patchIssue(customerId: number, issueId: number, body: PatchIssueBody) {
    await this.ensureCustomer(customerId);
    const issue = this.usePg
      ? await this.pg.patchIssue(customerId, issueId, body)
      : this.sqlite.patchIssue(customerId, issueId, body);
    if (!issue) {
      throw new NotFoundException({ error: 'Không tìm thấy vấn đề' });
    }
    return issue;
  }

  async latestBrief(customerId: number) {
    await this.ensureCustomer(customerId);
    const brief = this.usePg
      ? await this.pg.getLatestBrief(customerId)
      : this.sqlite.getLatestBrief(customerId);
    return brief ?? {};
  }

  async generateBrief(customerId: number, _body: GenerateBriefBody) {
    await this.ensureCustomer(customerId);
    return {
      ok: true,
      stub: true,
      brief: { summary: 'AI brief stub — configure ANTHROPIC_API_KEY' },
    };
  }

  async customerTimeline(
    customerId: number,
    opts?: { limit?: number; offset?: number; event_source?: TimelineEventSource },
  ) {
    await this.ensureCustomer(customerId);
    const linkedLeadIds = this.usePg
      ? await this.pg.findLinkedLeadIds(customerId)
      : this.sqlite.findLinkedLeadIds(customerId);
    const envelope = await this.timeline.getCustomerTimelineEnvelope(
      customerId,
      linkedLeadIds,
      {
        limit: opts?.limit,
        offset: opts?.offset,
        eventSource: opts?.event_source,
      },
    );
    return envelope.data;
  }
}
