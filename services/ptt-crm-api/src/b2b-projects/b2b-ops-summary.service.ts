import { Injectable } from '@nestjs/common';
import { B2bOpsSummaryRepository } from './b2b-ops-summary.repository';

@Injectable()
export class B2bOpsSummaryService {
  constructor(private readonly repo: B2bOpsSummaryRepository) {}

  getSummary(input: { projectId?: string }) {
    return this.repo.loadSummary(input);
  }
}
