function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
}

export function parseDomainLines(input: string): string[] {
  return [...new Set(input.split(/[\n,;\t ]+/).map(normalizeDomain).filter((domain) => /^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})+$/.test(domain)))];
}
