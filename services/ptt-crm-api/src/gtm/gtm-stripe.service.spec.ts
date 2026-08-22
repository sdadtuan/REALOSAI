const mockCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreate,
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

import { GtmStripeService } from './gtm-stripe.service';
import { GtmPaymentRepository } from './gtm-payment.repository';

describe('GtmStripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    mockCreate.mockResolvedValue({
      id: 'cs_test_abc123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
    });
  });

  it('creates checkout session for mkt setup 400 USD', async () => {
    const payments = {
      insertPending: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'pending' }),
    } as unknown as GtmPaymentRepository;

    const svc = new GtmStripeService(payments);
    const out = await svc.createSetupCheckout({
      sku: 'mkt',
      email: 'a@co.com',
      success_url: 'https://pttcrm.com/en/pricing?paid=1',
      cancel_url: 'https://pttcrm.com/en/pricing',
    });

    expect(out.session_id).toMatch(/^cs_test_/);
    expect(out.checkout_url).toContain('checkout.stripe.com');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: { sku: 'mkt', source: 'pttcrm_web' },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 400_00,
            }),
          }),
        ],
      }),
    );
    expect(payments.insertPending).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_session_id: 'cs_test_abc123',
        sku: 'mkt',
        amount_cents: 400_00,
        payer_email: 'a@co.com',
      }),
    );
  });
});
