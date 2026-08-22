import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsCollectionEnabled, isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsCollectionGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled() || !isBdsCollectionEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
