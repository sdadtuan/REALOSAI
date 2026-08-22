import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BDS_DEPARTMENT_SEEDS } from '../bds/org/bds-org-seed';
import { StaffChatRepository } from './staff-chat.repository';
import type {
  CreateRoomBody,
  MemberRow,
  MessageRow,
  PostMessageBody,
  RoomRow,
} from './staff-chat.types';
import { CROSS_ROOM_SEEDS } from './staff-chat.types';
import { canEditMessage, isRestrictedCode, launchHuddleCode } from './staff-chat.util';

type TenantLookup = {
  getMe(tenantId: string): Promise<{ mode: string; id?: string }>;
};

@Injectable()
export class StaffChatService {
  private readonly logger = new Logger(StaffChatService.name);

  constructor(
    private readonly repo: StaffChatRepository,
    @Optional() private readonly tenants?: TenantLookup | null,
  ) {}

  private requireTenant(tenantId?: string): string {
    const t = String(tenantId ?? '').trim();
    if (!t) throw new NotFoundException();
    return t;
  }

  private assertTenantMatch(room: RoomRow, tenantId: string): void {
    if (String(room.tenant_id) !== tenantId) {
      throw new NotFoundException();
    }
  }

  private async assertMember(
    roomId: string,
    staffId: number,
    tenantId: string,
  ): Promise<{ room: RoomRow; member: MemberRow }> {
    const room = await this.repo.getById(roomId);
    if (!room) throw new NotFoundException();
    this.assertTenantMatch(room, tenantId);
    const member = await this.repo.getMember(roomId, staffId);
    if (!member) throw new NotFoundException();
    return { room, member };
  }

  private hideEntityCard(msg: MessageRow, hasTxView: boolean): MessageRow {
    if (msg.kind !== 'entity_card') return { ...msg, hidden: false };
    if (msg.entity_type === 'tx' && !hasTxView) {
      return { ...msg, hidden: true, body: 'Hồ sơ ẩn', entity_id: '' };
    }
    return { ...msg, hidden: false };
  }

  async ensureSeeded(tenantId: string): Promise<void> {
    const tid = this.requireTenant(tenantId);
    if (this.tenants) {
      try {
        await this.tenants.getMe(tid);
      } catch (err) {
        this.logger.warn(`ensureSeeded getMe ${tid}: ${String(err)}`);
      }
    }

    const rooms: RoomRow[] = [];

    for (const seed of BDS_DEPARTMENT_SEEDS) {
      const departmentId = await this.repo.getDepartmentIdByCode(seed.code);
      if (departmentId == null) continue;
      const room = await this.repo.upsertRoom({
        tenant_id: tid,
        kind: 'dept',
        code: seed.code,
        name: seed.name,
        department_id: departmentId,
        sensitivity: isRestrictedCode(seed.code) ? 'restricted' : 'normal',
        status: 'active',
      });
      rooms.push(room);
      const ids = await this.repo.listStaffIdsByDepartmentCodes([seed.code]);
      for (const id of ids) {
        const pos = await this.repo.getStaffPositionCode(id);
        await this.repo.upsertMember(room.id, id, pos === 'tgd' ? 'readonly' : 'member');
      }
    }

    for (const seed of CROSS_ROOM_SEEDS) {
      const room = await this.repo.upsertRoom({
        tenant_id: tid,
        kind: 'cross',
        code: seed.code,
        name: seed.name,
        department_id: null,
        sensitivity: 'normal',
        status: 'active',
      });
      rooms.push(room);
      const ids = await this.repo.listStaffIdsByDepartmentCodes([...seed.dept_codes]);
      for (const id of ids) {
        const pos = await this.repo.getStaffPositionCode(id);
        await this.repo.upsertMember(room.id, id, pos === 'tgd' ? 'readonly' : 'member');
      }
    }

    const allDeptCodes = BDS_DEPARTMENT_SEEDS.map((s) => s.code);
    const allIds = await this.repo.listStaffIdsByDepartmentCodes(allDeptCodes);
    for (const id of allIds) {
      if ((await this.repo.getStaffPositionCode(id)) !== 'tgd') continue;
      for (const room of rooms) {
        await this.repo.upsertMember(room.id, id, 'readonly');
      }
    }
  }

