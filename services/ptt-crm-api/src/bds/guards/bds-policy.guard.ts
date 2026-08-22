import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled, isBdsPolicyEnabled } from '../bds.flags';

@Injectable()
export class BdsPolicyGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsPolicyEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
