import type { StorageProvider } from './provider.js';
import { LocalStorageProvider, registerStaticServing } from './local.js';
import { S3StorageProvider } from './s3.js';

const backend = process.env.STORAGE_BACKEND ?? 'local';

function createProvider(): StorageProvider {
  if (backend === 's3') {
    return new S3StorageProvider();
  }
  if (backend === 'local') {
    return new LocalStorageProvider();
  }
  throw new Error(
    `Unknown STORAGE_BACKEND value: "${backend}". Valid values are "local" and "s3".`,
  );
}

export const storageProvider: StorageProvider = createProvider();

export function isLocalStorage(): boolean {
  return backend === 'local';
}

export { registerStaticServing };
export type { StorageProvider };
