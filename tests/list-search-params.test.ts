import { describe, expect, it } from 'vitest';
import { hasActiveParams, readParam } from '../src/lib/list-search-params';

describe('list search params', () => {
  it('reads scalar and array values with fallbacks', () => {
    expect(readParam({ sort: ['score', 'domain'] }, 'sort')).toBe('score');
    expect(readParam({}, 'sort', 'score')).toBe('score');
  });

  it('treats empty and all values as inactive filters', () => {
    expect(hasActiveParams({ search: '', risk: 'all' }, ['search', 'risk'])).toBe(false);
    expect(hasActiveParams({ search: 'agent' }, ['search', 'risk'])).toBe(true);
  });
});
