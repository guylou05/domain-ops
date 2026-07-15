import type { PersistedOpportunity } from '@/lib/server/domain-workflows';

export type ActionState = {
  ok: boolean;
  message: string;
  results: PersistedOpportunity[];
};

export const initialActionState: ActionState = { ok: false, message: '', results: [] };
