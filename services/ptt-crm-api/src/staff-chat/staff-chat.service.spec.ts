import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StaffChatService } from './staff-chat.service';

describe('StaffChatService', () => {
  const repo = {
    upsertRoom: jest.fn(),
    getById: jest.fn(),
    getByCode: jest.fn(),
    listForStaff: jest.fn(),
    upsertMember: jest.fn(),
    getMember: jest.fn(),
    listMembers: jest.fn(),
    setLastRead: jest.fn(),
    insertMessage: jest.fn(),
    getMessage: jest.fn(),
    listMessages: jest.fn(),
    updateMessageBody: jest.fn(),
    tombstone: jest.fn(),
    listStaffIdsByDepartmentCodes: jest.fn().mockResolvedValue([]),
    getStaffDepartmentCode: jest.fn().mockResolvedValue('ban_kd'),
    getStaffPositionCode: jest.fn().mockResolvedValue('tvv_inhouse'),
    getDepartmentIdByCode: jest.fn().mockResolvedValue(1),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer', id: 't1' }) };
  let svc: StaffChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenants.getMe.mockResolvedValue({ mode: 'developer', id: 't1' });
    repo.listStaffIdsByDepartmentCodes.mockResolvedValue([]);
    repo.getDepartmentIdByCode.mockResolvedValue(1);
    repo.getStaffPositionCode.mockResolvedValue('tvv_inhouse');
    svc = new StaffChatService(repo as never, tenants as never);
  });

  it('BDS-39: non-member getRoom → 404', async () => {
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', code: 'ban_kd', kind: 'dept' });
    repo.getMember.mockResolvedValue(null);
    await expect(svc.getRoom('r1', 99, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BDS-40: non-member post → 404', async () => {
    repo.getById.mockResolvedValue({
      id: 'r1',
      tenant_id: 't1',
      code: 'ban_phap_che',
      kind: 'dept',
      status: 'active',
    });
    repo.getMember.mockResolvedValue(null);
    await expect(svc.postMessage('r1', 7, { body: 'xin so' }, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('BDS-43: edit after 15m → 400 edit_window', async () => {
    repo.getMessage.mockResolvedValue({
      id: 'm1',
      room_id: 'r1',
      author_staff_id: 7,
      kind: 'text',
      created_at: new Date('2026-08-22T10:00:00Z'),
      tombstoned_at: null,
    });
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', status: 'active' });
    repo.getMember.mockResolvedValue({ staff_id: 7, role: 'member' });
    await expect(
      svc.editMessage('m1', 7, 'sua', 't1', new Date('2026-08-22T10:16:00Z')),
    ).rejects.toMatchObject({ response: { error: 'edit_window' } });
  });

  it('readonly member cannot post', async () => {
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', status: 'active' });
    repo.getMember.mockResolvedValue({ staff_id: 1, role: 'readonly' });
    await expect(svc.postMessage('r1', 1, { body: 'hi' }, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ensureSeeded upserts dept + cross codes', async () => {
    await svc.ensureSeeded('t1');
    expect(repo.upsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 't1', kind: 'dept', code: 'ban_kd' }),
    );
    expect(repo.upsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 't1', kind: 'cross', code: 'x_kd_collection' }),
    );
  });

  it('create dm requires two staff ids', async () => {
    await expect(svc.createRoom({ kind: 'dm' }, 7, 't1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BDS-42 hides entity card without tx view', async () => {
    repo.getById.mockResolvedValue({ id: 'r1', tenant_id: 't1', status: 'active' });
    repo.getMember.mockResolvedValue({ staff_id: 7, role: 'member' });
    repo.listMessages.mockResolvedValue([
      { id: 'm1', kind: 'entity_card', body: 'TX A-1204', entity_type: 'tx', entity_id: 'tx1' },
    ]);
    const out = await svc.listMessages('r1', 7, 't1', { hasTxView: false });
    expect(out[0].hidden).toBe(true);
    expect(out[0].body).toBe('Hồ sơ ẩn');
    expect(out[0].entity_id).toBe('');
  });

  it('ensureLaunchHuddle upserts launch_* huddle', async () => {
    repo.upsertRoom.mockResolvedValue({ id: 'h1', code: 'launch_L1', kind: 'huddle' });
    await svc.ensureLaunchHuddle({ tenantId: 't1', launchId: 'L1', projectId: 7 });
    expect(repo.upsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'huddle',
        code: 'launch_L1',
        entity_type: 'launch',
        entity_id: 'L1',
      }),
    );
  });
});