  async listRooms(staffId: number, tenantId: string): Promise<RoomRow[]> {
    const tid = this.requireTenant(tenantId);
    await this.ensureSeeded(tid);
    return this.repo.listForStaff(tid, staffId);
  }

  async getRoom(roomId: string, staffId: number, tenantId: string): Promise<RoomRow> {
    const tid = this.requireTenant(tenantId);
    const { room } = await this.assertMember(roomId, staffId, tid);
    return room;
  }

  async createRoom(body: CreateRoomBody, staffId: number, tenantId: string): Promise<RoomRow> {
    const tid = this.requireTenant(tenantId);
    const kind = body.kind;
    if (kind === 'dept' || kind === 'cross') {
      throw new BadRequestException({ error: 'kind' });
    }
    if (kind === 'dm') {
      const peer = Number(body.peer_staff_id);
      if (!Number.isInteger(peer) || peer <= 0 || peer === staffId) {
        throw new BadRequestException({ error: 'peer_staff_id' });
      }
      const a = Math.min(staffId, peer);
      const b = Math.max(staffId, peer);
      const room = await this.repo.upsertRoom({
        tenant_id: tid,
        kind: 'dm',
        code: `dm_${a}_${b}`,
        name: `DM ${a} × ${b}`,
        department_id: null,
        sensitivity: 'normal',
        status: 'active',
        created_by: staffId,
      });
      await this.repo.upsertMember(room.id, staffId, 'owner');
      await this.repo.upsertMember(room.id, peer, 'member');
      return room;
    }
    if (kind === 'huddle') {
      const name = String(body.name ?? '').trim();
      if (!name) throw new BadRequestException({ error: 'name' });
      const code =
        String(body.code ?? '').trim() ||
        `huddle_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const expiresAt =
        body.expires_at == null || body.expires_at === ''
          ? null
          : body.expires_at instanceof Date
            ? body.expires_at
            : new Date(body.expires_at);
      const room = await this.repo.upsertRoom({
        tenant_id: tid,
        kind: 'huddle',
        code,
        name,
        department_id: null,
        sensitivity: 'normal',
        status: 'active',
        created_by: staffId,
        expires_at: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      });
      await this.repo.upsertMember(room.id, staffId, 'owner');
      for (const id of body.member_staff_ids ?? []) {
        if (Number.isInteger(id) && id > 0 && id !== staffId) {
          await this.repo.upsertMember(room.id, id, 'member');
        }
      }
      return room;
    }
    throw new BadRequestException({ error: 'kind' });
  }

  async listMessages(
    roomId: string,
    staffId: number,
    tenantId: string,
    opts: { beforeId?: string; hasTxView?: boolean } = {},
  ): Promise<MessageRow[]> {
    const tid = this.requireTenant(tenantId);
    await this.assertMember(roomId, staffId, tid);
    const rows = await this.repo.listMessages(roomId, opts.beforeId);
    return rows.map((msg) => this.hideEntityCard(msg, Boolean(opts.hasTxView)));
  }

  async postMessage(
    roomId: string,
    staffId: number,
    body: PostMessageBody,
    tenantId: string,
  ): Promise<MessageRow> {
    const tid = this.requireTenant(tenantId);
    const { room, member } = await this.assertMember(roomId, staffId, tid);
    if (room.status === 'archived') {
      throw new ConflictException({ error: 'room_archived' });
    }
    if (member.role === 'readonly') {
      throw new NotFoundException();
    }
    const text = String(body.body ?? '').trim();
    const kind = body.kind ?? 'text';
    if (kind === 'text' && text.length < 1) {
      throw new BadRequestException({ error: 'body' });
    }
    return this.repo.insertMessage({
      room_id: roomId,
      author_staff_id: staffId,
      kind,
      body: text,
      reply_to_id: body.reply_to_id ?? null,
      entity_type: body.entity_type ?? null,
      entity_id: body.entity_id ?? null,
      file_ids: body.file_ids,
      idempotency_key: body.idempotency_key ?? null,
    });
  }

  async editMessage(
    messageId: string,
    staffId: number,
    body: string,
    tenantId: string,
    now = new Date(),
  ): Promise<MessageRow> {
    const tid = this.requireTenant(tenantId);
    const msg = await this.repo.getMessage(messageId);
    if (!msg) throw new NotFoundException();
    await this.assertMember(msg.room_id, staffId, tid);
    if (msg.author_staff_id !== staffId) throw new NotFoundException();
    if (msg.tombstoned_at) throw new ConflictException({ error: 'tombstoned' });
    if (!canEditMessage(msg.created_at, now)) {
      throw new BadRequestException({ error: 'edit_window' });
    }
    const text = String(body ?? '').trim();
    if (!text) throw new BadRequestException({ error: 'body' });
    const updated = await this.repo.updateMessageBody(messageId, text, now);
    if (!updated) throw new NotFoundException();
    return updated;
  }

  async tombstone(
    messageId: string,
    staffId: number,
    reason: string,
    tenantId: string,
    opts: { canModerate?: boolean; now?: Date } = {},
  ): Promise<MessageRow> {
    const tid = this.requireTenant(tenantId);
    const msg = await this.repo.getMessage(messageId);
    if (!msg) throw new NotFoundException();
    await this.assertMember(msg.room_id, staffId, tid);
    const now = opts.now ?? new Date();
    const authorOk = msg.author_staff_id === staffId && canEditMessage(msg.created_at, now);
    if (!authorOk && !opts.canModerate) {
      throw new NotFoundException();
    }
    if (msg.tombstoned_at) throw new ConflictException({ error: 'tombstoned' });
    const updated = await this.repo.tombstone(messageId, String(reason ?? '').trim(), now);
    if (!updated) throw new NotFoundException();
    return updated;
  }

  async markRead(
    roomId: string,
    staffId: number,
    messageId: string,
    tenantId: string,
  ): Promise<void> {
    const tid = this.requireTenant(tenantId);
    await this.assertMember(roomId, staffId, tid);
    await this.repo.setLastRead(roomId, staffId, messageId);
  }

  async postHandoffCard(
    tenantId: string,
    roomCode: string,
    card: { entity_type: string; entity_id: string; body: string },
  ): Promise<MessageRow | null> {
    const tid = String(tenantId ?? '').trim();
    if (!tid) return null;
    try {
      await this.ensureSeeded(tid);
    } catch (err) {
      this.logger.warn(`postHandoffCard seed ${tid}: ${String(err)}`);
    }
    const room = await this.repo.getByCode(tid, roomCode);
    if (!room) {
      this.logger.warn(`postHandoffCard missing room ${roomCode} tenant=${tid}`);
      return null;
    }
    return this.repo.insertMessage({
      room_id: room.id,
      author_staff_id: null,
      kind: 'entity_card',
      body: card.body,
      entity_type: card.entity_type,
      entity_id: card.entity_id,
    });
  }

  async ensureLaunchHuddle(input: {
    tenantId: string;
    launchId: string;
    projectId: number;
    expiresAt?: Date | null;
    memberStaffIds?: number[];
  }): Promise<RoomRow | null> {
    const tid = String(input.tenantId ?? '').trim();
    if (!tid || !input.launchId) return null;
    const code = launchHuddleCode(input.launchId);
    const room = await this.repo.upsertRoom({
      tenant_id: tid,
      kind: 'huddle',
      code,
      name: `Ra quân ${input.launchId}`,
      department_id: null,
      project_id: input.projectId,
      sensitivity: 'normal',
      status: 'active',
      expires_at: input.expiresAt ?? null,
      entity_type: 'launch',
      entity_id: input.launchId,
    });
    for (const id of input.memberStaffIds ?? []) {
      if (Number.isInteger(id) && id > 0) {
        await this.repo.upsertMember(room.id, id, 'member');
      }
    }
    return room;
  }

  async archiveLaunchHuddle(tenantId: string, launchId: string): Promise<void> {
    const tid = String(tenantId ?? '').trim();
    if (!tid || !launchId) return;
    const existing = await this.repo.getByCode(tid, launchHuddleCode(launchId));
    if (!existing) return;
    await this.repo.upsertRoom({
      tenant_id: tid,
      kind: existing.kind,
      code: existing.code,
      name: existing.name,
      department_id: existing.department_id,
      project_id: existing.project_id,
      sensitivity: existing.sensitivity,
      status: 'archived',
      expires_at: existing.expires_at,
      entity_type: existing.entity_type,
      entity_id: existing.entity_id,
    });
  }
}
