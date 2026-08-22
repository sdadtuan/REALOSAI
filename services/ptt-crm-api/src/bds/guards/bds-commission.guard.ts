import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsCommissionEnabled, isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsCommissionGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsCommissionEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
