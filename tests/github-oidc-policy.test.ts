import { describe, expect, it } from 'vitest';
import {
  assertGithubCanaryClaims,
  CANARY_OIDC_AUDIENCE,
  CANARY_REPOSITORY,
  CANARY_REPOSITORY_ID,
  CANARY_WORKFLOW_REF,
  GITHUB_OIDC_ISSUER,
  type GithubOidcClaims,
} from '../src/lib/github-oidc-policy';

const now = 1_800_000_000;
const valid: GithubOidcClaims = {
  iss: GITHUB_OIDC_ISSUER,
  aud: CANARY_OIDC_AUDIENCE,
  iat: now - 30,
  nbf: now - 30,
  exp: now + 300,
  repository: CANARY_REPOSITORY,
  repository_id: CANARY_REPOSITORY_ID,
  ref: 'refs/heads/main',
  workflow_ref: CANARY_WORKFLOW_REF,
  event_name: 'workflow_dispatch',
};

describe('GitHub canary OIDC policy', () => {
  it('accepts only the production canary workflow on main', () => {
    expect(() => assertGithubCanaryClaims(valid, now)).not.toThrow();
    expect(() => assertGithubCanaryClaims({ ...valid, event_name: 'schedule' }, now)).not.toThrow();
  });

  it('rejects another audience, repository, workflow, ref, and event', () => {
    for (const claims of [
      { ...valid, aud: 'another-service' },
      { ...valid, repository: 'guylou05/another-repo' },
      { ...valid, repository_id: '123' },
      { ...valid, workflow_ref: `${CANARY_REPOSITORY}/.github/workflows/ci.yml@refs/heads/main` },
      { ...valid, ref: 'refs/heads/feature' },
      { ...valid, event_name: 'pull_request' },
    ]) expect(() => assertGithubCanaryClaims(claims, now)).toThrow();
  });

  it('rejects expired, stale, and not-yet-active tokens', () => {
    expect(() => assertGithubCanaryClaims({ ...valid, exp: now - 31 }, now)).toThrow(/expired/);
    expect(() => assertGithubCanaryClaims({ ...valid, iat: now - 601 }, now)).toThrow(/issue time/);
    expect(() => assertGithubCanaryClaims({ ...valid, nbf: now + 31 }, now)).toThrow(/not active/);
  });
});
