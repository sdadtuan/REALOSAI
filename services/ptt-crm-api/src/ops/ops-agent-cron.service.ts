import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OpsAgentScanService } from './ops-agent.scan.service';

const TICK_MS = 15 * 60 * 1000;

@Injectable()
export class OpsAgentCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpsAgentCronService.name);
  private timer?: NodeJS.Timeout;
  private lastRunDateKey = '';

  constructor(
    private readonly config: AppConfigService,
    private readonly scan: OpsAgentScanService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  isEnabled(): boolean {
    return this.config.opsDvEnabled && this.config.opsAgentEnabled;
  }

  agentStatus() {
    return {
      ok: true,
      enabled: this.isEnabled(),
      ops_dv_enabled: this.config.opsDvEnabled,
      ops_agent_enabled: this.config.opsAgentEnabled,
      cron: '0 8 * * *',
      timezone: 'Asia/Ho_Chi_Minh',
      last_run_date: this.lastRunDateKey || null,
    };
  }

  async runScan(opts: { dryRun?: boolean } = {}) {
    const result = await this.scan.runScan(opts);
    if (result.ok && !opts.dryRun) {
      this.lastRunDateKey = this.vnDateKey();
    }
    return result;
  }

  private vnDateKey(date = new Date()): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }

  private vnHour(date = new Date()): number {
    return Number(
      date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }),
    );
  }

  async tick(): Promise<void> {
    if (!this.isEnabled()) return;
    const dateKey = this.vnDateKey();
    if (this.lastRunDateKey === dateKey) return;
    if (this.vnHour() !== 8) return;
    try {
      const result = await this.runScan();
      this.logger.log(`Ops agent daily scan: scanned=${result.scanned} created=${result.created}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Ops agent daily scan failed: ${message}`);
    }
  }
}
