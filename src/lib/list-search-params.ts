export type SearchParams = Record<string, string | string[] | undefined>;

export function readParam(params: SearchParams, key: string, fallback = ''): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function hasActiveParams(params: SearchParams, keys: string[]): boolean {
  return keys.some((key) => {
    const value = readParam(params, key);
    return value !== '' && value !== 'all';
  });
}
