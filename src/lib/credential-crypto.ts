import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export class CredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialEncryptionError';
  }
}

function deriveKey(masterKey: string): Buffer {
  if (masterKey.length < 32) throw new CredentialEncryptionError('ENCRYPTION_KEY must contain at least 32 characters.');
  return createHash('sha256').update(masterKey, 'utf8').digest();
}

export function encryptCredential(secret: string, masterKey: string, context: string): string {
  if (!secret) throw new CredentialEncryptionError('Credential secret cannot be empty.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(masterKey), iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptCredential(payload: string, masterKey: string, context: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split('.');
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) throw new CredentialEncryptionError('Credential payload is invalid or unsupported.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(masterKey), Buffer.from(ivValue, 'base64url'));
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof CredentialEncryptionError) throw error;
    throw new CredentialEncryptionError('Credential could not be decrypted with the configured key and context.');
  }
}
