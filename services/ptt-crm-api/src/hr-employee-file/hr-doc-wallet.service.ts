import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrDocWalletRepository } from './hr-doc-wallet.repository';
import { HrDocWalletStorageService } from './hr-doc-wallet.storage';
import type {
  ApproveHrDocWalletCardBody,
  CreateHrDocTypeBody,
  CreateHrDocWalletCardBody,
  HrWalletListQuery,
  PatchHrDocWalletCardBody,
  RejectHrDocWalletCardBody,
} from './hr-doc-wallet.types';
import { buildHrWalletAccountingXlsx } from './hr-doc-wallet-export.util';
import { HR_DOC_WALLET_MAX_FILES_PER_CARD, HR_DOC_WALLET_MAX_FILE_BYTES, HR_DOC_WALLET_MIME } from './hr-doc-wallet.types';
import { computeWalletCompleteness, countExpiringCards } from './hr-doc-wallet.util';

@Injectable()
export class HrDocWalletService {
  constructor(
    private readonly walletRepo: HrDocWalletRepository,
    private readonly staffRepo: HrEmployeeFileRepository,
    private readonly storage: HrDocWalletStorageService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async ensureReady(): Promise<void> {
    if (!(await this.walletRepo.walletTablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_doc_wallet_not_ready' });
    }
  }

  private async caps(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    const canViewDocs =
      this.staffAuth.hasCap(me.caps, 'crm_hr_docs', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view');
    const canEditDocs =
      this.staffAuth.hasCap(me.caps, 'crm_hr_docs', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit');
    const canDownload =
      this.staffAuth.hasCap(me.caps, 'crm_hr_docs', 'download') ||
      canViewDocs;
    const canApprove = this.staffAuth.hasCap(me.caps, 'crm_hr_docs', 'approve');
    return { me, canViewDocs, canEditDocs, canDownload, canApprove };
  }

  async listDocTypes(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const types = await this.walletRepo.listDocTypes();
    return { ok: true, types };
  }

  async createDocType(payload: StaffJwtPayload | undefined, body: CreateHrDocTypeBody) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canEditDocs } = await this.caps(payload!);
    if (!canEditDocs) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    const type = await this.walletRepo.createDocType(body);
    return { ok: true, type };
  }

  async listWallet(payload: StaffJwtPayload | undefined, staffId: number, query: HrWalletListQuery) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const cards = await this.walletRepo.listCards(staffId, query);
    const types = await this.walletRepo.listRequiredTypes();
    const wallet_pct = computeWalletCompleteness(types, cards);
    return {
      ok: true,
      cards,
      wallet_pct,
      expiring_count: countExpiringCards(cards),
    };
  }

  async createCard(payload: StaffJwtPayload | undefined, staffId: number, body: CreateHrDocWalletCardBody) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditDocs } = await this.caps(user);
    if (!canEditDocs) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    const card = await this.walletRepo.createCard(staffId, body);
    return { ok: true, card };
  }

  async patchCard(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    cardId: number,
    body: PatchHrDocWalletCardBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditDocs } = await this.caps(user);
    if (!canEditDocs) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    const card = await this.walletRepo.patchCard(staffId, cardId, body);
    if (!card) return { ok: true, deleted: true, id: cardId };
    return { ok: true, card };
  }

  async uploadFile(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    cardId: number,
    file: Express.Multer.File,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditDocs } = await this.caps(user);
    if (!canEditDocs) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    if (!file?.buffer?.length) throw new BadRequestException({ error: 'file_required' });
    const mime = String(file.mimetype ?? '').trim().toLowerCase();
    if (!HR_DOC_WALLET_MIME.has(mime)) {
      throw new BadRequestException({ error: 'invalid_mime', mime });
    }
    if (file.size > HR_DOC_WALLET_MAX_FILE_BYTES) {
      throw new BadRequestException({ error: 'file_too_large', max_bytes: HR_DOC_WALLET_MAX_FILE_BYTES });
    }
    const card = await this.walletRepo.getCard(staffId, cardId);
    if (!card) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    const count = await this.walletRepo.countFiles(cardId);
    if (count >= HR_DOC_WALLET_MAX_FILES_PER_CARD) {
      throw new BadRequestException({ error: 'too_many_files', max: HR_DOC_WALLET_MAX_FILES_PER_CARD });
    }
    const saved = await this.storage.save(staffId, cardId, {
      buffer: file.buffer,
      mime,
      originalName: String(file.originalname ?? 'file'),
    });
    const row = await this.walletRepo.addFile(cardId, {
      storageKey: saved.storageKey,
      originalName: String(file.originalname ?? 'file'),
      mimeType: mime,
      sizeBytes: saved.sizeBytes,
    });
    await this.staffRepo.logPiiAudit({
      staffId,
      actorUserId: user.sub,
      actorEmail: user.email ?? '',
      action: 'wallet_file_upload',
      section: 'wallet',
      meta: { card_id: cardId, file_id: row.id },
    });
    return { ok: true, file: row };
  }

  async downloadFile(payload: StaffJwtPayload | undefined, staffId: number, cardId: number, fileId: number) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canDownload } = await this.caps(user);
    if (!canDownload) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    const card = await this.walletRepo.getCard(staffId, cardId);
    if (!card) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    const file = await this.walletRepo.getFile(cardId, fileId);
    if (!file) throw new NotFoundException({ error: 'file_not_found', id: fileId });
    const buffer = this.storage.read(file.storage_key);
    if (!buffer) throw new NotFoundException({ error: 'file_missing_on_disk', id: fileId });
    await this.staffRepo.logPiiAudit({
      staffId,
      actorUserId: user.sub,
      actorEmail: user.email ?? '',
      action: 'wallet_file_download',
      section: 'wallet',
      meta: { card_id: cardId, file_id: fileId },
    });
    return { file, buffer };
  }

  async rosterStats(payload: StaffJwtPayload | undefined, staffIds: number[]) {
    this.requireUser(payload);
    await this.ensureReady();
    const items = await this.walletRepo.rosterWalletStats(staffIds);
    return { ok: true, items };
  }

  async walletPctForStaff(staffId: number): Promise<number> {
    if (!(await this.walletRepo.walletTablesReady())) return 0;
    const types = await this.walletRepo.listRequiredTypes();
    const cards = await this.walletRepo.listCards(staffId);
    return computeWalletCompleteness(types, cards);
  }

  async listPendingReview(payload: StaffJwtPayload | undefined, limit = 50) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canViewDocs, canApprove } = await this.caps(payload!);
    if (!canViewDocs && !canApprove) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    }
    const items = await this.walletRepo.listPendingReview(limit);
    return { ok: true, items, pending_count: items.length };
  }

  async approveCard(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    cardId: number,
    body: ApproveHrDocWalletCardBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canApprove } = await this.caps(user);
    if (!canApprove) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs', action: 'approve' });
    }
    const card = await this.walletRepo.reviewCard(staffId, cardId, {
      approve: true,
      reviewedBy: user.email ?? user.sub,
      notes: body.notes,
    });
    await this.staffRepo.logPiiAudit({
      staffId,
      actorUserId: user.sub,
      actorEmail: user.email ?? '',
      action: 'wallet_card_approved',
      section: 'wallet',
      meta: { card_id: cardId },
    });
    return { ok: true, card };
  }

  async rejectCard(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    cardId: number,
    body: RejectHrDocWalletCardBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canApprove } = await this.caps(user);
    if (!canApprove) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs', action: 'approve' });
    }
    const card = await this.walletRepo.reviewCard(staffId, cardId, {
      approve: false,
      reviewedBy: user.email ?? user.sub,
      notes: body.notes,
    });
    return { ok: true, card };
  }

  async exportAccountingXlsx(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canViewDocs } = await this.caps(payload!);
    if (!canViewDocs) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    }
    const walletRows = await this.walletRepo.listWalletExportRows();
    const dependentRows = await this.walletRepo.listDependentsExportRows();
    return buildHrWalletAccountingXlsx({ walletRows, dependentRows });
  }
}
