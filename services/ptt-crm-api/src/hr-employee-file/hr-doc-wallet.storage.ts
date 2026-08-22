import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export type HrDocUploadInput = {
  buffer: Buffer;
  mime: string;
  originalName: string;
};

export type HrDocUploadResult = {
  storageKey: string;
  sizeBytes: number;
};

@Injectable()
export class HrDocWalletStorageService {
  private readonly logger = new Logger(HrDocWalletStorageService.name);

  get rootDir(): string {
    const custom = (process.env.PTT_HR_DOC_STORAGE_ROOT ?? '').trim();
    if (custom) return path.resolve(custom);
    return path.resolve(process.cwd(), 'data/hr-doc-wallet');
  }

  buildStorageKey(staffId: number, cardId: number, ext: string): string {
    const safeExt = ext.replace(/^\./, '').toLowerCase() || 'bin';
    return `${staffId}/${cardId}/${randomUUID()}.${safeExt}`;
  }

  async save(staffId: number, cardId: number, input: HrDocUploadInput): Promise<HrDocUploadResult> {
    const ext = path.extname(input.originalName) || mimeToExt(input.mime);
    const storageKey = this.buildStorageKey(staffId, cardId, ext);
    const filePath = this.resolvePath(storageKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, input.buffer);
    return { storageKey, sizeBytes: input.buffer.length };
  }

  read(storageKey: string): Buffer | null {
    const filePath = this.resolvePath(storageKey);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  resolvePath(storageKey: string): string {
    const normalized = storageKey.replace(/^\/+/, '');
    const filePath = path.resolve(this.rootDir, normalized);
    if (!filePath.startsWith(this.rootDir)) {
      throw new Error('invalid_storage_key');
    }
    return filePath;
  }

  remove(storageKey: string): void {
    try {
      const filePath = this.resolvePath(storageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      this.logger.warn(`remove failed ${storageKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return '.pdf';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
}
