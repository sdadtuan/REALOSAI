export interface PttCapacitorBridge {
  native: boolean;
  platform: string;
  version: string;
  appVersion: string;
}

declare global {
  interface Window {
    __PTT_CAPACITOR__?: PttCapacitorBridge;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__PTT_CAPACITOR__?.native) return true;
  const cap = window.Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function capacitorClientHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (!isCapacitorNative()) return headers;
  const bridge = window.__PTT_CAPACITOR__;
  headers['X-PTT-Client'] = `capacitor-portal/${bridge?.version ?? '1.0'}`;
  const appVersion = bridge?.appVersion;
  if (appVersion) {
    headers['X-PTT-App-Version'] = appVersion;
  }
  return headers;
}
