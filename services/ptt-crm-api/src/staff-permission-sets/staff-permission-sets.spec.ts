import { BadRequestException, ConflictException } from '@nestjs/common';
import { StaffPermissionSetsRepository } from './staff-permission-sets.repository';

describe('StaffPermissionSetsRepository (memory)', () => {
  const config = { databaseUrl: 'postgresql://invalid:5432/nodb' } as never;
  const repo = new StaffPermissionSetsRepository(config);

  it('creates and lists a permission set', async () => {
    const created = await repo.createSet({ code: 'set-export-only', name: 'Export only' });
    expect(created.code).toBe('SET-EXPORT-ONLY');
    const listed = await repo.listSets();
    expect(listed.some((s) => s.code === 'SET-EXPORT-ONLY')).toBe(true);
  });

  it('rejects duplicate set codes', async () => {
    await repo.createSet({ code: 'set-dup', name: 'One' });
    await expect(repo.createSet({ code: 'set-dup', name: 'Two' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid set code', async () => {
    await expect(repo.createSet({ code: ' ', name: 'Bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unions set grants into user effective caps', async () => {
    await repo.createSet({ code: 'set-solution-backup', name: 'Solution backup' });
    await repo.replaceGrants('set-solution-backup', {
      grants: [{ section_id: 'crm_presales_solution', action: 'claim' }],
    });
    const userId = '00000000-0000-4000-8000-000000000001';
    await repo.replaceUserSets(userId, ['set-solution-backup'], 'admin@test');
    const caps = await repo.loadCapsForUser(userId);
    expect(caps).toEqual([{ section_id: 'crm_presales_solution', action: 'claim' }]);
    const codes = await repo.loadUserSetCodes(userId);
    expect(codes).toEqual(['SET-SOLUTION-BACKUP']);
  });
});
