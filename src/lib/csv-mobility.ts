import Papa from 'papaparse';

export type ImportReviewRow = {
  row: number;
  domain: string;
  status: 'VALID' | 'DUPLICATE' | 'ERROR';
  message: string;
};

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
}

export function reviewDomainCsv(csv: string, existingDomains: Iterable<string>): ImportReviewRow[] {
  if (new TextEncoder().encode(csv).length > 2_000_000) throw new Error('CSV files must be 2 MB or smaller.');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', transformHeader: (header: string) => header.trim().toLowerCase() });
  if (parsed.data.length > 2000) throw new Error('CSV files may contain at most 2,000 data rows.');
  const existing = new Set([...existingDomains].map((domain) => domain.toLowerCase()));
  const seen = new Set<string>();
  const rows: ImportReviewRow[] = parsed.data.map((record, index): ImportReviewRow => {
    const raw = record.domain ?? record.name ?? Object.values(record)[0] ?? '';
    const domain = normalizeDomain(String(raw));
    if (/^[=+\-@]/.test(String(raw).trim())) return { row: index + 2, domain, status: 'ERROR', message: 'Spreadsheet formula input is not allowed.' };
    if (!/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})+$/.test(domain)) return { row: index + 2, domain, status: 'ERROR', message: 'Invalid domain format.' };
    if (existing.has(domain) || seen.has(domain)) return { row: index + 2, domain, status: 'DUPLICATE', message: existing.has(domain) ? 'Already exists in this workspace.' : 'Duplicate row in this file.' };
    seen.add(domain);
    return { row: index + 2, domain, status: 'VALID', message: 'Ready to import.' };
  });
  return rows.concat(parsed.errors.map((error) => ({ row: (error.row ?? 0) + 2, domain: '', status: 'ERROR' as const, message: error.message })));
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}
