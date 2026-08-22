export type CmktDiffLineType = 'add' | 'del' | 'same';

export type CmktDiffLine = {
  type: CmktDiffLineType;
  text: string;
};

/** Line-based markdown diff for version compare (M8). */
export function diffMarkdownLines(before: string, after: string): { lines: CmktDiffLine[] } {
  const a = splitLines(before);
  const b = splitLines(after);
  const lcs = buildLcsTable(a, b);
  const ops = backtrackLcs(a, b, lcs);
  const lines: CmktDiffLine[] = [];
  for (const op of ops) {
    if (op.type === 'same') lines.push({ type: 'same', text: op.text });
    else if (op.type === 'del') lines.push({ type: 'del', text: op.text });
    else lines.push({ type: 'add', text: op.text });
  }
  return { lines };
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split('\n');
}

type LcsOp = { type: 'same' | 'add' | 'del'; text: string };

function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function backtrackLcs(a: string[], b: string[], dp: number[][]): LcsOp[] {
  const ops: LcsOp[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'same', text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', text: b[j - 1] });
      j -= 1;
    } else {
      ops.push({ type: 'del', text: a[i - 1] });
      i -= 1;
    }
  }
  ops.reverse();
  return ops;
}
