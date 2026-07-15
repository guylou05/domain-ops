export const CANARY_NAME: string;
export const DEFAULT_CANARY_EMAIL: string;
export const DEFAULT_CANARY_WORKSPACE_SLUG: string;

export type CanaryIdentity = {
  email: string;
  password: string;
  workspaceSlug: string;
};

export function readCanaryIdentity(env?: Record<string, string | undefined>): CanaryIdentity;
export function assertCanaryAccountBoundary(
  account: {
    name: string | null;
    accounts: Array<{ id: string }>;
    memberships: Array<{ workspaceId: string; role?: string }>;
  } | null,
  workspaceId: string,
): void;

export class CookieJar {
  absorb(headers: { getSetCookie?: () => string[]; get(name: string): string | null }): void;
  header(): string;
  hasSession(): boolean;
}

export function assertSafeCallback(callbackUrl: string, baseUrl: string): void;
export function assertCanaryPage(path: string, status: number, body: string, marker: string): void;
export function assertStrictContentSecurityPolicy(
  path: string,
  headers: { get(name: string): string | null },
): void;
