import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrDocWalletRepository } from './hr-doc-wallet.repository';
import { HrDocWalletStorageService } from './hr-doc-wallet.storage';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import type { CreateHrDocWalletCardBody } from './hr-doc-wallet.types';
import { HR_DOC_WALLET_MAX_FILE_BYTES, HR_DOC_WALLET_MIME } from './hr-doc-wallet.types';
import { canSelfSubmitCategory } from './hr-doc-wallet-self.util';
import { computeWalletCompleteness, countExpiringCards } from './hr-doc-wallet.util';

@Injectable()
export class HrDocWalletMeService {
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

  private async resolveStaffId(payload: StaffJwtPayload): Promise<number> {
    const staffId = await this.staffAuth.resolveCrmStaffUserId(payload);
    if (!staffId) {
      throw new ForbiddenException({ error: 'staff_profile_not_linked' });
    }
    return staffId;
  }

  async listMyWallet(payload: StaffJwtPayload | undefined) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    const staffId = await this.resolveStaffId(user);
    await this.staffRepo.assertStaffExists(staffId);
    const cards = await this.walletRepo.listCards(staffId, { self_visible_only: true });
    const types = await this.walletRepo.listRequiredTypes();
    return {
      ok: true,
      staff_id: staffId,
      cards,
      wallet_pct: computeWalletCompleteness(types, cards),
      expiring_count: countExpiringCards(cards),
    };
  }

  async listSelfSubmitTypes(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.resolveStaffId(payload!);
    const types = await this.walletRepo.listDocTypes();
    return {
      ok: true,
      types: types.filter((t) => canSelfSubmitCategory(t.category)),
    };
  }

  async submitCard(payload: StaffJwtPayload | undefined, body: CreateHrDocWalletCardBody) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    const staffId = await this.resolveStaffId(user);
    await this.staffRepo.assertStaffExists(staffId);
    const typeCode = String(body.type_code ?? '').trim();
    if (!typeCode) throw new BadRequestException({ error: 'type_code_required' });
    const types = await this.walletRepo.listDocTypes();
    const typeRow = types.find((t) => t.type_code === typeCode);
    if (!typeRow || !canSelfSubmitCategory(typeRow.category)) {
      throw new BadRequestException({ error: 'self_submit_type_not_allowed', type_code: typeCode });
    }
    const card = await this.walletRepo.createCard(staffId, body, {
      submittedBy: user.email ?? user.sub,
      forcePending: true,
    });
    return { ok: true, card };
  }

  async uploadMyFile(
    payload: StaffJwtPayload | undefined,
    cardId: number,
    file: Express.Multer.File,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    const staffId = await this.resolveStaffId(user);
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
    if (card.status !== 'pending_review') {
      throw new BadRequestException({ error: 'card_not_editable', status: card.status });
    }
    const count = await this.walletRepo.countFiles(cardId);
    if (count >= 20) throw new BadRequestException({ error: 'too_many_files', max: 20 });
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
    return { ok: true, file: row };
  }

  async downloadMyFile(payload: StaffJwtPayload | undefined, cardId: number, fileId: number) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    const staffId = await this.resolveStaffId(user);
    const card = await this.walletRepo.getCard(staffId, cardId);
    if (!card) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    if (card.visibility !== 'self' && card.status !== 'pending_review') {
      throw new ForbiddenException({ error: 'file_not_visible' });
    }
    const file = await this.walletRepo.getFile(cardId, fileId);
    if (!file) throw new NotFoundException({ error: 'file_not_found', id: fileId });
    const buffer = this.storage.read(file.storage_key);
    if (!buffer) throw new NotFoundException({ error: 'file_missing_on_disk', id: fileId });
    return { file, buffer };
  }
}
