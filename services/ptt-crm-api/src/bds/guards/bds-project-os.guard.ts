import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled, isBdsProjectOsEnabled } from '../bds.flags';

@Injectable()
export class BdsProjectOsGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsProjectOsEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
