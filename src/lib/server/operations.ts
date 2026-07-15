import { getAppConfig } from './app-config';
import { getOperationalDashboard } from './observability';
import { resolveProviderCredential } from './provider-credentials';
import { requireWorkspaceContext } from './workspace-context';

export async function getOperationsView() {
  const context = await requireWorkspaceContext();
  const [dashboard, config, emailKey] = await Promise.all([
    getOperationalDashboard(context.workspaceId),
    getAppConfig(),
    resolveProviderCredential(context.workspaceId, 'transactional_email'),
  ]);
  return {
    ...dashboard,
    canManage: context.role === 'OWNER' || context.role === 'ADMIN',
    observability: config.observability,
    alertDeliveryReady: Boolean(config.transactionalEmail.enabled && config.transactionalEmail.sender && emailKey),
  };
}
