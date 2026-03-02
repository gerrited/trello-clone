import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    promises: {
      writeFile: vi.fn(),
      unlink: vi.fn(),
    },
  },
}));

import fs from 'node:fs';
import { LocalStorageProvider } from './local.js';

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalStorageProvider();
  });

  describe('upload', () => {
    it('calls fs.mkdirSync with the correct directory and recursive option', async () => {
      const key = 'avatars/user-1.png';
      const buffer = Buffer.from('image data');
      const mimeType = 'image/png';

      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await provider.upload(key, buffer, mimeType);

      const expectedDest = path.resolve(process.cwd(), 'uploads', key);
      const expectedDir = path.dirname(expectedDest);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

    it('calls fs.promises.writeFile with the full path and buffer', async () => {
      const key = 'avatars/user-1.png';
      const buffer = Buffer.from('image data');
      const mimeType = 'image/png';

      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await provider.upload(key, buffer, mimeType);

      const expectedDest = path.resolve(process.cwd(), 'uploads', key);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(expectedDest, buffer);
    });
  });

  describe('delete', () => {
    it('calls fs.promises.unlink with the correct path', async () => {
      const key = 'avatars/user-1.png';

      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

      await provider.delete(key);

      const expectedPath = path.resolve(process.cwd(), 'uploads', key);

      expect(fs.promises.unlink).toHaveBeenCalledWith(expectedPath);
    });

    it('silently swallows errors when unlink rejects', async () => {
      const key = 'avatars/missing.png';

      vi.mocked(fs.promises.unlink).mockRejectedValue(new Error('ENOENT: file not found'));

      await expect(provider.delete(key)).resolves.toBeUndefined();
    });
  });

  describe('getUrl', () => {
    it('returns /uploads/${key}', () => {
      const key = 'avatars/user-1.png';

      expect(provider.getUrl(key)).toBe(`/uploads/${key}`);
    });
  });
});
