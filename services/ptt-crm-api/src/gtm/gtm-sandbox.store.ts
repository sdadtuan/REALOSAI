export type SandboxAccount = {
  username: string;
  password: string;
  tenant: string;
  email: string;
  disabled: boolean;
  expires_at: string;
};

export interface GtmSandboxStore {
  create(account: SandboxAccount): void;
  disable(username: string): boolean;
  isDisabled(username: string): boolean;
  get(username: string): SandboxAccount | undefined;
}

export class InMemoryGtmSandboxStore implements GtmSandboxStore {
  private readonly accounts = new Map<string, SandboxAccount>();

  create(account: SandboxAccount): void {
    this.accounts.set(account.username, account);
  }

  disable(username: string): boolean {
    const acc = this.accounts.get(username);
    if (!acc) return false;
    acc.disabled = true;
    return true;
  }

  isDisabled(username: string): boolean {
    return this.accounts.get(username)?.disabled ?? false;
  }

  get(username: string): SandboxAccount | undefined {
    return this.accounts.get(username);
  }
}

export const GTM_SANDBOX_STORE = Symbol('GTM_SANDBOX_STORE');
