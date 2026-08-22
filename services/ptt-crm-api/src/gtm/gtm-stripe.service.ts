import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { GtmPaymentRepository } from './gtm-payment.repository';
import { isSkuInterest, setupUsdCents } from './gtm-usd-prices.util';
import type { SkuInterest } from './gtm-validate.util';

export type CreateSetupCheckoutInput = {
  sku: SkuInterest;
  email: string;
  success_url: string;
  cancel_url: string;
};

export type CreateSetupCheckoutResult = {
  checkout_url: string;
  session_id: string;
};

@Injectable()
export class GtmStripeService {
  private readonly rateLimitHits = new Map<string, number[]>();
  private stripeClient: Stripe | null = null;

  constructor(private readonly payments: GtmPaymentRepository) {}

  resetRateLimitsForTests(): void {
    this.rateLimitHits.clear();
  }

  private get stripe(): Stripe {
    const key = (process.env.STRIPE_SECRET_KEY ?? '').trim();
    if (!key) {
      throw new ServiceUnavailableException({ error: 'stripe_not_configured' });
    }
    if (!this.stripeClient) {
      this.stripeClient = new Stripe(key);
    }
    return this.stripeClient;
  }

  async createSetupCheckout(input: CreateSetupCheckoutInput): Promise<CreateSetupCheckoutResult> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({ field_errors: { email: 'invalid' } });
    }
    if (!isSkuInterest(input.sku)) {
      throw new BadRequestException({ field_errors: { sku: 'invalid' } });
    }
    if (!this.isValidRedirectUrl(input.success_url) || !this.isValidRedirectUrl(input.cancel_url)) {
      throw new BadRequestException({ field_errors: { redirect: 'invalid' } });
    }

    if (this.isRateLimited(email)) {
      throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.recordRateLimitHit(email);

    const amountCents = setupUsdCents(input.sku);
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      success_url: input.success_url,
      cancel_url: input.cancel_url,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `PTTCRM setup (${input.sku})`,
              metadata: { sku: input.sku },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        sku: input.sku,
        source: 'pttcrm_web',
      },
    });

    if (!session.url || !session.id) {
      throw new ServiceUnavailableException({ error: 'stripe_session_failed' });
    }

    await this.payments.insertPending({
      stripe_session_id: session.id,
      sku: input.sku,
      amount_cents: amountCents,
      payer_email: email,
      metadata: { sku: input.sku, source: 'pttcrm_web' },
    });

    return { checkout_url: session.url, session_id: session.id };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
    if (!secret) {
      throw new ServiceUnavailableException({ error: 'stripe_webhook_not_configured' });
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature ?? '', secret);
  }

  private isValidRedirectUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowMs = 3600_000;
    const max = 10;
    const hits = (this.rateLimitHits.get(key) ?? []).filter((t) => now - t < windowMs);
    this.rateLimitHits.set(key, hits);
    return hits.length >= max;
  }

  private recordRateLimitHit(key: string): void {
    const hits = this.rateLimitHits.get(key) ?? [];
    hits.push(Date.now());
    this.rateLimitHits.set(key, hits);
  }
}
