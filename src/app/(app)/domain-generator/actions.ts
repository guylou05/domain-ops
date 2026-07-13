'use server';

import { revalidatePath } from 'next/cache';
import { generateAnalyzeAndPersist, importAnalyzeAndPersist, type PersistedOpportunity } from '@/lib/server/domain-workflows';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';

type ActionState = {
  ok: boolean;
  message: string;
  results: PersistedOpportunity[];
};

function readKeywords(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function readTlds(value: FormDataEntryValue | null): string[] {
  const tlds = String(value ?? '.com')
    .split(',')
    .map((tld) => tld.trim())
    .filter(Boolean)
    .map((tld) => (tld.startsWith('.') ? tld : `.${tld}`));
  return tlds.length > 0 ? tlds : ['.com'];
}

function readNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function generateDomainOpportunities(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const context = await requireWorkspaceContext();
    const results = await generateAnalyzeAndPersist(context, {
      concept: String(formData.get('concept') ?? ''),
      industry: String(formData.get('industry') ?? ''),
      keywords: readKeywords(formData.get('keywords')),
      location: String(formData.get('location') ?? '') || undefined,
      tlds: readTlds(formData.get('tlds')),
      maxLength: readNumber(formData.get('maxLength'), 18),
      count: readNumber(formData.get('count'), 20),
    });
    revalidatePath('/opportunities');
    revalidatePath('/overview');
    return { ok: true, message: `Saved ${results.length} generated opportunities.`, results };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to generate opportunities.', results: [] };
  }
}

export async function importDomainOpportunities(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const context = await requireWorkspaceContext();
    const results = await importAnalyzeAndPersist(
      context,
      String(formData.get('domains') ?? ''),
      String(formData.get('industry') ?? 'general'),
    );
    revalidatePath('/opportunities');
    revalidatePath('/overview');
    return { ok: true, message: `Imported and scored ${results.length} opportunities.`, results };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to import opportunities.', results: [] };
  }
}

export const initialActionState: ActionState = { ok: false, message: '', results: [] };
