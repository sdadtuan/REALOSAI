import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsLaunchEnabled, isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsLaunchGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsLaunchEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
