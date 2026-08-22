import { readFileSync } from 'fs';
import { join } from 'path';
import { embedPlaybookText } from '../playbooks/playbooks.types';
import { RAG_CORPUS_STATUSES, RAG_EMBED_DIMS } from './market-research.types';
import type { RagEmbedInput } from './market-research.types';
import {
  embedInsightText,
  insightEmbedText,
  isRagCorpusStatus,
  rankRagHits,
  shouldSkipRagEmbed,
} from './research-rag.util';

type GoldCorpusRow = RagEmbedInput;

type GoldCase = {
  id: string;
  q: string;
  corpus: GoldCorpusRow[];
  must_include: number[];
  must_exclude: number[];
  needs_openai_query_vec?: boolean;
  portal_published_only?: boolean;
};

type GoldSet = { cases: GoldCase[] };

const goldsetPath = join(__dirname, '../../../../scripts/fixtures/research-rag-goldset.json');
const goldset = JSON.parse(readFileSync(goldsetPath, 'utf8')) as GoldSet;

function rankGoldCase(c: GoldCase, queryVec?: number[]) {
  const corpusIds = new Set(c.corpus.map((row) => row.insight_id));
  const rows = c.corpus.map((row) => ({
    ...row,
    project_id: 1,
    embedding: embedInsightText(insightEmbedText(row)),
    theme_codes: [] as string[],
  }));
  const opts: { queryVec?: number[]; corpusStatuses?: readonly string[] } = {};
  if (queryVec) opts.queryVec = queryVec;
  if (c.portal_published_only) opts.corpusStatuses = ['published'];
  const hits = rankRagHits(c.q, rows, Object.keys(opts).length ? opts : undefined);
  return { corpusIds, hits, hitIds: hits.map((h) => h.insight_id) };
}

describe('isRagCorpusStatus', () => {
  it('rejects draft and accepts published', () => {
    expect(isRagCorpusStatus('draft')).toBe(false);
    expect(isRagCorpusStatus('published')).toBe(true);
  });

  it('accepts only approved_client_facing and published', () => {
    expect(isRagCorpusStatus('approved_client_facing')).toBe(true);
    expect(isRagCorpusStatus('evidence_attached')).toBe(false);
    expect([...RAG_CORPUS_STATUSES]).toEqual(['approved_client_facing', 'published']);
  });
});

describe('embedInsightText', () => {
  it('wraps embedPlaybookText at RAG_EMBED_DIMS', () => {
    const text = 'Giá sữa học đường';
    expect(embedInsightText(text)).toEqual(embedPlaybookText(text, RAG_EMBED_DIMS));
    expect(embedInsightText(text).length).toBe(RAG_EMBED_DIMS);
  });
});

describe('rankRagHits theme filter', () => {
  const sentence = 'Giá sữa học đường tăng ở MT HCM';

  function row(insightId: number, theme_codes: string[], theme_synonyms: string[] = []) {
    return {
      insight_id: insightId,
      project_id: 1,
      status: 'published' as const,
      statement: sentence,
      observation: null,
      embedding: embedInsightText(insightEmbedText({ statement: sentence, observation: null })),
      theme_codes,
      theme_synonyms,
    };
  }

  it('M4-1b: theme_code=PRICE excludes insight not tagged PRICE', () => {
    const hits = rankRagHits(sentence, [row(1, ['PRICE'], ['pricing']), row(2, ['CHANNEL'], ['phân phối'])], {
      theme_code: 'PRICE',
    });
    expect(hits.map((h) => h.insight_id)).toEqual([1]);
  });

  it('matches theme synonym case-insensitively', () => {
    const hits = rankRagHits(sentence, [row(1, ['PRICE'], ['pricing', 'giá bán']), row(2, ['CHANNEL'])], {
      theme_code: 'Pricing',
    });
    expect(hits.map((h) => h.insight_id)).toEqual([1]);
  });
});

