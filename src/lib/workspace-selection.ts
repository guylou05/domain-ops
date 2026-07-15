export const WORKSPACE_COOKIE_NAME = 'domainops-workspace';

export type WorkspaceSelectionCandidate = {
  workspaceId: string;
  workspace: { slug: string };
};

export function selectWorkspaceMembership<T extends WorkspaceSelectionCandidate>(
  memberships: T[],
  preferredWorkspaceId?: string,
  preferredWorkspaceSlug?: string,
): T | null {
  if (preferredWorkspaceId) {
    const selected = memberships.find((membership) => membership.workspaceId === preferredWorkspaceId);
    if (selected) return selected;
  }
  if (preferredWorkspaceSlug) {
    const selected = memberships.find((membership) => membership.workspace.slug === preferredWorkspaceSlug);
    if (selected) return selected;
  }
  return memberships[0] ?? null;
}
