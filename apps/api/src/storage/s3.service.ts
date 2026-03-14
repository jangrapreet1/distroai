import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);
    private client: S3Client | null = null;
    private bucket: string;
    private readonly localFallbackDir = '/tmp/distroai-uploads';
    private readonly isConfigured: boolean;

    constructor(private config: ConfigService) {
        const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
        this.bucket = config.get<string>('S3_BUCKET_NAME', 'distroai-dev');
        this.isConfigured = !!(accessKeyId && secretAccessKey);

        if (this.isConfigured) {
            this.client = new S3Client({
                region: config.get<string>('AWS_REGION', 'ap-south-1'),
                credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
            });
            this.logger.log('S3 client configured');
        } else {
            this.logger.warn('AWS not configured — using local filesystem fallback at ' + this.localFallbackDir);
            if (!existsSync(this.localFallbackDir)) {
                mkdirSync(this.localFallbackDir, { recursive: true });
            }
        }
    }

    async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
        if (this.client) {
            await this.client.send(
                new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }),
            );
            return `https://${this.bucket}.s3.amazonaws.com/${key}`;
        }

        // Local fallback
        const filePath = join(this.localFallbackDir, key);
        const dir = join(filePath, '..');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(filePath, buffer);
        return `/api/v1/storage/local/${key}`;
    }

    async getSignedDownloadUrl(key: string, expiresInSeconds = 604800): Promise<string> {
        if (this.client) {
            return getSignedUrl(
                this.client,
                new GetObjectCommand({ Bucket: this.bucket, Key: key }),
                { expiresIn: expiresInSeconds },
            );
        }
        return `/api/v1/storage/local/${key}`;
    }

    async delete(key: string): Promise<void> {
        if (this.client) {
            await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
            return;
        }
        this.logger.warn(`[local fallback] delete: ${key}`);
    }

    async uploadFromUrl(sourceUrl: string, destKey: string): Promise<string> {
        const response = await axios.get(sourceUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        return this.upload(destKey, buffer, contentType);
    }
}
