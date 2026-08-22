import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { GtmPaymentRepository } from './gtm-payment.repository';
import { GtmStripeService } from './gtm-stripe.service';

@Controller('api/v1/gtm/public/stripe')
export class GtmStripeWebhookController {
  constructor(
    private readonly stripe: GtmStripeService,
    private readonly payments: GtmPaymentRepository,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

    let event: Stripe.Event;
    try {
      event = this.stripe.verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      return { received: false };
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      const existing = await this.payments.findByStripeSessionId(sessionId);
      if (existing?.status === 'paid') {
        return { received: true, duplicate: true };
      }
      await this.payments.markPaid({
        stripe_session_id: sessionId,
        stripe_payment_intent:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
      });
      return { received: true };
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.payments.markExpired(session.id);
      return { received: true };
    }

    return { received: true };
  }
}
