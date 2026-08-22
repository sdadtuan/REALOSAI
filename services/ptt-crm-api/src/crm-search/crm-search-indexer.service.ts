import { Injectable, Logger } from '@nestjs/common';
import { OpensearchClient } from './opensearch.client';
import { SearchDocumentProvider } from './search-document.provider';
import { SearchEntityType } from './crm-search.types';

/** RNOS-11 — sync CRM entities to OpenSearch `search_entities` index. */
@Injectable()
export class CrmSearchIndexerService {
  private readonly logger = new Logger(CrmSearchIndexerService.name);

  constructor(
    private readonly opensearch: OpensearchClient,
    private readonly documents: SearchDocumentProvider,
  ) {}

  async handleTenantEvent(eventType: string, entityType?: string, entityId?: string): Promise<void> {
    if (!this.opensearch.isConfigured() || !(await this.opensearch.ping())) {
      return;
    }
    this.logger.debug(`Indexer event ${eventType} ${entityType ?? ''}:${entityId ?? ''}`);
    if (entityType && entityId) {
      const mapped = this.mapEventEntity(entityType);
      if (!mapped) return;
      const doc = (await this.documents.collectAll(500)).find((d) => d.entity_type === mapped && d.entity_id === String(entityId));
      if (doc) {
        await this.opensearch.bulkUpsert([doc]);
      }
      return;
    }
    await this.reindexAll();
  }

  async reindexAll(): Promise<number> {
    if (!this.opensearch.isConfigured() || !(await this.opensearch.ping())) {
      return 0;
    }
    const docs = await this.documents.collectAll(300);
    return this.opensearch.bulkUpsert(docs);
  }

  private mapEventEntity(raw: string): SearchEntityType | null {
    const v = raw.trim().toLowerCase();
    if (v === 'lead') return 'lead';
    if (v === 'deal' || v === 'case' || v === 'opportunity') return 'deal';
    if (v === 'ticket') return 'ticket';
    if (v === 'customer' || v === 'account') return 'account';
    if (v === 'contact') return 'contact';
    return null;
  }
}
