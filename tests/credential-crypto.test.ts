import { describe, expect, it } from 'vitest';
import { CredentialEncryptionError, decryptCredential, encryptCredential } from '../src/lib/credential-crypto';

describe('provider credential encryption', () => {
  const masterKey = 'test-encryption-key-with-at-least-32-characters';
  const context = 'domainscout:workspace-1:registrar';

  it('round-trips credentials without storing plaintext', () => {
    const encrypted = encryptCredential('provider-secret-value', masterKey, context);
    expect(encrypted).not.toContain('provider-secret-value');
    expect(decryptCredential(encrypted, masterKey, context)).toBe('provider-secret-value');
  });

  it('uses a unique nonce for each encrypted payload', () => {
    const first = encryptCredential('same-secret', masterKey, context);
    const second = encryptCredential('same-secret', masterKey, context);
    expect(first).not.toBe(second);
  });

  it('rejects a credential copied into another workspace or provider', () => {
    const encrypted = encryptCredential('provider-secret-value', masterKey, context);
    expect(() => decryptCredential(encrypted, masterKey, 'domainscout:workspace-2:registrar')).toThrow(CredentialEncryptionError);
  });

  it('requires a sufficiently strong application encryption key', () => {
    expect(() => encryptCredential('provider-secret-value', 'too-short', context)).toThrow(CredentialEncryptionError);
  });
});
