import { BadRequestException, Injectable } from '@nestjs/common';
import { StaffOrgService } from '../../staff-org/staff-org.service';
import { missingRequiredPositions } from './bds-org-seed';

export type BdsG0Status = {
  assigned_position_codes: string[];
  missing_position_codes: string[];
  ready: boolean;
};

export function requiredRolesError(missing: string[]): { error: 'required_roles'; missing: string[] } {
  return { error: 'required_roles', missing };
}

@Injectable()
export class BdsOrgG0Service {
  constructor(private readonly org: StaffOrgService) {}

  async getG0Status(): Promise<BdsG0Status> {
    const users = await this.org.listUsers({ includeInactive: false });
    const assigned = [
      ...new Set(
        users
          .map((u) => String(u.position_code ?? '').trim())
          .filter((code) => code.length > 0),
      ),
    ];
    const missing = missingRequiredPositions(assigned);
    return {
      assigned_position_codes: assigned,
      missing_position_codes: missing,
      ready: missing.length === 0,
    };
  }

  async assertG0Ready(): Promise<void> {
    const status = await this.getG0Status();
    if (!status.ready) {
      throw new BadRequestException(requiredRolesError(status.missing_position_codes));
    }
  }
}
