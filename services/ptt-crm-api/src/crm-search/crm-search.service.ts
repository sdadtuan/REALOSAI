import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OpensearchClient } from './opensearch.client';
import { SearchDocumentProvider } from './search-document.provider';
import {
  ReindexResponse,
  SearchHealthResponse,
  SearchQuery,
  SearchResponse,
  normalizeSearchEntityType,
} from './crm-search.types';

@Injectable()
export class CrmSearchService {
  constructor(
    private readonly opensearch: OpensearchClient,
    private readonly documents: SearchDocumentProvider,
  ) {}

  private async assertOpenSearchReady(): Promise<void> {
    if (!this.opensearch.isConfigured()) {
      throw new ServiceUnavailableException({
        error: 'opensearch_not_configured',
        message: 'OpenSearch is required — set OPENSEARCH_URL',
      });
    }
    if (!(await this.opensearch.ping())) {
      throw new ServiceUnavailableException({
        error: 'opensearch_unreachable',
        message: 'OpenSearch cluster is not reachable',
      });
    }
  }

  async search(input: SearchQuery, requestId?: string): Promise<SearchResponse> {
    const started = Date.now();
    const q = String(input.q ?? '').trim();
    if (q.length < 2) {
      throw new BadRequestException({ error: 'query_too_short', message: 'q must be at least 2 characters' });
    }
    const entityType = normalizeSearchEntityType(input.entity_type);
    if (input.entity_type && !entityType) {
      throw new BadRequestException({
        error: 'invalid_entity_type',
        message: 'entity_type must be one of account, contact, lead, deal, email, note, ticket',
      });
    }
    const limit = Math.min(Math.max(Number(input.limit ?? 20) || 20, 1), 50);

    await this.assertOpenSearchReady();
    const hits = await this.opensearch.search(q, entityType ?? undefined, limit);

    return {
      data: {
        query: q,
        entity_type: entityType,
        hits,
        total: hits.length,
        engine: 'opensearch',
        index: this.opensearch.indexName,
      },
      meta: { request_id: requestId?.trim() || randomUUID(), latency_ms: Date.now() - started },
      errors: [],
    };
  }

  async health(requestId?: string): Promise<SearchHealthResponse> {
    const configured = this.opensearch.isConfigured();
    const reachable = configured ? await this.opensearch.ping() : false;
    const status = reachable ? 'ready' : configured ? 'degraded' : 'unconfigured';
    return {
      data: {
        status,
        index: this.opensearch.indexName,
        opensearch_url: this.opensearch.baseUrl,
        opensearch_reachable: reachable,
        opensearch_required: true,
        document_count_estimate: reachable ? await this.documents.estimateDocumentCount() : undefined,
      },
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }

  async reindex(requestId?: string): Promise<ReindexResponse> {
    await this.assertOpenSearchReady();
    const docs = await this.documents.collectAll(300);
    const indexed = await this.opensearch.bulkUpsert(docs);
    return {
      data: {
        indexed,
        engine: 'opensearch',
        index: this.opensearch.indexName,
      },
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }
}
