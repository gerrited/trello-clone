import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import express from 'express';
import type { StorageProvider } from './provider.js';

export class LocalStorageProvider implements StorageProvider {
  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const dest = path.resolve(process.cwd(), 'uploads', key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, buffer);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.resolve(process.cwd(), 'uploads', key);
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // best-effort: ignore errors
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

export function registerStaticServing(app: Express): void {
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
}
