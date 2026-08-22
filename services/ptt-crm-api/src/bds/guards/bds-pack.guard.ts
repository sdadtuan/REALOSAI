import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isBdsPackEnabled } from '../bds.flags';

@Injectable()
export class BdsPackGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBdsPackEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
