import { ProviderError } from './provider-error';

export const VIDEO_SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'total_duration_sec',
    'hook_line',
    'cta_line',
    'shots',
  ],
  properties: {
    title: { type: 'string' },
    total_duration_sec: { type: 'number' },
    hook_line: { type: 'string' },
    cta_line: { type: 'string' },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'shot_no',
          'duration_sec',
          'scene_desc',
          'camera',
          'shot_size',
          'image_prompt',
          'motion_prompt',
          'negative_prompt',
          'vo_script',
          'onscreen_text',
          'risk_flags',
        ],
        properties: {
          shot_no: { type: 'integer' },
          duration_sec: { type: 'number' },
          scene_desc: { type: 'string' },
          camera: { type: 'string' },
          shot_size: { type: 'string' },
          image_prompt: { type: 'string' },
          motion_prompt: { type: 'string' },
          negative_prompt: { type: 'string' },
          vo_script: { type: 'string' },
          onscreen_text: { type: 'string' },
          risk_flags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export type VideoScriptShot = {
  shot_no: number;
  duration_sec: number;
  scene_desc: string;
  camera: string;
  shot_size: string;
  image_prompt: string;
  motion_prompt: string;
  negative_prompt: string;
  vo_script: string;
  onscreen_text: string;
  risk_flags: string[];
};

export type VideoScript = {
  title: string;
  total_duration_sec: number;
  hook_line: string;
  cta_line: string;
  shots: VideoScriptShot[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function assertVideoScriptSchema(schema: Record<string, unknown>): void {
  if (schema.additionalProperties !== false) {
    throw new ProviderError('capability', 'E_SCHEMA_ADDITIONAL_PROPERTIES');
  }
  const shots = schema.properties as Record<string, unknown> | undefined;
  const shotItems = (shots?.shots as Record<string, unknown> | undefined)?.items as
    | Record<string, unknown>
    | undefined;
  if (!isObject(shotItems) || shotItems.additionalProperties !== false) {
    throw new ProviderError('capability', 'E_SCHEMA_SHOT_ADDITIONAL_PROPERTIES');
  }
}

export function parseVideoScript(result: unknown): VideoScript {
  if (!isObject(result)) {
    throw Object.assign(new Error('validation'), { error_class: 'validation' });
  }
  const title = result.title;
  const total = result.total_duration_sec;
  const hook = result.hook_line;
  const cta = result.cta_line;
  const shotsRaw = result.shots;
  if (
    typeof title !== 'string' ||
    typeof hook !== 'string' ||
    typeof cta !== 'string' ||
    typeof total !== 'number' ||
    !Array.isArray(shotsRaw) ||
    shotsRaw.length === 0
  ) {
    throw Object.assign(new Error('validation'), { error_class: 'validation' });
  }
  const shots = shotsRaw.map((item, index) => {
    if (!isObject(item)) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    const shotNo = item.shot_no;
    const duration = item.duration_sec;
    if (typeof shotNo !== 'number' || typeof duration !== 'number') {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    const strings = [
      'scene_desc',
      'camera',
      'shot_size',
      'image_prompt',
      'motion_prompt',
      'negative_prompt',
      'vo_script',
      'onscreen_text',
    ] as const;
    for (const key of strings) {
      if (typeof item[key] !== 'string') {
        throw Object.assign(new Error('validation'), { error_class: 'validation' });
      }
    }
    const riskFlags = item.risk_flags;
    if (!Array.isArray(riskFlags) || !riskFlags.every((flag) => typeof flag === 'string')) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    return {
      shot_no: shotNo,
      duration_sec: duration,
      scene_desc: item.scene_desc as string,
      camera: item.camera as string,
      shot_size: item.shot_size as string,
      image_prompt: item.image_prompt as string,
      motion_prompt: item.motion_prompt as string,
      negative_prompt: item.negative_prompt as string,
      vo_script: item.vo_script as string,
      onscreen_text: item.onscreen_text as string,
      risk_flags: riskFlags,
    };
  });
  return {
    title,
    total_duration_sec: total,
    hook_line: hook,
    cta_line: cta,
    shots,
  };
}