describe('rankRagHits dim mismatch', () => {
  it('P19 rankRagHits sets is_stale from valid_to on fresh hits', () => {
    const statement = 'Giá tăng';
    const vec = embedInsightText(statement);
    const hits = rankRagHits(
      statement,
      [
        {
          insight_id: 1,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          valid_to: '2020-01-01',
        },
        {
          insight_id: 2,
          project_id: 9,
          status: 'published',
          statement: 'Ổn định',
          observation: null,
          embedding: vec,
          theme_codes: [],
          valid_to: null,
        },
      ],
      { minScore: 0 },
    );
    expect(hits.map((h) => h.insight_id)).toEqual([2]);
    expect(hits[0]).toMatchObject({
      valid_to: null,
      is_stale: false,
    });
  });

  it('P27 rankRagHits default excludes stale even when higher score', () => {
    const staleStatement = 'Giá sữa học đường tăng tại Hà Nội';
    const freshStatement = 'Ổn định';
    const staleVec = embedInsightText(staleStatement);
    const hits = rankRagHits(
      staleStatement,
      [
        {
          insight_id: 1,
          project_id: 9,
          status: 'published',
          statement: staleStatement,
          observation: null,
          embedding: staleVec,
          theme_codes: [],
          valid_to: '2020-01-01',
        },
        {
          insight_id: 2,
          project_id: 9,
          status: 'published',
          statement: freshStatement,
          observation: null,
          embedding: embedInsightText(freshStatement),
          theme_codes: [],
          valid_to: null,
        },
      ],
      { minScore: 0, limit: 10 },
    );
    expect(hits.map((h) => h.insight_id)).toEqual([2]);
    expect(hits.every((h) => !h.is_stale)).toBe(true);
  });

  it('P27 rankRagHits default returns empty when corpus is all stale', () => {
    const statement = 'Giá tăng';
    const vec = embedInsightText(statement);
    const hits = rankRagHits(
      statement,
      [
        {
          insight_id: 1,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          valid_to: '2020-01-01',
        },
      ],
      { minScore: 0 },
    );
    expect(hits).toEqual([]);
  });

  it('P25 rankRagHits stale_only returns only stale hits up to limit', () => {
    const statement = 'Giá tăng';
    const vec = embedInsightText(statement);
    const hits = rankRagHits(
      statement,
      [
        {
          insight_id: 1,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          valid_to: '2020-01-01',
        },
        {
          insight_id: 2,
          project_id: 9,
          status: 'published',
          statement: 'Ổn định',
          observation: null,
          embedding: vec,
          theme_codes: [],
          valid_to: null,
        },
      ],
      { minScore: 0, stale_only: true, limit: 10 },
    );
    expect(hits.map((h) => h.insight_id)).toEqual([1]);
    expect(hits.every((h) => h.is_stale)).toBe(true);
  });

  it('skips rows whose embedding length differs from queryVec', () => {
    const hits = rankRagHits(
      'giá',
      [
        {
          insight_id: 1,
          project_id: 9,
          status: 'published',
          statement: 'Giá sữa',
          observation: null,
          embedding: [1, 0],
          theme_codes: [],
        },
      ],
      { queryVec: [1, 0, 0], minScore: 0 },
    );
    expect(hits).toEqual([]);
  });

  it('G3 with injected queryVec includes insight 10', () => {
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    const hits = rankRagHits(
      'học sinh uống sữa đắt hơn ở thủ đô',
      [
        {
          insight_id: 10,
          project_id: 9,
          status: 'approved_client_facing',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
        },
      ],
      { queryVec: vec, minScore: 0.12 },
    );
    expect(hits.map((h) => h.insight_id)).toContain(10);
  });
  it('portal corpusStatuses=published excludes approved_client_facing and draft', () => {
    const statement = 'Giá sữa học đường tăng tại Hà Nội';
    const vec = embedInsightText(statement);
    const row = (id: number, status: string) => ({
      insight_id: id,
      project_id: 9,
      status,
      statement,
      observation: null,
      embedding: vec,
      theme_codes: [] as string[],
    });
    const hits = rankRagHits(
      statement,
      [row(20, 'published'), row(21, 'approved_client_facing'), row(22, 'draft')],
      { corpusStatuses: ['published'], minScore: 0 },
    );
    expect(hits.map((h) => h.insight_id)).toEqual([20]);
  });
});

describe('shouldSkipRagEmbed', () => {
  it('skips empty text, PII, and keeps clean insight text', () => {
    expect(shouldSkipRagEmbed('')).toBe(true);
    expect(shouldSkipRagEmbed('Contact a@b.co')).toBe(true);
    expect(shouldSkipRagEmbed('Giá sữa học đường')).toBe(false);
  });
});

describe('research-rag gold-set', () => {
  it('G1 includes approved insight 1 and excludes draft 2', () => {
    const g1 = goldset.cases.find((c) => c.id === 'G1');
    expect(g1).toBeDefined();
    const { hitIds } = rankGoldCase(g1!);
    expect(hitIds).toEqual(expect.arrayContaining(g1!.must_include));
    for (const id of g1!.must_exclude) {
      expect(hitIds).not.toContain(id);
    }
  });

  it('G2 does not invent ids outside the case corpus and excludes draft', () => {
    const g2 = goldset.cases.find((c) => c.id === 'G2');
    expect(g2).toBeDefined();
    const { corpusIds, hits, hitIds } = rankGoldCase(g2!);
    for (const id of hitIds) {
      expect(corpusIds.has(id)).toBe(true);
    }
    expect(hits.every((h) => isRagCorpusStatus(h.status))).toBe(true);
    for (const id of g2!.must_exclude) {
      expect(hitIds).not.toContain(id);
    }
    for (const id of g2!.must_include) {
      expect(hitIds).toContain(id);
    }
  });

  it('every gold-set case honors must_include / must_exclude and corpus ids', () => {
    expect(goldset.cases.map((c) => c.id)).toEqual(expect.arrayContaining(['G1', 'G2', 'G3', 'G4']));
    for (const c of goldset.cases) {
      if (c.needs_openai_query_vec) continue;
      const { corpusIds, hits, hitIds } = rankGoldCase(c);
      for (const id of c.must_include) {
        expect(hitIds).toContain(id);
      }
      for (const id of c.must_exclude) {
        expect(hitIds).not.toContain(id);
      }
      for (const id of hitIds) {
        expect(corpusIds.has(id)).toBe(true);
      }
      expect(hits.every((h) => isRagCorpusStatus(h.status))).toBe(true);
    }
  });

  it('G3 with injected queryVec includes insight 10 (paraphrase gold-set)', () => {
    const g3 = goldset.cases.find((c) => c.id === 'G3');
    expect(g3).toBeDefined();
    const statement = g3!.corpus[0].statement;
    const vec = embedInsightText(insightEmbedText(g3!.corpus[0]));
    const { hitIds } = rankGoldCase(g3!, vec);
    for (const id of g3!.must_include) {
      expect(hitIds).toContain(id);
    }
    for (const id of g3!.must_exclude) {
      expect(hitIds).not.toContain(id);
    }
    expect(statement).toBe('Giá sữa học đường tăng tại Hà Nội');
  });
});
