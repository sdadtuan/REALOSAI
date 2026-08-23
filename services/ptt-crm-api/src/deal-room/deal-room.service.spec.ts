import { NotFoundException } from '@nestjs/common';
import { DealRoomService } from './deal-room.service';

describe('DealRoomService re_buyer', () => {
  it('re_buyer snapshot → 404', async () => {
    const funnel = {
      getFunnel: jest.fn().mockResolvedValue({
        presales: { presales: { stage: 'consult' } },
        lead_flow_kind: 're_buyer',
      }),
    };
    const leads = { getLeadById: jest.fn().mockResolvedValue({ id: 1, owner_id: 1 }) };
    const svc = new DealRoomService(
      funnel as never,
      leads as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(svc.getSnapshot(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
