import { describe, expect, it } from 'vitest';
import { selectWorkspaceMembership } from '../src/lib/workspace-selection';

const memberships = [
  { workspaceId: 'workspace-one', workspace: { slug: 'one' }, role: 'OWNER' },
  { workspaceId: 'workspace-two', workspace: { slug: 'two' }, role: 'VIEWER' },
];

describe('workspace selection', () => {
  it('prefers an authorized workspace ID from the cookie', () => {
    expect(selectWorkspaceMembership(memberships, 'workspace-two', 'one')?.workspaceId).toBe('workspace-two');
  });

  it('ignores unauthorized cookie values and uses an authorized slug fallback', () => {
    expect(selectWorkspaceMembership(memberships, 'workspace-outside', 'two')?.workspaceId).toBe('workspace-two');
  });

  it('falls back deterministically and handles users without memberships', () => {
    expect(selectWorkspaceMembership(memberships, 'workspace-outside', 'outside')?.workspaceId).toBe('workspace-one');
    expect(selectWorkspaceMembership([], 'workspace-one', 'one')).toBeNull();
  });
});
