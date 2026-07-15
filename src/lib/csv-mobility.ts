import Papa from 'papaparse';

export type ImportReviewRow = {
  row: number;
  domain: string;
  status: 'VALID' | 'DUPLICATE' | 'ERROR';
  message: string;
};

export type ComparableSaleReviewRow = {
  row: number;
  subjectDomain: string;
  domain: string;
  price: number;
  saleDate: string;
  marketplace: string;
  industry: string;
  evidenceUrl: string;
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

export function reviewComparableSalesCsv(csv: string, existingKeys: Iterable<string>): ComparableSaleReviewRow[] {
  if (new TextEncoder().encode(csv).length > 2_000_000) throw new Error('CSV files must be 2 MB or smaller.');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', transformHeader: (header: string) => header.trim().toLowerCase() });
  if (parsed.data.length > 2000) throw new Error('CSV files may contain at most 2,000 data rows.');
  const existing = new Set(existingKeys);
  const seen = new Set<string>();
  const rows = parsed.data.map((record, index): ComparableSaleReviewRow => {
    const subjectDomain = normalizeDomain(record.subject_domain ?? record.subjectdomain ?? '');
    const domain = normalizeDomain(record.domain ?? '');
    const price = Number(record.price);
    const saleDate = record.sale_date ?? record.saledate ?? '';
    const marketplace = String(record.marketplace ?? '').trim().slice(0, 120);
    const industry = String(record.industry ?? '').trim().slice(0, 120);
    const evidenceUrl = String(record.evidence_url ?? '').trim().slice(0, 500);
    const values = [record.subject_domain, record.subjectdomain, record.domain, record.marketplace, record.industry, record.evidence_url].filter((item): item is string => typeof item === 'string');
    if (values.some((item) => /^[=+\-@]/.test(item.trim()))) return { row: index + 2, subjectDomain, domain, price, saleDate, marketplace, industry, evidenceUrl, status: 'ERROR', message: 'Spreadsheet formula input is not allowed.' };
    if (!/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})+$/.test(subjectDomain) || !/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})+$/.test(domain)) return { row: index + 2, subjectDomain, domain, price, saleDate, marketplace, industry, evidenceUrl, status: 'ERROR', message: 'Subject and comparable domains must be valid.' };
    if (!Number.isFinite(price) || price <= 0 || Number.isNaN(Date.parse(saleDate)) || !marketplace) return { row: index + 2, subjectDomain, domain, price, saleDate, marketplace, industry, evidenceUrl, status: 'ERROR', message: 'Price, sale date, and marketplace are required.' };
    if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) return { row: index + 2, subjectDomain, domain, price, saleDate, marketplace, industry, evidenceUrl, status: 'ERROR', message: 'Evidence URL must use HTTPS.' };
    const key = `${subjectDomain}|${domain}|${price}|${new Date(saleDate).toISOString()}`;
    if (existing.has(key) || seen.has(key)) return { row: index + 2, subjectDomain, domain, price, saleDate, marketplace, industry, evidenceUrl, status: 'DUPLICATE', message: existing.has(key) ? 'Already exists in this workspace.' : 'Duplicate row in this file.' };
    seen.add(key);
    return { row: index + 2, subjectDomain, domain, price, saleDate, marketplace, industry, evidenceUrl, status: 'VALID', message: 'Ready to import.' };
  });
  return rows.concat(parsed.errors.map((error) => ({ row: (error.row ?? 0) + 2, subjectDomain: '', domain: '', price: 0, saleDate: '', marketplace: '', industry: '', evidenceUrl: '', status: 'ERROR' as const, message: error.message })));
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}
