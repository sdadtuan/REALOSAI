import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import type { OpsRouteMap } from './ops.types';

export function resolveOpsRouteMapPath(configPath: string): string {
  const candidates = [
    configPath,
    path.join(process.cwd(), 'docs/specs/ops-dv01-dv21-route-map.json'),
    path.join(process.cwd(), '../../docs/specs/ops-dv01-dv21-route-map.json'),
    path.join(__dirname, '../../../../docs/specs/ops-dv01-dv21-route-map.json'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`ops_route_map_not_found: tried ${candidates.join(', ')}`);
}

export function loadOpsRouteMap(filePath: string): OpsRouteMap {
  const raw = fs.readFileSync(filePath, 'utf8');
  const map = JSON.parse(raw) as OpsRouteMap;
  if (!map.services?.length) {
    throw new Error('ops_route_map_invalid: missing services[]');
  }
  if (map.services.length !== 21) {
    throw new Error(`ops_route_map_invalid: expected 21 services, got ${map.services.length}`);
  }
  return map;
}

@Injectable()
export class OpsRouteMapLoader {
  private map: OpsRouteMap | null = null;
  private loadedPath = '';

  constructor(private readonly config: AppConfigService) {}

  getMap(): OpsRouteMap {
    if (!this.map) {
      this.loadedPath = resolveOpsRouteMapPath(this.config.opsRouteMapPath);
      this.map = loadOpsRouteMap(this.loadedPath);
    }
    return this.map;
  }

  getLoadedPath(): string {
    if (!this.map) this.getMap();
    return this.loadedPath;
  }

  isLoaded(): boolean {
    return this.map != null;
  }
}
