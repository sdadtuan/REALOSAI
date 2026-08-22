import { BadRequestException } from '@nestjs/common';
import { ContentIdeaService } from './content-idea.service';
import { ContentItemService } from './content-item.service';
import { ContentMarketingService } from './content-marketing.service';

describe('ContentIdeaService', () => {
  const core = {
    ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }),
  };
  const repo = {
    listIdeas: jest.fn(),
    createIdea: jest.fn(),
    getIdeaById: jest.fn(),
    patchIdea: jest.fn(),
  };
  const items = {
    createItemFromIdea: jest.fn(),
  };
  const config = { contentMarketingAiEnabled: true };
  const worker = { processJob: jest.fn() };

  let service: ContentIdeaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentIdeaService(
      config as never,
      core as never,
      repo as never,
      worker as never,
      items as never,
    );
  });

  it('createIdea rejects empty title', async () => {
    await expect(service.createIdea(1, { title: '  ' }, 'a@test.vn')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('convertIdea creates item and marks idea converted', async () => {
    repo.getIdeaById.mockResolvedValue({
      id: 5,
      title: 'Idea A',
      target_goal: 'engagement',
      hook: 'h',
      meta_json: {},
      status: 'backlog',
    });
    items.createItemFromIdea.mockResolvedValue({ id: 99, status: 'draft' });
    repo.patchIdea.mockResolvedValue({ id: 5, status: 'converted' });

    const out = await service.convertIdea(
      1,
      5,
      { channel: 'facebook', format: 'social_post' },
      'writer@test.vn',
    );
    expect(out.item.id).toBe(99);
    expect(repo.patchIdea).toHaveBeenCalledWith(1, 5, { status: 'converted' });
  });
});

describe('ContentItemService', () => {
  const core = {
    ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }),
  };
  const repo = {
    listItems: jest.fn(),
    getItemById: jest.fn(),
    createItem: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
    staffExists: jest.fn(),
    getItemVersionByNo: jest.fn(),
  };

  const config = {
    contentMarketingMediaEnabled: false,
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentItemService(config as never, core as never, repo as never);
  });

  it('createItem rejects invalid channel format', async () => {
    await expect(
      service.createItem(
        1,
        { title: 'T', channel: 'facebook', format: 'blog' },
        'a@test.vn',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patchItem strips inbound market_research and keeps existing cite', async () => {
    const existingCite = {
      client_id: 'acme',
      insight_ids: [7],
      inserted_at: '2026-08-14T05:00:00.000Z',
      inserted_by: 'am@ptt',
    };
    repo.getItemById.mockResolvedValue({
      id: 10,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      brief_json: { hook: 'old', market_research: existingCite },
      body_json: { markdown: '' },
    });
    repo.patchItem.mockImplementation(
      (_lifecycleId: number, _itemId: number, patch: { brief_json?: Record<string, unknown> }) => ({
        id: 10,
        brief_json: patch.brief_json,
        body_json: { markdown: '' },
      }),
    );

    await service.patchItem(
      1,
      10,
      { brief_json: { hook: 'n', market_research: { statement: 'leak' } } },
      'writer@test.vn',
    );

    const stored = repo.patchItem.mock.calls[0][2].brief_json as Record<string, unknown>;
    expect(stored.hook).toBe('n');
    expect(stored.market_research).toEqual(existingCite);
    expect(JSON.stringify(stored)).not.toContain('leak');
    expect(JSON.stringify(stored)).not.toContain('statement');
  });

  it('patchItem writes version on body change', async () => {
    repo.getItemById.mockResolvedValue({
      id: 10,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      body_json: { markdown: '' },
    });
    repo.patchItem.mockResolvedValue({
      id: 10,
      body_json: { markdown: 'updated' },
    });

    await service.patchItem(1, 10, { body_json: { markdown: 'updated' } }, 'writer@test.vn');
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      10,
      { markdown: 'updated' },
      'writer@test.vn',
      'manual',
    );
  });

  it('patchItemAssignees validates staff id', async () => {
    repo.getItemById.mockResolvedValue({ id: 10, status: 'draft' });
    repo.staffExists.mockResolvedValue(false);
    await expect(
      service.patchItemAssignees(1, 10, { assignee_sp: 999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patchItemAssignees updates assignees', async () => {
    repo.getItemById.mockResolvedValue({ id: 10, status: 'draft' });
    repo.staffExists.mockResolvedValue(true);
    repo.patchItem.mockResolvedValue({ id: 10, assignee_sp: 3, assignee_qa: null });

    const out = await service.patchItemAssignees(1, 10, { assignee_sp: 3, assignee_qa: null });
    expect(out.assignee_sp).toBe(3);
    expect(repo.patchItem).toHaveBeenCalledWith(1, 10, { assignee_sp: 3, assignee_qa: null });
  });

  it('compareItemVersions returns diff lines', async () => {
    repo.getItemById.mockResolvedValue({ id: 10, status: 'draft' });
    repo.getItemVersionByNo.mockImplementation((_id: number, v: number) =>
      v === 1
        ? { version_no: 1, body_json: { markdown: 'a\nb' } }
        : { version_no: 2, body_json: { markdown: 'a\nc' } },
    );

    const out = await service.compareItemVersions(1, 10, 1, 2);
    expect(out.v1).toBe(1);
    expect(out.v2).toBe(2);
    expect(out.lines.some((l) => l.type === 'del' && l.text === 'b')).toBe(true);
    expect(out.lines.some((l) => l.type === 'add' && l.text === 'c')).toBe(true);
  });
});
