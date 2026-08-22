import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsBuyerEnabled, isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsBuyerGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsBuyerEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
