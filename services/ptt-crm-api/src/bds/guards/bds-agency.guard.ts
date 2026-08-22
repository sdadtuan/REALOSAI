import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsAgencyEnabled, isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsAgencyGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsAgencyEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
