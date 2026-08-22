import { Injectable, Logger } from '@nestjs/common';
import { SearchEntityDocument, SearchEntityType, SearchHit } from './crm-search.types';

const DEFAULT_INDEX = 'search_entities';

@Injectable()
export class OpensearchClient {
  private readonly logger = new Logger(OpensearchClient.name);
  readonly indexName: string;
  readonly baseUrl: string | null;

  constructor() {
    this.baseUrl = (process.env.OPENSEARCH_URL ?? process.env.OPENSEARCH_NODE ?? '').trim().replace(/\/$/, '') || null;
    this.indexName = (process.env.OPENSEARCH_INDEX ?? DEFAULT_INDEX).trim() || DEFAULT_INDEX;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  async ping(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await fetch(`${this.baseUrl}/`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async ensureIndex(): Promise<void> {
    if (!this.baseUrl) return;
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(this.indexName)}`, { method: 'HEAD' });
    if (res.status === 404) {
      await fetch(`${this.baseUrl}/${encodeURIComponent(this.indexName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { index: { number_of_shards: 1, number_of_replicas: 0 } },
          mappings: {
            properties: {
              entity_type: { type: 'keyword' },
              entity_id: { type: 'keyword' },
              title: { type: 'text' },
              subtitle: { type: 'text' },
              body: { type: 'text' },
              route_path: { type: 'keyword' },
              updated_at: { type: 'date', ignore_malformed: true },
            },
          },
        }),
      });
    }
  }

  async bulkUpsert(docs: SearchEntityDocument[]): Promise<number> {
    if (!this.baseUrl || !docs.length) return 0;
    await this.ensureIndex();
    const lines: string[] = [];
    for (const doc of docs) {
      const id = `${doc.entity_type}:${doc.entity_id}`;
      lines.push(JSON.stringify({ index: { _index: this.indexName, _id: id } }));
      lines.push(JSON.stringify(doc));
    }
    const res = await fetch(`${this.baseUrl}/_bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body: `${lines.join('\n')}\n`,
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`OpenSearch bulk upsert failed: ${res.status} ${text.slice(0, 200)}`);
      return 0;
    }
    return docs.length;
  }

  async search(q: string, entityType?: SearchEntityType, limit = 20): Promise<SearchHit[]> {
    if (!this.baseUrl) return [];
    const must: Array<Record<string, unknown>> = [
      {
        multi_match: {
          query: q,
          fields: ['title^3', 'subtitle^2', 'body'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      },
    ];
    if (entityType) {
      must.push({ term: { entity_type: entityType } });
    }
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(this.indexName)}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: Math.min(Math.max(limit, 1), 50),
        query: { bool: { must } },
      }),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      hits?: { hits?: Array<{ _score?: number; _source?: SearchEntityDocument }> };
    };
    return (body.hits?.hits ?? []).map((row) => {
      const src = row._source ?? ({} as SearchEntityDocument);
      return {
        entity_type: src.entity_type,
        entity_id: src.entity_id,
        title: src.title,
        subtitle: src.subtitle,
        snippet: src.body?.slice(0, 160),
        route_path: src.route_path,
        score: Number(row._score ?? 0),
      };
    });
  }
}
