import { nextPostNode, POST_DAG_NODES } from './vd-dag';

describe('vd-dag', () => {
  it('starts at select_takes', () => {
    expect(nextPostNode([])).toBe('select_takes');
  });

  it('walks all six nodes in order', () => {
    const order: string[] = [];
    let node = nextPostNode(order);
    while (node !== 'complete') {
      order.push(node);
      node = nextPostNode(order);
    }
    expect(order).toEqual([...POST_DAG_NODES]);
  });

  it('after concat returns loudness not package_zip', () => {
    expect(nextPostNode(['select_takes', 'concat'])).toBe('loudness');
    expect(nextPostNode(['select_takes', 'concat', 'loudness', 'proxy', 'optional_topaz'])).toBe(
      'package_zip',
    );
  });

  it('rejects unknown done nodes', () => {
    expect(() => nextPostNode(['select_takes', 'bogus'])).toThrow(/dag_invalid/);
  });
});
