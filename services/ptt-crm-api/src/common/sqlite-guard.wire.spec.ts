import * as fs from 'fs';
import * as path from 'path';

describe('zero sqlite runtime inventory', () => {
  const srcRoot = path.join(__dirname, '..');

  function walkTs(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walkTs(full));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  it('has no *-sqlite.repository.ts injectables', () => {
    const repos = walkTs(srcRoot).filter((f) => f.endsWith('-sqlite.repository.ts'));
    expect(repos).toEqual([]);
  });

  it('has no runtime assertSqliteAllowed callers or sqlitePath references', () => {
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      if (file.endsWith(`${path.sep}sqlite-guard.util.ts`)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes('assertSqliteAllowed') || text.includes('sqlitePath')) {
        offenders.push(path.relative(srcRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no runtime node:sqlite imports outside specs and test cores', () => {
    const allowedSuffixes = ['-sqlite-core.ts'];
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      if (allowedSuffixes.some((s) => file.endsWith(s))) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes("from 'node:sqlite'") || text.includes('from "node:sqlite"')) {
        offenders.push(path.relative(srcRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
