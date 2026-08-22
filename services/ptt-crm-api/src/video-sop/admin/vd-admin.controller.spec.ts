import { BadRequestException } from '@nestjs/common';
import { VdAdminController } from './vd-admin.controller';

function makeController() {
  const admin = {
    listProviders: jest.fn(),
    createProvider: jest.fn(),
    listModels: jest.fn(),
    createModel: jest.fn(),
  };
  return { controller: new VdAdminController(admin as never), admin };
}

async function expectSecretNotAllowed(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    throw new Error('expected secret_not_allowed');
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getStatus()).toBe(400);
    expect((err as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ error: 'secret_not_allowed' }),
    );
  }
}

describe('VdAdminController', () => {
  it('rejects POST provider body with api_key as secret_not_allowed', async () => {
    const { controller, admin } = makeController();

    await expectSecretNotAllowed(() =>
      controller.createProvider({ code: 'kling', api_key: 'x' }),
    );

    expect(admin.createProvider).not.toHaveBeenCalled();
  });

  it('rejects nested secret key on POST provider', async () => {
    const { controller, admin } = makeController();

    await expectSecretNotAllowed(() =>
      controller.createProvider({ code: 'kling', label: 'Kling', meta: { secret: 'x' } }),
    );

    expect(admin.createProvider).not.toHaveBeenCalled();
  });

  it('rejects POST model body with api_key as secret_not_allowed', async () => {
    const { controller, admin } = makeController();

    await expectSecretNotAllowed(() =>
      controller.createModel({
        provider_code: 'kling',
        code: 'kling-v1',
        capability_json: { api_key: 'x' },
      }),
    );

    expect(admin.createModel).not.toHaveBeenCalled();
  });

  it('creates provider when body has only code and label', async () => {
    const { controller, admin } = makeController();
    admin.createProvider.mockResolvedValue({ code: 'kling', label: 'Kling' });

    await expect(controller.createProvider({ code: 'kling', label: 'Kling' })).resolves.toEqual({
      code: 'kling',
      label: 'Kling',
    });
    expect(admin.createProvider).toHaveBeenCalledWith({ code: 'kling', label: 'Kling' });
  });
});
