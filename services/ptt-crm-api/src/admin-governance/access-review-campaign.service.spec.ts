import { BadRequestException } from '@nestjs/common';
import { AccessReviewCampaignService } from './access-review-campaign.service';

describe('AccessReviewCampaignService helpers', () => {
  it('rejects empty title on create', async () => {
    const repo = { create: jest.fn() };
    const org = { listUsers: jest.fn() };
    const actions = { insertMany: jest.fn() };
    const audit = { logSyntheticEvent: jest.fn() };
    const svc = new AccessReviewCampaignService(
      repo as never,
      org as never,
      actions as never,
      audit as never,
    );
    await expect(svc.createCampaign({ title: 'ab' }, 'po@test.vn')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
