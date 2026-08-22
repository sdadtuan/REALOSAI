import { compareLatestWaves, waveDelta } from './wave-compare.util';

describe('waveDelta', () => {
  it('waveDelta(10, 13) === 3', () => {
    expect(waveDelta(10, 13)).toBe(3);
  });

  it('waveDelta(null, 1) === null', () => {
    expect(waveDelta(null, 1)).toBeNull();
  });
});

describe('compareLatestWaves', () => {
  it('deltas the same keys on the two latest waves', () => {
    expect(
      compareLatestWaves([
        { wave_no: 1, metric_json: [{ key: 'nps', value: 10 }] },
        { wave_no: 2, metric_json: [{ key: 'nps', value: 13 }] },
      ]),
    ).toEqual([{ key: 'nps', prev: 10, curr: 13, delta: 3 }]);
  });
});
