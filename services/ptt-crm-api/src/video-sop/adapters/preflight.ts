import type { CanonicalRequest } from './i-provider';
import { ProviderError } from './provider-error';

function throwUnsupported(): never {
  throw new ProviderError('capability', 'E_CAPABILITY_UNSUPPORTED');
}

export function assertSupported(
  req: CanonicalRequest,
  capability_json: Record<string, unknown>,
): void {
  if (req.capability !== capability_json.capability) {
    throwUnsupported();
  }

  const constraints = capability_json.constraints as Record<string, unknown> | undefined;
  if (!constraints) {
    return;
  }

  const durationSec = constraints.duration_sec as { min?: number; max?: number } | undefined;
  if (durationSec && typeof req.params.duration_sec === 'number') {
    const value = req.params.duration_sec;
    if (durationSec.min !== undefined && value < durationSec.min) {
      throwUnsupported();
    }
    if (durationSec.max !== undefined && value > durationSec.max) {
      throwUnsupported();
    }
  }

  const promptMaxChars = constraints.prompt_max_chars;
  if (typeof promptMaxChars === 'number' && typeof req.params.prompt === 'string') {
    if (req.params.prompt.length > promptMaxChars) {
      throwUnsupported();
    }
  }

  const unsupported = constraints.unsupported;
  if (Array.isArray(unsupported)) {
    for (const key of Object.keys(req.params)) {
      if (unsupported.includes(key)) {
        throwUnsupported();
      }
    }
  }
}
