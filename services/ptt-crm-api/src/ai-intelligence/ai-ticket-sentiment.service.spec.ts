import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiTicketSentimentService } from './ai-ticket-sentiment.service';
import { AiAuditService } from './ai-audit.service';
import { TicketsSqliteRepository } from '../tickets/tickets-sqlite.repository';

describe('AiTicketSentimentService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-sentiment'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn();
      return { ...result, runId: 'run-sentiment-1' };
    }),
  };
  const tickets = {
    getById: jest.fn(),
    updateSentiment: jest.fn(),
  };

  let service: AiTicketSentimentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiTicketSentimentService,
        { provide: AiAuditService, useValue: audit },
        { provide: TicketsSqliteRepository, useValue: tickets },
      ],
    }).compile();
    service = module.get(AiTicketSentimentService);
  });

  it('scores ticket and persists sentiment', async () => {
    tickets.getById.mockReturnValue({
      id: 9,
      title: 'Phàn nàn dịch vụ',
      description: 'Không hài lòng',
      ticket_type: 'phan_nan',
      priority: 'cao',
      resolution: '',
      sentiment_label: null,
      sentiment_scored_at: null,
    });
    tickets.updateSentiment.mockReturnValue({ id: 9 });

    const out = await service.scoreTicket({ ticket_id: 9, actorId: 'staff-1' });
    expect(out.data.sentiment.label).toBe('negative');
    expect(out.data.agent_run_id).toBe('run-sentiment-1');
    expect(tickets.updateSentiment).toHaveBeenCalled();
  });

  it('throws when ticket missing', async () => {
    tickets.getById.mockReturnValue(null);
    await expect(service.scoreTicket({ ticket_id: 404 })).rejects.toBeInstanceOf(NotFoundException);
  });
});
