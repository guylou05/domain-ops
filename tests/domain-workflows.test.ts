import { describe, expect, it } from 'vitest';
import { parseDomainLines } from '../src/lib/domain-parsing';

describe('domain workflow parsing', () => {
  it('normalizes urls, whitespace, duplicates, and invalid rows', () => {
    expect(
      parseDomainLines('https://www.ExampleAI.com/path, workflowpilot.ai\ninvalid row;agent-loop.io\tworkflowpilot.ai'),
    ).toEqual(['exampleai.com', 'workflowpilot.ai', 'agent-loop.io']);
  });

  it('rejects malformed domains before persistence', () => {
    expect(parseDomainLines('localhost, https://example, bad_domain.com, ok-domain.co')).toEqual(['ok-domain.co']);
  });
});
