import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdProjectRepository } from '../project/vd-project.repository';
import {
  VdBibleRepository,
  type VdCharacterBibleItem,
  type VdStyleBibleBody,
} from './vd-bible.repository';

const LOCK_TOKEN = /\{\{lock:([^}]+)\}\}/g;

export function mergeLockRegions(characters: VdCharacterBibleItem[]): string[] {
  const out = new Set<string>();
  for (const item of characters) {
    for (const region of item.lock_regions) {
      const trimmed = region.trim();
      if (trimmed) out.add(trimmed);
    }
  }
  return [...out];
}

export function composePrompt(
  shotAction: string,
  bible: { lock_regions: string[] },
): string {
  const locked = new Set(bible.lock_regions.map((r) => r.trim()).filter(Boolean));
  return shotAction.replace(LOCK_TOKEN, (match, region: string) => {
    return locked.has(String(region).trim()) ? match : '';
  });
}

function parseStyleBody(body: Record<string, unknown>): VdStyleBibleBody {
  const paletteRaw = body.palette;
  const palette =
    typeof paletteRaw === 'string'
      ? paletteRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(paletteRaw)
        ? paletteRaw.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
        : [];
  const refsRaw = body.refs;
  const refs =
    typeof refsRaw === 'string'
      ? refsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(refsRaw)
        ? refsRaw.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
        : [];
  return {
    palette,
    lens: typeof body.lens === 'string' ? body.lens.trim() : '',
    lighting: typeof body.lighting === 'string' ? body.lighting.trim() : '',
    refs,
  };
}

function parseCharactersBody(body: Record<string, unknown>): { items: VdCharacterBibleItem[] } {
  const itemsRaw = body.items;
  if (!Array.isArray(itemsRaw)) {
    throw new Error('invalid_body');
  }
  const items: VdCharacterBibleItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const lockRaw = row.lock_regions;
    const lock_regions =
      typeof lockRaw === 'string'
        ? lockRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : Array.isArray(lockRaw)
          ? lockRaw.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
          : [];
    items.push({
      name,
      lock_regions,
      notes: typeof row.notes === 'string' ? row.notes.trim() : '',
    });
  }
  return { items };
}

@Injectable()
export class VdBibleService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly bibles: VdBibleRepository,
  ) {}

  private async requireProject(id: number) {
    const row = await this.projects.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  async getStyle(projectId: number) {
    await this.requireProject(projectId);
    const body_json = await this.bibles.getStyle(projectId);
    return { project_id: projectId, body_json };
  }

  async saveStyle(projectId: number, body: Record<string, unknown>) {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    await this.requireProject(projectId);
    const body_json = await this.bibles.upsertStyle(projectId, parseStyleBody(body));
    return { project_id: projectId, body_json };
  }

  async getCharacters(projectId: number) {
    await this.requireProject(projectId);
    const body_json = await this.bibles.getCharacters(projectId);
    return { project_id: projectId, body_json };
  }

  async saveCharacters(projectId: number, body: Record<string, unknown>) {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    await this.requireProject(projectId);
    const body_json = await this.bibles.upsertCharacters(projectId, parseCharactersBody(body));
    return { project_id: projectId, body_json };
  }

  async lockRegionsForProject(projectId: number): Promise<string[]> {
    const chars = await this.bibles.getCharacters(projectId);
    return mergeLockRegions(chars.items);
  }
}
