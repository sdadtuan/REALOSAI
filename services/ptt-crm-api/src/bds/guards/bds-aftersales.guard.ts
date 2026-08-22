import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsAftersalesEnabled, isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsAftersalesGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsAftersalesEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
