import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';

export type CmsUploadInput = {
  buffer: Buffer;
  mime: string;
  ext: string;
};

export type CmsUploadResult = {
  storageKey: string;
  publicUrl: string;
};

const SVG_SCRIPT_RE = /<script[\s>]/gi;
const SVG_ON_ATTR_RE = /\son[a-z]+\s*=/gi;

export function sanitizeSvg(buffer: Buffer): Buffer {
  const text = buffer.toString('utf8');
  if (SVG_SCRIPT_RE.test(text) || SVG_ON_ATTR_RE.test(text)) {
    const cleaned = text.replace(SVG_SCRIPT_RE, '').replace(SVG_ON_ATTR_RE, ' data-removed=');
    return Buffer.from(cleaned, 'utf8');
  }
  return buffer;
}

@Injectable()
export class CmsStorageService {
  private readonly logger = new Logger(CmsStorageService.name);

  constructor(private readonly config: AppConfigService) {}

  get localRoot(): string {
    return path.resolve(process.cwd(), '.cms-local');
  }

  usesS3(): boolean {
    return Boolean(
      this.config.cmsS3Bucket &&
        this.config.cmsS3AccessKey &&
        this.config.cmsS3SecretKey,
    );
  }

  buildStorageKey(ext: string): string {
    const safeExt = ext.replace(/^\./, '').toLowerCase();
    return `cms/${randomUUID()}.${safeExt}`;
  }

  buildPublicUrl(storageKey: string): string {
    const base = this.config.cmsPublicBase.replace(/\/$/, '');
    if (this.usesS3()) {
      return `${base}/${storageKey}`;
    }
    if (process.env.NODE_ENV !== 'production') {
      const port = this.config.port;
      return `http://127.0.0.1:${port}/api/v1/public/cms/files/${storageKey}`;
    }
    return `${base}/${storageKey}`;
  }

  async upload(input: CmsUploadInput): Promise<CmsUploadResult> {
    let buffer = input.buffer;
    if (input.mime === 'image/svg+xml') {
      buffer = sanitizeSvg(buffer);
    }

    const storageKey = this.buildStorageKey(input.ext);

    if (this.usesS3()) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const client = new S3Client({
          region: this.config.cmsS3Region,
          credentials: {
            accessKeyId: this.config.cmsS3AccessKey,
            secretAccessKey: this.config.cmsS3SecretKey,
          },
        });
        await client.send(
          new PutObjectCommand({
            Bucket: this.config.cmsS3Bucket,
            Key: storageKey,
            Body: buffer,
            ContentType: input.mime,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        return { storageKey, publicUrl: this.buildPublicUrl(storageKey) };
      } catch (err) {
        this.logger.warn(
          `S3 upload failed for ${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('CMS_STORAGE_UNAVAILABLE');
    }

    const filePath = path.join(this.localRoot, storageKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return { storageKey, publicUrl: this.buildPublicUrl(storageKey) };
  }

  readLocalFile(storageKey: string): Buffer | null {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    const filePath = path.join(this.localRoot, storageKey);
    if (!filePath.startsWith(this.localRoot)) {
      return null;
    }
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath);
  }

  guessMime(storageKey: string): string {
    const ext = path.extname(storageKey).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }
}
