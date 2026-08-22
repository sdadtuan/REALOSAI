import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled, isBdsTxEnabled } from '../bds.flags';

@Injectable()
export class BdsTxGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsTxEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
