import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageProvider } from './provider.js';

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const publicUrl = process.env.S3_PUBLIC_URL;

    const missing = (
      [
        ['S3_ENDPOINT', endpoint],
        ['S3_REGION', region],
        ['S3_BUCKET', bucket],
        ['S3_ACCESS_KEY_ID', accessKeyId],
        ['S3_SECRET_ACCESS_KEY', secretAccessKey],
        ['S3_PUBLIC_URL', publicUrl],
      ] as [string, string | undefined][]
    )
      .filter(([, val]) => !val)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `S3 storage backend is missing required environment variables: ${missing.join(', ')}`,
      );
    }

    this.bucket = bucket!;
    this.publicUrl = publicUrl!.replace(/\/$/, '');

    this.client = new S3Client({
      endpoint: endpoint!,
      region: region!,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
      forcePathStyle: true,
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err) {
      console.error(`S3 delete failed for key "${key}":`, err);
    }
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }
}
