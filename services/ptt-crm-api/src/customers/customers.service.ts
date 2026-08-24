import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { TimelineEventSource } from '../customer-timeline/customer-timeline.constants';
import { CustomersPgRepository } from './customers-pg.repository';
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
    private readonly pg: CustomersPgRepository,
    private readonly timeline: CustomerTimelineService,
  ) {}

  async list(q?: string, limit?: number) {
    const lim = limit ? Number(limit) : 200;
    const customers = await this.pg.listCustomers(q, Number.isFinite(lim) ? lim : 200);
    return { customers };
  }

  async detail(id: number) {
    const customer = await this.pg.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException({ error: 'Không tìm thấy khách hàng' });
    }
    const relations = await this.pg.fetchRelations(id);
    const purchases = await this.pg.fetchPurchases(id);
    const issues = await this.pg.fetchIssues(id);
    const stats = this.pg.computeStats(relations, purchases, issues);
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
    return this.pg.createCustomer(body);
  }

  async patch(id: number, body: PatchCustomerBody) {
    const existing = await this.pg.getCustomerById(id);
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
    const customer = await this.pg.patchCustomer(id, body);
    if (!customer) {
      throw new NotFoundException({ error: 'Không tìm thấy khách hàng' });
    }
    return customer;
  }

  private async ensureCustomer(id: number) {
    const customer = await this.pg.getCustomerById(id);
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
    return this.pg.createRelation(customerId, body);
  }

  async patchRelation(customerId: number, relationId: number, body: PatchRelationBody) {
    await this.ensureCustomer(customerId);
    const mergedName = 'full_name' in body ? String(body.full_name ?? '').trim() : undefined;
    if (mergedName !== undefined && !mergedName) {
      throw new BadRequestException({ error: 'Họ tên không được trống' });
    }
    const relation = await this.pg.patchRelation(customerId, relationId, body);
    if (!relation) {
      throw new NotFoundException({ error: 'Không tìm thấy quan hệ' });
    }
    return relation;
  }

  async deleteRelation(customerId: number, relationId: number) {
    await this.ensureCustomer(customerId);
    const ok = await this.pg.deleteRelation(customerId, relationId);
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
    return this.pg.createPurchase(customerId, body);
  }

  async patchPurchase(customerId: number, purchaseId: number, body: PatchPurchaseBody) {
    await this.ensureCustomer(customerId);
    const purchase = await this.pg.patchPurchase(customerId, purchaseId, body);
    if (!purchase) {
      throw new NotFoundException({ error: 'Không tìm thấy giao dịch' });
    }
    return purchase;
  }

  async deletePurchase(customerId: number, purchaseId: number) {
    await this.ensureCustomer(customerId);
    const ok = await this.pg.deletePurchase(customerId, purchaseId);
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
    return this.pg.createIssue(customerId, body);
  }

  async patchIssue(customerId: number, issueId: number, body: PatchIssueBody) {
    await this.ensureCustomer(customerId);
    const issue = await this.pg.patchIssue(customerId, issueId, body);
    if (!issue) {
      throw new NotFoundException({ error: 'Không tìm thấy vấn đề' });
    }
    return issue;
  }

  async latestBrief(customerId: number) {
    await this.ensureCustomer(customerId);
    const brief = await this.pg.getLatestBrief(customerId);
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
    const linkedLeadIds = await this.pg.findLinkedLeadIds(customerId);
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
