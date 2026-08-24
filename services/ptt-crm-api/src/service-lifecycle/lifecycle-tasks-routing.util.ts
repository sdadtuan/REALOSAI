import { AppConfigService } from '../config/app-config.service';

/** PG tasks repo when lifecycle PG flag is on or prod sqlite-off (W4 P0). */
export function useLifecycleTasksPg(config: AppConfigService): boolean {
  return config.crmServiceLifecyclePg || config.sqliteDisabled;
}
