import { VdProjectRepository } from './vd-project.repository';
import type { InsertVdProjectInput } from '../video-sop.types';

function makeRepo(cinematic: boolean): VdProjectRepository {
  const repo = new VdProjectRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: cinematic,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

const sample: InsertVdProjectInput = {
  lifecycle_id: 3,
  client_id: null,
  cmkt_item_id: 12,
  title: 'Chiến dịch',
  stage: 'brief_draft',
  status: 'active',
  created_by: 'a@b.c',
};

describe('VdProjectRepository fail-closed', () => {
  it('throws vd_tables_missing on insertProject when cinematic on and PG not ready', async () => {
    const repo = makeRepo(true);
    await expect(repo.insertProject(sample)).rejects.toThrow(/vd_tables_missing/);
  });

  it('throws vd_tables_missing on other writes when cinematic on and PG not ready', async () => {
    const repo = makeRepo(true);
    await expect(repo.insertBrief(1, {})).rejects.toThrow(/vd_tables_missing/);
    await expect(repo.insertScript(1, 1, 'x')).rejects.toThrow(/vd_tables_missing/);
    await expect(repo.insertAudit(1, 'a@b.c', 'project.created')).rejects.toThrow(/vd_tables_missing/);
  });

  it('reads return empty when PG not ready', async () => {
    const repo = makeRepo(true);
    expect(await repo.findByCmktItemId(12)).toBeNull();
    expect(await repo.getById(1)).toBeNull();
    expect(await repo.listByLifecycle(3)).toEqual([]);
    expect(await repo.countCreatedToday(3)).toBe(0);
  });

  it('insertProject uses memory when cinematic off and PG not ready', async () => {
    const repo = makeRepo(false);
    const row = await repo.insertProject(sample);
    expect(row.id).toBe(1);
    expect(row.cmkt_item_id).toBe(12);
    expect(await repo.getById(1)).toEqual(row);
  });
});
