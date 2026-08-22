import {
  buildOpenAiResponseBody,
  mapOpenAiHttpError,
  OpenAITextGen,
} from './openai.text';
import { ProviderError } from './provider-error';
import {
  assertVideoScriptSchema,
  VIDEO_SCRIPT_SCHEMA,
} from './video-script.schema';

describe('buildOpenAiResponseBody', () => {
  it('sets store true when background true', () => {
    const body = buildOpenAiResponseBody({
      prompt: 'x',
      model: 'gpt-5.6',
      schema: VIDEO_SCRIPT_SCHEMA,
    });
    expect(body.background).toBe(true);
    expect(body.store).toBe(true);
  });

  it('includes strict json_schema video_script format', () => {
    const body = buildOpenAiResponseBody({
      prompt: 'x',
      model: 'gpt-5.6',
      schema: VIDEO_SCRIPT_SCHEMA,
    });
    expect(body.text?.format).toEqual(
      expect.objectContaining({
        type: 'json_schema',
        strict: true,
        name: 'video_script',
      }),
    );
  });
});

describe('assertVideoScriptSchema', () => {
  it('throws capability when additionalProperties is not false', () => {
    expect(() =>
      assertVideoScriptSchema({
        type: 'object',
        additionalProperties: true,
        properties: {},
      }),
    ).toThrow(ProviderError);
  });
});

describe('mapOpenAiHttpError', () => {
  it('maps 401 to auth', () => {
    expect(mapOpenAiHttpError(401)).toMatchObject({ error_class: 'auth' });
  });

  it('maps 429 insufficient_quota to budget', () => {
    expect(mapOpenAiHttpError(429, 'insufficient_quota')).toMatchObject({ error_class: 'budget' });
  });

  it('maps 429 with retry-after to rate_limit', () => {
    expect(mapOpenAiHttpError(429, undefined, 30)).toMatchObject({
      error_class: 'rate_limit',
      retryAfterSec: 30,
    });
  });

  it('maps 503 to transient', () => {
    expect(mapOpenAiHttpError(503)).toMatchObject({ error_class: 'transient' });
  });
});

describe('OpenAITextGen.complete', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses chat completions for ideas mode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ideas":[{"summary":"a"},{"summary":"b"},{"summary":"c"}]}' } }],
      }),
    } as Response);

    const gen = new OpenAITextGen('key');
    const result = await gen.complete({ system: 'ideas', user: 'ideas', mode: 'ideas' });
    expect(result).toEqual({
      ideas: [{ summary: 'a' }, { summary: 'b' }, { summary: 'c' }],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object),
    );
  });

  it('uses responses API for video_script mode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'T',
                  total_duration_sec: 30,
                  hook_line: 'H',
                  cta_line: 'C',
                  shots: [
                    {
                      shot_no: 1,
                      duration_sec: 5,
                      scene_desc: 's',
                      camera: 'static',
                      shot_size: 'wide',
                      image_prompt: 'ip',
                      motion_prompt: 'mp',
                      negative_prompt: 'np',
                      vo_script: 'vo',
                      onscreen_text: 'txt',
                      risk_flags: [],
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    } as Response);

    const gen = new OpenAITextGen('key', 'gpt-5.6');
    const result = await gen.complete({
      system: 'director',
      user: 'write script',
      mode: 'video_script',
    });
    expect((result as { title: string }).title).toBe('T');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.any(Object),
    );
  });
});
