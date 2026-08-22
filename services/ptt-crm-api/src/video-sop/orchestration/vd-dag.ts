export const POST_DAG_NODES = [
  'select_takes',
  'concat',
  'loudness',
  'proxy',
  'optional_topaz',
  'package_zip',
] as const;

export type VdPostDagNode = (typeof POST_DAG_NODES)[number];

const NODE_SET = new Set<string>(POST_DAG_NODES);

export function assertValidPostNodes(nodes: string[]): void {
  for (const node of nodes) {
    if (!NODE_SET.has(node)) {
      throw new Error('dag_invalid');
    }
  }
}

export function nextPostNode(done: string[]): VdPostDagNode | 'complete' {
  assertValidPostNodes(done);
  for (const node of POST_DAG_NODES) {
    if (!done.includes(node)) return node;
  }
  return 'complete';
}

export function jobTypeForNode(node: VdPostDagNode): 'cine_compose' | 'cine_enhance' {
  return node === 'optional_topaz' ? 'cine_enhance' : 'cine_compose';
}

export function queueForNode(node: VdPostDagNode): 'q.media' | 'q.enhance' {
  return node === 'optional_topaz' ? 'q.enhance' : 'q.media';
}
