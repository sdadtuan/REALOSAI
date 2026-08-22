import { GtmStripeWebhookController } from './gtm-stripe-webhook.controller';
import { GtmStripeService } from './gtm-stripe.service';
import { GtmPaymentRepository } from './gtm-payment.repository';

describe('GtmStripeWebhookController', () => {
  it('marks payment paid on checkout.session.completed', async () => {
    const stripe = {
      verifyWebhookSignature: jest.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1', payment_intent: 'pi_test_1' } },
      }),
    } as unknown as GtmStripeService;

    const payments = {
      findByStripeSessionId: jest.fn().mockResolvedValue({ status: 'pending' }),
      markPaid: jest.fn().mockResolvedValue({ status: 'paid' }),
    } as unknown as GtmPaymentRepository;

    const ctrl = new GtmStripeWebhookController(stripe, payments);
    const out = await ctrl.handleWebhook(
      { rawBody: Buffer.from('{}') } as never,
      'sig',
    );

    expect(out).toEqual({ received: true });
    expect(payments.markPaid).toHaveBeenCalledWith({
      stripe_session_id: 'cs_test_1',
      stripe_payment_intent: 'pi_test_1',
    });
  });

  it('returns duplicate no-op when already paid', async () => {
    const stripe = {
      verifyWebhookSignature: jest.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_dup', payment_intent: 'pi_x' } },
      }),
    } as unknown as GtmStripeService;

    const payments = {
      findByStripeSessionId: jest.fn().mockResolvedValue({ status: 'paid' }),
      markPaid: jest.fn(),
    } as unknown as GtmPaymentRepository;

    const ctrl = new GtmStripeWebhookController(stripe, payments);
    const out = await ctrl.handleWebhook(
      { rawBody: Buffer.from('{}') } as never,
      'sig',
    );

    expect(out).toEqual({ received: true, duplicate: true });
    expect(payments.markPaid).not.toHaveBeenCalled();
  });
});
