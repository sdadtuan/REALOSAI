import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GtmService } from './gtm.service';
import { GtmStripeService } from './gtm-stripe.service';
import { GtmPublicStatusService } from './gtm-public-status.service';
import { isSkuInterest } from './gtm-usd-prices.util';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.ip || '0.0.0.0';
  }
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

@Controller('api/v1/public/gtm')
export class GtmPublicController {
  constructor(
    private readonly gtm: GtmService,
    private readonly stripe: GtmStripeService,
    private readonly publicStatus: GtmPublicStatusService,
  ) {}

  @Get('status')
  async getStatus(
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (origin && this.gtm.isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    return this.publicStatus.getPublicStatus();
  }

  @Post('demo-requests')
  async createDemoRequest(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.gtm.isAllowedOrigin(origin)) {
      throw new ForbiddenException({ error: 'origin_not_allowed' });
    }

    const result = await this.gtm.createPublic(body, clientIp(req));

    if (result === 'honeypot') {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    if (result === 'rate_limited') {
      throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if ('field_errors' in result) {
      throw new HttpException({ field_errors: result.field_errors }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    res.status(HttpStatus.CREATED);
    return result;
  }

  @Post('checkout')
  async createCheckout(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Req() req: Request,
  ) {
    if (!this.gtm.isAllowedOrigin(origin)) {
      throw new ForbiddenException({ error: 'origin_not_allowed' });
    }

    const record =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const sku = typeof record.sku === 'string' ? record.sku : '';
    const email = typeof record.email === 'string' ? record.email : '';
    const success_url = typeof record.success_url === 'string' ? record.success_url : '';
    const cancel_url = typeof record.cancel_url === 'string' ? record.cancel_url : '';

    if (!isSkuInterest(sku)) {
      throw new HttpException({ field_errors: { sku: 'invalid' } }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    return this.stripe.createSetupCheckout({
      sku,
      email,
      success_url,
      cancel_url,
    });
  }
}
