import { selectImageGen } from './i-image-gen';

describe('selectImageGen', () => {
  it('selects flux when leonardo key missing and replicate token set', () => {
    expect(selectImageGen({ PTT_VD_LEONARDO_API_KEY: '', REPLICATE_API_TOKEN: 'r' }).providerName).toBe('flux');
  });

  it('throws auth when both keys missing', () => {
    expect(() => selectImageGen({ PTT_VD_LEONARDO_API_KEY: '', REPLICATE_API_TOKEN: '' })).toThrow(/auth/);
  });
});
