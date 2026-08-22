import { EDIT_WINDOW_MS, RESTRICTED_DEPT_CODES } from './staff-chat.types';

export { EDIT_WINDOW_MS };

export function canEditMessage(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= EDIT_WINDOW_MS;
}

export function isRestrictedCode(code: string): boolean {
  return (RESTRICTED_DEPT_CODES as readonly string[]).includes(code);
}

export function launchHuddleCode(launchId: string): string {
  return `launch_${String(launchId).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
