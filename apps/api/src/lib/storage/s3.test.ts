import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'PutObjectCommand' })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'DeleteObjectCommand' })),
}));

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { S3StorageProvider } from './s3.js';

const ALL_ENV_VARS = {
  S3_ENDPOINT: 'https://s3.example.com',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'test-bucket',
  S3_ACCESS_KEY_ID: 'test-key',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  S3_PUBLIC_URL: 'https://cdn.example.com',
};

function setAllEnvVars() {
  for (const [key, value] of Object.entries(ALL_ENV_VARS)) {
    process.env[key] = value;
  }
}

function clearAllEnvVars() {
  for (const key of Object.keys(ALL_ENV_VARS)) {
    delete process.env[key];
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  setAllEnvVars();
});

afterEach(() => {
  clearAllEnvVars();
});

describe('S3StorageProvider', () => {
  describe('constructor — missing env vars', () => {
    it('throws when S3_ENDPOINT is missing', () => {
      delete process.env.S3_ENDPOINT;
      expect(() => new S3StorageProvider()).toThrow('S3_ENDPOINT');
    });

    it('throws when S3_REGION is missing', () => {
      delete process.env.S3_REGION;
      expect(() => new S3StorageProvider()).toThrow('S3_REGION');
    });

    it('throws when S3_BUCKET is missing', () => {
      delete process.env.S3_BUCKET;
      expect(() => new S3StorageProvider()).toThrow('S3_BUCKET');
    });

    it('throws when S3_ACCESS_KEY_ID is missing', () => {
      delete process.env.S3_ACCESS_KEY_ID;
      expect(() => new S3StorageProvider()).toThrow('S3_ACCESS_KEY_ID');
    });

    it('throws when S3_SECRET_ACCESS_KEY is missing', () => {
      delete process.env.S3_SECRET_ACCESS_KEY;
      expect(() => new S3StorageProvider()).toThrow('S3_SECRET_ACCESS_KEY');
    });

    it('throws when S3_PUBLIC_URL is missing', () => {
      delete process.env.S3_PUBLIC_URL;
      expect(() => new S3StorageProvider()).toThrow('S3_PUBLIC_URL');
    });

    it('error message mentions the missing var name', () => {
      delete process.env.S3_BUCKET;
      expect(() => new S3StorageProvider()).toThrow(/S3_BUCKET/);
    });
  });

  describe('constructor — happy path', () => {
    it('creates successfully when all 6 env vars are set', () => {
      expect(() => new S3StorageProvider()).not.toThrow();
    });

    it('creates S3Client with forcePathStyle: true', () => {
      new S3StorageProvider();
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({ forcePathStyle: true }),
      );
    });
  });

  describe('upload', () => {
    it('calls client.send with a PutObjectCommand', async () => {
      const provider = new S3StorageProvider();
      const key = 'avatars/user-1.png';
      const buffer = Buffer.from('image data');
      const mimeType = 'image/png';

      await provider.upload(key, buffer, mimeType);

      expect(mockSend).toHaveBeenCalledOnce();
      expect(PutObjectCommand).toHaveBeenCalledOnce();
    });

    it('PutObjectCommand receives correct Bucket, Key, Body, and ContentType', async () => {
      const provider = new S3StorageProvider();
      const key = 'avatars/user-1.png';
      const buffer = Buffer.from('image data');
      const mimeType = 'image/png';

      await provider.upload(key, buffer, mimeType);

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });
    });
  });

  describe('delete', () => {
    it('calls client.send with a DeleteObjectCommand', async () => {
      const provider = new S3StorageProvider();
      const key = 'avatars/user-1.png';

      await provider.delete(key);

      expect(mockSend).toHaveBeenCalledOnce();
      expect(DeleteObjectCommand).toHaveBeenCalledOnce();
    });

    it('DeleteObjectCommand receives correct Bucket and Key', async () => {
      const provider = new S3StorageProvider();
      const key = 'avatars/user-1.png';

      await provider.delete(key);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      });
    });

    it('silently swallows errors when send rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 error'));
      const provider = new S3StorageProvider();

      await expect(provider.delete('avatars/missing.png')).resolves.toBeUndefined();
    });
  });

  describe('getUrl', () => {
    it('returns ${S3_PUBLIC_URL}/${key}', () => {
      const provider = new S3StorageProvider();
      expect(provider.getUrl('avatars/user-1.png')).toBe('https://cdn.example.com/avatars/user-1.png');
    });

    it('strips trailing slash from S3_PUBLIC_URL', () => {
      process.env.S3_PUBLIC_URL = 'https://cdn.example.com/';
      const provider = new S3StorageProvider();
      expect(provider.getUrl('avatars/user-1.png')).toBe('https://cdn.example.com/avatars/user-1.png');
    });
  });
});
