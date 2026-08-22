import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { GtmRepository } from './gtm.repository';
import { GTM_PROPOSAL_SKU_PRICES } from './gtm-proposal-prices.util';

@Injectable()
export class GtmProposalService {
  constructor(private readonly repo: GtmRepository) {}

  async buildProposalPdf(id: string): Promise<Buffer> {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: 'not_found' });

    const sku = GTM_PROPOSAL_SKU_PRICES[row.sku_interest] ?? GTM_PROPOSAL_SKU_PRICES.ind;
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(18).text('PTTCRM — Proposal', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Company: ${row.company}`);
    doc.text(`Contact: ${row.full_name} · ${row.email}`);
    doc.text(`Industry: ${row.industry}`);
    doc.moveDown();
    doc.text(`Package: ${sku.name}`);
    doc.text(`Retainer: ${sku.retainer.toLocaleString('vi-VN')} VND/tháng`);
    doc.text(`Setup: ${sku.setup.toLocaleString('vi-VN')} VND`);
    doc.moveDown();
    doc.fontSize(10).text('Hợp đồng tối thiểu 12 tháng. Chiết khấu retainer tối đa 15%.');
    doc.text('Không niêm yết giá theo user.');

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return Buffer.concat(chunks);
  }
}
