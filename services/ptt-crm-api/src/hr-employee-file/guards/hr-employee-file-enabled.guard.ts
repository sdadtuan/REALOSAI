import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class HrEmployeeFileEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.hrEmployeeFileEnabled) {
      throw new NotFoundException({ error: 'hr_employee_file_disabled' });
    }
    return true;
  }
}
