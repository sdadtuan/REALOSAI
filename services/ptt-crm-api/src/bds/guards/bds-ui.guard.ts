import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled, isBdsUiEnabled } from '../bds.flags';

@Injectable()
export class BdsUiGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsUiEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
